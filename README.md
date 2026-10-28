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

### Search

The nav bar's search button (or ⌘K / Ctrl+K) opens a command palette that searches applications, contacts, events, tasks and the pages themselves. Results are grouped and ranked — title matches beat matches on hidden fields like notes, emails or locations — and arrow keys plus Enter work throughout.

Picking a result navigates: applications open their detail page, contacts open on the Networking tab, and events open on the Calendar with the view moved to their date. That deep-linking runs through the `focusId` App passes down, which each page clears once handled.

### Calendar

The **Calendar** tab shows a month grid with four kinds of item: application deadlines, interview stages, unfinished task due dates, and events the user creates. Only the last of those is stored — in `calendar_events` — since the others already live on their own tables and are read directly, so they can never drift out of sync.

A **Month/Week** toggle switches between a month grid and a seven-column week view that shows every item in full rather than truncating to three per day. Both views share one anchor date, so switching between them keeps your place, and the arrows step by month or by week depending on which is active.

Clicking any day opens the new-event form for that date; clicking a deadline or interview jumps to its application. An **Upcoming** panel lists the next eight items from today.

**Sync to Google** gives each user a private calendar link that Google Calendar (or Apple Calendar or Outlook) can subscribe to. The `calendar-feed` Edge Function serves the same four kinds of item as an `.ics` feed, looked up by the random token in `calendar_feeds`. It's one-way and Google refreshes subscribed calendars on its own schedule (usually every few hours), so changes don't appear there instantly. Resetting the link swaps the token, which stops the old URL working. Times are sent in the timezone the browser reported when the user last opened the sync dialog.

Google fetches the feed without a Supabase session, so the function must be deployed without the JWT check:

```bash
supabase db push
supabase functions deploy calendar-feed --no-verify-jwt
```

### Networking

The **Networking** tab is the contact book: name, company, position, notes, email and phone. Contacts belong to the user, not to a single application, and `application_contacts` links a person to any number of applications — so one recruiter can cover two roles at the same company. Contacts can also be linked (or unlinked) from an application's Contacts tab, which offers existing contacts with same-company colleagues listed first.

### AI resume parsing

The **Profile** tab lets a user upload a resume PDF. The file goes to a private `resumes` storage bucket, and the `parse-resume` Edge Function extracts the text (with `unpdf`) and sends it to an AI model, which returns a structured profile saved in `resume_profiles`.

Every function that calls the model goes through `supabase/functions/_shared/llm.ts`. `LLM_TARGETS` there lists the providers in order: Groq (`openai/gpt-oss-120b`, about a second per call) first, then Google Gemini (`gemini-3.5-flash` with thinking off, about 3 seconds). When Groq is rate-limited (429), overloaded (5xx), unreachable, or the prompt is over its free per-minute token cap (413), the request is retried on Gemini. Both return schema-valid JSON for the strict schemas in `parse-resume` and `jobs`; if you change the list, check those still work. Gemini's free tier only allows about 20 requests a day for this model, so it is a backup, not a second full quota.

Because the text is extracted locally, a scanned or image-only PDF produces nothing and the user is told to upload a text-based PDF.

The API keys ([Groq](https://console.groq.com/keys), [Google AI Studio](https://aistudio.google.com/apikey)) are server-side secrets and must never be added to `.env.local` — anything with a `VITE_` prefix is bundled into the browser. Set them once per project, either in the dashboard under **Edge Functions → Secrets** or with:

```bash
supabase secrets set GROQ_API_KEY=gsk_... GEMINI_API_KEY=...
```

The names must be exactly `GROQ_API_KEY` and `GEMINI_API_KEY`; they are read as environment variables, not labels. A provider whose key isn't set is skipped.

To redeploy the function after editing `supabase/functions/parse-resume/index.ts`:

```bash
supabase functions deploy parse-resume
```

### Career log and brag doc

The **Career log** tab is a journal of accomplishments, projects, feedback, skills and milestones, stored in `career_log_entries`. Each entry has a date, title, details, an optional impact line, and can point at one of the user's applications (deleting the application keeps the entry and drops the link).

The **Brag doc** tab is a view over the same table, not separate data: it takes the accomplishment, project and feedback entries, groups them by month, quarter or year, and copies the result as plain text or Markdown. Editing an entry in the log changes the brag doc too.

### Career coach

The **Career coach** tab is a chat grounded in the user's own data. Each question sends the conversation plus a text summary built in `src/data/coach.ts`: applications and statuses, the dashboard's "needs attention" list, the next three weeks of deadlines, interviews, tasks and events, contacts, and the 25 most recent career log entries. It reuses the same helpers as the dashboard, so the coach and the dashboard agree on what's urgent.

The `career-coach` Edge Function calls the model through the shared helper, so the API keys never reach the browser. It only answers signed-in users, caps the prompt (about 14k characters of data and the last 12 messages), times out after 45 seconds, and turns rate limits on both providers into a "try again" message. Chat history lives in React state and resets when you leave the page.

It uses the same `GROQ_API_KEY` and `GEMINI_API_KEY` secrets as `parse-resume`. To deploy it, and the schema change that links log entries to applications:

```bash
supabase db push
supabase functions deploy career-coach
```

`jobs`, `parse-resume` and `career-coach` all import `_shared/llm.ts`; redeploy all three whenever that file changes.
