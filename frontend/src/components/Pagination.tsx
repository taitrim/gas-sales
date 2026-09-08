import Select from './ui/Select';

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const PAGE_SIZES = [10, 20, 50, 100];

export default function Pagination({ page, total, pageSize, onChange, onPageSizeChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(pages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const nums: number[] = [];
  for (let i = start; i <= end; i++) nums.push(i);

  return (
    <div className="pagination">
      <div className="pagination-left">
        <span className="pagination-info">
          {total > 0
            ? `Hiển thị ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} / ${total}`
            : 'Không có dữ liệu'}
        </span>
        {onPageSizeChange && (
          <label className="pagination-size">
            <span>Hiển thị</span>
            <Select
              value={String(pageSize)}
              onChange={(v) => onPageSizeChange(Number(v))}
              options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
            />
            <span>/ trang</span>
          </label>
        )}
      </div>
      <div className="pagination-buttons">
        <button className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Trang trước">
          ‹
        </button>
        {start > 1 && (
          <>
            <button className={`page-btn ${page === 1 ? 'active' : ''}`} onClick={() => onChange(1)}>
              1
            </button>
            {start > 2 && <span className="page-ellipsis">…</span>}
          </>
        )}
        {nums.map((n) => (
          <button key={n} className={`page-btn ${n === page ? 'active' : ''}`} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
        {end < pages && (
          <>
            {end < pages - 1 && <span className="page-ellipsis">…</span>}
            <button className={`page-btn ${page === pages ? 'active' : ''}`} onClick={() => onChange(pages)}>
              {pages}
            </button>
          </>
        )}
        <button className="page-btn" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Trang sau">
          ›
        </button>
      </div>
    </div>
  );
}