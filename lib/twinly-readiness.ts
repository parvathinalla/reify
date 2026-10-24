import { createHash } from "node:crypto";
import { TwinlyAdapter } from "./twinly";
import {
  featureDefinitions,
  featureReadiness,
  TwinlyFeature,
} from "./twinly-contract";
export const keyFingerprint = () =>
  createHash("sha256")
    .update(process.env.TWINLY_API_KEY ?? "")
    .digest("hex");
export type FeatureStatus = {
  id: TwinlyFeature;
  title: string;
  ready: boolean;
  setupReady: boolean;
  reason: string;
  provider: "twinly";
};
export type TwinlyReadiness = {
  online: boolean;
  liveVerified: boolean;
  executionEnabled: boolean;
  features: FeatureStatus[];
  setup?: Record<string, boolean | string> | null;
  error?: string;
};
let cached: { key: string; until: number; value: TwinlyReadiness } | undefined;
export async function twinlyReadiness(
  client?: Pick<TwinlyAdapter, "health" | "poll">,
): Promise<TwinlyReadiness> {
  const cacheKey = [
    keyFingerprint(),
    process.env.TWINLY_BASE_URL,
    process.env.EXECUTION_MODE,
    process.env.TWINLY_VERIFICATION_JOB_ID,
    process.env.TWINLY_ALLOWED_CONTACTS,
  ].join(":");
  if (!client && cached?.key === cacheKey && cached.until > Date.now())
    return cached.value;
  const ids = Object.keys(featureDefinitions) as TwinlyFeature[];
  let value: TwinlyReadiness;
  try {
    if (!process.env.TWINLY_API_KEY)
      throw Error("Add TWINLY_API_KEY to the private environment.");
    const adapter = client ?? new TwinlyAdapter();
    const me = await adapter.health();
    let verified = false;
    if (process.env.TWINLY_VERIFICATION_JOB_ID) {
      const job = await adapter.poll(process.env.TWINLY_VERIFICATION_JOB_ID);
      verified =
        job.status === "done" &&
        job.kind === "tasks.run" &&
        job.result?.data !== null &&
        typeof job.result?.data === "object" &&
        (job.result.data as Record<string, unknown>).reify_ready === true;
    }
    const enabled = process.env.EXECUTION_MODE === "live";
    const contacts = (process.env.TWINLY_ALLOWED_CONTACTS ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    value = {
      online: me.mac.online,
      setup: me.mac.setup,
      liveVerified: verified,
      executionEnabled: enabled,
      features: ids.map((id) => {
        const state = featureReadiness(me, id);
        const needsContacts = [
          "messages_send",
          "messages_read",
          "calls",
        ].includes(id);
        const reason = !state.ready
          ? state.reason
          : !verified
            ? "Run npm run twinly:verify to verify a harmless Mac job first."
            : !enabled
              ? "Set EXECUTION_MODE=live only after verification."
              : needsContacts && !contacts.length
                ? "Configure consenting test contacts in TWINLY_ALLOWED_CONTACTS."
                : state.reason;
        return {
          id,
          title: featureDefinitions[id].title,
          provider: "twinly",
          setupReady: state.ready,
          ready:
            state.ready &&
            verified &&
            enabled &&
            (!needsContacts || !!contacts.length),
          reason,
        };
      }),
    };
  } catch (e) {
    value = {
      online: false,
      liveVerified: false,
      executionEnabled: false,
      error: e instanceof Error ? e.message : "Twinly readiness unavailable",
      features: ids.map((id) => ({
        id,
        title: featureDefinitions[id].title,
        provider: "twinly",
        ready: false,
        setupReady: false,
        reason:
          "Twinly credentials, verification or connectivity need attention.",
      })),
    };
  }
  if (!client) cached = { key: cacheKey, until: Date.now() + 15000, value };
  return value;
}
