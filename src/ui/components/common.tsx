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

/** Why there is no on-device answer, in one sentence; null when the model wasn't asked. */
export function aiFailureText(failure: LlmFailure | null): string {
  switch (failure) {
    case 'not-ready':
      return 'The on-device model isn’t running. Turn it on in Settings.';
    case 'overflow':
      return 'That was more text than the on-device model can read at once.';
    case 'error':
      return 'The on-device model hit an error. Try again.';
    case 'malformed':
      return 'The on-device model’s answer came back garbled.';
    case 'drafted':
      return 'The on-device answer read like text for your paper, so I hid it.';
    case 'rambling':
      return 'The on-device answer ran too long, so I hid it.';
    case null:
      return 'No on-device answer this time.';
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
