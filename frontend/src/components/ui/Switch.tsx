interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel?: string;
}

// Switch toggle tái sử dụng
export default function Switch({ checked, onChange, ariaLabel }: SwitchProps) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
      />
      <span className="track" />
    </label>
  );
}