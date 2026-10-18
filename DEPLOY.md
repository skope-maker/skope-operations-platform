# Putting the app online for your team

Goal: one web address your team can open to try the whole application, with no setup on their side.

The app is packaged as a single service. One address serves both the screens and the API, and
the data lives in a MongoDB Atlas database. This guide uses the free plans of
[Render](https://render.com/docs/free) (hosting) and
[MongoDB Atlas](https://mongodb.com/docs/atlas/reference/free-shared-limitations/) (database).
Plans and prices change, so check both pages before you start. Time needed: about 20 minutes.

## Before you start

- Your code is on GitHub (it is: the private repository `skope-operations-platform`).
- The latest code, including the `Dockerfile` and `render.yaml`, must be pushed: run `git push` in the project folder.
- You need a free account on MongoDB Atlas and on Render.

## Step 1: Create the database (MongoDB Atlas)

1. Sign in to Atlas, create a project, and create a **free** cluster. Pick the region closest to your team.
2. **Database Access**: add a database user. Use letters and numbers only in the password, which avoids problems in the connection string.
3. **Network Access**: add the IP address `0.0.0.0/0` ("allow access from anywhere"). Render's free service has no fixed address, so a narrower rule would block it. The database password is what protects it.
4. **Connect, then Drivers**: copy the connection string. It looks like `mongodb+srv://USER:<password>@cluster0.xxxxx.mongodb.net/`. Replace `<password>` with the real password.

**Already have a free cluster?** A free cluster pauses itself after a long period without use and shows "Your cluster has been
automatically paused due to prolonged inactivity". Click **Resume** and wait until it is running again; the data is kept.
You can reuse it, because the app only touches the database named in `DB_NAME` (default `skope_operations`) and leaves other
databases alone. In that case create a **separate database user for this app** with limited access: in **Database Access**,
add a user, choose **Specific Privileges**, and give it `readWrite` on the database `skope_operations` only. Atlas allows one free
cluster per project, so if you prefer to keep this app completely apart from your other projects, create a new project and a new
free cluster instead.

## Step 2: Create the service (Render)

1. Sign in to Render with your GitHub account.
2. Choose **New, then Blueprint**, select the `skope-operations-platform` repository, and continue. Render reads `render.yaml` for the settings.
3. Render asks for four values:

| Setting | What to enter |
| --- | --- |
| MONGO_URL | The connection string from Step 1 |
| ADMIN_EMAIL | The email the administrator will sign in with |
| ADMIN_PASSWORD | A strong password for the administrator |
| DEMO_PASSWORD | One strong password shared by the five role accounts (6+ characters) |

4. Click **Apply** and wait for the first build, which takes several minutes. When it shows **Live**, open the address at the top of the service page. It looks like `https://skope-operations-platform.onrender.com`.

## Step 3: Sign in and share

- The administrator signs in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- Five role accounts were created for testing. They all use `DEMO_PASSWORD`:

| Role | Email |
| --- | --- |
| Procurement manager | procurement@kitchen.com |
| Store keeper | keeper@kitchen.com |
| Store manager | manager@kitchen.com |
| Chef | chef@kitchen.com |
| Management | management@kitchen.com |

- Send your team the address, the role list and `DEMO_PASSWORD` (privately, not in a public channel). Each person tries the screens that role can open. The login page of the online copy does not list passwords.

## Step 4 (optional): add sample data so the whole flow can be tried at once

A fresh database has only the administrator, the standard units and the four locations. To add a brand, a
supplier, four items, a sub-recipe and a recipe, run this once from the project folder (Git Bash):

```bash
E2E_API=https://YOUR-ADDRESS.onrender.com E2E_ADMIN_EMAIL=your-admin-email E2E_ADMIN_PASSWORD=your-admin-password E2E_DEMO_PASSWORD=your-demo-password python tests/e2e/prepare.py
```

## Things to know

- **The free service sleeps.** After 15 minutes without visits it stops; the next visit takes about a minute to wake it ([Render free plan](https://render.com/docs/free)). Tell your team to expect a slow first load.
- **Uploaded files are temporary.** Invoice photos are saved on the service's temporary disk and disappear whenever it restarts or redeploys. The receipts themselves stay in the database. A permanent solution needs a paid disk or cloud file storage.
- **The database is small.** The free Atlas cluster holds 0.5 GB.
- **Not for real business data yet.** Anyone with the address can see the sign-in page, and the accounts are the only protection. Use strong passwords. Before real use, finish the security list in the overview document (login tokens in attachment links, CORS, hosting, backups).
- **Updating the app.** Push to GitHub (`git push`); Render rebuilds and redeploys by itself.
- **Starting over with empty data.** In Render, change `DB_NAME` to a new name (for example `skope_test2`). The app creates a fresh database on the next start.
- **Optional hardening.** Add a setting `CORS_ORIGINS` in Render with your address, so only your own site may call the API.

## A link from your own computer (no accounts, temporary)

This gives a public address that works only while your computer and both programs are running. Use it for a quick
demo, not for the team to use all week. I have not run this option on your machine.

1. In `backend/.env` set a strong `ADMIN_PASSWORD` and a separate `DB_NAME` (for example `skope_demo`). The address will be public, and the app will use that database.
2. Build the app once (Git Bash):

```bash
cd frontend
VITE_SHOW_DEMO_LOGINS=false VITE_BACKEND_URL= npx yarn@1.22.22 build
```

3. Start the backend, which now also serves the built app: `cd ../backend`, then `python -m uvicorn server:app --port 8001`.
4. In a second terminal install and run the tunnel tool: `winget install Cloudflare.cloudflared`, then `cloudflared tunnel --url http://localhost:8001`.
5. It prints an address ending in `.trycloudflare.com`. Share that.

## How it fits together

| File | Purpose |
| --- | --- |
| `Dockerfile` | Builds the React app, then runs the FastAPI server with the built app next to it |
| `render.yaml` | Tells Render how to run it and which settings to ask for |
| `backend/requirements-prod.txt` | The exact package versions the app was tested with |
| `backend/.env.example` | Every backend setting, with no secrets |
| `backend/server.py` | Serves the built app and the API from one address |
| `backend/seed.py` | Creates the administrator and, when `SEED_DEMO_USERS=true`, the five role accounts |

## What was tested, and what was not

Tested on this computer, by running the same steps the image runs: a production build of the app, the backend serving it on one
address, demo accounts created from settings, and the full browser test suite against that address (roles on desktop and phone,
the whole business flow, admin and edge flows, smoke and data entry, phone layout). The production build contains no
passwords or demo logins.

Not tested: building the Docker image itself (Docker is not installed here) and the real Render and Atlas deployment (they need
your accounts). If the first build fails, copy the error from Render's log and I will fix it.
