# Deploy on Render (React + Go + PostgreSQL)

## 1) Push current code to GitHub
Use your main branch with the latest changes.

## 2) Create Blueprint in Render
1. Open Render Dashboard.
2. Click `New` -> `Blueprint`.
3. Select repository: `NIKOLAEV-ANDREI/LMS-Platform`.
4. Render will detect `render.yaml` in project root.
5. Click `Apply`.

This creates:
- `lms-postgres` (PostgreSQL)
- `lms-backend` (Go API)
- `lms-frontend` (static React build)

## 3) Important: set real public URLs in env
After first deploy, open service settings and update:

### Backend (`lms-backend`)
- `ALLOWED_ORIGIN` = exact frontend URL
  - example: `https://lms-frontend.onrender.com`

### Frontend (`lms-frontend`)
- `VITE_API_URL` = exact backend URL + `/api`
  - example: `https://lms-backend.onrender.com/api`

If your service names differ, use your real URLs from Render.

## 4) Redeploy both services
After env changes:
1. Redeploy backend.
2. Redeploy frontend.

## 5) Smoke test
1. Open frontend URL.
2. Register/login.
3. Check in browser devtools that API requests go to your Render backend URL, not localhost.

## Notes
- Free instances can sleep when idle. First request after idle can be slow.
- DB migrations are run automatically on backend start (`db.Migrate(...)` in server startup).
