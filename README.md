# Amit Yadav Labour Manager

Amit Yadav Labour Manager is a MERN app for managing a labour workforce, daily attendance and salary payments.

## Features

- Labour directory with phone, role, daily wage, joining date, address and emergency contact.
- Activate or deactivate labourers without deleting their history.
- Labour, attendance and payment data remain in MongoDB until explicitly deleted. Permanent deletion requires confirmation and also removes that labourer's attendance and payment history.
- Daily attendance with present, absent, half-day and leave statuses plus overtime-hour recording.
- One-time first-admin signup followed by admin-only sign-in; labourers do not have accounts or self-service attendance access.
- Monthly wage calculation: present days plus half of half-days, multiplied by daily wage, plus overtime paid at daily wage divided by 8 per hour.
- Record one or more salary payments per labourer and month using cash, UPI or bank transfer.
- Responsive dashboard with attendance and payroll summaries.

## Run locally

1. Install Node.js 18 or later and run `npm install`.
2. Ensure MongoDB is running locally, or create a MongoDB Atlas database.
3. Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB connection string. If you already created `.env`, leave its MongoDB URI unchanged.
4. Run `npm run dev`. On first visit, create the admin account with a 3–40 character username and a private password of at least 12 characters. Public signup closes after the first admin is created. The admin session expires after 8 hours, and repeated failed login attempts are temporarily blocked.
5. To create a production frontend bundle, run `npm run build`.

The API will not start without a valid `MONGODB_URI`; a missing configuration is reported in the server output. The first admin account is stored in MongoDB with a salted password hash. All labour, attendance and salary APIs require an admin session.
