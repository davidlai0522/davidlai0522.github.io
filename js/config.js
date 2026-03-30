/**
 * SECTION REGISTRY
 * ─────────────────────────────────────────────────────────────
 * To add a new section / tab to the portfolio:
 *   1. Add one object to the SECTIONS array below.
 *   2. Create the corresponding HTML file at `file`.
 *   3. Done — the nav tab appears automatically.
 *
 * Fields:
 *   id    — unique key used in the URL  (?tab=<id>)
 *   label — text shown in the nav tab
 *   file  — path to the section HTML file (relative to site root)
 * ─────────────────────────────────────────────────────────────
 */
const SECTIONS = [
  {
    id:    'about',
    label: '🧑‍🚀 About Me',
    file:  'sections/section_1/about.html',
  },
  {
    id:    'lit',
    label: '📚 Lit Review',
    file:  'sections/section_2/lit_review.html',
  },
  {
    id:    'notes',
    label: '🛠 Useful Notes',
    file:  'sections/section_3/notes.html',
  },
  {
    id:    'fun',
    label: '🎉 Fun Stuff',
    file:  'sections/section_4/fun.html',
  },

  // ── ADD NEW SECTIONS BELOW THIS LINE ─────────────────────
  // Example:
  // {
  //   id:    'projects',
  //   label: '🚀 Projects',
  //   file:  'sections/section_5/projects.html',
  // },
];
