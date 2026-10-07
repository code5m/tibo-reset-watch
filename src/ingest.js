const INGEST_URL = process.env.INGEST_URL || "";
const INGEST_SECRET = process.env.INGEST_SECRET || "";

export function ingestEnabled() {
  return Boolean(INGEST_URL && INGEST_SECRET);
}

async function post(payload) {
  if (!ingestEnabled()) return { skipped: true };

  const response = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + INGEST_SECRET
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12_000)
  });

  if (!response.ok) {
    throw new Error("Website ingest HTTP " + response.status + ": " + (await response.text()).slice(0, 240));
  }

  return { ok: true };
}

export async function ingestSignal(post, classification, resetAt) {
  return postPayloadSafe({
    type: "signal",
    source: "tibo-x",
    sourcePostId: post.id,
    kind: classification.kind,
    title:
      classification.kind === "completed" ? "Tibo 确认 Reset 已完成" :
      classification.kind === "scheduled" ? "Tibo 公布未来 Reset 时间" :
      classification.kind === "banked" ? "Tibo 公布 Banked Reset" :
      "Tibo Reset 线索",
    body: post.text,
    sourceUrl: post.url,
    sourceCreatedAt: post.createdAt,
    resetAt: resetAt ? resetAt.toISOString() : null,
    metadata: {
      source: post.source,
      versionKey: post.versionKey
    }
  });
}

export async function ingestProject(post, lead) {
  return postPayloadSafe({
    type: "project",
    source: "tibo-x",
    sourcePostId: post.id,
    title: post.text.slice(0, 120),
    summary: post.text,
    sourceUrl: post.url,
    score: lead.score,
    tags: lead.reason,
    sourceCreatedAt: post.createdAt,
    metadata: {
      source: post.source,
      versionKey: post.versionKey
    }
  });
}

export async function ingestHealth(health) {
  return postPayloadSafe({
    type: "health",
    value: {
      lastSuccessAt: health.lastSuccessAt,
      lastFailureAt: health.lastFailureAt,
      consecutiveFailures: health.consecutiveFailures,
      lastError: health.lastError,
      lastSource: health.lastSource,
      lastSourceAgeMinutes: health.lastSourceAgeMinutes
    }
  });
}

async function postPayloadSafe(payload) {
  try {
    return await post(payload);
  } catch (error) {
    console.error("Website ingest failed:", error?.message || error);
    return { ok: false };
  }
}
