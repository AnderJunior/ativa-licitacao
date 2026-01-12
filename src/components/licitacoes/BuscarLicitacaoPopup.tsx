import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LicitacaoEncontrada {
  id: string;
  n_controle_ativa: string | null;
  cd_pn: string | null;
  titulo: string | null;
  conteudo: string | null;
  uf: string | null;
  municipio: string | null;
  orgao_pncp: string | null;
  modalidade: string | null;
  num_licitacao: string | null;
  dt_publicacao: string | null;
  link_processo: string | null;
  links: string[] | null;
  incluido_por: string | null;
}

interface BuscarLicitacaoPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLicitacaoEncontrada: (licitacao: LicitacaoEncontrada, ramos: string[]) => void;
}

export function BuscarLicitacaoPopup({
  open,
  onOpenChange,
  onLicitacaoEncontrada,
}: BuscarLicitacaoPopupProps) {
  const [numeroControle, setNumeroControle] = useState('');
  const [buscando, setBuscando] = useState(false);

  const handleBuscar = async () => {
    if (!numeroControle.trim()) {
      toast.error('Digite o número de controle para buscar');
      return;
    }

    // Formato esperado: num_ativa.mes/ano (ex: 1234.01/25)
    const regex = /^(\d+)\.(\d{2})\/(\d{2})$/;
    const match = numeroControle.trim().match(regex);

    if (!match) {
      toast.error('Formato inválido. Use: 0000.00/00 (número.mês/ano)');
      return;
    }

    const [, numAtiva, mes, ano] = match;
    
    // Converte ano de 2 dígitos para 4 dígitos (assume 2000+)
    const anoCompleto = parseInt(ano) < 50 ? `20${ano}` : `19${ano}`;
    
    // Cria as datas de início e fim do mês para filtrar
    const inicioMes = `${anoCompleto}-${mes}-01`;
    const proximoMes = parseInt(mes) === 12 
      ? `${parseInt(anoCompleto) + 1}-01-01`
      : `${anoCompleto}-${String(parseInt(mes) + 1).padStart(2, '0')}-01`;

    setBuscando(true);
    try {
      // Busca a licitação pelo num_ativa e created_at no mês/ano específico
      // Usa limit(1) para garantir que só retorna uma linha, mesmo que haja múltiplas
      const { data: licitacoes, error } = await supabase
        .from('contratacoes')
        .select('*')
        .eq('num_ativa', numAtiva)
        .gte('created_at', inicioMes)
        .lt('created_at', proximoMes)
        .limit(1);

      if (error) throw error;

      if (!licitacoes || licitacoes.length === 0) {
        toast.error('Licitação não encontrada com este número de controle');
        return;
      }

      const licitacao = licitacoes[0];

      // Busca as marcações de ramos de atividade
      const { data: marcacoes } = await supabase
        .from('contratacoes_marcacoes')
        .select('ramo_id')
        .eq('contratacao_id', licitacao.id);

      const ramosIds = marcacoes?.map(m => m.ramo_id) || [];

      // Retorna os dados encontrados
      onLicitacaoEncontrada(licitacao as LicitacaoEncontrada, ramosIds);
      toast.success('Licitação encontrada!');
      
      // Fecha o popup e limpa o campo
      setNumeroControle('');
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Erro ao buscar: ' + error.message);
    } finally {
      setBuscando(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBuscar();
    }
  };

  const handleCancel = () => {
    setNumeroControle('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-0 gap-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl font-semibold text-[#262626]">
            Localizar Licitação
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Campo de busca */}
          <div className="space-y-2">
            <Label className="text-sm text-[#262626]">Número de Controle Ativa</Label>
            <Input
              placeholder="0000.00/00"
              value={numeroControle}
              onChange={(e) => setNumeroControle(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="bg-white"
            />
            <p className="text-xs text-muted-foreground">
              Formato: número.mês/ano (ex: 1234.01/25)
            </p>
          </div>
        </div>

        {/* Footer com botões */}
        <div className="flex items-center justify-between p-6 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="bg-gray-100 hover:bg-gray-200 text-[#262626]"
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          
          <Button
            type="button"
            onClick={handleBuscar}
            disabled={buscando}
            className="bg-secondary hover:bg-secondary/90 text-white"
          >
            {buscando ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            Buscar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

