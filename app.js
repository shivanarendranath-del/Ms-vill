// ms-villa-app / js/app.js
//
// Core render engine (view router, back-button history handling), the
// "Chat with us" WhatsApp FAB, and every non-admin, non-auth screen: home,
// a room's attendance sheet, house instructions, duty roster, room
// expenses/ledger, rent info, complaints, and meetings. Also owns the
// generic [data-nav] click delegation, the periodic background sync
// against the shared data store, and app startup (init).
//
// Depends on globals from database.js (state, $, app, ICONS, IMAGES,
// helpers, storage functions) and calls into auth.js / admin.js /
// notifications.js for screens and actions those files own.

let lastPushedView = null;
function render(){
  // History integration so the device/browser back button and iOS swipe-back
  // navigate within the app instead of leaving it or doing nothing.
  if(state.view !== lastPushedView){
    try{
      history.pushState({view: state.view, roomId: state.roomId}, "", "#"+state.view);
    }catch(e){}
    lastPushedView = state.view;
  }
  saveViewState();
  renderView();
  renderChatFab();
}

// Remembers which screen the person was on so a page refresh (or reopening
// the PWA) lands back where they were instead of bouncing to Login. Only
// meaningful alongside "keep me logged in" — if there's no remembered
// session, init() always shows Login regardless of what's saved here.
const LAST_VIEW_KEY = "ms-villa:last-view";
function saveViewState(){
  try{
    if(state.view==="login" || state.view==="phoneLogin"){ localStorage.removeItem(LAST_VIEW_KEY); return; }
    localStorage.setItem(LAST_VIEW_KEY, JSON.stringify({ view: state.view, roomId: state.roomId }));
  }catch(e){}
}
function getSavedViewState(){
  try{
    const v = localStorage.getItem(LAST_VIEW_KEY);
    return v ? JSON.parse(v) : null;
  }catch(e){ return null; }
}

window.addEventListener("popstate", (e)=>{
  if(e.state && e.state.view){
    state.view = e.state.view;
    if(e.state.roomId) state.roomId = e.state.roomId;
  } else {
    state.view = state.session ? "home" : "login";
  }
  lastPushedView = state.view;
  saveViewState();
  renderView();
  renderChatFab();
});

function renderView(){
  if(state.view==="login") return renderLogin();
  if(state.view==="phoneLogin") return renderPhoneLogin();
  if(state.view==="home") return renderHome();
  if(state.view==="room") return renderRoom();
  if(state.view==="instructions") return renderInstructions();
  if(state.view==="settings") return renderSettings();
  if(state.view==="transactions") return renderTransactionsAdmin();
  if(state.view==="changepass") return renderChangePass();
  if(state.view==="duty") return renderDuty();
  if(state.view==="expenses") return renderExpenses();
  if(state.view==="dailyExpenses") return renderDailyExpenses();
  if(state.view==="rent") return renderRent();
  if(state.view==="complaints") return renderComplaints();
  if(state.view==="meetings") return renderMeetings();
  if(state.view==="roommates") return renderRoommates();
  if(state.view==="gallery") return renderGallery();
  if(state.view==="notifications") return renderNotifications();
  if(state.view==="reminders") return renderReminders();
  if(state.view==="chat") return renderChat();
}

// In-app Notification Center — every announcement, meeting, complaint, or
// duty/expense change ever sent, so residents can always see what they
// missed here even if OS push notifications were off, blocked, or not yet
// configured on the server (see notifications.js / push-helpers.js).
async function renderNotifications(){
  markNotificationsSeen();
  const list = notificationsForMe().slice().reverse();
  const rows = list.map(n=>`
    <div class="complaint-card">
      <div class="top"><div class="cat">${n.title}</div>${n.to ? `<span class="status-pill status-pending">Just for you</span>` : ""}</div>
      <div class="desc">${n.body||""}</div>
      <div class="meta">${n.by ? nameFor(n.by, state.members) + " · " : ""}${new Date(n.createdAt).toLocaleString("en-IN")}</div>
    </div>
  `).join("") || `<div class="foot-note" style="padding:20px 0;">No notifications yet.</div>`;
  app.innerHTML = `
    ${topbar("Notifications","home")}
    ${heroWrap("living", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Notifications</h1>
        <div class="sub">Everything sent to the house</div>
      </div>
    `)}
    ${rows}
  `;
  updateNotifBell();
}

// Floating "Chat with us" button - shown on every screen once signed in,
// except the House Chat screen itself, where it would just float on top of
// the in-app chat's own input bar and read as a confusing second "chat"
// affordance right next to the real one.
function renderChatFab(){
  let fab = document.getElementById("chat-fab");
  if(!state.session || state.view === "chat"){ if(fab) fab.remove(); return; }
  if(!fab){
    fab = document.createElement("button");
    fab.id = "chat-fab";
    fab.className = "chat-fab";
    fab.title = "Chat with us";
    fab.innerHTML = ICONS.chat;
    document.body.appendChild(fab);
  }
  fab.onclick = ()=>{
    const num = (state.supportPhone||"").replace(/[^0-9]/g,"");
    if(num){
      window.open(`https://wa.me/${num}?text=${encodeURIComponent("Hi, I need help with Ms Villa.")}`, "_blank");
    } else {
      alert("No support WhatsApp number has been set yet. An admin can add one from Settings.");
    }
  };
}


function topbar(title, backView){
  const me = state.members.find(m=>m.username===state.session.username);
  const unread = unreadNotifCount();
  return `
    <div class="topbar">
      <div class="back" data-nav="${backView}" style="cursor:pointer;">${backView? "&larr; Back" : ""}</div>
      <div style="display:flex; align-items:center; gap:14px;">
        <div class="who">Signed in as<br><b>${me.name}</b></div>
        <div id="topbar-refresh" style="cursor:pointer; color:#fff; display:flex; align-items:center;" title="Refresh">
          <svg id="refresh-icon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" style="transition:transform .5s linear;"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
        </div>
        <div id="notif-bell" style="position:relative; cursor:pointer; color:#fff;" title="Notifications">
          ${ICONS.bell || `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`}
          <span id="notif-badge" style="display:${unread>0?'flex':'none'}; position:absolute; top:-6px; right:-8px; background:var(--accent); color:#16273F; font-size:10px; font-weight:800; min-width:16px; height:16px; border-radius:9px; align-items:center; justify-content:center; padding:0 4px;">${unread>9?'9+':unread}</span>
        </div>
      </div>
    </div>
  `;
}

// Manual "pull to refresh" equivalent — spins the topbar icon while a
// refresh is in flight, and if it's taking unusually long (slow/flaky
// connection) swaps in a note plus a hard-retry option instead of leaving
// the icon spinning forever with no feedback.
let manualRefreshing = false;
async function handleManualRefresh(){
  if(manualRefreshing) return;
  manualRefreshing = true;
  const icon = document.getElementById("refresh-icon");
  if(icon) icon.style.animation = "ms-spin 0.9s linear infinite";

  let slowNote = null;
  const slowTimer = setTimeout(()=>{
    slowNote = document.createElement("div");
    slowNote.id = "refresh-slow-note";
    slowNote.style.cssText = "position:fixed; top:56px; left:50%; transform:translateX(-50%); background:var(--panel); border:1px solid var(--line); color:var(--muted); font-size:11.5px; padding:8px 14px; border-radius:20px; z-index:80; backdrop-filter:blur(10px);";
    slowNote.textContent = "Still refreshing — check your connection…";
    document.body.appendChild(slowNote);
  }, 4000);

  try{
    await syncNow(true);
  } finally {
    clearTimeout(slowTimer);
    if(slowNote) slowNote.remove();
    if(icon) icon.style.animation = "";
    manualRefreshing = false;
  }
}

function renderHome(){
  const duty = vesselDutyFor(todayKey());
  const dutyName = duty ? nameFor(duty, state.members) : "Unassigned";
  const tiles = state.rooms.map(r=>`
    <div class="room-tile" data-room="${r.id}" style="cursor:pointer;">
      ${ICONS[r.id]||""}
      <div class="name">${r.name}</div>
      <div class="count">${r.assigned.length} assigned</div>
    </div>
  `).join("");
  const quickLinks = [
    {id:"duty", name:"Duty Schedule"},
    {id:"expenses", name:"Room Expenses"},
    {id:"dailyExpenses", name:"Daily Expenses"},
    {id:"rent", name:"Rent & Pay"},
    {id:"complaints", name:"Complaints"},
    {id:"meetings", name:"Meetings"},
    {id:"reminders", name:"Reminders"},
    {id:"roommates", name:"Roommates"},
    {id:"gallery", name:"Photos"},
    {id:"chat", name:"House Chat"}
  ];
  const quickTiles = quickLinks.map(q=>`
    <div class="quick-tile" data-nav2="${q.id}">${ICONS[q.id]}<div class="name">${q.name}</div></div>
  `).join("");

  const myRow = ledgerRowFor(state.session.username);
  let duesBlock;
  if(myRow){
    const balance = myRow.due - myRow.paid;
    const isDue = balance > 0;
    const isCredit = balance < 0;
    const pillClass = isDue ? "status-open" : "status-closed";
    const pillText = isDue ? "Due" : (isCredit ? "Credit" : "Completed");
    const amountText = isDue ? inr(balance) : (isCredit ? inr(Math.abs(balance)) : inr(0));
    duesBlock = `
      <div class="card dues-card">
        <div class="dues-top">
          <div class="dues-label">${state.ledger.month} Rent — ${myRow.name}</div>
          <span class="status-pill ${pillClass}">${pillText}</span>
        </div>
        <div class="dues-amount">${amountText}</div>
        <div class="dues-note">${myRow.status}</div>
        <button class="btn-primary" data-nav2="rent" style="margin-top:12px;">Pay Now</button>
      </div>
    `;
  } else {
    duesBlock = `
      <div class="card dues-card">
        <div class="dues-label">${state.ledger.month} Rent</div>
        <div class="dues-note" style="margin-top:6px;">No ledger entry found under your name yet — check with the admin.</div>
      </div>
    `;
  }

  app.innerHTML = `
    ${topbar("Ms Villa", null)}
    ${heroWrap("kitchen", `
      <div class="house-title">
        <h1>Ms Villa</h1>
        <div class="sub">Household Duties &amp; Attendance</div>
      </div>
    `)}
    <div class="duty-strip">
      <div class="lbl">Today's Vessel Cleaning Duty</div>
      <div class="name">${dutyName}</div>
      <div class="sub2">Cooking: ${cookingStaffFor(todayKey()).join(" & ")} · Water can: ${nameFor(state.waterDuty, state.members)}</div>
    </div>
    <div class="section-title">Payment Dues</div>
    ${duesBlock}
    <div class="section-title">Rooms</div>
    <div class="grid">${tiles}</div>
    <div class="section-title">Quick Links</div>
    <div class="grid">${quickTiles}</div>
    <div class="nav-row" style="margin-top:8px;">
      <button class="btn-line" data-nav2="instructions">House Rules</button>
      <button class="btn-line" data-nav2="settings">Settings</button>
    </div>
  `;
  app.querySelectorAll("[data-room]").forEach(el=>{
    el.onclick = ()=>{ state.roomId = el.getAttribute("data-room"); state.view="room"; render(); };
  });
  const nav2 = app.querySelectorAll("[data-nav2]");
  nav2.forEach(el=> el.onclick = ()=>{ state.view = el.getAttribute("data-nav2"); render(); });
}


async function renderRoom(){
  const room = state.rooms.find(r=>r.id===state.roomId);
  const date = todayKey();

  const rows = room.assigned.map(username=>{
    const m = state.members.find(x=>x.username===username) || {name:username};
    const photo = m.photoId ? state.photoCache[m.photoId] : null;
    return `
      <div class="member-row">
        <div class="left">
          ${photo ? `<img class="avatar" loading="lazy" src="${photo}">` : `<div class="avatar-empty">${(m.name||"?")[0]}</div>`}
          <div>
            <div class="name">${m.name}</div>
          </div>
        </div>
      </div>
    `;
  }).join("") || `<div class="foot-note" style="padding:20px 0;">No one assigned to this room yet. Add members from the button below.</div>`;

  app.innerHTML = `
    ${topbar(room.name,"home")}
    ${heroWrap(imageForRoom(room.id), `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">${room.name}</h1>
        <div class="sub">${date}</div>
      </div>
    `)}
    <div class="info-block"><div class="lbl">About this room</div>${ROOM_NOTES[room.id]||""}</div>
    <div class="section-title">Assigned Members</div>
    <div class="card" style="padding:6px 18px;">
      ${rows}
    </div>
    ${(state.members.find(m=>m.username===state.session.username)||{}).admin ? `
    <div class="nav-row">
      <button class="btn-line" id="edit-assign">Edit Assignment</button>
    </div>
    ` : ""}
  `;

  const editAssignBtn = $("#edit-assign");
  if(editAssignBtn) editAssignBtn.onclick = ()=> openAssignModal(room);
}

function openAssignModal(room){
  const chips = state.members.map(m=>{
    const on = room.assigned.includes(m.username);
    return `<div class="chip ${on?'on':''}" data-chip="${m.username}">${m.name}</div>`;
  }).join("");
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  wrap.innerHTML = `
    <div class="modal">
      <h3>Assign — ${room.name}</h3>
      <div class="chip-select">${chips}</div>
      <button class="btn-primary" id="save-assign">Save</button>
      <button class="btn-ghost" id="cancel-assign">Cancel</button>
    </div>
  `;
  document.body.appendChild(wrap);
  let selected = new Set(room.assigned);
  wrap.querySelectorAll("[data-chip]").forEach(chip=>{
    chip.onclick = ()=>{
      const u = chip.getAttribute("data-chip");
      if(selected.has(u)){ selected.delete(u); chip.classList.remove("on"); }
      else { selected.add(u); chip.classList.add("on"); }
    };
  });
  wrap.querySelector("#cancel-assign").onclick = ()=> wrap.remove();
  wrap.querySelector("#save-assign").onclick = async ()=>{
    room.assigned = Array.from(selected);
    await sset("ms-villa:rooms", state.rooms);
    wrap.remove();
    renderRoom();
  };
}


function renderInstructions(){
  const items = INSTRUCTIONS.map(t=>`<li>${t}</li>`).join("");
  app.innerHTML = `
    ${topbar("House Rules","home")}
    ${heroWrap("kitchen", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">House Rules</h1>
        <div class="sub">General Cleaning &amp; Maintenance</div>
      </div>
    `)}
    <div class="instr-list"><ol>${items}</ol></div>
    <div class="instr-note">Cleanliness is everyone's responsibility. Please complete your assigned duty on time and maintain the common areas as if they were your own.</div>
  `;
}

async function renderDuty(){
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const todayDow = new Date().getDay();
  const today = todayKey();
  const hasVesselOverride = !!state.vesselOverrides[today];
  const hasCookingOverride = !!(state.cookingOverrides[today] && state.cookingOverrides[today].length);
  const rows = dayNames.map((dn, i)=>{
    const isToday = i===todayDow;
    const uname = isToday ? vesselDutyFor(today) : state.weeklyVesselDuty[i];
    const who = uname ? nameFor(uname, state.members) : "—";
    return `<div class="weekday-row ${isToday?'today':''}"><div class="day">${dn}</div><div class="who">${who}${isToday && hasVesselOverride ? ' (override)' : ''}</div></div>`;
  }).join("");
  const overrideNote = (hasVesselOverride || hasCookingOverride)
    ? `<div class="instr-note">An admin has set a today-only override for ${[hasVesselOverride?'vessel duty':null, hasCookingOverride?'cooking staff':null].filter(Boolean).join(" and ")}. The weekly schedule below is unaffected.</div>`
    : "";

  const todayProof = state.vesselProofs[today];
  if(todayProof && todayProof.photoId) await preloadPhotos([todayProof.photoId]);
  const proofPhoto = todayProof && todayProof.photoId ? state.photoCache[todayProof.photoId] : null;
  const proofCard = `
    <div class="section-title">Today's Cleaning Proof</div>
    <div class="card">
      ${todayProof ? `
        <div class="member-row" style="border-bottom:none; padding-bottom:0;">
          <div class="left">
            ${proofPhoto ? `<img class="avatar" src="${proofPhoto}" data-view-proof style="cursor:pointer; width:44px; height:44px;">` : `<div class="avatar-empty">✓</div>`}
            <div>
              <div class="name">Done by ${nameFor(todayProof.username, state.members)}</div>
              <div class="tag">${new Date(todayProof.time).toLocaleTimeString("en-IN",{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          </div>
          <span class="status-pill status-present">Cleaned</span>
        </div>
        <input type="file" accept="image/*" id="vessel-proof-file" style="display:none;">
        <button class="btn-ghost" id="vessel-proof-btn" style="margin-top:12px;">Replace Photo</button>
      ` : `
        <div class="foot-note" style="margin:0 0 12px; text-align:left;">Snap a quick photo once the vessels are cleaned today, as proof for the house.</div>
        <input type="file" accept="image/*" id="vessel-proof-file" style="display:none;">
        <button class="btn-primary" id="vessel-proof-btn" style="width:100%;">Upload Cleaning Photo</button>
      `}
      <div class="error" id="vessel-proof-err" style="display:none; margin-top:10px;"></div>
    </div>
  `;

  app.innerHTML = `
    ${topbar("Duty Schedule","home")}
    ${heroWrap("bedroomA", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Weekly Vessel Duty</h1>
        <div class="sub">Clean vessels on your day, before 12 PM</div>
      </div>
    `)}
    <div class="card" style="padding:6px 18px;">${rows}</div>
    ${overrideNote}
    ${proofCard}
    <div class="section-title">Also Assigned (Default)</div>
    <div class="card">
      <div class="member-row"><div class="name">Cooking (today)</div><div class="tag">${cookingStaffFor(today).join(" & ")}</div></div>
      <div class="member-row"><div class="name">Water Can Refill</div><div class="tag">${nameFor(state.waterDuty, state.members)}</div></div>
    </div>
    <div class="instr-note">Every individual must clean the vessels on their assigned day itself, before 12 PM — or the next person's duty is affected.</div>
    ${(state.members.find(m=>m.username===state.session.username)||{}).admin ? `<div class="nav-row"><button class="btn-line" id="edit-duty" style="flex:1;">Edit Duty Assignments</button></div>` : ""}
  `;
  const editBtn = $("#edit-duty");
  if(editBtn) editBtn.onclick = ()=> openEditDutyModal();

  const proofBtn = $("#vessel-proof-btn");
  const proofFile = $("#vessel-proof-file");
  if(proofBtn && proofFile){
    proofBtn.onclick = ()=> proofFile.click();
    proofFile.onchange = async ()=>{
      const f = proofFile.files[0];
      if(!f) return;
      const err = $("#vessel-proof-err");
      err.style.display = "none";
      proofBtn.disabled = true; proofBtn.textContent = "Uploading...";
      try{
        const photoData = await readAndCompressImage(f);
        const photoId = `vesselproof_${today}_${Date.now()}`;
        const photoOk = await savePhoto(photoId, photoData);
        if(!photoOk){
          err.style.display = "block"; err.textContent = "Couldn't upload — check your connection and try again.";
          proofBtn.disabled = false; proofBtn.textContent = todayProof ? "Replace Photo" : "Upload Cleaning Photo";
          return;
        }
        state.photoCache[photoId] = photoData;
        const entry = { username: state.session.username, photoId, time: new Date().toISOString() };
        const ok = await saveVesselProof(today, entry);
        if(!ok){ err.style.display = "block"; err.textContent = "Couldn't save — check your connection and try again."; }
        else notifyMembers("Vessels cleaned", `${nameFor(state.session.username, state.members)} uploaded today's cleaning proof photo.`);
      }catch(e){
        err.style.display = "block"; err.textContent = "That photo couldn't be processed. Try a different one.";
      }
      renderDuty();
    };
  }
  const proofImg = app.querySelector("[data-view-proof]");
  if(proofImg) proofImg.onclick = ()=> openPhotoLightbox(proofPhoto);
}

function renderExpenses(){
  const me = state.members.find(m=>m.username===state.session.username);
  const ledger = state.ledger;
  const todaysMenu = state.foodMenu || "Not set yet";
  const rows = ledger.rows.map(r=>`
    <tr>
      <td>${r.name}</td>
      <td class="num">${inr(r.due)}</td>
      <td class="num">${inr(r.paid)}</td>
      <td class="num">${inr(r.split||0)}</td>
      <td style="font-size:11px; color:var(--muted);">${todaysMenu}</td>
      <td style="font-size:11px; color:var(--muted);">${r.status}</td>
    </tr>
  `).join("");
  const bills = ledger.bills.map(b=>`
    <div class="member-row"><div class="name">${b.label}</div><div class="tag">${inr(b.amount)}</div></div>
  `).join("");
  const totalDue = ledger.rows.reduce((s,r)=> s + Math.max(0, r.due - r.paid), 0);

  const counts = foodPollCounts();
  const myVote = myFoodVote();
  const yesPct = counts.total ? Math.round((counts.yes/counts.total)*100) : 0;
  const noPct = counts.total ? 100 - yesPct : 0;

  app.innerHTML = `
    ${topbar("Room Expenses","home")}
    ${heroWrap("kitchen", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Room Expenses</h1>
        <div class="sub">${ledger.month} Ledger</div>
      </div>
    `)}
    <div class="section-title">Payment Dues</div>
    <div class="card dues-card">
      <div class="dues-top">
        <div class="dues-label">Total Outstanding</div>
      </div>
      <div class="dues-amount">${inr(totalDue)}</div>
      <div class="dues-note">Across ${ledger.rows.filter(r=> r.due - r.paid > 0).length} member(s) with a pending balance this month.</div>
    </div>
    <div class="card" style="padding:14px 12px; overflow-x:auto;">
      <table class="ledger-table">
        <tr><th>Member</th><th>Due</th><th>Paid</th><th>Split Expenses</th><th>Food</th><th>Status</th></tr>
        ${rows}
      </table>
    </div>
    <div class="section-title">Shared Bills</div>
    <div class="card">
      ${bills}
      <div class="ledger-total"><span>Total Bills${ledger.totalBillsAuto ? ' <span style="font-weight:400; color:var(--muted); font-size:11px;">(auto)</span>' : ''}</span><b>${inr(effectiveTotalBills(ledger))}</b></div>
      <div class="ledger-total"><span>Split Expenses Total</span><b>${inr(sumSplitExpenses(ledger))}</b></div>
      <div class="ledger-total"><span>Remaining Balance${ledger.remainingAuto ? ' <span style="font-weight:400; color:var(--muted); font-size:11px;">(auto)</span>' : ''}</span><b>${inr(effectiveRemaining(ledger))}</b></div>
    </div>
    <div class="instr-note">${ledger.remainingNote}. Figures are transcribed from the handwritten monthly ledger — confirm with the admin if any amount looks unclear.</div>
    ${me.admin ? `<div class="nav-row"><button class="btn-line" id="edit-expenses" style="flex:1;">Edit Room Expenses</button></div>` : ""}

    <div class="section-title">Food — Today's Menu</div>
    <div class="card">
      <div class="foot-note" style="margin:0 0 10px; text-align:left; font-size:13px; color:var(--ink);">${todaysMenu}</div>
      ${me.admin ? `<button class="btn-line" id="edit-food-menu" style="width:100%;">Edit Today's Menu</button>` : ""}
    </div>

    <div class="section-title">Food Poll — Everyone Can Vote</div>
    <div class="card">
      <div class="foot-note" style="margin:0 0 12px; text-align:left; font-size:13px; color:var(--ink); font-weight:700;">${state.foodPoll.question}</div>
      <div style="display:flex; gap:10px; margin-bottom:12px;">
        <button class="btn-line" id="food-vote-yes" style="flex:1; ${myVote==='yes' ? 'background:var(--accent); color:#16273F;' : ''}">Yes ${myVote==='yes' ? '✓' : ''}</button>
        <button class="btn-line" id="food-vote-no" style="flex:1; ${myVote==='no' ? 'background:var(--accent); color:#16273F;' : ''}">No ${myVote==='no' ? '✓' : ''}</button>
      </div>
      <div class="member-row"><div class="name">Yes</div><div class="tag">${counts.yes} (${yesPct}%)</div></div>
      <div class="member-row"><div class="name">No</div><div class="tag">${counts.no} (${noPct}%)</div></div>
      <div class="foot-note" style="margin:8px 0 0; text-align:left;">${counts.total} of ${state.members.length} member(s) have voted so far.</div>
      ${me.admin ? `<button class="btn-primary" id="notify-food-poll" style="margin-top:12px;">Notify Everyone About This Poll</button>` : ""}
    </div>
  `;
  const editBtn = $("#edit-expenses");
  if(editBtn) editBtn.onclick = ()=> openEditExpensesModal();

  const editMenuBtn = $("#edit-food-menu");
  if(editMenuBtn) editMenuBtn.onclick = ()=> openEditFoodMenuModal();

  const voteYes = $("#food-vote-yes");
  if(voteYes) voteYes.onclick = ()=> castFoodVote("yes");
  const voteNo = $("#food-vote-no");
  if(voteNo) voteNo.onclick = ()=> castFoodVote("no");

  const notifyBtn = $("#notify-food-poll");
  if(notifyBtn) notifyBtn.onclick = async ()=>{
    notifyBtn.disabled = true;
    notifyBtn.textContent = "Sending...";
    await notifyMembers(
      "Food Poll — vote now",
      `${state.foodPoll.question} Open Room Expenses to cast your vote.`,
      { excludeUsername: null }
    );
    notifyBtn.disabled = false;
    notifyBtn.textContent = "Notify Everyone About This Poll";
  };
}

// Any signed-in member can vote (and change their vote) on the daily-food
// poll — one vote per username, stored under state.foodPoll.votes.
async function castFoodVote(choice){
  const me = state.session ? state.session.username : null;
  if(!me) return;
  if(!state.foodPoll.votes) state.foodPoll.votes = {};
  state.foodPoll.votes[me] = choice;
  await sset("ms-villa:food-poll", state.foodPoll);
  renderExpenses();
}

// Admin-only: edit the "Today's Menu" text shown in the Food column/card.
function openEditFoodMenuModal(){
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  wrap.innerHTML = `
    <div class="modal">
      <h3>Edit Today's Menu</h3>
      <label>Today's Menu</label>
      <textarea id="food-menu-input" placeholder="e.g. Rice, Sambar, Egg Curry">${state.foodMenu||""}</textarea>
      <div class="error" id="food-menu-err" style="display:none;"></div>
      <button class="btn-primary" id="food-menu-save" style="margin-top:14px;">Save Menu</button>
      <button class="btn-ghost" id="food-menu-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.querySelector("#food-menu-cancel").onclick = ()=> wrap.remove();
  wrap.querySelector("#food-menu-save").onclick = async ()=>{
    const val = wrap.querySelector("#food-menu-input").value.trim();
    state.foodMenu = val;
    const ok = await sset("ms-villa:food-menu", state.foodMenu);
    if(!ok){
      const err = wrap.querySelector("#food-menu-err");
      err.style.display = "block"; err.textContent = "Couldn't save — check your connection and try again.";
      return;
    }
    wrap.remove();
    renderExpenses();
    notifyMembers("Today's menu updated", state.foodMenu || "The food menu was cleared.");
  };
}

// Day-wise spending log, separate from the monthly Room Expenses ledger
// above. Anyone in the house (not just the admin) can add or edit an
// entry here — it's meant as a shared running log of day-to-day
// household spending (groceries, gas, quick repairs, etc.), grouped by
// the date each entry was logged under.
// Returns each member's net balance from the "split expenses" feature:
// positive = the house owes them money (they paid more than their share),
// negative = they owe the house. An entry with no splitAmong (added before
// this feature, or left as "everyone") is split across every current member.
function computeSplitBalances(entries, members){
  const paid = {}, owed = {};
  members.forEach(m=>{ paid[m.username]=0; owed[m.username]=0; });
  entries.forEach(e=>{
    const amt = Number(e.amount)||0;
    if(e.addedBy && paid[e.addedBy]!==undefined) paid[e.addedBy]+=amt;
    const group = (e.splitAmong && e.splitAmong.length) ? e.splitAmong : members.map(m=>m.username);
    const share = amt / group.length;
    group.forEach(u=>{ if(owed[u]!==undefined) owed[u]+=share; });
  });
  return members.map(m=>({ username:m.username, name:m.name, balance: Math.round((paid[m.username]-owed[m.username])*100)/100 }));
}

// Which calendar month is showing ("YYYY-MM") and which single day (if any)
// is picked, so tapping a date filters the log to just that day's spending.
// Transient UI state — deliberately not persisted or synced.
if(!state.expenseCalMonth) state.expenseCalMonth = todayKey().slice(0,7);

function renderExpenseCalendar(list){
  const [y,m] = state.expenseCalMonth.split("-").map(Number);
  const first = new Date(y, m-1, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const spentDays = {};
  list.forEach(e=>{ if((e.date||"").slice(0,7)===state.expenseCalMonth){ spentDays[e.date] = (spentDays[e.date]||0) + (Number(e.amount)||0); } });
  const monthLabel = first.toLocaleDateString("en-IN", { month:"long", year:"numeric" });

  let cells = "";
  for(let i=0;i<startDow;i++) cells += `<div></div>`;
  for(let d=1; d<=daysInMonth; d++){
    const dateStr = `${state.expenseCalMonth}-${String(d).padStart(2,"0")}`;
    const has = spentDays[dateStr] !== undefined;
    const isToday = dateStr === todayKey();
    const isSelected = state.selectedExpenseDate === dateStr;
    cells += `
      <div data-cal-day="${dateStr}" style="cursor:pointer; text-align:center; padding:6px 0; border-radius:8px;
        background:${isSelected ? 'var(--accent)' : (has ? 'var(--panel-2)' : 'transparent')};
        color:${isSelected ? '#16273F' : 'var(--ink)'};
        border:${isToday && !isSelected ? '1px solid var(--accent)' : '1px solid transparent'};
        font-size:12.5px; font-weight:${has?'800':'600'};">
        ${d}${has ? `<div style="width:4px; height:4px; border-radius:50%; background:${isSelected?'#16273F':'var(--accent)'}; margin:2px auto 0;"></div>` : ""}
      </div>
    `;
  }
  const weekdayHead = ["S","M","T","W","T","F","S"].map(w=>`<div style="text-align:center; font-size:10px; color:var(--muted); font-weight:700;">${w}</div>`).join("");

  return `
    <div class="card" style="padding:16px 14px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
        <span data-cal-prev style="cursor:pointer; padding:4px 10px; color:var(--accent); font-weight:800;">&larr;</span>
        <b style="font-family:'Cormorant Garamond',serif; font-style:italic; font-size:17px;">${monthLabel}</b>
        <span data-cal-next style="cursor:pointer; padding:4px 10px; color:var(--accent); font-weight:800;">&rarr;</span>
      </div>
      <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px 2px; margin-bottom:4px;">${weekdayHead}</div>
      <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px 2px;">${cells}</div>
      ${state.selectedExpenseDate ? `<div class="foot-note" style="padding:10px 0 0; text-align:left;">Showing ${formatDayLabel(state.selectedExpenseDate)} only. <span data-cal-clear style="color:var(--accent); cursor:pointer;">Show full log</span></div>` : `<div class="foot-note" style="padding:10px 0 0; text-align:left;">Tap a date to see what was spent that day.</div>`}
    </div>
  `;
}

async function renderDailyExpenses(){
  const fullList = (state.dailyExpenses||[]).slice().sort((a,b)=>
    (b.date||"").localeCompare(a.date||"") || (b.id||"").localeCompare(a.id||"")
  );
  const list = state.selectedExpenseDate ? fullList.filter(e=>e.date===state.selectedExpenseDate) : fullList;
  const monthKey = todayKey().slice(0,7);
  const monthEntries = dailyExpensesForMonth(fullList, monthKey);
  const monthTotal = sumDailyExpenses(monthEntries);
  const grandTotal = sumDailyExpenses(fullList);
  const balances = computeSplitBalances(monthEntries, state.members)
    .filter(b=> Math.abs(b.balance) >= 1)
    .sort((a,b)=> b.balance - a.balance);

  await preloadPhotos(fullList.map(e=>e.photoId));

  const groups = {};
  list.forEach(e=>{
    const d = e.date || "";
    if(!groups[d]) groups[d] = [];
    groups[d].push(e);
  });
  const dateKeys = Object.keys(groups).sort((a,b)=> b.localeCompare(a));

  const daysHtml = dateKeys.map(d=>{
    const entries = groups[d];
    const dayTotal = sumDailyExpenses(entries);
    const rows = entries.map(e=>{
      const photoSrc = e.photoId ? state.photoCache[e.photoId] : null;
      const splitLabel = (e.splitAmong && e.splitAmong.length && e.splitAmong.length !== state.members.length)
        ? `Split: ${e.splitAmong.map(u=>nameFor(u, state.members)).join(", ")}`
        : "Split: everyone";
      return `
      <div class="member-row">
        <div class="left">
          ${photoSrc ? `<img class="avatar" loading="lazy" src="${photoSrc}" data-view-photo="${e.id}" style="cursor:pointer;">` : ""}
          <div>
            <div class="name">${e.note || "Expense"}</div>
            <div class="tag">${e.addedBy ? "Added by " + nameFor(e.addedBy, state.members) : ""} · ${splitLabel}</div>
          </div>
        </div>
        <div class="tag" style="font-size:14px; font-weight:700; color:var(--ink);">${inr(Number(e.amount)||0)}</div>
      </div>
    `;}).join("");
    return `
      <div class="card" style="padding:14px 16px 4px;">
        <div class="dues-top" style="margin-bottom:2px;">
          <div class="dues-label" style="text-transform:none; letter-spacing:0; font-size:13px; color:var(--ink); font-weight:700;">${formatDayLabel(d)}</div>
          <b style="font-family:'Cormorant Garamond',serif; font-style:italic; font-size:17px; color:var(--accent);">${inr(dayTotal)}</b>
        </div>
        ${rows}
      </div>
    `;
  }).join("") || `<div class="foot-note" style="padding:20px 0;">No expenses recorded yet. Anyone in the house can add one below.</div>`;

  const splitRows = balances.map(b=>`
    <div class="member-row">
      <div class="left"><div class="name">${b.name}</div></div>
      <div class="tag" style="font-size:14px; font-weight:700; color:${b.balance>=0?'var(--good)':'var(--danger)'};">
        ${b.balance>=0 ? `+${inr(b.balance)} (gets back)` : `${inr(b.balance)} (owes)`}
      </div>
    </div>
  `).join("") || `<div class="foot-note" style="padding:4px 0;">Everyone's even so far this month.</div>`;

  app.innerHTML = `
    ${topbar("Daily Expenses","home")}
    ${heroWrap("kitchen", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Daily Expenses</h1>
        <div class="sub">Day-wise spending log</div>
      </div>
    `)}
    <div class="section-title">This Month</div>
    <div class="card dues-card">
      <div class="dues-top">
        <div class="dues-label">Spent in ${monthKey}</div>
      </div>
      <div class="dues-amount">${inr(monthTotal)}</div>
      <div class="dues-note">All-time total: ${inr(grandTotal)}</div>
    </div>
    <div class="nav-row"><button class="btn-primary" id="add-daily-expense" style="flex:1;">+ Add Expense</button></div>
    <div class="section-title">Split Summary (This Month)</div>
    <div class="card" style="padding:6px 18px;">${splitRows}</div>
    <div class="foot-note" style="padding:4px 18px 0;">Based on who paid vs. who each expense was split between.</div>
    <div class="section-title">Calendar</div>
    ${renderExpenseCalendar(fullList)}
    <div class="section-title">Day-wise Log</div>
    ${daysHtml}
    <div class="foot-note" style="padding:4px 18px 0;">Everyone in the house can add, edit, or remove entries here.</div>
  `;
  $("#add-daily-expense").onclick = ()=> openEditDailyExpensesModal();
  app.querySelectorAll("[data-cal-day]").forEach(el=>{
    el.onclick = ()=>{
      const d = el.getAttribute("data-cal-day");
      state.selectedExpenseDate = (state.selectedExpenseDate===d) ? null : d;
      renderDailyExpenses();
    };
  });
  const calClear = app.querySelector("[data-cal-clear]");
  if(calClear) calClear.onclick = ()=>{ state.selectedExpenseDate = null; renderDailyExpenses(); };
  const calPrev = app.querySelector("[data-cal-prev]");
  if(calPrev) calPrev.onclick = ()=>{
    const [y,m] = state.expenseCalMonth.split("-").map(Number);
    const d = new Date(y, m-2, 1);
    state.expenseCalMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    renderDailyExpenses();
  };
  const calNext = app.querySelector("[data-cal-next]");
  if(calNext) calNext.onclick = ()=>{
    const [y,m] = state.expenseCalMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    state.expenseCalMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    renderDailyExpenses();
  };
  app.querySelectorAll("[data-view-photo]").forEach(el=>{
    el.onclick = ()=>{
      const id = el.getAttribute("data-view-photo");
      const entry = (state.dailyExpenses||[]).find(e=>e.id===id);
      const src = entry && entry.photoId ? state.photoCache[entry.photoId] : null;
      if(src) openPhotoLightbox(src);
    };
  });
}

// Simple full-screen preview for a stored receipt/complaint photo.
function openPhotoLightbox(src){
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  wrap.innerHTML = `
    <div class="modal" style="padding:10px; text-align:center;">
      <img src="${src}" style="max-width:100%; max-height:70vh; border-radius:8px;">
      <button class="btn-ghost" id="photo-close" style="margin-top:12px;">Close</button>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.onclick = (e)=>{ if(e.target===wrap) wrap.remove(); };
  wrap.querySelector("#photo-close").onclick = ()=> wrap.remove();
}

// Open to every signed-in member (unlike the Room Expenses ledger, which
// is admin-only) since day-to-day spending is meant to be logged by
// whoever actually paid for something.
async function openEditDailyExpensesModal(){
  const draft = JSON.parse(JSON.stringify(state.dailyExpenses||[]));
  await preloadPhotos(draft.map(e=>e.photoId));
  const newPhotos = {}; // entry id -> freshly-picked base64, not yet uploaded
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  document.body.appendChild(wrap);

  function splitChips(e, i){
    const group = (e.splitAmong && e.splitAmong.length) ? e.splitAmong : state.members.map(m=>m.username);
    return state.members.map(m=>{
      const active = group.includes(m.username);
      return `<span data-split-chip="${i}" data-split-user="${m.username}" style="display:inline-block; padding:4px 10px; border-radius:14px; font-size:11px; margin:2px 4px 2px 0; cursor:pointer; border:1px solid ${active?'var(--accent)':'var(--line)'}; background:${active?'var(--panel-2)':'transparent'}; color:${active?'var(--ink)':'var(--muted)'};">${m.name}</span>`;
    }).join("");
  }

  // Live "amount per person" preview for an entry, based on its current
  // amount and however many people are currently selected in its split.
  function perPersonLine(e){
    const group = (e.splitAmong && e.splitAmong.length) ? e.splitAmong : state.members.map(m=>m.username);
    const amt = Number(e.amount)||0;
    if(!amt || !group.length) return `<div style="font-size:11.5px; color:var(--muted); margin-top:6px;">Enter an amount to see the per-person split.</div>`;
    const per = amt / group.length;
    return `<div style="font-size:12.5px; color:var(--accent); font-weight:700; margin-top:6px;">${inr(Math.round(per*100)/100)} per person &middot; split ${group.length} way${group.length===1?"":"s"}</div>`;
  }

  function rowHtml(e, i){
    const thumb = newPhotos[e.id] || (e.photoId ? state.photoCache[e.photoId] : null);
    return `
      <div class="member-row" style="align-items:flex-start; flex-wrap:wrap; gap:8px 10px;">
        <input type="text" class="de-date" data-i="${i}" value="${e.date||''}" placeholder="YYYY-MM-DD" style="width:130px; margin-bottom:0;" onfocus="(this.type='date')">
        <input type="text" inputmode="numeric" class="de-amount" data-i="${i}" value="${e.amount||''}" placeholder="Amount" style="width:90px; margin-bottom:0;">
        <input type="text" class="de-note" data-i="${i}" value="${e.note||''}" placeholder="Reason (what was it for?)" style="flex:1 1 100%; margin-bottom:0;">
        <div style="display:flex; align-items:center; gap:8px; flex:1 1 100%;">
          ${thumb ? `<img class="avatar" src="${thumb}" style="width:36px; height:36px;">` : ""}
          <input type="file" accept="image/*" class="de-photo-file" data-i="${i}" style="display:none;">
          <span data-add-photo="${i}" style="color:var(--accent); font-size:12px; cursor:pointer;">${thumb ? "Change photo" : "Add photo"}</span>
          ${thumb ? `<span data-remove-photo="${i}" style="color:var(--danger); font-size:12px; cursor:pointer;">Remove photo</span>` : ""}
          <span data-remove-exp="${i}" style="color:var(--danger); font-size:12px; cursor:pointer; margin-left:auto;">Remove entry</span>
        </div>
        <div style="flex:1 1 100%;">
          <div style="font-size:11px; color:var(--muted); margin-bottom:2px;">Split equally between</div>
          ${splitChips(e, i)}
          <div data-per-person="${i}">${perPersonLine(e)}</div>
        </div>
        <div style="flex:1 1 100%; border-bottom:1px solid var(--line); margin-top:4px;"></div>
      </div>
    `;
  }

  function renderModal(){
    wrap.innerHTML = `
      <div class="modal">
        <h3>Daily Expenses</h3>
        <div class="foot-note" style="text-align:left; padding:0 0 12px; margin:0;">Enter the amount and reason, then tap names to choose who it's split between — the per-person share is calculated automatically.</div>
        ${draft.length ? draft.map(rowHtml).join("") : `<div class="foot-note" style="padding:0 0 12px; text-align:left; margin:0;">No entries yet — add your first one below.</div>`}
        <button type="button" class="btn-ghost" id="de-add-row" style="margin-top:2px;">+ Add Expense Row</button>
        <div class="error" id="de-err" style="display:none;"></div>
        <button class="btn-primary" id="de-save" style="margin-top:14px;">Save Changes</button>
        <button class="btn-ghost" id="de-cancel">Cancel</button>
      </div>
    `;

    wrap.querySelector("#de-cancel").onclick = ()=> wrap.remove();
    wrap.querySelector("#de-add-row").onclick = ()=>{
      draft.push({
        id: "de_" + Date.now() + Math.random().toString(36).slice(2,6),
        date: todayKey(),
        amount: 0,
        note: "",
        photoId: null,
        splitAmong: state.members.map(m=>m.username),
        addedBy: state.session.username
      });
      renderModal();
    };
    wrap.querySelectorAll("[data-remove-exp]").forEach(el=>{
      el.onclick = ()=>{
        const i = parseInt(el.getAttribute("data-remove-exp"),10);
        delete newPhotos[draft[i].id];
        draft.splice(i,1);
        renderModal();
      };
    });
    wrap.querySelectorAll("[data-remove-photo]").forEach(el=>{
      el.onclick = ()=>{
        const i = parseInt(el.getAttribute("data-remove-photo"),10);
        draft[i].photoId = null;
        delete newPhotos[draft[i].id];
        renderModal();
      };
    });
    wrap.querySelectorAll("[data-add-photo]").forEach(el=>{
      el.onclick = ()=>{
        const i = el.getAttribute("data-add-photo");
        wrap.querySelector(`.de-photo-file[data-i="${i}"]`).click();
      };
    });
    wrap.querySelectorAll(".de-photo-file").forEach(fileInput=>{
      fileInput.onchange = async ()=>{
        const f = fileInput.files[0];
        if(!f) return;
        const i = parseInt(fileInput.getAttribute("data-i"),10);
        try{
          // Keyed by the entry's own id (not its array position) so
          // reordering/removing other rows before saving can never attach
          // this photo to the wrong entry.
          newPhotos[draft[i].id] = await readAndCompressImage(f);
          renderModal();
        }catch(e){ alert("That photo couldn't be processed. Try a different one."); }
      };
    });
    // Keep the amount/note/date typed so far in sync with `draft` before any
    // re-render (e.g. from toggling a split chip), so nothing typed is lost
    // and the live per-person total reflects what's actually on screen.
    function syncFieldsFromInputs(){
      wrap.querySelectorAll(".de-date").forEach(el=> draft[parseInt(el.getAttribute("data-i"),10)].date = el.value.trim());
      wrap.querySelectorAll(".de-amount").forEach(el=> draft[parseInt(el.getAttribute("data-i"),10)].amount = Number(el.value)||0);
      wrap.querySelectorAll(".de-note").forEach(el=> draft[parseInt(el.getAttribute("data-i"),10)].note = el.value.trim());
    }
    wrap.querySelectorAll(".de-amount").forEach(el=>{
      el.oninput = ()=>{
        const i = parseInt(el.getAttribute("data-i"),10);
        draft[i].amount = Number(el.value)||0;
        const target = wrap.querySelector(`[data-per-person="${i}"]`);
        if(target) target.innerHTML = perPersonLine(draft[i]);
      };
    });
    wrap.querySelectorAll("[data-split-chip]").forEach(el=>{
      el.onclick = ()=>{
        syncFieldsFromInputs();
        const i = parseInt(el.getAttribute("data-split-chip"),10);
        const username = el.getAttribute("data-split-user");
        let group = (draft[i].splitAmong && draft[i].splitAmong.length) ? draft[i].splitAmong.slice() : state.members.map(m=>m.username);
        if(group.includes(username)){
          if(group.length>1) group = group.filter(u=>u!==username); // keep at least one person in the split
        } else {
          group.push(username);
        }
        draft[i].splitAmong = group;
        renderModal();
      };
    });

    wrap.querySelector("#de-save").onclick = async ()=>{
      const err = wrap.querySelector("#de-err");
      err.style.display = "none";

      syncFieldsFromInputs();

      if(draft.some(e=> !e.date)){ err.style.display="block"; err.textContent="Every entry needs a date."; return; }
      if(draft.some(e=> !e.amount)){ err.style.display="block"; err.textContent="Every entry needs an amount greater than zero."; return; }

      const btn = wrap.querySelector("#de-save");
      btn.disabled = true; btn.textContent = "Saving...";

      // Upload any newly-picked photos to their own keys first — the daily
      // expenses list itself should only ever hold short photoId strings,
      // never the base64 photo data, so it can't balloon past the shared
      // storage function's payload limit as entries pile up.
      for(const entryId of Object.keys(newPhotos)){
        const idx = draft.findIndex(d=>d.id===entryId);
        if(idx === -1) continue; // entry was removed before saving
        const photoId = `expense_${entryId}`;
        const photoOk = await savePhoto(photoId, newPhotos[entryId]);
        if(!photoOk){
          btn.disabled = false; btn.textContent = "Save Changes";
          err.style.display="block"; err.textContent="Couldn't upload a photo — check your connection and try again.";
          return;
        }
        state.photoCache[photoId] = newPhotos[entryId];
        draft[idx].photoId = photoId;
      }

      state.dailyExpenses = draft;
      const ok = await sset("ms-villa:daily-expenses", state.dailyExpenses);
      btn.disabled = false; btn.textContent = "Save Changes";
      if(!ok){ err.style.display="block"; err.textContent="Couldn't save to the server — check your connection and try again."; return; }
      wrap.remove();
      renderDailyExpenses();
      notifyMembers("Daily expenses updated", `${nameFor(state.session.username, state.members)} added or edited an entry in the daily expenses log.`);
    };
  }

  renderModal();
}


async function renderRent(){
  const me = state.members.find(m=>m.username===state.session.username);
  const rentInfo = state.rentInfo || RENT_INFO;
  const upiLink = `upi://pay?pa=${encodeURIComponent(rentInfo.upiId)}&pn=${encodeURIComponent(rentInfo.payeeName)}&cu=INR`;
  const qrDataUrl = await loadPhoto(PAYMENT_QR_PHOTO_ID);

  const myTxns = (state.transactions||[]).filter(t=>t.username===state.session.username).slice().reverse();
  const statusPillClass = s => s==="success" ? "status-success" : s==="failed" ? "status-failed" : "status-pending";
  const statusLabel = s => s==="success" ? "Success" : s==="failed" ? "Failed" : "Pending";
  const txnRows = myTxns.map(t=>`
    <div class="txn-row">
      <div>
        <div class="amt">${inr(t.amount)}</div>
        <div class="meta">${new Date(t.createdAt).toLocaleString("en-IN")}${t.note ? " · "+t.note : ""}</div>
      </div>
      <span class="status-pill ${statusPillClass(t.status)}">${statusLabel(t.status)}</span>
    </div>
  `).join("") || `<div class="foot-note" style="padding:6px 0 0;">No payments logged yet — after paying, tap "I've Paid — Log This Payment" below.</div>`;

  app.innerHTML = `
    ${topbar("Rent & Pay","home")}
    ${heroWrap("living", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Room Rent</h1>
        <div class="sub">Pay via UPI</div>
      </div>
    `)}
    ${qrDataUrl ? `
      <div class="qr-box">
        <img src="${qrDataUrl}" alt="Payment QR code">
        <div class="foot-note" style="padding-top:10px;">Scan with any UPI app to pay</div>
      </div>
    ` : ""}
    <div class="upi-box">
      <div>UPI ID</div>
      <div class="id">${rentInfo.upiId}</div>
    </div>
    <div class="pay-btn-row">
      <a class="pay-app-btn" href="${upiLink}"><b>PhonePe</b>Tap to pay</a>
      <a class="pay-app-btn" href="${upiLink}"><b>Google Pay</b>Tap to pay</a>
      <a class="pay-app-btn" href="${upiLink}"><b>Super Money</b>Tap to pay</a>
    </div>
    <div class="foot-note" style="margin-bottom:8px;">These buttons open your phone's UPI app chooser using the ID above. If nothing opens, scan the QR code above or copy the UPI ID into the app manually.</div>
    <div class="instr-note">Always keep a payment screenshot until your name is marked completed in the monthly ledger.</div>

    <div class="nav-row"><button class="btn-primary" id="log-payment-btn" style="flex:1;">I've Paid — Log This Payment</button></div>

    <div class="section-title">Your Payment History</div>
    ${txnRows}
    <div class="foot-note" style="margin:4px 0 0;">This is a self-reported log (the app can't confirm UPI payments automatically) — an admin cross-checks it against the actual account and marks the monthly ledger completed.</div>

    ${me.admin ? `<div class="nav-row"><button class="btn-line" data-nav2="transactions" style="flex:1;">View All Residents' Payments</button></div>` : ""}
  `;
  const logBtn = $("#log-payment-btn");
  if(logBtn) logBtn.onclick = ()=> openLogPaymentModal();
  const allTxnBtn = app.querySelector("[data-nav2='transactions']");
  if(allTxnBtn) allTxnBtn.onclick = ()=>{ state.view = "transactions"; render(); };
}

// Lets a resident record what happened after tapping a UPI pay button.
// Since a plain web page opening a upi:// deep link has no way to receive
// a callback from the UPI app, the app can't detect success/failure on its
// own — this self-reported log plus admin cross-checking against the ledger
// is the honest way to show payment status here, instead of pretending to
// auto-detect something it structurally can't.
function openLogPaymentModal(){
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  let photoData = null;

  function renderModal(){
    wrap.innerHTML = `
      <div class="modal">
        <h3>Log This Payment</h3>
        <label>Amount Paid (₹)</label>
        <input type="text" inputmode="numeric" id="lp-amount" placeholder="e.g. 6000">
        <label>Did it go through?</label>
        <select id="lp-status">
          <option value="success">Success — money left my account</option>
          <option value="pending">Not sure yet / still checking</option>
          <option value="failed">Failed — not debited / shown as failed</option>
        </select>
        <label>Note (optional)</label>
        <input type="text" id="lp-note" placeholder="e.g. Paid via PhonePe, ref ending 4821">
        <input type="file" accept="image/*" id="lp-photo-file" style="display:none;">
        <button type="button" class="btn-line" id="lp-photo-btn" style="width:100%; margin-bottom:16px;">${photoData ? "Replace Screenshot" : "Attach Payment Screenshot (optional)"}</button>
        ${photoData ? `<img src="${photoData}" style="width:100%; max-width:220px; border-radius:8px; margin:-6px 0 16px; display:block;">` : ""}
        <div class="error" id="lp-err" style="display:none;"></div>
        <button class="btn-primary" id="lp-save">Save</button>
        <button class="btn-ghost" id="lp-cancel">Cancel</button>
      </div>
    `;
    wrap.querySelector("#lp-cancel").onclick = ()=> wrap.remove();
    wrap.querySelector("#lp-photo-btn").onclick = ()=> wrap.querySelector("#lp-photo-file").click();
    wrap.querySelector("#lp-photo-file").onchange = async ()=>{
      const f = wrap.querySelector("#lp-photo-file").files[0];
      if(!f) return;
      try{ photoData = await readAndCompressImage(f); }catch(e){ /* ignore bad image, keep previous */ }
      renderModal();
    };
    wrap.querySelector("#lp-save").onclick = async ()=>{
      const err = wrap.querySelector("#lp-err");
      err.style.display = "none";
      const amount = Number(wrap.querySelector("#lp-amount").value) || 0;
      const status = wrap.querySelector("#lp-status").value;
      const note = wrap.querySelector("#lp-note").value.trim();
      if(!amount){ err.style.display="block"; err.textContent="Please enter the amount you paid."; return; }

      const btn = wrap.querySelector("#lp-save");
      btn.disabled = true; btn.textContent = "Saving...";

      let photoId = null;
      if(photoData){
        photoId = `txn_${Date.now()}`;
        const ok = await savePhoto(photoId, photoData);
        if(ok) state.photoCache[photoId] = photoData;
        else photoId = null;
      }

      const entry = {
        id: "txn_"+Date.now()+Math.random().toString(36).slice(2,6),
        username: state.session.username,
        amount, status, note, photoId,
        createdAt: new Date().toISOString()
      };
      state.transactions = [...(state.transactions||[]), entry];
      const ok = await sset("ms-villa:transactions", state.transactions);
      btn.disabled = false; btn.textContent = "Save";
      if(!ok){ err.style.display="block"; err.textContent="Couldn't save — check your connection and try again."; return; }

      wrap.remove();
      renderRent();
      notifyMembers(
        `Payment logged — ${nameFor(state.session.username, state.members)}`,
        `${inr(amount)} marked as ${status==="success"?"successful":status==="failed"?"failed":"pending"}.${note ? " Note: "+note : ""}`,
        { onlyUsernames: adminUsernames() }
      );
    };
  }
  document.body.appendChild(wrap);
  renderModal();
}

// Admin-only screen: every resident's self-reported payment log in one
// place, with the ability to correct a status after checking the real bank
// / UPI account (e.g. flip a mistaken "pending" to "success" once the
// money is confirmed received, or "failed" if it never arrived).
function renderTransactionsAdmin(){
  const me = state.members.find(m=>m.username===state.session.username);
  if(!me.admin){ state.view = "rent"; return renderRent(); }
  const statusPillClass = s => s==="success" ? "status-success" : s==="failed" ? "status-failed" : "status-pending";
  const statusLabel = s => s==="success" ? "Success" : s==="failed" ? "Failed" : "Pending";
  const rows = (state.transactions||[]).slice().reverse().map(t=>`
    <div class="txn-row" style="flex-direction:column; align-items:stretch; gap:8px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <div>
          <div class="who">${nameFor(t.username, state.members)}</div>
          <div class="amt">${inr(t.amount)}</div>
          <div class="meta">${new Date(t.createdAt).toLocaleString("en-IN")}${t.note ? " · "+t.note : ""}</div>
        </div>
        <span class="status-pill ${statusPillClass(t.status)}">${statusLabel(t.status)}</span>
      </div>
      <div style="display:flex; gap:8px;">
        <select class="txn-status-pick" data-txn="${t.id}" style="flex:1; margin-bottom:0; padding:8px 10px; font-size:12px;">
          <option value="success" ${t.status==="success"?"selected":""}>Mark Success</option>
          <option value="pending" ${t.status==="pending"?"selected":""}>Mark Pending</option>
          <option value="failed" ${t.status==="failed"?"selected":""}>Mark Failed</option>
        </select>
      </div>
    </div>
  `).join("") || `<div class="foot-note" style="padding:20px 0;">No payments logged by anyone yet.</div>`;

  app.innerHTML = `
    ${topbar("All Payments","rent")}
    ${heroWrap("living", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">All Payments</h1>
        <div class="sub">Verify against the real UPI account</div>
      </div>
    `)}
    ${rows}
  `;
  app.querySelectorAll(".txn-status-pick").forEach(sel=>{
    sel.onchange = async ()=>{
      const txn = state.transactions.find(t=>t.id===sel.getAttribute("data-txn"));
      if(!txn) return;
      txn.status = sel.value;
      const ok = await sset("ms-villa:transactions", state.transactions);
      if(!ok){ alert("Couldn't save — check your connection and try again."); return; }
      notifyMembers(
        "Payment status updated",
        `${nameFor(txn.username, state.members)}'s ${inr(txn.amount)} payment was marked ${sel.value}.`,
        { onlyUsernames: [txn.username] }
      );
      renderTransactionsAdmin();
    };
  });
}

async function renderComplaints(){
  const me = state.members.find(m=>m.username===state.session.username);
  const mine = state.complaints.slice().reverse();
  await preloadPhotos(mine.map(c=>c.photoId));
  const rows = mine.map(c=>{
    const photoSrc = c.photoId ? state.photoCache[c.photoId] : null;
    return `
    <div class="complaint-card">
      <div class="top">
        <div class="cat">${c.category}</div>
        <span class="status-pill ${c.status==='closed'?'status-closed':'status-open'}">${c.status==='closed'?'Resolved':'Open'}</span>
      </div>
      <div class="desc">${c.description}</div>
      ${photoSrc ? `<img src="${photoSrc}" data-view-photo="${c.id}" style="width:100%; max-width:220px; border-radius:8px; margin-top:8px; cursor:pointer; display:block;">` : ""}
      <div class="meta">${nameFor(c.username, state.members)} · ${new Date(c.createdAt).toLocaleDateString()} ${c.status!=='closed' && me.admin ? `<span data-close="${c.id}" style="color:var(--accent); cursor:pointer; margin-left:8px;">Mark resolved</span>` : ""}</div>
    </div>
  `;}).join("") || `<div class="foot-note" style="padding:20px 0;">No complaints raised yet.</div>`;

  app.innerHTML = `
    ${topbar("Complaints","home")}
    ${heroWrap("bedroomB", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Raise a Complaint</h1>
        <div class="sub">Maintenance &amp; Issues</div>
      </div>
    `)}
    <div class="nav-row"><button class="btn-primary" id="new-complaint">+ New Complaint</button></div>
    <div class="section-title">All Complaints</div>
    ${rows}
  `;
  $("#new-complaint").onclick = ()=> openComplaintModal();
  app.querySelectorAll("[data-close]").forEach(el=>{
    el.onclick = async ()=>{
      const id = el.getAttribute("data-close");
      const c = state.complaints.find(x=>x.id===id);
      if(c){ c.status="closed"; await sset("ms-villa:complaints", state.complaints); renderComplaints(); }
    };
  });
  app.querySelectorAll("[data-view-photo]").forEach(el=>{
    el.onclick = ()=>{
      const id = el.getAttribute("data-view-photo");
      const c = state.complaints.find(x=>x.id===id);
      const src = c && c.photoId ? state.photoCache[c.photoId] : null;
      if(src) openPhotoLightbox(src);
    };
  });
}

function openComplaintModal(){
  const cats = COMPLAINT_CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join("");
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  let photoData = null;
  const complaintId = "c" + Date.now();
  wrap.innerHTML = `
    <div class="modal">
      <h3>New Complaint</h3>
      <label>Category</label>
      <select id="c-cat">${cats}</select>
      <label>Describe the issue</label>
      <textarea id="c-desc" placeholder="e.g. Washing machine drum not spinning, making loud noise"></textarea>
      <label>Photo (optional)</label>
      <div style="display:flex; align-items:center; gap:10px;">
        <input type="file" accept="image/*" id="c-photo-file" style="display:none;">
        <button type="button" class="btn-ghost" id="c-photo-btn" style="margin:0;">Add Photo</button>
        <img id="c-photo-preview" style="display:none; width:48px; height:48px; object-fit:cover; border-radius:8px;">
        <span id="c-photo-remove" style="display:none; color:var(--danger); font-size:12px; cursor:pointer;">Remove</span>
      </div>
      <div class="error" id="c-err" style="display:none;"></div>
      <button class="btn-primary" id="c-save" style="margin-top:14px;">Submit Complaint</button>
      <button class="btn-ghost" id="c-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(wrap);
  const fileInput = wrap.querySelector("#c-photo-file");
  const preview = wrap.querySelector("#c-photo-preview");
  const removeBtn = wrap.querySelector("#c-photo-remove");
  wrap.querySelector("#c-photo-btn").onclick = ()=> fileInput.click();
  fileInput.onchange = async ()=>{
    const f = fileInput.files[0];
    if(!f) return;
    try{
      photoData = await readAndCompressImage(f);
      preview.src = photoData;
      preview.style.display = "block";
      removeBtn.style.display = "inline";
    }catch(e){ alert("That photo couldn't be processed. Try a different one."); }
  };
  removeBtn.onclick = ()=>{
    photoData = null;
    fileInput.value = "";
    preview.style.display = "none";
    removeBtn.style.display = "none";
  };
  wrap.querySelector("#c-cancel").onclick = ()=> wrap.remove();
  wrap.querySelector("#c-save").onclick = async ()=>{
    const desc = wrap.querySelector("#c-desc").value.trim();
    const err = wrap.querySelector("#c-err");
    err.style.display = "none";
    if(!desc){ err.style.display="block"; err.textContent="Please describe the issue."; return; }

    const btn = wrap.querySelector("#c-save");
    btn.disabled = true; btn.textContent = "Submitting...";

    // Photo (if any) is uploaded to its own key first — the complaints list
    // only ever stores the short photoId, never the base64 photo itself.
    let photoId = null;
    if(photoData){
      photoId = `complaint_${complaintId}`;
      const photoOk = await savePhoto(photoId, photoData);
      if(!photoOk){
        btn.disabled = false; btn.textContent = "Submit Complaint";
        err.style.display="block"; err.textContent="Couldn't upload the photo — check your connection and try again.";
        return;
      }
      state.photoCache[photoId] = photoData;
    }

    const complaint = {
      id: complaintId,
      username: state.session.username,
      category: wrap.querySelector("#c-cat").value,
      description: desc,
      photoId,
      status: "open",
      createdAt: new Date().toISOString()
    };
    state.complaints.push(complaint); // optimistic local echo
    const saved = await sappend("ms-villa:complaints", complaint, "id");
    btn.disabled = false; btn.textContent = "Submit Complaint";
    if(saved === null){ err.style.display="block"; err.textContent="Couldn't save to the server — check your connection and try again."; state.complaints.pop(); return; }
    state.complaints = saved; // authoritative list from the server, including anyone else's concurrent additions
    wrap.remove();
    renderComplaints();
    notifyMembers("New complaint raised", `${complaint.category}: ${complaint.description.slice(0,80)}`);
  };
}

function renderMeetings(){
  const me = state.members.find(m=>m.username===state.session.username);
  const now = Date.now();
  const sorted = [...state.meetings].sort((a,b)=> new Date(a.time) - new Date(b.time));
  const upcoming = sorted.filter(m=> !m.time || new Date(m.time).getTime() >= now - 60*60*1000);
  const past = sorted.filter(m=> m.time && new Date(m.time).getTime() < now - 60*60*1000);

  function card(m){
    const when = m.time ? new Date(m.time).toLocaleString([], {dateStyle:"medium", timeStyle:"short"}) : "No time set";
    return `
      <div class="meeting-card">
        <div class="top">
          <div>
            <div class="title">${m.title}</div>
            <div class="meta">${when}</div>
          </div>
          <span class="meeting-platform-pill">${m.platform}</span>
        </div>
        ${m.notes ? `<div class="meta" style="margin-top:6px;">${m.notes}</div>` : ""}
        <a class="join-btn" href="${m.link}" target="_blank" rel="noopener">Join ${m.platform}</a>
        ${me.admin ? `<span data-del-meeting="${m.id}" style="color:var(--danger); font-size:11px; margin-left:12px; cursor:pointer;">Remove</span>` : ""}
      </div>
    `;
  }

  app.innerHTML = `
    ${topbar("Meetings","home")}
    ${heroWrap("living", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Meetings</h1>
        <div class="sub">Zoom &amp; Google Meet links</div>
      </div>
    `)}
    ${me.admin ? `<div class="fab-add"><button class="btn-primary" id="add-meeting">+ Schedule a Meeting</button></div>` : ""}
    <div class="section-title">Upcoming</div>
    ${upcoming.length ? upcoming.map(card).join("") : `<div class="foot-note" style="padding:0 18px 18px;">No meetings scheduled yet.</div>`}
    ${past.length ? `<div class="section-title">Past</div>${past.map(card).join("")}` : ""}
  `;

  if(me.admin){
    $("#add-meeting").onclick = ()=> openMeetingModal();
    app.querySelectorAll("[data-del-meeting]").forEach(el=>{
      el.onclick = async ()=>{
        const id = el.getAttribute("data-del-meeting");
        state.meetings = state.meetings.filter(m=>m.id!==id);
        await sset("ms-villa:meetings", state.meetings);
        renderMeetings();
      };
    });
  }
}

function openMeetingModal(){
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  wrap.innerHTML = `
    <div class="modal">
      <h3>Schedule a Meeting</h3>
      <label>Title</label>
      <input type="text" id="m-title" placeholder="e.g. Monthly house meeting">
      <label>Platform</label>
      <select id="m-platform">
        <option>Zoom</option>
        <option>Google Meet</option>
        <option>Microsoft Teams</option>
        <option>Other</option>
      </select>
      <label>Meeting link</label>
      <input type="text" id="m-link" placeholder="https://zoom.us/j/...">
      <label>Date &amp; time</label>
      <input type="text" id="m-time" placeholder="YYYY-MM-DDTHH:MM" onfocus="(this.type='datetime-local')">
      <label>Notes (optional)</label>
      <textarea id="m-notes" placeholder="Agenda, dial-in details, etc."></textarea>
      <div class="error" id="m-error" style="display:none;"></div>
      <button class="btn-primary" id="m-save">Save Meeting</button>
      <button class="btn-ghost" id="m-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(wrap);
  $("#m-cancel").onclick = ()=> wrap.remove();
  $("#m-save").onclick = async ()=>{
    const title = $("#m-title").value.trim();
    const link = $("#m-link").value.trim();
    const err = $("#m-error");
    if(!title || !link){ err.style.display="block"; err.textContent="Title and link are required."; return; }
    const time = $("#m-time").value || null;
    const meeting = {
      id: "m_" + Date.now(),
      title,
      platform: $("#m-platform").value,
      link,
      time,
      notes: $("#m-notes").value.trim(),
      createdBy: state.session.username
    };
    state.meetings.push(meeting); // optimistic local echo
    const saved = await sappend("ms-villa:meetings", meeting, "id");
    if(saved !== null) state.meetings = saved; // authoritative list, including anyone else's concurrent additions
    wrap.remove();
    renderMeetings();
    notifyMembers(`Meeting scheduled: ${title}`, time ? `Starts ${time}` : "Check the Meetings tab for details.");
  };
}

// --- House Chat ------------------------------------------------------------
// A single shared group thread, visible to every resident — text, photos,
// voice notes, videos, documents, and stickers, all broadcast to the whole
// house the moment they're sent (there's only one house, so "send to
// everyone" is just "post to the thread"). Messages are tiny (sappend keeps
// the shared list safe against concurrent sends); any actual photo/audio/
// video/document bytes live under their own small key via
// saveChatMedia/loadChatMedia, same pattern the rest of the app already
// uses for photos.
const CHAT_STICKERS = ["😀","😂","😍","👍","🙏","🎉","❤️","🔥","😢","😮","👏","🙌","🤝","🍛","🧹","🧽","💧","🛏️","🏠","☕","🎂","😴","🤣","😎"];
let chatRenderedIds = new Set();
let chatRecorder = null, chatRecordedChunks = [], chatIsRecording = false;

function chatBubbleHtml(msg){
  const mine = msg.from === state.session.username;
  const senderName = nameFor(msg.from, state.members);
  const time = new Date(msg.createdAt).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
  let inner;
  if(msg.type === "image"){
    const src = state.chatMediaCache ? state.chatMediaCache[msg.mediaId] : null;
    inner = src ? `<img class="chat-img" src="${src}">` : `<span style="font-size:12px;">Loading photo…</span>`;
  } else if(msg.type === "audio"){
    const src = state.chatMediaCache ? state.chatMediaCache[msg.mediaId] : null;
    inner = src ? `<audio controls src="${src}"></audio>` : `<span style="font-size:12px;">Loading voice note…</span>`;
  } else if(msg.type === "video"){
    const src = state.chatMediaCache ? state.chatMediaCache[msg.mediaId] : null;
    inner = src ? `<video class="chat-video" controls playsinline src="${src}"></video>` : `<span style="font-size:12px;">Loading video…</span>`;
  } else if(msg.type === "file"){
    const src = state.chatMediaCache ? state.chatMediaCache[msg.mediaId] : null;
    inner = src
      ? `<a class="chat-file-card" href="${src}" download="${(msg.fileName||"file").replace(/"/g,"")}">
          <span class="chat-file-icon">${fileIconFor(msg.fileName)}</span>
          <span class="chat-file-info">
            <span class="chat-file-name">${(msg.fileName||"Document").replace(/</g,"&lt;")}</span>
            <span class="chat-file-size">${formatFileSize(msg.fileSize)} · Tap to open</span>
          </span>
        </a>`
      : `<span style="font-size:12px;">Loading document…</span>`;
  } else if(msg.type === "sticker"){
    inner = msg.text;
  } else {
    inner = (msg.text||"").replace(/</g,"&lt;");
  }
  return `
    <div class="chat-bubble-row ${mine?"me":"them"}" data-msg-id="${msg.id}">
      ${!mine ? `<div class="chat-sender">${senderName}</div>` : ""}
      <div class="chat-bubble${msg.type==="sticker"?" sticker":""}${msg.type==="video"||msg.type==="file"?" media":""}">${inner}</div>
      <div class="chat-time">${time}</div>
    </div>
  `;
}

async function ensureChatMediaLoaded(messages){
  const needed = messages.filter(m=> m.mediaId && (!state.chatMediaCache || !state.chatMediaCache[m.mediaId]));
  if(!needed.length) return;
  await Promise.all(needed.map(m=> loadChatMedia(m.mediaId)));
}

function isThreadNearBottom(thread){
  return thread.scrollHeight - thread.scrollTop - thread.clientHeight < 120;
}

async function renderChat(){
  const messages = [...state.chat];
  await ensureChatMediaLoaded(messages);

  let lastDay = null;
  const rows = messages.map(m=>{
    const day = new Date(m.createdAt).toDateString();
    let sep = "";
    if(day !== lastDay){ sep = `<div class="chat-day-sep">${day===new Date().toDateString() ? "Today" : day}</div>`; lastDay = day; }
    return sep + chatBubbleHtml(m);
  }).join("");

  app.innerHTML = `
    ${topbar("House Chat","home")}
    <div class="chat-screen">
      <div class="chat-thread" id="chat-thread">
        ${rows || `<div class="chat-empty">No messages yet — say hi to the house 👋</div>`}
      </div>
      <div class="sticker-panel" id="sticker-panel" style="display:none;">
        ${CHAT_STICKERS.map(s=>`<span data-sticker="${s}">${s}</span>`).join("")}
      </div>
      <div class="chat-inputbar">
        <input type="file" accept="image/*" id="chat-photo-file" style="display:none;">
        <div class="chat-icon-btn" id="chat-photo-btn" title="Photo">📷</div>
        <input type="file" accept="video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" id="chat-doc-file" style="display:none;">
        <div class="chat-icon-btn" id="chat-doc-btn" title="Video or document">📎</div>
        <div class="chat-icon-btn" id="chat-sticker-btn" title="Stickers">😊</div>
        <input type="text" id="chat-text" placeholder="Message the house...">
        <div class="chat-icon-btn" id="chat-mic-btn" title="Voice message">🎤</div>
        <div class="chat-send-btn" id="chat-send-btn" title="Send">
          <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
        </div>
      </div>
    </div>
  `;
  chatRenderedIds = new Set(messages.map(m=>m.id));
  const thread = $("#chat-thread");
  thread.scrollTop = thread.scrollHeight;

  $("#chat-photo-btn").onclick = ()=> $("#chat-photo-file").click();
  $("#chat-photo-file").onchange = async ()=>{
    const f = $("#chat-photo-file").files[0];
    if(!f) return;
    try{
      const dataUrl = await readAndCompressImage(f, 1280, 0.85);
      await sendChatMessage({ type:"image", dataUrl });
    }catch(e){ alert("That photo couldn't be sent. Try a different one."); }
    $("#chat-photo-file").value = "";
  };

  $("#chat-doc-btn").onclick = ()=> $("#chat-doc-file").click();
  $("#chat-doc-file").onchange = async ()=>{
    const f = $("#chat-doc-file").files[0];
    if(!f) return;
    const btn = $("#chat-doc-btn");
    const original = btn.textContent;
    btn.textContent = "⏳";
    try{
      const dataUrl = await readFileAsDataURL(f);
      const type = f.type && f.type.startsWith("video/") ? "video" : "file";
      await sendChatMessage({ type, dataUrl, fileName: f.name, fileSize: f.size });
    }catch(e){
      alert(e && e.message ? e.message : "That file couldn't be sent. Try a different one.");
    }
    btn.textContent = original;
    $("#chat-doc-file").value = "";
  };

  $("#chat-sticker-btn").onclick = ()=>{
    const panel = $("#sticker-panel");
    panel.style.display = panel.style.display === "none" ? "grid" : "none";
  };
  app.querySelectorAll("[data-sticker]").forEach(el=>{
    el.onclick = async ()=>{
      $("#sticker-panel").style.display = "none";
      await sendChatMessage({ type:"sticker", text: el.getAttribute("data-sticker") });
    };
  });

  $("#chat-send-btn").onclick = sendChatTextFromInput;
  $("#chat-text").onkeydown = (e)=>{ if(e.key==="Enter") sendChatTextFromInput(); };

  $("#chat-mic-btn").onclick = toggleChatRecording;
}

async function sendChatTextFromInput(){
  const input = $("#chat-text");
  const text = input.value.trim();
  if(!text) return;
  input.value = "";
  await sendChatMessage({ type:"text", text });
}

async function toggleChatRecording(){
  const btn = $("#chat-mic-btn");
  if(!navigator.mediaDevices || !window.MediaRecorder){
    alert("Voice messages aren't supported on this browser/device.");
    return;
  }
  if(!chatIsRecording){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      chatRecordedChunks = [];
      chatRecorder = new MediaRecorder(stream);
      chatRecorder.ondataavailable = (e)=>{ if(e.data.size) chatRecordedChunks.push(e.data); };
      chatRecorder.onstop = async ()=>{
        stream.getTracks().forEach(t=>t.stop());
        const blob = new Blob(chatRecordedChunks, { type: chatRecorder.mimeType || "audio/webm" });
        const dataUrl = await new Promise((resolve,reject)=>{
          const reader = new FileReader();
          reader.onload = ()=> resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        await sendChatMessage({ type:"audio", dataUrl });
      };
      chatRecorder.start();
      chatIsRecording = true;
      btn.classList.add("rec");
      btn.textContent = "⏹";
    }catch(e){ alert("Couldn't access the microphone — check your browser permissions."); }
  } else {
    chatIsRecording = false;
    btn.classList.remove("rec");
    btn.textContent = "🎤";
    if(chatRecorder && chatRecorder.state !== "inactive") chatRecorder.stop();
  }
}

// opts: { type, text, dataUrl, fileName, fileSize }. Media (image/audio/
// video/file) is uploaded to its own small key first — the shared chat
// list only ever stores the short mediaId (plus fileName/fileSize for
// documents, so the bubble/card can show them without re-loading the
// bytes), exactly like every other photo in this app.
async function sendChatMessage(opts){
  const id = "msg_" + Date.now() + Math.random().toString(36).slice(2,6);
  let mediaId = null;
  if(opts.dataUrl){
    mediaId = `chat_${id}`;
    const ok = await saveChatMedia(mediaId, opts.dataUrl);
    if(!ok){ alert("Couldn't send — check your connection and try again."); return; }
    if(!state.chatMediaCache) state.chatMediaCache = {};
    state.chatMediaCache[mediaId] = opts.dataUrl;
  }
  const msg = {
    id, from: state.session.username, type: opts.type,
    text: opts.text || null, mediaId,
    fileName: opts.fileName || null, fileSize: opts.fileSize || null,
    createdAt: new Date().toISOString()
  };
  state.chat.push(msg); // optimistic local echo
  const saved = await sappend("ms-villa:chat", msg, "id");
  if(saved !== null) state.chat = saved;
  renderChat();
  const preview = opts.type==="image" ? "📷 Photo"
    : opts.type==="audio" ? "🎤 Voice message"
    : opts.type==="video" ? "🎥 Video"
    : opts.type==="file" ? `📎 ${opts.fileName || "Document"}`
    : opts.type==="sticker" ? `${opts.text} Sticker` : opts.text;
  notifyMembers("New message in House Chat", `${nameFor(state.session.username, state.members)}: ${preview}`);
}

// Called from syncNow's background poll (every 6s) while the person is
// actually looking at the Chat screen — appends only the new messages
// instead of re-rendering the whole thread, so it never yanks the scroll
// position or an in-progress typed message out from under them.
async function appendNewChatMessages(){
  if(state.view !== "chat") return;
  const thread = document.getElementById("chat-thread");
  if(!thread) return;
  const fresh = state.chat.filter(m=> !chatRenderedIds.has(m.id));
  if(!fresh.length) return;
  await ensureChatMediaLoaded(fresh);
  const wasNearBottom = isThreadNearBottom(thread);
  const empty = thread.querySelector(".chat-empty");
  if(empty) empty.remove();
  thread.insertAdjacentHTML("beforeend", fresh.map(chatBubbleHtml).join(""));
  fresh.forEach(m=> chatRenderedIds.add(m.id));
  if(wasNearBottom) thread.scrollTop = thread.scrollHeight;
}

// --- Reminders -----------------------------------------------------------
// Any resident can set one: for themselves, or for the whole house. Saved
// to the shared list (same safe-append pattern as meetings/complaints) so
// everyone sees it, and picked up by the scheduled-reminders function
// (server side) which fires an actual push at the chosen time.
function renderReminders(){
  const me = state.members.find(m=>m.username===state.session.username);
  const now = Date.now();
  const mine = (r)=> r.target!=="me" || r.by===state.session.username;
  const visible = state.reminders.filter(mine);
  const sorted = [...visible].sort((a,b)=> new Date(a.time) - new Date(b.time));
  const upcoming = sorted.filter(r=> new Date(r.time).getTime() >= now - 5*60000);
  const past = sorted.filter(r=> new Date(r.time).getTime() < now - 5*60000);

  function card(r){
    const when = new Date(r.time).toLocaleString([], {dateStyle:"medium", timeStyle:"short"});
    const canDel = me.admin || r.by === state.session.username;
    return `
      <div class="meeting-card">
        <div class="top">
          <div>
            <div class="title">${r.title}</div>
            <div class="meta">${when}</div>
          </div>
          <span class="meeting-platform-pill">${r.target==="me" ? "Just me" : "Everyone"}</span>
        </div>
        ${r.notes ? `<div class="meta" style="margin-top:6px;">${r.notes}</div>` : ""}
        <div class="meta" style="margin-top:8px;">Set by ${nameFor(r.by, state.members)}${canDel ? ` · <span data-del-reminder="${r.id}" style="color:var(--danger); cursor:pointer;">Remove</span>` : ""}</div>
      </div>
    `;
  }

  app.innerHTML = `
    ${topbar("Reminders","home")}
    ${heroWrap("living", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Reminders</h1>
        <div class="sub">Never forget a duty, bill, or meeting</div>
      </div>
    `)}
    <div class="fab-add"><button class="btn-primary" id="add-reminder">+ Add Reminder</button></div>
    <div class="section-title">Upcoming</div>
    ${upcoming.length ? upcoming.map(card).join("") : `<div class="foot-note" style="padding:0 18px 18px;">No reminders yet.</div>`}
    ${past.length ? `<div class="section-title">Past</div>${past.map(card).join("")}` : ""}
  `;

  $("#add-reminder").onclick = ()=> openReminderModal();
  app.querySelectorAll("[data-del-reminder]").forEach(el=>{
    el.onclick = async ()=>{
      const id = el.getAttribute("data-del-reminder");
      state.reminders = state.reminders.filter(r=>r.id!==id);
      const saved = await sremove("ms-villa:reminders", "id", id);
      if(saved !== null) state.reminders = saved;
      renderReminders();
    };
  });
}

function openReminderModal(){
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  wrap.innerHTML = `
    <div class="modal">
      <h3>Add Reminder</h3>
      <label>Title</label>
      <input type="text" id="r-title" placeholder="e.g. Pay September rent">
      <label>Date &amp; time</label>
      <input type="text" id="r-time" placeholder="YYYY-MM-DDTHH:MM" onfocus="(this.type='datetime-local')">
      <label>Notes (optional)</label>
      <textarea id="r-notes" placeholder="Any extra detail"></textarea>
      <label>Who should be reminded?</label>
      <div class="chip-select">
        <div class="chip on" data-target="all">Everyone</div>
        <div class="chip" data-target="me">Just me</div>
      </div>
      <div class="error" id="r-error" style="display:none;"></div>
      <button class="btn-primary" id="r-save">Save Reminder</button>
      <button class="btn-ghost" id="r-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(wrap);
  let target = "all";
  wrap.querySelectorAll("[data-target]").forEach(chip=>{
    chip.onclick = ()=>{
      wrap.querySelectorAll("[data-target]").forEach(c=>c.classList.remove("on"));
      chip.classList.add("on");
      target = chip.getAttribute("data-target");
    };
  });
  $("#r-cancel").onclick = ()=> wrap.remove();
  $("#r-save").onclick = async ()=>{
    const title = $("#r-title").value.trim();
    const time = $("#r-time").value;
    const err = $("#r-error");
    if(!title || !time){ err.style.display="block"; err.textContent="Title and date/time are required."; return; }
    const reminder = {
      id: "rem_" + Date.now(),
      title,
      notes: $("#r-notes").value.trim(),
      time,
      target,
      by: state.session.username,
      sent: false
    };
    state.reminders.push(reminder); // optimistic local echo
    const saved = await sappend("ms-villa:reminders", reminder, "id");
    if(saved !== null) state.reminders = saved;
    wrap.remove();
    renderReminders();
  };
}

// Simple house directory — a photo, name, and education line for every
// resident. Anyone signed in can view it; only an admin can edit a
// person's entry (photo/name/education), from an "Edit" link on each card.
async function renderRoommates(){
  const me = state.members.find(m=>m.username===state.session.username);
  await preloadPhotos(state.members.map(m=>m.photoId));
  const cards = state.members.map(m=>{
    const photoSrc = m.photoId ? state.photoCache[m.photoId] : null;
    return `
    <div class="roommate-card">
      ${photoSrc ? `<img class="roommate-photo" loading="lazy" src="${photoSrc}">` : `<div class="roommate-photo-empty">${(m.name||"?")[0]}</div>`}
      <div class="roommate-name">${m.name}${m.admin ? ' <span style="color:var(--accent); font-size:10px;">(admin)</span>' : ''}</div>
      <div class="roommate-edu">${m.education || "Education not added yet"}</div>
      ${me.admin ? `<span class="roommate-edit" data-edit-roommate="${m.username}">Edit</span>` : ""}
    </div>
  `;}).join("");

  app.innerHTML = `
    ${topbar("Roommates","home")}
    ${heroWrap("living", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Roommates</h1>
        <div class="sub">Who lives at Ms Villa</div>
      </div>
    `)}
    <div class="roommate-grid">${cards}</div>
    <div class="foot-note" style="padding:16px 18px 0;">${me.admin ? "Tap Edit on a card to update someone's photo, name, or education." : "Only an admin can edit these details."}</div>
  `;

  if(me.admin){
    app.querySelectorAll("[data-edit-roommate]").forEach(el=>{
      el.onclick = ()=> openEditRoommateModal(el.getAttribute("data-edit-roommate"));
    });
  }
}

async function openEditRoommateModal(username){
  const member = state.members.find(m=>m.username===username);
  if(!member) return;
  // photoData holds a fresh base64 photo only while it's being picked/previewed
  // in this modal; on Save it's handed off to savePhoto() and only the short
  // photoId ever gets written into state.members.
  let photoData = member.photoId ? await loadPhoto(member.photoId) : null;
  let photoRemoved = false;

  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  wrap.innerHTML = `
    <div class="modal">
      <h3>Edit — ${member.name}</h3>
      <label>Photo</label>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
        ${photoData ? `<img id="rm-photo-preview" class="roommate-photo" src="${photoData}" style="width:56px; height:56px; margin:0;">` : `<div id="rm-photo-preview-empty" class="roommate-photo-empty" style="width:56px; height:56px; margin:0; font-size:18px;">${(member.name||"?")[0]}</div>`}
        <input type="file" accept="image/*" id="rm-photo-file" style="display:none;">
        <button type="button" class="btn-ghost" id="rm-photo-btn" style="margin:0; width:auto; padding:8px 12px;">Change Photo</button>
        ${photoData ? `<span id="rm-photo-remove" style="color:var(--danger); font-size:12px; cursor:pointer;">Remove</span>` : ""}
      </div>
      <label>Name</label>
      <input type="text" id="rm-name" value="${member.name}">
      <label>Education</label>
      <input type="text" id="rm-edu" placeholder="e.g. B.Tech, XYZ College" value="${member.education||""}">
      <div class="error" id="rm-err" style="display:none;"></div>
      <button class="btn-primary" id="rm-save">Save Changes</button>
      <button class="btn-ghost" id="rm-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(wrap);

  function refreshPreview(){
    const holder = wrap.querySelector("#rm-photo-preview") || wrap.querySelector("#rm-photo-preview-empty");
    if(photoData){
      const img = document.createElement("img");
      img.id = "rm-photo-preview";
      img.className = "roommate-photo";
      img.src = photoData;
      img.style.cssText = "width:56px; height:56px; margin:0;";
      holder.replaceWith(img);
      if(!wrap.querySelector("#rm-photo-remove")){
        const rm = document.createElement("span");
        rm.id = "rm-photo-remove";
        rm.style.cssText = "color:var(--danger); font-size:12px; cursor:pointer;";
        rm.textContent = "Remove";
        wrap.querySelector("#rm-photo-btn").insertAdjacentElement("afterend", rm);
        wireRemove();
      }
    }
  }
  function wireRemove(){
    const rm = wrap.querySelector("#rm-photo-remove");
    if(rm) rm.onclick = ()=>{
      photoData = null;
      photoRemoved = true;
      const holder = wrap.querySelector("#rm-photo-preview");
      const div = document.createElement("div");
      div.id = "rm-photo-preview-empty";
      div.className = "roommate-photo-empty";
      div.style.cssText = "width:56px; height:56px; margin:0; font-size:18px;";
      div.textContent = (member.name||"?")[0];
      holder.replaceWith(div);
      rm.remove();
    };
  }
  wireRemove();

  wrap.querySelector("#rm-photo-btn").onclick = ()=> wrap.querySelector("#rm-photo-file").click();
  wrap.querySelector("#rm-photo-file").onchange = async ()=>{
    const f = wrap.querySelector("#rm-photo-file").files[0];
    if(!f) return;
    try{
      photoData = await readAndCompressImage(f);
      photoRemoved = false;
      refreshPreview();
    }catch(e){ alert("That photo couldn't be processed. Try a different one."); }
  };
  wrap.querySelector("#rm-cancel").onclick = ()=> wrap.remove();
  wrap.querySelector("#rm-save").onclick = async ()=>{
    const name = wrap.querySelector("#rm-name").value.trim();
    const edu = wrap.querySelector("#rm-edu").value.trim();
    const err = wrap.querySelector("#rm-err");
    err.style.display = "none";
    if(!name){ err.style.display="block"; err.textContent="Name can't be empty."; return; }

    const btn = wrap.querySelector("#rm-save");
    btn.disabled = true; btn.textContent = "Saving...";

    // A NEW photo was picked (photoData is fresh base64, not just the
    // preloaded existing one) — save it under its own key first, separately
    // from the members list, so the members list itself stays tiny.
    let photoId = member.photoId || null;
    const isNewPhoto = photoData && photoData !== state.photoCache[member.photoId];
    if(isNewPhoto){
      photoId = `roommate_${member.username}`;
      const photoOk = await savePhoto(photoId, photoData);
      if(!photoOk){
        btn.disabled = false; btn.textContent = "Save Changes";
        err.style.display="block"; err.textContent="Couldn't upload the photo — check your connection and try again.";
        return;
      }
      state.photoCache[photoId] = photoData;
    } else if(photoRemoved){
      photoId = null;
    }

    const prevName = member.name, prevEdu = member.education, prevPhotoId = member.photoId;
    member.name = name;
    member.education = edu;
    member.photoId = photoId;

    const ok = await sset("ms-villa:members", state.members);
    btn.disabled = false; btn.textContent = "Save Changes";
    if(!ok){
      member.name = prevName; member.education = prevEdu; member.photoId = prevPhotoId;
      err.style.display="block"; err.textContent="Couldn't save to the server — check your connection and try again.";
      return;
    }
    wrap.remove();
    renderRoommates();
  };
}

// A simple shared photo album for the house — anyone can upload, anyone can
// view, and (like complaints) only the uploader or an admin can delete one.
// Only a small metadata record is stored per photo (id/photoId/caption/etc);
// the actual image bytes live under their own key via savePhoto, same
// pattern as Roommates and Daily Expenses, so the gallery can grow without
// ever risking the shared storage payload limit.
async function renderGallery(){
  const me = state.members.find(m=>m.username===state.session.username);
  const items = (state.gallery||[]).slice().reverse();
  await preloadPhotos(items.map(p=>p.photoId));

  const grid = items.map(p=>{
    const src = state.photoCache[p.photoId];
    if(!src) return "";
    const canDelete = me.admin || p.uploadedBy===me.username;
    return `
      <div style="position:relative;">
        <img src="${src}" loading="lazy" data-view-photo="${p.id}" style="width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; cursor:pointer; display:block;">
        ${canDelete ? `<span data-delete-photo="${p.id}" style="position:absolute; top:6px; right:6px; background:rgba(22,39,63,.75); color:#fff; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; cursor:pointer;">✕</span>` : ""}
        ${p.caption ? `<div style="font-size:11px; color:var(--muted); margin-top:4px;">${p.caption}</div>` : ""}
      </div>
    `;
  }).join("");

  app.innerHTML = `
    ${topbar("Photos","home")}
    ${heroWrap("living", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Photos</h1>
        <div class="sub">Shared house album</div>
      </div>
    `)}
    <div class="nav-row"><button class="btn-primary" id="upload-photo" style="flex:1;">+ Upload Photo</button></div>
    <div class="roommate-grid" style="grid-template-columns:1fr 1fr; margin-top:4px;">
      ${grid || `<div class="foot-note" style="grid-column:1/-1; padding:16px 0;">No photos yet — be the first to add one.</div>`}
    </div>
  `;

  $("#upload-photo").onclick = ()=> openUploadPhotoModal();
  app.querySelectorAll("[data-view-photo]").forEach(el=>{
    el.onclick = ()=>{
      const id = el.getAttribute("data-view-photo");
      const p = items.find(x=>x.id===id);
      const src = p ? state.photoCache[p.photoId] : null;
      if(src) openPhotoLightbox(src);
    };
  });
  app.querySelectorAll("[data-delete-photo]").forEach(el=>{
    el.onclick = async (ev)=>{
      ev.stopPropagation();
      if(!confirm("Remove this photo for everyone?")) return;
      state.gallery = state.gallery.filter(p=>p.id!==el.getAttribute("data-delete-photo"));
      await sset("ms-villa:gallery", state.gallery);
      renderGallery();
    };
  });
}

function openUploadPhotoModal(){
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  let photoData = null;
  wrap.innerHTML = `
    <div class="modal">
      <h3>Upload Photo</h3>
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
        <input type="file" accept="image/*" id="gp-file" style="display:none;">
        <button type="button" class="btn-ghost" id="gp-btn" style="margin:0;">Choose Photo</button>
        <img id="gp-preview" style="display:none; width:56px; height:56px; object-fit:cover; border-radius:8px;">
      </div>
      <label>Caption (optional)</label>
      <input type="text" id="gp-caption" placeholder="e.g. New sofa in the living room">
      <div class="error" id="gp-err" style="display:none;"></div>
      <button class="btn-primary" id="gp-save" style="margin-top:14px;">Upload</button>
      <button class="btn-ghost" id="gp-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(wrap);
  const fileInput = wrap.querySelector("#gp-file");
  const preview = wrap.querySelector("#gp-preview");
  wrap.querySelector("#gp-btn").onclick = ()=> fileInput.click();
  fileInput.onchange = async ()=>{
    const f = fileInput.files[0];
    if(!f) return;
    try{
      photoData = await readAndCompressImage(f, 1600, 0.92);
      preview.src = photoData;
      preview.style.display = "block";
    }catch(e){ alert("That photo couldn't be processed. Try a different one."); }
  };
  wrap.querySelector("#gp-cancel").onclick = ()=> wrap.remove();
  wrap.querySelector("#gp-save").onclick = async ()=>{
    const err = wrap.querySelector("#gp-err");
    err.style.display = "none";
    if(!photoData){ err.style.display="block"; err.textContent="Choose a photo first."; return; }

    const btn = wrap.querySelector("#gp-save");
    btn.disabled = true; btn.textContent = "Uploading...";

    const id = "gp_" + Date.now();
    const photoId = `gallery_${id}`;
    const photoOk = await savePhoto(photoId, photoData);
    if(!photoOk){
      btn.disabled = false; btn.textContent = "Upload";
      err.style.display="block"; err.textContent="Couldn't upload the photo — check your connection and try again.";
      return;
    }
    state.photoCache[photoId] = photoData;

    const photo = {
      id, photoId,
      caption: wrap.querySelector("#gp-caption").value.trim(),
      uploadedBy: state.session.username,
      createdAt: new Date().toISOString()
    };
    state.gallery.push(photo); // optimistic local echo
    const saved = await sappend("ms-villa:gallery", photo, "id");
    btn.disabled = false; btn.textContent = "Upload";
    if(saved === null){
      state.gallery.pop();
      err.style.display="block"; err.textContent="Couldn't save to the server — check your connection and try again.";
      return;
    }
    state.gallery = saved; // authoritative list, including anyone else's concurrent uploads
    wrap.remove();
    renderGallery();
    notifyMembers("New photo added", `${nameFor(state.session.username, state.members)} added a new photo to the album.`);
  };
}

async function renderSettings(){
  const me = state.members.find(m=>m.username===state.session.username);
  const appearance = getAppearance();
  const currentQr = me.admin ? await loadPhoto(PAYMENT_QR_PHOTO_ID) : null;
  const memberRows = state.members.map(m=>`
    <div class="member-row">
      <div class="left"><div class="avatar-empty">${m.name[0]}</div><div>
        <div class="name">${m.name}</div><div class="tag">${m.username}${m.admin? ' · admin':''}${m.phone? ' · '+m.phone : ''}</div>
      </div></div>
      ${me.admin ? `
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
          <span data-edit-phone="${m.username}" style="color:var(--accent); font-size:11px; cursor:pointer;">${m.phone? 'Edit phone' : 'Add phone'}</span>
          <span data-toggle-admin="${m.username}" style="color:${m.admin?'var(--danger)':'var(--good)'}; font-size:11px; cursor:pointer;">${m.admin ? 'Remove admin' : 'Make admin'}</span>
        </div>
      ` : ""}
    </div>
  `).join("");
  const themeOptions = Object.entries(THEMES).map(([key,t])=>`<option value="${key}" ${appearance.theme===key?'selected':''}>${t.label}</option>`).join("");
  const fontOptions = Object.entries(FONTS).map(([key,f])=>`<option value="${key}" ${appearance.font===key?'selected':''}>${f.label}</option>`).join("");
  app.innerHTML = `
    ${topbar("Settings","home")}
    ${heroWrap("living", `
      <div class="house-title" style="padding-top:0;">
        <h1 style="font-size:26px;">Settings</h1>
        <div class="sub">${me.name}</div>
      </div>
    `)}
    <div class="nav-row">
      <button class="btn-primary" id="go-changepass">Change Password</button>
    </div>
    <div class="section-title">Appearance</div>
    <div class="card">
      <label>Theme</label>
      <select id="pick-theme">${themeOptions}</select>
      <label>Font</label>
      <select id="pick-font">${fontOptions}</select>
      <label style="display:flex; align-items:center; gap:10px; margin-top:2px; cursor:pointer;">
        <input type="checkbox" id="pick-bold" ${appearance.bold?"checked":""} style="width:16px; height:16px; margin:0;">
        <span style="font-size:13px; color:var(--ink); font-weight:700;">Bold text everywhere</span>
      </label>
      <div class="foot-note" style="margin:10px 0 0; text-align:left;">This is a personal preference saved on this device only.</div>
    </div>
    <div class="section-title">Notifications</div>
    <div class="card">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <div class="foot-note" style="margin:0; text-align:left;" id="notif-status">${notificationStatusLabel()}</div>
        ${notificationsEnabled() ? `<span class="status-pill status-present" style="flex-shrink:0; margin-left:10px;">Enabled</span>` : ""}
      </div>
      <button class="btn-line" id="toggle-notif" style="width:100%;">${notificationsEnabled() ? "Turn Off Notifications" : "Enable Notifications"}</button>
      <button class="btn-ghost" data-nav="notifications" style="width:100%; margin-top:10px;">View All Notifications${unreadNotifCount()>0?` (${unreadNotifCount()})`:''}</button>
    </div>
    ${me.admin ? `
      <div class="section-title">All Members (${state.members.length}/15)</div>
      <div class="card" style="padding:6px 18px;">${memberRows}</div>
      <div class="nav-row"><button class="btn-line" id="add-member" style="flex:1;">Add Member</button></div>
      <div class="section-title">Room Assignments</div>
      <div class="card">
        <div class="foot-note" style="margin:0 0 12px; text-align:left;">Edit who's assigned to every room, including both bedrooms, in one place.</div>
        <button class="btn-line" id="manage-rooms" style="width:100%;">Manage Room Assignments</button>
      </div>
      <div class="section-title">Payment Settings</div>
      <div class="card">
        <div class="foot-note" style="margin:0 0 12px; text-align:left;">This UPI ID and QR code are shown to everyone on the Rent &amp; Pay screen.</div>
        <label>UPI ID</label>
        <input type="text" id="rent-upi-id" placeholder="e.g. 9876543210@axl" value="${(state.rentInfo||RENT_INFO).upiId}">
        <label>Payee Name</label>
        <input type="text" id="rent-payee-name" placeholder="e.g. Ms Villa" value="${(state.rentInfo||RENT_INFO).payeeName}">
        <button class="btn-primary" id="save-rent-info">Save UPI Details</button>
        <div class="msg" id="rent-info-msg" style="display:none;"></div>
        <div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--line);">
          ${currentQr ? `<img src="${currentQr}" style="width:150px; height:150px; object-fit:contain; background:#fff; border-radius:8px; padding:6px; display:block; margin:0 auto 12px;">` : `<div class="foot-note" style="margin:0 0 12px; text-align:left;">No QR code uploaded yet.</div>`}
          <input type="file" accept="image/*" id="rent-qr-file" style="display:none;">
          <button type="button" class="btn-line" id="rent-qr-btn" style="width:100%;">${currentQr ? "Replace QR Code" : "Upload QR Code"}</button>
          ${currentQr ? `<button type="button" class="btn-ghost" id="rent-qr-remove" style="width:100%;">Remove QR Code</button>` : ""}
          <div class="error" id="rent-qr-err" style="display:none; margin-top:10px;"></div>
        </div>
      </div>
      <div class="section-title">Send Announcement</div>
      <div class="card">
        <div class="foot-note" style="margin:0 0 10px; text-align:left;">Push a notification to everyone, or pick specific residents below.</div>
        <label>Send to</label>
        <div class="chip-select" id="announce-targets">
          <span data-target-chip="__all__" style="padding:8px 12px; border-radius:20px; font-size:13px; cursor:pointer; border:1px solid ${!(state.announceTargets&&state.announceTargets.length)?'var(--accent)':'var(--line)'}; background:${!(state.announceTargets&&state.announceTargets.length)?'var(--panel-2)':'transparent'}; color:${!(state.announceTargets&&state.announceTargets.length)?'var(--ink)':'var(--muted)'};">Everyone</span>
          ${state.members.map(m=>{
            const active = !!(state.announceTargets && state.announceTargets.includes(m.username));
            return `<span data-target-chip="${m.username}" style="padding:8px 12px; border-radius:20px; font-size:13px; cursor:pointer; border:1px solid ${active?'var(--accent)':'var(--line)'}; background:${active?'var(--panel-2)':'transparent'}; color:${active?'var(--ink)':'var(--muted)'};">${m.name}</span>`;
          }).join("")}
        </div>
        <label>Title</label>
        <input type="text" id="announce-title" placeholder="e.g. Water will be off tomorrow">
        <label>Message</label>
        <textarea id="announce-body" placeholder="Details for everyone..."></textarea>
        <div class="error" id="announce-err" style="display:none;"></div>
        <div class="msg" id="announce-msg" style="display:none;"></div>
        <button class="btn-primary" id="send-announce">${(state.announceTargets&&state.announceTargets.length) ? `Send to ${state.announceTargets.length} Selected` : "Send to Everyone"}</button>
      </div>
      <div class="section-title">Support / Chat with us</div>
      <div class="card">
        <label>WhatsApp number for "Chat with us" (with country code)</label>
        <input type="text" id="support-phone" placeholder="+91 98765 43210" value="${state.supportPhone||''}">
        <button class="btn-primary" id="save-support">Save Number</button>
      </div>
    ` : ""}
    <div class="nav-row"><button class="btn-ghost" id="logout">Sign Out</button></div>
  `;
  $("#go-changepass").onclick = ()=>{ state.view="changepass"; render(); };
  $("#logout").onclick = ()=>{ state.session=null; forgetSession(); localStorage.removeItem(LAST_VIEW_KEY); state.view="login"; render(); };
  $("#pick-theme").onchange = (e)=>{ setAppearance(e.target.value, null); };
  $("#pick-font").onchange = (e)=>{ setAppearance(null, e.target.value); };
  $("#pick-bold").onchange = (e)=>{ setAppearance(null, null, e.target.checked); };
  $("#toggle-notif").onclick = async ()=>{
    if(notificationsEnabled()){ await unsubscribeFromPush(); } else { await subscribeToPush(); }
    renderSettings();
  };
  if(me.admin){
    $("#add-member").onclick = ()=> openAddMemberModal();
    $("#manage-rooms").onclick = ()=> openManageRoomAssignmentsModal();
    app.querySelectorAll("[data-toggle-admin]").forEach(el=>{
      el.onclick = ()=> toggleMemberAdmin(el.getAttribute("data-toggle-admin"));
    });
    app.querySelectorAll("[data-target-chip]").forEach(el=>{
      el.onclick = ()=>{
        // Preserve whatever's typed so far before re-rendering the card.
        const t = $("#announce-title"), b = $("#announce-body");
        state.announceDraftTitle = t ? t.value : (state.announceDraftTitle||"");
        state.announceDraftBody = b ? b.value : (state.announceDraftBody||"");
        const key = el.getAttribute("data-target-chip");
        if(key === "__all__"){ state.announceTargets = []; }
        else{
          state.announceTargets = state.announceTargets || [];
          state.announceTargets = state.announceTargets.includes(key)
            ? state.announceTargets.filter(u=>u!==key)
            : [...state.announceTargets, key];
        }
        renderSettings();
      };
    });
    if(state.announceDraftTitle) $("#announce-title").value = state.announceDraftTitle;
    if(state.announceDraftBody) $("#announce-body").value = state.announceDraftBody;
    $("#send-announce").onclick = async ()=>{
      const title = $("#announce-title").value.trim();
      const body = $("#announce-body").value.trim();
      const err = $("#announce-err"), msg = $("#announce-msg");
      err.style.display="none"; msg.style.display="none";
      if(!title || !body){ err.style.display="block"; err.textContent="Please add both a title and a message."; return; }
      const targets = state.announceTargets && state.announceTargets.length ? state.announceTargets : null;
      const btn = $("#send-announce");
      btn.disabled = true; btn.textContent = "Sending...";
      // Announcements go to everyone (or the chosen residents), including
      // the admin sending it — pass excludeUsername explicitly as null so
      // notifyMembers' default (excluding the sender) doesn't apply here.
      const result = await notifyMembers(title, body, { excludeUsername: null, onlyUsernames: targets });
      btn.disabled = false; btn.textContent = targets ? `Send to ${targets.length} Selected` : "Send to Everyone";
      msg.style.display="block";
      if(!result){
        msg.textContent = "Sent, but couldn't confirm delivery (no response from server).";
      } else if(result.reason){
        msg.textContent = `Not delivered: ${result.reason}`;
      } else {
        msg.textContent = `Delivered to ${result.sent||0} of ${result.total||0} subscribed resident(s)${result.failed?` (${result.failed} failed)`:""}.`;
      }
      $("#announce-title").value = ""; $("#announce-body").value = "";
      state.announceDraftTitle = ""; state.announceDraftBody = "";
    };
    $("#save-support").onclick = async ()=>{
      state.supportPhone = $("#support-phone").value.trim();
      await sset("ms-villa:support-phone", state.supportPhone);
      renderChatFab();
      renderSettings();
    };
    $("#save-rent-info").onclick = async ()=>{
      const msg = $("#rent-info-msg");
      const upiId = $("#rent-upi-id").value.trim();
      const payeeName = $("#rent-payee-name").value.trim();
      if(!upiId || !payeeName){ msg.style.display="block"; msg.style.color="var(--danger)"; msg.textContent="Please fill in both the UPI ID and payee name."; return; }
      const btn = $("#save-rent-info");
      btn.disabled = true; btn.textContent = "Saving...";
      state.rentInfo = { upiId, payeeName };
      const ok = await sset("ms-villa:rent-info", state.rentInfo);
      btn.disabled = false; btn.textContent = "Save UPI Details";
      msg.style.display = "block";
      msg.style.color = ok ? "var(--good)" : "var(--danger)";
      msg.textContent = ok ? "Saved — everyone will see the updated UPI details." : "Couldn't save — check your connection and try again.";
      if(ok) notifyMembers("Payment details updated", "An admin just updated the rent UPI ID / QR code.");
    };
    const qrBtn = $("#rent-qr-btn");
    if(qrBtn) qrBtn.onclick = ()=> $("#rent-qr-file").click();
    const qrFile = $("#rent-qr-file");
    if(qrFile) qrFile.onchange = async ()=>{
      const f = qrFile.files[0];
      if(!f) return;
      const err = $("#rent-qr-err");
      err.style.display = "none";
      qrBtn.disabled = true; qrBtn.textContent = "Uploading...";
      try{
        const photoData = await readAndCompressImage(f, 1800, 0.95);
        const ok = await savePhoto(PAYMENT_QR_PHOTO_ID, photoData);
        if(!ok){ err.style.display="block"; err.textContent="Couldn't upload — check your connection and try again."; qrBtn.disabled=false; qrBtn.textContent = "Replace QR Code"; return; }
        state.photoCache[PAYMENT_QR_PHOTO_ID] = photoData;
        notifyMembers("Payment QR updated", "An admin just uploaded a new payment QR code.");
      }catch(e){
        err.style.display = "block"; err.textContent = "That image couldn't be processed. Try a different photo.";
        qrBtn.disabled = false; qrBtn.textContent = "Replace QR Code";
        return;
      }
      renderSettings();
    };
    const qrRemove = $("#rent-qr-remove");
    if(qrRemove) qrRemove.onclick = async ()=>{
      if(!confirm("Remove the payment QR code? Residents will still see the UPI ID.")) return;
      await savePhoto(PAYMENT_QR_PHOTO_ID, "");
      state.photoCache[PAYMENT_QR_PHOTO_ID] = "";
      renderSettings();
    };
    app.querySelectorAll("[data-edit-phone]").forEach(el=>{
      el.onclick = async ()=>{
        const username = el.getAttribute("data-edit-phone");
        const m = state.members.find(x=>x.username===username);
        const phone = prompt(`Mobile number for ${m.name} (used for OTP sign-in):`, m.phone||"");
        if(phone===null) return;
        m.phone = phone.trim();
        await sset("ms-villa:members", state.members);
        renderSettings();
      };
    });
  }
}


document.addEventListener("click", (e)=>{
  const refreshBtn = e.target.closest("#topbar-refresh");
  if(refreshBtn){ handleManualRefresh(); return; }
  const bell = e.target.closest("#notif-bell");
  if(bell){ state.view = "notifications"; render(); return; }
  const t = e.target.closest("[data-nav]");
  if(t && t.getAttribute("data-nav")){
    const target = t.getAttribute("data-nav");
    if(target==="home"){ state.view="home"; render(); }
    if(target==="settings"){ state.view="settings"; render(); }
    if(target==="login"){ state.view="login"; render(); }
    if(target==="phoneLogin"){ state.view="phoneLogin"; render(); }
    if(target==="rent"){ state.view="rent"; render(); }
  }
});

// Keeps everyone's data fresh without needing a manual refresh.
// The shared data function has no websocket/push support of its own for
// in-app state, so this polls it periodically and also re-syncs the moment
// the app regains focus
// (e.g. switching back from another app), which covers the common
// "admin changed something and I don't see it" case quickly.
let syncing = false;
async function syncNow(manual){
  if(!state.session) return;
  // Bail out entirely (don't even fetch) while a modal is open. Editing
  // screens (e.g. the roommate editor) hold a direct reference to an
  // object inside state.members/state.dailyExpenses/etc. across an
  // `await` while the person picks a photo or types. If loadCore() below
  // ran during that window it would replace state.members wholesale with
  // fresh-from-server objects, silently detaching the modal's reference
  // from the array — so its eventual Save write would send the old,
  // unedited data back to the server with no error shown. Skipping the
  // whole sync (not just the re-render) while any modal is up avoids that.
  if(document.querySelector(".modal-bg")) return;
  if(syncing){
    // A manual tap on the refresh icon while a background sync is already
    // in flight should still feel responsive instead of silently doing
    // nothing — wait briefly for the in-flight one to finish rather than
    // starting a second overlapping request.
    if(manual){
      for(let i=0;i<50 && syncing;i++){ await new Promise(r=>setTimeout(r,100)); }
    }
    return;
  }
  syncing = true;
  try{
    const before = JSON.stringify({
      members: state.members, meetings: state.meetings, ledger: state.ledger,
      cookingStaff: state.cookingStaff, waterDuty: state.waterDuty,
      weeklyVesselDuty: state.weeklyVesselDuty, supportPhone: state.supportPhone,
      vesselOverrides: state.vesselOverrides, cookingOverrides: state.cookingOverrides,
      complaints: state.complaints, dailyExpenses: state.dailyExpenses,
      gallery: state.gallery, rooms: state.rooms,
      rentInfo: state.rentInfo, transactions: state.transactions,
      reminders: state.reminders
    });
    await loadCore();
    const after = JSON.stringify({
      members: state.members, meetings: state.meetings, ledger: state.ledger,
      cookingStaff: state.cookingStaff, waterDuty: state.waterDuty,
      weeklyVesselDuty: state.weeklyVesselDuty, supportPhone: state.supportPhone,
      vesselOverrides: state.vesselOverrides, cookingOverrides: state.cookingOverrides,
      complaints: state.complaints, dailyExpenses: state.dailyExpenses,
      gallery: state.gallery, rooms: state.rooms,
      rentInfo: state.rentInfo, transactions: state.transactions,
      reminders: state.reminders
    });
    // Never re-render out from under someone mid-task: skip while they're on
    // the live attendance/photo screen, or whenever any modal (edit forms,
    // assignment pickers, etc.) is open — a background refresh used to be
    // able to silently close/reset an in-progress edit, which is the kind
    // of "lag/glitch" this app should never have.
    const modalOpen = !!document.querySelector(".modal-bg");
    if(before !== after && state.view !== "room" && state.view !== "chat" && !modalOpen){ renderView(); renderChatFab(); }
    if(state.view === "chat") appendNewChatMessages();
    updateNotifBell();
  }catch(e){ /* offline or storage hiccup - ignore and try again next tick */ }
  syncing = false;
}
setInterval(syncNow, 6000);
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) syncNow(); });
window.addEventListener("focus", syncNow);
window.addEventListener("online", syncNow);

// Wraps loadCore() so a slow/stalled first load never leaves someone
// staring at a blank/frozen screen forever. If it hasn't resolved within
// BOOT_TIMEOUT_MS, the boot screen swaps its spinner for a "still loading /
// Retry now" message so there's always something actionable on screen.
const BOOT_TIMEOUT_MS = 6000;
function setBootMessage(text, showRetry){
  const msg = document.getElementById("boot-msg");
  if(msg) msg.textContent = text;
  const boot = document.getElementById("boot-screen");
  if(boot && showRetry && !document.getElementById("boot-retry")){
    const btn = document.createElement("button");
    btn.id = "boot-retry";
    btn.className = "btn-line";
    btn.style.marginTop = "4px";
    btn.textContent = "Retry Now";
    btn.onclick = ()=> location.reload();
    boot.appendChild(btn);
  }
}

(async function init(){
  applyAppearance();

  let slowTimer = setTimeout(()=>{
    setBootMessage("This is taking longer than usual — check your connection.", true);
  }, BOOT_TIMEOUT_MS);

  try{
    await loadCore();
  }catch(e){
    clearTimeout(slowTimer);
    setBootMessage("Couldn't load Ms Villa — check your connection and retry.", true);
    return;
  }
  clearTimeout(slowTimer);

  const remembered = getRememberedSession();
  if(remembered && state.members.some(m=>m.username===remembered.username)){
    state.session = { username: remembered.username };
    const saved = getSavedViewState();
    const validViews = ["home","room","instructions","settings","changepass","duty","expenses","dailyExpenses","rent","complaints","meetings","roommates","gallery","notifications","transactions"];
    if(saved && validViews.includes(saved.view) && (saved.view!=="room" || state.rooms.some(r=>r.id===saved.roomId))){
      state.view = saved.view;
      state.roomId = saved.roomId || null;
    } else {
      state.view = "home";
    }
  }
  render();
  initNotifications();
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}


