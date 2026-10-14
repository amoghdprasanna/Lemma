import { filterExplanation, parseTopicAnswer } from '@/src/core/llm/filter';
import type { LlmAvailability, LlmPort, RoleSuggestion } from '@/src/ports/llm';

/** Deterministic LlmPort for tests: scripted availability and answers, same filter as the real one. */
export function fakeLlm(
  script: {
    availability?: LlmAvailability;
    explanation?: string;
    roles?: RoleSuggestion | null;
    /** Raw model output for topic questions, as JSON. */
    topic?: string;
  } = {},
): LlmPort & { calls: string[] } {
  let state: LlmAvailability = script.availability ?? 'downloadable';
  const calls: string[] = [];
  return {
    calls,
    availability: () => Promise.resolve(state),
    enable(onProgress) {
      calls.push('enable');
      onProgress(0.5);
      onProgress(1);
      state = 'available';
      return Promise.resolve();
    },
    suggestRoles(input) {
      calls.push(`roles:${input.heading}`);
      return Promise.resolve(script.roles ?? null);
    },
    explain(input) {
      calls.push(`explain:${input.title}`);
      const r = filterExplanation(script.explanation ?? `About ${input.title}.`);
      return Promise.resolve(r.ok ? r.text : null);
    },
    explainLogEntry(input) {
      calls.push(`log:${input.message}`);
      return Promise.resolve('The log says a command is unknown.');
    },
    askTopic(input) {
      calls.push(`topic:${input.question}`);
      return Promise.resolve(
        parseTopicAnswer(
          script.topic ?? '{"onTopic":true,"answer":"Use \\\\eqref for equations."}',
        ),
      );
    },
  };
}
