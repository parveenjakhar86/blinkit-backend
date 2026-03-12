# Blinkit Backend Deployment (GitHub + Render)

This backend can be deployed to Render directly from GitHub.

## 1. Push backend to GitHub
1. Go to GitHub and create a new repository (for example: `blinkit-backend`).
2. Upload the backend code from this folder.
3. Make sure these files are present in the repo root:
   - `server.js`
   - `package.json`
   - `routes/`, `db/`, `models/`, `scripts/`
   - `render.yaml` (optional but recommended)
4. Do not upload secrets from `.env`.

## 2. Create service on Render
1. Go to Render dashboard.
2. Click **New** -> **Blueprint** (if using `render.yaml`) OR **Web Service**.
3. Connect your GitHub repository.
4. If creating Web Service manually, use:
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`

## 3. Set required environment variables in Render
Set these in Render -> Service -> Environment:

- `MONGO_URI`
- `MONGO_DB_NAME=blinkit`
- `PORT=5000`
- `ADMIN_USERNAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_QR_RESET_PASSWORD`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`

## 4. Verify deployment
After deploy completes, open:

- `https://YOUR-RENDER-URL/api/products`

You should get JSON product data.

## 5. Use Render URL in mobile APK
In mobile app `.env` (or EAS build env), set:

- `EXPO_PUBLIC_API_BASE_URL=https://YOUR-RENDER-URL`

Then rebuild APK:

- `npx eas build -p android --profile preview`

## Notes
- Current server binds to `0.0.0.0` and supports `process.env.PORT`, which is required for Render.
- Keep `.env` local. Store production secrets only in Render environment settings.
