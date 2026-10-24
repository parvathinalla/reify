const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
process.chdir(path.resolve(__dirname, ".."));
const envPath = ".env.local";
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
const base =
  process.env.TWINLY_BASE_URL ||
  "https://advktwnedlgnhswpxokg.supabase.co/functions/v1/twinly-api/v1";
const fingerprint = crypto
  .createHash("sha256")
  .update(process.env.TWINLY_API_KEY || "")
  .digest("hex");
const pendingPath = ".data/twinly-verification-pending.json";
const prompt =
  'Reify connection verification only. Return JSON data {"reify_ready":true}. Do not open apps, access files, browse websites, contact anyone or perform any external action.';
async function request(endpoint, method = "GET", body) {
  const response = await fetch(base + endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.TWINLY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw Error(
      `Twinly returned ${response.status}. A submitted job may be uncertain; check the Mac before retrying.`,
    );
  return response.json();
}
function writeSetting(text, name, value) {
  const pattern = new RegExp(`^${name}=.*$`, "m");
  return pattern.test(text)
    ? text.replace(pattern, () => `${name}=${value}`)
    : text + `\n${name}=${value}\n`;
}
(async () => {
  if (process.argv.includes("--help")) {
    console.log(
      "npm run twinly:verify -- --status : read-only readiness.\nnpm run twinly:verify : review and approve one harmless Mac connection check.\nIf a prior job is uncertain, use --job=<UUID> to reconcile that existing job. No messages/calls are made by this utility.",
    );
    return;
  }
  if (!process.env.TWINLY_API_KEY)
    throw Error("Set TWINLY_API_KEY in private .env.local first.");
  if (new URL(base).protocol !== "https:")
    throw Error("Use the documented HTTPS Twinly API base.");
  const me = await request("/me");
  console.log(`Mac online: ${me.mac?.online === true}`);
  for (const [feature, value] of Object.entries(me.mac?.setup || {}))
    console.log(`${feature}: ${value === true ? "ready" : String(value)}`);
  if (process.argv.includes("--status")) return;
  if (
    !me.mac?.online ||
    !me.can?.mac?.includes("POST /v1/tasks") ||
    me.mac?.setup?.tasks_on_screen !== true
  )
    throw Error(
      "Finish Twinly task permissions on the Mac first, restart Twinly, and run the read-only status check again.",
    );
  let pending = fs.existsSync(pendingPath)
    ? JSON.parse(fs.readFileSync(pendingPath, "utf8"))
    : undefined;
  if (pending?.fingerprint !== fingerprint) pending = undefined;
  const supplied = process.argv.find((v) => v.startsWith("--job="))?.slice(6);
  if (
    supplied &&
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      supplied,
    )
  )
    throw Error("Provide a valid existing job UUID.");
  let id = supplied || pending?.id;
  if (!id) {
    if (pending?.uncertain)
      throw Error(
        "A previous verification submission was uncertain. Inspect Twinly jobs and rerun with --job=<existing UUID>; do not blindly submit again.",
      );
    console.log(
      "\nExact harmless verification task:\n" +
        prompt +
        "\nOn success, this configures live mode; every later action still requires feature readiness and explicit approval.",
    );
    const terminal = readline.createInterface({ input: stdin, output: stdout });
    const answer = await terminal.question(
      "Type VERIFY to authorize this one connection check: ",
    );
    terminal.close();
    if (answer !== "VERIFY") {
      console.log("No job submitted.");
      return;
    }
    fs.mkdirSync(".data", { recursive: true });
    fs.writeFileSync(
      pendingPath,
      JSON.stringify({ fingerprint, uncertain: true }),
    );
    const job = await request("/tasks?wait=0", "POST", {
      prompt,
      output_schema: {
        type: "object",
        properties: { reify_ready: { type: "boolean", const: true } },
        required: ["reify_ready"],
      },
    });
    id = job.id;
    if (
      !id ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        id,
      )
    )
      throw Error("No job ID returned; inspect the Mac before any retry.");
    fs.writeFileSync(pendingPath, JSON.stringify({ fingerprint, id }));
    console.log("Verification job submitted. Its reference is " + id);
  } else console.log("Reconciling the existing verification job " + id);
  for (let i = 0; i < 45; i++) {
    const job = await request("/jobs/" + encodeURIComponent(id));
    if (job.status === "needs_approval")
      console.log(
        "Approve the held verification job inside Twinly on the Mac.",
      );
    if (job.status === "done") {
      if (job.kind !== "tasks.run" || job.result?.data?.reify_ready !== true)
        throw Error(
          "The job did not return the required verification data. No configuration was changed.",
        );
      let settings = fs.existsSync(envPath)
        ? fs.readFileSync(envPath, "utf8")
        : "";
      settings = writeSetting(settings, "TWINLY_VERIFICATION_JOB_ID", id);
      settings = writeSetting(settings, "EXECUTION_MODE", "live");
      fs.writeFileSync(envPath, settings, { mode: 0o600 });
      fs.writeFileSync(
        pendingPath,
        JSON.stringify({
          fingerprint,
          id,
          verifiedAt: new Date().toISOString(),
        }),
      );
      console.log(
        "Mac job verification PASS. Private settings updated. Restart Reify, configure consenting contacts/approved website hosts, then inspect each feature in Connected capabilities. This did not test calls, messages or voice.",
      );
      return;
    }
    if (["failed", "canceled", "expired"].includes(job.status))
      throw Error(
        "Verification job " +
          job.status +
          ". Inspect that job; no live configuration was enabled.",
      );
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw Error(
    "Verification is still pending. Run this command again to reconcile the SAME saved job.",
  );
})().catch((error) => {
  console.error(error instanceof Error ? error.message : "Verification failed");
  process.exitCode = 1;
});
