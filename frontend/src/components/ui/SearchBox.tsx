import { useEffect, useRef, useState } from 'react';

interface SearchBoxProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: string;
  className?: string;
  delay?: number;
}

// Ô tìm kiếm với icon + debounce, full width trên mobile
export default function SearchBox({
  value,
  onChange,
  placeholder = 'Tìm kiếm...',
  icon = '🔍',
  className = '',
  delay = 250
}: SearchBoxProps) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  function handleChange(v: string) {
    setLocal(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), delay);
  }

  return (
    <div className={`search-box ${className}`.trim()}>
      <span className="sb-icon">{icon}</span>
      <input
        type="search"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}