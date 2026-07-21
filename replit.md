# LIMSA ID Card Portal

A full-stack web portal for the Liberia Medical Students Association (LIMSA) to manage student ID card verification for A.M. Dogliotti College of Medicine.

## Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | React + Vite + Tailwind (CSS vars)|
| Backend   | Node.js + Express                 |
| Database  | Supabase Postgres                 |
| Storage   | Supabase Storage                  |
| Auth      | Supabase Auth                     |

## Project Structure

```
limsa-id-portal/
├── frontend/          React + Vite SPA
│   └── src/
│       ├── pages/     LandingPage, PreviewPage, AdminDashboard, QrViewPage, ...
│       ├── components/ Navbar, Footer, CardCanvas, LayoutMapper, Toast, ...
│       └── lib/       api.js (apiFetch/adminFetch), supabase.js
└── backend/           Node.js + Express API
    └── routes/        students, submissions, templates, settings, qr, admins, ...
```

## Environment Variables

### Backend (`backend/.env`)
```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
PORT=4000
QR_SIGNING_SECRET=your-hmac-signing-secret-here   # min 32 chars
FRONTEND_URL=https://your-frontend-url
BACKEND_URL=https://your-backend-url
ALLOWED_ORIGINS=                                   # comma-separated; empty = allow all (dev)
NODE_ENV=development
```

### Frontend (`frontend/.env`)
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_API_URL=                                      # empty = use Vite proxy (dev)
```

## Running Locally

```bash
# Backend
cd backend && npm install && npm run dev     # :4000

# Frontend (second terminal)
cd frontend && npm install && npm run dev    # :5173
```

Vite proxies `/api` → `localhost:4000` in dev (see `frontend/vite.config.js`).

## Pages

| Route               | Description                                      |
|---------------------|--------------------------------------------------|
| `/`                 | Student lookup — enter ID + full name            |
| `/preview/:token`   | Student ID card preview + confirm / report issue |
| `/qr/:studentId`    | Public QR scan verification page                 |
| `/admin`            | Admin dashboard (Supabase Auth required)         |
| `/submit`           | Student self-submission form                     |
| `/about`, `/terms`, `/privacy` | Static informational pages          |

## User Preferences

- Keep the existing project structure and stack — do not restructure or migrate.
- Maintain the navy + gold colour system defined in `frontend/src/index.css` CSS variables.
