# LIMSA ID Card Portal

**Built by GoldWay · Emmett Stone Gbatu**

A full-stack web portal for the Liberia Medical Students Association (LIMSA) to manage student ID card verification for A.M. Dogliotti College of Medicine.

---

## Project Structure

```
limsa-id-portal/
├── frontend/          React app (hosted on Vercel)
└── backend/           Node.js + Express API (hosted on Render)
```

For the UI redesign decisions, design tokens, verification history, and follow-up work, see [`docs/UI-REDESIGN.md`](docs/UI-REDESIGN.md).

---

## Local Setup (First Time)

### 1. Clone or open the project in VS Code

Open the `limsa-id-portal` folder in VS Code.

---

### 2. Set up the Backend

Open a terminal in VS Code and run:

```bash
cd backend
npm install
cp .env.example .env
```

Now open `backend/.env` and fill in your values:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
PORT=4000
```

> Find your **Service Role Key** in Supabase → Project Settings → API → service_role (NOT the anon key — the service key bypasses RLS and is only used on your secure backend)

Start the backend:

```bash
npm run dev
```

You should see: `LIMSA ID Portal backend running on port 4000`

---

### 3. Set up the Frontend

Open a **second terminal** in VS Code and run:

```bash
cd frontend
npm install
cp .env.example .env
```

Now open `frontend/.env` and fill in your values:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

> This uses the **anon key** (safe for the browser, not the service key)

Start the frontend:

```bash
npm run dev
```

Open your browser at: **http://localhost:5173**

---

## Pages

| URL | Description |
|-----|-------------|
| `/` | Student landing page — enter ID + name |
| `/preview/:studentId` | Student card preview + confirm/report |
| `/admin` | Admin dashboard — login required |

---

## Admin Login

Use the email and password you created in Supabase → Authentication → Users.

---

## CSV Upload Format

When uploading students in bulk, your CSV must have these exact column headers:

```csv
student_id,full_name,year_level
AMD-2024-0001,Josephine K. Freeman,3rd Year
AMD-2024-0002,Marcus B. Kollie,2nd Year
AMD-2024-0003,Amara Sirleaf,4th Year
```

Uploading a CSV with a student_id that already exists will **update** that record, not duplicate it.

---

## Deploying to Production

### Frontend → Vercel

1. Push the `frontend` folder to a GitHub repository
2. Go to vercel.com → New Project → Import your repo
3. Set the **Root Directory** to `frontend`
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click Deploy

Your site will be live at `your-project.vercel.app`

---

### Backend → Render

1. Push the `backend` folder to a GitHub repository (can be same repo or separate)
2. Go to render.com → New → Web Service → Connect your repo
3. Set the **Root Directory** to `backend`
4. Set **Build Command** to: `npm install`
5. Set **Start Command** to: `npm start`
6. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `PORT` → `4000`
7. Click Deploy

Once deployed, copy your Render backend URL (e.g. `https://limsa-backend.onrender.com`)

---

### Connect Frontend to Production Backend

After deploying both, open `frontend/vite.config.js` and update the proxy to point to your Render URL:

```js
server: {
  proxy: {
    '/api': 'https://limsa-backend.onrender.com'
  }
}
```

Then redeploy the frontend on Vercel.

---

## Supabase Storage Buckets

Make sure you have two public buckets created in Supabase → Storage:

| Bucket | Purpose |
|--------|---------|
| `id-cards` | Student card images (for future use) |
| `templates` | Admin-uploaded card design templates |

Both must be set to **Public**.

---

## Tech Stack

| Layer | Technology | Hosting |
|-------|------------|---------|
| Frontend | React + Vite | Vercel (free) |
| Backend | Node.js + Express | Render (free) |
| Database | Supabase Postgres | Supabase (free) |
| Storage | Supabase Storage | Supabase (free) |
| Auth | Supabase Auth | Supabase (free) |

---

## GoldWay · goldway.estone@outlook.com · +231770405785
