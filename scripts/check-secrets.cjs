const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
const secretNames = ["GEMINI_API_KEY", "TWINLY_API_KEY"];
const actualSecrets = secretNames
  .map((name) => process.env[name]?.trim().replace(/^["']|["']$/g, ""))
  .filter((value) => value && value.length >= 12);
const patterns = [
  /AIza[0-9A-Za-z_-]{35}/,
  /twk_live_[A-Za-z0-9]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const findings = [];
function check(buffer, label) {
  const text = buffer.toString("utf8");
  if (
    actualSecrets.some((secret) => text.includes(secret)) ||
    patterns.some((pattern) => pattern.test(text))
  )
    findings.push(label);
}
const files = execFileSync("git", [
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "-z",
])
  .toString()
  .split("\0")
  .filter(Boolean);
for (const file of files)
  if (fs.existsSync(file) && fs.statSync(file).isFile())
    check(fs.readFileSync(file), `working tree: ${file}`);
for (const revision of execFileSync("git", ["rev-list", "--all"])
  .toString()
  .trim()
  .split("\n")
  .filter(Boolean)) {
  const paths = execFileSync("git", [
    "ls-tree",
    "-r",
    "--name-only",
    "-z",
    revision,
  ])
    .toString()
    .split("\0")
    .filter(Boolean);
  for (const file of paths)
    check(
      execFileSync("git", ["show", `${revision}:${file}`], {
        maxBuffer: 20 * 1024 * 1024,
      }),
      `${revision.slice(0, 8)}: ${file}`,
    );
}
const example = fs.readFileSync(".env.example", "utf8");
for (const name of secretNames)
  if (new RegExp(`^${name}=[ \\t]*[^\\s\\r\\n]+`, "m").test(example))
    findings.push(`.env.example: ${name} must be empty`);
if (findings.length) {
  console.error(
    "Secret scan FAILED. Only file locations are shown; values are never printed.",
  );
  console.error([...new Set(findings)].join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Secret scan PASS: ${files.length} publishable files plus all local Git history checked. Ignored private files were not published.`,
  );
