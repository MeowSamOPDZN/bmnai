/* ============================================================
   Before MNAI — app logic (Firebase auth + Firestore sync + MNAI 9)
   ============================================================ */
import { auth, db, googleProvider } from "./firebase-init.js";
import {
  signInWithPopup, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, getDoc, setDoc, addDoc, updateDoc,
  query, where, orderBy, limit, getDocs, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const mq = q => (typeof matchMedia === "function") ? matchMedia(q).matches : false;
const reduceMotion = mq("(prefers-reduced-motion: reduce)");
const isNarrow = () => mq("(max-width:860px)") || window.innerWidth <= 860;
const wait = ms => new Promise(r => setTimeout(r, reduceMotion ? 0 : ms));

const app        = $("#app");
const backdrop   = $("#backdrop");
const scrollEl   = $("#scroll");
const signinView = $("#signinView");
const noticeView = $("#noticeView");
const heroView   = $("#heroView");
const chatView   = $("#chatView");
const thread     = $("#thread");
const dock       = $("#composerDock");
const recentList = $("#recentList");
const emptyRecents = $("#emptyRecents");

const MODEL_NAME = "MNAI 9";
const DEFAULT_NOTICE = "Before MNAI is launching soon — check back shortly.";

let user = null;
let currentChatId = null;
let busy = false;
let unsubChats = null;
let unsubMsgs = null;

/* ---------------- icons ---------------- */
const I = {
  copy:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  chat:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1L3 20l1.1-5.3A8.5 8.5 0 1 1 21 11.5z"/></svg>',
  like:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm2 1.5 3.5-7a1.6 1.6 0 0 1 3 1.2L14 10h7.5a2 2 0 0 1 2 2.4l-1.6 6.4a2 2 0 0 1-2 1.6H9z"/></svg>',
  dislike:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 13V2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3zm-2-1.5L11.5 18a1.6 1.6 0 0 1-3-1.2L10 13H2.5a2 2 0 0 1-2-2.4l1.6-6.4a2 2 0 0 1 2-1.6H15z"/></svg>',
  refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>'
};

/* ---------------- markdown renderer ---------------- */
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return s;
}
const isTableRow = l => /^\s*\|.*\|\s*$/.test(l);
const isDelimRow = l => /-/.test(l) && /^\s*\|?[\s:\-|]+\|?\s*$/.test(l);

function tableHTML(rows) {
  const body = rows.filter(r => !isDelimRow(r));
  if (!body.length) return "";
  const cells = r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => inline(c.trim()));
  const head = cells(body[0]);
  const rest = body.slice(1);
  return `<div class="table-block anim-in">
    <div class="table-head table-head-min"><button class="copy-table" type="button">${I.copy}<span>Copy table</span></button></div>
    <div class="table-wrap"><table>
      <thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rest.map((r, ri) => {
        const c = cells(r);
        return `<tr style="animation-delay:${Math.min(ri * 0.06, 0.4)}s">${c.map((v, j) => `<td class="${j === 0 ? "exercise" : ""}">${v}</td>`).join("")}</tr>`;
      }).join("")}</tbody>
    </table></div></div>`;
}

function renderMarkdown(src) {
  const lines = String(src || "").split("\n");
  let html = "", i = 0, para = [];
  const flush = () => {
    if (para.length) { html += `<p class="ai-text anim-in">${para.map(inline).join("<br>")}</p>`; para = []; }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (isTableRow(line)) {
      flush();
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(lines[i++]);
      html += tableHTML(rows);
      continue;
    }
    if (/^\s*$/.test(line)) { flush(); i++; continue; }
    const hm = line.match(/^\s{0,3}(#{1,3})\s+(.*)/);
    if (hm) { flush(); html += `<p class="ai-text ai-h${hm[1].length} anim-in">${inline(hm[2])}</p>`; i++; continue; }
    const lm = line.match(/^\s*[-*]\s+(.*)/);
    if (lm) {
      flush();
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*[-*]\s+(.*)/);
        if (!m) break;
        items.push(`<li>${inline(m[1])}</li>`); i++;
      }
      html += `<ul class="ai-list anim-in">${items.join("")}</ul>`;
      continue;
    }
    para.push(line); i++;
  }
  flush();
  return html || `<p class="ai-text anim-in">…</p>`;
}

/* ---------------- view switching ---------------- */
function onlyView(el) {
  [signinView, noticeView, heroView, chatView].forEach(v => { v.hidden = v !== el; });
  dock.hidden = el !== chatView;
  scrollEl.scrollTop = 0;
}
function replayHero() {
  $$("[data-anim]", heroView).forEach(el => {
    el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
  });
}
function showHero() {
  currentChatId = null;
  thread.innerHTML = "";
  thread.dataset.chat = "";
  setActiveRecent(null);
  onlyView(heroView);
  replayHero();
}
function showChat() {
  onlyView(chatView);
}
function scrollBottom() {
  try {
    if (typeof scrollEl.scrollTo === "function")
      scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
    else scrollEl.scrollTop = scrollEl.scrollHeight;
  } catch (e) { try { scrollEl.scrollTop = scrollEl.scrollHeight; } catch (_) {} }
}

/* ---------------- thread rendering ---------------- */
function addUserBubble(text) {
  const d = document.createElement("div");
  d.className = "msg user";
  const b = document.createElement("div");
  b.className = "bubble";
  b.textContent = text;
  d.appendChild(b);
  thread.appendChild(d);
  scrollBottom();
}
function addThinking() {
  const d = document.createElement("div");
  d.className = "thinking";
  d.innerHTML = "<i></i><i></i><i></i>";
  thread.appendChild(d);
  scrollBottom();
  return d;
}
function addAiMessage(text) {
  const d = document.createElement("div");
  d.className = "msg ai";
  d.innerHTML = renderMarkdown(text);
  thread.appendChild(d);
  addReactions(d);
  scrollBottom();
}
function addReactions(afterEl) {
  const d = document.createElement("div");
  d.className = "reactions anim-in";
  d.innerHTML =
    `<button class="react-btn" data-r="like" aria-label="Like">${I.like}</button>` +
    `<button class="react-btn" data-r="dislike" aria-label="Dislike">${I.dislike}</button>` +
    `<button class="react-btn" data-r="copy" aria-label="Copy">${I.copy}</button>`;
  afterEl.after(d);
  const like = $("[data-r=like]", d), dislike = $("[data-r=dislike]", d);
  like.addEventListener("click", () => { like.classList.toggle("liked"); dislike.classList.remove("disliked"); });
  dislike.addEventListener("click", () => { dislike.classList.toggle("disliked"); like.classList.remove("liked"); });
  $("[data-r=copy]", d).addEventListener("click", async e => {
    const b = e.currentTarget;
    try { await navigator.clipboard.writeText(afterEl.innerText); } catch (err) {}
    b.classList.add("liked"); setTimeout(() => b.classList.remove("liked"), 1200);
  });
}

// copy-table (event delegation — tables render dynamically)
thread.addEventListener("click", async e => {
  const btn = e.target.closest(".copy-table");
  if (!btn) return;
  const table = btn.closest(".table-block").querySelector("table");
  const tsv = Array.from(table.querySelectorAll("tr"))
    .map(tr => Array.from(tr.querySelectorAll("th,td")).map(c => c.innerText.trim()).join("\t"))
    .join("\n");
  try { await navigator.clipboard.writeText(tsv); }
  catch (err) {
    const ta = document.createElement("textarea");
    ta.value = tsv; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
  }
  btn.classList.add("copied");
  btn.innerHTML = `${I.check}<span>Copied</span>`;
  setTimeout(() => { btn.classList.remove("copied"); btn.innerHTML = `${I.copy}<span>Copy table</span>`; }, 1600);
});

/* ---------------- Firestore: chats ---------------- */
const chatsCol = uid => collection(db, "users", uid, "chats");
const msgsCol = (uid, cid) => collection(db, "users", uid, "chats", cid, "messages");

function subscribeChats() {
  if (unsubChats) unsubChats();
  const q = query(chatsCol(user.uid), orderBy("updatedAt", "desc"));
  unsubChats = onSnapshot(q, snap => {
    recentList.innerHTML = "";
    const docs = snap.docs;
    emptyRecents.style.display = docs.length ? "none" : "";
    docs.forEach(d => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.className = "nav-item" + (d.id === currentChatId ? " is-active" : "");
      b.dataset.chat = d.id;
      b.innerHTML = `${I.chat}<span></span>`;
      b.querySelector("span").textContent = d.data().title || "New chat";
      b.addEventListener("click", () => openChat(d.id));
      li.appendChild(b);
      recentList.appendChild(li);
    });
  }, () => { /* rules not published yet — stay silent */ });
}

function setActiveRecent(id) {
  $$("#recentList .nav-item").forEach(b => b.classList.toggle("is-active", b.dataset.chat === id));
}

function openChat(chatId) {
  if (unsubMsgs) unsubMsgs();
  currentChatId = chatId;
  thread.innerHTML = "";
  thread.dataset.chat = chatId;
  showChat();
  setActiveRecent(chatId);
  closeDrawer();
  const q = query(msgsCol(user.uid, chatId), orderBy("createdAt", "asc"));
  unsubMsgs = onSnapshot(q, snap => {
    thread.innerHTML = "";
    snap.docs.forEach(d => {
      const m = d.data();
      if (m.role === "user") addUserBubble(m.text);
      else addAiMessage(m.text);
    });
    scrollBottom();
  });
}

async function ensureChat(firstText) {
  if (currentChatId) return currentChatId;
  const ref = await addDoc(chatsCol(user.uid), {
    title: firstText.slice(0, 42) || "New chat",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  currentChatId = ref.id;
  return ref.id;
}

async function saveMessage(chatId, role, text) {
  await addDoc(msgsCol(user.uid, chatId), { role, text, createdAt: serverTimestamp() });
  await updateDoc(doc(db, "users", user.uid, "chats", chatId), { updatedAt: serverTimestamp() });
}

/* ---------------- MNAI 9 call ---------------- */
async function askMnai9(history) {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: history })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (data.error === "AI_NOT_CONFIGURED")
      throw new Error("MNAI 9 isn't connected yet — the site owner needs to add the API key.");
    throw new Error(data.error || ("Request failed (" + r.status + ")"));
  }
  return data.reply || "";
}

/* ---------------- send flow ---------------- */
async function send(text) {
  text = (text || "").trim();
  if (!text || busy || !user) return;
  busy = true;
  closeDrawer();
  const chatId = await ensureChat(text);
  if (thread.dataset.chat !== chatId) { thread.innerHTML = ""; thread.dataset.chat = chatId; }
  showChat();
  setActiveRecent(chatId);
  if (unsubMsgs) { unsubMsgs(); unsubMsgs = null; }
  addUserBubble(text);
  await saveMessage(chatId, "user", text);
  // subscribe for live sync (other devices)
  const q = query(msgsCol(user.uid, chatId), orderBy("createdAt", "asc"));
  let first = true;
  unsubMsgs = onSnapshot(q, snap => {
    if (first) { first = false; return; } // we already rendered the user msg
    thread.innerHTML = "";
    snap.docs.forEach(d => {
      const m = d.data();
      if (m.role === "user") addUserBubble(m.text);
      else addAiMessage(m.text);
    });
    scrollBottom();
  });
  const think = addThinking();
  try {
    // history for context
    const hist = [{ role: "user", content: text }];
    const reply = await askMnai9(hist);
    think.remove();
    addAiMessage(reply || "I didn't get a response — try again.");
    await saveMessage(chatId, "ai", reply);
  } catch (err) {
    think.remove();
    addAiMessage("⚠️ " + err.message);
  }
  busy = false;
}

/* ---------------- drawer / sidebar ---------------- */
function openDrawer() { app.classList.add("drawer-open"); }
function closeDrawer() { app.classList.remove("drawer-open"); }
$("#menuBtn").addEventListener("click", openDrawer);
backdrop.addEventListener("click", closeDrawer);
$("#collapseBtn").addEventListener("click", () => app.classList.toggle("side-hidden"));
$("#sideBtn").addEventListener("click", () => app.classList.remove("side-hidden"));
$("#historyBtn").addEventListener("click", () => {
  if (isNarrow()) openDrawer();
  else app.classList.toggle("side-hidden");
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });
$("#modelPicker").addEventListener("click", e => {
  e.currentTarget.animate(
    [{ transform: "scale(1)" }, { transform: "scale(.94)" }, { transform: "scale(1)" }],
    { duration: 220, easing: "cubic-bezier(.34,1.4,.44,1)" });
});

/* ---------------- nav ---------------- */
$("#newChatBtn").addEventListener("click", () => {
  if (unsubMsgs) { unsubMsgs(); unsubMsgs = null; }
  busy = false;
  closeDrawer();
  showHero();
});
$$('.nav-item[data-tool]').forEach(b => {
  b.addEventListener("click", () => {
    closeDrawer();
    const map = { think: "Think: ", avatar: "Create Avatar: ", editimage: "Edit Image: ", voice: "Voice: " };
    showHero();
    const input = $(".hero-composer .composer-input");
    if (input && map[b.dataset.tool]) { input.value = map[b.dataset.tool]; input.focus(); }
  });
});

/* ---------------- composers ---------------- */
$$(".composer").forEach(comp => {
  const input = $(".composer-input", comp);
  const sendBtn = $(".send-btn", comp);
  const auto = () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
  };
  const fire = () => { const v = input.value; input.value = ""; auto(); send(v); };
  input.addEventListener("input", auto);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); fire(); }
  });
  sendBtn.addEventListener("click", fire);
  $$(".pill, .icon-circle", comp).forEach(p => {
    p.addEventListener("click", () => {
      p.animate(
        [{ transform: "scale(1)" }, { transform: "scale(.9)" }, { transform: "scale(1)" }],
        { duration: 200, easing: "cubic-bezier(.34,1.4,.44,1)" });
    });
  });
});

/* ---------------- auth ---------------- */
function updateUserCard() {
  const nameEl = $("#userName"), mailEl = $("#userMail"), avEl = $("#userAvatar");
  if (user) {
    nameEl.textContent = user.displayName || "My Account";
    mailEl.textContent = user.email || "";
    if (user.photoURL) avEl.src = user.photoURL;
    $("#userCard").title = "Sign out";
    $("#userCard").style.cursor = "pointer";
  } else {
    nameEl.textContent = "Sign in";
    mailEl.textContent = "to sync your chats";
    avEl.src = "avatar.png";
    $("#userCard").title = "";
    $("#userCard").style.cursor = "default";
  }
}
$("#userCard").addEventListener("click", async () => {
  if (user) { try { await signOut(auth); } catch (e) {} }
  else doSignIn();
});
async function doSignIn() {
  const errEl = $("#gateErr");
  errEl.hidden = true;
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    errEl.textContent = "Sign-in failed — " + (e.code || "try again") + ". Make sure Google sign-in is enabled for this Firebase project.";
    errEl.hidden = false;
  }
}
$("#googleBtn").addEventListener("click", doSignIn);

/* email + password sign-up / sign-in */
function friendlyAuthErr(e) {
  const code = e && e.code;
  if (code === "auth/email-already-in-use") return "That email already has an account — log in instead.";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") return "Wrong email or password.";
  if (code === "auth/weak-password") return "Password should be at least 6 characters.";
  if (code === "auth/invalid-email") return "That email address does not look right.";
  return "Sign-in failed — " + (code || "try again") + ".";
}
async function emailAuth(mode) {
  const errEl = $("#gateErr");
  errEl.hidden = true;
  const email = $("#emailInput").value.trim();
  const pass = $("#passInput").value;
  if (!email || !pass) { errEl.textContent = "Enter an email and a password first."; errEl.hidden = false; return; }
  try {
    if (mode === "signup") await createUserWithEmailAndPassword(auth, email, pass);
    else await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) { errEl.textContent = friendlyAuthErr(e); errEl.hidden = false; }
}
$("#emailSignupBtn").addEventListener("click", () => emailAuth("signup"));
$("#emailLoginBtn").addEventListener("click", () => emailAuth("login"));

/* ---------------- site on/off (live + scheduled) ---------------- */
let siteCfg = null;
let lastEffective = true;
let offlinePopupShown = false;

function effectiveActive(cfg) {
  if (!cfg) return true;
  try {
    const at = cfg.scheduledAt;
    const ms = at && typeof at.toMillis === "function" ? at.toMillis() : (typeof at === "number" ? at : 0);
    if (ms && Date.now() >= ms) return cfg.scheduledActive !== false;
  } catch (e) {}
  return cfg.active !== false;
}

function showOfflinePopup(msg) {
  if (offlinePopupShown) return;
  offlinePopupShown = true;
  $("#offlineModalText").textContent = msg || "This website is deactivated.";
  $("#offlineModal").hidden = false;
}
$("#offlineOk").addEventListener("click", () => location.reload());

function watchSiteConfig() {
  try {
    onSnapshot(doc(db, "site", "config"), snap => {
      if (!snap.exists()) return;
      siteCfg = snap.data();
      const eff = effectiveActive(siteCfg);
      if (lastEffective && !eff && !app.classList.contains("offline")) {
        showOfflinePopup(siteCfg.message || DEFAULT_NOTICE);
      }
      lastEffective = eff;
    }, () => {});
  } catch (e) {}
}
// scheduled flips need no write — re-evaluate the cached config periodically
setInterval(() => {
  if (offlinePopupShown || app.classList.contains("offline") || !siteCfg) return;
  const eff = effectiveActive(siteCfg);
  if (lastEffective && !eff) showOfflinePopup(siteCfg.message || DEFAULT_NOTICE);
  lastEffective = eff;
}, 30000);

/* ---------------- reviews + applied popup ---------------- */
let reviewRating = 5;
let reviewPrompted = false;
function paintStars() {
  $$("#revStars .star-btn").forEach(b => b.classList.toggle("is-on", Number(b.dataset.v) <= reviewRating));
}
$$("#revStars .star-btn").forEach(b => b.addEventListener("click", () => { reviewRating = Number(b.dataset.v); paintStars(); }));
paintStars();
$("#reviewLaterBtn").addEventListener("click", () => { $("#reviewModal").hidden = true; });
$("#reviewDoneBtn").addEventListener("click", () => { $("#reviewModal").hidden = true; });
$("#appliedOk").addEventListener("click", async () => {
  $("#appliedModal").hidden = true;
  try { await setDoc(doc(db, "users", user.uid), { appliedSeen: true }, { merge: true }); } catch (e) {}
});
$("#reviewForm").addEventListener("submit", async e => {
  e.preventDefault();
  const errEl = $("#reviewErr");
  errEl.hidden = true;
  const name = $("#revName").value.trim();
  const role = $("#revRole").value.trim();
  const reason = $("#revReason").value.trim();
  const text = $("#revText").value.trim();
  if (!name || !role || !reason || !text) {
    errEl.textContent = "Please fill in every field — name, role, reason and review.";
    errEl.hidden = false;
    return;
  }
  try {
    await addDoc(collection(db, "reviews"), {
      uid: user.uid, email: user.email || "",
      name, role, reason, rating: reviewRating, text,
      status: "pending", createdAt: serverTimestamp()
    });
    await setDoc(doc(db, "users", user.uid), { reviewSubmitted: true }, { merge: true });
    $("#reviewForm").hidden = true;
    $("#reviewDone").hidden = false;
  } catch (err) {
    errEl.textContent = "Could not send the review — the database rules may not be published yet.";
    errEl.hidden = false;
  }
});
async function reviewFlow() {
  if (reviewPrompted) return;
  reviewPrompted = true;
  try {
    if (siteCfg && siteCfg.ownerUid === user.uid) return;
    const uSnap = await getDoc(doc(db, "users", user.uid));
    const uData = uSnap.exists() ? uSnap.data() : {};
    const q = query(collection(db, "reviews"), where("uid", "==", user.uid), orderBy("createdAt", "desc"), limit(1));
    const snap = await getDocs(q);
    const rev = snap.empty ? null : snap.docs[0].data();
    if (rev && rev.status === "applied" && !uData.appliedSeen) {
      $("#appliedModal").hidden = false;
      return;
    }
    if (!rev) $("#reviewModal").hidden = false;
  } catch (e) { /* rules not published yet — stay silent */ }
}

/* ---------------- boot ---------------- */
async function getSiteConfig() {
  try {
    const snap = await getDoc(doc(db, "site", "config"));
    if (snap.exists()) return snap.data();
  } catch (e) { /* Firestore not set up yet — default to active */ }
  return { active: true, message: DEFAULT_NOTICE };
}

(async function boot() {
  const cfg = await getSiteConfig();
  siteCfg = cfg;
  lastEffective = effectiveActive(cfg);
  if (!lastEffective) {
    $("#noticeText").textContent = cfg.message || DEFAULT_NOTICE;
    app.classList.add("offline");
    onlyView(noticeView);
    return;
  }
  watchSiteConfig();
  onAuthStateChanged(auth, u => {
    user = u;
    updateUserCard();
    if (!u) {
      if (unsubChats) { unsubChats(); unsubChats = null; }
      if (unsubMsgs) { unsubMsgs(); unsubMsgs = null; }
      currentChatId = null;
      thread.innerHTML = "";
      thread.dataset.chat = "";
      onlyView(signinView);
    } else {
      subscribeChats();
      showHero();
      reviewFlow();
    }
  });
})();
