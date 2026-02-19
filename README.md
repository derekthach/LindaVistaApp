# Linda Vista Motel Management System

Next.js + SQLite motel management app with role-based access and analytics.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Firestore and dashboard (invalid_grant / reauth)

The dashboard loads data from Firestore. If you see **invalid_grant** or **reauth related error (invalid_rapt)** on `/dashboard`, Google Cloud credentials are expired or invalid.

**Option A – Refresh Application Default Credentials (quick fix)**  
If you use `gcloud` and previously ran `gcloud auth application-default login`:

```bash
gcloud auth application-default login
```

Complete the browser sign-in; then restart `npm run dev` and reload the dashboard.

**Option B – Use a service account key (more reliable locally)**  
In [Firebase Console](https://console.firebase.google.com) → Project **lindavista-hms** → Project settings → Service accounts → “Generate new private key”, then in `.env.local` add one of:

- **Single JSON env var:**  
  `FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}` (paste the whole JSON as one line, no newlines; or use a tool to minify it.)

- **Or split vars:**  
  `FIREBASE_CLIENT_EMAIL=...@....iam.gserviceaccount.com`  
  `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`  
  (Keep `GOOGLE_CLOUD_PROJECT=lindavista-hms` as well.)

Restart the dev server after changing `.env.local`. Do not commit `.env.local` or the key file.

## Deploy to Vercel (preview/production)

**Important:** In production the app **does not** use a key file (`GOOGLE_APPLICATION_CREDENTIALS` is ignored). You must set Firestore credentials via environment variables below. If Firestore auth fails in production, the app will **fail loudly** (errors in logs / 500s), not silently show empty data.

Set these **Environment Variables** in your Vercel project:

| Variable | Required | Notes |
|----------|----------|--------|
| `SESSION_SECRET` | Yes | Long random string for session signing (e.g. 32+ chars). |
| `LV_ADMIN_SECRET` | For admin actions | Secret used to authorize Export CSV and per-row delete. If unset, the check-ins page still loads, but export and delete will return 401 until this is set and you log in again as admin. |
| `GOOGLE_CLOUD_PROJECT` | For Firestore | e.g. `lindavista-hms`. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` | For Firestore | **Required in production.** Use one of these; do not rely on a key file. Needed for dashboard and check-ins data. |

After adding `LV_ADMIN_SECRET`, redeploy and log in again as admin so the `lv_admin` cookie is set; then Export and Delete will work.

## View Check-Ins date filter

The **View Check-Ins** page filters by a single calendar day. The date is sent as `date=YYYY-MM-DD` (e.g. `GET /checkins?date=2026-02-15`). **Date normalization and timezone:** The backend interprets the date in **America/Puerto_Rico**. Firestore stores `checkInAt` as a Timestamp; the query uses start-of-day and end-of-day (exclusive) for that calendar day in that zone, so records are included when their normalized `date` (YYYY-MM-DD in America/Puerto_Rico) matches the selected day. CSV export uses the same `date` param and produces `checkins_YYYY-MM-DD.csv`.

When a day filter is active, the table is split into three 8-hour sections (PR timezone): **12:00am-8:00am** (minutes 0-480), **8:01am-4:00pm** (481-960), **4:01pm-11:59pm** (961-1439). Bucketing uses the normalized `time` string (HH:mm) from the same America/Puerto_Rico normalization, not browser local time. Each section shows a subtotal row; a day total row appears at the bottom. Section headers and subtotals are display-only and are not included in CSV export.

**Admin delete:** Admins see an Actions column with a trash icon per row. Delete opens a confirmation modal; the backend enforces admin (session + LV_ADMIN_SECRET). `DELETE /api/checkins/[id]` removes the document from Firestore. The Actions column is not included in CSV export. Manual test: as admin, delete a check-in, confirm modal and success; as non-admin (or direct API call without cookie), confirm 401/403.

## Structure

- `src/app` — Next.js App Router pages and API routes
- `src/server` — auth + SQLite access
- `templates/` and `app.py` — legacy Flask reference

## Flask (legacy) – production env

For production, set these env vars so Flask login is not using default credentials:

- `FLASK_ADMIN_USER` (default: `admin`)
- `FLASK_ADMIN_PASS` (default: `password`)
- `FLASK_EMP_USER` (default: `employee`)
- `FLASK_EMP_PASS` (default: `employee123`)

Example: `export FLASK_ADMIN_PASS=Rainw00d2023! FLASK_EMP_PASS=vistalinda` (and optionally override usernames).

## Verification (password rotation)

After rotating passwords (admin: `Rainw00d2023!`, employee: `vistalinda`):

1. **Generate hashes (optional, already applied):**
   ```bash
   node scripts/generatePasswordHashes.js
   ```

2. **Validate `users.json`:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('login-system/users.json','utf8')); console.log('users.json valid')"
   ```

3. **Next.js:** `npm run dev` → open `/login`, sign in as `admin` / `Rainw00d2023!` or `employee` / `vistalinda`.

4. **login-system:** From `login-system/`, run the server and POST to `/login` with the same credentials.

5. **Flask:** Set env then run Flask:
   ```bash
   export FLASK_ADMIN_USER=admin FLASK_ADMIN_PASS=Rainw00d2023! FLASK_EMP_USER=employee FLASK_EMP_PASS=vistalinda
   python app.py
   ```
   Then open the Flask login page and use admin or employee credentials.
