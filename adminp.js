// Before MNAI — owner-only site control at /adminp
import { auth, db, googleProvider } from "./firebase-init.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = s => document.querySelector(s);
const cfgRef = doc(db, "site", "config");
const MODEL_NAME = "MNAI 9";
const DEFAULT_NOTICE = MODEL_NAME + " currently on BMNAI but will be released on MNAI soon.";
let user = null;
let cfg = { active: true, message: "" };

function show(id) {
  ["adminSignin", "adminClaim", "adminDenied", "adminPanel"].forEach(x => { $("#" + x).hidden = x !== id; });
}
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
    await setDoc(cfgRef, { active: next }, { merge: true });
    cfg.active = next; paint();
  } catch (e) { err("Save failed — are you the owner?"); }
});

$("#saveMsgBtn").addEventListener("click", async () => {
  try {
    await setDoc(cfgRef, { message: $("#msgInput").value.trim() }, { merge: true });
    cfg.message = $("#msgInput").value.trim();
    const n = $("#savedNote");
    n.hidden = false; setTimeout(() => { n.hidden = true; }, 1600);
  } catch (e) { err("Save failed — are you the owner?"); }
});

onAuthStateChanged(auth, async u => {
  user = u;
  if (!u) { show("adminSignin"); return; }
  if (!(await load())) return;
  if (!cfg.ownerUid) show("adminClaim");
  else if (cfg.ownerUid !== u.uid) show("adminDenied");
  else { show("adminPanel"); paint(); }
});
