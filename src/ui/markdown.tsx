import type { ReactNode } from 'react';

/**
 * Small Markdown renderer for Lemma's own learning cards (headings, lists,
 * tables, quotes, code, emphasis, links, $math$). Builds React elements, so
 * nothing is ever injected as HTML.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\$[^$]+\$)|(\*\*[^*]+\*\*)|(\*[^*]+\*|_[^_]+_)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${String(i++)}`;
    if (m[1] !== undefined) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else if (m[2] !== undefined)
      out.push(
        <code key={key} className="math">
          {tok.slice(1, -1)}
        </code>,
      );
    else if (m[3] !== undefined)
      out.push(<strong key={key}>{inline(tok.slice(2, -2), key)}</strong>);
    else if (m[4] !== undefined) out.push(<em key={key}>{inline(tok.slice(1, -1), key)}</em>);
    else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      const href = lm?.[2] ?? '';
      out.push(
        /^https:\/\//.test(href) ? (
          <a key={key} href={href} target="_blank" rel="noreferrer noopener">
            {lm?.[1]}
          </a>
        ) : (
          lm?.[1]
        ),
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** One line of inline Markdown (code, emphasis, links), without block structure. */
export function InlineMarkdown({ text }: { text: string }) {
  return <>{inline(text, 'i')}</>;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  const key = () => `b${String(k++)}`;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) body.push(lines[i++] ?? '');
      i++;
      blocks.push(
        <pre key={key()}>
          <code>{body.join('\n')}</code>
        </pre>,
      );
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(6, (h[1]?.length ?? 1) + 2);
      const Tag = `h${String(level)}` as 'h3';
      blocks.push(<Tag key={key()}>{inline(h[2] ?? '', 'h')}</Tag>);
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? '').startsWith('|')) {
        const cells = (lines[i] ?? '')
          .replace(/\\\|/g, '\uE000')
          .split('|')
          .slice(1, -1)
          .map((c) => c.replace(/\uE000/g, '|').trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div className="table-wrap" key={key()}>
          <table>
            <thead>
              <tr>
                {head?.map((c, j) => (
                  <th key={j}>{inline(c, `th${String(j)}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, j) => (
                    <td key={j}>{inline(c, `td${String(ri)}-${String(j)}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (line.startsWith('>')) {
      const body: string[] = [];
      while (i < lines.length && (lines[i] ?? '').startsWith('>'))
        body.push((lines[i++] ?? '').replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key()}>{inline(body.join(' '), 'q')}</blockquote>);
      continue;
    }
    const listItem = /^(\s*)(?:[-*]|\d+\.)\s+(.*)$/;
    if (listItem.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && listItem.test(lines[i] ?? '')) {
        items.push(listItem.exec(lines[i++] ?? '')?.[2] ?? '');
        // continuation lines
        while (
          i < lines.length &&
          /^\s{2,}\S/.test(lines[i] ?? '') &&
          !listItem.test(lines[i] ?? '')
        ) {
          items[items.length - 1] = `${items[items.length - 1] ?? ''} ${(lines[i++] ?? '').trim()}`;
        }
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={key()}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `li${String(j)}`)}</li>
          ))}
        </List>,
      );
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() !== '' &&
      !/^(?:```|#|\||>|\s*(?:[-*]|\d+\.)\s)/.test(lines[i] ?? '')
    ) {
      para.push(lines[i++] ?? '');
    }
    blocks.push(<p key={key()}>{inline(para.join(' '), 'p')}</p>);
  }
  return <div className="markdown">{blocks}</div>;
}
