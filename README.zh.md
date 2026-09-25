# dsh-task-notify

> ## ⚠️ 本插件已停维护 —— 功能已并入 [dsh-web-enhance](https://github.com/yangzhe1991/dsh-web-enhance)
>
> 「跑完提醒」(提示音 + 标签页标题)自 **0.2.0** 起是 **[`@yangzhe1991/dsh-web-enhance`](https://www.npmjs.com/package/@yangzhe1991/dsh-web-enhance)** 的内置功能 —— 判定口径不变,另外多了「设置 → 通用」里的开关,并顺带带上另外四个 Web UI 增强功能。
>
> ```sh
> dsh plugin --profile web remove @yangzhe1991/dsh-task-notify
> dsh plugin --profile web add @yangzhe1991/dsh-web-enhance
> ```
>
> 然后重启 Web GUI、刷新标签页即可。本仓库仅作历史留存,不再更新;npm 包已标记 deprecated。

[English](README.md) | [中文](README.zh.md)

[![npm version](https://img.shields.io/npm/v/@yangzhe1991/dsh-task-notify)](https://www.npmjs.com/package/@yangzhe1991/dsh-task-notify)
[![npm downloads](https://img.shields.io/npm/dm/@yangzhe1991/dsh-task-notify)](https://www.npmjs.com/package/@yangzhe1991/dsh-task-notify)
[![license](https://img.shields.io/github/license/yangzhe1991/dsh-task-notify)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-1e90ff)](https://github.com/topics/dsh-plugin)

DSH(DeepSeek Harness)浏览器插件:agent **真的**干完活时提醒你 —— 会话安静下来响一声;弹出"要你选"的框时立刻响一声;你切到别的标签时,还会把标签页标题改成提醒状态。

---

## 兼容性(历史记录,截至 0.2.0)

- **dsh ≥ 0.1.7-rc.2** — 自 **0.2.0** 起支持;自 **0.2.0** 起在 **dsh 0.1.7-rc.2** 上验证通过。
  监视器读三处当前客户端契约:会话列表快照(`useSessions`:`ids` / `byId.origin`)、每会话 UI 状态(`useSessionStatus`:agent `running` + `pendingInteraction`)、以及 `ctx.jobs` 客户端服务的按需任务列表(`watchRows` → `state.rows`)。
- **dsh ≤ 0.1.6 / 0.1.0-rc.x** — 不再支持。那些版本把任务列表放在会话列表快照里(`jobsBySession`)、弹框挂在 `useSessionPendingInteraction` 上,两者都在 0.1.7 移除;本插件把 `jobs` 声明为注入的客户端服务,依赖 0.1.7 引入的任务控制器。

## 迁移(原「安装」)

```sh
dsh plugin --profile web remove @yangzhe1991/dsh-task-notify
dsh plugin --profile web add @yangzhe1991/dsh-web-enhance
```

重启 Web GUI、刷新浏览器标签即可。本插件的全部行为现在都在 `dsh-web-enhance`(0.2.0 起)里,另外还带逐轮导航、思维链默认展开、会话价格统计与「文件用系统程序打开」。

## 功能

- 🎵 **活真正干完才响。** 一个会话满足以下任一条就算"忙":agent 正在跑、**或** 该会话有 `running`/`stopping` 的后台任务、**或** 有弹框在等你选。从"忙"转为"不忙"并且**再安静 2 秒**,才响一次。
  - 这 2 秒安静窗口是必须的:"后台任务结束"和"agent 被这个任务唤醒继续干"在客户端是两条独立的流,不等一个窗口的话,先到的那条(jobs 帧)看起来就像"全干完了"。
  - 任务列表是按会话订阅的,只在需要时开:agent 在跑的会话会订阅,并且**只要该会话还算"忙"就一直订阅** —— 包括 agent 已经让出回合、正在等后台任务的那段空档。
  - 普通一问一答照旧会响(agent 停了、没有任何挂起的东西)—— 这是日常最主要的使用场景。
- 🎵 **弹出"要你选"的框时立刻响** —— 工具权限确认、`ask_user_question` 提问选择、计划确认。与上一类同一个提示音;两者靠标签页标题区分。
- 🎵 **音色:** 正常收尾是上行双音 *do → mi*;本次忙活里有后台任务以 `failed` / `killed` 结束,则播下行双音 *mi → do*。
- 🔔 **标签标题提醒** —— 页面不在当前标签(`document.hidden`)时:普通收尾显示 `🔔 N 个任务完成 — 原标题`,有弹框等你选则显示 `🔔 需要你选择 — 原标题`;切回该标签自动恢复。
- ✅ **防误报** —— 切换会话、加载历史、刷新页面都不会把旧回合或已结束的任务当成"新完成"。后台 **subagent** 子会话不单独提醒:它结束必然唤醒父会话继续干,那还是同一件活。
- 🚫 **不再中途乱响** —— agent 起完后台任务让出回合等结果、后台任务结束唤醒 agent 继续干,这两件事都**不是**活干完了,现在都不再响(旧版本就是在这两个点上误报)。

## 首次使用:先在页面上点一下

浏览器 autoplay 策略要求用户先与页面交互才能发声。**在页面任意位置点击或按键一次**,提示音从此解锁。标签标题提醒不受影响。

## 常见问题

**Q: 任务跑完了但没声音。**
A: 按顺序排查:(1) 还没跟页面交互过(见上);(2) 该会话还有后台任务在跑 —— 哪怕是你自己都忘了的僵尸任务 —— 只要没跑完,插件就一直不响;(3) 你跑的是普通前台工具调用,它本身不是触发事件:只有"会话安静下来"和"弹框等你选"会响。

**Q: 后台任务明明结束了却不响。**
A: 这是设计如此。DSH 把任务完成作为会话内通知投递,默认(`completionDelivery: wakeup`)会直接开一个新回合把空闲的 agent 唤醒继续干。提示音现在等这条链真正走完,而不是每一环都响一次。

**Q: 为什么有时候会晚两三秒才响?**
A: 那 2 秒安静窗口。它就是用来防止"任务结束的 jobs 帧先到、agent 的 running 帧后到"被误判成"全干完了"。

**Q: 切到别的会话时它响了一声。**
A: 这是早期版本(0.1.1 之前)的 bug,已修复。更新插件并刷新页面即可。

**Q: 到底哪些事件会触发?**
A: (1) 一个原本"忙"的会话转为"不忙"(agent 停了、没有运行中的任务、没有等待选择的弹框)并持续约 2 秒;(2) 出现等待你选择的弹框。

**Q: 能改声音或关掉某类提醒吗?**
A: 见下方"自定义"。

**Q: 这个插件装了什么?**
A: 一个 profile bundle:配置层(`cordis.patch.yml`)+ 浏览器端 bundle(`lib/client.js`),DSH Web 应用启动时自动发现 —— 不需要手动配置,也不添加任何 UI。

## 自定义

可调参数在 `src/client/index.tsx` 顶部(决策状态机本身在 `src/client/monitor.ts`),改完重新 `npm run build`(也欢迎提 PR 🙂)。

| 常量 | 默认值 | 含义 |
|---|---|---|
| `SOUND_ENABLED` | `true` | 完成时是否播放提示音 |
| `TITLE_ENABLED` | `true` | 页面隐藏时是否改标签标题 |
| `ALERT_PREFIX` | `'🔔'` | 提醒标题的前缀文案 |
| `QUIET_MS` | `2000` | 会话转闲后要安静多少毫秒才响 |

## 开发

```sh
git clone git@github.com:yangzhe1991/dsh-task-notify.git
cd dsh-task-notify
npm install
npm run build        # 产出 lib/index.js(宿主半)+ lib/client.js(浏览器半)
npx tsc --noEmit     # 类型检查
```

```
├── package.json          # dsh.bundle(profile 配置层)+ dsh.client(浏览器半)声明
├── cordis.patch.yml      # 插件行配置层
├── build.mjs             # esbuild 构建:宿主半 + 浏览器半
├── src/
│   ├── index.ts          # 宿主半(空 apply 占位)
│   └── client/
│       ├── index.tsx     # 浏览器半:slot 装配、提示音、标题提醒
│       └── monitor.ts    # 纯决策状态机(忙闲转变 + 弹框等待)
└── lib/                  # 构建产物(gitignore)
```

## 卸载

已被上面的迁移命令取代 —— 即卸载本插件、改装 `dsh-web-enhance`。

## 许可证

MIT
