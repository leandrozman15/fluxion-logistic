# Firebase App Hosting CI/CD

This repository is configured to trigger Firebase App Hosting rollouts on every push to `main` via GitHub Actions.

## Workflow file

- `.github/workflows/firebase-apphosting-deploy.yml`

## Required GitHub secret

Create this repository secret:

- `FIREBASE_SERVICE_ACCOUNT`

Value must be the full JSON credentials for a Google service account with permissions to create App Hosting rollouts in project `studio-5171832922-39b6b`.

## Service account roles (minimum)

At project level, grant:

- Firebase App Hosting Admin (or equivalent permissions to manage App Hosting rollouts)

## How it works

On each push to `main` (or manual run), the workflow runs:

```bash
firebase apphosting:rollouts:create studio \
  --project studio-5171832922-39b6b \
  --git-commit <commit_sha> \
  --force --non-interactive
```

This deploys the exact pushed commit.

## Notes

- If your backend ID is not `studio`, update `FIREBASE_APPHOSTING_BACKEND_ID` in the workflow.
- You can trigger manually from the Actions tab using `workflow_dispatch`.
