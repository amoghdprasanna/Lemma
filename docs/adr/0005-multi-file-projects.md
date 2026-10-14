# ADR-0005: Multi-file projects

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

Overleaf shows one file at a time, but papers are often split with `\input`/`\include` and keep references in a separate `.bib` file. Checks such as "reference to a missing label" or "citation not in the bibliography" are only trustworthy when Lemma has seen every file. Lemma must not make network requests (ADR-0004), so it cannot fetch other files from Overleaf's servers.

## Options

1. **Cache files as the user opens them.** Every snapshot carries the file name (`editor.open_doc_name` from Overleaf's unstable store), so Lemma can remember each file's latest text. No network; coverage grows as the user works.
2. **Read the file tree from the DOM.** Gives file names, not contents. Useful for telling the user what is missing, but brittle and not needed when `\input` arguments already name the files.
3. **User-provided zip.** Overleaf's "Download as source" zip, imported into the panel and unzipped locally with the browser's `DecompressionStream`. Complete in one step; requires a manual action and goes stale as the user edits.
4. **Overleaf Git bridge or API.** Complete and current, but needs credentials and network requests. Rejected (ADR-0004).

## Decision

Options 1 and 3 together:

- Files opened in Overleaf are cached in `chrome.storage.session`, keyed by project ID. They survive closing the panel but are cleared when the browser closes, so unpublished text does not persist on disk longer than the session.
- A project zip can be imported from Settings. Only `.tex` and `.bib` files are read, with size limits. The live text of the open file always wins over a zip copy.
- The main file (the one with `\documentclass`, preferring `main.tex`) is **flattened**: `\input`/`\include`/`\subfile` are replaced by file contents (resolved relative to the root, then the including file, then by unique file name), recording a source map of segments.
- The flattened document is analysed as one paper. Diagnostics are mapped back to their files. The open file's diagnostics appear normally; others are listed per file under "In other files".
- Fixes are offered only when every edit maps into the open file. Lemma never edits a file the user is not looking at.
- Unresolved inputs keep the **partial view** indicator on and are listed by name. Checks that depend on completeness (unused labels, appendix consistency) stay quiet while the view is partial; undefined references are downgraded from errors to warnings.
- A `.bib` file is analysed on its own when open, and contributes its entries to citation checks for the project.

## Consequences

- Analysis improves as the user opens files; the indicator says exactly what is missing.
- Settings in the `% lemma:` comment are read from the main file. When another file is open, editing them asks the user to open the main file.
- File names from Overleaf have no directory; when a zip supplied paths, names are matched to cached paths by suffix.
- No new permissions: `storage` was already needed for settings.
