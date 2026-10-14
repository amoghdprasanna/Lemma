import { z } from 'zod';
import { ROLES } from '../structure/roles';

/**
 * A structure profile is data, not code: a list of expected sections in their
 * preferred order. Built-in profiles live in ./builtin/*.json; users fork and
 * edit them into custom profiles.
 */
export const ProfileSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  roles: z.array(z.enum(ROLES)).min(1),
  required: z.boolean(),
  /** Extra heading aliases (normalised form), on top of the shared table. */
  aliases: z.array(z.string()).default([]),
  /** Short guidance for the learning layer. */
  purpose: z.string().default(''),
  maxWords: z.number().int().positive().optional(),
});

export const ProfileSchema = z.object({
  id: z.string().regex(/^(?:builtin|custom)\/[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().default(''),
  sections: z.array(ProfileSectionSchema).min(1),
  abstract: z
    .object({
      minWords: z.number().int().nonnegative(),
      maxWords: z.number().int().positive(),
      /** Where the word range comes from, shown to the user. */
      note: z.string().default(''),
    })
    .nullable()
    .default(null),
  /** Overall length guidance (words), informational only. */
  lengthNote: z.string().default(''),
  /** Profile allows a body without section headings (e.g. Letters). */
  allowsHeadingless: z.boolean().default(false),
});

export type ProfileSection = z.infer<typeof ProfileSectionSchema>;
export type Profile = z.infer<typeof ProfileSchema>;

export function parseProfile(raw: unknown): Profile | null {
  const r = ProfileSchema.safeParse(raw);
  return r.success ? r.data : null;
}
