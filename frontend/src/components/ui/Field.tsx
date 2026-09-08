import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

// Ô nhập chuẩn có nhãn + gợi ý
export function Field({ label, hint, className = '', children }: FieldProps) {
  return (
    <div className={`field ${className}`.trim()}>
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export function FieldInput(props: InputProps) {
  const { className = '', ...rest } = props;
  return <input {...rest} className={`field-input ${className}`.trim()} />;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
}

export function FieldSelect(props: SelectProps) {
  const { className = '', ...rest } = props;
  return <select {...rest} className={`field-input ${className}`.trim()} />;
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export function FieldTextArea(props: TextAreaProps) {
  const { className = '', ...rest } = props;
  return <textarea {...rest} className={`field-input ${className}`.trim()} />;
}