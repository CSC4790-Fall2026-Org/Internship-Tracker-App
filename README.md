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

The **Profile** tab lets a user upload a resume PDF. The file goes to a private `resumes` storage bucket, and the `parse-resume` Edge Function extracts the text (with `unpdf`) and sends it to Google Gemini, which returns a structured profile saved in `resume_profiles`.

Every function that calls the model goes through `supabase/functions/_shared/llm.ts`, which sends OpenAI-style requests to Gemini's OpenAI-compatible endpoint. `LLM_MODELS` there lists `gemini-3.5-flash` first and `gemini-3.5-flash-lite` as a fallback: when the first model is rate-limited (429) or overloaded (503), the request is retried on the next. Both return schema-valid JSON for the strict schemas in `parse-resume` and `jobs`; if you change the list, check those still work.

Because the text is extracted locally, a scanned or image-only PDF produces nothing and the user is told to upload a text-based PDF.

The Gemini API key (from [Google AI Studio](https://aistudio.google.com/apikey)) is a server-side secret and must never be added to `.env.local` — anything with a `VITE_` prefix is bundled into the browser. Set it once per project, either in the dashboard under **Edge Functions → Secrets** or with:

```bash
supabase secrets set GEMINI_API_KEY=...
```

The name must be exactly `GEMINI_API_KEY`; it is read as an environment variable, not a label.

To redeploy the function after editing `supabase/functions/parse-resume/index.ts`:

```bash
supabase functions deploy parse-resume
```

### Career log and brag doc

The **Career log** tab is a journal of accomplishments, projects, feedback, skills and milestones, stored in `career_log_entries`. Each entry has a date, title, details, an optional impact line, and can point at one of the user's applications (deleting the application keeps the entry and drops the link).

The **Brag doc** tab is a view over the same table, not separate data: it takes the accomplishment, project and feedback entries, groups them by month, quarter or year, and copies the result as plain text or Markdown. Editing an entry in the log changes the brag doc too.

### Career coach

The **Career coach** tab is a chat grounded in the user's own data. Each question sends the conversation plus a text summary built in `src/data/coach.ts`: applications and statuses, the dashboard's "needs attention" list, the next three weeks of deadlines, interviews, tasks and events, contacts, and the 25 most recent career log entries. It reuses the same helpers as the dashboard, so the coach and the dashboard agree on what's urgent.

The `career-coach` Edge Function calls Gemini through the shared helper, so the API key never reaches the browser. It only answers signed-in users, caps the prompt (about 14k characters of data and the last 12 messages), times out after 45 seconds, and turns rate limits on both models into a "try again in a minute" message. Chat history lives in React state and resets when you leave the page.

It uses the same `GEMINI_API_KEY` secret as `parse-resume`. To deploy it, and the schema change that links log entries to applications:

```bash
supabase db push
supabase functions deploy career-coach
```

`jobs`, `parse-resume` and `career-coach` all import `_shared/llm.ts`; redeploy all three whenever that file changes.
