# dev-flow.json

One file per workspace, at `<workspace>/dev-flow.json`, written by /dev-setup and read by every command. The
workspace is the folder holding the main clones, `scripts/dev-flow.mjs`, `.worktrees/` and this file;
`~/.nawy-dev-flow` holds its path so commands find it from any session.

```json
{
  "product": "CRM",
  "you": "Jane Doe",
  "github": { "account": "jane-company" },
  "branches": {
    "base": "main",
    "pr": "staging",
    "uat": "staging",
    "protected": ["main", "staging", "prod"],
    "pattern": "{KEY}-{n}-{Title-Words}"
  },
  "repos": [
    {
      "name": "frontend",
      "github": "Company/crm-frontend",
      "clone": "crm-frontend",
      "install": "yarn install",
      "start": "yarn dev --port {port} --strictPort",
      "port": 9000,
      "preview": true,
      "env": { "VITE_API_URL": "http://localhost:{port:backend}", "VITE_REDIRECT_URI": "http://localhost:{port}/authorize" },
      "checks": ["yarn lint", "yarn build"],
      "deployWorkflow": "deploy-staging.yml"
    },
    {
      "name": "backend",
      "github": "Company/crm-backend",
      "clone": "crm-backend",
      "install": "yarn install",
      "start": "yarn start:dev",
      "port": 3000,
      "health": "/health",
      "env": { "PORT": "{port}" },
      "checks": ["npx tsc --noEmit", "yarn lint", "yarn test"],
      "deployWorkflow": "build-staging.yml"
    }
  ],
  "tunnels": [
    { "name": "staging MySQL", "port": 3308, "via": "ec2-user@bastion.example.com", "to": "db.internal.example.com:3306" }
  ],
  "db": {
    "repo": "backend",
    "driver": "mysql2",
    "env": { "host": "DB_HOST", "port": "DB_PORT", "user": "DB_USERNAME", "password": "DB_PASSWORD", "database": "DB_NAME" }
  },
  "jira": {
    "site": "https://company.atlassian.net",
    "cloudId": "…",
    "project": "CRM",
    "me": "<your Jira account id>",
    "codeReviewerField": "customfield_…",
    "statuses": {
      "start": "To Do",
      "review": "Code Review",
      "uat": ["Product UAT", "Ready for Re-test"],
      "passed": "Ready for Deployment",
      "returned": "Returned for Fix"
    }
  },
  "review": {
    "github": ["lead-login"],
    "removeAutoReviewers": true,
    "jira": "<the reviewer's Jira account id>",
    "slack": { "userId": "U…", "name": "Lead Name" }
  },
  "staging": {
    "app": "https://app.staging.example.com",
    "health": "https://api.staging.example.com/health",
    "access": "How to get access when it answers 403, e.g. the IP whitelist tool and who to ask"
  },
  "rules": [
    "Database schema changes: stop and ask me, then the tech lead, before writing one."
  ]
}
```

| Key | Read by | Meaning |
|---|---|---|
| `github.account` | all | the `gh` login that sees the company's repos; every GitHub command runs with `GH_TOKEN=$(gh auth token --user <account>)` in the same shell |
| `branches.base` | script | new branches start from the latest `origin/<base>` |
| `branches.pr` | dev-end | PRs go into this branch |
| `branches.uat` | script, uat | what the staging deploy runs; UAT copies are made from it |
| `branches.protected` | dev-end | never pushed to, never merged into |
| `branches.pattern` | dev-start | `{KEY}` the Jira project key, `{n}` the story number, `{Title-Words}` the title, hyphenated |
| `repos[].name` | all | short name; copies are `.worktrees/<folder>-<name>` |
| `repos[].clone` | script | the main clone's folder in the workspace; never switch its branch (other sessions use it) |
| `repos[].install` | script | run once in each new copy |
| `repos[].start` | script, dev-start | starts the app; `{port}` is filled in |
| `repos[].port` | script | base port; copies get base+1, base+2, … |
| `repos[].preview` | script | gets a start button in `.claude/launch.json` (the app's browser pane) |
| `repos[].envFile` | script | default `.env`; copied from the main clone into each copy |
| `repos[].env` | script | keys rewritten in a copy's env file; `{port}` this repo's port, `{port:<name>}` another's |
| `repos[].checks` | dev-end | must pass before pushing |
| `repos[].health` | dev-start | a path that answers 200 when the app is up |
| `repos[].deployWorkflow` | uat-start | the GitHub Actions workflow that deploys `branches.uat`; optional |
| `tunnels` | script | SSH tunnels the local apps need: local `port`, through `via`, to `to` |
| `db` | script `sql` | optional; read data for UAT with the main clone's driver (`mysql2` or `pg`) and env keys |
| `jira.*` | dev-start, dev-end, uat | the site, project, you, the Code Reviewer field (null if the project has none), the statuses each step moves to |
| `review.*` | dev-end | who reviews: GitHub logins, whether to remove CODEOWNERS auto-added reviewers, their Jira id, their Slack DM |
| `staging.*` | uat | the deployed app, a health URL, and what to do when access is blocked |
| `rules` | all | the user's own rules, in plain sentences; every command follows them |
