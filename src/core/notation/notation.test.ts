import { describe, expect, it } from 'vitest';
import { buildModel } from '../model/build';
import { findAcronyms, matchesExpansion } from './acronyms';
import {
  findAdjoints,
  findKets,
  findTraces,
  ketMacros,
  ketToMacro,
  ketToManual,
  symbolIntroductions,
  symbolsIn,
} from './math';

const doc = (body: string, pre = '') =>
  buildModel(
    `\\documentclass{article}\n${pre}\\begin{document}\n${body}\n\\end{document}\n`,
    'main.tex',
  );

describe('kets', () => {
  it('finds manual and macro kets, bras and inner products without double counting', () => {
    const m = doc(
      String.raw`$|0\rangle$, $\langle 1|$, $\langle a|b\rangle$, $\ket{\psi}$, $\braket{a}{b}$, $\|x\|$`,
    );
    expect(findKets(m).map((k) => [k.style, k.form, k.parts])).toEqual([
      ['manual', 'ket', ['0']],
      ['manual', 'bra', ['1']],
      ['manual', 'braket', ['a', 'b']],
      ['macro', 'ket', ['\\psi']],
      ['macro', 'braket', ['a', 'b']],
    ]);
  });

  it('converts between styles for each package', () => {
    const ket = {
      span: { start: 0, end: 0 },
      style: 'manual' as const,
      form: 'ket' as const,
      parts: ['\\psi'],
    };
    const bra = { ...ket, form: 'bra' as const };
    const braket = { ...ket, form: 'braket' as const, parts: ['a', 'b'] };
    expect(ketToMacro(ket, 'physics')).toBe('\\ket{\\psi}');
    expect(ketToMacro(bra, 'braket')).toBe('\\bra{\\psi}');
    expect(ketToMacro(braket, 'physics')).toBe('\\braket{a}{b}');
    expect(ketToMacro(braket, 'braket')).toBe('\\braket{a|b}');
    expect(ketToMacro(braket, 'custom')).toBeNull();
    expect(ketToManual(ket)).toBe('|\\psi\\rangle');
    expect(ketToManual(bra)).toBe('\\langle \\psi|');
    expect(ketToManual({ ...braket, parts: ['a|b'] })).toBe('\\langle a|b\\rangle');
  });

  it('detects which bra-ket macros are available', () => {
    expect(ketMacros(doc('', '\\usepackage{physics}\n'))).toBe('physics');
    expect(ketMacros(doc('', '\\usepackage{braket}\n'))).toBe('braket');
    expect(
      ketMacros(
        doc('', '\\newcommand{\\ket}[1]{|#1\\rangle}\n\\newcommand{\\bra}[1]{\\langle#1|}\n'),
      ),
    ).toBe('custom');
    expect(ketMacros(doc(''))).toBeNull();
  });
});

describe('trace and adjoint', () => {
  it('normalises trace forms', () => {
    const m = doc(
      String.raw`$\mathrm{Tr}\rho$ $\operatorname{tr} A$ ` +
        '${\\rm Tr} B$' +
        String.raw` $\Tr C$ $Tr D$ $\mathrm{str}$`,
    );
    expect(findTraces(m).map((t) => t.form)).toEqual([
      '\\mathrm{Tr}',
      '\\operatorname{tr}',
      '{\\rm Tr}',
      '\\Tr',
      'Tr',
    ]);
  });

  it('finds daggers and stars with their base symbol', () => {
    const m = doc(String.raw`$U^\dagger$, $U^{*}$, $\rho^\ast$, $z^*$`);
    expect(findAdjoints(m).map((a) => [a.base, a.mark])).toEqual([
      ['U', 'dagger'],
      ['U', 'star'],
      ['\\rho', 'star'],
      ['z', 'star'],
    ]);
  });
});

describe('symbols', () => {
  it('reads base symbols, ignoring indices and text', () => {
    expect(
      [...symbolsIn(String.raw`H_{\text{eff}} = \sum_i J \sigma^z_i + \mathrm{const}`)].sort(),
    ).toEqual(['H', 'J', '\\sigma']);
  });

  it('collects introductions with the author’s own context', () => {
    const m = doc(String.raw`where $H$ is the Hamiltonian and let $\rho$ be a state.`);
    expect(symbolIntroductions(m).map((s) => s.symbol)).toEqual(['H', '\\rho']);
  });
});

describe('acronyms', () => {
  it('matches expansions by initials, including multi-letter words and hyphens', () => {
    expect(matchesExpansion('QEC', ['quantum', 'error', 'correction'])).toBe(3);
    expect(matchesExpansion('NISQ', ['noisy', 'intermediate-scale', 'quantum'])).toBe(3);
    expect(matchesExpansion('CNOT', ['controlled-NOT'])).toBe(1);
    expect(
      matchesExpansion('LOCC', ['local', 'operations', 'and', 'classical', 'communication']),
    ).toBe(5);
    expect(matchesExpansion('QEC', ['see', 'ref'])).toBe(0);
  });

  it('finds uses and both definition styles, skipping keys and math', () => {
    const m = doc(
      String.raw`Quantum error correction (QEC) and MBQC (measurement-based quantum computation). See \ref{QEC:x} and $QEC$. QEC again.`,
    );
    const byName = Object.fromEntries(findAcronyms(m).map((a) => [a.acronym, a]));
    expect(byName.QEC?.uses).toHaveLength(2);
    expect(byName.QEC?.definitions[0]?.expansion).toBe('Quantum error correction');
    expect(byName.MBQC?.definitions[0]?.expansion).toBe('measurement-based quantum computation');
  });
});
