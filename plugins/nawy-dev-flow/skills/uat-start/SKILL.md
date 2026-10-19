---
name: uat-start
description: Runs UAT of product stories on the deployed staging app, run as /uat-start with optional story keys. Tests each story against its requirements in the browser, the API calls and the data, from read-only copies of the staging code, reports the findings, and files the bugs the user approves as Jira sub-tasks with the screenshot inline. Never changes code. Use when the user wants a story tested or re-tested, the stories waiting for product testing checked, or bugs found in something already on staging.
argument-hint: [KEY-n …]
---

# /uat-start [KEY-n …]

Settings: `dev-flow.json` in the workspace named in `~/.nawy-dev-flow`. Run every command from the workspace.

**UAT never changes code**: not one character in a main clone or any copy; no branch, commit, push or PR. A bug goes
in the report and in Jira, never into a fix. The UAT copies are read-only (no branch, and the workspace's
`.claude/settings.json` blocks edits inside them). Staging *data* is fair game: create, change and delete through the
app freely.

## 1. Access

1. `curl -s -o /dev/null -w '%{http_code}' <staging.health>`: 403 → tell the user what `staging.access` says and wait
   until it is no longer 403.
2. Open `staging.app` in the browser pane. The sign-in page → the user signs in there once (never you).

## 2. Which stories

Keys given → those. None → `searchJiraIssuesUsingJql`:
`project = <jira.project> AND status in (<jira.statuses.uat>) ORDER BY updated DESC` → list key, title, status,
assignee; the user picks. A story that comes back from fixes (a re-test) → its open `[Bug]` sub-tasks first.

## 3. The staging code copies

`export GH_TOKEN=$(gh auth token --user <github.account>)` then `node scripts/dev-flow.mjs uat-start <name>`, name =
the first story's number. Read code only there; the main clones are on other sessions' branches.

## 4. Is the story on staging?

Per repo, in that GH_TOKEN shell:
1. its PRs merged into `branches.uat`: `gh pr list --repo <github> --search "<KEY>-<n>" --base <uat> --state merged
   --json number,title,mergeCommit`;
2. with a `deployWorkflow`: the last successful deploy, `gh run list --repo <github> --workflow <deployWorkflow>
   --branch <uat> --status success --limit 1 --json headSha`, and deployed ⇔
   `git -C .worktrees/uat-<name>-<repo> merge-base --is-ancestor <mergeCommit> <headSha>`.

Not merged or not deployed → tell the user and skip that story.

## 5. Understand it

- The story: Objective, Requirements, References, Testing, links, designs, comments (the latest ones matter most).
- What was built: the PRs' diffs (`gh pr diff <n> --repo <github>`) and the code around them in the UAT copies:
  which screen, API call and table each requirement became.
- A re-test: each open `[Bug]` sub-task, with its steps.

## 6. Test plan → the user, before testing

A numbered checklist: every requirement and acceptance criterion as a check (action → expected result, and the API
or data to verify), then the edge cases it implies: empty and long values, other languages/RTL, permissions,
filters and pagination resetting, cancel/discard, errors, duplicates, many rows. Re-test: the open bugs first. Show
it; the user adds or cuts; then run it.

## 7. Test

Per check, in the browser pane on staging:
- do it on screen and read the result (`read_page`, `get_page_text`);
- the calls behind it: `read_network_requests`, status, payload, response;
- the data when it matters, before and after: `node scripts/dev-flow.mjs sql "SELECT …"` (when `db` is set). Data the
  screens can't make → show the user the INSERT/UPDATE first; everything else goes through the app;
- what you create is named `UAT-TEST <what>` and stays on staging, so developers can reproduce with it;
- a failure → a screenshot of it, and, when you can see it, the cause in the staging code (`file:line`).

## 8. Report in chat

Findings only, numbered, short:
```
1. [High] <Area>: <what's wrong>
   Req 2.3 · Steps: <a> → <b> → <c> · Expected: <…> · Actual: <…> · Cause: <file:line>
```
then one line `Passed: 1, 2, 4–9`. The user says which are real bugs and their priorities. File nothing before that.

## 9. File the approved ones

Per approved finding, a Sub-task under the story: summary `[Bug] <Area>: <what's wrong>`, assignee = the story's
assignee, the agreed priority, labels `["<KEY>-<n>", "bug"]`, `contentFormat: "html"`:
```html
<p>Staging (<repo> <code>abc1234</code>, …), Chrome/macOS. Found testing <KEY>-<n>.</p>
<p><strong>Steps</strong></p><ol><li>…</li></ol>
<p><strong>Expected:</strong> …</p>
<p><strong>Actual:</strong> …</p>
```
2–4 one-line steps; Expected and Actual one sentence each; a Cause line only when sure. Attach the screenshot and
embed it after Actual when the connector allows; otherwise leave it attached.

Re-test results: fixed → move the bug to Done and comment `Re-tested on staging <sha>: fixed.`; still broken →
comment what is still wrong with a new screenshot, and reopen it if it was closed.

Reply with the bug links. Done → `/uat-end`.
