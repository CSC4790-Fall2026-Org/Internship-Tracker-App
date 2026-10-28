// Separate from vite.config.ts so tests don't load the Figma Make and Tailwind plugins.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
