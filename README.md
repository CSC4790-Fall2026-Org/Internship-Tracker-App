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

### AI resume parsing

The **Profile** tab lets a user upload a resume PDF. The file goes to a private `resumes` storage bucket, and the `parse-resume` Edge Function extracts the text (with `unpdf`) and sends it to Groq, which returns a structured profile saved in `resume_profiles`.

The model is `openai/gpt-oss-120b`, set as `GROQ_MODEL` at the top of the function. Groq only guarantees schema-valid JSON on the `gpt-oss` models, so changing it may loosen that guarantee.

Because the text is extracted locally, a scanned or image-only PDF produces nothing and the user is told to upload a text-based PDF.

The Groq API key is a server-side secret and must never be added to `.env.local` — anything with a `VITE_` prefix is bundled into the browser. Set it once per project, either in the dashboard under **Edge Functions → Secrets** or with:

```bash
supabase secrets set GROQ_API_KEY=gsk_...
```

The name must be exactly `GROQ_API_KEY`; it is read as an environment variable, not a label.

To redeploy the function after editing `supabase/functions/parse-resume/index.ts`:

```bash
supabase functions deploy parse-resume
```
