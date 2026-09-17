
// netlify/functions/lib/push-helpers.js
//
// Shared Web Push helpers used by both send-notification.js (on-demand
// pushes triggered from the app) and scheduled-reminders.js (the cron
// job). Subscriptions are stored in the same Netlify Blobs store that
// data.js uses for everything else, under one key holding an array.
//
// Requires these environment variables (Netlify Site settings ->
// Environment variables), generated once with `npx web-push generate-vapid-keys`:
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT (optional — e.g. "mailto:you@example.com")
//
// Until VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are set, vapidConfigured()
// returns false and send-notification.js no-ops safely instead of
// crashing the app.

import { getStore } from "@netlify/blobs";
import webpush from "web-push";

const DATA_STORE = "ms-villa-data";
// Each subscription now lives under its own key (ms-villa:push-sub:<hash>)
// instead of one shared array. The old design read the whole array,
// modified it, and wrote it back — when two residents subscribed within
// the same second (e.g. right after an announcement asking everyone to
// turn notifications on), the second write could silently clobber the
// first resident's entry, which is the most likely reason pushes weren't
// reaching "others". Per-subscription keys make each save independent, so
// concurrent subscribes can no longer stomp on each other.
const SUB_KEY_PREFIX = "ms-villa:push-sub:";

function store() {
  return getStore(DATA_STORE);
}

export function vapidConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configureWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Deterministic, filesystem/URL-safe key for an endpoint, without needing
// a crypto import — good enough since we only need it to not collide.
function keyForEndpoint(endpoint) {
  let hash = 0;
  for (let i = 0; i < endpoint.length; i++) {
    hash = (Math.imul(31, hash) + endpoint.charCodeAt(i)) | 0;
  }
  return SUB_KEY_PREFIX + Math.abs(hash).toString(36) + "_" + endpoint.length;
}

async function readSubscriptions() {
  const results = [];
  const s = store();
  let cursor;
  do {
    const page = await s.list({ prefix: SUB_KEY_PREFIX, cursor });
    for (const { key } of page.blobs) {
      const entry = await s.get(key, { type: "json" }).catch(() => null);
      if (entry) results.push(entry);
    }
    cursor = page.cursor;
  } while (cursor);
  return results;
}

// Saves (or updates) a subscription for a given username. Keyed by
// endpoint so re-subscribing on the same device/browser doesn't create
// duplicates, and so one resident's subscribe can never overwrite another's.
export async function saveSubscription(username, subscription) {
  if (!subscription || !subscription.endpoint) return;
  await store().setJSON(keyForEndpoint(subscription.endpoint), {
    username: username || null,
    subscription,
    savedAt: new Date().toISOString()
  });
}

export async function removeSubscription(endpoint) {
  if (!endpoint) return;
  await store().delete(keyForEndpoint(endpoint)).catch(() => {});
}

// Sends a push to every stored subscription (optionally skipping one
// username — typically the person who triggered the action). Prunes
// subscriptions that the push service reports as gone (410/404), which
// happens when someone uninstalls the PWA or clears site data.
export async function sendToAll({ title, body, data, excludeUsername, onlyUsernames }) {
  if (!vapidConfigured()) {
    return { sent: 0, failed: 0, reason: "VAPID keys not configured." };
  }
  configureWebPush();

  const list = await readSubscriptions();
  const onlySet = (Array.isArray(onlyUsernames) && onlyUsernames.length) ? new Set(onlyUsernames) : null;
  const targets = list.filter((s) => {
    if (onlySet && !onlySet.has(s.username)) return false;
    if (excludeUsername && s.username === excludeUsername) return false;
    return true;
  });

  const payload = JSON.stringify({ title, body, data: data || {} });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    targets.map(async (entry) => {
      try {
        await webpush.sendNotification(entry.subscription, payload);
        sent++;
      } catch (err) {
        failed++;
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Stale (uninstalled PWA / cleared site data) — remove just this
          // one key, which is independent of every other resident's entry.
          await removeSubscription(entry.subscription.endpoint).catch(() => {});
        }
      }
    })
  );

  return { sent, failed, total: targets.length };
}
