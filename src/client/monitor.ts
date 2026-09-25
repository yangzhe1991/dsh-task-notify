/**
 * dsh-task-notify 的提醒决策状态机(纯逻辑:不依赖 React / DOM / 浏览器 API,
 * 定时器可注入,便于用真实日志回放验证)。
 *
 * ## 为什么不能沿用"回合结束 / 任务结束"作为触发点
 *
 * 官方两个事件口径都回答不了"这段活到底干完没有":
 *
 * - `turn/end` 只表示 agent 这一轮不再继续生成。agent 起完后台任务、把话说完
 *   让出回合等结果时也会发 `turn/end`(`TurnEndReasonMap` 里只有 completed /
 *   aborted / blocked / error / max-tokens / interrupted,没有"等待后台任务"
 *   这一档);
 * - 后台任务 settled 也不代表活干完了:`dsh-tool-jobs` 默认
 *   `completionDelivery: wakeup`,任务一结束就对空闲的 owner 调
 *   `followup()` 开一个新回合,agent 被唤醒后继续干。
 *
 * 实锤(user 机器上的会话日志,--home-yangzhe-OpenClaw--/session-792d9728,
 * 一次「要」的请求):20:16:02 agent 起 3 个后台任务 → turn#57 结束(20:16:56,
 * 此时 3 个任务都在跑)→ 任务结束唤醒 → turn#58(20:17:30~20:18:16)→ 任务
 * bash-35 结束唤醒 → turn#59(20:18:39~20:18:49)才真正收尾。旧口径在这 2 分钟里
 * 会响 5 次(每回合 1 次 + 每任务 1 次),其中 4 次都是"没跑完就叫"。
 *
 * ## 本状态机的口径(2026-09 与用户确认)
 *
 * 每个顶层会话有两条互相独立的触发线:
 *
 * 1. **忙 → 闲**(转闲后再安静 `quietMs` 仍没转忙)⇒ 提醒"跑完了";
 * 2. **出现新的"等待用户选择"**(权限确认 / 提问选择 / 计划确认)⇒ 立即提醒,
 *    与"跑完了"用同一个提示音(用户口径:都跑完了或者弹选择框让用户选的时候响)。
 *
 * "忙"的定义 = `agent 正在跑` **或** `有 running/stopping 的后台任务` **或**
 * `有等待用户选择的弹框`。第三条是必须的:弹框出现时 agent 那一步被卡住,
 * 若不计入"忙",弹框一出现就会先响一次"跑完了",用户答完 agent 继续干,又响一次。
 *
 * 去抖 `quietMs` 的作用:任务 settled 与"agent 被唤醒"是宿主同一拍发生的两件事,
 * 但客户端是两条独立的流(control 流的 jobs 帧 / session 流的 status 帧),到达有
 * 先后。若不等一个安静窗口就判定"跑完了",恰好先收到 jobs 帧的那次就会误报。
 *
 * 失败音:一次"忙"周期内若有后台任务从 live 转为 `failed` / `killed`,
 * 该周期的提醒播下行双音(用户口径:保留失败音,判据换成后台任务状态)。
 *
 * 首帧纪律:只观测、不提醒。页面加载 / 刷新时快照里已有的历史回合与历史任务
 * 都不会触发(与旧版"切换会话、加载历史不误报"的承诺一致)。
 */

/** 后台任务状态(官方 `SessionJob.status` 的完整取值)。 */
export type JobStatus = 'running' | 'stopping' | 'completed' | 'killed' | 'failed'

/** 仍存活的后台任务状态。 */
const LIVE_JOBS: ReadonlySet<JobStatus> = new Set<JobStatus>(['running', 'stopping'])
/** 判定为"失败"的结束状态:`stopping`/`killed` 是用户主动取消,同样播下行音。 */
const FAILED_JOBS: ReadonlySet<JobStatus> = new Set<JobStatus>(['failed', 'killed'])

/** 一个会话的本帧事实(由 React 侧从官方列表快照里取出)。 */
export interface SessionInput {
  /** 官方 `SessionSummary.running`:agent loop 是否正在跑。 */
  readonly running: boolean
  /** 官方 `jobsBySession[sessionId]`:该会话能看到的后台任务。 */
  readonly jobs: readonly { readonly id: string; readonly status: JobStatus }[]
  /** 该会话当前等待用户选择的交互 key;没有则为 undefined。 */
  readonly pendingChoiceKey?: string | undefined
}

/** 提醒类型:`done` = 忙转闲跑完了;`choice` = 弹框等你选。 */
export type NotifyKind = 'done' | 'choice'

/** 定时器句柄:浏览器是 number、Node 是对象,故用环境无关的推导类型。 */
type TimerHandle = ReturnType<typeof setTimeout>

export interface MonitorOptions {
  /** 忙转闲后要安静多久才提醒(见文件头"去抖"说明)。 */
  readonly quietMs: number
  /**
   * 触发一次提醒。
   * @param kind - 触发原因。
   * @param failed - 该次"忙"周期内是否有后台任务 failed/killed。
   */
  readonly notify: (kind: NotifyKind, failed: boolean) => void
  /** 定时器注入点(测试用假时钟);默认 `setTimeout`。 */
  readonly setTimer?: ((fn: () => void, ms: number) => TimerHandle) | undefined
  /** 定时器取消注入点;默认 `clearTimeout`。 */
  readonly clearTimer?: ((handle: TimerHandle) => void) | undefined
}

export interface Monitor {
  /** 用本帧的全会话事实推进状态机(会话从快照里消失即丢弃其状态)。 */
  update(sessions: ReadonlyMap<string, SessionInput>): void
  /**
   * 仍在状态机里"活着"的会话(忙 或 正在等安静窗口)。
   *
   * 用途:dsh 0.1.7 起任务列表按会话订阅(`ctx.jobs.watchRows`),
   * 只在 agent 还在跑时订阅会漏掉"让出回合等任务"那段 —— 那正是必须盯着
   * 任务的时刻。调用方据此维持订阅集合:running 的会话 ∪ 本集合。
   * @returns 会话 id 快照(顺序无关)。
   */
  activeSessions(): readonly string[]
  /** 卸载时清掉所有在途定时器。 */
  dispose(): void
}

/** 单会话状态机内部状态。 */
interface SessionState {
  /** idle = 闲且已结算;busy = 忙;quiet = 刚转闲、正在等安静窗口。 */
  phase: 'idle' | 'busy' | 'quiet'
  /** quiet 阶段在途的提醒定时器。 */
  timer: TimerHandle | undefined
  /** 上一帧的任务 id → 状态,用于识别 live → settled 的转变。 */
  jobs: Map<string, JobStatus>
  /** 上一次看到的等待选择 key(同 key 持续存在不重复提醒)。 */
  pendingChoiceKey: string | undefined
  /** 本"忙"周期内是否出现过 failed/killed 的任务。 */
  failed: boolean
  /** 本帧是否算"忙"(定时器回调里要重新核对,不能只看触发时的判断)。 */
  busy: boolean
}

/**
 * 创建一个提醒决策状态机。
 * @param options - 去抖时长、提醒回调与可注入的定时器。
 * @returns 可反复喂快照的监视器实例。
 */
export function createMonitor(options: MonitorOptions): Monitor {
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle))
  const states = new Map<string, SessionState>()

  /** 任务列表里是否还有存活任务(running/stopping)。 */
  const hasLiveJob = (jobs: SessionInput['jobs']): boolean => jobs.some((job) => LIVE_JOBS.has(job.status))

  return {
    update(sessions: ReadonlyMap<string, SessionInput>): void {
      for (const [sessionId, input] of sessions) {
        let state = states.get(sessionId)
        if (state === undefined) {
          // 首帧只记录:phase 直接按本帧忙闲落位,已在跑的会话后续转闲照样提醒,
          // 而首帧就闲的会话(历史回合 / 历史任务)不会补报。
          state = {
            phase: 'idle',
            timer: undefined,
            jobs: new Map(),
            pendingChoiceKey: undefined,
            failed: false,
            busy: false,
          }
          states.set(sessionId, state)
        }

        // ① 失败判定:只认"上一帧还 live、这一帧 settled 为 failed/killed"的转变,
        //    这样加载页面时已经失败的历史任务不会被翻出来当成本次失败。
        const nextJobs = new Map<string, JobStatus>()
        for (const job of input.jobs) {
          nextJobs.set(job.id, job.status)
          const before = state.jobs.get(job.id)
          if (before !== undefined && LIVE_JOBS.has(before) && FAILED_JOBS.has(job.status)) state.failed = true
        }
        state.jobs = nextJobs

        // ② 新的"等待用户选择":key 变化(含首次出现)立即提醒。
        //    同一个弹框持续存在不会重复提醒;答完再弹一个新框(key 不同)会再提醒。
        if (input.pendingChoiceKey !== undefined && input.pendingChoiceKey !== state.pendingChoiceKey) {
          options.notify('choice', state.failed)
        }
        state.pendingChoiceKey = input.pendingChoiceKey

        // ③ 忙 → 闲:转闲时开一个安静窗口,窗口内又转忙就撤销(唤醒的新回合抢先)。
        const busy = input.running || hasLiveJob(input.jobs) || input.pendingChoiceKey !== undefined
        state.busy = busy
        if (busy) {
          if (state.timer !== undefined) {
            clearTimer(state.timer)
            state.timer = undefined
          }
          state.phase = 'busy'
          continue
        }
        if (state.phase !== 'busy') continue
        state.phase = 'quiet'
        state.timer = setTimer(() => {
          state.timer = undefined
          // 安静窗口结束:再核对一次最新状态(定时器只是延迟,不是判定依据)。
          if (state.busy) return
          state.phase = 'idle'
          const failed = state.failed
          state.failed = false
          options.notify('done', failed)
        }, options.quietMs)
      }

      // 快照里消失的会话(关闭 / 不在列表里):连状态带定时器一起丢。
      for (const [sessionId, state] of states) {
        if (sessions.has(sessionId)) continue
        if (state.timer !== undefined) clearTimer(state.timer)
        states.delete(sessionId)
      }
    },

    activeSessions(): readonly string[] {
      const active: string[] = []
      for (const [sessionId, state] of states) if (state.phase !== 'idle') active.push(sessionId)
      return active
    },

    dispose(): void {
      for (const state of states.values()) if (state.timer !== undefined) clearTimer(state.timer)
      states.clear()
    },
  }
}
