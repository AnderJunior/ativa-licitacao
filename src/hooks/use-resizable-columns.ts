import { useState, useCallback, useEffect, useRef } from 'react';

const MIN_WIDTH = 20;
const MAX_WIDTH = 9999;
const DEFAULT_WIDTH = 120;

interface UseResizableColumnsOptions {
  columnKeys: string[];
  defaultWidths?: Record<string, number>;
  storageKey?: string;
}

export function useResizableColumns({
  columnKeys,
  defaultWidths = {},
  storageKey,
}: UseResizableColumnsOptions) {
  const getInitialWidths = useCallback(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, number>;
          if (parsed && typeof parsed === 'object') {
            const result: Record<string, number> = {};
            columnKeys.forEach(key => {
              const val = parsed[key];
              result[key] = typeof val === 'number' && val >= MIN_WIDTH && val <= MAX_WIDTH
                ? val
                : (defaultWidths[key] ?? DEFAULT_WIDTH);
            });
            return result;
          }
        }
      } catch {
        /* ignore */
      }
    }
    const result: Record<string, number> = {};
    columnKeys.forEach(key => {
      result[key] = defaultWidths[key] ?? DEFAULT_WIDTH;
    });
    return result;
  }, [columnKeys.join(','), storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(getInitialWidths);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // Update widths when columnKeys change (e.g. layout switch)
  useEffect(() => {
    setColumnWidths(prev => {
      const next = { ...prev };
      let changed = false;
      columnKeys.forEach(key => {
        if (!(key in next)) {
          next[key] = defaultWidths[key] ?? DEFAULT_WIDTH;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [columnKeys.join(','), defaultWidths]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(columnWidths));
    }
  }, [columnWidths, storageKey]);

  const handleResizeStart = useCallback((columnKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnKey);
    startXRef.current = e.clientX;
    startWidthRef.current = columnWidths[columnKey] ?? DEFAULT_WIDTH;
  }, [columnWidths]);

  useEffect(() => {
    if (!resizingColumn) return;

    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidthRef.current + delta));
      setColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;
    };
  }, [resizingColumn]);

  const getWidth = useCallback((key: string) => columnWidths[key] ?? DEFAULT_WIDTH, [columnWidths]);

  const setWidth = useCallback((key: string, width: number) => {
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
    setColumnWidths(prev => ({ ...prev, [key]: clamped }));
  }, []);

  return { columnWidths, getWidth, setWidth, handleResizeStart, resizingColumn };
}
