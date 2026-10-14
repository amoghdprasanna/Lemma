import { checkFix } from '../fixes/guard';
import { hash } from '../model/text';
import type { Diagnostic, Rule, RuleContext } from './types';
import { SEVERITY_ORDER } from './types';

export interface EngineResult {
  diagnostics: Diagnostic[];
  /** Fixes dropped by the guard. Always a bug in a rule; surfaced in tests and dev builds. */
  rejectedFixes: { ruleId: string; title: string; reason: string }[];
  /** Rules that threw. One broken rule must not take down the others. */
  ruleErrors: { ruleId: string; message: string }[];
}

/** Runs rules over a context. Pure: same input, same output. */
export function runRules(
  ctx: RuleContext,
  rules: readonly Rule[],
  dismissed: ReadonlySet<string> = new Set(),
): EngineResult {
  const result: EngineResult = { diagnostics: [], rejectedFixes: [], ruleErrors: [] };
  const disabled = new Set(ctx.settings.disabledRules);
  for (const rule of rules) {
    if (disabled.has(rule.id)) continue;
    if (rule.category === 'structure' && ctx.settings.mode === 'freeform') continue;
    let findings;
    try {
      findings = rule.check(ctx);
    } catch (e) {
      result.ruleErrors.push({
        ruleId: rule.id,
        message: e instanceof Error ? e.message : String(e),
      });
      continue;
    }
    const seen = new Map<string, number>();
    for (const f of findings) {
      const fixes = (f.fixes ?? []).filter((fix) => {
        const g = checkFix(fix, ctx.model.text);
        if (!g.ok)
          result.rejectedFixes.push({ ruleId: rule.id, title: fix.title, reason: g.reason });
        return g.ok;
      });
      const base = `${rule.id}|${f.key ?? ctx.model.text.slice(f.span.start, f.span.end)}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const id = `${rule.id}:${hash(`${base}|${String(n)}`)}`;
      if (dismissed.has(id)) continue;
      result.diagnostics.push({
        id,
        ruleId: rule.id,
        category: rule.category,
        severity: f.severity ?? rule.severity,
        title: rule.title,
        message: f.message,
        span: f.span,
        line: ctx.lines.locate(f.span.start).line,
        cardId: rule.cardId,
        fixes,
      });
    }
  }
  result.diagnostics.sort(
    (a, b) =>
      a.span.start - b.span.start || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  return result;
}
