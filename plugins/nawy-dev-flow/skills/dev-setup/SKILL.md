---
name: dev-setup
description: Onboards a product manager to building features with Claude in their product's real code, in about 30 minutes. Picks the workspace folder, checks and connects Git, Node, the GitHub command-line tool and Jira, clones the repos they choose and works out how each one installs, starts and connects, sets up the database tunnels and SSH key, the branch and PR rules, the reviewer (GitHub, Jira, Slack) and the staging app for UAT, then proves it all with a test run. Writes everything to dev-flow.json, which the user can change any time by running it again. Use right after the nawy-dev-flow plugin is installed, when someone asks to set up, onboard or configure their dev flow, workspace, repos, tunnels or worktrees, to change one of those settings, or when /dev-start, /dev-end or /uat-start find no dev-flow.json.
---

# /dev-setup

The goal: by the end, the PM says "/dev-start new-filters New-Filters" and gets their own copy of every repo
running with data, and "/dev-end new-filters" opens the PRs. They are product people, not developers: talk plainly,
do every check yourself, ask only what you can't find out, one batch of questions per step. Keep a short checklist in
the chat as you go (✓ done, → now, – skipped).

Open with what they'll get and the steps:
1. workspace, 2. tools, 3. GitHub, 4. repos, 5. branches, 6. Jira, 7. reviewer, 8. tunnels and data, 9. staging for
UAT, 10. rules, 11. test run.

**Already set up?** `~/.nawy-dev-flow` names a workspace with a `dev-flow.json` → this is a change: show the current
settings as a short table, ask what to change, change only that (the format: `references/config.md`), then rerun
`node scripts/dev-flow.mjs doctor`. Also refresh `<workspace>/scripts/dev-flow.mjs` from this skill's
`scripts/dev-flow.mjs` if they differ (a plugin update).

Never read credential values aloud or into the chat: no `cat .env`, no tokens, no passwords. Key names are fine
(`sed -n 's/=.*//p' .env`). The user pastes secrets only into files themselves, or into a file you name.

## 1. Workspace

Ask, in one message:
- the product's short name ("CRM") and their name;
- where the code should live: `~/dev/<short-lowercase>/` unless they want another folder. Everything goes inside it:
  the main clones, `.worktrees/` for the copies, `scripts/`, `dev-flow.json`.

Create the folder. Write its absolute path to `~/.nawy-dev-flow` (one line).

## 2. Tools

Check, and install what's missing with their OK (say what each is for, in one line):
- `git --version`: missing on a Mac → `xcode-select --install` (Apple's command line tools, a few minutes).
- `node --version`, 18 or newer: the apps and the script need it. Missing → `brew install node` if Homebrew is there
  (`brew --version`), otherwise the installer from nodejs.org (they click through it).
- The package manager the repos use (step 4 finds out): `yarn` via `corepack enable`, `pnpm` the same, `npm` comes
  with Node.
- `gh --version`: GitHub's command-line tool → `brew install gh`.

## 3. GitHub

1. `gh auth status`. Not signed in → they run `gh auth login` themselves (GitHub.com, HTTPS, browser) in a terminal
   (give them the command in a bash block). Several accounts (personal and work) → the one that sees the company's
   repos: try `GH_TOKEN=$(gh auth token --user <login>) gh repo list <org> --limit 5` per account.
2. `gh auth setup-git` so `git push` uses the same sign-in.
3. Save `github.account`. From now on every git or gh command that talks to GitHub runs with
   `export GH_TOKEN=$(gh auth token --user <account>)` in the same shell. Never `gh auth switch` (it changes it for
   every other session).

## 4. Repos

1. List the organization's repos (`gh repo list <org> --limit 200 --json name,description,pushedAt`), most recently
   pushed first; ask which belong to their product (usually a frontend and a backend). Name each: `frontend`,
   `backend`, `admin`… (short, kebab-case).
2. Clone each into the workspace: `git clone https://github.com/<org>/<repo>.git <workspace>/<repo>`.
3. Per repo, work it out from the code, then show it as one table to confirm:
   - **install**: the lockfile says it (`yarn.lock` → `yarn install`; a checked-in `.yarn/releases/yarn-*.cjs` →
     `node .yarn/releases/yarn-*.cjs install`; `pnpm-lock.yaml` → `pnpm install`; `package-lock.json` → `npm ci`);
   - **start**: the dev script in `package.json` (`dev`, `start:dev`, `start`), and how it takes a port (a `--port`
     flag for Vite/Next, or an env key like `PORT` / `SERVER_PORT` read in the code: grep `process.env.*PORT`);
   - **port**: the default it runs on (the dev script, the vite/next config, or the `.env` key) — the base;
   - **env**: the frontend's keys that point at the backend (`localhost:<backend port>` in the frontend's `.env` or
     `.env.example`) → `{port:backend}`; redirect/callback URLs with the frontend's own port → `{port}`; the
     backend's port key → `{port}`;
   - **checks**: the lint, type-check, build and test scripts that exist;
   - **health**: for a backend, a `/health` or similar route (grep the router), else none;
   - **preview**: true for anything with pages (frontend, admin).
4. The `.env` files: each repo needs its local one. Missing → they ask their tech lead for it and save it as
   `<workspace>/<repo>/.env` (give the exact path). Don't continue to step 11 without them.
5. Install each main clone once (`install` in the clone): later copies install their own.

## 5. Branches

Look first (`git -C <clone> branch -r`, the default branch, recent merged PRs' bases:
`gh pr list --repo <repo> --state merged --limit 30 --json baseRefName`), then propose and confirm:
- **base**: where new work starts (usually `main`);
- **pr**: where PRs go (often `staging` or `develop`; the most common base of merged PRs);
- **uat**: what the staging app is deployed from (usually the same as pr); and its deploy workflow per repo, if any
  (`gh workflow list --repo <repo>`) → `deployWorkflow`;
- **protected**: never pushed to directly (main, staging, prod, …);
- **naming**: `{KEY}-{n}-{Title-Words}`, e.g. `CRM-412-New-Filters` (check recent branch names; match the team's).

## 6. Jira (required)

1. The Atlassian connector: its user-info or accessible-resources tool. Not connected → walk them through connecting
   it (Claude's connector settings), then continue.
2. The site (cloudId, URL): more than one → ask. Their own account id → `jira.me`.
3. The project: list the projects they can see; ask which.
4. The statuses: read a recent story's transitions and the project's statuses; propose which one is each of
   `start` (work picked up), `review` (PR opened), `uat` (waiting for product testing, one or more), `passed` and
   `returned`. Show a small table, confirm.
5. A Code Reviewer field: look at a recent story's fields for one named like "Code Reviewer"; save its id or null.

## 7. Reviewer

1. Who reviews and merges their PRs: list who merged PRs in their repos in the last 60 days with counts
   (`gh pr list --state merged --json mergedBy`); they pick → `review.github`.
2. Does the repo auto-add reviewers (a `CODEOWNERS` file)? If so, ask whether to remove those so only theirs stays
   → `review.removeAutoReviewers`.
3. The reviewer's Jira account id (`lookupJiraAccountId`) → `review.jira`.
4. Slack: with the Slack connector, find the reviewer (`slack_search_users`) → `review.slack` (user id and name).
   No Slack connector → skip; /dev-end then gives them the message to paste.

## 8. Tunnels and data

Ask: does the backend, run on their Mac, need the staging (or testing) database? Usually yes: they won't know, so
check the backend's `.env` key names for a database host (`DB_HOST…`, `MONGO…`, `DATABASE_URL`) and say what you see.
1. If the host is private (an internal hostname, `localhost`/`127.0.0.1` with an unusual port like 3308): it goes
   through an SSH tunnel. They ask their tech lead or the infra team for: the bastion (`user@host`), the database
   host and port behind it, and which local port the `.env` expects. One entry per database → `tunnels`.
2. SSH key: `ls ~/.ssh/*.pub`. None → with their OK, `ssh-keygen -t ed25519 -C "<their name> laptop" -N "" -f
   ~/.ssh/id_ed25519`, then show them the public key (`cat ~/.ssh/id_ed25519.pub`, it is safe to share) to send to
   whoever grants bastion access. Test with `ssh -o BatchMode=yes -o ConnectTimeout=10 <via> true`: "Permission denied
   (publickey)" → the key isn't added yet.
3. Database logins that expire (some teams rotate them weekly): ask; note it in `rules` with what to do.
4. **Never check a tunnel by connecting through it** (`nc`, a database client that doesn't log in): many databases
   count each as a failed login and block the bastion. Only the local listener: `lsof -iTCP:<port> -sTCP:LISTEN`. The
   script does exactly that.
5. Background jobs: does the backend run scheduled jobs (`@Cron`, `node-cron`, `bull`, `agenda`) that would act on
   shared staging data when started locally? If you find any, tell them and ask the tech lead how to keep them off
   locally (an env flag, a lock); put the answer in `rules`.
6. For UAT data checks (optional): if the backend uses `mysql2` or `pg`, save `db` with the backend's `.env` key names
   (never values) so `node scripts/dev-flow.mjs sql "SELECT …"` can read staging data.

## 9. Staging for UAT

The deployed staging app's URL and its API health URL (the frontend's staging env or the README usually say).
`curl -s -o /dev/null -w '%{http_code}' <health>`: 403 → access is IP-restricted; ask how they get whitelisted and
save it in `staging.access`.

## 10. Rules

These are on by default; read them out and ask what to add or change:
- never merge a PR, never approve one, never push to a protected branch;
- never merge the PR branch (`staging`) into a feature branch; conflicts with it are listed for the reviewer, not
  resolved here;
- a database schema change (new or changed tables, columns, indexes, migrations) → stop and ask the user first,
  every time; it is flagged to the reviewer in the PR;
- never commit `.env` files or secrets;
- follow the repo's existing patterns and components; keep changes local to the feature; touch shared code only when
  the task needs it, and say so.
Add theirs as plain sentences to `rules`.

## 11. Write it all, then a test run

1. Copy this skill's `scripts/dev-flow.mjs` to `<workspace>/scripts/dev-flow.mjs`.
2. Write `<workspace>/dev-flow.json` (format: `references/config.md`). Show it.
3. Write `<workspace>/.claude/settings.json` (merge if one exists) with the hook that keeps UAT copies read-only:
   ```json
   { "hooks": { "PreToolUse": [ { "matcher": "Edit|Write|NotebookEdit", "hooks": [ { "type": "command",
     "command": "jq -r '.tool_input.file_path // .tool_input.notebook_path // \"\"' | grep -q '/\\.worktrees/uat-' && { echo 'UAT copies (.worktrees/uat-*) are read-only: UAT never changes code.' >&2; exit 2; } || exit 0" } ] } ] } }
   ```
   (`jq` ships with macOS 15+; older → `brew install jq`.)
4. Write `<workspace>/CLAUDE.md`: what the workspace is (the product, the repos table), the commands, and the rules
   from `dev-flow.json`, so every session there knows them. Short.
5. `cd <workspace> && node scripts/dev-flow.mjs doctor` → fix every ✗.
6. The test run: `node scripts/dev-flow.mjs start setup-check setup-check`, then start the apps exactly as
   /dev-start step 3 does and prove the data flows (a list page in the browser pane calling the local backend with
   200s). Fix what fails (most often: a missing `.env` key, a wrong port key, a tunnel). Then
   `node scripts/dev-flow.mjs end setup-check` and delete the test branch in each clone
   (`git -C <clone> branch -D setup-check`).

## 12. Hand over

Short:
- **the commands**:
  - `/dev-start <folder> <CRM-412 or Title-Words>`: the story, the branch, your own copy running;
  - `/dev-end <folder>`: checks, completes the story, pushes, opens the PRs, tells the reviewer;
  - `/uat-start [CRM-n …]`: tests stories on staging against their requirements, files the bugs you approve;
  - `/uat-end`: moves the tested stories on and cleans up;
  - `/dev-setup`: again any time to change a setting.
- **where things are**: the workspace path, `dev-flow.json` (all settings), `CLAUDE.md` (the rules sessions follow);
- **what they still owe**: anything waiting on the tech lead (`.env`, bastion access, Jira field).
