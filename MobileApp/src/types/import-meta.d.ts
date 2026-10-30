// Shared files from the website type-check against its lib/supabase.ts, which reads Vite's import.meta.env.
// At runtime Metro swaps that file for src/lib/supabase.ts, so this only satisfies the type checker.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
