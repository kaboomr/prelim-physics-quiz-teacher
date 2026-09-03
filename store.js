// Shared data layer: Firebase Firestore when configured, localStorage otherwise.
"use strict";

function slugify(name){ return name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

// Small non-crypto hash for PINs (class-level security only)
function pinHash(str){
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
  h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
  return (4294967296*(2097151 & h2) + (h1>>>0)).toString(36);
}

const Store = (() => {
  let db = null;
  let cloud = false;

  function init(){
    try {
      // accept either FIREBASE_CONFIG or Google's default name firebaseConfig
      const FB = (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.apiKey) ? FIREBASE_CONFIG
               : (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey) ? firebaseConfig : null;
      if (FB && typeof firebase !== 'undefined') {
        firebase.initializeApp(FB);
        db = firebase.firestore();
        cloud = true;
      }
    } catch(e){ console.warn('Firebase init failed, using local mode:', e); cloud = false; }
    return cloud;
  }

  // ---- local fallback helpers ----
  function lsGet(key, fallback){
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch(e){ return fallback; }
  }
  function lsSet(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

  // ---- roster ----
  async function getRoster(){
    let names;
    if (cloud) {
      const doc = await db.collection('meta').doc('roster').get();
      names = doc.exists ? (doc.data().names || []) : [];
    } else {
      names = lsGet('pbsq_roster', []);
    }
    // merge config class list (never lose configured names)
    const merged = [...new Set([...(typeof CLASS_LIST!=='undefined'?CLASS_LIST:[]), ...names])]
      .map(n => n.trim()).filter(Boolean);
    merged.sort((a,b)=>a.localeCompare(b));
    // persist config-added names to the cloud so the (separate) dashboard sees them
    if (cloud && merged.length !== names.length) {
      try { await db.collection('meta').doc('roster').set({names: merged}, {merge:true}); } catch(e){}
    }
    return merged;
  }
  async function saveRoster(names){
    const clean = [...new Set(names.map(n=>n.trim()).filter(Boolean))];
    // merge:true is essential — this doc also holds `classes` and `removed`, and a
    // plain set() would wipe every student's class assignment each time names are saved.
    if (cloud) await db.collection('meta').doc('roster').set({names: clean}, {merge:true});
    else lsSet('pbsq_roster', clean);
    return clean;
  }
  async function removeFromRoster(name){
    const roster = await getRoster();
    const next = roster.filter(n => n !== name);
    // note: names in CLASS_LIST (config.js) will re-merge; store removals
    if (cloud) await db.collection('meta').doc('roster').set({names: next, removed: firebase.firestore.FieldValue.arrayUnion(name)}, {merge:true});
    else {
      lsSet('pbsq_roster', next);
      const rem = lsGet('pbsq_removed', []); rem.push(name); lsSet('pbsq_removed', rem);
    }
  }
  async function getRemoved(){
    if (cloud) {
      const doc = await db.collection('meta').doc('roster').get();
      return doc.exists ? (doc.data().removed || []) : [];
    }
    return lsGet('pbsq_removed', []);
  }

  // ---- classes ----
  // Single source of truth: meta/roster.classes = { "Student Name": "DRO", ... }
  async function getClassMap(){
    if (cloud) {
      const doc = await db.collection('meta').doc('roster').get();
      return doc.exists ? (doc.data().classes || {}) : {};
    }
    return lsGet('pbsq_classes', {});
  }
  async function setStudentClass(name, cls){
    if (cloud) {
      await db.collection('meta').doc('roster').set({classes: {[name]: cls || null}}, {merge:true});
    } else {
      const m = lsGet('pbsq_classes', {});
      if (cls) m[name] = cls; else delete m[name];
      lsSet('pbsq_classes', m);
    }
    // mirror onto the student record so the game can show it without a second read
    try {
      const s = await getStudent(name);
      if (s) { s.class = cls || null; await saveStudent(name, s); }
    } catch(e){}
  }
  async function setClassesBulk(map){
    if (cloud) await db.collection('meta').doc('roster').set({classes: map}, {merge:true});
    else { const m = {...lsGet('pbsq_classes', {}), ...map}; lsSet('pbsq_classes', m); }
  }
  function classList(){
    return (typeof CLASSES !== 'undefined' && CLASSES.length) ? CLASSES : ['DRO','DJK'];
  }

  // ---- students ----
  function blankStudent(name){
    return {
      name, pin: null, class: null, xp: 0, badges: [],
      daily: null,       // {date, c, n, timeSec, streak, best, done}
      survival: null,    // {best, runs, totalCorrect}
      exams: [],         // {d, c, n, timeSec, pct}
      duels: {w:0, l:0, d:0},
      peer: {count:0, exact:0, totalDiff:0, xp:0},   // peer marking record
      seen: {},          // qid -> times seen
      lastSeen: {},      // qid -> timestamp
      wrong: [],         // qids currently answered wrong (cleared when later answered right)
      terms: {},         // glossary termId -> {seen, miss, last, ease, ivl, due}  (Matching / Flashcards / Definition Quiz)
      diagrams: {},      // diagram id -> {best, runs, last}  (Diagram Labelling)
      conceptTotals: {}, // mode -> lifetime count of items attempted (flashcards, chains, ...)
      syl: {plays:0, rounds:0, correct:0, bestStreak:0, perSub:{}, perGame:{}},  // syllabus drills
      attempts: [],      // {d, n, c, timeSec, timed, mode, topics:{t:[c,tot]}, subs:{'T|S':[c,tot]}}
      totals: { answered: 0, correct: 0, perTopic: {}, perSub: {},
                perTopicQ: {} },   // perTopicQ excludes concept modes, so mastery badges stay exam-based
      bestStreak: 0
    };
  }

  async function getStudent(name){
    const id = slugify(name);
    if (cloud) {
      const doc = await db.collection('students').doc(id).get();
      return doc.exists ? doc.data() : null;
    }
    const all = lsGet('pbsq_students', {});
    return all[id] || null;
  }

  async function saveStudent(name, data){
    const id = slugify(name);
    if (cloud) { await db.collection('students').doc(id).set(data); return; }
    const all = lsGet('pbsq_students', {});
    all[id] = data; lsSet('pbsq_students', all);
  }

  async function deleteStudent(name){
    const id = slugify(name);
    if (cloud) { await db.collection('students').doc(id).delete(); return; }
    const all = lsGet('pbsq_students', {});
    delete all[id]; lsSet('pbsq_students', all);
  }

  async function getAllStudents(){
    if (cloud) {
      const snap = await db.collection('students').get();
      return snap.docs.map(d => d.data());
    }
    const all = lsGet('pbsq_students', {});
    return Object.values(all);
  }

  // ---- short-answer responses ----
  // {id, student, cls, qid, label, topic, subs[], max, typed, submitted,
  //  ai:{mark,feedback,strengths,improvements} | null,   <- teacher-only suggestion
  //  status:'pending'|'marked', mark, feedback, markedAt,
  //  peers:{ "<slug>": {mark, d, xp} }}
  async function createResponse(r){
    const id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    const doc = {...r, id, status: 'pending', mark: null, feedback: '', markedAt: null, peers: {}};
    if (cloud) await db.collection('responses').doc(id).set(doc);
    else { const all = lsGet('pbsq_responses', {}); all[id] = doc; lsSet('pbsq_responses', all); }
    return doc;
  }
  async function getAllResponses(){
    if (cloud) { const snap = await db.collection('responses').get(); return snap.docs.map(d => d.data()); }
    return Object.values(lsGet('pbsq_responses', {}));
  }
  async function getResponsesFor(name){
    const all = await getAllResponses();
    return all.filter(r => r.student === name).sort((a,b) => b.submitted - a.submitted);
  }
  // Responses this student may peer-mark: teacher-marked, not their own, not already marked by them.
  async function getPeerMarkable(name){
    const key = slugify(name);
    const all = await getAllResponses();
    return all.filter(r => r.status === 'marked' && r.student !== name && !(r.peers || {})[key]);
  }
  async function setResponseAI(id, ai){
    if (cloud) { await db.collection('responses').doc(id).set({ai}, {merge:true}); return; }
    const all = lsGet('pbsq_responses', {});
    if (all[id]) { all[id].ai = ai; lsSet('pbsq_responses', all); }
  }
  async function setResponseMark(id, mark, feedback){
    const patch = {mark, feedback: feedback || '', status: 'marked', markedAt: Date.now()};
    if (cloud) { await db.collection('responses').doc(id).set(patch, {merge:true}); }
    else { const all = lsGet('pbsq_responses', {}); if (all[id]) { Object.assign(all[id], patch); lsSet('pbsq_responses', all); } }
  }
  // Send a marked response back to the queue so the teacher can change the mark.
  async function reopenResponse(id){
    if (cloud) { await db.collection('responses').doc(id).set({status: 'pending'}, {merge:true}); return; }
    const all = lsGet('pbsq_responses', {});
    if (all[id]) { all[id].status = 'pending'; lsSet('pbsq_responses', all); }
  }
  async function addPeerMark(id, name, mark, xp){
    const key = slugify(name);
    const entry = {mark, d: Date.now(), xp};
    if (cloud) await db.collection('responses').doc(id).set({peers: {[key]: entry}}, {merge:true});
    else {
      const all = lsGet('pbsq_responses', {});
      if (all[id]) { all[id].peers = all[id].peers || {}; all[id].peers[key] = entry; lsSet('pbsq_responses', all); }
    }
  }
  async function deleteResponse(id){
    if (cloud) { await db.collection('responses').doc(id).delete(); return; }
    const all = lsGet('pbsq_responses', {}); delete all[id]; lsSet('pbsq_responses', all);
  }

  // ---- duels ----
  // {id, from, to, qids, res:{ "<slug>": {c,n,timeSec,d} }, created}
  async function createDuel(from, to, qids){
    const id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    const duel = {id, from, to, qids, res:{}, created: Date.now()};
    if (cloud) await db.collection('duels').doc(id).set(duel);
    else { const all = lsGet('pbsq_duels', {}); all[id] = duel; lsSet('pbsq_duels', all); }
    return duel;
  }
  async function getDuelsFor(name){
    if (cloud) {
      const [a, b] = await Promise.all([
        db.collection('duels').where('from','==',name).get(),
        db.collection('duels').where('to','==',name).get()
      ]);
      const seen = {};
      [...a.docs, ...b.docs].forEach(d => { seen[d.id] = d.data(); });
      return Object.values(seen).sort((x,y) => y.created - x.created);
    }
    return Object.values(lsGet('pbsq_duels', {}))
      .filter(d => d.from === name || d.to === name)
      .sort((x,y) => y.created - x.created);
  }
  async function saveDuelResult(id, name, result){
    const key = slugify(name);
    if (cloud) {
      await db.collection('duels').doc(id).set({res: {[key]: result}}, {merge:true});
      const doc = await db.collection('duels').doc(id).get();
      return doc.exists ? doc.data() : null;
    }
    const all = lsGet('pbsq_duels', {});
    if (!all[id]) return null;
    all[id].res = all[id].res || {};
    all[id].res[key] = result;
    lsSet('pbsq_duels', all);
    return all[id];
  }
  async function deleteDuel(id){
    if (cloud) { await db.collection('duels').doc(id).delete(); return; }
    const all = lsGet('pbsq_duels', {}); delete all[id]; lsSet('pbsq_duels', all);
  }
  async function getAllDuels(){
    if (cloud) { const snap = await db.collection('duels').get(); return snap.docs.map(d => d.data()); }
    return Object.values(lsGet('pbsq_duels', {}));
  }

  return { init, isCloud: () => cloud, getRoster, saveRoster, removeFromRoster, getRemoved,
           getClassMap, setStudentClass, setClassesBulk, classList,
           blankStudent, getStudent, saveStudent, deleteStudent, getAllStudents,
           createDuel, getDuelsFor, saveDuelResult, deleteDuel, getAllDuels, slug: slugify,
           createResponse, getAllResponses, getResponsesFor, getPeerMarkable,
           setResponseAI, setResponseMark, reopenResponse, addPeerMark, deleteResponse };
})();

// ---- short answer & peer marking maths ----
// XP a student earns just for submitting an answer for marking (the rest lands when the teacher marks it).
const SA_SUBMIT_XP = 15;
// Peer marking reward: the closer to the teacher's mark, the better.
function peerXp(peerMark, teacherMark){
  const diff = Math.abs(peerMark - teacherMark);
  return diff === 0 ? 30 : diff === 1 ? 15 : diff === 2 ? 5 : 0;
}
function peerVerdict(diff){
  return diff === 0 ? {label:'Spot on — exactly what the teacher gave', color:'var(--good)', emoji:'🎯'}
       : diff === 1 ? {label:'Very close — one mark out',               color:'var(--good)', emoji:'👏'}
       : diff === 2 ? {label:'Not far off — two marks out',             color:'var(--gold)', emoji:'🤏'}
       : {label:diff + ' marks out — re-read the criteria',             color:'var(--bad)',  emoji:'📚'};
}
// Marks a student has earned that count as "answering" work (peer marking is excluded).
function answeringAttempts(student){
  return (student.attempts || []).filter(a => a.mode !== 'peermark');
}

function ensureSA(s){
  s.sa = s.sa || { count: 0, marks: 0, marksTotal: 0, perTopic: {}, perSub: {}, seen: {}, lastSeen: {}, submitted: 0 };
  if (s.sa.submitted === undefined) s.sa.submitted = s.sa.count || 0;
  return s.sa;
}

// Short-answer marks are worth TRIPLE the base per-mark XP — writing a full response
// is the hardest work in the game, so each mark earns 3x what a multiple-choice mark does.
// Note: marks are credited from the dashboard, which doesn't load QUIZ_OPTIONS, so the
// base reliably falls back to 10 → 30 XP per mark.
const SA_MARK_MULTIPLIER = 3;
function saXpFor(mark, max){
  const xpPerMark = (typeof QUIZ_OPTIONS !== 'undefined' ? QUIZ_OPTIONS.xpPerMark : 10) || 10;
  return mark * xpPerMark * SA_MARK_MULTIPLIER + (mark === max && max >= 2 ? 5 : 0);
}

// Credit a teacher-approved mark to the student's record. Called from the dashboard
// on approval — the only place short-answer marks enter a student's totals.
// Safe to call again if the teacher re-marks: the second call applies the difference
// rather than double-counting.
function applyTeacherMark(student, resp, mark, totalQuestions){
  student.saCredited = student.saCredited || {};
  // migrate the old array form, if present
  if (Array.isArray(student.saCredited)) {
    student.saCredited = Object.fromEntries(student.saCredited.map(id => [id, null]));
  }
  const max = resp.max;
  const had = student.saCredited[resp.id];          // previously credited mark, if any
  const isRemark = had !== undefined && had !== null;
  const delta = isRemark ? mark - had : mark;
  const xpDelta = isRemark ? saXpFor(mark, max) - saXpFor(had, max) : saXpFor(mark, max);

  const sa = ensureSA(student);
  student.xp += xpDelta;
  sa.marks += delta;
  if (!isRemark) {
    sa.count++;
    sa.marksTotal += max;
    sa.seen[resp.qid] = (sa.seen[resp.qid] || 0) + 1;
    sa.lastSeen[resp.qid] = Date.now();
  }
  const pt = sa.perTopic[resp.topic] = sa.perTopic[resp.topic] || [0,0];
  pt[0] += delta; if (!isRemark) pt[1] += max;
  for (const s of (resp.subs || [])) {
    const key = resp.topic + '|' + s;
    const ps = sa.perSub[key] = sa.perSub[key] || [0,0];
    ps[0] += delta; if (!isRemark) ps[1] += max;
  }

  const topics = { [resp.topic]: [mark, max] };
  const subs = {};
  for (const s of (resp.subs || [])) subs[resp.topic + '|' + s] = [mark, max];

  let attempt;
  if (isRemark) {
    attempt = (student.attempts || []).find(a => a.responseId === resp.id);
    if (attempt) { attempt.c = mark; attempt.topics = topics; attempt.subs = subs;
                   attempt.qs = [{id: resp.qid, mark, max}]; attempt.d = Date.now(); }
  }
  if (!attempt) {
    attempt = { d: Date.now(), n: max, c: mark, timeSec: 0, timed: false,
                mode: 'shortanswer', qcount: 1, responseId: resp.id,
                topics, subs, qs: [{id: resp.qid, mark, max}] };
    student.attempts.push(attempt);
  }

  student.saCredited[resp.id] = mark;
  const badges = evaluateBadges(student, attempt, totalQuestions || 0);
  return {badges, xpDelta, attempt, isRemark};
}

// ---- seeded randomness (identical picks for every student) ----
function seedFrom(str){
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// Deterministic sample of n items — same seed always yields the same list, in the same order.
function seededPick(pool, n, seedStr){
  const rnd = mulberry32(seedFrom(seedStr));
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(n, arr.length));
}
function dateKey(d){
  const t = d ? new Date(d) : new Date();
  return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
}

// ---- mode maths ----
// Survival: sudden death, reward deepens with the run. 10,10,12,12,14,14… capped at 50.
function survivalXp(index){
  const base = (typeof QUIZ_OPTIONS !== 'undefined' ? QUIZ_OPTIONS.xpPerCorrect : 10);
  return Math.min(base + Math.floor(index / 2) * 2, 50);
}
// Exam Simulation: indicative Preliminary band from a Section I percentage.
function bandFromPct(pct){
  if (pct >= 90) return {band:'Band 6', desc:'Outstanding', color:'var(--good)'};
  if (pct >= 80) return {band:'Band 5', desc:'High',        color:'var(--good)'};
  if (pct >= 70) return {band:'Band 4', desc:'Sound+',      color:'var(--gold)'};
  if (pct >= 60) return {band:'Band 3', desc:'Sound',       color:'var(--gold)'};
  if (pct >= 50) return {band:'Band 2', desc:'Basic',       color:'var(--bad)'};
  return {band:'Band 1', desc:'Elementary', color:'var(--bad)'};
}
// Duel: compare two results — more correct wins, ties broken by the faster time.
function duelOutcome(mine, theirs){
  if (!mine || !theirs) return 'pending';
  if (mine.c !== theirs.c) return mine.c > theirs.c ? 'win' : 'loss';
  if (mine.timeSec !== theirs.timeSec) return mine.timeSec < theirs.timeSec ? 'win' : 'loss';
  return 'draw';
}

// ---- class competition maths ----
// Returns one row per class: { cls, students, active, totalXp, avgXp, answered, correct, accuracy }
function classStandings(students, classMap, classes){
  const rows = classes.map(cls => ({cls, students:0, active:0, totalXp:0, avgXp:0, answered:0, correct:0, accuracy:null}));
  const byCls = Object.fromEntries(rows.map(r => [r.cls, r]));
  for (const s of students) {
    const cls = (classMap && classMap[s.name]) || s.class;
    const r = byCls[cls];
    if (!r) continue;
    r.students++;
    r.totalXp += (s.xp || 0);
    r.answered += (s.totals?.answered || 0);
    r.correct  += (s.totals?.correct  || 0);
    if (s.attempts && s.attempts.length) r.active++;
  }
  for (const r of rows) {
    r.avgXp = r.active ? Math.round(r.totalXp / r.active) : 0;
    r.accuracy = r.answered ? r.correct / r.answered : null;
  }
  return rows;
}

// ---- shared game maths ----
function levelFromXp(xp){ return Math.floor(xp / 300) + 1; }
function levelProgress(xp){ return xp % 300; }
function levelName(lv){
  const names = ["Rookie","Field Naturalist","Lab Assistant","Microscopist","Physiologist","Geneticist","Ecologist","Evolutionary Biologist","Research Scientist","Professor"];
  return names[Math.min(lv-1, names.length-1)] + (lv > names.length ? " " + (lv - names.length + 1) : "");
}

const BADGES = [
  {id:'first_steps', emoji:'🎯', name:'First Steps',   desc:'Complete your first quiz'},
  {id:'full_section',emoji:'💪', name:'Full Section',  desc:'Complete a 20-question quiz'},
  {id:'sharpshooter',emoji:'🏹', name:'Sharpshooter',  desc:'Score 100% on a quiz of 10+ questions'},
  {id:'streak_5',    emoji:'🔥', name:'On Fire',       desc:'Answer 5 in a row correctly'},
  {id:'streak_10',   emoji:'⚡', name:'Unstoppable',   desc:'Answer 10 in a row correctly'},
  {id:'centurion',   emoji:'💯', name:'Centurion',     desc:'Answer 100 questions in total'},
  {id:'explorer',    emoji:'🗺️', name:'Explorer',      desc:'See every question in the bank'},
  {id:'m1_master',   emoji:'🔬', name:'Cell Biologist',    desc:'85%+ accuracy over 25+ Cells as the Basis of Life questions'},
  {id:'m2_master',   emoji:'🫀', name:'Systems Specialist', desc:'85%+ accuracy over 25+ Organisation of Living Things questions'},
  {id:'m3_master',   emoji:'🧬', name:'Diversity Expert',   desc:'85%+ accuracy over 25+ Biological Diversity questions'},
  {id:'m4_master',   emoji:'🌳', name:'Ecologist',          desc:'85%+ accuracy over 25+ Ecosystem Dynamics questions'},
  {id:'comeback',    emoji:'🔁', name:'Comeback Kid',  desc:'Score 80%+ on a My Mistakes quiz'},
  {id:'pacer',       emoji:'⏱️', name:'Exam Pacer',    desc:'Finish a timed quiz averaging under 60s a question'},
  {id:'streak_15',   emoji:'🌟', name:'Legendary',     desc:'Answer 15 in a row correctly'},
  {id:'dedication',  emoji:'📅', name:'Dedicated',     desc:'Complete 10 quizzes'},
  {id:'veteran',     emoji:'🎖️', name:'Veteran',       desc:'Complete 25 quizzes'},
  {id:'double_cent', emoji:'🏏', name:'Double Century',desc:'Answer 200 questions in total'},
  {id:'all_rounder', emoji:'🧩', name:'All-Rounder',   desc:'Answer 10+ questions in every topic'},
  {id:'perfectionist',emoji:'👑', name:'Perfectionist', desc:'Score 100% on a 20-question quiz'},
  {id:'clean_slate', emoji:'🧼', name:'Clean Slate',   desc:'Clear every question from My Mistakes'},
  {id:'high_flyer',  emoji:'🚀', name:'High Flyer',    desc:'Reach Level 5'},
  {id:'early_bird',  emoji:'🐦', name:'Early Bird',    desc:'Finish a quiz before 8 am'},
  {id:'night_owl',   emoji:'🦉', name:'Night Owl',     desc:'Finish a quiz after 9 pm'},
  {id:'sa_first',    emoji:'📝', name:'Pen to Paper',  desc:'Complete your first short-answer session'},
  {id:'sa_perfect',  emoji:'✒️', name:'Top Band',      desc:'Full marks on a 4+ mark short answer'},
  {id:'sa_20',       emoji:'🖋️', name:'Wordsmith',     desc:'Have 20 short answers marked'},
  // --- game modes ---
  {id:'daily_first', emoji:'📆', name:'Day One',       desc:'Complete your first Daily Challenge'},
  {id:'daily_perfect',emoji:'🌞', name:'Flawless Daily',desc:'Get 5/5 on a Daily Challenge'},
  {id:'daily_streak5',emoji:'🗓️', name:'Regular',      desc:'Daily Challenge 5 days in a row'},
  {id:'daily_streak15',emoji:'🏅',name:'Iron Habit',   desc:'Daily Challenge 15 days in a row'},
  {id:'surv_10',     emoji:'🛡️', name:'Survivor',      desc:'Reach 10 in a row in Survival'},
  {id:'surv_20',     emoji:'⚔️', name:'Gladiator',     desc:'Reach 20 in a row in Survival'},
  {id:'surv_30',     emoji:'🐉', name:'Immortal',      desc:'Reach 30 in a row in Survival'},
  {id:'exam_first',  emoji:'📄', name:'Sat the Paper', desc:'Complete an Exam Simulation'},
  {id:'exam_band5',  emoji:'🎓', name:'Band 5 Standard',desc:'Score 80%+ in an Exam Simulation'},
  {id:'exam_band6',  emoji:'🏆', name:'Band 6 Standard',desc:'Score 90%+ in an Exam Simulation'},
  {id:'duel_first',  emoji:'🤝', name:'Challenger',    desc:'Finish your first duel'},
  {id:'duel_win',    emoji:'🥊', name:'Duellist',      desc:'Win a duel'},
  {id:'duel_5',      emoji:'👑', name:'Champion',      desc:'Win 5 duels'},
  {id:'peer_first',  emoji:'⚖️', name:'Fair Judge',    desc:'Mark your first peer answer'},
  {id:'peer_exact',  emoji:'🎯', name:'Marker\'s Eye', desc:'Match the teacher\'s mark exactly'},
  {id:'peer_10',     emoji:'📋', name:'Marking Centre',desc:'Peer mark 10 answers'},
  {id:'peer_sharp',  emoji:'🔍', name:'Chief Examiner',desc:'Match the teacher exactly 5 times'},
  {id:'sa_submitted',emoji:'📮', name:'Handed In',     desc:'Submit a short answer for marking'},
  // --- concept library / matching ---
  {id:'match_first', emoji:'🔗', name:'Pair Up',        desc:'Finish your first Matching session'},
  {id:'match_clean', emoji:'✨', name:'Clean Sweep',    desc:'Match every pair first try in a session'},
  {id:'match_50',    emoji:'📚', name:'Term Collector', desc:'Practise 50 different concepts'},
  {id:'match_150',   emoji:'🧠', name:'Walking Glossary',desc:'Practise 150 different concepts'},
  {id:'flash_first', emoji:'🎴', name:'First Review',   desc:'Complete a flashcard session'},
  {id:'flash_100',   emoji:'📇', name:'Card Shark',      desc:'Review 100 flashcards in total'},
  {id:'def_first',   emoji:'📖', name:'By Definition',   desc:'Complete a Definition Quiz'},
  {id:'def_perfect', emoji:'🧮', name:'Word Perfect',    desc:'Score 100% on a 10+ question Definition Quiz'},
  {id:'chain_first', emoji:'⛓️', name:'First Link',     desc:'Build your first cause-and-effect chain'},
  {id:'chain_clean', emoji:'🔗', name:'Unbroken',        desc:'Build every chain in a session with no wrong steps'},
  {id:'chain_25',    emoji:'🧵', name:'Chain Reaction',  desc:'Build 25 chains correctly'},
  {id:'diag_first',  emoji:'📐', name:'Draughtsman',     desc:'Label your first diagram'},
  {id:'diag_perfect',emoji:'✏️', name:'Fully Labelled', desc:'Label a diagram with every label first try'},
  {id:'diag_all',    emoji:'🗺️', name:'Cartographer',   desc:'Attempt every diagram in the bank'},
  // --- syllabus drills ---
  {id:'syl_first',   emoji:'🧠', name:'Dot Point Rookie', desc:'Complete your first Syllabus Drill'},
  {id:'syl_perfect', emoji:'🎯', name:'Syllabus Sniper',  desc:'Perfect score on a 10+ round Syllabus Drill'},
  {id:'syl_100',     emoji:'📖', name:'Deep Reader',      desc:'Answer 100 Syllabus Drill rounds'},
  {id:'syl_master',  emoji:'🗂️', name:'Syllabus Master',  desc:'85%+ accuracy over 100+ Syllabus Drill rounds'},
  {id:'syl_allgames',emoji:'🕹️', name:'Four of a Kind',   desc:'Play all four Syllabus Drill games'},
];

// Concept-practice modes. They feed XP and the teacher's topic analysis, but are
// deliberately excluded from badges that describe sitting a set of exam questions.
const CONCEPT_MODES = new Set(['matching','flashcards','defquiz','chains','diagrams','syllabus']);
function isConceptMode(mode){ return CONCEPT_MODES.has(mode); }

function evaluateBadges(student, attempt, totalQuestions){
  const earned = [];
  const has = id => student.badges.includes(id);
  const t = student.totals;
  const topicAcc = (topic) => {
    const p = (t.perTopicQ || {})[topic]; return p && p[1] >= 25 ? p[0]/p[1] : 0;
  };
  const examAttempt = attempt && !isConceptMode(attempt.mode);
  const answering = answeringAttempts(student);   // peer marking isn't "doing a quiz"
  const checks = {
    first_steps: () => answering.length >= 1,
    full_section: () => examAttempt && attempt.n >= 20,
    sharpshooter: () => examAttempt && attempt.n >= 10 && attempt.c === attempt.n,
    streak_5:  () => student.bestStreak >= 5,
    streak_10: () => student.bestStreak >= 10,
    centurion: () => t.answered >= 100,
    explorer:  () => Object.keys(student.seen).length >= totalQuestions,
    m1_master:() => topicAcc('Cells as the Basis of Life') >= 0.85,
    m2_master:() => topicAcc('Organisation of Living Things') >= 0.85,
    m3_master:() => topicAcc('Biological Diversity') >= 0.85,
    m4_master:() => topicAcc('Ecosystem Dynamics') >= 0.85,
    comeback:  () => attempt && attempt.mode === 'mistakes' && attempt.n > 0 && attempt.c / attempt.n >= 0.8,
    pacer:     () => examAttempt && attempt.timed && attempt.n > 0 && (attempt.timeSec / attempt.n) < 60,
    streak_15: () => student.bestStreak >= 15,
    dedication:() => answering.length >= 10,
    veteran:   () => answering.length >= 25,
    double_cent:() => t.answered >= 200,
    all_rounder:() => Object.keys(typeof SYLLABUS !== 'undefined' ? SYLLABUS : {'Cells as the Basis of Life':1,'Organisation of Living Things':1,'Biological Diversity':1,'Ecosystem Dynamics':1})
                      .every(tp => (t.perTopicQ || {})[tp] && t.perTopicQ[tp][1] >= 10),
    perfectionist:() => examAttempt && attempt.n >= 20 && attempt.c === attempt.n,
    clean_slate:() => attempt && attempt.mode === 'mistakes' && student.wrong.length === 0,
    high_flyer:() => levelFromXp(student.xp) >= 5,
    early_bird:() => attempt && new Date(attempt.d).getHours() < 8,
    night_owl: () => attempt && new Date(attempt.d).getHours() >= 21,
    sa_first:  () => attempt && attempt.mode === 'shortanswer',
    sa_perfect:() => attempt && attempt.mode === 'shortanswer' && (attempt.qs || []).some(x => x.max >= 4 && x.mark === x.max),
    sa_20:     () => student.sa && student.sa.count >= 20,
    daily_first:  () => !!(student.daily && student.daily.done),
    daily_perfect:() => attempt && attempt.mode === 'daily' && attempt.n > 0 && attempt.c === attempt.n,
    daily_streak5:() => (student.daily?.streak || 0) >= 5,
    daily_streak15:()=> (student.daily?.streak || 0) >= 15,
    surv_10:   () => (student.survival?.best || 0) >= 10,
    surv_20:   () => (student.survival?.best || 0) >= 20,
    surv_30:   () => (student.survival?.best || 0) >= 30,
    exam_first:() => attempt && attempt.mode === 'exam',
    exam_band5:() => attempt && attempt.mode === 'exam' && attempt.n > 0 && attempt.c/attempt.n >= 0.8,
    exam_band6:() => attempt && attempt.mode === 'exam' && attempt.n > 0 && attempt.c/attempt.n >= 0.9,
    duel_first:() => ((student.duels?.w || 0) + (student.duels?.l || 0) + (student.duels?.d || 0)) >= 1,
    duel_win:  () => (student.duels?.w || 0) >= 1,
    duel_5:    () => (student.duels?.w || 0) >= 5,
    peer_first:() => (student.peer?.count || 0) >= 1,
    peer_exact:() => (student.peer?.exact || 0) >= 1,
    peer_10:   () => (student.peer?.count || 0) >= 10,
    peer_sharp:() => (student.peer?.exact || 0) >= 5,
    sa_submitted:() => (student.sa?.submitted || 0) >= 1,
    match_first:() => attempt && attempt.mode === 'matching',
    match_clean:() => attempt && attempt.mode === 'matching' && attempt.n > 0 && attempt.c === attempt.n,
    match_50:  () => Object.keys(student.terms || {}).length >= 50,
    match_150: () => Object.keys(student.terms || {}).length >= 150,
    flash_first:() => attempt && attempt.mode === 'flashcards',
    flash_100: () => (student.conceptTotals?.flashcards || 0) >= 100,
    def_first: () => attempt && attempt.mode === 'defquiz',
    def_perfect:() => attempt && attempt.mode === 'defquiz' && attempt.n >= 10 && attempt.c === attempt.n,
    chain_first:() => attempt && attempt.mode === 'chains',
    chain_clean:() => attempt && attempt.mode === 'chains' && attempt.n > 0 && attempt.c === attempt.n,
    chain_25:  () => (student.conceptTotals?.chains || 0) >= 25,
    diag_first:() => attempt && attempt.mode === 'diagrams',
    diag_perfect:() => attempt && attempt.mode === 'diagrams' && attempt.n > 0 && attempt.c === attempt.n,
    diag_all:  () => Object.keys(student.diagrams || {}).length >= (typeof DIAGRAMS !== 'undefined' ? DIAGRAMS.length : 9),
    syl_first:  () => (student.syl?.plays || 0) >= 1,
    syl_perfect:() => attempt && attempt.mode === 'syllabus' && attempt.n >= 10 && attempt.c === attempt.n,
    syl_100:    () => (student.syl?.rounds || 0) >= 100,
    syl_master: () => (student.syl?.rounds || 0) >= 100 && (student.syl.correct / student.syl.rounds) >= 0.85,
    syl_allgames:()=> Object.keys(student.syl?.perGame || {}).length >= 4,
  };
  for (const b of BADGES) {
    if (!has(b.id) && checks[b.id] && checks[b.id]()) { student.badges.push(b.id); earned.push(b); }
  }
  return earned;
}
