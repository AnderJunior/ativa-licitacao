import { useState, useEffect, useCallback, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Dialog,
  DialogPortal,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Tipo {
  id: string;
  sigla: string;
  descricao: string | null;
}

interface BuscarTipoPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTipoSelecionado: (tipo: Tipo) => void;
  termoInicial?: string;
}

// Função para normalizar string (remove acentos e converte para minúsculas)
const normalizarString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

export function BuscarTipoPopup({
  open,
  onOpenChange,
  onTipoSelecionado,
  termoInicial,
}: BuscarTipoPopupProps) {
  const [filtroSigla, setFiltroSigla] = useState('');
  const [filtroDescricao, setFiltroDescricao] = useState('');
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState<Tipo | null>(null);
  const [termoInicialAplicado, setTermoInicialAplicado] = useState(false);
  const ultimaCombinacaoFiltrosRef = useRef<string>('');
  
  // Estados para arrastar o dialog
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const dialogContentRef = useRef<HTMLDivElement>(null);

  const buscarTipos = useCallback(async () => {
    setCarregando(true);
    try {
      let query = supabase
        .from('tipo_licitacoes')
        .select('id, sigla, descricao')
        .order('sigla');

      // Aplica filtros com suporte a %
      if (filtroSigla.trim()) {
        const filtro = filtroSigla.trim().replace(/%/g, '');
        query = query.ilike('sigla', `%${filtro}%`);
      }

      if (filtroDescricao.trim()) {
        const filtro = filtroDescricao.trim().replace(/%/g, '');
        query = query.ilike('descricao', `%${filtro}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar tipos:', error);
        toast.error('Erro ao buscar tipos. Tente novamente.');
        setTipos([]);
        return;
      }

      setTipos(data || []);
    } catch (error) {
      console.error('Erro ao buscar tipos:', error);
      toast.error('Erro ao buscar tipos. Tente novamente.');
      setTipos([]);
    } finally {
      setCarregando(false);
    }
  }, [filtroSigla, filtroDescricao]);

  useEffect(() => {
    if (!open) {
      // Limpa os filtros quando fecha
      setFiltroSigla('');
      setFiltroDescricao('');
      setTipos([]);
      setTipoSelecionado(null);
      setTermoInicialAplicado(false);
      ultimaCombinacaoFiltrosRef.current = '';
      // Reseta a posição do dialog
      setPosition({ x: 0, y: 0 });
    } else {
      // Quando o popup abre, garante que está no centro
      setPosition({ x: 0, y: 0 });
      if (termoInicial && termoInicial.trim() && !termoInicialAplicado) {
        // Se o popup abrir com um termo inicial, preenche o filtro
        setFiltroSigla(termoInicial);
        setTermoInicialAplicado(true);
        // Limpa a referência para permitir busca imediata
        ultimaCombinacaoFiltrosRef.current = '';
      }
    }
  }, [open, termoInicial, termoInicialAplicado]);

  // Busca automática quando o popup abre
  useEffect(() => {
    if (open) {
      // Busca todos os tipos quando o popup abre (sem filtros)
      const buscarTodosTipos = async () => {
        setCarregando(true);
        try {
          const { data, error } = await supabase
            .from('tipo_licitacoes')
            .select('id, sigla, descricao')
            .order('sigla');

          if (error) {
            console.error('Erro ao buscar tipos:', error);
            toast.error('Erro ao buscar tipos. Tente novamente.');
            setTipos([]);
            return;
          }

          setTipos(data || []);
        } catch (error) {
          console.error('Erro ao buscar tipos:', error);
          toast.error('Erro ao buscar tipos. Tente novamente.');
          setTipos([]);
        } finally {
          setCarregando(false);
        }
      };

      buscarTodosTipos();
    }
  }, [open]);

  // Aplica o transform diretamente no elemento DOM sem animação
  useEffect(() => {
    if (dialogContentRef.current && open) {
      // Remove qualquer transição/animação para movimento seco
      dialogContentRef.current.style.transition = 'none';
      // Aplica o transform imediatamente
      dialogContentRef.current.style.transform = `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`;
      
      // Garante que o transform seja aplicado após o elemento estar totalmente renderizado
      const timeout = setTimeout(() => {
        if (dialogContentRef.current) {
          dialogContentRef.current.style.transform = `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`;
        }
      }, 10);
      return () => clearTimeout(timeout);
    }
  }, [position, open]);

  // Handlers para arrastar o dialog
  const handleMouseDown = (e: React.MouseEvent) => {
    if (dialogContentRef.current) {
      setIsDragging(true);
      const rect = dialogContentRef.current.getBoundingClientRect();
      // Calcula o offset do mouse em relação ao centro do dialog
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setDragStart({
        x: e.clientX - centerX,
        y: e.clientY - centerY,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dialogContentRef.current) {
        // Calcula a nova posição relativa ao centro da tela
        const newX = e.clientX - window.innerWidth / 2 - dragStart.x;
        const newY = e.clientY - window.innerHeight / 2 - dragStart.y;
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; // Previne seleção de texto durante o arrasto
    } else {
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragStart]);

  const handleBuscar = () => {
    // Atualiza a referência da última combinação de filtros antes de buscar
    const combinacaoAtual = `${filtroSigla.trim()}|${filtroDescricao.trim()}`;
    ultimaCombinacaoFiltrosRef.current = combinacaoAtual;
    buscarTipos();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBuscar();
    }
  };

  const handleTipoClick = (tipo: Tipo) => {
    setTipoSelecionado(tipo);
  };

  const handleTipoDoubleClick = (tipo: Tipo) => {
    onTipoSelecionado(tipo);
    onOpenChange(false);
  };

  const handleOk = () => {
    if (tipoSelecionado) {
      onTipoSelecionado(tipoSelecionado);
      onOpenChange(false);
    } else {
      toast.warning('Selecione um tipo antes de confirmar.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Sem overlay - fundo transparente */}
        <DialogPrimitive.Content
          ref={dialogContentRef}
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full sm:max-w-[800px] max-w-[95vw] max-h-[90vh] flex flex-col gap-0 border bg-background p-0 shadow-2xl sm:rounded-lg",
            "data-[state=open]:opacity-100 data-[state=closed]:opacity-0"
          )}
          style={{ transition: 'none' }}
        >
          <DialogHeader 
            className={`p-4 border-b select-none ${isDragging ? 'cursor-grabbing' : 'cursor-move'}`}
            onMouseDown={handleMouseDown}
          >
            <DialogTitle className="text-lg font-semibold text-[#262626]">
              Pesquisa Avançada de Tipos → {tipos.length}
            </DialogTitle>
          </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Tabela de resultados */}
          <div className="flex-1 overflow-y-auto border-b" style={{ maxHeight: 'calc(90vh - 250px)' }}>
            {carregando ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="text-xs py-1 pl-4 pr-2 h-8">Sigla - Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tipos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={1} className="text-center py-8 text-muted-foreground text-xs">
                        Nenhum tipo encontrado. Use os filtros abaixo para buscar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tipos.map((tipo) => (
                      <TableRow
                        key={tipo.id}
                        onClick={() => handleTipoClick(tipo)}
                        onDoubleClick={() => handleTipoDoubleClick(tipo)}
                        className={`cursor-pointer ${
                          tipoSelecionado?.id === tipo.id
                            ? 'bg-blue-100 hover:bg-blue-100'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <TableCell className="text-xs py-1 pl-4 pr-2 h-8">
                          {tipo.sigla ? `${tipo.sigla} - ${tipo.descricao || ''}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Área de filtros */}
          <div className="p-2 pb-4 border-b bg-gray-50">
            <div className="flex items-end gap-2">
              <div className="space-y-0.5 flex-1 min-w-0">
                <Label className="text-xs text-[#262626]">Sigla</Label>
                <Input
                  placeholder="Digite a sigla..."
                  value={filtroSigla}
                  onChange={(e) => setFiltroSigla(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-7 text-xs bg-white"
                />
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <Label className="text-xs text-[#262626]">Descrição</Label>
                <Input
                  placeholder="Digite a descrição..."
                  value={filtroDescricao}
                  onChange={(e) => setFiltroDescricao(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-7 text-xs bg-white"
                />
              </div>
              <Button
                type="button"
                onClick={handleBuscar}
                disabled={carregando}
                className="h-7 px-3 bg-[#5046E5] hover:bg-[#4338CA] text-white text-xs shrink-0"
              >
                {carregando ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : null}
                Buscar
              </Button>
            </div>
          </div>
        </div>
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-10">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
