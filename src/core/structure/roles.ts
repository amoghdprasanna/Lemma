/**
 * Roles a part of a paper can fulfil. Checks reason about roles, never about
 * exact headings: "Encoding scheme" can fill `methods`, and one section can
 * fill several roles.
 */
export const ROLES = [
  'front-matter',
  'summary',
  'motivation',
  'prior-work',
  'notation',
  'methods',
  'results',
  'interpretation',
  'outlook',
  'acknowledgments',
  'availability',
  'references',
  'supplementary',
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export interface RoleInfo {
  label: string;
  /** One-line purpose shown in the outline and learning layer. */
  purpose: string;
  cardId: string;
}

export const ROLE_INFO: Record<Role, RoleInfo> = {
  'front-matter': {
    label: 'Front matter',
    purpose: 'Title, authors and affiliations: who did the work and where.',
    cardId: 'paper-roles',
  },
  summary: {
    label: 'Summary',
    purpose: 'The abstract: the problem, what you did, and the main result, in one paragraph.',
    cardId: 'abstract',
  },
  motivation: {
    label: 'Motivation',
    purpose: 'Why the problem matters, what is missing, what this paper contributes.',
    cardId: 'introduction-roadmap',
  },
  'prior-work': {
    label: 'Prior work',
    purpose: 'Results and definitions you build on, with citations.',
    cardId: 'preliminaries-notation',
  },
  notation: {
    label: 'Notation',
    purpose: 'Symbols, conventions and definitions the reader needs before the main part.',
    cardId: 'preliminaries-notation',
  },
  methods: {
    label: 'Methods',
    purpose: 'The model, setup, construction or protocol, in enough detail to reproduce.',
    cardId: 'paper-roles',
  },
  results: {
    label: 'Results',
    purpose: 'What you found: theorems, numerics, measurements.',
    cardId: 'results-discussion-conclusion',
  },
  interpretation: {
    label: 'Interpretation',
    purpose: 'What the results mean, their limits, and how they compare with prior work.',
    cardId: 'results-discussion-conclusion',
  },
  outlook: {
    label: 'Outlook',
    purpose: 'The take-away and open questions.',
    cardId: 'results-discussion-conclusion',
  },
  acknowledgments: {
    label: 'Acknowledgments',
    purpose: 'Funding, collaborators and resources.',
    cardId: 'acknowledgments-availability',
  },
  availability: {
    label: 'Data & code',
    purpose: 'Where readers can find the data and code behind the results.',
    cardId: 'acknowledgments-availability',
  },
  references: {
    label: 'References',
    purpose: 'The bibliography.',
    cardId: 'bibliography-doi',
  },
  supplementary: {
    label: 'Supplementary',
    purpose: 'Appendices or supplemental material: proofs, derivations, extra data.',
    cardId: 'appendices',
  },
};

/**
 * Heading aliases shared by every profile (normalised, see normalizeHeading).
 * A profile can add its own. Matching is exact on the normalised heading first,
 * then keyword-based.
 */
export const COMMON_ALIASES: Record<string, Role[]> = {
  introduction: ['motivation'],
  intro: ['motivation'],
  motivation: ['motivation'],
  overview: ['motivation'],
  background: ['prior-work', 'notation'],
  preliminaries: ['prior-work', 'notation'],
  'background and notation': ['prior-work', 'notation'],
  notation: ['notation'],
  'notation and definitions': ['notation'],
  definitions: ['notation'],
  'related work': ['prior-work'],
  'prior work': ['prior-work'],
  'previous work': ['prior-work'],
  methods: ['methods'],
  method: ['methods'],
  methodology: ['methods'],
  model: ['methods'],
  'the model': ['methods'],
  setup: ['methods'],
  'setup and methods': ['methods'],
  'model and methods': ['methods'],
  'theoretical framework': ['methods'],
  framework: ['methods'],
  results: ['results'],
  'main results': ['results'],
  'numerical results': ['results'],
  'numerical experiments': ['results'],
  numerics: ['results'],
  simulations: ['results'],
  experiments: ['results'],
  'results and discussion': ['results', 'interpretation'],
  discussion: ['interpretation'],
  'discussion and outlook': ['interpretation', 'outlook'],
  conclusion: ['outlook'],
  conclusions: ['outlook'],
  'conclusion and outlook': ['outlook'],
  'conclusions and outlook': ['outlook'],
  'summary and outlook': ['outlook'],
  summary: ['outlook'],
  outlook: ['outlook'],
  'concluding remarks': ['outlook'],
  acknowledgments: ['acknowledgments'],
  acknowledgements: ['acknowledgments'],
  acknowledgment: ['acknowledgments'],
  acknowledgement: ['acknowledgments'],
  'data availability': ['availability'],
  'code availability': ['availability'],
  'data and code availability': ['availability'],
  'code and data availability': ['availability'],
  'data availability statement': ['availability'],
  references: ['references'],
  bibliography: ['references'],
  appendix: ['supplementary'],
  appendices: ['supplementary'],
  'supplemental material': ['supplementary'],
  'supplementary material': ['supplementary'],
};

/** Keyword heuristics, tried in order when no alias matches. */
export const ROLE_KEYWORDS: readonly (readonly [RegExp, Role[]])[] = [
  [/\backnowledg/, ['acknowledgments']],
  [/\bavailability\b/, ['availability']],
  [/\bintroduc/, ['motivation']],
  [/\b(?:preliminar|background|notation|definitions?)\b/, ['prior-work', 'notation']],
  [/\b(?:related|prior|previous) work\b/, ['prior-work']],
  [/\b(?:discussion)\b/, ['interpretation']],
  [/\b(?:conclu|outlook|future|perspective|open (?:problems|questions))/, ['outlook']],
  [
    /\b(?:results?|numeric|simulat|benchmark|experiment|performance|threshold|main theorem|bounds?|analysis)/,
    ['results'],
  ],
  [
    /\b(?:method|model|setup|set-up|scheme|protocol|construction|encoding|decoder|decoding|circuit|architecture|framework|algorithm|hamiltonian|ansatz)/,
    ['methods'],
  ],
];
