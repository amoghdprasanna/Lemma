import { blankSpans } from '../model/text';
import type { DocumentModel, Span } from '../model/types';

const KEY_MACROS = new Set([
  'label',
  'ref',
  'eqref',
  'pageref',
  'autoref',
  'cref',
  'Cref',
  'cpageref',
  'nameref',
  'hyperref',
  'usepackage',
  'documentclass',
  'bibliography',
  'bibliographystyle',
  'addbibresource',
  'input',
  'include',
  'subfile',
  'newcommand',
  'renewcommand',
  'providecommand',
  'DeclareMathOperator',
]);

const memo = new WeakMap<DocumentModel, string>();

/**
 * The document text with everything that is not running prose blanked out
 * (same length): comments, verbatim, math, citation/label keys, macro names
 * and environment names. Offsets stay valid.
 */
export function proseMask(model: DocumentModel): string {
  const cached = memo.get(model);
  if (cached !== undefined) return cached;
  const blank: Span[] = model.math.map((m) => m.span);
  for (const m of model.macros) {
    if (KEY_MACROS.has(m.name) || /^cite|^onlinecite$|^textcite$|^parencite$/.test(m.name))
      blank.push(m.span);
  }
  for (const c of model.cites) blank.push(c.span);
  for (const e of model.environments) {
    blank.push({ start: e.span.start, end: e.contentSpan.start });
    blank.push({ start: e.contentSpan.end, end: e.span.end });
  }
  let text = blankSpans(model.masked, blank);
  text = text.replace(/\\[a-zA-Z@]+\*?/g, (s) => ' '.repeat(s.length)).replace(/\\./g, '  ');
  memo.set(model, text);
  return text;
}
