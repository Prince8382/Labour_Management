# Amit Yadav Labour Manager

Amit Yadav Labour Manager is a MERN app for managing a labour workforce, daily attendance and salary payments.

## Features

- Labour directory with phone, role, daily wage, joining date, address and emergency contact.
- Activate or deactivate labourers without deleting their history.
- Labour, attendance and payment data remain in MongoDB until explicitly deleted. Permanent deletion requires confirmation and also removes that labourer's attendance and payment history.
- Daily attendance with present, absent, half-day and leave statuses plus overtime-hour recording.
- Admin attendance page shows each labourer's monthly present, half-day, absent and leave totals, attendance-day equivalent, and overtime hours.
- Managers can create a regular account or log in; labourers have no accounts or self-service attendance access. The signed-in manager maintains labour attendance.
- Monthly wage calculation: present days plus half of half-days, multiplied by daily wage, plus overtime paid at daily wage divided by 8 per hour.
- Record one or more salary payments per labourer and month using cash, UPI or bank transfer.
- Responsive dashboard with attendance and payroll summaries.

## Run locally

1. Install Node.js 18 or later and run `npm install`.
2. Ensure MongoDB is running locally, or create a MongoDB Atlas database.
3. Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB connection string. For deployment, also configure a long random `SESSION_SECRET`. If you already created `.env`, leave its MongoDB URI unchanged.
4. Run `npm run dev`. Open `http://localhost:5173`, create an account or log in, then manage attendance and payroll from the dashboard.
5. To create a production frontend bundle, run `npm run build`.

## Deploy to Vercel

1. Import the GitHub repository into Vercel and keep the project root as the repository root.
2. Set `MONGODB_URI` and `SESSION_SECRET` in **Project Settings → Environment Variables** for the environments you deploy. Use the MongoDB Atlas **Drivers** connection string and allow Vercel's outbound database access in Atlas Network Access.
3. Vercel builds the Vite frontend from `npm run build`; API requests are served by the function in `api/[...path].js`. Do not add a catch-all rewrite to `/index.html`, because it can send `/api/auth/*` requests to the frontend instead of the API.
4. Redeploy after changing environment variables. The deployment log's `install-scripts` message is an npm warning; check the later build output for the actual result.

The API requires a valid `MONGODB_URI`; locally the server stays available and retries the database connection if MongoDB is temporarily unreachable. While offline, `/api/health` reports a degraded status and API requests return a database-unavailable message. Login sessions are signed, stateless cookies so they work across serverless function instances.
