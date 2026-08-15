/**
 * @yangzhe1991/dsh-task-notify 插件,浏览器半。
 *
 * 职责(纯逻辑,不渲染任何可见 UI):
 * 1. 监听两类"任务完成":
 *    a. 后台任务(jobs)完成 —— 任意会话的 background job 从 live
 *       (running/stopping) 变为 settled (completed/killed/failed);
 *    b. 当前会话的 agent 回合完成 —— turnTimings 中出现新的 turn/end
 *       (agent 正常回复、报错、中止都会发出 turn/end,即"跑完一轮")。
 *    任一触发即提醒。
 * 2. 提醒方式:
 *    a. 播放合成提示音(Web Audio,无音频资源;成功上行双音,失败/被杀下行双音);
 *    b. 页面不在当前标签(document.hidden)时,把标签页标题改为
 *       "🔔 N 个任务完成 — 原标题",回到前台后恢复。
 *
 * 实现:注册两个 slot 条目 ——
 * - shell.overlay(root 作用域):全局 jobs 监听,不依赖当前会话;
 * - conversation.session.header.actions(session 作用域):当前会话回合监听。
 * 两者都渲染 null。
 *
 * 浏览器限制:autoplay 策略要求 AudioContext 在用户交互后才可发声,
 * 插件监听首次 pointerdown/keydown 解锁;未解锁前提示音静默跳过,
 * 标题提醒不受影响。
 */
import { useEffect, useMemo, useRef } from 'react'
import type { ClientContext, JobView } from '@deepseek-ai/dsh-client-runtime/client'
import type { GlobalStandardProps, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// 触发 SlotMap 声明合并:shell.overlay 由 layout、conversation.session.header.actions 由 conversation 声明。
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'

// —— 可调参数(如需可配置,可在此修改默认值)——
/** 任务完成时是否播放提示音。 */
const SOUND_ENABLED = true
/** 页面不在当前标签时,是否修改标签页标题提醒。 */
const TITLE_ENABLED = true
/** 提示音前缀文案(标题提醒)。 */
const ALERT_PREFIX = '🔔'

/** 仍存活的后台任务状态。 */
const LIVE: ReadonlySet<JobView['status']> = new Set(['running', 'stopping'])
/** 已结束的后台任务状态。 */
const SETTLED: ReadonlySet<JobView['status']> = new Set(['completed', 'killed', 'failed'])

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
 * 播放完成提示音:成功为上行双音(do → mi),失败/被杀为下行双音(mi → do)。
 */
function playChime(success: boolean): void {
  const ctx = ensureAudio()
  if (ctx === null) return
  const now = ctx.currentTime
  if (success) {
    tone(ctx, 880, now, 0.18)
    tone(ctx, 1318.5, now + 0.18, 0.35)
  } else {
    tone(ctx, 659.25, now, 0.18)
    tone(ctx, 440, now + 0.18, 0.4)
  }
}

// —— 标签页标题提醒 ——

/** 尚未清除的完成提醒计数(仅页面隐藏期间累计)。 */
let pendingAlerts = 0
/** 设置提醒前保存的原标题,用于恢复。 */
let savedTitle: string | null = null

/** 任务完成且页面隐藏:标题改为 "🔔 N 个任务完成 — 原标题"。 */
function applyAlertTitle(): void {
  if (savedTitle === null) savedTitle = document.title
  document.title = `${ALERT_PREFIX} ${pendingAlerts} 个任务完成 — ${savedTitle}`
}

/** 回到前台:恢复原标题并清零计数。 */
function clearAlertTitle(): void {
  if (savedTitle === null) return
  document.title = savedTitle
  savedTitle = null
  pendingAlerts = 0
}

/** 触发一次提醒:提示音(尽力)+ 页面隐藏时标题提醒。 */
function notify(success: boolean): void {
  if (SOUND_ENABLED) playChime(success)
  if (TITLE_ENABLED && document.hidden) {
    pendingAlerts += 1
    applyAlertTitle()
  }
}

// —— 插件主体 ——

/** 需要的 client 服务:sessions(会话/回合数据)、slots(slot 注册)。 */
export const inject = ['sessions', 'slots']

/** Client 插件 body:注册两个监听条目。 */
export function apply(ctx: ClientContext): void {
  // 全局:后台任务完成监听。
  ctx.slots.inject(
    'shell.overlay',
    () => ctx.slots.register({
      name: 'shell.overlay',
      id: 'task-notify-jobs',
    }, TaskNotifyJobs),
  )
  // 当前会话:agent 回合完成监听。
  ctx.slots.inject(
    'conversation.session.header.actions',
    () => ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'task-notify-turns',
    }, TaskNotifyTurns),
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
 * 全局后台任务监听组件(root 作用域):订阅 jobsBySession,
 * 检测任务从 live → settled 的转变。渲染 null。
 */
function TaskNotifyJobs({ useSessions }: GlobalStandardProps) {
  // 订阅整个 jobsBySession 映射(引用稳定,聚合结果按需派生)。
  const jobsBySession = useSessions((state) => state.jobsBySession)

  // 聚合所有会话的任务(依赖 jobsBySession 引用,无变化时不重算)。
  const allJobs = useMemo(() => {
    const list: JobView[] = []
    for (const jobs of Object.values(jobsBySession)) list.push(...jobs)
    return list
  }, [jobsBySession])

  useAudioUnlock()
  useVisibilityClear()

  // 检测 live → settled 转变:以 job id → status 的上一帧快照为基准。
  // 页面加载时已结束的历史任务不在快照的 live 集合里,不会误报。
  const prevStatusRef = useRef<ReadonlyMap<string, JobView['status']>>(new Map())
  useEffect(() => {
    const prev = prevStatusRef.current
    const next = new Map<string, JobView['status']>()
    let settledCount = 0
    let successCount = 0
    for (const job of allJobs) {
      next.set(job.id, job.status)
      const before = prev.get(job.id)
      if (before !== undefined && LIVE.has(before) && SETTLED.has(job.status)) {
        settledCount += 1
        if (job.status === 'completed') successCount += 1
      }
    }
    prevStatusRef.current = next
    for (let i = 0; i < settledCount; i += 1) notify(successCount > 0)
  }, [allJobs])

  return null
}

/**
 * 当前会话回合监听组件(session 作用域):订阅 turnTimings,
 * 检测新的 turn/end(agent 跑完一轮:正常回复或报错都会发出)。
 * 渲染 null。
 *
 * 防误报:组件挂在当前会话的 header 上,切换会话 / 会话从 loading 变为
 * open 时,turnTimings 会整体换成新内容 —— 因此首帧(或非 open 帧之后
 * 的第一帧)只建立"已结束回合"快照,不提醒;只有快照建立后新出现的
 * endTime 才算回合完成。
 */
function TaskNotifyTurns({ useSession, sessionId }: PropsRuntime<'conversation.session.header.actions'>) {
  // turn → { startTime, endTime? } ;endTime 出现即回合完成。
  const turnTimings = useSession((state) => state.turnTimings)
  const lastAgentError = useSession((state) => state.lastAgentError)
  // 会话窗口打开状态:loading 期间快照内容不可信,不比较。
  const openState = useSession((state) => state.openState)

  useAudioUnlock()
  useVisibilityClear()

  /** 已建快照:记录"快照所属会话"与"当时已结束的回合集合"。 */
  const snapshotRef = useRef<{ sessionId: string; ends: ReadonlySet<number> } | null>(null)
  useEffect(() => {
    // 会话未 open(冷启动加载/切换中):快照作废,等 open 后首帧重建。
    if (openState !== 'open') {
      snapshotRef.current = null
      return
    }
    // 当前已结束的回合集合。
    const ends = new Set<number>()
    for (const [turn, timing] of turnTimings) {
      if (timing.endTime !== undefined) ends.add(turn)
    }
    const snapshot = snapshotRef.current
    // 首帧或会话切换:只建快照,不提醒(历史回合不能算"新完成")。
    if (snapshot === null || snapshot.sessionId !== sessionId) {
      snapshotRef.current = { sessionId, ends }
      return
    }
    // 快照建立后:新出现的 endTime 才是回合完成。
    let completed = 0
    let success = true
    for (const turn of ends) {
      if (!snapshot.ends.has(turn)) {
        completed += 1
        // lastAgentError 非空近似认为本回合失败(报错回合结束时会置位)。
        if (lastAgentError !== null) success = false
      }
    }
    snapshotRef.current = { sessionId, ends }
    for (let i = 0; i < completed; i += 1) notify(success)
  }, [turnTimings, lastAgentError, openState, sessionId])

  return null
}
