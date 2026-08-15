# dsh-task-notify

A DSH (DeepSeek Harness) browser plugin that tells you when your agent finishes work — a completion chime, and a tab-title alert while you are on another tab.

DSH(DeepSeek Harness)浏览器插件:agent 干完活时提醒你 —— 播放提示音;你切到别的标签时,还会把标签页标题改成提醒状态。

---

## English

### What it does

- 🎵 **Completion chime** — plays a synthesized two-tone chime (no audio files) when:
  - an **agent turn finishes** in your current session (normal reply, error, or abort) — this covers ordinary conversations;
  - a **background job settles** in any session (`completed` / `failed` / `killed` — background bash/pwsh, subagents, workflows, …).
  - Success: ascending *do → mi*. Failure / kill: descending *mi → do*.
- 🔔 **Tab-title alert** — while the page is not the active tab (`document.hidden`), a finished task changes the title to `🔔 N 个任务完成 — <original title>`; switching back to the tab restores it.
- ✅ **No false positives** — switching sessions, loading history, or refreshing the page never re-alerts for old turns. Only work that actually finishes while you are watching the current session triggers.

### Quick start

Prereqs: Node 18+, [pnpm](https://pnpm.io/), and the `dsh` CLI.

```sh
# 1. Get the plugin (either way):
git clone git@github.com:yangzhe1991/dsh-task-notify.git
cd dsh-task-notify && npm install && npm run build   # local checkout

# 2. Install into your profile (example: web profile):
dsh plugin --profile web add /path/to/dsh-task-notify

# 3. Restart the Web GUI, then refresh the browser tab.
dsh web
```

`dsh plugin` automatically appends the package to your profile's `dsh.profile.bundles` and the browser bundle is discovered via the `dsh.client` declaration — nothing else to configure.

> **Install straight from GitHub instead?** `dsh plugin --profile web add github:yangzhe1991/dsh-task-notify`. A git install fetches sources, not built artifacts, so the package ships a `prepare` script that pnpm runs to build on install. pnpm refuses to run it until allowed — on the first `add`, copy the package key pnpm prints into the profile's `pnpm-workspace.yaml`:

> ```yaml
> allowBuilds:
>   dsh-task-notify: true
> ```

> then re-run the `add`. Pinning a commit (`github:yangzhe1991/dsh-task-notify#<sha>`) is recommended so a later push cannot silently change what runs at install time.

### First-run note: click the page once

Browsers block audio until the user has interacted with the page (autoplay policy). **Click or press a key anywhere in the page once** — chimes are unlocked from then on. The tab-title alert is never affected.

### FAQ

**Q: I finished a task but heard nothing.**
A: You likely haven't interacted with the page yet (see above), or the task was a plain foreground tool call — those don't trigger; only agent turns and background jobs do.

**Q: It beeped when I switched to another session.**
A: That was a bug in early versions, fixed since — old turns in the newly opened session were mistaken for fresh completions. Update the plugin (`npm run build` in the checkout) and refresh the page; only turns that finish while you're in the session will alert now.

**Q: Which tasks exactly trigger the chime?**
A: (1) The agent completing a turn in your current session — every round of work, whether it answered, errored, or was aborted; (2) any background job settling in any session.

**Q: Can I change the sound or turn things off?**
A: See Customization below.

### Customization

Tunables live at the top of `src/client/index.tsx`; edit and re-run `npm run build`.

| Constant | Default | Meaning |
|---|---|---|
| `SOUND_ENABLED` | `true` | Play the chime on completion |
| `TITLE_ENABLED` | `true` | Change the tab title while hidden |
| `ALERT_PREFIX` | `'🔔'` | Prefix of the alert title |

### Development

```sh
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
dsh plugin --profile web remove dsh-task-notify
```

### License

MIT

---

## 中文

### 功能

- 🎵 **完成提示音** —— 以下两类"任务完成"都会播放合成的双音提示(无需音频文件):
  - **当前会话的 agent 回合完成** —— agent 跑完一轮(正常回复、报错、中止都会发出回合结束事件),普通对话场景就是靠它;
  - **任意会话的后台任务结束** —— 后台 bash/pwsh、子代理、workflow 等任务进入 `completed` / `failed` / `killed`。
  - 成功是上行双音 *do → mi*;失败/被杀是下行双音 *mi → do*。
- 🔔 **标签标题提醒** —— 页面不在当前标签(`document.hidden`)时,任务完成会把标题改成 `🔔 N 个任务完成 — 原标题`;切回该标签自动恢复。
- ✅ **防误报** —— 切换会话、加载历史、刷新页面都不会把旧回合当成"新完成"提醒;只有你在当前会话里看着它跑完的工作才会触发。

### 快速开始

前置:Node 18+、[pnpm](https://pnpm.io/)、`dsh` 命令行。

```sh
# 1. 获取插件(二选一):
git clone git@github.com:yangzhe1991/dsh-task-notify.git
cd dsh-task-notify && npm install && npm run build   # 本地目录

# 2. 装进你的 profile(示例:web profile):
dsh plugin --profile web add /path/to/dsh-task-notify

# 3. 重启 Web GUI,然后刷新浏览器标签。
dsh web
```

`dsh plugin` 会自动把本包追加到 profile 的 `dsh.profile.bundles`,浏览器端 bundle 通过 `dsh.client` 声明被发现 —— 不需要其他配置。

> **想直接从 GitHub 安装?** `dsh plugin --profile web add github:yangzhe1991/dsh-task-notify`。git 安装只拉源码、不拉构建产物,所以本包带 `prepare` 脚本让 pnpm 在安装时自动构建。pnpm 默认拒绝执行 git 依赖的构建脚本 —— 首次 `add` 时,把 pnpm 打印的包名加进 profile 的 `pnpm-workspace.yaml`:

> ```yaml
> allowBuilds:
>   dsh-task-notify: true
> ```

> 然后重新执行 `add`。建议固定 commit(`github:yangzhe1991/dsh-task-notify#<sha>`),避免上游推送悄悄改变安装时执行的代码。

### 首次使用:先在页面上点一下

浏览器 autoplay 策略要求用户先与页面交互才能发声。**在页面任意位置点击或按键一次**,提示音从此解锁。标签标题提醒不受影响。

### 常见问题

**Q: 任务跑完了但没声音。**
A: 多半是还没跟页面交互过(见上);或者你跑的是普通前台工具调用 —— 那种不触发提醒,只有 agent 回合和后台任务会触发。

**Q: 切到别的会话时它响了一声。**
A: 这是早期版本的 bug(新会话的历史回合被误判成"刚完成"),已修复。在插件目录重新 `npm run build` 并刷新页面即可;现在只有你在当前会话里看着跑完的回合才会提醒。

**Q: 到底哪些任务会触发?**
A: (1) 当前会话里 agent 完成一轮 —— 无论正常回复、报错还是中止;(2) 任意会话的后台任务结束。

**Q: 能改声音或关掉某类提醒吗?**
A: 见下方"自定义"。

### 自定义

可调参数在 `src/client/index.tsx` 顶部,改完重新 `npm run build`。

| 常量 | 默认值 | 含义 |
|---|---|---|
| `SOUND_ENABLED` | `true` | 完成时是否播放提示音 |
| `TITLE_ENABLED` | `true` | 页面隐藏时是否改标签标题 |
| `ALERT_PREFIX` | `'🔔'` | 提醒标题的前缀文案 |

### 开发

```sh
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
dsh plugin --profile web remove dsh-task-notify
```

### 许可证

MIT
