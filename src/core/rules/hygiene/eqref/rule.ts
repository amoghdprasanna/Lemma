import { hasPackage } from '../../../model/build';
import { mechanical } from '../../../fixes/text-edit';
import type { Finding, Rule } from '../../types';

const rule: Rule = {
  id: 'hygiene/eqref',
  category: 'hygiene',
  severity: 'warning',
  title: 'Equation referenced with \\ref',
  cardId: 'eqref',
  check({ model }) {
    const kinds = new Map(model.labels.map((l) => [l.key, l.kind]));
    const amsmath =
      hasPackage(model, 'amsmath') ||
      hasPackage(model, 'mathtools') ||
      /^ams(?:art|book)$/.test(model.documentClass?.name ?? '');
    const cleveref = hasPackage(model, 'cleveref');
    const findings: Finding[] = [];
    for (const r of model.refs) {
      if (r.command !== 'ref' || r.keys.length !== 1) continue;
      const key = r.keys[0] ?? '';
      const kind = kinds.get(key);
      if (kind !== 'equation' && !(kind === undefined && /^eqs?[:.-]/.test(key))) continue;
      // Include hand-written parentheses: "(\ref{eq:x})" -> "\eqref{eq:x}".
      const wrapped = model.text[r.span.start - 1] === '(' && model.text[r.span.end] === ')';
      const start = wrapped ? r.span.start - 1 : r.span.start;
      const end = wrapped ? r.span.end + 1 : r.span.end;
      findings.push({
        message: `Equation "${key}" is referenced with \\ref. Use \\eqref, which adds the parentheses and keeps equation references consistent${cleveref ? ' (or \\cref, since cleveref is loaded)' : ''}.${amsmath ? '' : ' \\eqref needs the amsmath package.'}`,
        span: r.span,
        ...(amsmath
          ? {
              fixes: [
                {
                  title: `Use \\eqref{${key}}`,
                  edits: [mechanical(start, end, `\\eqref{${key}}`)],
                },
              ],
            }
          : {}),
      });
    }
    return findings;
  },
};

export default rule;
