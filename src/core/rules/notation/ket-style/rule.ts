import { mechanical } from '../../../fixes/text-edit';
import { findKets, ketMacros, ketToManual, ketToMacro } from '../../../notation/math';
import type { Finding, Rule } from '../../types';

const rule: Rule = {
  id: 'notation/ket-style',
  category: 'notation',
  severity: 'warning',
  title: 'Mixed bra-ket notation',
  cardId: 'ket-notation',
  check({ model }) {
    const kets = findKets(model);
    const manual = kets.filter((k) => k.style === 'manual');
    const macro = kets.filter((k) => k.style === 'macro');
    if (manual.length === 0 || macro.length === 0) return [];
    const pkg = ketMacros(model);
    // Convert the minority to the majority; on a tie prefer the macros if they are available.
    const toMacro =
      macro.length > manual.length || (macro.length === manual.length && pkg !== null);
    const minority = toMacro ? manual : macro;
    const findings: Finding[] = [];
    for (const k of minority) {
      const original = model.text.slice(k.span.start, k.span.end);
      const fixable = !k.parts.some((p) => /\\(?:left|right)\b/.test(p));
      const replacement = !fixable
        ? null
        : toMacro
          ? pkg
            ? ketToMacro(k, pkg)
            : null
          : ketToManual(k);
      findings.push({
        message: toMacro
          ? `${original} is written by hand, but most kets in this document use \\${k.form}. Pick one style and use it throughout.`
          : `${original} uses a macro, but most kets in this document are written by hand. Pick one style and use it throughout.`,
        span: k.span,
        ...(replacement !== null
          ? {
              fixes: [
                {
                  title: `Rewrite as ${replacement}`,
                  edits: [mechanical(k.span.start, k.span.end, replacement)],
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
