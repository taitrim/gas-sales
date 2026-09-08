import type { ReactNode } from 'react';

interface FieldLabelProps {
  tone?: string;
  children: ReactNode;
  req?: boolean;
}

export default function FieldLabel({
  tone = 'muted',
  children,
  req
}: FieldLabelProps) {
  return (
    <label className={`field-label fl-${tone}`}>
      {children}
      {req && <span className="field-label-req">*</span>}
    </label>
  );
}