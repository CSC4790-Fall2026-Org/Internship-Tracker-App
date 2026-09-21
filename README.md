# Internship-Tracker-App
App to help users organize internship and job applications as well as help guide through the application process.

## Running the web app

The app lives in `Web App Wireframe Design/` and uses [Supabase](https://supabase.com) for auth and data.

```bash
cd "Web App Wireframe Design"
npm install
cp .env.example .env.local   # then fill in the Supabase URL + publishable key
npm run dev
```

Find the values for `.env.local` in the Supabase dashboard under **Project Settings → API**.

### Database

The schema is in `supabase/migrations/`. It defines `applications`, `interview_stages`, `contacts` and `tasks`. Every row belongs to a user, and row-level security lets each user see only their own data. After changing the schema, regenerate the TypeScript types:

```bash
npx supabase gen types typescript --project-id agckhqdtazdgxpeqljcg > src/lib/database.types.ts
```
