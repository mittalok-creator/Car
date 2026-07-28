# Car Expense Tracker

A lightweight, static web app to track all your car-related expenses — fuel, servicing,
insurance, challans, tolls, EMI, and more — with a dashboard, charts, and renewal reminders.
No backend or build step required; optionally syncs to a Google Sheet in your own Drive.

## Features

- Add/edit/delete expenses across categories (Fuel, Service & Maintenance, Insurance,
  Challan/Fine, Parking/Toll, EMI/Loan, Accessories, Other)
- Dashboard: this month / this year / all-time totals, category breakdown (doughnut chart),
  monthly trend (bar chart), and fuel efficiency in km/l (line chart)
- Reminders for insurance expiry, PUC expiry, and next service (by date or by odometer km)
- Search & filter the expense list, export to CSV
- Optional live sync to a Google Sheet in your own Google Drive (your data, your account)

## Running locally

No build step needed — it's plain HTML/CSS/JS. Serve the folder with any static server:

```bash
cd Car
python3 -m http.server 8080
# open http://localhost:8080
```

Or just open `index.html` directly in a browser (Google Sheets sync requires serving over
`http://` or `https://`, not `file://`, because of Google's OAuth origin checks).

## Data storage

By default, all data is stored in your browser's `localStorage` — private to your device,
no setup required.

## Syncing to Google Sheets (optional)

A starter Google Sheet named **"Car Expense Tracker"** has already been created in your
Google Drive. You can find it in your Drive, or create your own copy — either way you'll
need its Sheet ID (the long string in its URL between `/d/` and `/edit`).

To let the app talk to Google Sheets on your behalf, Google requires a free OAuth Client ID
tied to your own Google Cloud project (this is a one-time, ~5 minute setup):

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a new project
   (or reuse an existing one).
2. Enable the **Google Sheets API**: APIs & Services → Library → search "Google Sheets API" → Enable.
3. Configure the **OAuth consent screen** (APIs & Services → OAuth consent screen):
   - User type: External (or Internal if using Workspace)
   - Add your own email as a test user
4. Create credentials (APIs & Services → Credentials → Create Credentials → OAuth client ID):
   - Application type: **Web application**
   - Authorized JavaScript origins: add the URL you'll serve the app from
     (e.g. `http://localhost:8080`, or your deployed URL)
5. Copy the generated **Client ID** (looks like `xxxxxxxx.apps.googleusercontent.com`).
6. In the app, go to **Settings**, paste the Client ID and the Sheet ID, and click **Save Settings**.
7. Click **Connect Google Sheet** in the top bar and approve access.
8. Use **Push local data → Google Sheet** to back up, or **Pull data ← Google Sheet** to restore.

Sync is manual/one-shot (push or pull) rather than automatic real-time sync, to keep the
app simple and avoid conflicting writes.

## Project structure

```
index.html       Markup for all tabs (dashboard, add expense, list, reminders, settings)
css/style.css     Styling (light/dark aware, responsive)
js/store.js       localStorage persistence
js/sheets.js      Google Identity Services OAuth + Sheets API read/write
js/app.js         App logic: tabs, forms, table, charts, reminders
```

## Deploying

Since it's fully static, you can deploy it for free on GitHub Pages, Vercel, Netlify, or
similar. Remember to add the deployed URL as an authorized JavaScript origin in your Google
Cloud OAuth client if you want Sheets sync to work there too.
