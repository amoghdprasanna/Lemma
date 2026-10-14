/** Half-open character range [start, end) into a document's text. */
export interface Span {
  start: number;
  end: number;
}

export interface MacroUse {
  name: string;
  /** From the backslash to the end of the last argument read. */
  span: Span;
  starred: boolean;
  /** Raw text of each argument read, in signature order; null when absent. */
  args: (ArgText | null)[];
}

export interface ArgText {
  span: Span;
  contentSpan: Span;
  text: string;
}

export interface EnvironmentUse {
  name: string;
  span: Span;
  contentSpan: Span;
}

export interface MathSegment {
  span: Span;
  contentSpan: Span;
  display: boolean;
  /** `$`, `\(`, `$$`, `\[`, or the environment name. */
  delimiter: string;
}

export type LabelKind = 'equation' | 'figure' | 'table' | 'section' | 'theorem' | 'other';

export interface LabelDef {
  key: string;
  span: Span;
  kind: LabelKind;
  inAppendix: boolean;
}

export type RefCommand =
  'ref' | 'eqref' | 'pageref' | 'autoref' | 'cref' | 'Cref' | 'cpageref' | 'nameref' | 'hyperref';

export interface RefUse {
  command: RefCommand;
  keys: string[];
  span: Span;
  inAppendix: boolean;
}

export interface CiteUse {
  command: string;
  keys: string[];
  span: Span;
}

export interface Section {
  /** Position in document order (0-based). */
  index: number;
  command: string;
  /** part -1, chapter 0, section 1, subsection 2, subsubsection 3, paragraph 4, subparagraph 5. */
  level: number;
  starred: boolean;
  title: string;
  /** The `\section*[short]{Title}` command itself. */
  headingSpan: Span;
  /** After the heading up to the next heading of any level (or the end of the body). */
  bodySpan: Span;
  /** Heading plus all nested subsections. */
  span: Span;
  inAppendix: boolean;
  parentIndex: number | null;
  labels: string[];
}

export interface FloatEnv {
  kind: 'figure' | 'table';
  span: Span;
  captionSpan: Span | null;
  labelSpans: Span[];
}

export interface Abstract {
  span: Span;
  contentSpan: Span;
}

export interface BibEntry {
  type: string;
  key: string;
  fields: Record<string, string>;
  span: Span;
}

export interface MacroDefinition {
  name: string;
  span: Span;
  /** Replacement text, if simple enough to read. */
  body: string | null;
}

export interface DocumentModel {
  fileName: string | null;
  text: string;
  /** `text` with comments and verbatim blanked out (same length). */
  masked: string;
  kind: 'tex' | 'bib';
  parseError: string | null;
  isMain: boolean;
  documentClass: { name: string; options: string[] } | null;
  packages: { name: string; options: string[]; span: Span }[];
  /** Body of the document environment (or the whole text for fragments). */
  bodySpan: Span;
  macros: MacroUse[];
  environments: EnvironmentUse[];
  math: MathSegment[];
  comments: Span[];
  sections: Section[];
  appendixStart: number | null;
  abstract: Abstract | null;
  title: string | null;
  authorCount: number;
  labels: LabelDef[];
  refs: RefUse[];
  cites: CiteUse[];
  floats: FloatEnv[];
  bibliography: { span: Span; kind: 'bibtex' | 'thebibliography' | 'biblatex' } | null;
  inputs: { command: 'input' | 'include' | 'subfile'; path: string; span: Span }[];
  macroDefinitions: MacroDefinition[];
  bibEntries: BibEntry[];
}
