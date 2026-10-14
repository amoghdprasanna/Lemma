import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '@/src/core/analysis';
import { buildModel } from '@/src/core/model/build';
import { diffEdits, formatDiff } from '@/src/core/fixes/diff';
import type { Rule } from '@/src/core/rules/types';

/** Fixed clock for rules that look at dates. */
export const TEST_NOW = Date.UTC(2026, 9, 13);

/**
 * Standard test for a rule directory:
 * - every `pass*.tex|bib` produces no diagnostics from the rule;
 * - every `fail*.tex|bib` produces at least one, and its messages and fix
 *   diffs are snapshot-tested;
 * - no fix is rejected by the content guard and the rule never throws.
 * A `context.bib` in the directory is supplied as the project's bibliography.
 */
export function describeRule(rule: Rule, dir: string): void {
  const files = readdirSync(dir).filter((f) => /^(?:pass|fail).*\.(?:tex|bib)$/.test(f));
  const contextBib = readdirSync(dir).includes('context.bib')
    ? buildModel(readFileSync(path.join(dir, 'context.bib'), 'utf8'), 'context.bib').bibEntries
    : null;

  const run = (file: string) => {
    const text = readFileSync(path.join(dir, file), 'utf8');
    const result = analyze({
      text,
      fileName: file.replace(/^(?:pass|fail)[^.]*/, 'main'),
      now: TEST_NOW,
      rules: [rule],
      project: contextBib ? { bibEntries: contextBib } : {},
    });
    return { text, result };
  };

  describe(rule.id, () => {
    it('has passing and failing fixtures', () => {
      expect(files.some((f) => f.startsWith('pass'))).toBe(true);
      expect(files.some((f) => f.startsWith('fail'))).toBe(true);
    });

    for (const file of files) {
      it(file, () => {
        const { text, result } = run(file);
        expect(result.ruleErrors).toEqual([]);
        expect(result.rejectedFixes).toEqual([]);
        const mine = result.diagnostics.filter((d) => d.ruleId === rule.id);
        if (file.startsWith('pass')) {
          expect(mine.map((d) => `${String(d.line)}: ${d.message}`)).toEqual([]);
        } else {
          expect(mine.length).toBeGreaterThan(0);
          expect(
            mine.map((d) => ({
              line: d.line,
              severity: d.severity,
              message: d.message,
              fixes: d.fixes.map((f) => `${f.title}\n${formatDiff(diffEdits(text, f.edits))}`),
            })),
          ).toMatchSnapshot();
        }
      });
    }
  });
}
