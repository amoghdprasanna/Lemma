/**
 * Every Overleaf-specific name Lemma depends on, in one place, with where it
 * was verified (overleaf/overleaf at e039ad2, 2026-09-17). When Overleaf
 * changes, this file and project-url.ts are what need updating.
 */
export const OVERLEAF = {
  /** services/web/frontend/js/features/source-editor/extensions/third-party-extensions.ts */
  extensionsEvent: 'UNSTABLE_editor:extensions',
  /** Same file: re-dispatches the extensions event and reconfigures the compartment. */
  reloadExtensionsEvent: 'editor:extension-loaded',
  /** window.overleaf.unstable.store paths (shared/context/ide-context.tsx, useExposedState). */
  store: {
    view: 'editor.view',
    docName: 'editor.open_doc_name',
    docId: 'editor.open_doc_id',
  },
  /** features/pdf-preview/components/pdf-log-entry-raw-content.tsx */
  rawLogSelector: 'pre.log-entry-content-raw',
  /** Not Overleaf: generic pages opt in with this attribute (tests, other editors). */
  textareaFallback: 'textarea[data-lemma-editor]',
} as const;
