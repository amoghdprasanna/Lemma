import { rolesPresent } from '../../../structure/infer';
import { ROLE_INFO, type Role } from '../../../structure/roles';
import { skeletonFix } from '../../helpers';
import type { Finding, Rule } from '../../types';

/**
 * Template mode: every role the profile marks required needs a part of the paper.
 * Adaptive mode: only what any paper needs — results and references — and only
 * when Lemma can tell (sections with no known role suppress the results check).
 */
const rule: Rule = {
  id: 'structure/required-role-missing',
  category: 'structure',
  severity: 'warning',
  title: 'Missing part of the paper',
  cardId: 'paper-roles',
  check(ctx) {
    const { model, settings, profile, structure, project } = ctx;
    if (model.kind !== 'tex' || !model.isMain) return [];
    const present = rolesPresent(structure);
    const at = { start: model.bodySpan.start, end: model.bodySpan.start };
    const findings: Finding[] = [];
    const topSections = structure.filter(
      (u) => u.kind === 'section' && u.depth === 0 && !u.inAppendix,
    );
    const unassigned = topSections.filter((u) => u.roles.length === 0);

    const missing = (roles: readonly Role[]) => !roles.some((r) => present.has(r));

    if (settings.mode === 'template') {
      for (const s of profile.sections) {
        if (!s.required || !missing(s.roles)) continue;
        const role = s.roles[0];
        if (role === undefined) continue;
        const hint =
          unassigned.length > 0 &&
          role !== 'summary' &&
          role !== 'references' &&
          role !== 'front-matter'
            ? ' If one of your sections already does this job, assign it the role in the Outline.'
            : '';
        findings.push({
          message: `The ${profile.name} profile expects "${s.title}" (${ROLE_INFO[role].label}), and no part of the paper fills it yet.${hint}`,
          span: at,
          severity: role === 'references' && project.partial ? 'info' : 'warning',
          fixes: skeletonFix(ctx, role),
          key: s.id,
        });
      }
      return findings;
    }

    // Adaptive: universal needs only.
    if (
      topSections.length >= 2 &&
      unassigned.length === 0 &&
      missing(['results', 'interpretation']) &&
      !structure.some((u) => u.kind === 'body')
    ) {
      findings.push({
        message:
          'No section presents results yet. Every paper needs a part that says what you found, whatever you call it.',
        span: at,
        fixes: skeletonFix(ctx, 'results'),
        key: 'results',
      });
    }
    if (missing(['references'])) {
      findings.push({
        message:
          model.cites.length > 0
            ? 'The paper cites sources but has no bibliography (\\bibliography, \\printbibliography or thebibliography).'
            : 'The paper has no references yet.',
        span: at,
        severity: project.partial ? 'info' : 'warning',
        fixes: skeletonFix(ctx, 'references'),
        key: 'references',
      });
    }
    return findings;
  },
};

export default rule;
