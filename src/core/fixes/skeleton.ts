import type { Role } from '../structure/roles';
import type { TextEdit } from './text-edit';

/**
 * Curated skeletons: a heading and a question for the author. These strings
 * are the only free text Lemma ever inserts, and the guard only accepts text
 * from this table. Questions, never answers.
 */
export interface SkeletonTemplate {
  heading: string;
  prompt: string;
  starred: boolean;
}

export const SKELETON_TEMPLATES: Partial<Record<Role, SkeletonTemplate>> = {
  motivation: {
    heading: 'Introduction',
    prompt:
      'TODO: What is the context, what is missing, and what does this paper contribute? End with a roadmap of the sections.',
    starred: false,
  },
  'prior-work': {
    heading: 'Preliminaries',
    prompt: 'TODO: Which definitions, notation and prior results does the reader need?',
    starred: false,
  },
  notation: {
    heading: 'Preliminaries',
    prompt: 'TODO: Which definitions, notation and prior results does the reader need?',
    starred: false,
  },
  methods: {
    heading: 'Methods',
    prompt: 'TODO: What did you do, in enough detail for someone to reproduce it?',
    starred: false,
  },
  results: {
    heading: 'Results',
    prompt: 'TODO: What did you find? Point to the figures, tables and theorems that show it.',
    starred: false,
  },
  interpretation: {
    heading: 'Discussion',
    prompt:
      'TODO: What do your results mean? What are their limitations, and how do they compare with prior work?',
    starred: false,
  },
  outlook: {
    heading: 'Conclusion',
    prompt: 'TODO: What is the take-away, and which questions remain open?',
    starred: false,
  },
  acknowledgments: {
    heading: 'Acknowledgments',
    prompt: 'TODO: Who funded or helped with this work?',
    starred: true,
  },
  availability: {
    heading: 'Data availability',
    prompt: 'TODO: Where can readers find the data and code behind your results?',
    starred: true,
  },
  supplementary: {
    heading: 'Appendix',
    prompt: 'TODO: Which proofs, derivations or extra data would interrupt the main text?',
    starred: false,
  },
};

export const ABSTRACT_PROMPT =
  'TODO: In one paragraph: the problem, what you did, and the main result. No citations.';
export const REFERENCES_PROMPT =
  'TODO: Add your bibliography here, e.g. \\bibliography{references} with a .bib file.';

/** Every comment text the guard accepts in a skeleton edit. */
export const SKELETON_PROMPTS: ReadonlySet<string> = new Set([
  ...Object.values(SKELETON_TEMPLATES).map((t) => t.prompt),
  ABSTRACT_PROMPT,
  REFERENCES_PROMPT,
]);

export const SKELETON_HEADINGS: ReadonlySet<string> = new Set(
  Object.values(SKELETON_TEMPLATES).map((t) => t.heading),
);

export function sectionSkeleton(
  role: Role,
  at: number,
  acknowledgmentsEnv: boolean,
): TextEdit | null {
  const t = SKELETON_TEMPLATES[role];
  if (!t) return null;
  if (role === 'acknowledgments' && acknowledgmentsEnv) {
    return {
      kind: 'skeleton',
      start: at,
      end: at,
      insert: `\n\\begin{acknowledgments}\n% ${t.prompt}\n\\end{acknowledgments}\n`,
    };
  }
  const cmd = t.starred ? '\\section*' : '\\section';
  return {
    kind: 'skeleton',
    start: at,
    end: at,
    insert: `\n${cmd}{${t.heading}}\n% ${t.prompt}\n`,
  };
}

export function abstractSkeleton(at: number): TextEdit {
  return {
    kind: 'skeleton',
    start: at,
    end: at,
    insert: `\n\\begin{abstract}\n% ${ABSTRACT_PROMPT}\n\\end{abstract}\n`,
  };
}

export function referencesSkeleton(at: number): TextEdit {
  return { kind: 'skeleton', start: at, end: at, insert: `\n% ${REFERENCES_PROMPT}\n` };
}
