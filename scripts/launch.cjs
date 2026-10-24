const path = require("node:path");
const { spawn } = require("node:child_process");
const { root, prepare } = require("./setup.cjs");
try {
  const portIndex = process.argv.indexOf("--port");
  const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 3000;
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Use --port followed by a number from 1 to 65535.");
  prepare();
  console.log(
    `\nReify · http://127.0.0.1:${port}\nKeep this terminal open. Press Ctrl+C to stop.`,
  );
  console.log(
    "Gemma needs your server-side key. Twinly needs verified setup and exact approvals; see docs/TWINLY_SETUP.md.\n",
  );
  const child = spawn(
    process.execPath,
    [
      path.join(root, "node_modules", "next", "dist", "bin", "next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: root, stdio: "inherit" },
  );
  child.on("error", () => {
    console.error("Unable to start Next.js. Run npm run doctor.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 0;
  });
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
