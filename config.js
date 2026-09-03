// ====================================================================
// Teacher Dashboard — Configuration
// This folder is deployed SEPARATELY from the student game, so students
// never see this file or the password in it.
// ====================================================================

// 1. DASHBOARD PASSWORD — change this!
const TEACHER_PASSWORD = "2026";

// 2. Link to the student game (shown as a button in the dashboard).
//    Leave "" to hide the button.
const STUDENT_SITE_URL = "";

// 2b. CLASS NAME — single-class build (no class battle). Must match the
//     student game's config.js.
const CLASSES = ["Physics"];

// 2c. AI MARKING ASSISTANT — paste your Anthropic API key to have the AI suggest
//     a mark and feedback for each submitted answer. You approve or override every
//     mark before students see it. Leave "" to mark entirely by hand (or use the
//     free "📋 Copy for marking" button with Cowork).
const AI_CONFIG = {
  apiKey: "",                              // paste your key here — starts with sk-ant-
  model: "claude-haiku-4-5-20251001",      // cheapest, plenty good for marking
  // model: "claude-sonnet-5",             // ~2x the cost, a bit more precise on 5–6 mark answers
};

// 3. FIREBASE — must be the SAME project as the student game's config.js.
const firebaseConfig = {
  apiKey: "AIzaSyDbwK2B3lfD9LJDcAToI7ZAn-L4GcAgoz4",
  authDomain: "prelim-physics-quiz-2026.firebaseapp.com",
  projectId: "prelim-physics-quiz-2026",
  storageBucket: "prelim-physics-quiz-2026.firebasestorage.app",
  messagingSenderId: "406585564285",
  appId: "1:406585564285:web:cec75faa98282b7b5fa514"
};
