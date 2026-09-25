# dsh-task-notify

[English](README.md) | [中文](README.zh.md)

[![npm version](https://img.shields.io/npm/v/@yangzhe1991/dsh-task-notify)](https://www.npmjs.com/package/@yangzhe1991/dsh-task-notify)
[![npm downloads](https://img.shields.io/npm/dm/@yangzhe1991/dsh-task-notify)](https://www.npmjs.com/package/@yangzhe1991/dsh-task-notify)
[![license](https://img.shields.io/github/license/yangzhe1991/dsh-task-notify)](LICENSE)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-1e90ff)](https://github.com/topics/dsh-plugin)

A DSH (DeepSeek Harness) browser plugin that tells you when your agent is really done — a chime when a session goes quiet, a chime the moment a dialog asks you to choose, and a tab-title alert while you are on another tab.

---

## Compatibility

- **dsh ≥ 0.1.7-rc.2** — supported since **0.2.0**; verified against **dsh 0.1.7-rc.2** since **0.2.0**.
  The watcher reads three current Client contracts: the session-list snapshot (`useSessions`: `ids` / `byId.origin`), the per-session UI status (`useSessionStatus`: agent `running` + `pendingInteraction`), and on-demand job rosters from the `ctx.jobs` client service (`watchRows` → `state.rows`).
- **dsh ≤ 0.1.6 / 0.1.0-rc.x** — not supported. Those versions carried job rosters inside the session-list snapshot (`jobsBySession`) and dialogs behind `useSessionPendingInteraction`, both removed in 0.1.7; this plugin injects `jobs` as a Client service, so it needs the job controller 0.1.7 introduced.

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
> | tarball | `dsh plugin --profile web add ./dsh-task-notify-0.2.0.tgz` | No | Offline-friendly |
> | git | `dsh plugin --profile web add github:yangzhe1991/dsh-task-notify` | Yes (via `prepare`) | Requires one-time `allowBuilds` in `pnpm-workspace.yaml` |

## What it does

- 🎵 **Chime when the work is really over.** A session counts as *busy* while its agent is running, **or** while any of its background jobs is `running`/`stopping`, **or** while a dialog is waiting for you. When it stops being busy and stays that way for ~2 seconds, you hear the chime once.
  - That 2-second quiet window exists because a settling background job and the agent waking up for it are two separate streams on the client: without the window, the frame that reports the job first would look like "all done".
  - Job rosters are streamed per session and only while needed: the watcher subscribes for sessions whose agent is running **and keeps the subscription** for as long as the session still counts as busy — including the gap where the agent has already yielded and is waiting for its jobs.
  - Ordinary question-and-answer turns still ring (the agent stops, nothing is pending) — that is the everyday case.
- 🎵 **Chime the moment a dialog asks you to choose** — a tool approval, a `ask_user_question` prompt, or a plan review. Same chime as above; the tab title distinguishes the two.
- 🎵 **Tone:** ascending *do → mi* normally; descending *mi → do* when a background job settled `failed` or `killed` during that busy period.
- 🔔 **Tab-title alert** — while the page is not the active tab (`document.hidden`): `🔔 N 个任务完成 — <original title>`, or `🔔 需要你选择 — <original title>` when a dialog is waiting. Switching back to the tab restores the title.
- ✅ **No false positives** — switching sessions, loading history, or refreshing the page never re-alerts for old turns or already-settled jobs. Background **subagent** child sessions are not announced on their own: their completion wakes the parent session, which is still the same piece of work.
- 🚫 **No mid-task beeps** — an agent that ends its turn to wait for a background job, and a background job that finishes and wakes the agent to keep working, are both *not* the end of the work. Neither rings any more (that was the old behaviour, and it was the main source of premature alerts).

## First-run note: click the page once

Browsers block audio until the user has interacted with the page (autoplay policy). **Click or press a key anywhere in the page once** — chimes are unlocked from then on. The tab-title alert is never affected.

## FAQ

**Q: I finished a task but heard nothing.**
A: Check, in order: (1) you have not interacted with the page yet (see above); (2) some background job in that session is still running — even a stale one you forgot about — the plugin stays quiet until the session is genuinely idle; (3) it was a plain foreground tool call, which is not an event of its own — only "the session went quiet" and "a dialog needs you" ring.

**Q: A background job finished and it stayed silent.**
A: Correct, by design. DSH delivers a job's completion as an in-session notice and, by default (`completionDelivery: wakeup`), wakes the idle agent with a follow-up turn — the agent carries on working. The chime now waits for the end of that chain instead of firing on every link.

**Q: Why does the chime sometimes come a couple of seconds late?**
A: The 2-second quiet window. It is what keeps a job-completion frame (arriving before the agent's "running" frame) from being misread as "all done".

**Q: It beeped when I switched to another session.**
A: That was a bug in early versions, fixed since 0.1.1. Update the plugin and refresh the page.

**Q: Which events exactly trigger the chime?**
A: (1) a session that was busy became idle (agent stopped, no running jobs, no dialog) and stayed idle for ~2 seconds; (2) a dialog started waiting for your choice.

**Q: Can I change the sound or turn things off?**
A: See Customization below.

**Q: What does the plugin actually install?**
A: A profile bundle: a config layer (`cordis.patch.yml`) plus a browser-half bundle (`lib/client.js`) that the DSH web app discovers automatically — no manual configuration, no UI added.

## Customization

Tunables live at the top of `src/client/index.tsx` (the decision state machine itself is `src/client/monitor.ts`); edit and re-run `npm run build` (or send a PR 🙂).

| Constant | Default | Meaning |
|---|---|---|
| `SOUND_ENABLED` | `true` | Play the chime on completion |
| `TITLE_ENABLED` | `true` | Change the tab title while hidden |
| `ALERT_PREFIX` | `'🔔'` | Prefix of the alert title |
| `QUIET_MS` | `2000` | How long a session must stay idle before the chime (ms) |

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
│   └── client/
│       ├── index.tsx     # browser half: slot wiring, chime, title alert
│       └── monitor.ts    # pure decision state machine (busy → idle + dialogs)
└── lib/                  # build output (gitignored)
```

## Uninstall

```sh
dsh plugin --profile web remove @yangzhe1991/dsh-task-notify
```

## License

MIT
