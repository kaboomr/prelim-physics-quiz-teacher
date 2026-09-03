# Preliminary Physics — Teacher Dashboard

**Deploy this to its own repository, separate from the student game.**
Students must never be able to reach this site.

Deploy with GitHub Pages: **Settings → Pages → branch `main`, folder `/root`**.
Use an obscure repository name (avoid "teacher", "admin", "quiz"), bookmark the
URL, and don't share it with students.

## Security

This is a static site, so **anything in it is readable by anyone who has the URL** —
including `TEACHER_PASSWORD` in `config.js`. The password stops a student who
stumbles onto the page from clicking around; it is not real protection against
someone reading the source.

If the repository is public, treat the dashboard URL itself as the secret:

- Use a long, random repository name.
- Set a `TEACHER_PASSWORD` you don't use anywhere else.
- If you paste an Anthropic API key into `AI_CONFIG`, the repository **must** be
  private, or the key will be published. (A private repo needs a paid GitHub plan
  for Pages.) Leaving `apiKey: ""` and marking by hand avoids this entirely.

## What's in here

| File | Purpose |
|---|---|
| `index.html` | Dashboard — overview, students, topic analysis, marking, class list |
| `config.js` | Dashboard password, Firebase project, optional AI marking key |
| `syllabus.js` | Topic and sub-topic map (must match the student game) |
| `data-sa.js` | Short-answer questions, criteria and sample answers (must match the student game) |
| `store.js` | Firebase/localStorage data layer, XP, badges |
| `marker.js` | AI marking assistant |
| `IND21_q*.png`, `P22_q*.png`/`.svg`, `JR20_q*.png` | Short-answer question images (must match the student game) |

**On the question bank:** `data-sa.js` holds 52 Section II sub-questions from three real
papers (2021 NSW Independent Trial Exams, 2022 NSW Independent Exams, and James Ruse's
2020 Physics Year 11 Yearly Exam), with official marking criteria and sample answers —
see the student game's README for sourcing details. Whenever `data-sa.js` there is updated with more past-paper
questions, copy the same file (and matching images) here so marking criteria stay in
sync between the two sites.

## Notes

- Firebase must point at the **same project** as the student game's `config.js`.
- Class list changes save to Firebase and need no re-upload of either site.
- `syllabus.js` here and `syllabus.js` in the game folder must stay in step.
