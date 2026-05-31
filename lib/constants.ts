export const CONTENT_VERSION = '1.0.0'
export const UNITS = 9
export const ESSAY_PASS_THRESHOLD = 0.6   // ≥60% on DBQ/LEQ/SAQ counts as passed

// Score maxes per AP rubric
export const ESSAY_SCORE_MAX: Record<string, number> = {
  dbq: 7,
  leq: 6,
  saq: 3,
}

// Source display names and colors for ResourceRow
export const SOURCE_META: Record<string, { label: string; color: string }> = {
  heimler:       { label: "Heimler's History", color: 'text-red-600 dark:text-red-400' },
  amsco:         { label: 'AMSCO Textbook',    color: 'text-blue-700 dark:text-blue-400' },
  marco_learning:{ label: 'Marco Learning',    color: 'text-purple-600 dark:text-purple-400' },
  tom_richey:    { label: 'Tom Richey',        color: 'text-emerald-700 dark:text-emerald-400' },
  fiveable:      { label: 'Fiveable',          color: 'text-pink-600 dark:text-pink-400' },
  albert_io:     { label: 'Albert.io',         color: 'text-amber-700 dark:text-amber-500' },
  college_board: { label: 'College Board',     color: 'text-indigo-700 dark:text-indigo-400' },
  knowt:         { label: 'Knowt',             color: 'text-teal-600 dark:text-teal-400' },
  num8ers:       { label: 'NUM8ERS Archive',   color: 'text-stone-600 dark:text-stone-400' },
}

// Unit titles for display
export const UNIT_TITLES: Record<number, string> = {
  1: 'Renaissance and Exploration',
  2: 'The Age of Reformation',
  3: 'Absolutism and Constitutionalism',
  4: 'Scientific, Philosophical, and Political Developments',
  5: 'Conflict, Crisis, and Reaction in the Late 18th Century',
  6: 'Industrialization and Its Effects',
  7: '19th-Century Perspectives and Political Developments',
  8: '20th-Century Global Conflicts',
  9: 'Cold War and Contemporary Europe',
}

// Topic counts per unit (for static param generation)
export const UNIT_TOPIC_COUNTS: Record<number, number> = {
  1: 10, 2: 8, 3: 8, 4: 7, 5: 9, 6: 10, 7: 9, 8: 11, 9: 15,
}
