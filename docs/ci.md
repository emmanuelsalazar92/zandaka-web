# CI/CD Quality Gates

Local development, CI and Docker use Node.js 26 LTS. Select the exact version in `.node-version` before running `npm ci`. GitHub Actions themselves use their own Node 24 runtime. To change the application runtime, update `.node-version`, the Docker base image and the Node requirement in `package.json` together.

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

## ESLint compatibility (ZA-138)

Web uses ESLint 9 with the Next.js core Web Vitals and TypeScript presets, so `npm ci` reports ESLint 9's end of support. The API runs ESLint 10 independently. Before upgrading Web, check the peer ranges of the full preset dependency tree. As of November 26, 2026, even `eslint-config-next@16.4.6` depends on `eslint-plugin-import@2.32.0`, which declares support through ESLint 9. Replacing the import plugin in our local config alone leaves the preset's dependency in place.

The trial with the newer preset found 33 reports of `react-hooks/set-state-in-effect` across 23 files. Review the reports according to what each effect does:

- Values derived from props, selection, or route state belong in render when they can be calculated directly. Reset drafts at the event or component boundary when their identity changes.
- Effects that load remote data or subscribe to external state need to preserve cancellation and the order of updates. A browser subscription such as `matchMedia` can use `useSyncExternalStore`.
- Dialog, budget, and transaction state needs targeted regression coverage before changing when user edits reset. Document any justified exception at the affected call site.

Use `npm ci`, production lint, the Git hooks, and the matching CI job to validate a future preset upgrade.
