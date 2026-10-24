const fs = require("node:fs");
const { root, checkNode, dependenciesReady } = require("./setup.cjs");
process.chdir(root);
try {
  checkNode();
  if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
  const present = (name) =>
    !!process.env[name]?.trim() &&
    !/^(your_|paste_|replace_)/i.test(process.env[name]);
  const checks = {
    node: process.versions.node,
    dependenciesPrepared: dependenciesReady(),
    privateEnvironmentExists: fs.existsSync(".env.local"),
    gemmaKeyConfigured: present("GEMINI_API_KEY"),
    gemmaModel: ["gemma-4-26b-a4b-it", "gemma-4-31b-it"].includes(
      process.env.GEMMA_MODEL,
    )
      ? process.env.GEMMA_MODEL
      : "default or unsupported (check .env.local)",
    twinlyKeyConfigured: present("TWINLY_API_KEY"),
    twinlyLiveExecutionEnabled: false,
    persistence: process.env.VERCEL
      ? "read-only sandbox"
      : "single-process local files",
  };
  console.log(JSON.stringify(checks, null, 2));
  console.log(
    "Configured means present, not verified. This command makes no provider requests and never prints keys.",
  );
  if (!checks.dependenciesPrepared)
    console.log("Run npm run setup to prepare dependencies.");
  if (!checks.gemmaKeyConfigured)
    console.log(
      "For source interpretation, add GEMINI_API_KEY to .env.local and restart.",
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
