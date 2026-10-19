# The Jira story

Four sections, in this order, written plainly for the developer and the tester. Jira descriptions go in as HTML
(`contentFormat: "html"`).

1. **Objective**: one or two sentences: the problem and what this changes for the user.
2. **Requirements**: numbered, grouped by screen or area; each one testable. Then **Acceptance criteria** as a
   checklist (action → expected result).
3. **References**: designs, prototype links, related stories, the API endpoints or tables involved.
4. **Testing**: the test data to use or create, the tables or screens to check, platforms and browsers, and what
   is risky.

## At /dev-start (draft)

Objective from what the user said; Requirements as far as known, otherwise "To be completed before the PR";
References with any link given; Testing "To be completed before the PR". Fields: project `jira.project`, type
Story, assignee `jira.me`, Code Reviewer (`jira.codeReviewerField`) = `review.jira` when the project has the field,
due date a week out, the epic and release (fix version) the user names or the closest open ones (ask if unsure).
Then move it to `jira.statuses.start`.

## At /dev-end (complete)

Rewrite all four sections from what was actually built: the branch's diffs and this session. Fill any field still
empty. No PR links in the description: the story key in the branch, commits and PR titles links them (Jira's
Development panel shows them once GitHub for Jira is installed on the organization).
