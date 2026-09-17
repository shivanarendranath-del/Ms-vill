// ms-villa-app / js/database.js
//
// App-wide constants (default members, rooms, duty rosters, ledger seed,
// icons, etc.) plus the shared data layer. All state lives on the global
// `state` object so the other js/*.js files (loaded as plain <script> tags,
// not ES modules) can read and mutate it directly, exactly like the
// original single-file build did.

const STORAGE_UNSET = "__unset__";
const DEFAULT_PASSWORD = "Msvilla@202";

const HOUSE_ICON = `<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>`;

// Real photos of the house, used as lightly blurred hero backgrounds.
const IMAGES = {
  living: "assets/images/living.jpg",
  kitchen: "assets/images/kitchen.jpg",
  bedroomA: "assets/images/bedroomA.jpg",
  bedroomB: "assets/images/bedroomB.jpg"
}
function heroWrap(imgKey, innerHtml){
  const src = IMAGES[imgKey] || IMAGES.living;
  return `<div class="photo-hero">
    <img class="hero-img" src="${src}" alt="">
    <div class="hero-overlay"></div>
    <div class="hero-inner">${innerHtml}</div>
  </div>`;
}
function imageForRoom(roomId){
  if(roomId==="living") return "living";
  if(roomId==="kitchen") return "kitchen";
  if(roomId==="bedroomA") return "bedroomA";
  if(roomId==="bedroomB") return "bedroomB";
  return "living";
}

const DEFAULT_MEMBERS = [
  { username:"Narendra@35", name:"Narendra", admin:true },
  { username:"Gana@12", name:"Ganapathi" },
  { username:"Surendra@35", name:"Surendra" },
  { username:"Rakesh@45", name:"Rakesh" },
  { username:"Chandrakanth@30", name:"Chandra Kanth" },
  { username:"Taj@45", name:"Taj" },
  { username:"Mahammad@88", name:"Mahammad" },
  { username:"Naveen@20", name:"Naveen" },
  { username:"Yashwanth@46", name:"Yashwanth" },
  { username:"Sreekanth@98", name:"Sreekanth" },
  { username:"Mallikarjuna@25", name:"Mallikarjuna" },
  { username:"Dinesh@48", name:"Dinesh" }
];

const DEFAULT_ROOMS = [
  { id:"living", name:"Living Area", assigned:["Chandrakanth@30","Taj@45"] },
  { id:"kitchen", name:"Kitchen", assigned:[] },
  { id:"bedroomA", name:"Bed Room A", assigned:["Gana@12","Narendra@35","Rakesh@45"] },
  { id:"bedroomB", name:"Bed Room B", assigned:["Mallikarjuna@25","Mahammad@88","Sreekanth@98","Yashwanth@46","Naveen@20"] },
  { id:"bathroomA", name:"Bath Room A", assigned:[] },
  { id:"bathroomB", name:"Bath Room B", assigned:[] }
];

// Weekly vessel-washing duty (from the house's handwritten roster). 0=Sunday..6=Saturday
// These three are now editable by an admin from Settings and are persisted to the
// storage backend (ms-villa:cooking-staff / ms-villa:water-duty / ms-villa:vessel-weekly),
// so updates made in the app stick permanently instead of needing a code edit.
const DEFAULT_WEEKLY_VESSEL_DUTY = {
  0: "Taj@45",           // Sunday
  1: "Gana@12",          // Monday
  2: "Mallikarjuna@25",  // Tuesday
  3: "Rakesh@45",        // Wednesday
  4: "Yashwanth@46",     // Thursday
  5: "Mahammad@88",      // Friday
  6: "Sreekanth@98"      // Saturday
};
const DEFAULT_COOKING_STAFF = ["Narendra", "Bunty"];
const DEFAULT_WATER_CAN_DUTY = "Naveen@20";

const RENT_INFO = {
  upiId: "6304583216-2@axl",
  payeeName: "Ms Villa"
};

// Photo id the payment QR code (uploaded by an admin from Settings) is
// stored under — same "own small key" pattern as every other photo, so it
// doesn't bloat the rentInfo record.
const PAYMENT_QR_PHOTO_ID = "payment-qr";

// Transcribed from the handwritten monthly ledger. Verify with admin before relying on exact figures.
// This is only the initial seed — an admin can edit it from Room Expenses, and edits are persisted.
const DEFAULT_LEDGER = {
  month: "September",
  rows: [
    { name:"Ganapathi", due:6000, paid:5050, split:0, status:"Balance ₹950" },
    { name:"Surendra (Navi)", due:6000, paid:2483, split:0, status:"Balance ₹3517" },
    { name:"Rakesh", due:6000, paid:6000, split:0, status:"Completed" },
    { name:"Naveen", due:6000, paid:6000, split:0, status:"Completed (₹3000 old bill cleared)" },
    { name:"Chandra Kanth", due:6000, paid:-608, split:0, status:"Old bills + geyser repair adjusted, balance -₹608" },
    { name:"Sreekanth", due:6000, paid:6000, split:0, status:"Completed" },
    { name:"Mallikarjuna", due:6000, paid:4950, split:0, status:"Completed" },
    { name:"Mahammad", due:6000, paid:5000, split:0, status:"Balance ₹1000" },
    { name:"Yashwanth", due:6000, paid:6000, split:0, status:"Completed" },
    { name:"Taj", due:6000, paid:6000, split:0, status:"Completed" }
  ],
  bills: [
    { label:"Room Rent", amount:21000 },
    { label:"Current / Electricity Bill", amount:1500 },
    { label:"August Month Bills", amount:14000 },
    { label:"TV & Home Theater Bill", amount:6200 }
  ],
  totalBills: 42700,
  totalBillsAuto: true,
  remaining: 17300,
  remainingAuto: false,
  remainingNote: "Carried forward as September's room expense"
};

// Today's food menu (shown as its own "Food" column on Room Expenses) plus
// the Yes/No house poll on whether food should be prepared every day.
// Both are shared, admin-editable-menu / everyone-can-vote-poll records,
// same "own small key" persistence pattern as everything else here.
const DEFAULT_FOOD_MENU = "";
const DEFAULT_FOOD_POLL = {
  question: "Should food be prepared every day?",
  votes: {} // username -> "yes" | "no"
};

const COMPLAINT_CATEGORIES = [
  "Washing Machine Maintenance",
  "Electrical / Wiring",
  "Plumbing / Water Leakage",
  "Gas Stove / Kitchen Appliance",
  "Wi-Fi / Internet",
  "Furniture / Fittings",
  "Cleanliness Issue",
  "Other"
];

const INSTRUCTIONS = [
"Vessels: Everyone must clean the vessels on their assigned day itself. Do not leave unwashed vessels for the next day.",
"Room Cleaning: Every room must be cleaned at least twice a week. Keep the floor, beds, tables, and other areas neat and tidy.",
"Hall Cleaning: Everyone is responsible for maintaining the hall clean and organized. Do not leave personal belongings, food items, or waste in the hall.",
"Waste Disposal: Everyone must throw waste in serial-wise order according to the assigned schedule. Do not skip your turn.",
"Dustbins: Always put waste inside the dustbin. Do not throw waste on the floor, outside the room, or in common areas.",
"Kitchen: After using the kitchen, clean the stove, platform, sink, and other areas used. Do not leave food waste behind.",
"Food & Leftovers: Do not leave leftover food uncovered. Dispose of spoiled or unwanted food properly.",
"Personal Belongings: Keep shoes, clothes, bags, and other personal items properly arranged. Avoid blocking common spaces.",
"Bathroom: Everyone should keep the bathroom clean after use. Do not leave water, soap, or other waste scattered around.",
"Common Responsibility: Cleaning is everyone's responsibility. Do not depend on one person to clean common areas.",
"Switches & Appliances: Switch off lights, fans, ACs, and other electrical appliances when leaving the room or common area.",
"Water: Avoid unnecessary wastage of water and make sure taps are properly closed after use.",
"Noise: Maintain reasonable noise levels, especially during sleeping and study hours.",
"Damage: Report any damage, leakage, electrical issue, or maintenance problem immediately.",
"Cooperation: Everyone is expected to follow the cleaning schedule and cooperate with others to maintain a clean and comfortable environment."
];

const ICONS = {
  living: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>`,
  kitchen: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3v8a4 4 0 0 0 8 0V3"/><path d="M8 3v8"/><path d="M17 3v18"/><path d="M14 8h6"/></svg>`,
  bedroomA: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M3 18h18"/><path d="M5 10V6h6v4"/></svg>`,
  bedroomB: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M3 18h18"/><path d="M13 10V6h6v4"/></svg>`,
  bathroomA: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3z"/><path d="M7 12V6a2 2 0 0 1 3.5-1.3"/><path d="M8 20v2M16 20v2"/></svg>`,
  bathroomB: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3z"/><path d="M7 12V6a2 2 0 0 1 3.5-1.3"/><path d="M8 20v2M16 20v2"/></svg>`,
  duty: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/></svg>`,
  expenses: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  rent: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20M6 15h4"/></svg>`,
  complaints: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 8v4M12 15h.01"/></svg>`,
  meetings: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="M17 9l4-2v10l-4-2"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-4-1L3 20l1.1-3.3A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 11.5 3 8.5 8.5 0 0 1 21 11.5z"/></svg>`,
  dailyExpenses: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M12 12.5v5M10 13.3h4a1.2 1.2 0 0 1 0 2.4h-4a1.2 1.2 0 0 0 0 2.4h4"/></svg>`,
  roommates: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6"/><circle cx="17" cy="9" r="2.6"/><path d="M14.8 14.2c2.4.3 4.2 2.4 4.2 5.3"/></svg>`,
  gallery: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5.5-5.5a1.5 1.5 0 0 0-2.1 0L4 19"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`
};

// --- Appearance: themes & fonts ---------------------------------------
// Personal, per-device display preferences (not shared house data), stored
// in localStorage and applied by setting a few CSS custom properties plus
// a couple of data- attributes on <html>. Adding a new theme/font later is
// just adding an entry here.
const THEMES = {
  gold: {
    label: "Gold & Black",
    vars: {
      "--bg":"#0E0D0B", "--panel":"rgba(26,22,15,0.62)", "--panel-2":"rgba(212,168,83,0.14)",
      "--line":"rgba(212,168,83,0.30)", "--ink":"#F3E7C9", "--accent":"#D4A853",
      "--accent-soft":"#E9CD8E", "--muted":"#C9BC94", "--danger":"#FF8F7E", "--good":"#63D6A4",
      "--modal-bg":"rgba(18,15,10,0.94)",
      "--body-bg":"radial-gradient(circle at 12% 8%, rgba(212,168,83,.16), transparent 42%), radial-gradient(circle at 88% 18%, rgba(212,168,83,.08), transparent 45%), linear-gradient(160deg, #171410 0%, #0E0D0B 45%, #100E0A 100%)"
    }
  },
  classic: {
    label: "Classic Sky",
    vars: {
      "--bg":"#F5F7FB", "--panel":"rgba(255,255,255,0.60)", "--panel-2":"rgba(240,160,48,0.12)",
      "--line":"rgba(255,255,255,0.55)", "--ink":"#16273F", "--accent":"#F0A030",
      "--accent-soft":"#F7C687", "--muted":"#5C6B84", "--danger":"#C0392B", "--good":"#1B8A5A",
      "--modal-bg":"rgba(255,255,255,0.94)",
      "--body-bg":"radial-gradient(circle at 12% 8%, rgba(240,160,48,.18), transparent 42%), radial-gradient(circle at 88% 18%, rgba(22,39,63,.10), transparent 45%), linear-gradient(160deg, #FDF1E1 0%, #F5F7FB 38%, #EAF0FB 100%)"
    }
  },
  emerald: {
    label: "Emerald",
    vars: {
      "--bg":"#F3FAF6", "--panel":"rgba(255,255,255,0.62)", "--panel-2":"rgba(27,138,90,0.12)",
      "--line":"rgba(255,255,255,0.55)", "--ink":"#0F2A20", "--accent":"#1B8A5A",
      "--accent-soft":"#7FCBA6", "--muted":"#54786B", "--danger":"#C0392B", "--good":"#1B8A5A",
      "--modal-bg":"rgba(255,255,255,0.94)",
      "--body-bg":"radial-gradient(circle at 12% 8%, rgba(27,138,90,.16), transparent 42%), radial-gradient(circle at 88% 18%, rgba(15,42,32,.08), transparent 45%), linear-gradient(160deg, #EAF7EF 0%, #F3FAF6 40%, #E7F3FB 100%)"
    }
  },
  sunset: {
    label: "Sunset",
    vars: {
      "--bg":"#FFF6F1", "--panel":"rgba(255,255,255,0.62)", "--panel-2":"rgba(224,90,57,0.12)",
      "--line":"rgba(255,255,255,0.55)", "--ink":"#401C12", "--accent":"#E05A39",
      "--accent-soft":"#F5AD8F", "--muted":"#8A6558", "--danger":"#C0392B", "--good":"#1B8A5A",
      "--modal-bg":"rgba(255,255,255,0.94)",
      "--body-bg":"radial-gradient(circle at 12% 8%, rgba(224,90,57,.18), transparent 42%), radial-gradient(circle at 88% 18%, rgba(64,28,18,.08), transparent 45%), linear-gradient(160deg, #FFEFE6 0%, #FFF6F1 40%, #FDEDE3 100%)"
    }
  },
  ocean: {
    label: "Ocean Blue",
    vars: {
      "--bg":"#F0F7FB", "--panel":"rgba(255,255,255,0.62)", "--panel-2":"rgba(19,110,163,0.12)",
      "--line":"rgba(255,255,255,0.55)", "--ink":"#0B2E42", "--accent":"#136EA3",
      "--accent-soft":"#7EC1E0", "--muted":"#4F7286", "--danger":"#C0392B", "--good":"#1B8A5A",
      "--modal-bg":"rgba(255,255,255,0.94)",
      "--body-bg":"radial-gradient(circle at 12% 8%, rgba(19,110,163,.16), transparent 42%), radial-gradient(circle at 88% 18%, rgba(11,46,66,.08), transparent 45%), linear-gradient(160deg, #E7F3FA 0%, #F0F7FB 40%, #E4EFF9 100%)"
    }
  },
  rosequartz: {
    label: "Rose Quartz",
    vars: {
      "--bg":"#FDF3F5", "--panel":"rgba(255,255,255,0.62)", "--panel-2":"rgba(200,90,120,0.12)",
      "--line":"rgba(255,255,255,0.55)", "--ink":"#4A1E2A", "--accent":"#C85A78",
      "--accent-soft":"#EFB2C2", "--muted":"#8A6270", "--danger":"#C0392B", "--good":"#1B8A5A",
      "--modal-bg":"rgba(255,255,255,0.94)",
      "--body-bg":"radial-gradient(circle at 12% 8%, rgba(200,90,120,.16), transparent 42%), radial-gradient(circle at 88% 18%, rgba(74,30,42,.08), transparent 45%), linear-gradient(160deg, #FCE8EC 0%, #FDF3F5 40%, #FBEAF0 100%)"
    }
  },
  charcoal: {
    label: "Charcoal & Silver",
    vars: {
      "--bg":"#15171A", "--panel":"rgba(32,35,40,0.68)", "--panel-2":"rgba(200,205,214,0.12)",
      "--line":"rgba(200,205,214,0.25)", "--ink":"#F1F2F4", "--accent":"#C9CFD8",
      "--accent-soft":"#E4E7EC", "--muted":"#B7BCC5", "--danger":"#FF8F7E", "--good":"#63D6A4",
      "--modal-bg":"rgba(22,24,28,0.94)",
      "--body-bg":"radial-gradient(circle at 12% 8%, rgba(201,207,216,.12), transparent 42%), radial-gradient(circle at 88% 18%, rgba(201,207,216,.06), transparent 45%), linear-gradient(160deg, #1D2024 0%, #15171A 45%, #17191C 100%)"
    }
  },
  forest: {
    label: "Forest",
    vars: {
      "--bg":"#101B14", "--panel":"rgba(24,38,28,0.64)", "--panel-2":"rgba(94,168,107,0.14)",
      "--line":"rgba(94,168,107,0.28)", "--ink":"#E6F1E7", "--accent":"#5EA86B",
      "--accent-soft":"#9AD1A2", "--muted":"#A9C2AC", "--danger":"#FF8F7E", "--good":"#7FE0A0",
      "--modal-bg":"rgba(14,22,16,0.94)",
      "--body-bg":"radial-gradient(circle at 12% 8%, rgba(94,168,107,.16), transparent 42%), radial-gradient(circle at 88% 18%, rgba(94,168,107,.08), transparent 45%), linear-gradient(160deg, #16261A 0%, #101B14 45%, #121F16 100%)"
    }
  },
  lavender: {
    label: "Lavender",
    vars: {
      "--bg":"#F6F4FB", "--panel":"rgba(255,255,255,0.62)", "--panel-2":"rgba(124,92,196,0.12)",
      "--line":"rgba(255,255,255,0.55)", "--ink":"#2C2247", "--accent":"#7C5CC4",
      "--accent-soft":"#C3AEEB", "--muted":"#6E6489", "--danger":"#C0392B", "--good":"#1B8A5A",
      "--modal-bg":"rgba(255,255,255,0.94)",
      "--body-bg":"radial-gradient(circle at 12% 8%, rgba(124,92,196,.16), transparent 42%), radial-gradient(circle at 88% 18%, rgba(44,34,71,.08), transparent 45%), linear-gradient(160deg, #F1ECFB 0%, #F6F4FB 40%, #EFEAFB 100%)"
    }
  },
  midnight: {
    label: "Midnight Indigo",
    vars: {
      "--bg":"#10121E", "--panel":"rgba(28,31,50,0.66)", "--panel-2":"rgba(108,124,246,0.14)",
      "--line":"rgba(108,124,246,0.28)", "--ink":"#E7E8F7", "--accent":"#6C7CF6",
      "--accent-soft":"#AAB4FA", "--muted":"#A2A6C4", "--danger":"#FF8F7E", "--good":"#63D6A4",
      "--modal-bg":"rgba(14,16,26,0.94)",
      "--body-bg":"radial-gradient(circle at 12% 8%, rgba(108,124,246,.16), transparent 42%), radial-gradient(circle at 88% 18%, rgba(108,124,246,.08), transparent 45%), linear-gradient(160deg, #171A2C 0%, #10121E 45%, #131526 100%)"
    }
  }
};
const DEFAULT_THEME = "gold";

// "clean" (Inter) is the default now — a plain, highly-legible sans-serif,
// the same family of everyday UI font WhatsApp/most chat apps use. The more
// decorative display faces (Cormorant, Playfair) are still offered for
// anyone who wants that look, but nobody is opted into "stylish" text by
// default anymore.
const FONTS = {
  clean:   { label:"Clean (Inter)", display:"'Inter', sans-serif", body:"'Inter', sans-serif", googleFamily:"Inter:wght@500;600;700;800" },
  roboto:  { label:"Roboto", display:"'Roboto', sans-serif", body:"'Roboto', sans-serif", googleFamily:"Roboto:wght@500;600;700;800" },
  modern:  { label:"Modern (Poppins)", display:"'Poppins', sans-serif", body:"'Poppins', sans-serif", googleFamily:"Poppins:wght@500;600;700;800" },
  nunito:  { label:"Rounded (Nunito)", display:"'Nunito', sans-serif", body:"'Nunito', sans-serif", googleFamily:"Nunito:wght@600;700;800" },
  classic: { label:"Classic (Cormorant + Work Sans)", display:"'Cormorant Garamond', serif", body:"'Work Sans', sans-serif", googleFamily:"Cormorant+Garamond:ital,wght@0,600;0,700;1,700&family=Work+Sans:wght@600;700;800" },
  elegant: { label:"Elegant (Playfair + Nunito)", display:"'Playfair Display', serif", body:"'Nunito', sans-serif", googleFamily:"Playfair+Display:wght@700;800&family=Nunito:wght@600;700;800" }
};
const DEFAULT_FONT = "clean";

const APPEARANCE_KEY = "ms-villa:appearance";
function getAppearance(){
  try{
    const v = JSON.parse(localStorage.getItem(APPEARANCE_KEY) || "{}");
    return {
      theme: THEMES[v.theme] ? v.theme : DEFAULT_THEME,
      font: FONTS[v.font] ? v.font : DEFAULT_FONT,
      bold: v.bold === true
    };
  }catch(e){ return { theme: DEFAULT_THEME, font: DEFAULT_FONT, bold:false }; }
}
// theme/font behave as before (pass null to leave unchanged); bold is a
// separate tri-state: pass `undefined` to leave it as-is, or true/false to set it.
function setAppearance(theme, font, bold){
  const cur = getAppearance();
  const next = { theme: theme || cur.theme, font: font || cur.font, bold: (bold===undefined ? cur.bold : bold) };
  try{ localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next)); }catch(e){}
  applyAppearance(next);
}
const loadedFontFamilies = new Set();
function ensureFontLoaded(fontKey){
  const f = FONTS[fontKey] || FONTS[DEFAULT_FONT];
  if(loadedFontFamilies.has(fontKey)) return;
  loadedFontFamilies.add(fontKey);
  if(fontKey==="clean") return; // already linked in index.html
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${f.googleFamily}&display=swap`;
  document.head.appendChild(link);
}
function applyAppearance(pref){
  pref = pref || getAppearance();
  const theme = THEMES[pref.theme] || THEMES[DEFAULT_THEME];
  const font = FONTS[pref.font] || FONTS[DEFAULT_FONT];
  ensureFontLoaded(pref.font);
  const root = document.documentElement.style;
  Object.entries(theme.vars).forEach(([k,v])=> root.setProperty(k, v));
  root.setProperty("--font-display", font.display);
  root.setProperty("--font-body", font.body);
  document.documentElement.setAttribute("data-theme", pref.theme);
  document.documentElement.setAttribute("data-font", pref.font);
  document.documentElement.setAttribute("data-bold", pref.bold ? "1" : "0");
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", theme.vars["--ink"]);
}

const ROOM_NOTES = {
  living: "Shared seating area. Keep the sofa, tables, and floor free of personal items after use.",
  kitchen: "Gas stove, sink, and storage cabinets. Clean the platform and stove after every use.",
  bedroomA: "Shared bedroom — 3 residents.",
  bedroomB: "Shared bedroom — 5 residents.",
  bathroomA: "Keep water and soap off the floor after use.",
  bathroomB: "Keep water and soap off the floor after use."
};

function ledgerRowFor(username){
  const member = state.members.find(m=>m.username===username);
  if(!member) return null;
  const first = member.name.split(" ")[0].toLowerCase();
  return state.ledger.rows.find(r => r.name.toLowerCase().includes(first)) || null;
}

// --- Ledger auto-calculation helpers ---
// Total Bills can be auto-summed from the Shared Bills list, and Remaining
// Balance can be auto-derived from Total Bills minus what's been collected —
// but an admin can flip either one to manual entry from Edit Room Expenses,
// since real-world figures (carried-forward amounts, adjustments) don't
// always fit a clean formula.
function sumBills(ledger){
  return ledger.bills.reduce((s,b)=> s + (Number(b.amount)||0), 0);
}
function sumPaid(ledger){
  return ledger.rows.reduce((s,r)=> s + (Number(r.paid)||0), 0);
}
function effectiveTotalBills(ledger){
  return ledger.totalBillsAuto ? sumBills(ledger) : (Number(ledger.totalBills)||0);
}
function effectiveRemaining(ledger){
  return ledger.remainingAuto ? (effectiveTotalBills(ledger) - sumPaid(ledger)) : (Number(ledger.remaining)||0);
}
function sumSplitExpenses(ledger){
  return ledger.rows.reduce((s,r)=> s + (Number(r.split)||0), 0);
}

// --- Food poll helpers --------------------------------------------------
// Everyone-can-vote Yes/No poll on whether food should be prepared every
// day, shown alongside Today's Menu on Room Expenses. One vote per member,
// changeable any time.
function foodPollCounts(){
  const votes = (state.foodPoll && state.foodPoll.votes) || {};
  let yes = 0, no = 0;
  Object.values(votes).forEach(v=>{ if(v==="yes") yes++; else if(v==="no") no++; });
  return { yes, no, total: yes + no };
}
function myFoodVote(){
  const me = state.session ? state.session.username : null;
  const votes = (state.foodPoll && state.foodPoll.votes) || {};
  return me ? (votes[me] || null) : null;
}

// --- Daily Expenses helpers -------------------------------------------
// A simple day-wise spending log, separate from the monthly Room Expenses
// ledger above. Open to every member (not admin-only) — each entry is
// { id, date: "YYYY-MM-DD", amount: number, note: string, addedBy: username }.
function sumDailyExpenses(list){
  return (list||[]).reduce((s,e)=> s + (Number(e.amount)||0), 0);
}
function dailyExpensesForMonth(list, monthKey){
  return (list||[]).filter(e => (e.date||"").slice(0,7) === monthKey);
}
// Human-readable label for a "YYYY-MM-DD" key, used to group the daily
// expenses log day-wise (e.g. "Tue, 09 Sep 2026"). Falls back to the raw
// string if it doesn't parse as a date.
function formatDayLabel(dateStr){
  if(!dateStr) return "No date";
  const d = new Date(dateStr+"T00:00:00");
  if(isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short", year:"numeric" });
}

const $ = (sel, el=document) => el.querySelector(sel);
const app = $("#app");
const todayKey = () => new Date().toISOString().slice(0,10);
const nameFor = (username, members) => (members.find(m=>m.username===username)||{}).name || username;
const adminUsernames = () => state.members.filter(m=>m.admin).map(m=>m.username);
const inr = (n) => (n<0? "-₹" + Math.abs(n).toLocaleString("en-IN") : "₹" + n.toLocaleString("en-IN"));

// Resizes/recompresses a picked photo before it's ever turned into base64
// and stored. A raw phone-camera photo can be 3-8MB, which blows past the
// shared data function's request-size limit — the save then fails on the
// server (silently, from the person's point of view) and the next
// background sync overwrites the local change with old data, which looks
// exactly like "the photo never uploaded."
//
// `maxDim`/`quality` are now treated as a *starting point*, not a fixed
// squeeze — most phone photos land well under the size cap at this
// starting quality and come out visually indistinguishable from the
// original. Only when the encoded result is still too large does this
// step the quality down (and, as a last resort, the dimensions) in small
// increments until it safely fits, so an ordinary photo keeps its quality
// and only a huge/detailed one gives up a little to guarantee it actually
// saves.
const IMAGE_SAFE_BYTES = 3 * 1024 * 1024; // ~3MB encoded, comfortably under serverless function request-size limits (base64 adds ~33% on top of this)

function dataUrlByteLength(dataUrl){
  const i = dataUrl.indexOf(",");
  const b64 = i === -1 ? dataUrl : dataUrl.slice(i + 1);
  return Math.floor(b64.length * 0.75);
}

function readAndCompressImage(file, maxDim=1600, quality=0.92){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=> reject(new Error("Could not read the file."));
    reader.onload = ()=>{
      const img = new Image();
      img.onerror = ()=> reject(new Error("Could not read that image."));
      img.onload = ()=>{
        const encodeAt = (dim, q)=>{
          let { width, height } = img;
          if(width > dim || height > dim){
            if(width >= height){ height = Math.round(height * (dim/width)); width = dim; }
            else { width = Math.round(width * (dim/height)); height = dim; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          return canvas.toDataURL("image/jpeg", q);
        };

        let dim = maxDim, q = quality;
        let out = encodeAt(dim, q);
        // Step quality down first (preserves resolution/detail the longest),
        // then fall back to also shrinking dimensions if it's still too big
        // (e.g. a very large, detailed photo).
        for(let i=0; i<6 && dataUrlByteLength(out) > IMAGE_SAFE_BYTES; i++){
          if(q > 0.5){ q -= 0.1; }
          else { dim = Math.round(dim * 0.85); }
          out = encodeAt(dim, q);
        }
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

let state = {
  members: null,
  rooms: null,
  notifications: [],
  attendance: {},
  vesselOverrides: {},
  cookingOverrides: {},
  vesselProofs: {}, // date -> { username, photoId, time } — cleaning-done proof photo
  complaints: [],
  cookingStaff: null,
  waterDuty: null,
  weeklyVesselDuty: null,
  ledger: null,
  meetings: [],
  dailyExpenses: [],
  gallery: [],
  supportPhone: null,
  rentInfo: null,     // { upiId, payeeName } — admin-editable, falls back to RENT_INFO default
  transactions: [],   // self-reported rent payment log: { id, username, amount, status, note, photoId, createdAt }
  foodMenu: null,      // string — "Today's Menu", shown as the Food column on Room Expenses
  foodPoll: null,      // { question, votes:{username:"yes"|"no"} } — everyone-can-vote daily-food poll
  session: null,   // {username}
  view: "login",
  roomId: null,
  pendingOtp: null, // {phone, code, expiresAt}
  photoCache: {}   // photoId -> data URL, populated on demand by loadPhoto()
};

// --- Shared storage layer -------------------------------------------------
// This app used to run inside a Claude artifact, backed by window.storage.
// Deployed standalone on Netlify, the equivalent shared store is a small
// serverless function (netlify/functions/data.js) backed by Netlify Blobs.
// Every device that opens the site reads/writes the same keys there, so
// everyone in the house sees the same data. localStorage is kept as a
// same-device fallback for when the function can't be reached (offline).
const DATA_ENDPOINT = "/.netlify/functions/data";

async function sset(key, value){
  localStorage.setItem(key, JSON.stringify(value)); // instant local echo
  try{
    const res = await fetch(DATA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value })
    });
    if(!res.ok){
      // Common cause: a payload that's too large (e.g. an uncompressed
      // photo pushed the whole record over the shared function's request
      // size limit). Whatever the reason, this save did NOT reach the
      // server — the next background sync will overwrite the local echo
      // above with the old server value, silently undoing this change,
      // unless the caller surfaces this failure to the person.
      console.error(`sset failed to save "${key}" to the server (status ${res.status}). Change is local-only and will likely be overwritten on next sync.`);
      return false;
    }
    return true;
  }catch(e){
    console.error("sset (offline, saved locally only):", e);
    return false;
  }
}
async function sget(key){
  try{
    const res = await fetch(`${DATA_ENDPOINT}?key=${encodeURIComponent(key)}`);
    if(res.ok){
      const { value } = await res.json();
      if(value !== null && value !== undefined){
        localStorage.setItem(key, JSON.stringify(value));
        return value;
      }
    }
  }catch(e){ /* offline - fall through to local cache below */ }
  const v = localStorage.getItem(key);
  return v ? JSON.parse(v) : null;
}

// Fetches many keys in ONE network round trip instead of one request per
// key. This is what loadCore() uses now — it used to fire off ~19 separate
// sget() calls (even in parallel, that's still 19 separate serverless
// invocations, each with its own cold-start/latency), which is what made
// the app feel slow to open and slow to background-refresh every 6s.
// Returns a plain { key: value } object; falls back to per-key localStorage
// cache (same as sget) for any key the batch call couldn't reach.
async function sgetMany(keys){
  const out = {};
  try{
    const res = await fetch(DATA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "batchGet", keys })
    });
    if(res.ok){
      const { values } = await res.json();
      keys.forEach(k=>{
        const v = values ? values[k] : undefined;
        if(v !== null && v !== undefined){
          localStorage.setItem(k, JSON.stringify(v));
          out[k] = v;
        } else {
          out[k] = null;
        }
      });
      return out;
    }
  }catch(e){ /* offline - fall through to local cache below */ }
  keys.forEach(k=>{
    const v = localStorage.getItem(k);
    out[k] = v ? JSON.parse(v) : null;
  });
  return out;
}

// Atomically appends one item to a shared list, safe against two people (or
// a background sync racing a live add) saving at the same moment. The old
// pattern everywhere in this app was: push the new item onto the in-memory
// array, then sset() the WHOLE array back to the server. If two saves to
// the same key landed close together, whichever one reached the server
// second silently overwrote the first person's new entry — that's the
// "I added something and it disappeared" bug. This instead asks the server
// to do the read-append-write itself (with a compare-and-swap retry loop),
// so both additions always survive regardless of timing. Returns the
// server's authoritative full list on success, or null if it couldn't
// reach the server (caller should keep its optimistic local copy and let
// the next sync reconcile it).
async function sappend(key, item, idField){
  try{
    const res = await fetch(DATA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "append", key, item, idField })
    });
    if(!res.ok) return null;
    const { value } = await res.json();
    if(value !== undefined){ localStorage.setItem(key, JSON.stringify(value)); }
    return value;
  }catch(e){
    console.error("sappend (offline):", e);
    return null;
  }
}

// --- Photo storage, kept separate from the records that reference them ---
// Early on, photos were embedded as base64 directly inside the shared
// members/daily-expenses/complaints arrays. That meant every single save —
// even just editing someone's name — re-sent the WHOLE array, photos and
// all, and that array only ever grew. It eventually exceeded the shared
// data function's request-size limit, which failed silently and looked
// like "nothing is saving." Now every photo lives under its own small key
// (`ms-villa:photo:<id>`) and records only ever store a short `photoId`
// string, so the "hot" shared records stay tiny no matter how many photos
// pile up.
function savePhoto(id, dataUrl){
  return sset(`ms-villa:photo:${id}`, dataUrl);
}
async function loadPhoto(id){
  if(!id) return null;
  if(state.photoCache[id]) return state.photoCache[id];
  const v = await sget(`ms-villa:photo:${id}`);
  if(v) state.photoCache[id] = v;
  return v;
}
// Fetches (and caches) every photo referenced by a list of ids at once,
// skipping ones already cached. Call this before rendering a screen that
// shows photos so the img src is ready by the time the HTML is built.
async function preloadPhotos(ids){
  const need = [...new Set(ids)].filter(id => id && !state.photoCache[id]);
  if(!need.length) return;
  await Promise.all(need.map(loadPhoto));
}

// --- "Keep me logged in" session persistence -------------------------
// This is deliberately a plain, per-device localStorage entry (not synced
// through sset/sget) — each phone/browser remembers its own signed-in user,
// the same way a "remember me" cookie would on a normal site.
const SESSION_KEY = "ms-villa:remembered-session";
function rememberSession(username){
  try{ localStorage.setItem(SESSION_KEY, JSON.stringify({ username })); }catch(e){}
}
function forgetSession(){
  try{ localStorage.removeItem(SESSION_KEY); }catch(e){}
}
function getRememberedSession(){
  try{
    const v = localStorage.getItem(SESSION_KEY);
    return v ? JSON.parse(v) : null;
  }catch(e){ return null; }
}

// Loads every shared key the app needs. This used to fire off ~17 sget()
// calls one after another with `await` — each one a full network round
// trip — which is what made the app feel slow to open and slow to
// background-refresh (this runs on every syncNow() tick too, every 6s).
// Firing them all at once with Promise.all cuts startup time down to
// roughly the time of the single slowest request instead of the sum of
// all of them.
async function loadCore(){
  const KEYS = [
    "ms-villa:members", "ms-villa:rooms", "ms-villa:vessel-overrides",
    "ms-villa:cooking-overrides", "ms-villa:vessel-proofs", "ms-villa:complaints",
    "ms-villa:cooking-staff", "ms-villa:water-duty", "ms-villa:vessel-weekly",
    "ms-villa:ledger", "ms-villa:meetings", "ms-villa:support-phone",
    "ms-villa:daily-expenses", "ms-villa:gallery", NOTIF_LOG_KEY,
    "ms-villa:rent-info", "ms-villa:transactions", "ms-villa:food-menu",
    "ms-villa:food-poll"
  ];
  const v = await sgetMany(KEYS);
  const [
    members, rooms, vesselOverrides, cookingOverrides, vesselProofs, complaints,
    cookingStaff, waterDuty, weeklyVesselDuty, ledger, meetings, supportPhone,
    dailyExpenses, gallery, notifications, rentInfo, transactions,
    foodMenu, foodPoll
  ] = KEYS.map(k => v[k]);

  state.members = members || DEFAULT_MEMBERS.map(m=>({...m, password:DEFAULT_PASSWORD}));
  state.rooms = rooms || DEFAULT_ROOMS;
  state.vesselOverrides = vesselOverrides || {};
  state.cookingOverrides = cookingOverrides || {};
  state.vesselProofs = vesselProofs || {};
  state.complaints = complaints || [];
  state.cookingStaff = cookingStaff || [...DEFAULT_COOKING_STAFF];
  state.waterDuty = waterDuty || DEFAULT_WATER_CAN_DUTY;
  state.weeklyVesselDuty = weeklyVesselDuty || {...DEFAULT_WEEKLY_VESSEL_DUTY};
  state.ledger = ledger || JSON.parse(JSON.stringify(DEFAULT_LEDGER));
  // Older saved ledgers won't have these auto-calculate flags yet — default them
  // to "off" so existing figures don't silently change for anyone already using the app.
  if(state.ledger.totalBillsAuto===undefined) state.ledger.totalBillsAuto = false;
  if(state.ledger.remainingAuto===undefined) state.ledger.remainingAuto = false;
  // Older saved ledgers won't have a per-member "Split Expenses" figure yet — default to 0.
  state.ledger.rows.forEach(r=>{ if(r.split===undefined) r.split = 0; });
  state.meetings = meetings || [];
  state.supportPhone = supportPhone || "";
  state.dailyExpenses = dailyExpenses || [];
  state.gallery = gallery || [];
  state.notifications = notifications || [];
  // Admin-editable UPI ID / payee name (Settings → Payment Settings). Falls
  // back to the hardcoded RENT_INFO default the very first time the app runs.
  state.rentInfo = rentInfo || {...RENT_INFO};
  state.transactions = transactions || [];
  state.foodMenu = (foodMenu===null || foodMenu===undefined) ? DEFAULT_FOOD_MENU : foodMenu;
  state.foodPoll = foodPoll || JSON.parse(JSON.stringify(DEFAULT_FOOD_POLL));
  if(!state.foodPoll.votes) state.foodPoll.votes = {};

  // Anything that came back empty gets seeded back to the server so future
  // loads (and other people's devices) see the same defaults. Fired without
  // awaiting — seeding shouldn't hold up the screen the person is waiting on.
  const seeds = [];
  if(!members) seeds.push(["ms-villa:members", state.members]);
  if(!rooms) seeds.push(["ms-villa:rooms", state.rooms]);
  if(!cookingStaff) seeds.push(["ms-villa:cooking-staff", state.cookingStaff]);
  if(!waterDuty) seeds.push(["ms-villa:water-duty", state.waterDuty]);
  if(!weeklyVesselDuty) seeds.push(["ms-villa:vessel-weekly", state.weeklyVesselDuty]);
  if(!ledger) seeds.push(["ms-villa:ledger", state.ledger]);
  if(!rentInfo) seeds.push(["ms-villa:rent-info", state.rentInfo]);
  if(!foodPoll) seeds.push(["ms-villa:food-poll", state.foodPoll]);
  if(seeds.length) Promise.all(seeds.map(([k,v])=> sset(k,v))).catch(()=>{});
}

// --- In-app Notification Center ---------------------------------------
// A persisted, shared log of every notification the house has sent
// (independent of OS push, which needs the browser permission granted and
// VAPID keys configured on the server). Every resident can open
// Notifications from the bell icon and see the full history even if a
// push never reached their device — this is what actually guarantees
// "everyone sees it", with push as a bonus when it's available.
const NOTIF_LOG_KEY = "ms-villa:notifications";
const NOTIF_SEEN_KEY = "ms-villa:notif-last-seen";
// `to`: null/undefined means "everyone"; an array of usernames means the
// notification was only meant for those specific residents, and is hidden
// from everyone else's Notification Center / bell count.
async function appendNotificationLog(title, body, to){
  const log = (await sget(NOTIF_LOG_KEY)) || [];
  log.push({ id: "n_"+Date.now()+Math.random().toString(36).slice(2,6), title, body, to: (to && to.length) ? to : null, createdAt: new Date().toISOString(), by: state.session ? state.session.username : null });
  // keep the log from growing forever
  while(log.length > 200) log.shift();
  await sset(NOTIF_LOG_KEY, log);
  state.notifications = log;
  return log;
}
function getLastSeenNotifTime(){
  try{ return localStorage.getItem(NOTIF_SEEN_KEY) || ""; }catch(e){ return ""; }
}
function markNotificationsSeen(){
  try{ localStorage.setItem(NOTIF_SEEN_KEY, new Date().toISOString()); }catch(e){}
}
// Notifications addressed to specific residents only show up for those
// residents (and the admin who sent them); everyone else never sees them.
function notificationsForMe(){
  const me = state.session ? state.session.username : null;
  return (state.notifications||[]).filter(n=> !n.to || n.to.includes(me) || n.by===me);
}
function unreadNotifCount(){
  const seen = getLastSeenNotifTime();
  return notificationsForMe().filter(n=> n.createdAt > seen).length;
}

async function loadAttendance(roomId, date){
  const key = `ms-villa:attendance:${roomId}:${date}`;
  return (await sget(key)) || {};
}
async function saveAttendance(roomId, date, data){
  const key = `ms-villa:attendance:${roomId}:${date}`;
  return await sset(key, data);
}

function vesselOrder(){ return state.members.map(m=>m.username); }
function vesselDutyFor(date){
  if(state.vesselOverrides[date]) return state.vesselOverrides[date];
  const day = new Date(date+"T00:00:00Z").getUTCDay();
  return state.weeklyVesselDuty[day] || null;
}
function cookingStaffFor(date){
  if(state.cookingOverrides[date] && state.cookingOverrides[date].length) return state.cookingOverrides[date];
  return state.cookingStaff;
}

// Records (or clears) the vessel-cleaning proof photo for a given date.
// Stored as its own small shared key so it stays independent of the
// weekly schedule/overrides. Photo bytes live under their own photoId key
// (same pattern as every other photo in the app) so this record stays tiny.
async function saveVesselProof(date, entry){
  state.vesselProofs[date] = entry;
  return await sset("ms-villa:vessel-proofs", state.vesselProofs);
}

