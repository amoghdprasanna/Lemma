/**
 * Everything Lemma knows about Overleaf URLs lives here, so a change on
 * Overleaf's side is a one-file fix (docs/adr/0002-overleaf-editor-access.md).
 */

/** Match patterns for Overleaf project pages (content scripts). */
export const OVERLEAF_PROJECT_MATCHES = ['https://*.overleaf.com/project/*'];

// Overleaf project IDs are 24-character hex MongoDB ObjectIds.
const PROJECT_PATH = /^\/project\/([0-9a-f]{24})(?:\/|$)/;

/** Returns the Overleaf project ID for a project page URL, or null for any other URL. */
export function projectIdFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const isOverleafHost =
    parsed.hostname === 'overleaf.com' || parsed.hostname.endsWith('.overleaf.com');
  if (parsed.protocol !== 'https:' || !isOverleafHost) return null;
  return PROJECT_PATH.exec(parsed.pathname)?.[1] ?? null;
}
