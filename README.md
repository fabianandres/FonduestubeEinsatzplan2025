# FondueStube – Static Einsatzplan

Minimal statische Webseite für den Einsatzplan der FondueStube (Weihnachtsmarkt 2025).

So lokal testen
- Öffne `public/index.html` in deinem Browser (kein Server nötig).
- Die Seite lädt `public/events.json` und zeigt die Schichten an.

Anpassungen
- Dateien: `public/index.html`, `public/styles.css`, `public/events.json`.
- UI ist mobil-first und optimiert für kleine Bildschirme.
# FondueStube Einsatzplan 2025

Tiny scheduling app for Weihnachtsmarkt 2025. This repo contains a minimal Express server that serves a public UI and a simple JSON-backed API.

Run locally
-----------
1. Install dependencies: run `npm install` in the project root.
2. Start: `npm start` (defaults to port 3000).
3. Open `http://localhost:3000` to see the public UI. Admin UI: `http://localhost:3000/admin.html`.

Persistence
-----------
Data is stored in `data/events.json`. The server reads/writes directly to this file. For production, consider a proper database.

Note on concurrent writes
-------------------------
Server write operations use `proper-lockfile` to acquire an exclusive lock on `data/events.json` during read-modify-write cycles. This reduces race conditions when multiple clients claim shifts concurrently. For multi-instance deployment (multiple app instances) prefer a shared persistent store (Blob storage, Cosmos DB, etc.).

Authentication (Admin)
----------------------
Admin login uses Microsoft Azure AD (OIDC). Set the following environment variables to enable:

- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`
- `AZURE_REDIRECT_URI` (optional; defaults to `http://localhost:3000/auth/openid/return`)

Register an app in Azure AD and set the redirect URI accordingly. After login, the admin UI is at `/admin.html`.

Notes on account types
----------------------
By default the server falls back to the `consumers` tenant which allows personal Microsoft accounts (Outlook.com, Live). If you want to support organizational accounts (work/school), set `AZURE_TENANT_ID` to the tenant id or use `AZURE_TENANT=common` to allow both personal and org accounts.

Deployment to Azure
-------------------
This app can be hosted in Azure App Service. Provide the environment variables as App Settings. Ensure `data/events.json` is persisted (use external storage or deploy a DB for reliability).
