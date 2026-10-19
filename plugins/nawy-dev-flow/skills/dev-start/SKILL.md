---
name: dev-start
description: Starts or resumes a piece of product work in the real code, run as /dev-start with a folder name and a branch (a Jira key like CRM-412, a full branch, or just title words). Files the Jira story the first time (assigned to you, reviewer set, draft description), names the branch after it, gives the work its own copy of every repo on free ports from the latest base branch, opens the tunnels and starts the apps, and proves data flows before saying ready. Use when the user starts, resumes or switches to a feature, fix or story, or asks for a session, branch, worktree or copy to work in.
argument-hint: <folder> <branch>
---

# /dev-start <folder> <branch>

Settings: `dev-flow.json` in the workspace named in `~/.nawy-dev-flow` (format: `../dev-setup/references/config.md`).
None → run /dev-setup first. Run every command from the workspace. Follow `rules` in `dev-flow.json` throughout.

`<folder>` is a short kebab-case label for the copies (`filters` → `.worktrees/filters-frontend`, `-backend`).
`<branch>` is a story key (`CRM-412`), a full branch (`CRM-412-New-Filters`), or title words (`New-Filters`).
Missing either → ask once, suggesting a folder from the branch words.

## 1. The story and the branch

Branch pattern: `branches.pattern`, by default `{KEY}-{n}-{Title-Words}`.
1. A key or a branch starting with one → read the story (`getJiraIssue`). Fill whatever `../dev-setup/references/story.md`
   sets at creation and is missing; still in a status before `jira.statuses.start` → move it there. The branch is the
   key plus the story's title, hyphenated, unless a branch for that key already exists on GitHub
   (`git -C <clone> branch -a --list '*<KEY>-<n>-*'`): use that one.
2. Title words only → first look for work already started under them (`git -C <clone> branch -a --list '*<Title-Words>'`
   in each clone). Found → use it.
3. Nothing found → **create the story** as `../dev-setup/references/story.md` says (draft from what the user said in
   this session). The branch is `<KEY>-<n>-<Title-Words>`.
4. The user says there is no story for this (an experiment) → their plain kebab-case branch name.

## 2. The copies

In one shell: `export GH_TOKEN=$(gh auth token --user <github.account>)` then
`node scripts/dev-flow.mjs start <folder> <branch>`. It:
1. reuses `.worktrees/<folder>-<repo>` when they exist on that branch;
2. otherwise checks the branch out there: the local branch, else the one on GitHub, else a **new branch from the
   latest `origin/<base>`**, never touching the main clones' own branches;
3. installs each new copy, copies the `.env` files with the copy's own ports filled in, adds start buttons to
   `.claude/launch.json`;
4. opens the tunnels.

If it stops (the branch is open in another folder, a name is taken, a `.env` is missing), tell the user plainly and
suggest the fix.

## 3. Start the apps, and prove the data flows, always, before reporting

The user opens the app right away; an empty page means this step was skipped. Never report "ready" until all pass:
1. **Tunnels**: each says `up` or `started`; a FAILED one → `node scripts/dev-flow.mjs tunnels` once more; still
   failing → the network, VPN or SSH key (`ssh -o BatchMode=yes <via> true` says which). Never test a tunnel by
   connecting through it.
2. **Apps without a preview button** (backends): skip if its port already listens (`lsof -iTCP:<port> -sTCP:LISTEN`).
   Otherwise start it in the background (Bash `run_in_background`) with the command the script printed, logging to
   the scratchpad. Wait with a background until-loop for the port to listen or the log to show an error, then
   `curl localhost:<port><health>` → 200. A failure: read the log, fix (connection refused on a tunnel port → step 1;
   a missing env key → the user asks the tech lead), restart.
3. **Apps with a preview button**: `preview_start` with the name `<folder>-<repo>` (it reuses a running one).
4. **Data**: in that tab open a list page and check with `read_network_requests` that its calls to
   `localhost:<backend port>` return 200. The sign-in page instead → the user signs in there once.

## 4. Report, then work there

A few lines: the story link (new or existing), the branch (new from base / resumed), the folders and addresses, and
the checks: tunnels ✓, backend ✓, frontend ✓, data ✓. Then, for the rest of the session:
- work only in `.worktrees/<folder>-<repo>`; never switch a main clone's branch (other sessions use them);
- keep the apps running; no data later (the Mac slept, the backend crashed) → redo step 3;
- commits start with the key: `<KEY>-<n>: <what changed>`;
- follow the repo's existing patterns, components and naming; keep changes local to the feature; say when shared
  code must change;
- a database schema change → stop and ask the user first;
- explain what you do in plain words: the user is a product manager.

When the work is done: `/dev-end <folder>`.
