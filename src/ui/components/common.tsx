import type { ReactNode } from 'react';
import type { Severity } from '@/src/core/rules/types';
import { ROLE_INFO, type Role } from '@/src/core/structure/roles';
import type { LlmFailure } from '@/src/ports/llm';

export const SEVERITY_LABEL: Record<Severity, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
  learn: 'Learn',
};

/** Why there is no AI answer, in one sentence. */
export function aiFailureText(failure: LlmFailure | null): string {
  switch (failure) {
    case 'not-ready':
      return 'The AI model isn’t running. Check Settings.';
    case 'overflow':
      return 'That was more text than the AI model can read at once.';
    case 'error':
      return 'The AI model hit an error. Try again.';
    case 'blocked':
      return 'Your settings keep paper text away from the remote model. You can allow it in Settings.';
    case 'malformed':
      return 'The AI model’s answer came back garbled.';
    case 'drafted':
      return 'The AI answer read like text for your paper, so I hid it.';
    case 'rambling':
      return 'The AI answer ran too long, so I hid it.';
    case null:
      return 'No AI answer this time.';
  }
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`badge badge-${severity}`}>{SEVERITY_LABEL[severity]}</span>;
}

export function RoleChip({ role }: { role: Role }) {
  return (
    <span className={`chip chip-${role}`} title={ROLE_INFO[role].purpose}>
      {ROLE_INFO[role].label}
    </span>
  );
}

export function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="block">
      <div className="block-head">
        <h3>{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
