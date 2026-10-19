/* ============================================================
   Booman 4.2 — interactions
   ============================================================ */
(function(){
"use strict";
const $  = (s, r) => (r||document).querySelector(s);
const $$ = (s, r) => Array.from((r||document).querySelectorAll(s));
const mq = q => (typeof matchMedia === "function") ? matchMedia(q).matches : false;
const reduceMotion = mq("(prefers-reduced-motion: reduce)");
const isNarrow = () => mq("(max-width:860px)") || window.innerWidth <= 860;
const wait = ms => new Promise(r => setTimeout(r, reduceMotion ? 0 : ms));

const app      = $("#app");
const sidebar  = $("#sidebar");
const backdrop = $("#backdrop");
const heroView = $("#heroView");
const chatView = $("#chatView");
const thread   = $("#thread");
const dock     = $("#composerDock");
const scrollEl = $("#scroll");

/* ---------------- scripted content (from the reference mock) ---------------- */
const WORKOUT = {
  user: "Can you create 1 day gym workout plan for me in table format",
  intro: "Training only once a week is a challenge, but it is actually a great way to maintain your current muscle mass and keep your joints healthy.",
  title: "The 1-Day Full Body Blitz",
  rows: [
    ["Barbell or Cup Squats",   "3 x 8–10",  "Legs & Core"],
    ["Dumbbell Bench Press",    "3 x 8–10",  "Chest, Shoulders, Triceps"],
    ["Bent Over Rows",          "3 x 10–12", "Back & Biceps"],
    ["Romanian Deadlift",       "3 x 10–12", "Hamstrings & Lower Back"],
    ["Overhead Shoulder Press", "2 x 10–12", "Shoulders"],
    ["Lat Pulldowns",           "2 x 12–15", "Lats (Back)"],
  ],
  outro: 'Would you like me to suggest a <strong>bodyweight version</strong> of this plan that you can do at home if you can\'t make it to the gym one week?'
};
const DEMO_REPLIES = {
  homepage: "Here are three homepage headline ideas: “Your Everyday AI, Ready for Anything.”, “Chat that keeps up with you.”, and “One prompt. Every answer.” — want me to expand any of them?",
  reactbug: "That usually happens when state updates are batched — try the functional form: setCount(c => c + 1), and move any derived values into useMemo so the render stays consistent.",
  portrait: "I can restyle that portrait background for you — upload the photo and tell me the vibe you want: studio gradient, outdoor blur, or solid color."
};

/* ---------------- icons ---------------- */
const I = {
  copy:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  like:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm2 1.5 3.5-7a1.6 1.6 0 0 1 3 1.2L14 10h7.5a2 2 0 0 1 2 2.4l-1.6 6.4a2 2 0 0 1-2 1.6H9z"/></svg>',
  dislike:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3zm-2-1.5L11.5 19a1.6 1.6 0 0 1-3-1.2L10 14H2.5a2 2 0 0 1-2-2.4l1.6-6.4a2 2 0 0 1 2-1.6H15z" transform="translate(0,1)"/></svg>',
  refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>'
};

/* ---------------- view switching ---------------- */
function showHero(){
  chatView.hidden = true;
  dock.hidden = true;
  heroView.hidden = false;
  // replay entrance animations
  $$("[data-anim]", heroView).forEach(el=>{
    el.style.animation="none"; void el.offsetWidth; el.style.animation="";
  });
  scrollEl.scrollTop = 0;
}
function showChat(){
  heroView.hidden = true;
  chatView.hidden = false;
  dock.hidden = false;
  scrollEl.scrollTop = scrollEl.scrollHeight;
}
function scrollBottom(){
  try{
    if(typeof scrollEl.scrollTo === "function")
      scrollEl.scrollTo({top: scrollEl.scrollHeight, behavior: reduceMotion ? "auto" : "smooth"});
    else scrollEl.scrollTop = scrollEl.scrollHeight;
  }catch(e){ try{ scrollEl.scrollTop = scrollEl.scrollHeight; }catch(_){} }
}

/* ---------------- thread builders ---------------- */
function addUserBubble(text){
  const d = document.createElement("div");
  d.className = "msg user";
  d.innerHTML = `<div class="bubble"></div>`;
  d.firstChild.textContent = text;
  thread.appendChild(d);
  scrollBottom();
  return d;
}
function addThinking(){
  const d = document.createElement("div");
  d.className = "thinking";
  d.innerHTML = "<i></i><i></i><i></i>";
  thread.appendChild(d);
  scrollBottom();
  return d;
}
function addAiText(html){
  const p = document.createElement("p");
  p.className = "ai-text";
  p.innerHTML = html;
  thread.appendChild(p);
  scrollBottom();
  return p;
}
function tableText(){
  return ["Exercise\tSets x Reps\tTarget Area"]
    .concat(WORKOUT.rows.map(r=>r.join("\t"))).join("\n");
}
function addWorkoutTable(){
  const block = document.createElement("div");
  block.className = "table-block";
  block.innerHTML = `
    <div class="table-head">
      <h3>${WORKOUT.title}</h3>
      <button class="copy-table" type="button">${I.copy}<span>Copy table</span></button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Exercise</th><th>Sets x Reps</th><th class="col-target">Target Area</th></tr></thead>
        <tbody>${WORKOUT.rows.map(r=>
          `<tr><td class="exercise">${r[0]}</td><td class="meta">${r[1]}</td><td class="col-target">${r[2]}</td></tr>`
        ).join("")}</tbody>
      </table>
    </div>`;
  thread.appendChild(block);
  const btn = $(".copy-table", block);
  btn.addEventListener("click", async ()=>{
    try{ await navigator.clipboard.writeText(tableText()); }
    catch(e){
      const ta=document.createElement("textarea");
      ta.value=tableText(); document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
    btn.classList.add("copied");
    btn.innerHTML = `${I.check}<span>Copied</span>`;
    setTimeout(()=>{ btn.classList.remove("copied"); btn.innerHTML=`${I.copy}<span>Copy table</span>`; }, 1600);
  });
  scrollBottom();
  return block;
}
function addReactions(){
  const d = document.createElement("div");
  d.className = "reactions";
  d.innerHTML = `
    <button class="react-btn" data-r="like" aria-label="Like">${I.like}</button>
    <button class="react-btn" data-r="dislike" aria-label="Dislike">${I.dislike}</button>
    <button class="react-btn" data-r="regen" aria-label="Regenerate">${I.refresh}</button>
    <button class="react-btn" data-r="copy" aria-label="Copy">${I.copy}</button>`;
  thread.appendChild(d);
  const like = $("[data-r=like]", d), dislike = $("[data-r=dislike]", d);
  like.addEventListener("click", ()=>{ like.classList.toggle("liked"); dislike.classList.remove("disliked"); });
  dislike.addEventListener("click", ()=>{ dislike.classList.toggle("disliked"); like.classList.remove("liked"); });
  $("[data-r=regen]", d).addEventListener("click", e=>{
    const b=e.currentTarget; b.style.transform="rotate(-180deg)";
    setTimeout(()=>b.style.transform="",450);
  });
  $("[data-r=copy]", d).addEventListener("click", async e=>{
    const b=e.currentTarget;
    try{ await navigator.clipboard.writeText(thread.innerText); }catch(err){}
    b.classList.add("liked"); setTimeout(()=>b.classList.remove("liked"),1200);
  });
  scrollBottom();
  return d;
}

/* ---------------- scripted send flow ---------------- */
let busy = false;
async function runWorkoutFlow(){
  const t = addThinking();
  await wait(950);
  t.remove();
  addAiText(WORKOUT.intro);
  await wait(420);
  addWorkoutTable();
  await wait(700);
  addAiText(WORKOUT.outro);
  await wait(350);
  addReactions();
  busy = false;
}
async function runDemoFlow(key){
  const t = addThinking();
  await wait(900);
  t.remove();
  addAiText(DEMO_REPLIES[key] || "Got it — how can I help with that?");
  await wait(300);
  addReactions();
  busy = false;
}
function send(text, kind){
  text = (text||"").trim();
  if(!text || busy) return;
  busy = true;
  closeDrawer();
  if(heroView.hidden === false) showChat();
  thread.innerHTML = "";
  showChat();
  addUserBubble(text);
  setActiveRecent(kind);
  if(kind === "workout") runWorkoutFlow();
  else runDemoFlow(kind);
}

/* ---------------- recent chats ---------------- */
const TITLES = { workout:"1-day workout plan", homepage:"Homepage copy ideas",
                 reactbug:"Fix React state bug", portrait:"Edit portrait background" };
function setActiveRecent(kind){
  $$("#recentList .nav-item").forEach(b=>
    b.classList.toggle("is-active", b.dataset.chat === kind));
}
$$("#recentList .nav-item").forEach(b=>{
  b.addEventListener("click", ()=>{
    const kind = b.dataset.chat;
    const title = TITLES[kind] || b.textContent.trim();
    if(kind === "workout") send(WORKOUT.user, "workout");
    else send(title, kind);
  });
});
$$('.nav-item[data-tool]').forEach(b=>{
  b.addEventListener("click", ()=>{
    closeDrawer();
    const map = { think:"Think", avatar:"Create Avatar", editimage:"Edit Image", voice:"Voice" };
    showHero();
    const input = $(".hero-composer .composer-input");
    if(input && map[b.dataset.tool]){
      input.value = map[b.dataset.tool] + ": ";
      input.focus();
    }
  });
});

/* ---------------- new chat / nav ---------------- */
$("#newChatBtn").addEventListener("click", ()=>{
  busy = false;
  setActiveRecent(null);
  closeDrawer();
  showHero();
});
$("#historyBtn").addEventListener("click", ()=>{
  if(isNarrow()) openDrawer();
  else app.classList.toggle("side-hidden");
});
$("#modelPicker").addEventListener("click", e=>{
  const b = e.currentTarget;
  b.animate(
    [{transform:"scale(1)"},{transform:"scale(.94)"},{transform:"scale(1)"}],
    {duration:220, easing:"cubic-bezier(.34,1.4,.44,1)"}
  );
});

/* ---------------- drawer (mobile) ---------------- */
function openDrawer(){ app.classList.add("drawer-open"); }
function closeDrawer(){ app.classList.remove("drawer-open"); }
$("#menuBtn").addEventListener("click", openDrawer);
backdrop.addEventListener("click", closeDrawer);
$("#collapseBtn").addEventListener("click", ()=> app.classList.toggle("side-hidden"));
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeDrawer(); });

/* ---------------- composers ---------------- */
$$(".composer").forEach(comp=>{
  const input = $(".composer-input", comp);
  const sendBtn = $(".send-btn", comp);
  const auto = ()=>{
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
  };
  input.addEventListener("input", auto);
  input.addEventListener("keydown", e=>{
    if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); send(input.value, "workout"); input.value=""; auto(); }
  });
  sendBtn.addEventListener("click", ()=>{ send(input.value, "workout"); input.value=""; auto(); });
  // pill press feedback
  $$(".pill, .icon-circle", comp).forEach(p=>{
    p.addEventListener("click", ()=>{
      p.animate(
        [{transform:"scale(1)"},{transform:"scale(.9)"},{transform:"scale(1)"}],
        {duration:200, easing:"cubic-bezier(.34,1.4,.44,1)"}
      );
    });
  });
});

/* ---------------- boot ---------------- */
showHero();
})();
