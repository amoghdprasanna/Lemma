import { TRANSLATIONS, type Translation } from './translations';

export interface LogEntry {
  level: 'error' | 'warning' | 'typesetting';
  /** The log's own text for this entry (first line plus context). */
  raw: string;
  file: string | null;
  line: number | null;
  /** Plain-language title, explanation and likely cause; null if Lemma has no translation. */
  translation: { title: string; explanation: string; cause: string } | null;
}

const FILE_LINE_ERROR = /^(\.?\/?[^:\s]+\.(?:tex|sty|cls|bib|bbl)):(\d+):\s*(.*)$/;

function substitute(t: Translation, m: RegExpExecArray) {
  const fill = (s: string) => s.replace(/\$(\d)/g, (_, i: string) => m[Number(i)] ?? '');
  return { title: fill(t.title), explanation: fill(t.explanation), cause: fill(t.cause) };
}

function translate(text: string): LogEntry['translation'] {
  for (const t of TRANSLATIONS) {
    const m = t.match.exec(text);
    if (m) return substitute(t, m);
  }
  return null;
}

/**
 * Parses a raw LaTeX log into entries with plain-language explanations. Pure;
 * handles both the classic (`! ...` / `l.42`) and `-file-line-error` formats.
 */
export function parseLog(log: string): LogEntry[] {
  const lines = log.replace(/\r\n?/g, '\n').split('\n');
  const entries: LogEntry[] = [];
  let currentFile: string | null = null;
  const seen = new Set<string>();

  const push = (e: LogEntry) => {
    const key = `${e.level}|${e.file ?? ''}|${String(e.line ?? '')}|${e.raw.split('\n')[0] ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push(e);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const opened = /\((\.\/[^\s()]+\.tex)/.exec(line);
    if (opened?.[1] !== undefined) currentFile = opened[1].replace(/^\.\//, '');

    const fle = FILE_LINE_ERROR.exec(line);
    if (line.startsWith('! ') || fle) {
      const message = fle ? (fle[3] ?? '') : line.slice(2);
      const context: string[] = [message];
      let lineNo = fle ? Number(fle[2]) : null;
      for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
        const l = lines[j] ?? '';
        const lm = /^l\.(\d+)\s?(.*)$/.exec(l);
        if (lm) {
          lineNo ??= Number(lm[1]);
          context.push(l);
          break;
        }
        if (l.trim() !== '') context.push(l);
      }
      push({
        level: 'error',
        raw: context.join('\n'),
        file: fle ? (fle[1] ?? '').replace(/^\.\//, '') : currentFile,
        line: lineNo,
        translation: translate(context.join('\n')),
      });
      continue;
    }

    const warning = /^(?:LaTeX|Package [\w-]+|Class [\w-]+|LaTeX Font) Warning: (.*)$/.exec(line);
    if (warning) {
      // Warnings wrap onto continuation lines indented to align with the message.
      let text = line;
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j] ?? '';
        if (!/^\s*\(?[\w-]*\)?\s{2,}\S/.test(next) && !/^\S.*[^.]$/.test(lines[j - 1] ?? '.'))
          break;
        if (next.trim() === '' || /^(?:LaTeX|Package|Class|!|Overfull|Underfull)/.test(next)) break;
        text += ' ' + next.trim().replace(/^\([\w-]+\)\s*/, '');
        i = j;
      }
      const ln = /on input line (\d+)/.exec(text);
      push({
        level: 'warning',
        raw: text.replace(/\s+/g, ' '),
        file: currentFile,
        line: ln ? Number(ln[1]) : null,
        translation: translate(text),
      });
      continue;
    }

    const box =
      /^(Overfull|Underfull) \\[hv]box .*?(?:lines? (\d+)(?:--\d+)?|detected at line (\d+))?$/.exec(
        line,
      );
    if (box) {
      push({
        level: 'typesetting',
        raw: line,
        file: currentFile,
        line: box[2] !== undefined ? Number(box[2]) : box[3] !== undefined ? Number(box[3]) : null,
        translation: translate(line),
      });
    }
  }
  return entries;
}
