# dsh-task-notify

[![npm version](https://img.shields.io/npm/v/@yangzhe1991/dsh-task-notify)](https://www.npmjs.com/package/@yangzhe1991/dsh-task-notify)
[![license](https://img.shields.io/github/license/yangzhe1991/dsh-task-notify)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-1e90ff)](https://github.com/topics/dsh-plugin)

A DSH (DeepSeek Harness) browser plugin that tells you when your agent finishes work — a completion chime, and a tab-title alert while you are on another tab.

DSH(DeepSeek Harness)浏览器插件:agent 干完活时提醒你 —— 播放提示音;你切到别的标签时,还会把标签页标题改成提醒状态。

---

## English

### Install (30 seconds)

Prereqs: the `dsh` CLI ([DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)).

```sh
dsh plugin --profile web add @yangzhe1991/dsh-task-notify
```

Then restart the Web GUI and refresh the browser tab. That's it — the package ships prebuilt artifacts, so nothing compiles on your machine and no allowlist is needed. `dsh plugin` auto-appends the bundle to your profile's `dsh.profile.bundles`.

> **Other install methods** (usually not needed):

> | Method | Command | Builds on install | Notes |
> |---|---|---|---|
> | npm registry **(recommended)** | `dsh plugin --profile web add @yangzhe1991/dsh-task-notify` | No | Prebuilt, quickest |
> | tarball | `dsh plugin --profile web add ./dsh-task-notify-0.1.0.tgz` | No | Offline-friendly |
> | git | `dsh plugin --profile web add github:yangzhe1991/dsh-task-notify` | Yes (via `prepare`) | Requires one-time `allowBuilds` in `pnpm-workspace.yaml` |

### What it does

- 🎵 **Completion chime** — a synthesized two-tone chime (no audio files) when:
  - an **agent turn finishes** in your current session (normal reply, error, or abort) — this covers ordinary conversations;
  - a **background job settles** in any session (`completed` / `failed` / `killed` — background bash/pwsh, subagents, workflows, …).
  - Success: ascending *do → mi*. Failure / kill: descending *mi → do*.
- 🔔 **Tab-title alert** — while the page is not the active tab (`document.hidden`), a finished task changes the title to `🔔 N 个任务完成 — <original title>`; switching back to the tab restores it.
- ✅ **No false positives** — switching sessions, loading history, or refreshing the page never re-alerts for old turns. Only work that actually finishes while you are watching the current session triggers.

### First-run note: click the page once

Browsers block audio until the user has interacted with the page (autoplay policy). **Click or press a key anywhere in the page once** — chimes are unlocked from then on. The tab-title alert is never affected.

### FAQ

**Q: I finished a task but heard nothing.**
A: You likely haven't interacted with the page yet (see above), or the task was a plain foreground tool call — those don't trigger; only agent turns and background jobs do.

**Q: It beeped when I switched to another session.**
A: That was a bug in early versions, fixed since — old turns in the newly opened session were mistaken for fresh completions. Update the plugin (`dsh plugin --profile web update @yangzhe1991/dsh-task-notify`) and refresh the page; only turns that finish while you're in the session will alert now.

**Q: Which tasks exactly trigger the chime?**
A: (1) The agent completing a turn in your current session — every round of work, whether it answered, errored, or was aborted; (2) any background job settling in any session.

**Q: Can I change the sound or turn things off?**
A: See Customization below.

**Q: What does the plugin actually install?**
A: A profile bundle: a config layer (`cordis.patch.yml`) plus a browser-half bundle (`lib/client.js`) that the DSH web app discovers automatically — no manual configuration, no UI added.

### Customization

Tunables live at the top of `src/client/index.tsx`; edit and re-run `npm run build` (or send a PR 🙂).

| Constant | Default | Meaning |
|---|---|---|
| `SOUND_ENABLED` | `true` | Play the chime on completion |
| `TITLE_ENABLED` | `true` | Change the tab title while hidden |
| `ALERT_PREFIX` | `'🔔'` | Prefix of the alert title |

### Development

```sh
git clone git@github.com:yangzhe1991/dsh-task-notify.git
cd dsh-task-notify
npm install
npm run build        # produces lib/index.js (node half) + lib/client.js (browser half)
npx tsc --noEmit     # type-check
```

```
├── package.json          # dsh.bundle (profile config layer) + dsh.client (browser half) declarations
├── cordis.patch.yml      # plugin-row config layer
├── build.mjs             # esbuild build: node half + browser half
├── src/
│   ├── index.ts          # node half (empty apply placeholder)
│   └── client/index.tsx  # browser half: turn/job listeners, chime, title alert
└── lib/                  # build output (gitignored)
```

### Uninstall

```sh
dsh plugin --profile web remove @yangzhe1991/dsh-task-notify
```

### License

MIT

---

## 中文

### 安装(30 秒)

前置:`dsh` 命令行([DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness))。

```sh
dsh plugin --profile web add @yangzhe1991/dsh-task-notify
```

然后重启 Web GUI、刷新浏览器标签,完事。包内自带预构建产物,本机不需要编译、不需要任何白名单;`dsh plugin` 会自动把 bundle 追加到 profile 的 `dsh.profile.bundles`。

> **其他安装方式**(通常用不上):

> | 方式 | 命令 | 安装时是否构建 | 说明 |
> |---|---|---|---|
> | npm registry(**推荐**) | `dsh plugin --profile web add @yangzhe1991/dsh-task-notify` | 否 | 预构建,最快 |
> | tarball | `dsh plugin --profile web add ./dsh-task-notify-0.1.0.tgz` | 否 | 适合离线分发 |
> | git | `dsh plugin --profile web add github:yangzhe1991/dsh-task-notify` | 是(`prepare` 脚本) | 首次需在 `pnpm-workspace.yaml` 加一次 `allowBuilds` |

### 功能

- 🎵 **完成提示音** —— 以下两类"任务完成"都会播放合成的双音提示(无需音频文件):
  - **当前会话的 agent 回合完成** —— agent 跑完一轮(正常回复、报错、中止都会发出回合结束事件),普通对话场景就是靠它;
  - **任意会话的后台任务结束** —— 后台 bash/pwsh、子代理、workflow 等任务进入 `completed` / `failed` / `killed`。
  - 成功是上行双音 *do → mi*;失败/被杀是下行双音 *mi → do*。
- 🔔 **标签标题提醒** —— 页面不在当前标签(`document.hidden`)时,任务完成会把标题改成 `🔔 N 个任务完成 — 原标题`;切回该标签自动恢复。
- ✅ **防误报** —— 切换会话、加载历史、刷新页面都不会把旧回合当成"新完成"提醒;只有你在当前会话里看着它跑完的工作才会触发。

### 首次使用:先在页面上点一下

浏览器 autoplay 策略要求用户先与页面交互才能发声。**在页面任意位置点击或按键一次**,提示音从此解锁。标签标题提醒不受影响。

### 常见问题

**Q: 任务跑完了但没声音。**
A: 多半是还没跟页面交互过(见上);或者你跑的是普通前台工具调用 —— 那种不触发提醒,只有 agent 回合和后台任务会触发。

**Q: 切到别的会话时它响了一声。**
A: 这是早期版本的 bug(新会话的历史回合被误判成"刚完成"),已修复。更新插件(`dsh plugin --profile web update @yangzhe1991/dsh-task-notify`)并刷新页面即可;现在只有你在当前会话里看着跑完的回合才会提醒。

**Q: 到底哪些任务会触发?**
A: (1) 当前会话里 agent 完成一轮 —— 无论正常回复、报错还是中止;(2) 任意会话的后台任务结束。

**Q: 能改声音或关掉某类提醒吗?**
A: 见下方"自定义"。

**Q: 这个插件装了什么?**
A: 一个 profile bundle:配置层(`cordis.patch.yml`)+ 浏览器端 bundle(`lib/client.js`),DSH Web 应用启动时自动发现 —— 不需要手动配置,也不添加任何 UI。

### 自定义

可调参数在 `src/client/index.tsx` 顶部,改完重新 `npm run build`(也欢迎提 PR 🙂)。

| 常量 | 默认值 | 含义 |
|---|---|---|
| `SOUND_ENABLED` | `true` | 完成时是否播放提示音 |
| `TITLE_ENABLED` | `true` | 页面隐藏时是否改标签标题 |
| `ALERT_PREFIX` | `'🔔'` | 提醒标题的前缀文案 |

### 开发

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
│   └── client/index.tsx  # 浏览器半:回合/任务监听、提示音、标题提醒
└── lib/                  # 构建产物(gitignore)
```

### 卸载

```sh
dsh plugin --profile web remove @yangzhe1991/dsh-task-notify
```

### 许可证

MIT
