# Pipeline for iOS

The iPhone app for Pipeline, built with [Expo](https://expo.dev) (React Native + TypeScript). It uses the same Supabase project as the website, so an account and its data are the same in both. See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for the roadmap and what each phase covers.

## Running it

1. Install dependencies for **both** apps. The mobile app imports the website's data layer, and type-checking those files needs the website's packages too:

   ```bash
   cd "Web App Wireframe Design" && npm install && cd ..
   cd MobileApp && npm install
   ```

2. Copy `.env.example` to `.env` and fill in the same Supabase URL and publishable key as the website's `.env.local`, renamed with the `EXPO_PUBLIC_` prefix. `.env` is ignored by git.

3. Start the dev server:

   ```bash
   npx expo start
   ```

4. Open it:
   - **On your iPhone:** install **Expo Go** from the App Store, make sure the phone is on the same Wi-Fi as your computer, and scan the QR code with the Camera app.
   - **In the iOS Simulator** (needs Xcode): press `i` in the terminal running `expo start`.

Sign in with the same email and password you use on the website.

## How the code is organized

```
MobileApp/
├── src/app/             screens (Expo Router: every file is a route)
│   ├── _layout.tsx      root: checks the session, shows sign-in or the tabs, and provides the shared data
│   ├── sign-in.tsx, onboarding.tsx, search.tsx
│   └── (tabs)/          Home (dashboard), Applications (list, [id] detail, form), Calendar (calendar, event, sync), Jobs,
│                        More (networking, contact, career-log, entry, brag-doc, profile, coach)
├── src/components/      UI kit (ui.tsx) matching the website's components, plus feedback (toast, alerts, menus)
├── src/data/            phone-only data helpers (resume upload, sorting, stage changes)
├── src/lib/supabase.ts  the app's Supabase client
├── src/theme/           colors copied from the website's index.css
└── metro.config.js      lets the app import the website's data layer
```

### Shared code

Import anything from the website's `src/` with the `@shared/` alias, for example:

```ts
import { useData } from "@shared/data/DataContext";
import { upcomingItems } from "@shared/data/insights";
```

`DataContext` does every read and write for applications, interview stages, contacts, tasks and events, exactly as on the website. Those web files import `../lib/supabase`, which reads Vite-only settings, so `metro.config.js` hands them `src/lib/supabase.ts` instead. Keep browser-only code (`window`, `document`, `localStorage`) out of the website's `src/data/` so the app can keep importing it.

## Checks

Run these before opening a PR:

```bash
npm run typecheck   # also type-checks the shared website files
npx expo lint
npx expo-doctor
```

Add packages with `npx expo install <package>`, not `npm install`, so you get versions that match the Expo SDK.
