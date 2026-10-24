const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
process.chdir(root);
function checkNode() {
  if (Number(process.versions.node.split(".")[0]) !== 24) {
    throw new Error(
      "Install Node.js 24 LTS from https://nodejs.org, reopen your terminal, then try again.",
    );
  }
}
function ensurePrivateEnvironment() {
  const target = path.join(root, ".env.local");
  if (fs.existsSync(target)) return false;
  try {
    fs.writeFileSync(target, fs.readFileSync(path.join(root, ".env.example")), {
      flag: "wx",
      mode: 0o600,
    });
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
}
const fingerprint = () =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync("package-lock.json"))
    .digest("hex");
const marker = path.join(root, "node_modules", ".reify-lock");
function dependenciesReady() {
  return (
    fs.existsSync(
      path.join(root, "node_modules", "next", "dist", "bin", "next"),
    ) &&
    fs.existsSync(marker) &&
    fs.readFileSync(marker, "utf8") === fingerprint()
  );
}
function install() {
  const npmScript = process.env.npm_execpath;
  if (!npmScript || !fs.existsSync(npmScript))
    throw new Error("Run this through npm: npm run setup or npm run launch.");
  console.log(
    "Installing the exact dependency versions from package-lock.json…",
  );
  const result = spawnSync(process.execPath, [npmScript, "ci"], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0)
    throw new Error(
      "Dependency install failed. Check network access and run npm run setup again.",
    );
  fs.writeFileSync(marker, fingerprint());
}
function prepare({ forceInstall = false } = {}) {
  checkNode();
  if (forceInstall || !dependenciesReady()) install();
  const created = ensurePrivateEnvironment();
  console.log(
    created
      ? "Created private .env.local. Add your own keys there when ready."
      : "Preserved your existing .env.local; no keys were changed.",
  );
}
if (require.main === module) {
  try {
    if (process.argv.includes("--check")) {
      checkNode();
      console.log(
        JSON.stringify(
          {
            node: process.versions.node,
            lockfile: fs.existsSync("package-lock.json"),
            dependenciesPrepared: dependenciesReady(),
            privateEnvironmentExists: fs.existsSync(".env.local"),
          },
          null,
          2,
        ),
      );
    } else {
      prepare({ forceInstall: true });
      console.log(
        "Setup complete. Run npm run launch, then open http://127.0.0.1:3000.",
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = {
  root,
  checkNode,
  ensurePrivateEnvironment,
  dependenciesReady,
  prepare,
};
