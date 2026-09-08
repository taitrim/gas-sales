# Contributing to GAS Sales Pro

Thank you for taking the time to improve the project! Below are the conventions so
everyone can work together easily. Please read all of this section before opening a
Pull Request.

**Language:** 🇻🇳 [Tiếng Việt](CONTRIBUTING.md) · 🇬🇧 English

## Source code & license

- The project is released under the **MIT License** (`LICENSE`). All contributions are
  considered to be made under that same license.
- Before contributing, **do not** commit any secrets: `.env`, `.sql` backups, API keys...
  (the full list is in `.gitignore`).

## Development environment

Requirements: Node.js ≥ 18 (20+ recommended), MySQL 8+.

```bash
# Backend
cd backend
npm install
copy .env.example .env        # edit DB_PASSWORD, JWT_SECRET, ...
npm run db:setup              # create database + tables
npm run db:seed               # create default admin (admin/admin123)
npm run dev                   # http://localhost:4000  (or: node src/server.js)

# Frontend (another shell)
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxy /api -> :4000)
```

> Change the `admin123` password after your first login.

## Checks before submitting (important)

Always run these 2 commands in `frontend` and make sure there are **no errors**:

```bash
cd frontend
npm run typecheck             # tsc --noEmit
npm run build                 # tsc --noEmit && vite build
```

The backend has no automated tests; verify the business flows you touch yourself
(sales → stock; imports → stock increase; supplier reconciliation...) by calling
`POST /api` or using the UI.

## Code conventions

- **Backend**: ES modules (`"type": "module"`), actions live in
  `backend/src/actions/*.actions.js` and are registered in `actions/index.js`.
  All SQL uses **parameterized queries** (`?` placeholders) — never string
  concatenation. Business errors use `ApiError(status, message, code)`.
- **Frontend**: React + TypeScript, following the standard order-card design language
  (`.order-card`, 2-column `form-stack`, `field-input`) — see
  `frontend/DESIGN_SYSTEM.md`. Shared components live in `frontend/src/components/`.
- **Read-only** actions should be added to `NO_LOG_ACTIONS` in `app.js` to keep the
  activity log clean.
- **New** actions must be evaluated for: `PUBLIC_ACTIONS` / `ADMIN_ACTIONS` /
  `ACTION_PERMISSION` (`permissions.js`) when screen-level permissions are needed.
- No superfluous comments; use meaningful variable/function names.

## How to contribute

1. Fork the repo → create a branch from `master`:
   ```bash
   git checkout -b feat/<short-name>
   ```
2. Commit small, self-describing changes (style: `fix: ...`, `feat: ...`, `docs: ...`).
3. Push the branch to your fork → open a **Pull Request** against `master`.
4. Describe briefly: the problem, how you fixed it, how to test. Report your
   `npm run typecheck` + `npm run build` results.

## Reporting bugs / feature requests

Open a **GitHub Issue** with: reproduction steps, error log (secrets redacted),
version (from `backend/package.json`), environment (OS, Node, MySQL).

## Security

Do not post security issues publicly — follow `SECURITY.md`.

Thank you for helping make this project better!