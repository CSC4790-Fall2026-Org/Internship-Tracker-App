# Pipeline for iOS: development plan

The goal is an iPhone app with the same features as the website, using the same Supabase project. Someone who signs in on either one sees the same account and the same data.

## How it fits together

```
Internship-Tracker-App/
├── Web App Wireframe Design/      website (React + Vite)
│   ├── src/data/                  ← data layer, shared with the app
│   ├── src/lib/database.types.ts  ← database types, shared with the app
│   └── supabase/                  ← migrations + edge functions (the only copy)
└── MobileApp/                     iOS app (React Native + Expo)
```

Both apps talk to the same Supabase project. Nothing in the mobile app needs its own backend:

| Piece | Shared? | Notes |
|---|---|---|
| Accounts and sign-in | Yes | Same users and passwords. Google sign-in needs an extra iOS client ID (Phase 1). |
| Database and row-level security | Yes | Each user still only sees their own rows, whichever app they use. |
| Edge functions (`parse-resume`, `jobs`, `career-coach`, `calendar-feed`) | Yes | Called the same way, with `supabase.functions.invoke`. |
| Resume storage bucket | Yes | Same `resumes` bucket and the same `<user id>/` paths. |
| Screens and components | No | Rebuilt with React Native components. This is most of the work. |

### One data layer, two sets of screens

Almost everything in `Web App Wireframe Design/src/data/` is plain TypeScript with no browser code, including `DataContext.tsx`, which does every read and write for applications, interview stages, contacts, tasks and events. The mobile app imports these files directly instead of copying them. Then both apps load, save and calculate things the same way (what "needs attention", what's upcoming, pipeline stats, the coach's prompt).

| File | Reuse on mobile |
|---|---|
| `DataContext.tsx`, `types.ts`, `dates.ts`, `insights.ts` | As is |
| `careerLog.ts`, `bragDoc.ts`, `coach.ts`, `jobs.ts`, `resume.ts` | As is (they call Supabase through the client swap below) |
| `status.ts` | Labels, hints and order as is. The Tailwind class strings are ignored. |
| `csv.ts` | Parsing and building CSVs as is. `downloadCsv` is browser-only, so mobile uses the share sheet instead. |
| `lib/database.types.ts` | As is |

**The one catch:** those files import `../lib/supabase`, and the web version of that file reads Vite's `import.meta.env`, which doesn't exist in React Native. [`metro.config.js`](metro.config.js) handles this. For files under the website's `src/`, it redirects that import to the app's own `src/lib/supabase.ts`, and it loads packages like `react` and `@supabase/supabase-js` from the app's `node_modules` (two copies of React break hooks). The app imports shared files with the `@shared/` alias, e.g. `@shared/data/DataContext`.

This was proven in Phase 0. The iOS bundle contains only the app's Supabase client and one copy of React, and the shared `DataContext`, `insights`, `status` and `dates` files run unchanged. If it ever causes trouble, the fallback is to move the shared files into a top-level `shared/` folder that both apps import from. That needs a small change to the website's imports, so treat it as plan B.

## Tech choices

| Need | Choice | Why |
|---|---|---|
| Framework | **Expo** (React Native, TypeScript) | Same language and React habits as the website. Runs on your iPhone through Expo Go without Xcode. Android comes almost free later. |
| Navigation | **Expo Router** | File-based routes, similar to how the website's screens are organized. |
| Styling | **`StyleSheet` + color tokens** (`src/theme/colors.ts`) | The website's color tokens from `src/index.css`, copied over, with light and dark modes. NativeWind was the first plan, but its stable release needs Tailwind v3, while the website uses v4 and NativeWind's v4 support is still a release candidate. Revisit once that's stable. |
| Supabase client | `@supabase/supabase-js` with `expo-sqlite` storage | Follows Expo's current Supabase guide: session saved on the device, `detectSessionInUrl: false`, and auto-refresh started/stopped with `AppState`. |
| Charts and the Sankey diagram | `react-native-svg` | The web charts are SVG already, so the drawing logic ports over. |
| Board drag and drop | `react-native-gesture-handler` + `react-native-reanimated` | Phase 2 starts with a "Move to…" menu. Dragging comes later. |
| Calendar grid | `react-native-calendars`, or a hand-built grid like the web's | Decide in Phase 3. The web's month/week grid is simple enough to port. |
| Files, links, sharing | `expo-document-picker`, `expo-web-browser`, `expo-clipboard`, the built-in Share sheet | Resume upload, opening job links, copying the brag doc. |
| Builds and TestFlight | **EAS Build / EAS Submit** | Builds in the cloud, so you don't need Xcode for releases. |

Environment variables go in `MobileApp/.env` (ignored by git; copy `.env.example`) as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, with the same values as the website's `.env.local`. Like `VITE_` variables, anything starting with `EXPO_PUBLIC_` ships inside the app, so **never** add the service role key, `GROQ_API_KEY` or the Adzuna keys. Those stay in Supabase's edge function secrets.

## Screens

The website has 11 screens in a sidebar. A phone gets five bottom tabs, with the rest under **More**:

| Tab | Website screens it covers |
|---|---|
| **Home** | Dashboard |
| **Applications** | Applications list and Board (toggle at the top), Application detail, Add/Edit application |
| **Calendar** | Calendar, including the Sync to Google link |
| **Jobs** | Jobs (search and Recommended) |
| **More** | Networking, Career log, Brag doc, Career Coach, Profile (resume), theme, sign out, delete account |

Search (⌘K on the web) becomes a search button in the header of every tab.

## Phases

Each phase ends with something that runs on a phone. Tick the boxes in PR descriptions as features land.

### Phase 0: Foundations
- [x] Create the Expo app (SDK 58) in `MobileApp/` with TypeScript and Expo Router.
- [x] Add `.env.example`, a Supabase client in `src/lib/supabase.ts`, and the Metro config.
- [x] Get TypeScript to type-check the shared web files (`src/types/import-meta.d.ts` covers the web client's `import.meta.env`).
- [x] Wrap the tabs in the website's `DataProvider`.
- [x] Basic UI kit (`src/components/ui.tsx`): Text, Screen, Card, Button, Field, Input, Banner, EmptyState, StatusDot, StatusBadge, in light and dark.
- [x] A README in `MobileApp/` covering install, `.env`, and running on your phone.
- [x] Five tabs (Home, Applications, Calendar, Jobs, More). Home shows the application count, the count per status and the next five upcoming items, with pull to refresh. The others are placeholders naming their phase.
- [x] Modal sheet (Expo Router `presentation: "modal"`) and toast components, built in Phase 2 where the first forms needed them. Menus and confirmations use the native action sheet and alert (`src/components/feedback.tsx`).

**Done when:** the app opens in Expo Go on an iPhone, signs in with an existing account, and shows how many applications that account has.

### Phase 1: Sign-in and onboarding
- [x] Sign in, create account, forgot password, sign out (built in Phase 0, with the same wording as the website).
- [x] Onboarding (`src/app/onboarding.tsx`): what you're looking for, career fields, then an optional resume, with the same steps, wording and `onboarded` flag as the website. Finishing on either app counts for both. The resume step uses a phone version of the upload helper (`src/data/resume-upload.ts`) that Phase 5's Profile screen will reuse.
- [x] Google sign-in (`src/lib/google-sign-in.ts`). **Changed from the original plan:** instead of native Google Sign-In (which needs a development build and a new iOS client in Google Cloud), it uses Supabase's browser sign-in in an in-app browser sheet. That works in Expo Go and reuses the website's Google setup. Switch to native later if the sheet feels clunky.
- [x] The app's URL scheme is `pipeline://` (`app.json`).
- [ ] **Dashboard step (someone with access to Supabase):** under Authentication → URL Configuration → Redirect URLs, add `pipeline://**` and `exp://**`. Until then, Google sign-in in the app finishes on the website instead of returning to the app.
- [ ] Email confirmation and password-reset links still open the website, which updates the same account. Bring them into the app only if testers ask for it.

**Not yet tested:** onboarding and Google sign-in need a brand-new account to try end to end. Sign-in with an existing account is confirmed working in the simulator.

**Done when:** an account created on the phone can sign in on the website, and the other way round.

### Phase 2: Applications (the core)
- [x] Applications list (`src/app/(tabs)/applications/index.tsx`): native search bar, stage filter chips with counts, the website's sort options and rules, pull to refresh. Touch and hold a row for Open / Move to… / Edit / Delete.
- [x] Application detail (`[id].tsx`): header, stage (tap to change), stage track, facts, and Overview / Interviews / Contacts tabs. Overview has notes (save when you tap away) and tasks & events (add a task, check it off). Interviews lets you add, complete and delete rounds. Contacts lets you link existing people, add new ones, email and unlink. The website's Overview side cards (Interviews and People summaries) are left out on the phone, since those tabs are one tap away.
- [x] Add and edit (`form.tsx`, a sheet with Cancel / Save), and delete from the detail page, the row menu, or Select mode, which deletes or moves several at once.
- [x] Board (`src/components/board.tsx`): one column per stage, swiped sideways a column at a time, with + to add straight into a column. Touch and hold a card for "Move to…". An offer gets the same congratulations as the website, plus a haptic.
- [ ] Board drag-and-drop between columns.
- [ ] The Board's Insights view (response/interview/offer rates and the Sankey diagram) moved to Phase 3 with the other charts.

**Tested:** in the iOS Simulator with a real account, the list, Board, add form, and detail page (all three tabs) render the right data. **Not yet tested:** anything that saves (adding, editing, deleting, moving, notes, tasks, rounds, contacts), because the simulator couldn't be tapped from the command line. These all call the same `DataContext` functions as the website, but try each one on a phone before calling Phase 2 done.

**Known issue:** iOS large titles render blank alongside the search bar in this SDK, so screens use the standard title for now.

**Done when:** a change made on the phone shows up on the website after a refresh, and the other way round.

### Phase 3: Dashboard and Calendar
- [x] Dashboard (Home tab): greeting and summary, the four headline tiles (tapping one opens Applications filtered, or the Board), Needs attention with its filters and one-tap fixes (Done / Mark applied / Mark done, each with Undo), Agenda (Upcoming and Tasks), and Pipeline (Overview, Weekly, Activity). All the numbers come from the shared `insights.ts`. A new account gets the website's "Start tracking your search" options plus Tasks.
- [x] Charts (`src/components/charts.tsx`): stage breakdown, conversion steps and weekly columns are plain views. The Sankey diagram uses `react-native-svg` and scrolls sideways on a phone. Hover became tap: tap a week, flow or bar to read its numbers.
- [x] The Board's Insights view: a third option next to List and Board, with the three rates and the Sankey diagram.
- [x] Calendar (`src/app/(tabs)/calendar/`): month grid with colored dots per item kind, week view with every item listed, legend, the selected day's items, and Coming up. Touch and hold a day to add an event there. Tapping an item opens the event, or the application for deadlines and interviews.
- [x] Event form (`event.tsx`): title, date, optional time, related application, notes, and delete.
- [x] Sync sheet (`sync.tsx`): the same `calendar_feeds` link as the website. "Add to Calendar" opens the `webcal://` link, which subscribes in the iPhone Calendar app. Also an Open Google Calendar button, copy link, and reset link.
- [x] Events linked to an application can be opened from its detail page.
- [ ] The website's entrance animations (count-up numbers, bars growing in) aren't ported. Add them in Phase 6 polish if wanted.

**Tested:** in the iOS Simulator with a real account, in light and dark: Dashboard (tiles, Needs attention, Pipeline), Applications opened with the Offers filter, Insights with the Sankey diagram, Calendar month and week, the event form and the sync sheet all render the right data. **Not yet tested:** anything that saves (adding or editing events, tasks, the Done / Mark applied buttons and their Undo, resetting the link), and actually subscribing from the iPhone Calendar app. These need taps on a phone.

### Phase 4: Networking and career
- [x] The More tab is now a stack (`src/app/(tabs)/more/`): a menu of the website's other pages, then the account and Sign out. Career Coach and Profile show "Phase 5" until they're built.
- [x] Networking (`networking.tsx`): everyone with their role, company and linked applications, native search, and All / Linked / Not linked. Touch and hold a person to email, call, edit or delete them. Tapping a contact's name on an application's Contacts tab opens them here too.
- [x] Contact form (`contact.tsx`): name, company, role, email, phone, notes, a checklist of linked applications (same-company ones first), Email and Call buttons, and delete.
- [x] Career log (`career-log.tsx`): entries newest first with category, impact, details and linked application, plus native search, category chips with counts and pull to refresh. The phone shares one copy of the log between the list, the entry form and the brag doc (`src/data/career-log-store.tsx`), loaded through the website's `careerLog.ts`.
- [x] Entry form (`entry.tsx`): category with its hint, date, title, details, impact, related application with an "Open application" link, and delete.
- [x] Brag doc (`brag-doc.tsx`): category toggles, Month / Quarter / Year, and the grouped document from the website's `bragDoc.ts`. The share button offers the iOS share sheet (plain text), Copy as text, and Copy as Markdown.

**Tested:** in the iOS Simulator with a real account, the More menu, Networking (30 contacts), the contact form, the entry form, and the empty Career log and Brag doc render correctly. **Not yet tested:** a Career log and Brag doc with entries in them (this account has none, since the demo career-log seed targets a different account), and anything that saves.

### Phase 5: Profile, Jobs and Career Coach
- [x] Profile (`more/profile.tsx`): upload or replace the resume through the Files picker (`src/data/resume-upload.ts`, built in Phase 1), then edit Basics, Looking for, Field (up to 3), Summary, Skills / Interests / Preferred locations (tag editors), and Experience. An "Unsaved changes" bar offers Discard or Save, and it saves the same columns as the website.
- [x] Jobs tab (`jobs/index.tsx`): **For you** shows the saved matches (Looking-for chips that save to the profile and re-run, editable saved searches with Suggest / Refresh / Search these, and match score plus AI insight per job). **Browse** has keyword, location, sort, job type and Load more, keeping the last search while you're away, like the website, to save shared quota. The Adzuna credit their terms require is on both lists.
- [x] Job cards (`src/components/job-card.tsx`): Apply opens the listing in an in-app browser, and closing it asks "Did you apply?" so tracking is one tap. Save for later, and a Tracked button that opens the application.
- [x] Career Coach (`more/coach.tsx`): opens as a sheet so the message bar sits above the keyboard rather than under the tab bar. Starter prompts, the website's renderer for bold, lists and code (`src/components/rich-text.tsx`), Copy answer, New chat, Try again, and the note of exactly what data it uses. It's built from the shared `coach.ts` and the career-coach Edge Function.
- [ ] Profile doesn't warn before leaving with unsaved changes (the website doesn't either). Consider it in Phase 6.

**Tested:** in the iOS Simulator with a real account: Jobs "For you" with 10 saved matches, Profile with the uploaded resume, and the Career Coach's starting screen. **Not yet tested:** to avoid spending the Adzuna and Groq quotas your team shares, I didn't run a Browse search, ask the coach a question, or re-run recommendations, and saving the profile and uploading a resume need taps. Try each once on a phone.

### Phase 6: Parity and polish
- [x] Search (`src/app/search.tsx`): the website's search palette as a sheet, opened from the 🔍 button on Home, Calendar, Jobs and More. (Applications keeps its own list search.) Same groups, ranking, actions and page list. To make it reachable from every tab, the shared `DataProvider` and the toast moved from the tab layout up to the root layout.
- [x] Dark mode follows the phone, with System / Light / Dark under More → Appearance (`src/lib/theme-preference.ts`, using `Appearance.setColorScheme`). The choice is saved on the device.
- [x] CSV import and export (`src/data/csv-files.ts`), using the website's own `csv.ts` to build and read the file. On Applications, the ⋯ menu has Import CSV, and Export of all or the filtered rows. Select mode can export just the selected ones. The empty state has an Import CSV button too. Export opens the share sheet (save to Files, mail, AirDrop). Import uses the website's checks and messages for skipped rows, duplicates and ignored columns.
- [x] Loading, empty and error states: every screen has them. Calendar and Networking gained the "Couldn't load… / Try again" banner the Dashboard and Applications already had.
- [x] Dynamic Type: checked at the largest standard text size. Fixed-size elements (company and avatar initials, badges, segment labels, calendar day numbers) cap how far their text grows, and dashboard tile labels can wrap. VoiceOver labels were added screen by screen in earlier phases.
- [x] Refetch when returning to the app after 30 seconds or more, for the shared data and the career log, so edits made on the website show up.
- [x] Profile now asks before you leave with unsaved changes (Phase 5's open item).
- [x] Tab icons now match the website's: a list for Applications and a briefcase for Jobs, so the search button's magnifying glass doesn't double up with Jobs.
- [ ] Optional, not started: Board drag-and-drop (Phase 2), the website's entrance animations (Phase 3), deadline reminders with `expo-notifications`, and Supabase Realtime for live updates.

**Tested:** in the iOS Simulator: Search with results (opened with a "q" in the link), the Appearance setting rendering, and the Dashboard and Calendar at the largest text size. **Not yet tested:** tapping a search result, switching the theme, importing or exporting a CSV, the unsaved-changes prompt, and the return-to-app refresh. All need taps or backgrounding on a phone.

### Phase 7: App Store
- [ ] Apple Developer Program membership ($99/year) for TestFlight and the App Store. Expo Go testing is free until then.
- [ ] App icon, splash screen, app name and bundle ID.
- [ ] **Delete account in the app.** Apple requires this for apps that let people create accounts, and the website doesn't have it yet. It needs a new edge function that deletes the signed-in user with the service role. All 10 tables already delete that user's rows along with the account, but the function must also delete their uploaded resumes from storage. Add the same option to the website.
- [ ] **Sign in with Apple.** Apple's guidelines generally require an equivalent privacy-friendly option when an app offers Google sign-in. Supabase supports Apple as a provider. Check the current guidelines before submitting.
- [ ] Privacy policy URL and the App Store privacy questionnaire (the app stores emails, resumes and application data).
- [ ] EAS Build → TestFlight for the team → App Store review.

## Rules for working on both apps

- **One backend.** Migrations and edge functions live only in `Web App Wireframe Design/supabase/`. The mobile app never gets its own `supabase/` folder.
- **Schema changes must not break the other app.** Add columns with defaults instead of renaming or removing them, then update both apps. After a migration, regenerate `database.types.ts` once and both apps pick it up.
- **Editing `src/data/` affects both apps.** Run the mobile app's type check (and open the app) before merging changes to shared files. Don't add browser-only code (`window`, `document`, `localStorage`) to those files.
- **Branches.** `MobileApp` is the long-lived branch for this work. Make feature branches off it (e.g. `mobile/applications-list`), open PRs into `MobileApp`, and merge `MobileApp` into `main` at the end of each phase. Merge `main` into `MobileApp` regularly so website changes reach the app.
- **Testing across both apps.** Before closing a phase, create, edit and delete each kind of record on the phone and check it on the website, then do the reverse.

## Risks and open questions

- **Figma Make.** The website folder is a Figma Make project. If Figma Make ever regenerates `src/data/`, the shared files could change without warning. Keep an eye on diffs there, or move to the `shared/` folder approach (plan B).
- **Shared API quotas.** Every user of either app shares the Adzuna and Groq quotas. The cooldowns are enforced in the edge functions, so mobile can't bypass them, but more users means hitting the limits sooner.
- **Expo Go limits.** Native Google sign-in and some other native modules need a development build. Plan to switch from Expo Go to a dev build in Phase 1.
- **Password reset links** currently send people to the website (`window.location.origin`). That's fine to start with, since the reset still applies to the same account. Point them at the app's URL scheme in Phase 1 if you want the reset to happen inside the app.
