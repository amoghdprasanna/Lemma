import type { Finding, Rule } from '../../types';

const rule: Rule = {
  id: 'structure/abstract-length',
  category: 'structure',
  severity: 'warning',
  title: 'Abstract length and shape',
  cardId: 'abstract',
  check({ model, profile, settings, structure }) {
    const abs = model.abstract;
    const unit = structure.find((u) => u.kind === 'abstract');
    if (!abs || !unit) return [];
    const findings: Finding[] = [];
    // Outside Template mode these are learning notes, not warnings.
    const soft = settings.mode !== 'template';
    const range = profile.abstract;
    if (range && unit.words > range.maxWords) {
      findings.push({
        message:
          `The abstract has ${String(unit.words)} words; the ${profile.name} profile targets ${String(range.minWords)}–${String(range.maxWords)}. ${range.note}`.trim(),
        span: { start: abs.span.start, end: abs.contentSpan.start },
        severity: soft ? 'learn' : 'warning',
        key: 'long',
      });
    } else if (range && unit.words > 0 && unit.words < range.minWords) {
      findings.push({
        message: `The abstract has ${String(unit.words)} words; the ${profile.name} profile targets ${String(range.minWords)}–${String(range.maxWords)}. Short is fine if it still states the problem, approach and main result.`,
        span: { start: abs.span.start, end: abs.contentSpan.start },
        severity: soft ? 'learn' : 'info',
        key: 'short',
      });
    }
    const body = model.masked.slice(abs.contentSpan.start, abs.contentSpan.end).trim();
    if (/\n[ \t]*\n/.test(body) || /\\par\b/.test(body)) {
      findings.push({
        message:
          'The abstract has more than one paragraph. Most journals expect a single paragraph.',
        span: { start: abs.span.start, end: abs.contentSpan.start },
        severity: soft ? 'learn' : 'info',
        key: 'paragraphs',
      });
    }
    return findings;
  },
};

export default rule;
