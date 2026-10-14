import type { Rule } from './types';

/**
 * Every rule lives in `rules/<category>/<rule-name>/rule.ts` and default-exports
 * a Rule. Adding a rule is one directory; nothing else needs registering.
 */
const modules = import.meta.glob<{ default: Rule }>('./*/*/rule.ts', { eager: true });

export const RULES: readonly Rule[] = Object.entries(modules)
  .map(([path, mod]) => {
    const rule = mod.default;
    const expected = path.replace(/^\.\//, '').replace(/\/rule\.ts$/, '');
    if (rule.id !== expected)
      throw new Error(`Rule id "${rule.id}" must match its path "${expected}"`);
    return rule;
  })
  .sort((a, b) => a.id.localeCompare(b.id));

export function findRule(id: string): Rule | undefined {
  return RULES.find((r) => r.id === id);
}
