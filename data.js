// netlify/functions/data.js
//
// A tiny shared key/value store used by js/database.js (sset/sget) so that
// every resident's phone reads and writes the same house data — the
// equivalent of the shared `window.storage` this app used when it ran as a
// Claude artifact. Backed by Netlify Blobs, which is provisioned
// automatically for any site on Netlify (no extra setup or database to
// stand up).
//
// This function is not in the original three-function sketch the app was
// planned around — it's added here because a real multi-device deployment
// needs *some* shared backend for the data itself, separate from push
// notifications. If you'd rather use a different database, this is the
// only file that needs to change; js/database.js just expects
// GET ?key=... -> { value } and POST { key, value } -> { ok: true }.
//
// GET  /.netlify/functions/data?key=ms-villa:members  -> { value: <any|null> }
// POST /.netlify/functions/data   { key, value }       -> { ok: true }

import { getStore } from "@netlify/blobs";

const STORE_NAME = "ms-villa-data";

// Max attempts to win the compare-and-swap race on `append`/`remove` before
// giving up. Each retry is just a re-read + re-write against the *current*
// server value, not the caller's stale copy, so it always converges quickly
// even if several people save at the same moment.
const CAS_RETRIES = 8;

export default async (req) => {
  const store = getStore(STORE_NAME);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const key = url.searchParams.get("key");
    if (!key) {
      return jsonResponse({ error: "Missing 'key' query parameter." }, 400);
    }
    const value = await store.get(key, { type: "json" }).catch(() => null);
    return jsonResponse({ value: value === undefined ? null : value });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return jsonResponse({ error: "Invalid JSON body." }, 400);
    }
    const { action } = body || {};

    // Batched read: the app used to open ~19 separate connections on every
    // load/refresh, each one a full network round trip to a serverless
    // function. That's what made the app *feel* slow to open and slow to
    // background-refresh. One request that returns every key at once turns
    // that into a single round trip.
    if (action === "batchGet") {
      const keys = Array.isArray(body.keys) ? body.keys : [];
      const values = {};
      await Promise.all(keys.map(async (key) => {
        values[key] = await store.get(key, { type: "json" }).catch(() => null);
      }));
      return jsonResponse({ values });
    }

    // Atomic append to a list stored under `key`, safe against two people
    // (or a background sync racing a live edit) saving at the same moment.
    // Previously every "add" read the whole array into the page, pushed one
    // item locally, and wrote the *entire* array back — if two saves landed
    // within the same ~6s window, whichever write happened second silently
    // overwrote the first person's new entry with no error shown. This does
    // a read-modify-write loop against the store's real current value (using
    // its ETag as a compare-and-swap guard) and retries the whole thing if
    // someone else's write won the race in between, so nothing is ever lost.
    if (action === "append") {
      const { key, item, idField } = body;
      if (!key || item === undefined) {
        return jsonResponse({ error: "Missing 'key' or 'item'." }, 400);
      }
      try {
        const list = await casUpdate(store, key, (current) => {
          const arr = Array.isArray(current) ? current.slice() : [];
          if (idField && item && item[idField] !== undefined) {
            const i = arr.findIndex((x) => x && x[idField] === item[idField]);
            if (i !== -1) { arr[i] = item; return arr; } // idempotent retry
          }
          arr.push(item);
          return arr;
        });
        return jsonResponse({ ok: true, value: list });
      } catch (e) {
        return jsonResponse({ error: "Failed to append: " + (e && e.message ? e.message : String(e)) }, 500);
      }
    }

    // Atomic removal by id from a list, same compare-and-swap safety as append.
    if (action === "remove") {
      const { key, idField, idValue } = body;
      if (!key || !idField) {
        return jsonResponse({ error: "Missing 'key' or 'idField'." }, 400);
      }
      try {
        const list = await casUpdate(store, key, (current) => {
          const arr = Array.isArray(current) ? current.slice() : [];
          return arr.filter((x) => !(x && x[idField] === idValue));
        });
        return jsonResponse({ ok: true, value: list });
      } catch (e) {
        return jsonResponse({ error: "Failed to remove: " + (e && e.message ? e.message : String(e)) }, 500);
      }
    }

    // Plain whole-value overwrite — still used for edits-in-place (renaming
    // a member, editing settings, etc.) where there's one clear "latest
    // version wins" author at a time.
    const { key, value } = body || {};
    if (!key) {
      return jsonResponse({ error: "Missing 'key' in request body." }, 400);
    }
    try {
      await store.setJSON(key, value === undefined ? null : value);
    } catch (e) {
      // Surface a clean JSON error instead of letting the function crash
      // with a generic 502 — the client (sset in database.js) checks
      // res.ok either way, but a real error body makes this diagnosable
      // in the Netlify function logs instead of looking like "it just
      // silently didn't save."
      return jsonResponse({ error: "Failed to save: " + (e && e.message ? e.message : String(e)) }, 500);
    }
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Method not allowed." }, 405);
};

// Compare-and-swap read-modify-write: reads the current value + its ETag,
// applies `mutate` to it, and writes back only `onlyIfMatch` that exact
// ETag. If someone else wrote in between, the write is rejected and we
// re-read the (now newer) value and try again — so the final result always
// reflects every successful append/remove, never just whichever request
// happened to land last.
async function casUpdate(store, key, mutate) {
  for (let attempt = 0; attempt < CAS_RETRIES; attempt++) {
    // "strong" consistency: read the value from the primary region instead
    // of a possibly-stale edge cache, so the ETag we compare against is
    // guaranteed to be the real current one.
    const entry = await store.getWithMetadata(key, { type: "json", consistency: "strong" }).catch(() => null);
    const current = entry ? entry.data : null;
    const etag = entry ? entry.etag : null;
    const next = mutate(current);
    const result = await store.set(key, JSON.stringify(next), {
      onlyIfMatch: etag || undefined
    });
    // `set` with onlyIfMatch resolves to { modified: boolean }. When the
    // blob didn't exist yet (etag is null/undefined), onlyIfMatch is
    // skipped and the write always succeeds.
    if (!etag || (result && result.modified !== false)) {
      return next;
    }
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 60));
  }
  throw new Error("Too many concurrent writers — please try again.");
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export const config = {
  path: "/.netlify/functions/data"
};
