/**
 * View + like counter for bitsnbeyond.blog
 *
 * Two endpoints, both POST:
 *   POST /hit/<slug>    record a view, return { views, likes, liked }
 *   POST /like/<slug>   record a like, return { views, likes, liked }
 *
 * Privacy: no cookies, no raw IP stored. De-duplication uses a salted SHA-256
 * of the visitor's IP plus the slug, so the stored key cannot be reversed to an
 * address and cannot be correlated across posts.
 *
 * Consistency: Workers KV has no atomic increment, so two writes landing in the
 * same instant can lose one. At blog traffic that is noise; if it ever matters,
 * move the counters to a Durable Object.
 */

const ALLOWED_ORIGINS = [
  "https://www.bitsnbeyond.blog",
  "https://bitsnbeyond.blog",
  "http://localhost:4000", // jekyll serve
];

const VIEW_DEDUPE_TTL = 60 * 60 * 12; // one view per visitor per post per 12h

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "method not allowed" }, 405, cors);
    }

    const match = new URL(request.url).pathname.match(/^\/(hit|like)\/(.+)$/);
    if (!match) return json({ error: "not found" }, 404, cors);

    const action = match[1];
    const slug = sanitiseSlug(match[2]);
    if (!slug) return json({ error: "bad slug" }, 400, cors);

    const visitor = await visitorHash(request, env, slug);

    if (action === "hit") {
      const seenKey = `seen:${slug}:${visitor}`;
      if (!(await env.COUNTS.get(seenKey))) {
        await env.COUNTS.put(seenKey, "1", { expirationTtl: VIEW_DEDUPE_TTL });
        await bump(env, `views:${slug}`);
      }
    } else {
      const likedKey = `liked:${slug}:${visitor}`;
      if (!(await env.COUNTS.get(likedKey))) {
        await env.COUNTS.put(likedKey, "1"); // no TTL: one like per visitor, kept
        await bump(env, `likes:${slug}`);
      }
    }

    return json(await readCounts(env, slug, visitor), 200, cors);
  },
};

/* helpers ------------------------------------------------------------------ */

function sanitiseSlug(raw) {
  try {
    return decodeURIComponent(raw).replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 200);
  } catch {
    return "";
  }
}

async function visitorHash(request, env, slug) {
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const data = new TextEncoder().encode(`${ip}|${env.SALT}|${slug}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function bump(env, key) {
  const current = parseInt((await env.COUNTS.get(key)) || "0", 10);
  await env.COUNTS.put(key, String(current + 1));
}

async function readCounts(env, slug, visitor) {
  const [views, likes, liked] = await Promise.all([
    env.COUNTS.get(`views:${slug}`),
    env.COUNTS.get(`likes:${slug}`),
    env.COUNTS.get(`liked:${slug}:${visitor}`),
  ]);
  return {
    views: parseInt(views || "0", 10),
    likes: parseInt(likes || "0", 10),
    liked: Boolean(liked),
  };
}

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors },
  });
}
