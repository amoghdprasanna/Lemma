/**
 * Plain-language explanations for common LaTeX log messages. `$1`… refer to
 * capture groups. Sources: Overleaf's "Errors" help pages and the LaTeX2e
 * documentation (see the compile-errors learning card).
 */
export interface Translation {
  match: RegExp;
  title: string;
  explanation: string;
  cause: string;
}

export const TRANSLATIONS: readonly Translation[] = [
  {
    match: /Undefined control sequence[\s\S]*?l\.\d+.*?(\\[a-zA-Z@]+)\s*$/m,
    title: 'Unknown command $1',
    explanation: 'LaTeX does not know the command $1.',
    cause: 'A typo in the command name, or a missing \\usepackage for the package that defines it.',
  },
  {
    match: /Undefined control sequence/,
    title: 'Unknown command',
    explanation: 'LaTeX met a command it does not know.',
    cause: 'A typo in a command name, or a missing \\usepackage.',
  },
  {
    match: /Missing \$ inserted/,
    title: 'Math used outside math mode',
    explanation:
      'Something that only works in math mode (like ^, _ or a Greek letter) appears in normal text, or a $ is missing.',
    cause: 'A forgotten $ around a formula, or an underscore in normal text (write \\_ instead).',
  },
  {
    match: /Display math should end with \$\$/,
    title: 'Unbalanced $$',
    explanation: 'A $$…$$ display was not closed properly.',
    cause: 'A missing $; better, switch to \\[…\\], which LaTeX can check.',
  },
  {
    match: /Missing \} inserted|Missing \{ inserted/,
    title: 'Unbalanced braces',
    explanation: 'LaTeX expected a brace that is not there.',
    cause: 'A { without its matching } (or the other way round) shortly before this line.',
  },
  {
    match: /Extra \}, or forgotten \$|Too many \}'s/,
    title: 'Extra closing brace',
    explanation: 'There is a } with no matching {.',
    cause: 'A stray }, or a $ that closes math mode too early.',
  },
  {
    match: /Runaway argument|Paragraph ended before (\\[a-zA-Z@]+) was complete/,
    title: 'Argument not closed',
    explanation: 'A command’s argument runs into a blank line, so its closing } is missing.',
    cause: 'A missing } in the command just before this point.',
  },
  {
    match: /Misplaced alignment tab character &/,
    title: '& outside a table or alignment',
    explanation:
      'The & character separates columns and only works inside tabular, align and similar environments.',
    cause: 'Write \\& for a literal ampersand, or check the environment around this line.',
  },
  {
    match: /Double (superscript|subscript)/,
    title: 'Double $1',
    explanation: 'Two $1s in a row (like x^a^b) are ambiguous.',
    cause: 'Group them with braces: x^{ab} or {x^a}^b.',
  },
  {
    match: /File [`'"]?([^'"`\s]+)['"`]? not found/,
    title: 'File $1 not found',
    explanation: 'LaTeX could not find $1.',
    cause:
      'The file name is misspelt, the file was not uploaded to the project, or the package is not installed.',
  },
  {
    match: /Environment ([\w*]+) undefined/,
    title: 'Unknown environment $1',
    explanation: 'There is no environment called $1.',
    cause: 'A typo, or a missing \\usepackage (for example amsmath for align).',
  },
  {
    match: /\\begin\{([\w*]+)\} on input line (\d+) ended by \\end\{([\w*]+)\}/,
    title: '\\begin{$1} closed by \\end{$3}',
    explanation: 'The environment opened on line $2 is closed with the wrong \\end.',
    cause: 'A missing \\end{$1}, or environments that overlap instead of nesting.',
  },
  {
    match: /Missing \\begin\{document\}/,
    title: 'Text before \\begin{document}',
    explanation:
      'Something in the preamble produces output, which is only allowed after \\begin{document}.',
    cause: 'Stray text or a typesetting command in the preamble.',
  },
  {
    match: /Can be used only in preamble/,
    title: 'Preamble-only command in the document',
    explanation: 'A command such as \\usepackage appears after \\begin{document}.',
    cause: 'Move it above \\begin{document}.',
  },
  {
    match: /Option clash for package ([\w-]+)/,
    title: 'Package $1 loaded twice with different options',
    explanation:
      '$1 is loaded more than once (possibly by another package) with conflicting options.',
    cause:
      'Load $1 once, with all options together, or pass options with \\PassOptionsToPackage before the class loads it.',
  },
  {
    match: /Command (\\[a-zA-Z@]+) already defined/,
    title: '$1 already exists',
    explanation: '\\newcommand cannot redefine $1, which is already defined.',
    cause: 'Choose another name, or use \\renewcommand if you really mean to change it.',
  },
  {
    match: /Something's wrong--perhaps a missing \\item/,
    title: 'List without \\item',
    explanation: 'A list environment contains text before its first \\item.',
    cause:
      'Start each entry of itemize/enumerate with \\item; check also empty thebibliography environments.',
  },
  {
    match: /Unicode character (\S+) \(U\+([0-9A-F]+)\)/,
    title: 'Unsupported character $1',
    explanation: 'The character $1 (U+$2) cannot be typeset with the current setup.',
    cause:
      'Replace it with a LaTeX command (often a pasted symbol or invisible character), or compile with XeLaTeX/LuaLaTeX.',
  },
  {
    match: /Illegal unit of measure/,
    title: 'Length without a unit',
    explanation: 'A length was given without a unit such as pt, cm or \\columnwidth.',
    cause: 'Add a unit, e.g. width=0.5\\columnwidth.',
  },
  {
    match: /Float\(s\) lost/,
    title: 'Figure or table lost',
    explanation:
      'A float could not be placed, usually because it is inside a box or another float.',
    cause: 'A figure inside a minipage, footnote or \\parbox; move it out.',
  },
  {
    match: /Emergency stop/,
    title: 'Compilation stopped',
    explanation: 'LaTeX gave up after an earlier error.',
    cause: 'Fix the first error in the log; the rest often disappear with it.',
  },
  {
    match: /Reference [`']([^']+)' on page \d+ undefined/,
    title: 'Undefined reference $1',
    explanation: 'The label $1 does not exist (yet), so the reference prints as ??.',
    cause:
      'A typo in \\ref or \\label, or the label is in a file that is not included. If you just added it, recompile.',
  },
  {
    match: /Citation [`']([^']+)' on page \d+ undefined/,
    title: 'Undefined citation $1',
    explanation: 'No bibliography entry has the key $1, so it prints as [?].',
    cause:
      'A typo in the key, or the entry is missing from the .bib file. If you just added it, recompile.',
  },
  {
    match: /Label [`']([^']+)' multiply defined/,
    title: 'Label $1 defined twice',
    explanation: 'Two \\label commands use $1, so references to it are ambiguous.',
    cause: 'Rename one of the labels.',
  },
  {
    match: /There were undefined references/,
    title: 'Some references are undefined',
    explanation: 'At least one \\ref or \\cite points to something that does not exist.',
    cause: 'See the individual warnings above for which ones.',
  },
  {
    match: /Label\(s\) may have changed/,
    title: 'Recompile needed',
    explanation: 'Cross-references changed during this run.',
    cause: 'Compile again; Overleaf usually does this automatically.',
  },
  {
    match: /Font shape [`']([^']+)' undefined/,
    title: 'Font shape not available',
    explanation: 'The font has no shape $1, so LaTeX substituted another.',
    cause:
      'Usually harmless; caused by combining a font with a style it lacks (e.g. bold small caps).',
  },
  {
    match: /Float too large for page/,
    title: 'Figure too large',
    explanation: 'A figure or table is taller than the page.',
    cause: 'Reduce its height, e.g. with height=0.8\\textheight or a smaller width.',
  },
  {
    match: /Overfull \\hbox \(([\d.]+)pt too wide\)/,
    title: 'Line $1 pt too wide',
    explanation: 'A line sticks out into the margin by $1 pt.',
    cause:
      'A long word, URL or formula LaTeX cannot break. Rephrase, allow a break, or ignore it if it is tiny.',
  },
  {
    match: /Underfull \\hbox/,
    title: 'Loose line',
    explanation: 'A line has too much space between words.',
    cause: 'Often a manual line break (\\\\) or a short line in a narrow column. Usually harmless.',
  },
];
