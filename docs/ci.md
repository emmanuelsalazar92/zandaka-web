# CI/CD Quality Gates

This project enforces quality gates locally (Git hooks) and in CI (GitHub Actions). A pull request should not be merged unless all checks pass.

## What each gate does and how to fix it

- Prettier (format): keeps formatting consistent.
  - Fix: run `npm run format` or fix the files flagged by `npm run format:check`.
- ESLint (lint): catches common bugs, unused code, bad hooks usage, and import issues.
  - Fix: run `npm run lint` and address rule messages (unused imports/vars, hooks, etc).
- Typecheck: prevents type errors from reaching runtime.
  - Fix: run `npm run typecheck` and resolve TypeScript errors.
- Tests: ensures basic behavior doesn’t regress.
  - Fix: run `npm run test` locally and update the failing test or component.
- Build: confirms the app still compiles in production mode.
  - Fix: run `npm run build` to see compile errors and fix them.

## Branch protection setup (GitHub)

1. Go to `Settings` → `Branches` → `Branch protection rules`.
2. Add a rule for `main`.
3. Enable:
   - Require status checks to pass before merging.
   - Require branches to be up to date before merging.
   - Restrict who can push to matching branches.
4. Add the required status checks:
   - `CI / quality`

## Local hooks (Husky)

- Pre-commit: runs Prettier + ESLint on staged files only.
- Pre-push: runs `typecheck` and `test:ci`.
