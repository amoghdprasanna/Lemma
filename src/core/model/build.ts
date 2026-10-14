import { parse } from '@unified-latex/unified-latex-util-parse';
import type * as Ast from '@unified-latex/unified-latex-types';
import { parseBib } from './bib';
import { readArgs, splitKeys, type Signature } from './scan';
import { blankSpans, contains } from './text';
import type {
  CiteUse,
  DocumentModel,
  EnvironmentUse,
  FloatEnv,
  LabelDef,
  LabelKind,
  MacroDefinition,
  MacroUse,
  MathSegment,
  RefCommand,
  RefUse,
  Section,
  Span,
} from './types';

const SECTION_LEVELS: Record<string, number> = {
  part: -1,
  chapter: 0,
  section: 1,
  subsection: 2,
  subsubsection: 3,
  paragraph: 4,
  subparagraph: 5,
};

const REF_COMMANDS = new Set<RefCommand>([
  'ref',
  'eqref',
  'pageref',
  'autoref',
  'cref',
  'Cref',
  'cpageref',
  'nameref',
  'hyperref',
]);

const CITE_COMMAND = /^(?:cite[a-zA-Z]*|onlinecite|textcite|parencite|autocite|footcite|nocite)$/;

/** Argument signatures for the macros Lemma reads. Others are recorded without arguments. */
const SIGNATURES: Record<string, Signature> = {
  ...Object.fromEntries(Object.keys(SECTION_LEVELS).map((k) => [k, 'som'])),
  label: 'm',
  bibitem: 'om',
  ref: 'sm',
  eqref: 'm',
  pageref: 'sm',
  autoref: 'sm',
  cref: 'sm',
  Cref: 'sm',
  cpageref: 'm',
  nameref: 'sm',
  hyperref: 'om',
  caption: 'som',
  title: 'om',
  author: 'om',
  affiliation: 'om',
  usepackage: 'om',
  documentclass: 'om',
  bibliography: 'm',
  bibliographystyle: 'm',
  addbibresource: 'om',
  input: 'm',
  include: 'm',
  subfile: 'm',
  newcommand: 'smoom',
  renewcommand: 'smoom',
  providecommand: 'smoom',
  DeclareMathOperator: 'smm',
  qty: 'omm',
  SI: 'omom',
  ket: 'sm',
  bra: 'sm',
  braket: 'smo',
  ketbra: 'smo',
  dyad: 'smo',
  expval: 'smo',
  mel: 'smmm',
  Tr: 'm',
  tr: 'm',
  mathrm: 'm',
  text: 'm',
  textrm: 'm',
  operatorname: 'sm',
  emph: 'm',
  textit: 'm',
  textbf: 'm',
};

const MATH_ENVS = new Set([
  'equation',
  'equation*',
  'align',
  'align*',
  'gather',
  'gather*',
  'multline',
  'multline*',
  'eqnarray',
  'eqnarray*',
  'flalign',
  'flalign*',
  'alignat',
  'alignat*',
  'displaymath',
  'math',
]);

const THEOREM_ENVS =
  /^(?:theorem|lemma|proposition|corollary|definition|conjecture|claim|remark|example)\*?$/i;

function cite(name: string): boolean {
  return CITE_COMMAND.test(name);
}

function envName(node: Ast.Environment): string {
  const env = node.env as unknown;
  if (typeof env === 'string') return env;
  if (typeof env === 'object' && env !== null && 'content' in env) {
    const content = env.content;
    if (typeof content === 'string') return content;
  }
  return '';
}

function span(node: Ast.Node): Span | null {
  const p = node.position;
  return p ? { start: p.start.offset, end: p.end.offset } : null;
}

interface Raw {
  macros: { name: string; start: number; nameEnd: number }[];
  environments: EnvironmentUse[];
  math: MathSegment[];
  comments: Span[];
  verbatim: Span[];
}

function walk(nodes: Ast.Node[] | Ast.Node, text: string, raw: Raw): void {
  if (Array.isArray(nodes)) {
    for (const n of nodes) walk(n, text, raw);
    return;
  }
  const node = nodes;
  const s = span(node);
  switch (node.type) {
    case 'comment':
      if (s) raw.comments.push(s);
      return;
    case 'verb':
    case 'verbatim':
      if (s) raw.verbatim.push(s);
      return;
    case 'inlinemath':
    case 'displaymath': {
      if (s) {
        const display = node.type === 'displaymath';
        const delimiter = text.startsWith('$$', s.start)
          ? '$$'
          : text.startsWith('\\[', s.start)
            ? '\\['
            : text.startsWith('\\(', s.start)
              ? '\\('
              : '$';
        const width = delimiter.length;
        raw.math.push({
          span: s,
          contentSpan: { start: s.start + width, end: s.end - width },
          display,
          delimiter,
        });
      }
      walk(node.content, text, raw);
      return;
    }
    case 'environment':
    case 'mathenv': {
      const name = envName(node);
      if (s) {
        const begin = `\\begin{${name}}`;
        const end = `\\end{${name}}`;
        const contentStart = text.startsWith(begin, s.start) ? s.start + begin.length : s.start;
        const contentEnd = text.slice(0, s.end).endsWith(end) ? s.end - end.length : s.end;
        raw.environments.push({
          name,
          span: s,
          contentSpan: { start: contentStart, end: contentEnd },
        });
        if (MATH_ENVS.has(name)) {
          raw.math.push({
            span: s,
            contentSpan: { start: contentStart, end: contentEnd },
            display: true,
            delimiter: name,
          });
        }
      }
      walk(node.content, text, raw);
      if (node.args) for (const a of node.args) walk(a.content, text, raw);
      return;
    }
    case 'macro': {
      if (s) raw.macros.push({ name: node.content, start: s.start, nameEnd: s.end });
      if (node.args) for (const a of node.args) walk(a.content, text, raw);
      return;
    }
    case 'group':
    case 'root':
      walk(node.content, text, raw);
      return;
    default:
      return;
  }
}

function labelKind(at: number, envs: EnvironmentUse[], sections: Section[]): LabelKind {
  let best: EnvironmentUse | null = null;
  for (const e of envs) {
    if (contains(e.span, at) && (best === null || e.span.start >= best.span.start)) best = e;
  }
  if (best) {
    const name = best.name;
    if (MATH_ENVS.has(name) || /^subequations$/.test(name)) return 'equation';
    if (/^figure\*?$/.test(name) || /^wrapfigure$/.test(name)) return 'figure';
    if (/^table\*?$/.test(name)) return 'table';
    if (THEOREM_ENVS.test(name)) return 'theorem';
  }
  const sec = sections.find((x) => x.bodySpan.start <= at && at < x.bodySpan.start + 120);
  return sec ? 'section' : 'other';
}

/** Builds the document model for a `.tex` or `.bib` file. Pure. */
export function buildModel(text: string, fileName: string | null = null): DocumentModel {
  if (fileName?.toLowerCase().endsWith('.bib') === true) return bibModel(text, fileName);

  const raw: Raw = { macros: [], environments: [], math: [], comments: [], verbatim: [] };
  let parseError: string | null = null;
  try {
    walk(parse(text).content, text, raw);
  } catch (e) {
    parseError = e instanceof Error ? e.message : String(e);
  }
  const masked = blankSpans(text, [...raw.comments, ...raw.verbatim]);
  raw.math.sort((a, b) => a.span.start - b.span.start);
  raw.environments.sort((a, b) => a.span.start - b.span.start);

  const macros: MacroUse[] = raw.macros
    .sort((a, b) => a.start - b.start)
    .map((m) => {
      const sig = SIGNATURES[m.name];
      if (sig === undefined) {
        return { name: m.name, span: { start: m.start, end: m.nameEnd }, starred: false, args: [] };
      }
      const r = readArgs(masked, text, m.nameEnd, sig);
      return {
        name: m.name,
        span: { start: m.start, end: r.end },
        starred: r.starred,
        args: r.args,
      };
    });

  const docEnv = raw.environments.find((e) => e.name === 'document');
  const bodySpan = docEnv ? docEnv.contentSpan : { start: 0, end: text.length };
  const isMain = macros.some((m) => m.name === 'documentclass') || docEnv !== undefined;

  const documentClassMacro = macros.find((m) => m.name === 'documentclass');
  const documentClass = documentClassMacro
    ? {
        name: documentClassMacro.args[1]?.text.trim() ?? '',
        options: splitKeys(documentClassMacro.args[0]?.text ?? ''),
      }
    : null;

  const packages = macros
    .filter((m) => m.name === 'usepackage')
    .flatMap((m) =>
      splitKeys(m.args[1]?.text ?? '').map((name) => ({
        name,
        options: splitKeys(m.args[0]?.text ?? ''),
        span: m.span,
      })),
    );

  const appendixMacro = macros.find((m) => m.name === 'appendix');
  const appendixEnv = raw.environments.find(
    (e) => e.name === 'appendix' || e.name === 'appendices',
  );
  const appendixStart = appendixMacro?.span.start ?? appendixEnv?.span.start ?? null;
  const inAppendix = (at: number) => appendixStart !== null && at >= appendixStart;

  const bibMacro = macros.find((m) => m.name === 'bibliography' || m.name === 'printbibliography');
  const bibEnv = raw.environments.find((e) => e.name === 'thebibliography');
  const bibliography = bibEnv
    ? { span: bibEnv.span, kind: 'thebibliography' as const }
    : bibMacro
      ? {
          span: bibMacro.span,
          kind: bibMacro.name === 'bibliography' ? ('bibtex' as const) : ('biblatex' as const),
        }
      : null;

  const bodyEnd = Math.min(
    bodySpan.end,
    bibliography && bibliography.span.start > bodySpan.start
      ? bibliography.span.start
      : bodySpan.end,
  );

  // Sections, in document order.
  const headings = macros.filter((m) => m.name in SECTION_LEVELS && m.span.start >= bodySpan.start);
  const sections: Section[] = headings.map((m, index) => {
    const titleArg = m.args[1] ?? m.args[0] ?? null;
    const next = headings[index + 1];
    const bodyStart = m.span.end;
    const bodyStop = Math.max(bodyStart, Math.min(next ? next.span.start : bodyEnd, bodyEnd));
    return {
      index,
      command: m.name,
      level: SECTION_LEVELS[m.name] ?? 1,
      starred: m.starred,
      title: titleArg?.text.trim() ?? '',
      headingSpan: m.span,
      bodySpan: { start: bodyStart, end: bodyStop },
      span: { start: m.span.start, end: bodyStop },
      inAppendix: inAppendix(m.span.start),
      parentIndex: null,
      labels: [],
    };
  });
  const stack: Section[] = [];
  for (const sec of sections) {
    while (stack.length > 0 && (stack[stack.length - 1]?.level ?? 0) >= sec.level) stack.pop();
    const parent = stack[stack.length - 1];
    sec.parentIndex = parent ? parent.index : null;
    stack.push(sec);
  }
  // A section's full span runs until the next heading at the same or a higher level.
  for (const sec of sections) {
    const next = sections.find((x) => x.index > sec.index && x.level <= sec.level);
    sec.span = { start: sec.headingSpan.start, end: next ? next.headingSpan.start : bodyEnd };
  }

  const labels: LabelDef[] = macros
    .filter((m) => m.name === 'label' && m.args[0])
    .map((m) => ({
      key: m.args[0]?.text.trim() ?? '',
      span: m.span,
      kind: labelKind(m.span.start, raw.environments, sections),
      inAppendix: inAppendix(m.span.start),
    }));
  for (const l of labels) {
    if (l.kind !== 'section') continue;
    const sec = sections.find((x) => contains(x.bodySpan, l.span.start));
    sec?.labels.push(l.key);
  }

  const refs: RefUse[] = macros
    .filter((m): m is MacroUse & { name: RefCommand } => REF_COMMANDS.has(m.name as RefCommand))
    .map((m) => ({
      command: m.name,
      keys: splitKeys(
        (m.name === 'hyperref' ? m.args[0]?.text : m.args[m.args.length - 1]?.text) ?? '',
      ),
      span: m.span,
      inAppendix: inAppendix(m.span.start),
    }))
    .filter((r) => r.keys.length > 0);

  const cites: CiteUse[] = macros
    .filter((m) => cite(m.name))
    .map((m) => {
      const last = [...m.args].reverse().find((a) => a !== null);
      const keyArg =
        SIGNATURES[m.name] === undefined ? readArgs(masked, text, m.span.end, 'oom') : null;
      const keys = keyArg ? (keyArg.args[2]?.text ?? '') : (last?.text ?? '');
      const end = keyArg ? keyArg.end : m.span.end;
      return { command: m.name, keys: splitKeys(keys), span: { start: m.span.start, end } };
    });

  const floats: FloatEnv[] = raw.environments
    .filter((e) => /^(?:figure|table)\*?$/.test(e.name))
    .map((e) => {
      const inside = macros.filter((m) => contains(e.span, m.span));
      const caption = inside.find((m) => m.name === 'caption');
      return {
        kind: e.name.startsWith('figure') ? ('figure' as const) : ('table' as const),
        span: e.span,
        captionSpan: caption?.span ?? null,
        labelSpans: inside.filter((m) => m.name === 'label').map((m) => m.span),
      };
    });

  const abstractEnv = raw.environments.find((e) => e.name === 'abstract');
  const titleMacro = macros.find((m) => m.name === 'title');

  const macroDefinitions: MacroDefinition[] = macros.flatMap((m): MacroDefinition[] => {
    if (/^(?:re|provide|new)command$/.test(m.name)) {
      const nameArg = m.args[0];
      const after = masked.slice(
        m.span.start + m.name.length + 1,
        m.span.start + m.name.length + 40,
      );
      const name = nameArg
        ? nameArg.text.trim().replace(/^\\/, '')
        : /^\*?\s*\\([a-zA-Z@]+)/.exec(after)?.[1];
      if (name === undefined || name === '') return [];
      return [{ name, span: m.span, body: m.args[3]?.text ?? null }];
    }
    if (m.name === 'DeclareMathOperator') {
      const name = m.args[0]?.text.trim().replace(/^\\/, '');
      return name ? [{ name, span: m.span, body: m.args[1]?.text ?? null }] : [];
    }
    if (m.name === 'def') {
      const name = /^\s*\\([a-zA-Z@]+)/.exec(masked.slice(m.span.end, m.span.end + 40))?.[1];
      return name ? [{ name, span: m.span, body: null }] : [];
    }
    return [];
  });

  const inputs = macros
    .filter((m): m is MacroUse & { name: 'input' | 'include' | 'subfile' } =>
      ['input', 'include', 'subfile'].includes(m.name),
    )
    .flatMap((m) => {
      const path = m.args[0]?.text.trim();
      return path ? [{ command: m.name, path, span: m.span }] : [];
    });

  return {
    fileName,
    text,
    masked,
    kind: 'tex',
    parseError,
    isMain,
    documentClass,
    packages,
    bodySpan,
    macros,
    environments: raw.environments,
    math: raw.math,
    comments: raw.comments,
    sections,
    appendixStart,
    abstract: abstractEnv ? { span: abstractEnv.span, contentSpan: abstractEnv.contentSpan } : null,
    title: titleMacro?.args[1]?.text.trim() ?? null,
    authorCount: macros.filter((m) => m.name === 'author').length,
    labels,
    refs,
    cites,
    floats,
    bibliography,
    inputs,
    macroDefinitions,
    bibEntries: [],
  };
}

function bibModel(text: string, fileName: string): DocumentModel {
  return {
    fileName,
    text,
    masked: text,
    kind: 'bib',
    parseError: null,
    isMain: false,
    documentClass: null,
    packages: [],
    bodySpan: { start: 0, end: text.length },
    macros: [],
    environments: [],
    math: [],
    comments: [],
    sections: [],
    appendixStart: null,
    abstract: null,
    title: null,
    authorCount: 0,
    labels: [],
    refs: [],
    cites: [],
    floats: [],
    bibliography: null,
    inputs: [],
    macroDefinitions: [],
    bibEntries: parseBib(text),
  };
}

export function hasPackage(model: DocumentModel, name: string): boolean {
  return model.packages.some((p) => p.name === name);
}

export function definesMacro(model: DocumentModel, name: string): boolean {
  return model.macroDefinitions.some((d) => d.name === name);
}
