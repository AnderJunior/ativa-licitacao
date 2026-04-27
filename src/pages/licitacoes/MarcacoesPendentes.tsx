import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Eye } from 'lucide-react';

interface Contratacao {
  id: string;
  num_ativa: string | null;
  uf: string | null;
  descricao_modalidade: string | null;
  titulo: string | null;
  num_licitacao: string | null;
  orgao_pncp: string | null;
  dt_publicacao: string | null;
  dt_vinculo_ativa: string | null;
  cadastrado_por: string | null;
  dt_alterado_ativa: string | null;
  created_at: string;
  tipo_licitacao?: {
    sigla: string;
    descricao: string | null;
  } | null;
  usuario_nome?: string | null;
}

export default function MarcacoesPendentes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contratacoes, setContratacoes] = useState<Contratacao[]>([]);

  useEffect(() => {
    loadPendentes();
  }, []);

  const buscarNomeUsuario = async (userId: string | null): Promise<string | null> => {
    if (!userId) return null;
    try {
      const profiles = await api.get<{ user_id: string; full_name: string | null }[]>('/api/profiles', { user_ids: userId });
      return profiles?.[0]?.full_name || null;
    } catch {
      return null;
    }
  };

  const loadPendentes = async () => {
    setLoading(true);
    try {
      // Buscar contratações cadastrado=true que NÃO têm marcações e não foram enviadas
      const todasCadastradas = await api.get<any[]>('/api/contratacoes', {
        cadastrado: 'true',
        enviada: 'false',
        sort: 'dt_publicacao',
        order: 'desc',
      });

      // Buscar IDs que têm marcações
      const comMarcacoes = await api.get<{ contratacao_id: string }[]>('/api/contratacoes-marcacoes');

      const idsComMarcacoes = new Set(comMarcacoes?.map(m => m.contratacao_id) || []);

      // Filtrar apenas as que NÃO têm marcações
      const pendentes = (todasCadastradas || []).filter(c => !idsComMarcacoes.has(c.id));

      // Buscar tipos de licitação
      const tipoIds = pendentes
        .map(c => c.descricao_modalidade)
        .filter(id => id) as string[];

      let tiposMap = new Map();
      if (tipoIds.length > 0) {
        const tipos = await api.post<{ id: string; sigla: string; descricao: string | null }[]>('/api/tipo-licitacoes/by-ids', { ids: tipoIds });
        if (tipos) {
          tiposMap = new Map(tipos.map(t => [t.id, { sigla: t.sigla, descricao: t.descricao }]));
        }
      }

      // Buscar nomes dos usuários e adicionar tipos
      const pendentesCompleto = await Promise.all(
        pendentes.map(async (c) => {
          const tipo = c.descricao_modalidade ? tiposMap.get(c.descricao_modalidade) : null;
          const usuarioNome = await buscarNomeUsuario(c.cadastrado_por);
          
          return {
            ...c,
            tipo_licitacao: tipo,
            usuario_nome: usuarioNome,
          };
        })
      );

      setContratacoes(pendentesCompleto);
    } catch (error: any) {
      toast.error('Erro ao carregar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const formatarNumAtiva = (numAtiva: string | null, createdAt: string) => {
    if (!numAtiva) return '-';
    const data = new Date(createdAt);
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = String(data.getFullYear()).slice(-2);
    return `${numAtiva}.${mes}/${ano}`;
  };

  const formatarTipo = (tipo: { sigla: string; descricao: string | null } | null | undefined) => {
    if (!tipo) return '-';
    return tipo.descricao ? `${tipo.sigla} - ${tipo.descricao}` : tipo.sigla;
  };

  return (
    <MainLayout>
      <div className="bg-white rounded-lg border border-border p-6 h-full flex flex-col">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl font-bold text-[#262626]">
            Marcações Pendentes
            {!loading && contratacoes.length > 0 && (
              <span className="text-red-600 ml-2 text-sm">({contratacoes.length})</span>
            )}
          </h1>
        </div>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : contratacoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma licitação pendente de marcação
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="sticky top-0 bg-white z-20 shadow-sm [&_tr]:border-b">
                  <tr className="bg-white border-b">
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">N. Controle Ativa</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">UF</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Tipo</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Edital</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Órgão</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Data Licitação</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Dúvida de</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Data Dúvida</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] text-right bg-white">Ações</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {contratacoes.map((c) => (
                    <tr key={c.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">
                        {formatarNumAtiva(c.num_ativa, c.created_at)}
                      </td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{c.uf || '-'}</td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{formatarTipo(c.tipo_licitacao)}</td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A] max-w-xs truncate">
                        {(c as any).sequencial_compra && (c as any).ano_compra ? `${(c as any).sequencial_compra}/${(c as any).ano_compra}` : (c.num_licitacao || '-')}
                      </td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A] max-w-xs truncate">{c.orgao_pncp || '-'}</td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{formatDate(c.dt_publicacao || c.dt_vinculo_ativa)}</td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{c.usuario_nome || '-'}</td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{formatDate(c.dt_alterado_ativa)}</td>
                      <td className="p-4 align-middle py-1.5 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 p-0"
                            onClick={() => navigate(`/licitacoes/cadastro?id=${c.id}`)}
                            title="Visualizar e fazer marcações"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}