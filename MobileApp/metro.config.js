// The app reuses the website's data layer (src/data, lib/database.types.ts) straight from its folder,
// so both apps load, save and calculate things the same way. See DEVELOPMENT_PLAN.md.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
const WEB_SRC = path.resolve(__dirname, "../Web App Wireframe Design/src");
const MOBILE_SUPABASE = path.resolve(__dirname, "src/lib/supabase.ts");

config.watchFolders = [WEB_SRC];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (context.originModulePath.startsWith(WEB_SRC)) {
    // The web client reads Vite's import.meta.env, which React Native doesn't have. Hand over the app's client.
    if (/(^|\/)lib\/supabase$/.test(moduleName)) return { type: "sourceFile", filePath: MOBILE_SUPABASE };
    // Packages (react, @supabase/supabase-js) come from the app's node_modules, never the website's:
    // two copies of React break hooks.
    if (!moduleName.startsWith(".")) {
      return context.resolveRequest({ ...context, originModulePath: path.join(__dirname, "package.json") }, moduleName, platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
