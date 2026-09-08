import { useCallback, useEffect, useRef, useState } from 'react';

export interface ListParams {
  page: number;
  pageSize: number;
  search: string;
  [key: string]: unknown;
}

interface Options<T> {
  fetcher: (p: ListParams) => Promise<{ items: T[]; total: number }>;
  pageSize?: number;
  debounce?: number;
  extra?: Record<string, unknown>;
}

export function usePaginatedList<T>({ fetcher, pageSize: initialPageSize = 20, debounce = 350, extra }: Options<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetcherRef = useRef(fetcher);
  const extraRef = useRef(extra);
  fetcherRef.current = fetcher;
  extraRef.current = extra;

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);
  const setSearchValue = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);
  const setPageSizeValue = useCallback((v: number) => {
    setPageSize(v);
    setPage(1);
  }, []);

  const extraKey = JSON.stringify(extra || {});

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      setLoading(true);
      fetcherRef
        .current({ page, pageSize, search: search.trim(), ...(extraRef.current || {}) })
        .then((res) => {
          if (cancelled) return;
          setItems(res.items);
          setTotal(res.total);
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, debounce);
    return () => {
      window.clearTimeout(t);
      cancelled = true;
    };
  }, [page, search, refreshKey, pageSize, debounce, extraKey]);

  return { items, total, page, setPage, pageSize, setPageSize: setPageSizeValue, search, setSearch: setSearchValue, loading, reload };
}