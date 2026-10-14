import { abstractSkeleton, referencesSkeleton, sectionSkeleton } from '../fixes/skeleton';
import type { Fix } from '../fixes/text-edit';
import { profilePosition } from '../structure/infer';
import { ROLE_INFO, type Role } from '../structure/roles';
import type { RuleContext } from './types';

export function usesRevtex(ctx: RuleContext): boolean {
  return ctx.model.documentClass?.name.startsWith('revtex') === true;
}

/** Start of the line containing `offset`. */
export function lineStartOf(text: string, offset: number): number {
  return text.lastIndexOf('\n', offset - 1) + 1;
}

/** Where a skeleton for `role` should go, following the profile's preferred order. */
export function insertionPoint(ctx: RuleContext, role: Role): number {
  const { model, profile, structure } = ctx;
  if (role === 'summary') {
    const maketitle = model.macros.find((m) => m.name === 'maketitle');
    return maketitle ? lineStartOf(model.text, maketitle.span.start) : model.bodySpan.start;
  }
  if (role === 'references' || role === 'supplementary') return model.bodySpan.end;
  const target = profilePosition(profile, [role]);
  const next = structure.find(
    (u) =>
      u.depth === 0 &&
      (u.kind === 'section' || u.kind === 'acknowledgments' || u.kind === 'bibliography') &&
      profilePosition(profile, u.roles) > target,
  );
  if (next) return lineStartOf(model.text, next.span.start);
  return model.bibliography
    ? lineStartOf(model.text, model.bibliography.span.start)
    : model.bodySpan.end;
}

/** A skeleton fix adding an empty part for `role`, or none if Lemma has no template for it. */
export function skeletonFix(ctx: RuleContext, role: Role): Fix[] {
  const at = insertionPoint(ctx, role);
  const edit =
    role === 'summary'
      ? abstractSkeleton(at)
      : role === 'references'
        ? referencesSkeleton(at)
        : sectionSkeleton(role, at, usesRevtex(ctx));
  return edit ? [{ title: `Add an empty ${ROLE_INFO[role].label} skeleton`, edits: [edit] }] : [];
}

export function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? '' : 's'}`;
}
