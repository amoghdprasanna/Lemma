import { mechanical } from '../../../fixes/text-edit';
import { findTraces } from '../../../notation/math';
import type { Finding, Rule } from '../../types';

const ITALIC = /^(?:Tr|tr)$/;

const rule: Rule = {
  id: 'notation/trace-style',
  category: 'notation',
  severity: 'warning',
  title: 'Inconsistent trace notation',
  cardId: 'trace-notation',
  check({ model }) {
    const traces = findTraces(model);
    if (traces.length === 0) return [];
    const counts = new Map<string, number>();
    for (const t of traces)
      if (!ITALIC.test(t.form)) counts.set(t.form, (counts.get(t.form) ?? 0) + 1);
    const majority = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const findings: Finding[] = [];
    for (const t of traces) {
      const original = model.text.slice(t.span.start, t.span.end);
      if (ITALIC.test(t.form)) {
        const target = majority ?? `\\mathrm{${t.form}}`;
        findings.push({
          message: `"${original}" in math mode is set in italics, as if it were a product of variables T and r. Operator names should be upright.`,
          span: t.span,
          fixes: [
            { title: `Use ${target}`, edits: [mechanical(t.span.start, t.span.end, target)] },
          ],
        });
      } else if (majority !== null && t.form !== majority) {
        findings.push({
          message: `The trace is written as ${original} here but as ${majority} elsewhere. Use one form throughout.`,
          span: t.span,
          severity: 'info',
          fixes: [
            { title: `Use ${majority}`, edits: [mechanical(t.span.start, t.span.end, majority)] },
          ],
        });
      }
    }
    return findings;
  },
};

export default rule;
