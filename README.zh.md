# dsh-task-notify

[English](README.md) | [中文](README.zh.md)

[![npm version](https://img.shields.io/npm/v/@yangzhe1991/dsh-task-notify)](https://www.npmjs.com/package/@yangzhe1991/dsh-task-notify)
[![npm downloads](https://img.shields.io/npm/dm/@yangzhe1991/dsh-task-notify)](https://www.npmjs.com/package/@yangzhe1991/dsh-task-notify)
[![license](https://img.shields.io/github/license/yangzhe1991/dsh-task-notify)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-1e90ff)](https://github.com/topics/dsh-plugin)

DSH(DeepSeek Harness)浏览器插件:agent 干完活时提醒你 —— 播放提示音;你切到别的标签时,还会把标签页标题改成提醒状态。

---

## 兼容性

- **dsh ≥ 0.1.2-alpha.4** — 自 **0.1.1** 起支持。回合时间戳现从聊天快照的 legacy 层经会话标准的 `useChat` hook 获取,回合失败从 `turn-error` 节点检测;旧版 dsh 保留 legacy 路径。自 **0.1.2** 起在 **dsh 0.1.3-alpha.2** 上验证通过。
- **dsh 0.1.0-rc.x** — 仍通过旧版快照路径支持。

## 安装(30 秒)

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

## 功能

- 🎵 **完成提示音** —— 以下两类"任务完成"都会播放合成的双音提示(无需音频文件):
  - **当前会话的 agent 回合完成** —— agent 跑完一轮(正常回复、报错、中止都会发出回合结束事件),普通对话场景就是靠它;
  - **任意会话的后台任务结束** —— 后台 bash/pwsh、子代理、workflow 等任务进入 `completed` / `failed` / `killed`。
  - 成功是上行双音 *do → mi*;失败/被杀是下行双音 *mi → do*。
- 🔔 **标签标题提醒** —— 页面不在当前标签(`document.hidden`)时,任务完成会把标题改成 `🔔 N 个任务完成 — 原标题`;切回该标签自动恢复。
- ✅ **防误报** —— 切换会话、加载历史、刷新页面都不会把旧回合当成"新完成"提醒;只有你在当前会话里看着它跑完的工作才会触发。

## 首次使用:先在页面上点一下

浏览器 autoplay 策略要求用户先与页面交互才能发声。**在页面任意位置点击或按键一次**,提示音从此解锁。标签标题提醒不受影响。

## 常见问题

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

## 自定义

可调参数在 `src/client/index.tsx` 顶部,改完重新 `npm run build`(也欢迎提 PR 🙂)。

| 常量 | 默认值 | 含义 |
|---|---|---|
| `SOUND_ENABLED` | `true` | 完成时是否播放提示音 |
| `TITLE_ENABLED` | `true` | 页面隐藏时是否改标签标题 |
| `ALERT_PREFIX` | `'🔔'` | 提醒标题的前缀文案 |

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
│   └── client/index.tsx  # 浏览器半:回合/任务监听、提示音、标题提醒
└── lib/                  # 构建产物(gitignore)
```

## 卸载

```sh
dsh plugin --profile web remove @yangzhe1991/dsh-task-notify
```

## 许可证

MIT
