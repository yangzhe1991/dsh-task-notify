# dsh-task-notify

[English](README.md) | [中文](README.zh.md)

[![npm version](https://img.shields.io/npm/v/@yangzhe1991/dsh-task-notify)](https://www.npmjs.com/package/@yangzhe1991/dsh-task-notify)
[![npm downloads](https://img.shields.io/npm/dm/@yangzhe1991/dsh-task-notify)](https://www.npmjs.com/package/@yangzhe1991/dsh-task-notify)
[![license](https://img.shields.io/github/license/yangzhe1991/dsh-task-notify)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-1e90ff)](https://github.com/topics/dsh-plugin)

A DSH (DeepSeek Harness) browser plugin that tells you when your agent finishes work — a completion chime, and a tab-title alert while you are on another tab.

---

## Install (30 seconds)

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

## What it does

- 🎵 **Completion chime** — a synthesized two-tone chime (no audio files) when:
  - an **agent turn finishes** in your current session (normal reply, error, or abort) — this covers ordinary conversations;
  - a **background job settles** in any session (`completed` / `failed` / `killed` — background bash/pwsh, subagents, workflows, …).
  - Success: ascending *do → mi*. Failure / kill: descending *mi → do*.
- 🔔 **Tab-title alert** — while the page is not the active tab (`document.hidden`), a finished task changes the title to `🔔 N 个任务完成 — <original title>`; switching back to the tab restores it.
- ✅ **No false positives** — switching sessions, loading history, or refreshing the page never re-alerts for old turns. Only work that actually finishes while you are watching the current session triggers.

## First-run note: click the page once

Browsers block audio until the user has interacted with the page (autoplay policy). **Click or press a key anywhere in the page once** — chimes are unlocked from then on. The tab-title alert is never affected.

## FAQ

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

## Customization

Tunables live at the top of `src/client/index.tsx`; edit and re-run `npm run build` (or send a PR 🙂).

| Constant | Default | Meaning |
|---|---|---|
| `SOUND_ENABLED` | `true` | Play the chime on completion |
| `TITLE_ENABLED` | `true` | Change the tab title while hidden |
| `ALERT_PREFIX` | `'🔔'` | Prefix of the alert title |

## Development

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

## Uninstall

```sh
dsh plugin --profile web remove @yangzhe1991/dsh-task-notify
```

## License

MIT
