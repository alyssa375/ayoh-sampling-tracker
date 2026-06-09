# Ayoh Sampling Tracker — Setup Guide

A PromoMash-style sampling program management app for Ayoh Foods.
Built with Next.js 14, Supabase, and Tailwind CSS.

---

## What it does

**For reps (brand ambassadors):**
- Clock in / clock out with GPS location capture
- Submit event reports (store, products sampled, interactions, units sold, notes, photos)
- Submit expenses with receipt photo uploads
- View their own hours and expense status

**For admins (you + your team):**
- See all reps' timesheets by week, with hours per shift
- Browse all event reports with totals
- Approve or reject expense submissions
- Generate payroll CSV exports (hours + wages + approved expenses, any date range)
- Manage the team and set hourly rates

---

## Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it `ayoh-sampling` (or anything you like)
3. Pick a region close to you (e.g. us-east-1)
4. Save the database password somewhere safe

---

## Step 2 — Run the database schema

1. In your Supabase project, go to **SQL Editor**
2. Open `supabase/schema.sql` from this folder
3. Paste the entire file and click **Run**

This creates:
- `profiles` table (users / reps)
- `clock_events` table (clock in/out records)
- `event_reports` table (sampling event data)
- `expenses` table (receipts + reimbursements)
- A `receipts` storage bucket
- Row-level security policies

---

## Step 3 — Get your Supabase credentials

In your Supabase project → **Project Settings → API**:

- `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → this is your `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

---

## Step 4 — Deploy to Vercel (free)

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. In the **Environment Variables** section, add:
   ```
   NEXT_PUBLIC_SUPABASE_URL       = your project URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY  = your anon key
   SUPABASE_SERVICE_ROLE_KEY      = your service role key
   ```
4. Click **Deploy** — Vercel will build and host it automatically
5. You'll get a URL like `ayoh-sampling.vercel.app`

---

## Step 5 — Create your admin account

1. Go to your deployed app URL
2. In Supabase → **Authentication → Users** → **Add User** → enter your email + password
3. Then in **SQL Editor**, run:
   ```sql
   UPDATE public.profiles
   SET role = 'admin'
   WHERE email = 'alyssa@ayohfoods.com';
   ```
4. Log in to the app — you'll land on the Admin Dashboard

---

## Step 6 — Invite your reps

In the app: **Admin → Team → Invite Rep**

Enter their name, email, and hourly rate. They'll get an email to set their password and log in.

Alternatively, in Supabase → Authentication → Invite User, then set their hourly rate in the Team page.

---

## Running locally (for development)

```bash
cd ayoh-sampling-tracker
cp .env.example .env.local
# Fill in .env.local with your Supabase credentials

npm install
npm run dev
# Open http://localhost:3000
```

---

## Updating product list

The products shown in the event report form are in:
`src/app/rep/report/page.js` → `const AYOH_PRODUCTS = [...]`

Edit that array to add or rename products.

---

## Payroll CSV format

The exported CSV includes:
- Name, Email, Hourly Rate
- Hours Worked (for the selected period)
- Gross Wages (hours × rate)
- Approved Expenses (sum of approved expense submissions)
- Total Due (wages + expenses)
- Shift Details (timestamps for each shift)

---

## Notes

- GPS uses the browser's built-in Geolocation API — no API key needed. If a rep denies location, the clock-in still records without GPS.
- Receipts are stored in Supabase Storage (private bucket — only the uploading rep and admins can view them).
- The `service_role` key is only used server-side in the invite API route — it never reaches the browser.
