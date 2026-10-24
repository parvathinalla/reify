// Tests the real adapter against a pinned sponsor mock. No real key, Mac or phone is used.
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const ts = require("typescript");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
process.chdir(root);
const directory = path.join(root, ".data", "official-twinly-mock");
const ref = "3c059afda3d9f46b2960e26ec18754bbb0e08254";
const upstream = `https://raw.githubusercontent.com/OjasMishra32/twinly-api-examples/${ref}/mock-api/`;
const realFetch = global.fetch;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  fs.mkdirSync(path.join(directory, "fixtures"), { recursive: true });
  const resources = [
    ["server.js", "server.mjs"],
    ...[
      "voice.m4a",
      "result.png",
      "image-square.jpg",
      "image-wide.jpg",
      "image-tall.jpg",
    ].map((name) => ["fixtures/" + name, "fixtures/" + name]),
  ];
  await Promise.all(
    resources.map(async ([source, target]) => {
      const file = path.join(directory, target);
      if (
        fs.existsSync(file) &&
        fs.existsSync(path.join(directory, "source-ref.txt")) &&
        fs.readFileSync(path.join(directory, "source-ref.txt"), "utf8") === ref
      )
        return;
      const response = await realFetch(upstream + source, {
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok)
        throw Error("Could not fetch official test fixture: " + source);
      fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    }),
  );
  fs.writeFileSync(path.join(directory, "source-ref.txt"), ref);
  for (const name of ["twinly-contract", "twinly"]) {
    const source = fs.readFileSync(
      path.join(root, "lib", name + ".ts"),
      "utf8",
    );
    const compiled = ts
      .transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ES2022,
          target: ts.ScriptTarget.ES2022,
        },
      })
      .outputText.replaceAll('"./twinly-contract"', '"./twinly-contract.mjs"');
    fs.writeFileSync(path.join(directory, name + ".mjs"), compiled);
  }
  const { createMockApi } = await import(
    pathToFileURL(path.join(directory, "server.mjs")).href
  );
  const mock = createMockApi();
  const info = await mock.listen(0, "127.0.0.1");
  const contractBase = "https://twinly-contract.invalid/v1";
  process.env.TWINLY_API_KEY = info.key;
  process.env.TWINLY_BASE_URL = contractBase;
  // The pinned mock predates mac.setup. Only its test /me response gets explicit ready fields;
  // production code never defaults unknown permissions to ready.
  global.fetch = async (input, init) => {
    const url = String(input);
    if (!url.startsWith(contractBase + "/"))
      throw Error("Test transport refused a non-mock destination");
    const response = await realFetch(
      info.base + url.slice(contractBase.length),
      init,
    );
    if (url.endsWith("/me") && response.ok) {
      const body = await response.json();
      body.mac.setup = {
        tasks_on_screen: true,
        messages: true,
        messages_read: true,
        calls: true,
        voice: true,
      };
      return Response.json(body);
    }
    return response;
  };
  const { TwinlyAdapter } = await import(
    pathToFileURL(path.join(directory, "twinly.mjs")).href
  );
  const adapter = new TwinlyAdapter();
  let passed = 0;
  async function config(body) {
    const r = await realFetch(info.url + "/_mock/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(r.ok, true);
  }
  async function reset() {
    await realFetch(info.url + "/_mock/reset", { method: "POST" });
    await config({
      rpm_limit: 500,
      claim_ms: 1,
      run_ms: {
        "messages.send": 5,
        "messages.read": 5,
        "calls.place": 5,
        "voice.speak": 5,
        "tasks.run": 5,
      },
    });
  }
  async function done(job) {
    for (let i = 0; i < 100; i++) {
      const current = await adapter.poll(job.id);
      if (
        ["done", "failed", "canceled", "expired", "needs_approval"].includes(
          current.status,
        )
      )
        return current;
      await wait(10);
    }
    throw Error("Mock job did not finish");
  }
  async function check(name, fn) {
    await reset();
    await fn();
    passed++;
    console.log("PASS: " + name);
  }
  try {
    await check("documented /me readiness", async () =>
      assert.equal((await adapter.health()).mac.online, true),
    );
    await check("iMessage submission + job delivery receipt", async () => {
      const j = await done(
        await adapter.message(
          "+15555550102",
          "Approved synthetic test message",
        ),
      );
      assert.equal(j.kind, "messages.send");
      assert.equal(j.result.delivered, true);
    });
    await check("read only the approved chat", async () => {
      const j = await done(await adapter.readMessages("+15555550102", 10));
      assert.equal(j.kind, "messages.read");
      assert.ok(Array.isArray(j.result.messages));
    });
    await check("bounded Mac task with structured output", async () => {
      const j = await done(
        await adapter.task(
          "Return the requested sample fields without external actions.",
          {
            type: "object",
            properties: {
              summary: { type: "string" },
              completed: { type: "boolean" },
            },
          },
        ),
      );
      assert.equal(j.kind, "tasks.run");
      assert.equal(j.result.data.completed, true);
    });
    await check("AI call goal and result (mock phone only)", async () => {
      const j = await done(
        await adapter.call(
          "+15555550199",
          "Ask about opening hours",
          "This is a synthetic test",
        ),
      );
      assert.equal(j.kind, "calls.place");
      assert.match(j.result.outcome, /mock call/);
    });
    await check("owner-voice audio result", async () => {
      const j = await done(
        await adapter.speak("A synthetic verification sentence."),
      );
      assert.equal(j.kind, "voice.speak");
      assert.equal(j.result.mime, "audio/mp4");
      assert.ok(j.result.audio_b64);
    });
    await check("generated image MIME and data", async () => {
      const result = await adapter.image(
        "A fictional garden illustration",
        "wide",
      );
      assert.equal(result.data[0].mime, "image/jpeg");
      assert.ok(result.data[0].b64_json);
    });
    await check("Twinly AI chat response", async () =>
      assert.ok(
        (await adapter.chat("Write a synthetic checklist.")).choices[0].message
          .content,
      ),
    );
    await check("owned-screen next action is a proposal only", async () => {
      const screen = fs
        .readFileSync(path.join(directory, "fixtures", "result.png"))
        .toString("base64");
      const r = await adapter.nextAction(
        "Inspect a controlled test screen",
        screen,
      );
      assert.equal(r.action.type, "click");
      assert.equal(r.action.commits, false);
    });
    await check("provider approval is preserved", async () => {
      await config({ hold: ["messages.send"] });
      const j = await done(
        await adapter.message("+15555550102", "Held synthetic message"),
      );
      assert.equal(j.status, "needs_approval");
      assert.equal(mock.state.outbox.length, 0);
    });
    await check(
      "uncertain submission is not automatically resent",
      async () => {
        await config({ unverify_jobs: 1, unverify_kind: "messages.send" });
        let uncertain = false;
        try {
          await adapter.message("+15555550102", "One synthetic send only");
        } catch (e) {
          uncertain = e.uncertain === true;
        }
        assert.equal(uncertain, true);
        assert.equal(mock.state.jobs.length, 1);
      },
    );
    await check("queued cancellation uses the existing job", async () => {
      await config({ claim_ms: 1000 });
      const j = await adapter.task("A cancellable synthetic task", {});
      const canceled = await adapter.cancel(j.id);
      assert.equal(canceled.status, "canceled");
      assert.equal(mock.state.jobs.length, 1);
    });
    console.log(
      `Official Twinly mock contract: ${passed} checks PASS. Source ref: ${ref}. This is not live-provider evidence.`,
    );
  } finally {
    global.fetch = realFetch;
    await mock.close();
  }
})().catch((error) => {
  global.fetch = realFetch;
  console.error(error.message);
  process.exitCode = 1;
});
