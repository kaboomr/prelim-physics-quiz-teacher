// AI marking for Section II short answers — talks to the Anthropic API from the browser.
// Requires AI_CONFIG.apiKey in config.js. Without a key the game falls back to self-marking.
"use strict";

const Marker = (() => {

  function enabled(){
    return typeof AI_CONFIG !== 'undefined' && !!(AI_CONFIG.apiKey || '').trim();
  }

  // ---- image helpers ----
  function fileToDataURL(file){
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  // Downscale + re-encode the student's photo (smaller upload, cheaper marking)
  function prepPhoto(dataURL, maxDim = 1600, quality = 0.85){
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          const out = c.toDataURL('image/jpeg', quality);
          res({ data: out.split(',')[1], media_type: 'image/jpeg', preview: out });
        } catch(e){
          // canvas tainted (can happen on file://) — send the original as-is
          const m = dataURL.match(/^data:(image\/\w+);base64,(.*)$/s);
          if (m) res({ data: m[2], media_type: m[1], preview: dataURL });
          else rej(e);
        }
      };
      img.onerror = rej;
      img.src = dataURL;
    });
  }

  // Fetch the exam question image as base64 so the marker sees the exact question.
  // Fails silently on file:// — the criteria text carries the requirements anyway.
  async function questionImageB64(url){
    try {
      const blob = await (await fetch(url)).blob();
      const dataURL = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
      const m = dataURL.match(/^data:(image\/\w+);base64,(.*)$/s);
      return m ? { data: m[2], media_type: m[1] } : null;
    } catch(e){ return null; }
  }

  const SYSTEM = `You are an experienced NESA Preliminary Physics marker at a marking centre.
Mark the student's answer strictly against the official NESA marking guideline provided. Award a whole number of marks from 0 to the maximum. Be fair but rigorous — apply the guideline the way a real NESA marker would, and use the sample answer as a guide to the expected standard, not a required wording.
The student's answer is handwritten and photographed. Read it carefully; imperfect handwriting is normal — mark what you can read. Only if the photo is genuinely unreadable, blank, or not a written answer should you set "readable" to false.
Respond with ONLY a JSON object, no other text, in exactly this shape:
{"readable": true, "transcript": "...", "mark": 0, "max": 0, "feedback": "...", "strengths": ["..."], "improvements": ["..."]}
- transcript: your best reading of the student's answer (condense if very long)
- feedback: 2–3 encouraging but honest sentences addressed to the student as "you"
- strengths / improvements: up to 3 short dot-point style phrases each`;

  function buildUserContent(q, qImg, student){
    const content = [];
    if (qImg) {
      content.push({ type: 'image', source: { type: 'base64', media_type: qImg.media_type, data: qImg.data } });
      content.push({ type: 'text', text: 'Above: the Preliminary exam question (including any stimulus) the student is answering.' });
    }
    content.push({ type: 'text', text:
      `QUESTION: ${q.year} Preliminary Physics, Question ${q.n}${q.part ? '(' + q.part + ')' : ''} — worth ${q.marks} mark${q.marks === 1 ? '' : 's'}. Topic: ${q.topic}.` +
      `\n\nOFFICIAL NESA MARKING GUIDELINE:\n${q.criteria}` +
      (q.sample ? `\n\nNESA SAMPLE ANSWER (guide to standard):\n${q.sample}` : '') });
    if (student.photo) {
      content.push({ type: 'image', source: { type: 'base64', media_type: student.photo.media_type, data: student.photo.data } });
      content.push({ type: 'text', text: `Above: the student's handwritten answer. Mark it out of ${q.marks} and respond with the JSON object only.` });
    } else {
      content.push({ type: 'text', text: `STUDENT'S TYPED ANSWER:\n${student.typed}\n\nMark it out of ${q.marks} and respond with the JSON object only (set "transcript" to the typed answer, "readable" to true).` });
    }
    return content;
  }

  function parseJSON(text){
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s === -1 || e === -1) throw new Error('No JSON in response');
    return JSON.parse(text.slice(s, e + 1));
  }

  // student: {photo:{data,media_type}} OR {typed:"..."}
  async function mark(q, student){
    const qImg = await questionImageB64(q.img);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': AI_CONFIG.apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: AI_CONFIG.model || 'claude-sonnet-4-5',
          max_tokens: 1200,
          system: SYSTEM,
          messages: [{ role: 'user', content: buildUserContent(q, qImg, student) }]
        })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        const msg = (err.error && err.error.message) || ('API error ' + resp.status);
        return { ok: false, err: resp.status === 401 ? 'API key rejected — check AI_CONFIG.apiKey in config.js' : msg };
      }
      const data = await resp.json();
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      const j = parseJSON(text);
      const max = q.marks;
      const mk = Math.max(0, Math.min(max, Math.round(Number(j.mark) || 0)));
      return {
        ok: true,
        readable: j.readable !== false,
        mark: mk, max,
        feedback: j.feedback || '',
        strengths: Array.isArray(j.strengths) ? j.strengths.slice(0, 3) : [],
        improvements: Array.isArray(j.improvements) ? j.improvements.slice(0, 3) : [],
        transcript: j.transcript || ''
      };
    } catch(e){
      return { ok: false, err: e.name === 'AbortError' ? 'Marking timed out — check your connection and try again.' : 'Could not reach the marking service — check your internet connection.' };
    } finally {
      clearTimeout(timer);
    }
  }

  return { enabled, fileToDataURL, prepPhoto, mark };
})();
