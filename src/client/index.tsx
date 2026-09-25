/**
 * @yangzhe1991/dsh-task-notify 插件,浏览器半。
 *
 * 职责(纯逻辑,不渲染任何可见 UI):
 * 1. 监视每个顶层会话的"忙闲",在真正的收尾点提醒 —— 判定口径见
 *    `./monitor.ts` 的文件头(核心:agent 停止 + 无运行中后台任务 + 无等待
 *    用户选择的弹框,再安静 2 秒才响)。旧版"回合结束就响 / 任务结束就响"
 *    会在一段活里响很多次且大多是误报,已废弃。
 * 2. 提醒方式:
 *    a. 播放合成提示音(Web Audio,无音频资源;正常结束上行双音,
 *       本次忙活里有后台任务 failed/killed 则下行双音);
 *    b. 页面不在当前标签(document.hidden)时改标签页标题,回到前台恢复。
 *
 * 实现:只注册一个 slot 条目 —— shell.overlay(root 作用域),数据来自三处官方契约
 * (dsh 0.1.7 起):
 *   - `useSessions`(会话列表快照:ids / byId.origin)决定"监视哪些顶层会话";
 *   - `useSessionStatus`(每会话 running + pendingInteraction)给出"agent 在不在跑 /
 *     有没有弹框等着用户选";
 *   - `ctx.jobs`(任务控制服务,dsh 0.1.7 从列表快照的 jobsBySession 迁到这里)按会话
 *     订阅任务列表(`watchRows`),用于判断"还有没有后台任务在跑"。
 *
 * 浏览器限制:autoplay 策略要求 AudioContext 在用户交互后才可发声,
 * 插件监听首次 pointerdown/keydown 解锁;未解锁前提示音静默跳过,
 * 标题提醒不受影响。
 */
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
// 官方模式:ClientContext 就是 cordis 的 Context(服务经声明合并挂在上面)。
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
// 声明合并:ctx.slots 由 ui-renderer 提供。
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// 声明合并:GlobalStandardProps.useSessions / useSessionStatus 由 ui-session 挂载。
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
// 声明合并:SlotMap 里的 shell.overlay 由 layout 声明。
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// 任务控制服务(客户端半):ctx.jobs 的对外面。纯类型导入,esbuild 会擦除。
import type { IJobs, JobsSnapshot } from '@deepseek-ai/dsh-api-job-controller/client'
import { createMonitor, type NotifyKind, type SessionInput } from './monitor'

// —— 可调参数(如需可配置,可在此修改默认值)——
/** 任务完成时是否播放提示音。 */
const SOUND_ENABLED = true
/** 页面不在当前标签时,是否修改标签页标题提醒。 */
const TITLE_ENABLED = true
/** 提示音前缀文案(标题提醒)。 */
const ALERT_PREFIX = '🔔'
/**
 * "忙转闲"之后的安静窗口(毫秒):任务 settled 与宿主唤醒 agent 是同一拍的两件事,
 * 客户端分两条流到达,必须等一个窗口确认没有新回合接手,才算真的干完。
 */
const QUIET_MS = 2000

// —— 提示音:Web Audio 合成,无需音频资源 ——

/** 全局唯一的 AudioContext(浏览器限制:需用户交互后 state 才为 running)。 */
let audioContext: AudioContext | null = null

/** 获取并尽力解锁音频上下文;不可用时返回 null(调用方静默跳过)。 */
function ensureAudio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (audioContext === null) {
    try {
      audioContext = new AudioContext()
    } catch {
      return null
    }
  }
  // 首次用户交互后 resume 才会真正成功;这里尽力而为。
  if (audioContext.state === 'suspended') void audioContext.resume()
  return audioContext.state === 'running' ? audioContext : null
}

/** 播放一个正弦音(带音量包络,避免爆音)。 */
function tone(ctx: AudioContext, frequency: number, start: number, duration: number): void {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  // 快速起音 + 指数衰减,峰值音量 0.25。
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.05)
}

/**
 * 播放提示音:正常收尾为上行双音(do → mi),本次忙活里有任务失败/被杀为
 * 下行双音(mi → do)。"弹框等你选"与"跑完了"用同一个音(用户口径)。
 */
function playChime(failed: boolean): void {
  const ctx = ensureAudio()
  if (ctx === null) return
  const now = ctx.currentTime
  if (!failed) {
    tone(ctx, 880, now, 0.18)
    tone(ctx, 1318.5, now + 0.18, 0.35)
  } else {
    tone(ctx, 659.25, now, 0.18)
    tone(ctx, 440, now + 0.18, 0.4)
  }
}

// —— 标签页标题提醒 ——

/** 尚未清除的"跑完了"计数(仅页面隐藏期间累计)。 */
let pendingAlerts = 0
/** 尚未清除的"等你选择"计数(仅页面隐藏期间累计)。 */
let pendingChoices = 0
/** 设置提醒前保存的原标题,用于恢复。 */
let savedTitle: string | null = null

/**
 * 任务收尾且页面隐藏:标题改为提醒文案。
 * 有等待用户选择的弹框时优先显示"需要你选择"(那条更急)。
 */
function applyAlertTitle(): void {
  if (savedTitle === null) savedTitle = document.title
  const alert = pendingChoices > 0
    ? `${ALERT_PREFIX} 需要你选择`
    : `${ALERT_PREFIX} ${pendingAlerts} 个任务完成`
  document.title = `${alert} — ${savedTitle}`
}

/** 回到前台:恢复原标题并清零计数。 */
function clearAlertTitle(): void {
  if (savedTitle === null) return
  document.title = savedTitle
  savedTitle = null
  pendingAlerts = 0
  pendingChoices = 0
}

/** 触发一次提醒:提示音(尽力)+ 页面隐藏时标题提醒。 */
function notify(kind: NotifyKind, failed: boolean): void {
  if (SOUND_ENABLED) playChime(failed)
  if (!TITLE_ENABLED || !document.hidden) return
  if (kind === 'choice') pendingChoices += 1
  else pendingAlerts += 1
  applyAlertTitle()
}

// —— 插件主体 ——

/**
 * 版本戳(与 package.json 的 version 手工保持一致)。
 * 用途:排查"页面上跑的到底是哪份构建" —— 控制台一行日志 + `<html data-dsh-task-notify>`,
 * 硬刷新后读一次即可确认,不必翻 DevTools 的 network。
 */
const VERSION = '0.2.0'

/** 需要的 client 服务:jobs(按会话订阅任务列表)、slots(slot 注册)。 */
export const inject = ['jobs', 'slots']

/** Client 插件 body:注册全局监视条目。 */
export function apply(ctx: ClientContext): void {
  // 装配期打点:失败也不能连累插件注册(composed 阶段抛异常会让整棵树崩)。
  try {
    console.info(`[task-notify] v${VERSION} 已装配:会话安静 / 弹框等待时提醒`)
    document.documentElement.dataset.dshTaskNotify = VERSION
  } catch (error) {
    console.warn('[task-notify] 装配打点失败(已忽略):', error)
  }
  // 任务服务经闭包递给组件:shell.overlay 的 slot 声明没有 inject 面,
  // 拿不到官方那套"注册时注入 hooks"的写法(ui-jobs 注册在会话头,那里有)。
  const jobs = ctx.jobs
  // 全局:会话忙闲监视(不依赖当前会话,覆盖所有顶层会话)。
  ctx.slots.inject(
    'shell.overlay',
    () => ctx.slots.register({
      name: 'shell.overlay',
      id: 'task-notify',
    }, (props: GlobalStandardProps) => <TaskNotifyMonitor {...props} jobs={jobs} />),
  )
}

/** 首次用户交互解锁音频(pointerdown/keydown 各一次,取先到者)。 */
function useAudioUnlock(): void {
  useEffect(() => {
    const unlock = (): void => {
      void ensureAudio()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])
}

/** 回到前台时清除标题提醒。 */
function useVisibilityClear(): void {
  useEffect(() => {
    const onVisibilityChange = (): void => {
      if (!document.hidden) clearAlertTitle()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])
}

/**
 * 订阅官方任务服务的每会话任务列表(`JobsSnapshot.rows`)。
 *
 * dsh 0.1.7 起任务不再随会话列表快照下发,而是按会话订阅(`watchRows`):
 * 没人订阅的会话在 rows 里没有键,所以"会话有没有在跑的任务"必须先订阅再读。
 * 用 useSyncExternalStore 直接订阅官方 observable(官方组件同款写法,
 * 见 ui-chat / ui-commands)。
 */
function useJobRows(jobs: IJobs): JobsSnapshot['rows'] {
  return useSyncExternalStore(
    (onChange) => jobs.state.subscribe(onChange),
    () => jobs.state.getSnapshot().rows,
  )
}

/**
 * 全局监视组件(root 作用域):把官方快照投影成"每会话事实"喂给状态机,
 * 状态机决定何时提醒;同时按状态机给出的活跃集合维护任务订阅。渲染 null。
 */
function TaskNotifyMonitor({ useSessions, useSessionStatus, jobs }: GlobalStandardProps & { jobs: IJobs }) {
  // 会话 id 列表(宿主列表序);byId 只用来取 origin 判 subagent 子会话。
  const ids = useSessions((state) => state.ids)
  const byId = useSessions((state) => state.byId)
  // 每会话 UI 状态:running(agent 在不在跑)+ pendingInteraction(有没有弹框等你选)。
  const status = useSessionStatus((snapshot) => snapshot)
  const rows = useJobRows(jobs)

  const monitor = useMemo(
    () => createMonitor({ quietMs: QUIET_MS, notify }),
    [],
  )

  // 投影:跳过 subagent 子会话 —— 它的结束必然唤醒父会话继续干活,
  // 单独提醒就是"没跑完就叫"(父会话那一侧的后台任务仍在 live,不会漏报)。
  //
  // 防御性写法:渲染期抛异常会让整个客户端组合树崩成白屏(比"不提醒"严重得多),
  // 所以宿主快照形状不符预期时一律降级为"这一帧不提醒",绝不抛。
  const inputs = useMemo(() => {
    const next = new Map<string, SessionInput>()
    if (!Array.isArray(ids) || byId === null || typeof byId !== 'object') return next
    for (const id of ids) {
      const row = byId[id]
      if (row === undefined || row.origin === 'subagent') continue
      const live = status?.get(id)
      next.set(id, {
        // SessionStatus.running 为 undefined 时(还没建立基线)退回列表快照的宿主状态。
        running: live?.running ?? row.running === true,
        // 没有订阅任务列表的会话在 rows 里没有键 ⇒ 当作"当前看不到任务"。
        jobs: rows?.[id] ?? [],
        pendingChoiceKey: live?.pendingInteraction?.key,
      })
    }
    return next
  }, [ids, byId, status, rows])

  /** 当前维持的任务订阅:会话 id → 取消函数。 */
  const watchesRef = useRef(new Map<string, () => void>())

  useEffect(() => {
    // 状态机自己也不允许把异常抛进 React(定时器回调/adapter 里抛会静默丢失),
    // 这里兜底并留一条可见日志,便于以后排查契约变化。
    try {
      monitor.update(inputs)
    } catch (error) {
      console.warn('[task-notify] 推进提醒状态机失败(已忽略):', error)
    }

    // 订阅集合 = agent 正在跑的会话 ∪ 状态机仍认为活跃的会话(忙 / 等安静窗口)。
    // 后半句是必须的:agent 让出回合等后台任务时 running 已经是 false,
    // 但那时恰恰最需要盯着任务列表 —— 否则会把"还有任务在跑"误判成"干完了"。
    const wanted = new Set<string>()
    for (const [id, input] of inputs) if (input.running) wanted.add(id)
    for (const id of monitor.activeSessions()) if (inputs.has(id)) wanted.add(id)

    const watches = watchesRef.current
    for (const [id, stop] of watches) {
      if (wanted.has(id)) continue
      watches.delete(id)
      try {
        stop()
      } catch (error) {
        console.warn(`[task-notify] 释放会话 ${id} 的任务订阅失败(已忽略):`, error)
      }
    }
    // 新增订阅:遍历官方的会话 id 列表(带品牌类型,watchRows 需要它),
    // 而不是遍历上面那个纯 string 的集合。
    for (const id of ids) {
      if (!wanted.has(id) || watches.has(id)) continue
      try {
        watches.set(id, jobs.watchRows(id))
      } catch (error) {
        console.warn(`[task-notify] 订阅会话 ${id} 的任务列表失败(已忽略):`, error)
      }
    }
  }, [monitor, inputs, jobs, ids])

  // 卸载(插件被移除 / 组合树重建)时清掉在途定时器与全部订阅,避免幽灵提醒。
  useEffect(() => () => {
    for (const stop of watchesRef.current.values()) {
      try {
        stop()
      } catch {
        // 卸载期释放失败无需上报:服务很可能已经随上下文一起销毁。
      }
    }
    watchesRef.current.clear()
    monitor.dispose()
  }, [monitor])

  useAudioUnlock()
  useVisibilityClear()

  return null
}
