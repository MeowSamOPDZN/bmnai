// Before MNAI — owner-only site control at /adminp
import { auth, db, googleProvider } from "./firebase-init.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, Timestamp, deleteField, collection, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = s => document.querySelector(s);
const cfgRef = doc(db, "site", "config");
const MODEL_NAME = "MNAI 9";
const DEFAULT_NOTICE = "Before MNAI is launching soon — check back shortly.";
let user = null;
let cfg = { active: true, message: "" };

const $$ = s => Array.from(document.querySelectorAll(s));
function show(id) {
  ["adminSignin", "adminClaim", "adminDenied", "adminPanel"].forEach(x => { $("#" + x).hidden = x !== id; });
  $("#adminCard").classList.toggle("wide", id === "adminPanel");
}
$$(".admin-navbtn").forEach(btn => btn.addEventListener("click", () => {
  $$(".admin-navbtn").forEach(x => x.classList.toggle("is-active", x === btn));
  $("#catActivation").hidden = btn.dataset.cat !== "activation";
  $("#catReviews").hidden = btn.dataset.cat !== "reviews";
}));
function err(msg) {
  const e = $("#adminErr");
  e.textContent = msg; e.hidden = false;
}
function paint() {
  const active = cfg.active !== false;
  $("#statusDot").classList.toggle("off", !active);
  $("#statusText").textContent = active ? "Active — visitors can chat" : "Inactive — visitors see your message";
  $("#toggleBtn").textContent = active ? "Deactivate site" : "Activate site";
  if (document.activeElement !== $("#msgInput")) $("#msgInput").value = cfg.message || DEFAULT_NOTICE;
  const sn = $("#schedNote"), sc = $("#schedClear");
  if (cfg.scheduledAt && typeof cfg.scheduledAt.toMillis === "function") {
    const d = cfg.scheduledAt.toDate();
    sn.textContent = "Scheduled to " + (cfg.scheduledActive ? "activate" : "deactivate") + " on " + d.toLocaleString() + ".";
    sn.hidden = false; sc.hidden = false;
  } else { sn.hidden = true; sc.hidden = true; }
}

async function load() {
  try {
    const snap = await getDoc(cfgRef);
    if (snap.exists()) cfg = Object.assign({ active: true, message: "" }, snap.data());
  } catch (e) { err("Can't reach the database — publish firestore.rules first (see repo)."); return false; }
  return true;
}

$("#adminGoogleBtn").addEventListener("click", async () => {
  $("#adminErr").hidden = true;
  try { await signInWithPopup(auth, googleProvider); }
  catch (e) { err("Sign-in failed — enable Google sign-in for this Firebase project."); }
});
$("#deniedOut").addEventListener("click", () => signOut(auth));
$("#panelOut").addEventListener("click", () => signOut(auth));

$("#claimBtn").addEventListener("click", async () => {
  try {
    await setDoc(cfgRef, { ownerUid: user.uid, active: true, message: cfg.message || "" }, { merge: true });
    cfg.ownerUid = user.uid;
    show("adminPanel"); paint();
  } catch (e) { err("Claim failed — check firestore.rules are published."); }
});

$("#toggleBtn").addEventListener("click", async () => {
  const next = !(cfg.active !== false);
  try {
    await setDoc(cfgRef, {
      active: next,
      scheduledAt: deleteField(),
      scheduledActive: deleteField()
    }, { merge: true });
    cfg.active = next;
    delete cfg.scheduledAt; delete cfg.scheduledActive;
    paint();
  } catch (e) { err("Save failed — are you the owner?"); }
});

$("#schedBtn").addEventListener("click", async () => {
  const v = $("#schedAt").value;
  if (!v) { err("Pick a date and time first."); return; }
  const at = new Date(v);
  if (isNaN(at.getTime())) { err("Invalid date/time."); return; }
  const action = $("#schedAction").value === "true";
  try {
    const ts = Timestamp.fromDate(at);
    await setDoc(cfgRef, { scheduledAt: ts, scheduledActive: action }, { merge: true });
    cfg.scheduledAt = ts; cfg.scheduledActive = action;
    $("#adminErr").hidden = true;
    paint();
  } catch (e) { err("Couldn't save the schedule — are you the owner?"); }
});

$("#schedClear").addEventListener("click", async () => {
  try {
    await setDoc(cfgRef, { scheduledAt: deleteField(), scheduledActive: deleteField() }, { merge: true });
    delete cfg.scheduledAt; delete cfg.scheduledActive;
    paint();
  } catch (e) { err("Couldn't clear the schedule."); }
});

$("#saveMsgBtn").addEventListener("click", async () => {
  try {
    await setDoc(cfgRef, { message: $("#msgInput").value.trim() }, { merge: true });
    cfg.message = $("#msgInput").value.trim();
    const n = $("#savedNote");
    n.hidden = false; setTimeout(() => { n.hidden = true; }, 1600);
  } catch (e) { err("Save failed — are you the owner?"); }
});

let unsubReviews = null;
function fmtDate(ts) {
  try { return ts && ts.toDate ? ts.toDate().toLocaleString() : ""; } catch (e) { return ""; }
}
function subscribeReviews() {
  if (unsubReviews) return;
  const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
  unsubReviews = onSnapshot(q, snap => {
    const list = $("#reviewList");
    list.innerHTML = "";
    const docs = snap.docs;
    $("#noReviews").hidden = docs.length > 0;
    let pending = 0;
    docs.forEach(d => {
      const r = d.data();
      if (r.status !== "applied") pending++;
      const card = document.createElement("div");
      card.className = "review-item";
      const stars = "\u2605".repeat(r.rating || 0) + "\u2606".repeat(Math.max(0, 5 - (r.rating || 0)));
      card.innerHTML = '<div class="review-head"><span class="review-name"></span><span class="review-badge"></span></div>' +
        '<p class="review-role"></p><p class="review-body"></p><p class="review-meta"></p>';
      card.querySelector(".review-name").textContent = r.name || "Anonymous";
      const badge = card.querySelector(".review-badge");
      badge.textContent = r.status === "applied" ? "Applied" : "Pending";
      if (r.status === "applied") badge.classList.add("applied");
      card.querySelector(".review-role").textContent = (r.role || "") + (r.email ? " · " + r.email : "") + " · " + stars;
      card.querySelector(".review-body").textContent = "Reason: " + (r.reason || "") + "\n\n" + (r.text || "");
      card.querySelector(".review-meta").textContent = fmtDate(r.createdAt);
      const btn = document.createElement("button");
      btn.className = "admin-btn primary"; btn.type = "button";
      if (r.status === "applied") {
        btn.textContent = "Undo apply";
        btn.addEventListener("click", async () => {
          try { await updateDoc(doc(db, "reviews", d.id), { status: "pending", appliedAt: deleteField() }); }
          catch (e) { err("Could not update the review."); }
        });
      } else {
        btn.textContent = "Apply for BMNAI";
        btn.addEventListener("click", async () => {
          try { await updateDoc(doc(db, "reviews", d.id), { status: "applied", appliedAt: serverTimestamp() }); }
          catch (e) { err("Could not apply the review — are you the owner?"); }
        });
      }
      card.appendChild(btn);
      list.appendChild(card);
    });
    const count = $("#reviewCount");
    count.hidden = pending === 0;
    count.textContent = pending;
  }, () => { /* rules not published yet */ });
}

onAuthStateChanged(auth, async u => {
  user = u;
  if (!u) { show("adminSignin"); return; }
  if (!(await load())) return;
  if (!cfg.ownerUid) show("adminClaim");
  else if (cfg.ownerUid !== u.uid) show("adminDenied");
  else { show("adminPanel"); paint(); subscribeReviews(); }
});
