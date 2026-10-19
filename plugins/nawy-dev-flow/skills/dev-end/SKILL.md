---
name: dev-end
description: Finishes a piece of product work started with /dev-start, run as /dev-end with the folder name. Runs the repo checks, completes the Jira story from what was built, pushes the branches, opens one PR per repo into the PR branch with only your reviewer, links the PRs to each other and to the story, moves the story to review, messages the reviewer on Slack, then removes the copies. Never merges. Use when the user says the work is done, ship it, push it, open the PRs or send it for review.
argument-hint: <folder>
---

# /dev-end <folder>

Settings: `dev-flow.json` in the workspace named in `~/.nawy-dev-flow`. Run every command from the workspace. Follow
`rules` throughout.

Invoking it is the user's go-ahead to push, open the PRs and message the reviewer. It is never a go-ahead to merge,
approve, or push to a protected branch (`branches.protected`).

Every git or gh command that talks to GitHub runs with `export GH_TOKEN=$(gh auth token --user <github.account>)` in
the same shell (another account gets "Repository not found"; never `gh auth switch`).

## 1. What is being shipped

`.worktrees/<folder>-<repo>` for each repo: the branch, the story key from it, and per repo the commits and changes
against `origin/<base>`. A repo with nothing on the branch gets no push and no PR.

## 2. Ready to push

1. Unsaved changes → commit them: `<KEY>-<n>: <what changed>`. Never commit `.env` or other secrets.
2. Run the repo's `checks` in each copy; fix what fails before going on. Formatters and `--fix` linters: only on the
   branch's own files (`git diff --name-only origin/<base>...HEAD`), never the whole repo; formatting changes →
   commit `<KEY>-<n>: lint and format`. A check that already failed on `<base>` before this work → say so, don't fix
   unrelated code.
3. **Stop and ask the user** before going on if any of these holds:
   - a database schema change (a migration, a new or changed table, column or index) they have not confirmed;
   - a change to shared code they have not seen.
4. Conflicts with the PR branch: `git fetch origin` then `git merge-tree --write-tree --name-only origin/<pr> HEAD`.
   They are **not** resolved here, and the PR branch is never merged into this one: list the files under Notes for
   the reviewer and tell the user.

## 3. The Jira story

Complete it as `../dev-setup/references/story.md` says, from what was actually built (the diffs and this session).
Fill the Code Reviewer, due date or release if missing.

## 4. Push and open the PRs

Per repo with commits: `git push -u origin <branch>`.

An open PR for the branch already exists → the push updated it; refresh its description. Otherwise:
`gh pr create --repo <github> --base <branches.pr> --head <branch> --title "<KEY>-<n> <Story title>"
--reviewer <review.github, comma-separated> --body …`. Open the backend's first, then the others, then edit the
earlier descriptions so every PR links every other. A PR from this branch was merged before → open a new one.

Description:
```
<One or two sentences: what this PR adds.>

**Linked PR:** <org/other-repo>#<n> — <merge order if it matters, e.g. merge the backend first>

## Changes
### 1. <Area>
1. <Concise point>
   1. <Detail>

## Notes for the reviewer
1. <Merge order, conflicts with <pr> (files), schema changes (exact SQL), shared code touched, what was not tested>
```

`review.removeAutoReviewers` → `gh pr view <n> --json reviewRequests` and remove everyone GitHub added who is not in
`review.github` (`gh pr edit <n> --remove-reviewer <login>`).

Then move the story to `jira.statuses.review`: list its transitions and step through whatever leads there (some
workflows need two or three moves); tell the user which.

## 5. Tell the reviewer on Slack

Only when PRs were opened (not for a push that only updated one). `slack_send_message` to `review.slack.userId`:
```
*Pull request review:*
*<KEY>-<n> <Story title, exactly as in Jira>*
<One or two plain sentences: what this adds or fixes; the merge order when it matters.>

<Repo> PR: <link>
<Repo> PR: <link>
Story: <jira.site>/browse/<KEY>-<n>
```
Bold is Slack's single asterisks. Slack connector off → turn it on; not connected, or no `review.slack` → give the
user the message to paste.

## 6. Clean up, report

1. `node scripts/dev-flow.mjs end <folder>`: stops the copy's apps and removes the copies; it refuses while anything
   is unsaved or unpushed. The branch stays, so `/dev-start <folder> <branch>` resumes it later.
2. Tell the user: the PR links, the story link, that the reviewer was messaged, and anything waiting on them
   (conflicts, a schema change, untested parts).
