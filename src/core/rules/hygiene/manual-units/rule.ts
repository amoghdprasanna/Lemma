import { hasPackage } from '../../../model/build';
import { mechanical } from '../../../fixes/text-edit';
import { proseMask } from '../../../notation/prose-mask';
import type { Finding, Rule } from '../../types';

const PREFIX: Record<string, string> = {
  k: '\\kilo',
  M: '\\mega',
  G: '\\giga',
  T: '\\tera',
  m: '\\milli',
  u: '\\micro',
  μ: '\\micro',
  n: '\\nano',
  p: '\\pico',
};
const BASE: Record<string, string> = {
  Hz: '\\hertz',
  s: '\\second',
  K: '\\kelvin',
  m: '\\metre',
  eV: '\\electronvolt',
  T: '\\tesla',
  W: '\\watt',
  V: '\\volt',
};

/** Units Lemma recognises after a number; ambiguous ones (bare s, m, T, W, V) need a prefix. */
const UNIT =
  /(?<![\w.])(\d+(?:\.\d+)?)((?:[ \t]|~|\\,|\\ )+)(GHz|MHz|kHz|THz|Hz|ms|μs|us|ns|ps|mK|μK|uK|nK|K|nm|μm|um|mm|eV|meV|keV|MeV|GeV|dB|mT|μT|uT|mW|μW|uW|mV|μV|uV)(?![\w])/g;

export function siunitxUnit(unit: string): string | null {
  if (unit === 'dB') return '\\decibel';
  if (BASE[unit]) return BASE[unit] ?? null;
  const p = PREFIX[unit[0] ?? ''];
  const b = BASE[unit.slice(1)];
  return p && b ? p + b : null;
}

const rule: Rule = {
  id: 'hygiene/manual-units',
  category: 'hygiene',
  severity: 'info',
  title: 'Unit typed by hand',
  cardId: 'siunitx-units',
  check({ model }) {
    const siunitx = hasPackage(model, 'siunitx');
    const text = proseMask(model);
    const findings: Finding[] = [];
    UNIT.lastIndex = 0;
    let m: RegExpExecArray | null;
    // proseMask blanks macro names; read the original text for the actual separator.
    while ((m = UNIT.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const original = model.text.slice(start, end);
      const om = /^(\d+(?:\.\d+)?)(?:[ \t]|~|\\,|\\ )+(\S+)$/.exec(original);
      const value = om?.[1];
      const unit = om?.[2] ?? m[3] ?? '';
      const macro = siunitxUnit(unit);
      findings.push({
        message: siunitx
          ? `"${original}" is written by hand. \\qty{${value ?? ''}}{${macro ?? '…'}} (siunitx) gives correct spacing and upright units, and keeps units consistent.`
          : `"${original}" is written by hand. The siunitx package (\\qty, or \\SI in older versions) typesets numbers and units consistently.`,
        span: { start, end },
        ...(siunitx && value !== undefined && macro
          ? {
              fixes: [
                {
                  title: `Use \\qty{${value}}{${macro}}`,
                  edits: [mechanical(start, end, `\\qty{${value}}{${macro}}`)],
                },
              ],
            }
          : {}),
      });
    }
    return findings;
  },
};

export default rule;
