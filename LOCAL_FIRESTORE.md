# Local development: Firestore credentials

The dashboard and check-ins use **Firestore**. If you see **"invalid_rapt" / "invalid_grant"** or "Server Firestore unavailable" in the console and the dashboard shows all zeros, your app is not authenticated to Firestore.

**Using a service account key file** avoids these errors and is the recommended way to run the app locally.

## If you see "Failed to parse private key" or "Unparsed DER bytes remain"

The key file was corrupted (e.g. copy/paste). **Use a fresh key from Google Cloud:**

1. Open [Google Cloud Console](https://console.cloud.google.com/) → project **lindavista-hms**.
2. Go to **IAM & Admin** → **Service accounts**.
3. Open your service account (e.g. `vercel-firebase-admin@lindavista-hms.iam.gserviceaccount.com`) → **Keys**.
4. **Add key** → **Create new key** → **JSON** → **Create**. A new JSON file will download.
5. Save that file in this project as `lindavista-hms-sa.json` (replace any existing file with that name).
6. Restart the dev server.

Do **not** paste the key into `.env` or edit the JSON by hand; use the downloaded file as-is.

---

## 1. Create a service account key (lindavista-hms) — only if you don’t have one yet

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select the project **lindavista-hms** (not another project).
2. Go to **IAM & Admin** → **Service accounts**.
3. Click **Create service account**.
   - Name: e.g. `local-dev` or `firestore-readwrite`.
   - Click **Create and continue**.
4. Add a role that allows Firestore access, e.g. **Cloud Datastore User** or **Firebase Admin SDK Administrator Service Agent** (or your existing Firebase role). Click **Continue** → **Done**.
5. Open the new service account → **Keys** tab → **Add key** → **Create new key** → **JSON** → **Create**.  
   The JSON key file will download.

## 2. Use the key in this project

1. Move the downloaded JSON into your project folder (e.g. `lindavista-hms-sa.json`) and **do not commit it** (it’s already in `.gitignore`).
2. In `.env.local`, set the path to that file:

   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=./lindavista-hms-sa.json
   ```

   Or use an absolute path, e.g.:

   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/Users/yourname/Desktop/LindaVista/lindavista-hms-sa.json
   ```

3. Restart the dev server (`npm run dev`).

After this, the app will use the service account key instead of gcloud ADC, and the dashboard should load real data from Firestore (and the "invalid_rapt" / "Firestore unavailable" messages should stop).

## Already have a key?

If you already have a JSON key for **lindavista-hms** with Firestore access, put it in the project, add `GOOGLE_APPLICATION_CREDENTIALS=./your-key-file.json` to `.env.local`, and restart the dev server.
