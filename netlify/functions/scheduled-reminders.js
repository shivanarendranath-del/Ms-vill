// netlify/functions/scheduled-reminders.js
//
// Runs on a schedule (see the `config.schedule` cron below, and the
// matching entry in netlify.toml) rather than being called by the app.
// Each run:
//   1. Reads the same shared data the app itself reads/writes (via the
//      "ms-villa-data" Blobs store that netlify/functions/data.js uses).
//   2. Looks for meetings starting in the next ~30 minutes, and reminds
//      about today's cooking/vessel/water duty once in the morning.
//   3. Sends a push for anything it finds, using the same helper
//      send-notification.js uses, and remembers what it already sent
//      (in its own Blobs key) so nobody gets the same reminder twice.
//
// This file is one of the two Netlify Functions this project was
// originally scaffolded around — see netlify/functions/data.js for a note
// on why a third function (shared data storage) was added alongside it.

import { getStore } from "@netlify/blobs";
import { sendToAll } from "./lib/push-helpers.js";

const DATA_STORE = "ms-villa-data";
const REMINDER_LOG_STORE = "ms-villa-reminder-log";
const MEETING_WINDOW_MINUTES = 30;

async function readKey(key) {
  const store = getStore(DATA_STORE);
  return (await store.get(key, { type: "json" }).catch(() => null)) ?? null;
}

async function alreadySent(id) {
  const store = getStore(REMINDER_LOG_STORE);
  const sent = (await store.get("sent-ids", { type: "json" }).catch(() => null)) || [];
  return sent.includes(id);
}

async function markSent(id) {
  const store = getStore(REMINDER_LOG_STORE);
  const sent = (await store.get("sent-ids", { type: "json" }).catch(() => null)) || [];
  sent.push(id);
  // Keep the log from growing forever — a few hundred recent IDs is plenty.
  await store.setJSON("sent-ids", sent.slice(-500));
}

export default async () => {
  const results = [];
  const now = new Date();

  // --- Upcoming meetings -------------------------------------------------
  const meetings = (await readKey("ms-villa:meetings")) || [];
  for (const meeting of meetings) {
    if (!meeting.time) continue;
    const start = new Date(meeting.time);
    const minutesAway = (start.getTime() - now.getTime()) / 60000;
    if (minutesAway > 0 && minutesAway <= MEETING_WINDOW_MINUTES) {
      const reminderId = `meeting:${meeting.id}`;
      if (await alreadySent(reminderId)) continue;
      const r = await sendToAll({
        title: `Starting soon: ${meeting.title}`,
        body: `${meeting.platform || "Meeting"} in about ${Math.round(minutesAway)} min. Tap to join.`,
        data: { link: meeting.link }
      });
      await markSent(reminderId);
      results.push({ reminderId, ...r });
    }
  }

  // --- User-created reminders (Reminders screen in the app) --------------
  // Any resident can set one for a specific date/time, either for
  // themselves ("me") or the whole house ("all"). Fires once, within a
  // window wide enough that a 15-minute cron never misses it.
  const reminders = (await readKey("ms-villa:reminders")) || [];
  let remindersChanged = false;
  for (const reminder of reminders) {
    if (!reminder.time || reminder.sent) continue;
    const due = new Date(reminder.time).getTime();
    const minutesPast = (now.getTime() - due) / 60000;
    if (minutesPast >= 0 && minutesPast <= 20) {
      const reminderId = `reminder:${reminder.id}`;
      if (await alreadySent(reminderId)) continue;
      const onlyUsernames = reminder.target === "me" ? [reminder.by] : undefined;
      const r = await sendToAll({
        title: `Reminder: ${reminder.title}`,
        body: reminder.notes || "Tap to open Ms Villa.",
        onlyUsernames
      });
      await markSent(reminderId);
      reminder.sent = true;
      remindersChanged = true;
      results.push({ reminderId, ...r });
    }
  }
  // Best-effort write-back so the app's Reminders screen can show it as
  // fired — not CAS-guarded like the app's own saves, since this only ever
  // flips `sent` on entries a resident already created, never drops data.
  if (remindersChanged) {
    await getStore(DATA_STORE).setJSON("ms-villa:reminders", reminders).catch(() => {});
  }

  // --- Today's duty reminder (once, in the morning) -----------------------
  const todayKey = now.toISOString().slice(0, 10);
  const morningReminderId = `duty:${todayKey}`;
  const hourLocal = now.getUTCHours(); // adjust if the house isn't in UTC
  if (hourLocal === 8 && !(await alreadySent(morningReminderId))) {
    const weeklyVesselDuty = (await readKey("ms-villa:vessel-weekly")) || {};
    const vesselOverrides = (await readKey("ms-villa:vessel-overrides")) || {};
    const cookingStaff = (await readKey("ms-villa:cooking-staff")) || [];
    const cookingOverrides = (await readKey("ms-villa:cooking-overrides")) || {};

    const dayIndex = new Date(todayKey + "T00:00:00Z").getUTCDay();
    const vesselDuty = vesselOverrides[todayKey] || weeklyVesselDuty[dayIndex] || null;
    const cooking = (cookingOverrides[todayKey] && cookingOverrides[todayKey].length)
      ? cookingOverrides[todayKey]
      : cookingStaff;

    const bodyParts = [];
    if (vesselDuty) bodyParts.push(`Vessels: ${vesselDuty}`);
    if (cooking && cooking.length) bodyParts.push(`Cooking: ${cooking.join(", ")}`);

    if (bodyParts.length) {
      const r = await sendToAll({
        title: "Today's duty roster",
        body: bodyParts.join(" · ")
      });
      await markSent(morningReminderId);
      results.push({ reminderId: morningReminderId, ...r });
    }
  }

  return new Response(JSON.stringify({ ok: true, checkedAt: now.toISOString(), results }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

export const config = {
  schedule: "*/15 * * * *" // every 15 minutes — matches netlify.toml
};
