import type { ReactNode } from 'react';
import type { Severity } from '@/src/core/rules/types';
import { ROLE_INFO, type Role } from '@/src/core/structure/roles';

export const SEVERITY_LABEL: Record<Severity, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
  learn: 'Learn',
};

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
