import { useState, useEffect, useCallback, useRef } from 'react';

interface UseResizableOptions {
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  direction?: 'horizontal' | 'vertical';
}

export function useResizable({
  initialWidth = 350,
  minWidth = 200,
  maxWidth = 800,
  storageKey,
  direction = 'horizontal',
}: UseResizableOptions = {}) {
  const [width, setWidth] = useState(() => {
    if (storageKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        // Garante que o valor salvo está dentro dos limites
        if (!isNaN(parsed)) {
          const clamped = Math.max(minWidth, Math.min(maxWidth, parsed));
          return clamped;
        }
      }
    }
    // Garante que o initialWidth também está dentro dos limites
    return Math.max(minWidth, Math.min(maxWidth, initialWidth));
  });

  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  useEffect(() => {
    // Garante que o width nunca ultrapasse os limites
    if (width < minWidth || width > maxWidth) {
      const clamped = Math.max(minWidth, Math.min(maxWidth, width));
      setWidth(clamped);
      return;
    }
    
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, width.toString());
    }
  }, [width, storageKey, minWidth, maxWidth]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      startXRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
      startWidthRef.current = width;
    },
    [width, direction]
  );

  useEffect(() => {
    if (!isResizing) return;

    // Adiciona estilo de cursor ao body durante o redimensionamento
    const originalCursor = document.body.style.cursor;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      const delta = direction === 'horizontal' 
        ? startXRef.current - e.clientX 
        : e.clientY - startXRef.current;
      const newWidth = startWidthRef.current + delta;
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Restaura o cursor original
      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = '';
    };
  }, [isResizing, minWidth, maxWidth, direction]);

  return {
    width,
    isResizing,
    handleMouseDown,
  };
}
