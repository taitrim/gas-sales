function esc(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCSV(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  fileName: string
) {
  const content = [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}