# dsh-task-notify

DSH(DeepSeek Harness)Web 插件:任务完成时播放提示音;页面不在当前标签时,把 Chrome 标签页标题改为提醒状态。

## 功能

- **提示音**:以下两类"任务完成"都会播放合成提示音(成功为上行双音,失败/被杀为下行双音;无音频资源,Web Audio 合成):
  - **当前会话的 agent 回合完成** —— agent 跑完一轮(正常回复、报错、中止都会发出回合结束事件),这是普通对话场景下的提醒;
  - **后台任务完成** —— 任意会话的后台任务(bash/pwsh 后台命令、子代理、workflow 等)从运行中变为结束(`completed` / `failed` / `killed`)。
- **标签标题提醒**:任务完成时若页面不在当前标签(`document.hidden`),标题变为 `🔔 N 个任务完成 — 原标题`;切回该标签后自动恢复原标题。
- **防误报**:切换会话、会话历史加载、页面刷新都不会把历史回合当成"新完成"触发提醒;只有你当前所在的会话里,回合/任务真正跑完才会响。

## 安装(本地开发)

```sh
# 1. 构建(生成 lib/index.js + lib/client.js)
npm install
npm run build

# 2. 安装到 dsh profile(示例:web profile;相对路径以调用目录为锚)
dsh plugin --profile web add /path/to/dsh-task-notify

# 3. 重启 Web GUI 生效(客户端插件表在启动时扫描)
dsh web
```

安装后 `dsh plugin` 会自动把本包追加到 profile 的 `dsh.profile.bundles`;浏览器端 bundle 通过 `dsh.client` 声明被发现,无需手动配置。

## 发布到 GitHub 后安装

```sh
dsh plugin --profile web add github:your-name/dsh-task-notify
```

git 安装只拉源码,不会运行 `build`,因此本包带 `prepare` 脚本,`pnpm` 安装时会自动执行构建。首次安装时 pnpm 会要求白名单放行构建脚本,按提示把包名加入 profile 的 `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  dsh-task-notify: true
```

然后重新执行上面的 `add` 命令。建议固定 commit(`github:your-name/dsh-task-notify#<sha>`),避免上游推送悄悄改变安装时执行的代码。

## 卸载

```sh
dsh plugin --profile web remove dsh-task-notify
```

## 自定义

可调参数在 `src/client/index.tsx` 顶部(`SOUND_ENABLED` / `TITLE_ENABLED` / `ALERT_PREFIX`),改完重新 `npm run build`。

已知限制:浏览器 autoplay 策略要求用户先与页面交互(任意点击/按键)后音频才可发声;解锁前任务完成只会静默跳过提示音,标题提醒不受影响。

## 目录结构

```
├── package.json          # dsh.bundle(profile 配置层)+ dsh.client(浏览器端)声明
├── cordis.patch.yml      # 插件行配置层
├── build.mjs             # esbuild 构建:node 半 + 浏览器半
├── src/
│   ├── index.ts          # node 半(空 apply,仅占位)
│   └── client/index.tsx  # 浏览器半:任务监听 + 提示音 + 标题提醒
└── lib/                  # 构建产物(gitignore)
```
