import * as React from "react";
import { cn } from "@/lib/utils";

interface DraggableDialogProps {
  open: boolean;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  width?: number;
}

/**
 * Diálogo flutuante SEM fundo escurecido (não-modal) e arrastável pelo topo.
 * Começa centralizado e pode ser movido clicando/segurando na barra de título.
 */
export function DraggableDialog({
  open,
  title,
  children,
  footer,
  className,
  width = 512,
}: DraggableDialogProps) {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const offset = React.useRef<{ dx: number; dy: number } | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Volta a centralizar sempre que o diálogo abre
  React.useEffect(() => {
    if (open) setPos(null);
  }, [open]);

  const onMove = React.useCallback((e: MouseEvent) => {
    if (!offset.current) return;
    const el = panelRef.current;
    const w = el?.offsetWidth ?? width;
    const h = el?.offsetHeight ?? 0;
    let x = e.clientX - offset.current.dx;
    let y = e.clientY - offset.current.dy;
    // mantém o painel visível dentro da janela
    x = Math.max(0, Math.min(x, window.innerWidth - w));
    y = Math.max(0, Math.min(y, window.innerHeight - h));
    setPos({ x, y });
  }, [width]);

  const onUp = React.useCallback(() => {
    offset.current = null;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    document.body.style.userSelect = "";
  }, [onMove]);

  const onDown = React.useCallback((e: React.MouseEvent) => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    offset.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    // congela a posição atual (deixa de usar a centralização por transform)
    setPos({ x: rect.left, y: rect.top });
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [onMove, onUp]);

  React.useEffect(() => () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    document.body.style.userSelect = "";
  }, [onMove, onUp]);

  if (!open) return null;

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, width }
    : { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width };

  return (
    <div
      ref={panelRef}
      role="dialog"
      className={cn(
        "fixed z-50 max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden rounded-lg border bg-background shadow-2xl",
        className
      )}
      style={style}
    >
      <div
        onMouseDown={onDown}
        className="cursor-move select-none border-b border-border bg-muted/40 px-4 py-3"
        title="Arraste para mover"
      >
        {title}
      </div>
      <div className="overflow-y-auto p-4">{children}</div>
      {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
    </div>
  );
}
