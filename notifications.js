// ms-villa-app / js/notifications.js
//
// Web Push wiring for the house app. Three moving parts work together:
//   1. This file (runs in the page) — asks for permission, subscribes the
//      browser via the service worker, and stores/removes the subscription
//      through the shared data function.
//   2. sw.js — receives the actual "push" events (even when the app/tab is
//      closed) and shows the OS notification.
//   3. netlify/functions/send-notification.js — the only thing that can
//      actually deliver a push message (it holds the VAPID private key).
//      This file just asks that function to send one.
//
// Depends on globals from database.js (sset/sget-style helpers aren't
// needed directly here — this talks to its own endpoints).

const PUSH_ENDPOINT = "/.netlify/functions/send-notification";
const VAPID_PUBLIC_KEY_ENDPOINT = "/.netlify/functions/send-notification?vapidPublicKey=1";

function urlBase64ToUint8Array(base64String){
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

function pushSupported(){
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function notificationsEnabled(){
  return pushSupported() && Notification.permission === "granted" && !!localStorage.getItem("ms-villa:push-subscribed");
}

function notificationStatusLabel(){
  if(!pushSupported()) return "Push notifications aren't supported on this browser/device.";
  if(Notification.permission === "denied") return "Notifications are blocked for this site in your browser settings.";
  return notificationsEnabled()
    ? "You'll get a notification for new meetings, complaints, and duty/expense changes."
    : "Turn these on to get notified about meetings, complaints, and duty/expense changes.";
}

// Called once on every app load — doesn't prompt, just re-syncs local state
// with the real permission/subscription so the Settings screen is accurate.
async function initNotifications(){
  if(!pushSupported()) return;
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(!sub) localStorage.removeItem("ms-villa:push-subscribed");
  }catch(e){ /* ignore — Settings will reflect whatever we can determine */ }
}

// Called right after a successful login. Friendly, easy to dismiss — never
// blocks the sign-in flow, and never nags someone who already said no.
async function askToEnableNotifications(){
  if(!pushSupported() || Notification.permission !== "default") return;
  if(localStorage.getItem("ms-villa:push-declined")) return;
  const want = confirm("Get notified about new meetings, complaints, and duty changes?");
  if(want){ await subscribeToPush(); }
  else { localStorage.setItem("ms-villa:push-declined", "1"); }
}

async function subscribeToPush(){
  if(!pushSupported()){ alert("Push notifications aren't supported on this browser/device."); return; }
  try{
    const permission = await Notification.requestPermission();
    if(permission !== "granted"){ return; }

    const keyRes = await fetch(VAPID_PUBLIC_KEY_ENDPOINT);
    const { publicKey } = await keyRes.json();

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }

    await fetch(PUSH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "subscribe",
        username: state.session ? state.session.username : null,
        subscription: sub
      })
    });
    localStorage.setItem("ms-villa:push-subscribed", "1");
    localStorage.removeItem("ms-villa:push-declined");
  }catch(e){ console.error("subscribeToPush failed:", e); }
}

async function unsubscribeFromPush(){
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(sub){
      await fetch(PUSH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unsubscribe", endpoint: sub.endpoint })
      });
      await sub.unsubscribe();
    }
  }catch(e){ console.error("unsubscribeFromPush failed:", e); }
  localStorage.removeItem("ms-villa:push-subscribed");
}

// Fire-and-forget: ask the backend to push a message to every subscribed
// resident (except, optionally, the person who triggered it). Never throws —
// a failed notification should never block the save that triggered it.
// Sends a push to every subscribed resident (except, optionally, the person
// who triggered it). Returns the server's result ({sent, failed, total} or
// {reason: "..."} if push isn't configured) so callers that want to show a
// real status can, but never throws — a failed notification should never
// block whatever save triggered it.
// opts.onlyUsernames: optional array of usernames — when set, the
// notification (both the in-app log entry and the OS push) only goes to
// those specific residents instead of the whole house.
async function notifyMembers(title, body, opts={}){
  const onlyUsernames = (opts.onlyUsernames && opts.onlyUsernames.length) ? opts.onlyUsernames : null;

  // Always record it in the shared in-app Notification Center first. This
  // is what guarantees every resident can see it (from the bell icon on
  // any screen) even on a device that never granted OS push permission,
  // or before VAPID keys are configured on the server — OS push below is
  // a bonus on top of this, not the only delivery path.
  try{ await appendNotificationLog(title, body, onlyUsernames); }
  catch(e){ console.error("appendNotificationLog failed (non-fatal):", e); }
  updateNotifBell();

  try{
    const res = await fetch(PUSH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send",
        title,
        body,
        onlyUsernames,
        // Explicit "excludeUsername" (including null, to mean "don't
        // exclude anyone" — used for admin announcements) always wins over
        // the default of excluding whoever is currently signed in.
        excludeUsername: ("excludeUsername" in opts) ? opts.excludeUsername : (state.session ? state.session.username : null)
      })
    });
    return await res.json().catch(()=>null);
  }catch(e){ console.error("notifyMembers failed (non-fatal):", e); return null; }
}

// Refreshes the little unread-count badge on the bell icon in the topbar,
// if one is currently rendered. Safe to call any time.
function updateNotifBell(){
  const badge = document.getElementById("notif-badge");
  if(!badge) return;
  const n = unreadNotifCount();
  if(n > 0){ badge.style.display = "flex"; badge.textContent = n > 9 ? "9+" : String(n); }
  else { badge.style.display = "none"; }
}
