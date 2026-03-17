import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Eye, Filter, X, Download, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useResizableColumns } from '@/hooks/use-resizable-columns';
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

const REGIOES_E_UFS: { regiao: string; ufs: string[] }[] = [
  { regiao: 'Sudeste', ufs: ['ES', 'MG', 'RJ', 'SP'] },
  { regiao: 'Nordeste', ufs: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'] },
  { regiao: 'Sul', ufs: ['PR', 'RS', 'SC'] },
  { regiao: 'Centro-Oeste', ufs: ['DF', 'GO', 'MS', 'MT'] },
  { regiao: 'Norte', ufs: ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'] },
];

const ESFERA_OPCOES = ['Federal', 'Estadual', 'Municipal'];
const PODER_OPCOES = ['Executivo', 'Legislativo', 'Judiciário'];

const UF_PARA_REGIAO: Record<string, string> = REGIOES_E_UFS.reduce((acc, r) => {
  r.ufs.forEach(uf => { acc[uf] = r.regiao; });
  return acc;
}, {} as Record<string, string>);

const getRegiaoFromUF = (uf: string | null): string => {
  if (!uf) return '-';
  return UF_PARA_REGIAO[uf] || '-';
};

const COLUNAS_POR_LAYOUT: Record<string, string[]> = {
  resumido: ['Região', 'Estado', 'Quantidade'],
  detalhado: ['Região', 'UF', 'NumPncp', 'NumAtiva', 'Alterado', 'Titulo', 'Municipio', 'Unidade', 'UnCod', 'OrgaoPNCP', 'CNPJ', 'Modalidade', 'Conteudo', 'Complemento', 'DtCriacao', 'DtImportacao', 'DtPublicacao', 'DtAtualizacao', 'DtVigencia', 'DtVinculoAtiva', 'Esfera', 'Poder', 'cd_pn', 'Ações'],
  unidades: ['UF', 'Esfera', 'Poder', 'OrgaoPNCP', 'CNPJ', 'Unidade', 'UnCod', 'Municipio', 'Ações'],
  modalidade: ['Id', 'ModalidadePncp', 'TipoLicitacaoAtiva', 'Ações'],
};

const LARGURA_COLUNA: Record<string, number> = {
  Região: 100, Estado: 70, Quantidade: 90, UF: 50, NumPncp: 100, NumAtiva: 100, Alterado: 95,
  Titulo: 200, Municipio: 120, Unidade: 120, UnCod: 80, OrgaoPNCP: 180, CNPJ: 140, Modalidade: 100,
  Conteudo: 250, Complemento: 120, DtCriacao: 95, DtImportacao: 95, DtPublicacao: 95, DtAtualizacao: 95,
  DtVigencia: 95, DtVinculoAtiva: 95, Esfera: 90, Poder: 90, cd_pn: 100, Ações: 60,
  Id: 80, ModalidadePncp: 120, TipoLicitacaoAtiva: 150,
};

export default function LicitacaoConsulta() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contratacoes, setContratacoes] = useState<Contratacao[]>([]);
  const [activeTab, setActiveTab] = useState('todas');
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);

  // Filtros
  const [filtroUF, setFiltroUF] = useState('');
  const [filtroOrgao, setFiltroOrgao] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroMunicipio, setFiltroMunicipio] = useState('');
  const [filtroEsfera, setFiltroEsfera] = useState('');
  const [filtroPoder, setFiltroPoder] = useState('');
  const [filtroModalidade, setFiltroModalidade] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [filtroNumAtiva, setFiltroNumAtiva] = useState('');
  const [filtroNPncp, setFiltroNPncp] = useState('');
  const [filtroPeriodoBase, setFiltroPeriodoBase] = useState<'dt_atualizacao' | 'dt_publicacao' | 'dt_criacao' | 'dt_importacao' | 'dt_vigencia_ini' | 'dt_vinculo_ativa'>('dt_atualizacao');
  const [filtroSituacaoRadio, setFiltroSituacaoRadio] = useState<'pendentes' | 'vinculadas' | 'excluidas' | 'todas'>('todas');
  const [filtroLayout, setFiltroLayout] = useState<'resumido' | 'detalhado' | 'unidades' | 'modalidade'>('resumido');
  const [selectedUFs, setSelectedUFs] = useState<Set<string>>(new Set());
  const [tiposLicitacao, setTiposLicitacao] = useState<{ id: string; sigla: string; descricao: string | null }[]>([]);

  // Estados dos dropdowns com pesquisa
  const [esferaPopupOpen, setEsferaPopupOpen] = useState(false);
  const [poderPopupOpen, setPoderPopupOpen] = useState(false);
  const [modalidadePopupOpen, setModalidadePopupOpen] = useState(false);
  const [situacaoPopupOpen, setSituacaoPopupOpen] = useState(false);
  const [esferaSearchTerm, setEsferaSearchTerm] = useState('');
  const [poderSearchTerm, setPoderSearchTerm] = useState('');
  const [modalidadeSearchTerm, setModalidadeSearchTerm] = useState('');
  const [situacaoSearchTerm, setSituacaoSearchTerm] = useState('');

  const colunasAtuais = COLUNAS_POR_LAYOUT[filtroLayout] || COLUNAS_POR_LAYOUT.resumido;
  const { getWidth, setWidth, handleResizeStart, resizingColumn } = useResizableColumns({
    columnKeys: colunasAtuais,
    defaultWidths: LARGURA_COLUNA,
    storageKey: `consulta-colunas-${filtroLayout}`,
  });
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const handleAutoFitColumn = useCallback((columnKey: string) => {
    const container = tableContainerRef.current;
    const table = container?.querySelector('table');
    if (!table) return;
    const colIndex = colunasAtuais.indexOf(columnKey);
    if (colIndex < 0) return;
    const rows = table.querySelectorAll('tr');
    let maxW = 0;
    const measureSpan = document.createElement('span');
    measureSpan.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;';
    document.body.appendChild(measureSpan);
    const sampleCell = table.querySelector('td, th');
    if (sampleCell) {
      const style = window.getComputedStyle(sampleCell);
      measureSpan.style.font = style.font;
      measureSpan.style.fontSize = style.fontSize;
      measureSpan.style.fontFamily = style.fontFamily;
      measureSpan.style.fontWeight = style.fontWeight;
    }
    measureSpan.style.paddingLeft = '16px';
    measureSpan.style.paddingRight = '16px';
    rows.forEach((row) => {
      const cell = row.cells[colIndex];
      if (cell) {
        measureSpan.textContent = cell.textContent?.trim() || columnKey;
        maxW = Math.max(maxW, measureSpan.offsetWidth);
      }
    });
    document.body.removeChild(measureSpan);
    setWidth(columnKey, Math.max(maxW, 60));
  }, [colunasAtuais, setWidth]);

  useEffect(() => {
    loadContratacoes();
  }, [activeTab]);

  // Fecha o modal de filtros ao trocar para aba Conferir (filtros só na Lista Completa)
  useEffect(() => {
    if (activeTab !== 'todas') setFilterPopoverOpen(false);
  }, [activeTab]);

  useEffect(() => {
    const loadTipos = async () => {
      const { data } = await supabase.from('tipo_licitacoes').select('id, sigla, descricao').order('sigla');
      if (data) setTiposLicitacao(data);
    };
    loadTipos();
  }, []);

  const toggleUF = (uf: string) => {
    setSelectedUFs(prev => {
      const next = new Set(prev);
      if (next.has(uf)) next.delete(uf);
      else next.add(uf);
      return next;
    });
  };

  const toggleAllUFs = () => {
    setSelectedUFs(prev => prev.size === UF_LIST.length ? new Set() : new Set(UF_LIST));
  };

  const toggleRegiao = (ufs: string[]) => {
    setSelectedUFs(prev => {
      const todosSelecionados = ufs.every(uf => prev.has(uf));
      const next = new Set(prev);
      if (todosSelecionados) {
        ufs.forEach(uf => next.delete(uf));
      } else {
        ufs.forEach(uf => next.add(uf));
      }
      return next;
    });
  };

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
      if (selectedUFs.size > 0) query = query.in('uf', Array.from(selectedUFs));
      else if (filtroUF) query = query.eq('uf', filtroUF);
      if (filtroOrgao) query = query.ilike('orgao_pncp', `%${filtroOrgao}%`);
      const campoData = filtroPeriodoBase;
      if (filtroDataInicio) query = query.gte(campoData, filtroDataInicio);
      if (filtroDataFim) query = query.lte(campoData, filtroDataFim);
      if (filtroMunicipio) query = query.ilike('municipio', `%${filtroMunicipio}%`);
      if (filtroEsfera) query = query.eq('esfera', filtroEsfera);
      if (filtroPoder) query = query.eq('poder', filtroPoder);
      if (filtroModalidade) query = query.eq('descricao_modalidade', filtroModalidade);
      if (filtroNumAtiva) query = query.ilike('num_ativa', `%${filtroNumAtiva}%`);
      if (filtroNPncp) query = query.ilike('cd_pn', `%${filtroNPncp}%`);
      // Situação (pendentes/vinculadas/excluídas) - apenas na Lista Completa
      if (activeTab === 'todas') {
        if (filtroSituacaoRadio === 'pendentes') {
          query = query.eq('cadastrado', false).eq('enviada', false);
        } else if (filtroSituacaoRadio === 'vinculadas') {
          query = query.eq('cadastrado', true);
        } else if (filtroSituacaoRadio === 'excluidas') {
          query = query.eq('enviada', true);
        }
      }

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
    setFiltroMunicipio('');
    setFiltroEsfera('');
    setFiltroPoder('');
    setFiltroModalidade('');
    setFiltroSituacao('');
    setFiltroNumAtiva('');
    setFiltroNPncp('');
    setSelectedUFs(new Set<string>());
    setFiltroPeriodoBase('dt_atualizacao');
    setFiltroLayout('resumido');
    setFiltroSituacaoRadio('todas');
    setEsferaSearchTerm('');
    setPoderSearchTerm('');
    setModalidadeSearchTerm('');
    setSituacaoSearchTerm('');
  };

  const applyFilters = () => {
    loadContratacoes();
  };

  // Converte string ISO (YYYY-MM-DD) para DD/MM/AAAA sem problemas de fuso horário
  const formatarDataISO = (dataISO: string | null): string => {
    if (!dataISO || dataISO.trim() === '') return '-';
    
    // Parse manual da string ISO para evitar problemas de fuso horário
    const partes = dataISO.split('T')[0].split('-'); // Pega apenas a parte da data (antes do T)
    if (partes.length !== 3) return '-';
    
    const ano = parseInt(partes[0]);
    const mes = parseInt(partes[1]);
    const dia = parseInt(partes[2]);
    
    if (isNaN(ano) || isNaN(mes) || isNaN(dia)) return '-';
    
    // Formata como DD/MM/AAAA
    return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return formatarDataISO(date);
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

  // Dados agregados para layout Resumido (Região, Estado, Quantidade)
  const dadosResumidos = (() => {
    const map = new Map<string, { regiao: string; estado: string; quantidade: number }>();
    contratacoes.forEach(c => {
      const regiao = (c as any).regiao || getRegiaoFromUF(c.uf);
      const estado = c.uf || '-';
      const key = `${regiao}|${estado}`;
      const existing = map.get(key);
      if (existing) {
        existing.quantidade += 1;
      } else {
        map.set(key, { regiao, estado, quantidade: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const regCmp = a.regiao.localeCompare(b.regiao);
      if (regCmp !== 0) return regCmp;
      return a.estado.localeCompare(b.estado);
    });
  })();

  const tabelaLargura = colunasAtuais.reduce((s, k) => s + getWidth(k), 0);

  return (
    <MainLayout>
      <div className="bg-white rounded-lg border border-border p-6 flex flex-col h-[calc(100vh-96px)] min-h-0 w-full overflow-hidden">
        {/* Título, abas, Exportar e Filtros na mesma linha */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <h1 className="text-xl font-bold shrink-0">Consultar Licitações</h1>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('todas')}
                className={cn(
                  "px-4 py-2 rounded-[50px] text-[12px] font-medium transition-colors cursor-pointer",
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
                  "px-4 py-2 rounded-[50px] text-[12px] font-medium transition-colors cursor-pointer",
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
                  "px-4 py-2 rounded-[50px] text-[12px] font-medium transition-colors cursor-default",
                  activeTab === 'enviadas'
                    ? "bg-green-700 text-white"
                    : "bg-pink-200 text-gray-700 hover:bg-pink-300"
                )}
              >
                Licitações Enviadas
              </button>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            {activeTab === 'todas' && (
            <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtros
                </Button>
              </PopoverTrigger>
            <PopoverContent
              className="w-[1200px] max-w-[95vw] p-5"
              align="end"
              side="bottom"
              sideOffset={8}
            >
              <div className="space-y-6">
                {/* Linha superior: Estados, Período, Situação, Layout + Botões */}
                <div className="flex flex-wrap gap-6 items-end">
                  {/* Estados */}
                  <div className="flex-shrink-0 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Estados</Label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={toggleAllUFs}
                          className="text-xs text-amber-600 hover:underline font-medium"
                        >
                          TODOS
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs">
                      {REGIOES_E_UFS.map((r) => (
                        <div key={r.regiao} className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => toggleRegiao(r.ufs)}
                            className="text-muted-foreground min-w-[90px] text-left hover:text-foreground hover:underline cursor-pointer"
                          >
                            {r.regiao}:
                          </button>
                          {r.ufs.map((uf) => (
                            <button
                              key={uf}
                              type="button"
                              onClick={() => toggleUF(uf)}
                              className={cn(
                                "px-1.5 py-0.5 rounded font-medium transition-colors",
                                selectedUFs.has(uf)
                                  ? "bg-amber-200 text-amber-900"
                                  : "hover:bg-muted"
                              )}
                            >
                              {uf}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Período com base na PNCP */}
                  <div className="flex-shrink-0 space-y-2">
                    <Label className="text-sm font-medium">Período com base na PNCP</Label>
                    <RadioGroup
                      value={filtroPeriodoBase}
                      onValueChange={(v) => setFiltroPeriodoBase(v as typeof filtroPeriodoBase)}
                      className="grid grid-cols-2 gap-1.5 text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dt_atualizacao" id="dt-atualizacao" />
                        <Label htmlFor="dt-atualizacao" className="cursor-pointer font-normal">DtAtualização</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dt_publicacao" id="dt-publicacao" />
                        <Label htmlFor="dt-publicacao" className="cursor-pointer font-normal">DtPublicação</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dt_criacao" id="dt-criacao" />
                        <Label htmlFor="dt-criacao" className="cursor-pointer font-normal">DtCriação</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dt_importacao" id="dt-importacao" />
                        <Label htmlFor="dt-importacao" className="cursor-pointer font-normal">DtImportação</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dt_vigencia_ini" id="dt-vigencia" />
                        <Label htmlFor="dt-vigencia" className="cursor-pointer font-normal">DtVigencialni</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dt_vinculo_ativa" id="dt-vinculo" />
                        <Label htmlFor="dt-vinculo" className="cursor-pointer font-normal">DtVinculo Ativa</Label>
                      </div>
                    </RadioGroup>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="date"
                        placeholder="Dt Início"
                        value={filtroDataInicio}
                        onChange={(e) => setFiltroDataInicio(e.target.value)}
                        className="w-[140px]"
                      />
                      <Input
                        type="date"
                        placeholder="Dt. Fim"
                        value={filtroDataFim}
                        onChange={(e) => setFiltroDataFim(e.target.value)}
                        className="w-[140px]"
                      />
                    </div>
                  </div>

                  {/* Situação */}
                  <div className="flex-shrink-0 space-y-2">
                    <Label className="text-sm font-medium">Situação</Label>
                    <RadioGroup
                      value={filtroSituacaoRadio}
                      onValueChange={(v) => setFiltroSituacaoRadio(v as typeof filtroSituacaoRadio)}
                      className="flex flex-col gap-1.5 text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pendentes" id="sit-pendentes" />
                        <Label htmlFor="sit-pendentes" className="cursor-pointer font-normal">Pendentes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="vinculadas" id="sit-vinculadas" />
                        <Label htmlFor="sit-vinculadas" className="cursor-pointer font-normal">Vinculadas</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="excluidas" id="sit-excluidas" />
                        <Label htmlFor="sit-excluidas" className="cursor-pointer font-normal">Excluídas</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="todas" id="sit-todas" />
                        <Label htmlFor="sit-todas" className="cursor-pointer font-normal">Todas</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Layout */}
                  <div className="flex-shrink-0 space-y-2">
                    <Label className="text-sm font-medium">Layout</Label>
                    <RadioGroup
                      value={filtroLayout}
                      onValueChange={(v) => setFiltroLayout(v as typeof filtroLayout)}
                      className="flex flex-col gap-1.5 text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="resumido" id="lay-resumido" />
                        <Label htmlFor="lay-resumido" className="cursor-pointer font-normal">Resumido</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="detalhado" id="lay-detalhado" />
                        <Label htmlFor="lay-detalhado" className="cursor-pointer font-normal">Detalhado</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="unidades" id="lay-unidades" />
                        <Label htmlFor="lay-unidades" className="cursor-pointer font-normal">Unidades</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="modalidade" id="lay-modalidade" />
                        <Label htmlFor="lay-modalidade" className="cursor-pointer font-normal">Modalidade</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Botão Pesquisar - ao lado direito do Layout */}
                  <div className="flex flex-row gap-2 items-end ml-auto">
                    <Button size="sm" onClick={() => { applyFilters(); setFilterPopoverOpen(false); }}>
                      Pesquisar
                    </Button>
                  </div>
                </div>

                {/* Linha de campos: Município, Esfera, Poder, etc. */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 items-end">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <Label className="text-xs font-medium shrink-0">Município</Label>
                    <Input
                      placeholder="Município"
                      value={filtroMunicipio}
                      onChange={(e) => setFiltroMunicipio(e.target.value)}
                      className="h-8 w-full text-sm min-w-0"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <Label className="text-xs font-medium shrink-0">Esfera</Label>
                    <Popover open={esferaPopupOpen} onOpenChange={(open) => { setEsferaPopupOpen(open); if (!open) setEsferaSearchTerm(''); }}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={esferaPopupOpen} className="h-8 w-full text-sm justify-between font-normal min-w-0">
                          <span className="truncate">{filtroEsfera || 'Esfera'}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" side="bottom" avoidCollisions={false}>
                        <Command>
                          <CommandInput placeholder="Pesquisar esfera..." value={esferaSearchTerm} onValueChange={setEsferaSearchTerm} />
                          <CommandList>
                            <CommandEmpty>Nenhuma esfera encontrada.</CommandEmpty>
                            <CommandGroup className="p-0 max-h-[200px] overflow-y-auto">
                              <CommandItem value="todas" onSelect={() => { setFiltroEsfera(''); setEsferaPopupOpen(false); setEsferaSearchTerm(''); }}>
                                Todas
                              </CommandItem>
                              {ESFERA_OPCOES.map((e) => (
                                <CommandItem key={e} value={e} onSelect={() => { setFiltroEsfera(e); setEsferaPopupOpen(false); setEsferaSearchTerm(''); }} className={cn("cursor-pointer", filtroEsfera === e && "bg-accent")}>
                                  {e}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <Label className="text-xs font-medium shrink-0">Poder</Label>
                    <Popover open={poderPopupOpen} onOpenChange={(open) => { setPoderPopupOpen(open); if (!open) setPoderSearchTerm(''); }}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={poderPopupOpen} className="h-8 w-full text-sm justify-between font-normal min-w-0">
                          <span className="truncate">{filtroPoder || 'Poder'}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" side="bottom" avoidCollisions={false}>
                        <Command>
                          <CommandInput placeholder="Pesquisar poder..." value={poderSearchTerm} onValueChange={setPoderSearchTerm} />
                          <CommandList>
                            <CommandEmpty>Nenhum poder encontrado.</CommandEmpty>
                            <CommandGroup className="p-0 max-h-[200px] overflow-y-auto">
                              <CommandItem value="todos" onSelect={() => { setFiltroPoder(''); setPoderPopupOpen(false); setPoderSearchTerm(''); }}>
                                Todos
                              </CommandItem>
                              {PODER_OPCOES.map((p) => (
                                <CommandItem key={p} value={p} onSelect={() => { setFiltroPoder(p); setPoderPopupOpen(false); setPoderSearchTerm(''); }} className={cn("cursor-pointer", filtroPoder === p && "bg-accent")}>
                                  {p}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <Label className="text-xs font-medium shrink-0">Modalidade</Label>
                    <Popover open={modalidadePopupOpen} onOpenChange={(open) => { setModalidadePopupOpen(open); if (!open) setModalidadeSearchTerm(''); }}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={modalidadePopupOpen} className="h-8 w-full text-sm justify-between font-normal min-w-0">
                          <span className="truncate">
                            {filtroModalidade
                              ? (tiposLicitacao.find(t => t.id === filtroModalidade)
                                ? `${tiposLicitacao.find(t => t.id === filtroModalidade)?.sigla} - ${tiposLicitacao.find(t => t.id === filtroModalidade)?.descricao || ''}`
                                : 'Modalidade')
                              : 'Modalidade'}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-0" align="start" side="bottom" avoidCollisions={false}>
                        <Command>
                          <CommandInput placeholder="Pesquisar modalidade..." value={modalidadeSearchTerm} onValueChange={setModalidadeSearchTerm} />
                          <CommandList>
                            <CommandEmpty>Nenhuma modalidade encontrada.</CommandEmpty>
                            <CommandGroup className="p-0 max-h-[250px] overflow-y-auto">
                              <CommandItem value="todas modalidades" onSelect={() => { setFiltroModalidade(''); setModalidadePopupOpen(false); setModalidadeSearchTerm(''); }}>
                                Todas
                              </CommandItem>
                              {tiposLicitacao.map((t) => {
                                const label = `${t.sigla} ${t.descricao || ''}`.trim();
                                return (
                                  <CommandItem key={t.id} value={label} onSelect={() => { setFiltroModalidade(t.id); setModalidadePopupOpen(false); setModalidadeSearchTerm(''); }} className={cn("cursor-pointer", filtroModalidade === t.id && "bg-accent")}>
                                    {t.sigla} {t.descricao ? `- ${t.descricao}` : ''}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <Label className="text-xs font-medium shrink-0">Situação</Label>
                    <Popover open={situacaoPopupOpen} onOpenChange={(open) => { setSituacaoPopupOpen(open); if (!open) setSituacaoSearchTerm(''); }}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={situacaoPopupOpen} className="h-8 w-full text-sm justify-between font-normal min-w-0">
                          <span className="truncate">{filtroSituacao ? (filtroSituacao === 'aberta' ? 'Aberta' : 'Fechada') : 'Situação'}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" side="bottom" avoidCollisions={false}>
                        <Command>
                          <CommandInput placeholder="Pesquisar situação..." value={situacaoSearchTerm} onValueChange={setSituacaoSearchTerm} />
                          <CommandList>
                            <CommandEmpty>Nenhuma situação encontrada.</CommandEmpty>
                            <CommandGroup className="p-0 max-h-[200px] overflow-y-auto">
                              <CommandItem value="todas" onSelect={() => { setFiltroSituacao(''); setSituacaoPopupOpen(false); setSituacaoSearchTerm(''); }}>
                                Todas
                              </CommandItem>
                              <CommandItem value="aberta" onSelect={() => { setFiltroSituacao('aberta'); setSituacaoPopupOpen(false); setSituacaoSearchTerm(''); }} className={cn("cursor-pointer", filtroSituacao === 'aberta' && "bg-accent")}>
                                Aberta
                              </CommandItem>
                              <CommandItem value="fechada" onSelect={() => { setFiltroSituacao('fechada'); setSituacaoPopupOpen(false); setSituacaoSearchTerm(''); }} className={cn("cursor-pointer", filtroSituacao === 'fechada' && "bg-accent")}>
                                Fechada
                              </CommandItem>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <Label className="text-xs font-medium shrink-0">N.ATIVA</Label>
                    <Input
                      placeholder="N.ATIVA"
                      value={filtroNumAtiva}
                      onChange={(e) => setFiltroNumAtiva(e.target.value)}
                      className="h-8 w-full text-sm min-w-0"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <Label className="text-xs font-medium shrink-0">Órgão</Label>
                    <Input
                      placeholder="Órgão"
                      value={filtroOrgao}
                      onChange={(e) => setFiltroOrgao(e.target.value)}
                      className="h-8 w-full text-sm min-w-0"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <Label className="text-xs font-medium shrink-0">N.PNCP</Label>
                    <Input
                      placeholder="N.PNCP"
                      value={filtroNPncp}
                      onChange={(e) => setFiltroNPncp(e.target.value)}
                      className="h-8 w-full text-sm min-w-0"
                    />
                  </div>
                </div>

                {/* Limpar */}
                <div className="pt-4 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-2" />
                    Limpar filtros
                  </Button>
                </div>
              </div>
            </PopoverContent>
            </Popover>
            )}
          </div>
        </div>

        {/* Área da lista: overflow-auto garante scroll horizontal e vertical */}
        <div ref={tableContainerRef} className={cn("flex-1 min-h-0 min-w-0 overflow-auto", resizingColumn && "select-none")}>
          {loading ? (
            <div className="flex items-center justify-center h-64 flex-1">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : contratacoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex-1">
              Nenhuma licitação encontrada
            </div>
          ) : (activeTab === 'todas' || activeTab === 'conferir') ? (
            <div className="inline-block min-w-full" style={{ minWidth: tabelaLargura }}>
              {filtroLayout === 'resumido' ? (
                <table className="caption-bottom text-sm table-fixed border-collapse" style={{ width: tabelaLargura, minWidth: tabelaLargura }}>
                  <colgroup>
                    {colunasAtuais.map(k => <col key={k} style={{ width: getWidth(k), minWidth: getWidth(k) }} />)}
                  </colgroup>
                  <thead className="sticky top-0 bg-white z-20 shadow-sm [&_tr]:border-b">
                    <tr className="bg-white border-b">
                      {colunasAtuais.map((k, i) => (
                        <th key={k} className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white relative group">
                          {k}
                          {i < colunasAtuais.length - 1 && (
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/20 transition-colors flex items-center justify-center"
                              onMouseDown={(e) => handleResizeStart(k, e)}
                              onDoubleClick={(e) => { e.stopPropagation(); handleAutoFitColumn(k); }}
                              title="Arraste para redimensionar. Duplo clique para ajustar ao conteúdo."
                            >
                              <div className="w-0.5 h-6 bg-border group-hover:bg-primary/50 rounded" />
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {dadosResumidos.map((d, i) => (
                      <tr key={`${d.regiao}-${d.estado}-${i}`} className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{d.regiao}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{d.estado}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{d.quantidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : filtroLayout === 'detalhado' ? (
                <table className="caption-bottom text-sm table-fixed border-collapse" style={{ width: tabelaLargura, minWidth: tabelaLargura }}>
                  <colgroup>
                    {colunasAtuais.map(k => <col key={k} style={{ width: getWidth(k), minWidth: getWidth(k) }} />)}
                  </colgroup>
                  <thead className="sticky top-0 bg-white z-20 shadow-sm [&_tr]:border-b">
                    <tr className="bg-white border-b">
                      {colunasAtuais.map((k, i) => (
                        <th key={k} className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white whitespace-nowrap relative group">
                          {k}
                          {i < colunasAtuais.length - 1 && (
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/20 transition-colors flex items-center justify-center"
                              onMouseDown={(e) => handleResizeStart(k, e)}
                              onDoubleClick={(e) => { e.stopPropagation(); handleAutoFitColumn(k); }}
                              title="Arraste para redimensionar. Duplo clique para ajustar ao conteúdo."
                            >
                              <div className="w-0.5 h-6 bg-border group-hover:bg-primary/50 rounded" />
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {contratacoes.map((c) => (
                      <tr key={c.id} className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).regiao || getRegiaoFromUF(c.uf)}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{c.uf || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{c.cd_pn ?? '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{formatarNumAtiva(c.num_ativa || c.n_controle_ativa || null, (c as any).created_at)}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{formatDate((c as any).dt_alterado_ativa)}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A] max-w-xs truncate">{c.titulo || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).municipio || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).unidade || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).un_cod || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A] max-w-xs truncate">{c.orgao_pncp || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).cnpj || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).tipo_licitacao?.sigla || (c as any).modalidade || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A] max-w-[200px] truncate">{(c as any).conteudo || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).complemento || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{formatDate((c as any).dt_criacao)}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{formatDate((c as any).dt_importacao)}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{formatDate(c.dt_publicacao)}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{formatDate((c as any).dt_atualizacao)}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{formatDate((c as any).dt_vigencia_ini)}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{formatDate((c as any).dt_vinculo_ativa)}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).esfera || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).poder || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{c.cd_pn ?? '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 p-0" onClick={() => navigate(`/licitacoes/cadastro?id=${c.id}`)} title="Visualizar"><Eye className="w-3.5 h-3.5" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : filtroLayout === 'unidades' ? (
                <table className="caption-bottom text-sm table-fixed border-collapse" style={{ width: tabelaLargura, minWidth: tabelaLargura }}>
                  <colgroup>
                    {colunasAtuais.map(k => <col key={k} style={{ width: getWidth(k), minWidth: getWidth(k) }} />)}
                  </colgroup>
                  <thead className="sticky top-0 bg-white z-20 shadow-sm [&_tr]:border-b">
                    <tr className="bg-white border-b">
                      {colunasAtuais.map((k, i) => (
                        <th key={k} className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white whitespace-nowrap relative group">
                          {k}
                          {i < colunasAtuais.length - 1 && (
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/20 transition-colors flex items-center justify-center"
                              onMouseDown={(e) => handleResizeStart(k, e)}
                              onDoubleClick={(e) => { e.stopPropagation(); handleAutoFitColumn(k); }}
                              title="Arraste para redimensionar. Duplo clique para ajustar ao conteúdo."
                            >
                              <div className="w-0.5 h-6 bg-border group-hover:bg-primary/50 rounded" />
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {contratacoes.map((c) => (
                      <tr key={c.id} className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{c.uf || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).esfera || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).poder || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A] max-w-xs truncate">{c.orgao_pncp || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).cnpj || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).unidade || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).un_cod || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).municipio || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 p-0" onClick={() => navigate(`/licitacoes/cadastro?id=${c.id}`)} title="Visualizar"><Eye className="w-3.5 h-3.5" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : filtroLayout === 'modalidade' ? (
                <table className="caption-bottom text-sm table-fixed border-collapse" style={{ width: tabelaLargura, minWidth: tabelaLargura }}>
                  <colgroup>
                    {colunasAtuais.map(k => <col key={k} style={{ width: getWidth(k), minWidth: getWidth(k) }} />)}
                  </colgroup>
                  <thead className="sticky top-0 bg-white z-20 shadow-sm [&_tr]:border-b">
                    <tr className="bg-white border-b">
                      {colunasAtuais.map((k, i) => (
                        <th key={k} className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white whitespace-nowrap relative group">
                          {k}
                          {i < colunasAtuais.length - 1 && (
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/20 transition-colors flex items-center justify-center"
                              onMouseDown={(e) => handleResizeStart(k, e)}
                              onDoubleClick={(e) => { e.stopPropagation(); handleAutoFitColumn(k); }}
                              title="Arraste para redimensionar. Duplo clique para ajustar ao conteúdo."
                            >
                              <div className="w-0.5 h-6 bg-border group-hover:bg-primary/50 rounded" />
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {contratacoes.map((c) => (
                      <tr key={c.id} className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).descricao_modalidade || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).modalidade || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{(c as any).modalidade_ativa || (c as any).tipo_licitacao?.descricao || '-'}</td>
                        <td className="p-4 align-middle py-1.5 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 p-0" onClick={() => navigate(`/licitacoes/cadastro?id=${c.id}`)} title="Visualizar"><Eye className="w-3.5 h-3.5" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="caption-bottom text-sm table-fixed border-collapse" style={{ width: tabelaLargura, minWidth: tabelaLargura }}>
                  <colgroup>
                    {colunasAtuais.map(k => <col key={k} style={{ width: getWidth(k), minWidth: getWidth(k) }} />)}
                  </colgroup>
                  <thead className="sticky top-0 bg-white z-20 shadow-sm [&_tr]:border-b">
                    <tr className="bg-white border-b">
                      {colunasAtuais.map((k, i) => (
                        <th key={k} className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white relative group">
                          {k}
                          {i < colunasAtuais.length - 1 && (
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/20 transition-colors flex items-center justify-center"
                              onMouseDown={(e) => handleResizeStart(k, e)}
                              onDoubleClick={(e) => { e.stopPropagation(); handleAutoFitColumn(k); }}
                              title="Arraste para redimensionar. Duplo clique para ajustar ao conteúdo."
                            >
                              <div className="w-0.5 h-6 bg-border group-hover:bg-primary/50 rounded" />
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {dadosResumidos.map((d, i) => (
                      <tr key={`${d.regiao}-${d.estado}-${i}`} className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{d.regiao}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{d.estado}</td>
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{d.quantidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
                      <td className="p-4 align-middle">{(c as any).sequencial_compra && (c as any).ano_compra ? `${(c as any).sequencial_compra}/${(c as any).ano_compra}` : (c.num_licitacao || '-')}</td>
                      <td className="p-4 align-middle">{formatDate(c.dt_encerramento_proposta)}</td>
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