import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Eye, Filter, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Contratacao {
  id: string;
  cd_pn: string | null;
  titulo: string | null;
  uf: string | null;
  municipio: string | null;
  orgao_pncp: string | null;
  modalidade: string | null;
  descricao_modalidade: string | null;
  num_licitacao: string | null;
  dt_publicacao: string | null;
  dt_encerramento_proposta: string | null;
  valor_estimado: number | null;
  cadastrado: boolean;
  enviada: boolean;
  n_controle_ativa?: string | null;
  num_ativa?: string | null;
  tipo_cadastro?: string | null;
  n_relatorio?: string | null;
  cliente?: string | null;
  created_at?: string;
  tipo_licitacao?: {
    sigla: string | null;
    descricao: string | null;
  } | null;
}

const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function LicitacaoConsulta() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contratacoes, setContratacoes] = useState<Contratacao[]>([]);
  const [activeTab, setActiveTab] = useState('todas');
  const [showFilters, setShowFilters] = useState(false);

  // Filtros
  const [filtroUF, setFiltroUF] = useState('');
  const [filtroOrgao, setFiltroOrgao] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  useEffect(() => {
    loadContratacoes();
  }, [activeTab]);

  const loadContratacoes = async () => {
    setLoading(true);
    try {
      let query = supabase.from('contratacoes').select('*').order('dt_publicacao', { ascending: false });

      // Filtro por aba
      if (activeTab === 'conferir') {
        // cadastrado=true E tem marcações E não enviada
        const { data: comMarcacoes } = await supabase
          .from('contratacoes_marcacoes')
          .select('contratacao_id');
        const idsComMarcacoes = comMarcacoes?.map(m => m.contratacao_id) || [];

        query = query
          .eq('cadastrado', true)
          .eq('enviada', false)
          .in('id', idsComMarcacoes.length > 0 ? idsComMarcacoes : ['00000000-0000-0000-0000-000000000000']);
      } else if (activeTab === 'enviadas') {
        query = query.eq('enviada', true);
      }

      // Filtros adicionais
      if (filtroUF) query = query.eq('uf', filtroUF);
      if (filtroOrgao) query = query.ilike('orgao_pncp', `%${filtroOrgao}%`);
      if (filtroDataInicio) query = query.gte('dt_publicacao', filtroDataInicio);
      if (filtroDataFim) query = query.lte('dt_publicacao', filtroDataFim);

      const { data, error } = await query;
      if (error) throw error;
      
      // Ordena do mais recente para o mais antigo baseado em dt_publicacao
      // Se dt_publicacao for null, usa dt_vinculo_ativa ou created_at como fallback
      if (data) {
        data.sort((a, b) => {
          // Prioriza dt_publicacao, depois dt_vinculo_ativa, depois created_at
          const dataA = a.dt_publicacao || (a as any).dt_vinculo_ativa || (a as any).created_at;
          const dataB = b.dt_publicacao || (b as any).dt_vinculo_ativa || (b as any).created_at;
          
          if (!dataA && !dataB) return 0;
          if (!dataA) return 1; // Sem data vai para o final
          if (!dataB) return -1; // Sem data vai para o final
          
          // Mais recente primeiro (dataB - dataA)
          return new Date(dataB).getTime() - new Date(dataA).getTime();
        });
      }
      
      // Carregar tipos de licitação se necessário
      if (data) {
        const tipoIds = data
          .map(c => (c as any).descricao_modalidade)
          .filter(id => id) as string[];
        
        if (tipoIds.length > 0) {
          const { data: tipos } = await supabase
            .from('tipo_licitacoes')
            .select('id, sigla, descricao')
            .in('id', tipoIds);
          
          if (tipos) {
            const tiposMap = new Map(tipos.map(t => [t.id, t]));
            data.forEach(c => {
              const tipoId = (c as any).descricao_modalidade;
              if (tipoId) {
                (c as any).tipo_licitacao = tiposMap.get(tipoId) || null;
              }
            });
          }
        }
      }
      
      setContratacoes(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFiltroUF('');
    setFiltroOrgao('');
    setFiltroDataInicio('');
    setFiltroDataFim('');
  };

  const applyFilters = () => {
    loadContratacoes();
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatarNumAtiva = (numAtiva: string | null, createdAt: string | null | undefined) => {
    if (!numAtiva) return '-';
    if (!createdAt) return numAtiva;
    
    const data = new Date(createdAt);
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = String(data.getFullYear()).slice(-2);
    return `${numAtiva}.${mes}/${ano}`;
  };

  return (
    <MainLayout>
      <div className="bg-white rounded-lg border border-border p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4 flex-1">
            <h1 className="text-xl font-bold">Consultar Licitações</h1>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('todas')}
                className={cn(
                  "px-4 py-2 rounded-[50px] text-[12px] font-medium transition-colors cursor-pointer relative z-10",
                  activeTab === 'todas'
                    ? "bg-green-700 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                )}
              >
                Lista Completa
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('conferir')}
                className={cn(
                  "px-4 py-2 rounded-[50px] text-[12px] font-medium transition-colors cursor-pointer relative z-10",
                  activeTab === 'conferir'
                    ? "bg-green-700 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                )}
              >
                Conferir para Enviar
              </button>
              <button
                type="button"
                /*onClick={() => setActiveTab('enviadas')}*/
                className={cn(
                  "px-4 py-2 rounded-[50px] text-[12px] font-medium transition-colors cursor-default relative z-10",
                  activeTab === 'enviadas'
                    ? "bg-green-700 text-white"
                    : "bg-pink-200 text-gray-700 hover:bg-pink-300"
                )}
              >
                Licitações Enviadas
              </button>
            </div>
          </div>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
        </div>

        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>UF</Label>
                <Select value={filtroUF} onValueChange={setFiltroUF}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {UF_LIST.map(uf => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Órgão</Label>
                <Input
                  placeholder="Buscar órgão..."
                  value={filtroOrgao}
                  onChange={(e) => setFiltroOrgao(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filtroDataInicio}
                  onChange={(e) => setFiltroDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={applyFilters}>Aplicar Filtros</Button>
              <Button variant="outline" onClick={clearFilters}>
                <X className="w-4 h-4 mr-2" />
                Limpar
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : contratacoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma licitação encontrada
            </div>
          ) : (activeTab === 'todas' || activeTab === 'conferir') ? (
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
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">N. Relatório</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Cliente</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] text-right bg-white">Ações</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {contratacoes.map((c) => (
                    <tr key={c.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">
                        {formatarNumAtiva(c.num_ativa || c.n_controle_ativa || null, (c as any).created_at)}
                      </td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{c.uf || '-'}</td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">
                        {(c as any).tipo_licitacao?.sigla || c.tipo_cadastro || '-'}
                      </td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">
                        {c.num_licitacao || '-'}
                      </td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A] max-w-xs truncate">
                        {c.orgao_pncp || '-'}
                      </td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">
                        {formatDate(c.dt_publicacao)}
                      </td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">
                        {c.n_relatorio || '-'}
                      </td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">
                        {c.cliente || '-'}
                      </td>
                      <td className="p-4 align-middle py-1.5 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 p-0"
                          onClick={() => navigate(`/licitacoes/cadastro?id=${c.id}`)}
                          title="Visualizar"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="sticky top-0 bg-white z-20 shadow-sm [&_tr]:border-b">
                  <tr className="bg-white border-b">
                    <th className="h-12 px-4 text-left align-middle font-medium bg-white">Título</th>
                    <th className="h-12 px-4 text-left align-middle font-medium bg-white">UF</th>
                    <th className="h-12 px-4 text-left align-middle font-medium bg-white">Órgão</th>
                    <th className="h-12 px-4 text-left align-middle font-medium bg-white">Nº Licitação</th>
                    <th className="h-12 px-4 text-left align-middle font-medium bg-white">Data Pub.</th>
                    <th className="h-12 px-4 text-left align-middle font-medium bg-white">Valor Est.</th>
                    <th className="h-12 px-4 text-left align-middle font-medium w-12 bg-white"></th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {contratacoes.map((c) => (
                    <tr key={c.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle font-medium max-w-xs truncate">
                        {c.titulo || '-'}
                      </td>
                      <td className="p-4 align-middle">{c.uf || '-'}</td>
                      <td className="p-4 align-middle max-w-xs truncate">{c.orgao_pncp || '-'}</td>
                      <td className="p-4 align-middle">{c.num_licitacao || '-'}</td>
                      <td className="p-4 align-middle">{formatDate(c.dt_publicacao)}</td>
                      <td className="p-4 align-middle">{formatCurrency(c.valor_estimado)}</td>
                      <td className="p-4 align-middle">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/licitacoes/cadastro?id=${c.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
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