# dsh-task-notify

DSH (DeepSeek Harness) browser plugin — plays a completion chime and flips the tab title into an alert state when your agent finishes a task, even while the tab is in the background.

DSH(DeepSeek Harness)浏览器插件:agent 回合或后台任务跑完时播放提示音;页面不在当前标签时,把标签页标题改成提醒状态。

## Features / 功能

- **Completion chime / 提示音** — a synthesized chime (Web Audio, no audio assets) plays when either of these finishes:
  - **Agent turn completion in the current session** — the agent finishes a round (normal reply, error, or abort all emit a turn-end event), which covers ordinary conversations;
  - **Background job completion in any session** — a background task (background bash/pwsh, subagent, workflow, …) settles to `completed` / `failed` / `killed`.
  - Success plays an ascending two-tone (do → mi); failure/kill plays a descending one (mi → do).
- **Tab-title alert / 标签标题提醒** — while the page is not the active tab (`document.hidden`), a completed task changes the title to `🔔 N 个任务完成 — 原标题`; returning to the tab restores it automatically.
- **No false positives / 防误报** — switching sessions, loading session history, or refreshing the page never re-alerts for historical turns; only a turn/job that actually finishes while you are watching the current session triggers a notification.

## Install (local development) / 安装(本地开发)

```sh
# 1. Build (produces lib/index.js + lib/client.js)
npm install
npm run build

# 2. Install into a dsh profile (example: web profile; relative paths anchor to your invoking directory)
dsh plugin --profile web add /path/to/dsh-task-notify

# 3. Restart the Web GUI — the client plugin table is scanned at boot
dsh web
```

After installation, `dsh plugin` automatically appends the package to the profile's `dsh.profile.bundles`; the browser bundle is discovered through the `dsh.client` declaration — no manual configuration needed.

安装后 `dsh plugin` 会自动把本包追加到 profile 的 `dsh.profile.bundles`;浏览器端 bundle 通过 `dsh.client` 声明被发现,无需手动配置。

## Install from GitHub / 发布到 GitHub 后安装

```sh
dsh plugin --profile web add github:your-name/dsh-task-notify
```

A git install fetches **sources, not built artifacts**, so this package ships a `prepare` script that pnpm runs to build on install. pnpm refuses to run a git dependency's build script until it is explicitly allowed — on the first `add`, copy the package key pnpm prints into the profile's `pnpm-workspace.yaml`:

git 安装只拉源码,不会运行 `build`,因此本包带 `prepare` 脚本,`pnpm` 安装时会自动执行构建。首次安装时 pnpm 会要求白名单放行构建脚本,按提示把包名加入 profile 的 `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  dsh-task-notify: true
```

Then re-run the `add` above. Pin a commit (`github:your-name/dsh-task-notify#<sha>`) so a later push cannot silently change what runs at install time.

然后重新执行上面的 `add` 命令。建议固定 commit(`github:your-name/dsh-task-notify#<sha>`),避免上游推送悄悄改变安装时执行的代码。

## Uninstall / 卸载

```sh
dsh plugin --profile web remove dsh-task-notify
```

## Customization / 自定义

Tunables live at the top of `src/client/index.tsx` (`SOUND_ENABLED`, `TITLE_ENABLED`, `ALERT_PREFIX`); edit and re-run `npm run build`.

可调参数在 `src/client/index.tsx` 顶部(`SOUND_ENABLED` / `TITLE_ENABLED` / `ALERT_PREFIX`),改完重新 `npm run build`。

## Known limitations / 已知限制

Browser autoplay policy requires at least one user interaction (any click or keypress) before audio can play; until then chimes are silently skipped. The tab-title alert is not affected.

浏览器 autoplay 策略要求用户先与页面交互(任意点击/按键)后音频才可发声;解锁前提示音静默跳过,标题提醒不受影响。

## Project layout / 目录结构

```
├── package.json          # dsh.bundle (profile config layer) + dsh.client (browser half) declarations
├── cordis.patch.yml      # plugin-row config layer / 插件行配置层
├── build.mjs             # esbuild build: node half + browser half / 构建脚本
├── src/
│   ├── index.ts          # node half (empty apply placeholder) / 宿主侧占位
│   └── client/index.tsx  # browser half: turn/job listeners, chime, title alert / 浏览器半
└── lib/                  # build output (gitignored) / 构建产物(gitignore)
```

## License / 许可证

MIT
