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

1. Deploy the Express backend to Render and the frontend to Vercel.
2. In Vercel, set `VITE_API_URL` to the Render API base URL (for example, `https://your-render-api.onrender.com`).
3. In Render, set `MONGODB_URI`, a stable random `SESSION_SECRET`, and `CLIENT_ORIGINS` to the exact Vercel origin (scheme and hostname only, no path or trailing slash). The `https://labour-management-lemon.vercel.app` production domain is allowed by default; list any additional preview or custom domains in `CLIENT_ORIGINS`, comma-separated.
4. Redeploy both projects after changing code or environment variables. In Vercel, ensure the deployment is publicly accessible or that deployment protection permits the people testing it.
5. Open `https://your-render-api.onrender.com/api/health`. It reports database connectivity and whether `SESSION_SECRET` and `CLIENT_ORIGINS` are configured. HTTP 503 means the deployment is not ready; fix the reported settings and redeploy. The deployment log's `install-scripts` message is an npm warning; check the later build output for the actual result.

The API requires a valid `MONGODB_URI`; locally the server stays available and retries the database connection if MongoDB is temporarily unreachable. While offline, `/api/health` reports a degraded status and API requests return a database-unavailable message. The API allows credentialed requests from the built-in production origin and any additional origins listed in `CLIENT_ORIGINS`, and answers browser preflight requests explicitly; HTTPS session cookies use `SameSite=None; Secure` when a Vercel frontend calls a Render API. Signup and login return an actionable HTTP 503 if the production `SESSION_SECRET` is missing, instead of creating an account that cannot receive a session.
