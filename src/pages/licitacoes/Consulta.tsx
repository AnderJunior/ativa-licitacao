import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Eye, Filter, X, Download, ChevronsUpDown, Search } from 'lucide-react';
import { BuscarOrgaoPopup } from '@/components/orgaos/BuscarOrgaoPopup';
import { BuscarTipoPopup } from '@/components/licitacoes/BuscarTipoPopup';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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
  revisao?: boolean | null;
  lida?: boolean | null;
  cadastrado_por?: string | null;
  cadastrado_por_nome?: string | null;
  dt_envio?: string | null;
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

const getCnpj = (c: any): string | null => {
  if (c.cnpj) return c.cnpj;
  if (c.cd_pn) {
    const match = c.cd_pn.match(/^(\d{14})/);
    if (match) return match[1];
  }
  if (c.num_licitacao) {
    const match = c.num_licitacao.match(/^(\d{14})/);
    if (match) return match[1];
  }
  return null;
};

const COLUNAS_POR_LAYOUT: Record<string, string[]> = {
  resumido: ['Região', 'Estado', 'Quantidade'],
  detalhado: ['Região', 'UF', 'NumPncp', 'NumAtiva', 'Alterado', 'Titulo', 'Municipio', 'Unidade', 'UnCod', 'OrgaoPNCP', 'CNPJ', 'Modalidade', 'Conteudo', 'Complemento', 'DtCriacao', 'DtImportacao', 'DtPublicacao', 'DtAtualizacao', 'DtVigencia', 'DtVinculoAtiva', 'Esfera', 'Poder', 'cd_pn', 'Ações'],
  unidades: ['UF', 'Esfera', 'Poder', 'OrgaoPNCP', 'CNPJ', 'Unidade', 'UnCod', 'Municipio', 'OrgaoAtiva', 'Ações'],
  modalidade: ['Id', 'ModalidadePncp', 'TipoLicitacaoAtiva', 'Ações'],
};

const LARGURA_COLUNA: Record<string, number> = {
  Região: 100, Estado: 70, Quantidade: 90, UF: 50, NumPncp: 100, NumAtiva: 100, Alterado: 95,
  Titulo: 200, Municipio: 120, Unidade: 120, UnCod: 80, OrgaoPNCP: 180, CNPJ: 140, Modalidade: 100,
  Conteudo: 250, Complemento: 120, DtCriacao: 95, DtImportacao: 95, DtPublicacao: 95, DtAtualizacao: 95,
  DtVigencia: 95, DtVinculoAtiva: 95, Esfera: 90, Poder: 90, cd_pn: 100, Ações: 60,
  Id: 80, ModalidadePncp: 120, TipoLicitacaoAtiva: 150, OrgaoAtiva: 180,
};

export default function LicitacaoConsulta() {
  const navigate = useNavigate();
  // Filtros - carrega do sessionStorage para persistir entre troca de aba do navegador
  const savedFilters = useMemo(() => {
    try {
      const saved = sessionStorage.getItem('consulta-filtros');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  }, []);

  const [loading, setLoading] = useState(true);
  const [contratacoes, setContratacoes] = useState<Contratacao[]>([]);
  const [activeTab, setActiveTab] = useState(savedFilters?.activeTab || 'todas');
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [filtroUF, setFiltroUF] = useState(savedFilters?.filtroUF || '');
  const [filtroOrgao, setFiltroOrgao] = useState(savedFilters?.filtroOrgao || '');
  const [filtroDataInicio, setFiltroDataInicio] = useState(savedFilters?.filtroDataInicio || '');
  const [filtroDataFim, setFiltroDataFim] = useState(savedFilters?.filtroDataFim || '');
  const [filtroMunicipio, setFiltroMunicipio] = useState(savedFilters?.filtroMunicipio || '');
  const [filtroEsfera, setFiltroEsfera] = useState(savedFilters?.filtroEsfera || '');
  const [filtroPoder, setFiltroPoder] = useState(savedFilters?.filtroPoder || '');
  const [filtroModalidade, setFiltroModalidade] = useState(savedFilters?.filtroModalidade || '');
  const [filtroSituacao, setFiltroSituacao] = useState(savedFilters?.filtroSituacao || '');
  const [filtroNumAtiva, setFiltroNumAtiva] = useState(savedFilters?.filtroNumAtiva || '');
  const [filtroNPncp, setFiltroNPncp] = useState(savedFilters?.filtroNPncp || '');
  const [filtroPeriodoBase, setFiltroPeriodoBase] = useState<'dt_atualizacao' | 'dt_publicacao' | 'dt_criacao' | 'dt_importacao' | 'dt_vigencia_ini' | 'dt_vinculo_ativa'>(savedFilters?.filtroPeriodoBase || 'dt_atualizacao');
  const [filtroSituacaoRadio, setFiltroSituacaoRadio] = useState<'pendentes' | 'vinculadas' | 'excluidas' | 'todas'>(savedFilters?.filtroSituacaoRadio || 'todas');
  const [filtroLayout, setFiltroLayout] = useState<'resumido' | 'detalhado' | 'unidades' | 'modalidade'>(savedFilters?.filtroLayout || 'resumido');
  const [selectedUFs, setSelectedUFs] = useState<Set<string>>(new Set(savedFilters?.selectedUFs || []));
  const [tiposLicitacao, setTiposLicitacao] = useState<{ id: string; sigla: string; descricao: string | null }[]>([]);
  const [filtroUFConferir, setFiltroUFConferir] = useState(savedFilters?.filtroUFConferir || '');

  // Modalidade layout - associação
  const [selectedModalidade, setSelectedModalidade] = useState<string | null>(null);
  const [associarTipoId, setAssociarTipoId] = useState('');
  const [associarPopupOpen, setAssociarPopupOpen] = useState(false);
  const [associarSearchTerm, setAssociarSearchTerm] = useState('');

  // Estados dos dropdowns com pesquisa
  const [esferaPopupOpen, setEsferaPopupOpen] = useState(false);
  const [poderPopupOpen, setPoderPopupOpen] = useState(false);
  const [modalidadePopupOpen, setModalidadePopupOpen] = useState(false);
  const [situacaoPopupOpen, setSituacaoPopupOpen] = useState(false);
  const [esferaSearchTerm, setEsferaSearchTerm] = useState('');
  const [poderSearchTerm, setPoderSearchTerm] = useState('');
  const [modalidadeSearchTerm, setModalidadeSearchTerm] = useState('');
  const [situacaoSearchTerm, setSituacaoSearchTerm] = useState('');

  // Salva filtros no sessionStorage para persistir entre troca de aba do navegador
  useEffect(() => {
    sessionStorage.setItem('consulta-filtros', JSON.stringify({
      activeTab, filtroUF, filtroOrgao, filtroDataInicio, filtroDataFim,
      filtroMunicipio, filtroEsfera, filtroPoder, filtroModalidade, filtroSituacao,
      filtroNumAtiva, filtroNPncp, filtroPeriodoBase, filtroSituacaoRadio,
      filtroLayout, selectedUFs: Array.from(selectedUFs), filtroUFConferir,
    }));
  }, [activeTab, filtroUF, filtroOrgao, filtroDataInicio, filtroDataFim,
    filtroMunicipio, filtroEsfera, filtroPoder, filtroModalidade, filtroSituacao,
    filtroNumAtiva, filtroNPncp, filtroPeriodoBase, filtroSituacaoRadio,
    filtroLayout, selectedUFs]);

  // Estado do painel de detalhes da aba Conferir
  const [selectedConferir, setSelectedConferir] = useState<Contratacao | null>(null);
  const [conferirRamos, setConferirRamos] = useState<string[]>([]);
  const [loadingConferirRamos, setLoadingConferirRamos] = useState(false);
  const [selecaoMultipla, setSelecaoMultipla] = useState(false);
  const [selectedConferirIds, setSelectedConferirIds] = useState<Set<string>>(new Set());

  // Estado da aba Licitações Enviadas
  const [selectedEnviada, setSelectedEnviada] = useState<Contratacao | null>(null);
  const [selecaoMultiplaEnviadas, setSelecaoMultiplaEnviadas] = useState(false);
  const [selectedEnviadasIds, setSelectedEnviadasIds] = useState<Set<string>>(new Set());
  const [filtroEnviadasOpen, setFiltroEnviadasOpen] = useState(false);
  const [filtroEnviadasNControle, setFiltroEnviadasNControle] = useState('');
  const [filtroEnviadasDataInicio, setFiltroEnviadasDataInicio] = useState('');
  const [filtroEnviadasDataFim, setFiltroEnviadasDataFim] = useState('');
  const [filtroEnviadasUF, setFiltroEnviadasUF] = useState('');
  const [filtroEnviadasTipo, setFiltroEnviadasTipo] = useState('');
  const [filtroEnviadasTipoLabel, setFiltroEnviadasTipoLabel] = useState('');
  const [filtroEnviadasOrgao, setFiltroEnviadasOrgao] = useState('');
  const [buscarTipoEnviadasOpen, setBuscarTipoEnviadasOpen] = useState(false);
  const [buscarOrgaoEnviadasOpen, setBuscarOrgaoEnviadasOpen] = useState(false);

  const [enviadasRamos, setEnviadasRamos] = useState<string[]>([]);
  const [loadingEnviadasRamos, setLoadingEnviadasRamos] = useState(false);

  // Estado da aba Unidades (layout unidades)
  const [selectedUnidade, setSelectedUnidade] = useState<Contratacao | null>(null);
  const [vinculosMap, setVinculosMap] = useState<Record<string, { orgao_id: string; orgao_nome: string }>>({});
  const [vinculoOrgaoId, setVinculoOrgaoId] = useState('');
  const [vinculoOrgaoNome, setVinculoOrgaoNome] = useState('');
  const [buscarOrgaoUnidadeOpen, setBuscarOrgaoUnidadeOpen] = useState(false);
  const [viewOrgaoDialogOpen, setViewOrgaoDialogOpen] = useState(false);
  const [orgaoViewData, setOrgaoViewData] = useState<any>(null);
  const [loadingOrgaoView, setLoadingOrgaoView] = useState(false);

  const toggleSelecaoEnviada = (c: Contratacao) => {
    setSelectedEnviadasIds(prev => {
      const next = new Set(prev);
      if (next.has(c.id)) { next.delete(c.id); } else { next.add(c.id); }
      return next;
    });
  };

  const handleSelectEnviada = async (c: Contratacao) => {
    setSelectedEnviada(c);
    setLoadingEnviadasRamos(true);
    try {
      const data = await api.get<any[]>('/api/contratacoes/' + c.id + '/marcacoes');
      setEnviadasRamos((data || []).map((m: any) => m.ramo?.nome).filter(Boolean));
    } catch {
      setEnviadasRamos([]);
    } finally {
      setLoadingEnviadasRamos(false);
    }
  };

  const toggleSelecaoItem = (c: Contratacao) => {
    setSelectedConferirIds(prev => {
      const next = new Set(prev);
      if (next.has(c.id)) { next.delete(c.id); } else { next.add(c.id); }
      return next;
    });
  };

  const handleSelectConferir = async (c: Contratacao) => {
    setSelectedConferir(c);
    setLoadingConferirRamos(true);
    try {
      const data = await api.get<any[]>('/api/contratacoes/' + c.id + '/marcacoes');
      setConferirRamos((data || []).map((m: any) => m.ramo?.nome).filter(Boolean));
    } catch {
      setConferirRamos([]);
    } finally {
      setLoadingConferirRamos(false);
    }
  };

  const loadVinculos = useCallback(async () => {
    try {
      const data = await api.get<any[]>('/api/orgaos-vinculados');
      const map: Record<string, { orgao_id: string; orgao_nome: string }> = {};
      (data || []).forEach((v: any) => { if (v.cnpj) map[v.cnpj] = { orgao_id: v.orgao_id, orgao_nome: v.orgao_nome }; });
      setVinculosMap(map);
    } catch { /* silencia */ }
  }, []);

  const handleSelectUnidade = (c: Contratacao) => {
    setSelectedUnidade(c);
    const cnpj = getCnpj(c);
    const vinculo = cnpj ? vinculosMap[cnpj] : null;
    setVinculoOrgaoId(vinculo?.orgao_id || '');
    setVinculoOrgaoNome(vinculo?.orgao_nome || '');
  };

  const handleAssociarOrgao = async () => {
    if (!selectedUnidade || !vinculoOrgaoId) { toast.error('Selecione um órgão para associar.'); return; }
    const cnpj = getCnpj(selectedUnidade);
    if (!cnpj) { toast.error('Unidade sem CNPJ — não é possível associar.'); return; }
    try {
      await api.post('/api/orgaos-vinculados/upsert', { cnpj, orgao_id: vinculoOrgaoId, orgao_nome: vinculoOrgaoNome });
    } catch (err: any) { toast.error('Erro ao associar: ' + err.message); return; }
    setVinculosMap(prev => ({ ...prev, [cnpj]: { orgao_id: vinculoOrgaoId, orgao_nome: vinculoOrgaoNome } }));
    toast.success('Órgão associado com sucesso!');
  };

  const handleViewOrgao = async (orgaoId: string) => {
    setLoadingOrgaoView(true);
    setViewOrgaoDialogOpen(true);
    let data: any;
    try {
      const orgaos = await api.get<any[]>('/api/orgaos', { search: orgaoId });
      data = (orgaos || []).find((o: any) => o.id === orgaoId) || null;
    } catch { data = null; }
    if (!data) {
      toast.error('Erro ao carregar dados do órgão');
      setViewOrgaoDialogOpen(false);
      setLoadingOrgaoView(false);
      return;
    }
    let cidadeNome = null;
    if (data.uf && data.cidade_ibge) {
      try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${data.cidade_ibge}`);
        if (response.ok) { const municipio = await response.json(); cidadeNome = municipio?.nome || null; }
      } catch (e) { console.error('Erro ao buscar nome da cidade:', e); }
    }
    const grupoNome = data.grupo_nome || null;
    setOrgaoViewData({ ...data, cidade_nome: cidadeNome, grupo_nome: grupoNome });
    setLoadingOrgaoView(false);
  };

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
  }, [activeTab, filtroUFConferir]);

  // Fecha o modal de filtros ao trocar para aba Conferir (filtros só na Lista Completa)
  useEffect(() => {
    if (activeTab !== 'todas') setFilterPopoverOpen(false);
  }, [activeTab]);

  // Carrega vínculos de órgãos ao entrar no layout unidades
  useEffect(() => {
    if (activeTab === 'todas' && filtroLayout === 'unidades') {
      loadVinculos();
      setSelectedUnidade(null);
    }
  }, [activeTab, filtroLayout, loadVinculos]);

  useEffect(() => {
    const loadTipos = async () => {
      try {
        const data = await api.get<{ id: string; sigla: string; descricao: string | null }[]>('/api/tipo-licitacoes');
        if (data) {
          const sorted = [...data].sort((a, b) => (a.sigla || '').localeCompare(b.sigla || ''));
          setTiposLicitacao(sorted);
        }
      } catch { /* silencia */ }
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
      // Filtro por aba
      if (activeTab === 'conferir') {
        // Primeiro busca todos os IDs que têm marcações
        const allMarcacoes = await api.get<any[]>('/api/contratacoes-marcacoes');
        const idsComMarcacoes = [...new Set((allMarcacoes || []).map((m: any) => m.contratacao_id))];

        if (idsComMarcacoes.length === 0) {
          setContratacoes([]);
          setLoading(false);
          return;
        }

        // Busca contratações da aba conferir
        const conferirParams: Record<string, string> = {
          cadastrado: 'true',
          enviada: 'false',
          hide_excluido: 'true',
          ids: idsComMarcacoes.join(','),
          include_tipo: 'true',
          sort: 'dt_publicacao',
          order: 'desc',
        };
        const conferirRaw = await api.get<any[]>('/api/contratacoes', conferirParams);

        // Busca nomes dos usuários que cadastraram
        const userIds = [...new Set((conferirRaw || []).map((c: any) => c.cadastrado_por).filter(Boolean))];
        let profilesMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const profilesData = await api.get<any[]>('/api/profiles', { user_ids: userIds.join(',') });
          (profilesData || []).forEach((p: any) => { profilesMap[p.user_id] = p.full_name; });
        }

        const conferirData = (conferirRaw || []).map((c: any) => ({
          ...c,
          cadastrado_por_nome: c.cadastrado_por ? (profilesMap[c.cadastrado_por] || null) : null,
        }));

        let resultado = conferirData;
        if (filtroUFConferir) resultado = resultado.filter((c: any) => c.uf === filtroUFConferir);

        setContratacoes(resultado);
        setLoading(false);
        return;
      } else if (activeTab === 'enviadas') {
        const enviadasParams: Record<string, string> = {
          enviada: 'true',
          hide_excluido: 'true',
          include_tipo: 'true',
          sort: 'dt_envio',
          order: 'desc',
        };
        const enviadasRaw = await api.get<any[]>('/api/contratacoes', enviadasParams);

        // Busca nomes dos usuários
        const userIdsEnv = [...new Set((enviadasRaw || []).map((c: any) => c.cadastrado_por).filter(Boolean))];
        let profilesMapEnv: Record<string, string> = {};
        if (userIdsEnv.length > 0) {
          const profData = await api.get<any[]>('/api/profiles', { user_ids: userIdsEnv.join(',') });
          (profData || []).forEach((p: any) => { profilesMapEnv[p.user_id] = p.full_name; });
        }

        let enviadasData = (enviadasRaw || []).map((c: any) => ({
          ...c,
          cadastrado_por_nome: c.cadastrado_por ? (profilesMapEnv[c.cadastrado_por] || null) : null,
        }));

        if (filtroEnviadasNControle) enviadasData = enviadasData.filter((c: any) => c.num_ativa?.toLowerCase().includes(filtroEnviadasNControle.toLowerCase()));
        if (filtroEnviadasDataInicio) enviadasData = enviadasData.filter((c: any) => c.dt_envio && c.dt_envio >= filtroEnviadasDataInicio);
        if (filtroEnviadasDataFim) enviadasData = enviadasData.filter((c: any) => c.dt_envio && c.dt_envio <= filtroEnviadasDataFim);
        if (filtroEnviadasUF) enviadasData = enviadasData.filter((c: any) => c.uf === filtroEnviadasUF);
        if (filtroEnviadasTipo) enviadasData = enviadasData.filter((c: any) => c.descricao_modalidade === filtroEnviadasTipo);
        if (filtroEnviadasOrgao) enviadasData = enviadasData.filter((c: any) => c.orgao_pncp?.toLowerCase().includes(filtroEnviadasOrgao.toLowerCase()));

        setContratacoes(enviadasData);
        setLoading(false);
        return;
      }

      // Lista Completa — build params
      const params: Record<string, string> = {
        sort: 'dt_publicacao',
        order: 'desc',
      };

      if (selectedUFs.size > 0) params.ufs = Array.from(selectedUFs).join(',');
      else if (filtroUF) params.ufs = filtroUF;
      if (filtroOrgao) params.orgao_pncp = filtroOrgao;
      const campoData = filtroPeriodoBase;
      if (filtroDataInicio) params[campoData + '_gte'] = filtroDataInicio;
      if (filtroDataFim) params[campoData + '_lte'] = filtroDataFim;
      if (filtroMunicipio) params.municipio = filtroMunicipio;
      if (filtroEsfera) params.esfera = filtroEsfera;
      if (filtroPoder) params.poder = filtroPoder;
      if (filtroModalidade) params.descricao_modalidade = filtroModalidade;
      if (filtroNumAtiva) params.num_ativa = filtroNumAtiva;
      if (filtroNPncp) params.cd_pn = filtroNPncp;

      // Situação (pendentes/vinculadas/excluídas) - apenas na Lista Completa
      if (activeTab === 'todas') {
        if (filtroSituacaoRadio === 'pendentes') {
          params.cadastrado = 'false';
          params.hide_excluido = 'true';
        } else if (filtroSituacaoRadio === 'vinculadas') {
          params.cadastrado = 'true';
          params.hide_excluido = 'true';
        } else if (filtroSituacaoRadio === 'excluidas') {
          params.excluido = 'true';
        } else {
          // Todas: não mostra excluídas por padrão
          params.hide_excluido = 'true';
        }
      }

      const data = await api.get<Contratacao[]>('/api/contratacoes', params);

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
        const tipoIds = [...new Set(data
          .map(c => (c as any).descricao_modalidade)
          .filter(id => id) as string[])];

        if (tipoIds.length > 0) {
          try {
            const tipos = await api.post<{ id: string; sigla: string; descricao: string | null }[]>('/api/tipo-licitacoes/by-ids', { ids: tipoIds });

            if (tipos) {
              const tiposMap = new Map(tipos.map(t => [t.id, t]));
              data.forEach(c => {
                const tipoId = (c as any).descricao_modalidade;
                if (tipoId) {
                  (c as any).tipo_licitacao = tiposMap.get(tipoId) || null;
                }
              });
            }
          } catch { /* tipos lookup failed, continue without */ }
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
    setFiltroUFConferir('');
    sessionStorage.removeItem('consulta-filtros');
  };

  const applyFilters = () => {
    loadContratacoes();
  };

  // Modalidades únicas para o layout modalidade
  const modalidadesUnicas = useMemo(() => {
    const map = new Map<string, { modalidade: string; descricao_modalidade: string | null; tipo_licitacao: { sigla: string; descricao: string | null } | null }>();
    contratacoes.forEach(c => {
      const mod = (c as any).modalidade as string | null;
      if (mod && !map.has(mod)) {
        map.set(mod, {
          modalidade: mod,
          descricao_modalidade: (c as any).descricao_modalidade || null,
          tipo_licitacao: (c as any).tipo_licitacao || null,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.modalidade.localeCompare(b.modalidade));
  }, [contratacoes]);

  // Associar modalidade PNCP a um tipo de licitação do sistema
  const handleAssociarModalidade = async () => {
    if (!selectedModalidade || !associarTipoId) {
      toast.error('Selecione uma modalidade e um tipo de licitação');
      return;
    }
    // Atualiza todas contratacoes com essa modalidade
    const idsParaAtualizar = contratacoes
      .filter(c => (c as any).modalidade === selectedModalidade)
      .map(c => c.id);
    if (idsParaAtualizar.length === 0) {
      toast.error('Nenhuma contratação encontrada com essa modalidade');
      return;
    }
    try {
      await api.patch('/api/contratacoes/batch', { ids: idsParaAtualizar, data: { descricao_modalidade: associarTipoId } });
    } catch (err: any) {
      toast.error('Erro ao associar: ' + err.message);
      return;
    }
    toast.success('Modalidade associada com sucesso!');
    setAssociarTipoId('');
    setSelectedModalidade(null);
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
                onClick={() => setActiveTab('enviadas')}
                className={cn(
                  "px-4 py-2 rounded-[50px] text-[12px] font-medium transition-colors cursor-pointer",
                  activeTab === 'enviadas'
                    ? "bg-green-700 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                )}
              >
                Licitações Enviadas
              </button>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 items-center">
            {activeTab === 'conferir' && (
              <div className="flex items-center gap-2">
                {/* Checkbox seleção múltipla */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selecaoMultipla}
                    className="w-4 h-4 accent-[#02572E]"
                    onChange={(e) => {
                      setSelecaoMultipla(e.target.checked);
                      setSelectedConferirIds(new Set());
                      setSelectedConferir(null);
                    }}
                  />
                  <span className="text-xs text-muted-foreground">Seleção Múltipla</span>
                </label>

                <span className="text-xs text-muted-foreground shrink-0">UF</span>
                <select
                  value={filtroUFConferir}
                  onChange={(e) => setFiltroUFConferir(e.target.value)}
                  className="h-8 text-sm border border-border rounded-md px-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Todas</option>
                  {REGIOES_E_UFS.flatMap(r => r.ufs).sort().map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>

                {/* Botões para seleção múltipla */}
                {selecaoMultipla && selectedConferirIds.size > 0 && (() => {
                  const selecionadas = contratacoes.filter(x => selectedConferirIds.has(x.id));
                  const todasLidas = selecionadas.every(x => x.lida);
                  const novoValorLida = !todasLidas;
                  return (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const ids = Array.from(selectedConferirIds);
                        await api.patch('/api/contratacoes/batch', { ids, data: { lida: novoValorLida } });
                        setContratacoes(prev => prev.map(x => selectedConferirIds.has(x.id) ? { ...x, lida: novoValorLida } : x));
                        setSelectedConferirIds(new Set());
                        toast.success(novoValorLida ? `${ids.length} licitação(ões) marcadas como lidas!` : `${ids.length} licitação(ões) desmarcadas!`);
                      }}
                    >
                      {todasLidas ? `Remover de Lida (${selectedConferirIds.size})` : `Marcar como Lida (${selectedConferirIds.size})`}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white">
                          Excluir ({selectedConferirIds.size})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Devolver licitações para pendentes?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {selectedConferirIds.size} licitação(ões) serão devolvidas para o status pendente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600 text-white"
                            onClick={async () => {
                              const ids = Array.from(selectedConferirIds);
                              await api.patch('/api/contratacoes/batch', { ids, data: { cadastrado: false } });
                              setContratacoes(prev => prev.filter(x => !selectedConferirIds.has(x.id)));
                              setSelectedConferirIds(new Set());
                              toast.success(`${ids.length} licitação(ões) devolvidas para pendentes!`);
                            }}
                          >
                            Confirmar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                  );
                })()}

                {/* Botões para seleção simples */}
                {!selecaoMultipla && selectedConferir && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const novoValor = !selectedConferir.lida;
                        await api.patch('/api/contratacoes/' + selectedConferir.id, { lida: novoValor });
                        setContratacoes(prev => prev.map(x => x.id === selectedConferir.id ? { ...x, lida: novoValor } : x));
                        setSelectedConferir(prev => prev ? { ...prev, lida: novoValor } : prev);
                      }}
                    >
                      {selectedConferir.lida ? 'Desmarcar Lida' : 'Marcar como Lida'}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#02572E] text-white hover:bg-[#024a27]"
                      onClick={() => navigate(`/licitacoes/cadastro?id=${selectedConferir.id}`)}
                    >
                      Abrir
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white">
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Devolver licitação para pendentes?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A licitação "<strong>{selectedConferir.orgao_pncp || selectedConferir.num_ativa || ''}</strong>" será devolvida para o status pendente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600 text-white"
                            onClick={async () => {
                              await api.patch('/api/contratacoes/' + selectedConferir.id, { cadastrado: false });
                              setContratacoes(prev => prev.filter(x => x.id !== selectedConferir.id));
                              setSelectedConferir(null);
                              setConferirRamos([]);
                              toast.success('Licitação devolvida para pendentes!');
                            }}
                          >
                            Confirmar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            )}
            {activeTab === 'enviadas' && (
              <div className="flex items-center gap-2">
                {/* Botões para seleção simples */}
                {selectedEnviada && (
                  <>
                    <Button
                      size="sm"
                      className="bg-[#02572E] text-white hover:bg-[#024a27]"
                      onClick={() => navigate(`/licitacoes/cadastro?id=${selectedEnviada.id}`)}
                    >
                      Abrir
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white">
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir licitação?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A licitação "<strong>{selectedEnviada.orgao_pncp || selectedEnviada.num_ativa || ''}</strong>" será excluída.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600 text-white"
                            onClick={async () => {
                              await api.patch('/api/contratacoes/' + selectedEnviada.id, { excluido: true });
                              setContratacoes(prev => prev.filter(x => x.id !== selectedEnviada.id));
                              setSelectedEnviada(null);
                              setEnviadasRamos([]);
                              toast.success('Licitação excluída!');
                            }}
                          >
                            Confirmar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}

                {/* Botão Filtros */}
                <Popover open={filtroEnviadasOpen} onOpenChange={(open) => {
                  // Não fecha o popover de filtros quando um dos popups de busca está aberto
                  if (!open && (buscarTipoEnviadasOpen || buscarOrgaoEnviadasOpen)) return;
                  setFiltroEnviadasOpen(open);
                }}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="w-4 h-4 mr-2" />
                      Filtros
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[860px] max-w-[95vw] p-4" align="end" side="bottom" sideOffset={8}>
                    <div className="space-y-3">
                      {/* Linha 1: N. Controle Ativa | Dt. Envio Início | Dt. Envio Fim | Tipo */}
                      <div className="grid grid-cols-[160px_1fr_1fr_1fr] gap-3 items-end">
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs font-medium">N. Controle Ativa</Label>
                          <Input
                            placeholder=""
                            value={filtroEnviadasNControle}
                            onChange={(e) => setFiltroEnviadasNControle(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs font-medium">Dt. Envio Início</Label>
                          <Input
                            type="datetime-local"
                            value={filtroEnviadasDataInicio}
                            onChange={(e) => setFiltroEnviadasDataInicio(e.target.value)}
                            className="h-8 text-sm w-full"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs font-medium">Dt. Envio Fim</Label>
                          <Input
                            type="datetime-local"
                            value={filtroEnviadasDataFim}
                            onChange={(e) => setFiltroEnviadasDataFim(e.target.value)}
                            className="h-8 text-sm w-full"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs font-medium">Tipo</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              readOnly
                              placeholder=""
                              value={filtroEnviadasTipoLabel}
                              className="h-8 text-sm flex-1 cursor-default bg-white"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="rounded-full w-7 h-7 shrink-0 bg-gray-400 hover:bg-gray-500 text-white"
                              onClick={() => setBuscarTipoEnviadasOpen(true)}
                            >
                              <Search className="h-3.5 w-3.5" />
                            </Button>
                            {filtroEnviadasTipo && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="w-6 h-6 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={() => { setFiltroEnviadasTipo(''); setFiltroEnviadasTipoLabel(''); }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Linha 2: UF | Órgão */}
                      <div className="flex gap-3 items-end">
                        <div className="flex flex-col gap-1 w-[70px]">
                          <Label className="text-xs font-medium">UF</Label>
                          <select
                            value={filtroEnviadasUF}
                            onChange={(e) => setFiltroEnviadasUF(e.target.value)}
                            className="h-8 text-sm border border-border rounded-md px-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value=""></option>
                            {UF_LIST.sort().map(uf => <option key={uf} value={uf}>{uf}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <Label className="text-xs font-medium">Órgão</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              placeholder=""
                              value={filtroEnviadasOrgao}
                              onChange={(e) => setFiltroEnviadasOrgao(e.target.value)}
                              className="h-8 text-sm flex-1"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="rounded-full w-7 h-7 shrink-0 bg-gray-400 hover:bg-gray-500 text-white"
                              onClick={() => setBuscarOrgaoEnviadasOpen(true)}
                            >
                              <Search className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      {/* Botões */}
                      <div className="flex gap-2 pt-2 border-t border-border">
                        <Button size="sm" onClick={() => { applyFilters(); setFiltroEnviadasOpen(false); }}>
                          Pesquisar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                          setFiltroEnviadasNControle('');
                          setFiltroEnviadasDataInicio('');
                          setFiltroEnviadasDataFim('');
                          setFiltroEnviadasUF('');
                          setFiltroEnviadasTipo('');
                          setFiltroEnviadasTipoLabel('');
                          setFiltroEnviadasOrgao('');
                        }}>
                          <X className="w-4 h-4 mr-1" />
                          Limpar
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            {activeTab !== 'conferir' && activeTab !== 'enviadas' && (
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            )}
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
        <div className={cn("flex-1 min-h-0 min-w-0 flex flex-col", (activeTab === 'conferir' || activeTab === 'enviadas' || (activeTab === 'todas' && filtroLayout === 'unidades' && !!selectedUnidade)) && "overflow-hidden")}>
        <div ref={tableContainerRef} className={cn("min-w-0 overflow-auto", activeTab === 'conferir' ? "flex-1 min-h-0" : "flex-1 min-h-0", resizingColumn && "select-none")}>
          {loading ? (
            <div className="flex items-center justify-center h-64 flex-1">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : contratacoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex-1">
              Nenhuma licitação encontrada
            </div>
          ) : activeTab === 'conferir' ? (
            <table className="w-full caption-bottom text-sm border-collapse">
              <thead className="sticky top-0 bg-white z-20 shadow-sm">
                <tr className="border-b bg-white">
                  {['UF', 'Órgão', 'Tipo', 'Edital', 'Dt. Licitação', 'N. Controle', 'Rev', 'Usuário', 'Lida?'].map(col => (
                    <th key={col} className="h-10 px-3 text-left align-middle text-xs font-bold text-[#1A1A1A] bg-white whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contratacoes.map((c) => {
                  const isSelected = selecaoMultipla ? selectedConferirIds.has(c.id) : selectedConferir?.id === c.id;
                  return (
                  <tr
                    key={c.id}
                    className={cn("border-b transition-colors cursor-pointer", isSelected ? "bg-[#02572E] text-white" : c.lida ? "bg-yellow-200 hover:bg-yellow-300 text-[#1A1A1A]" : "hover:bg-muted/50")}
                    onClick={() => selecaoMultipla ? toggleSelecaoItem(c) : handleSelectConferir(c)}
                  >
                    <td className="px-3 py-1.5 text-sm whitespace-nowrap">{c.uf || '-'}</td>
                    <td className="px-3 py-1.5 text-sm max-w-[200px] truncate">{c.orgao_pncp || '-'}</td>
                    <td className="px-3 py-1.5 text-sm whitespace-nowrap">{c.tipo_licitacao?.sigla || c.modalidade || '-'}</td>
                    <td className="px-3 py-1.5 text-sm whitespace-nowrap">
                      {(() => {
                        const titulo = ((c as any).titulo || '').replace(/edital\s+n[ºo°]?\s*/i, '').trim();
                        const ano = (c as any).ano_compra;
                        return titulo && ano ? `${titulo}/${ano}` : titulo || c.num_licitacao || '-';
                      })()}
                    </td>
                    <td className="px-3 py-1.5 text-sm whitespace-nowrap">{formatDate(c.dt_publicacao)}</td>
                    <td className="px-3 py-1.5 text-sm whitespace-nowrap">{formatarNumAtiva(c.num_ativa || c.n_controle_ativa || null, (c as any).created_at)}</td>
                    <td className="px-3 py-1.5 text-sm text-center">
                      {c.revisao ? <span className={isSelected ? 'text-white font-bold' : 'text-green-600 font-bold'}>S</span> : <span className="opacity-40">N</span>}
                    </td>
                    <td className="px-3 py-1.5 text-sm whitespace-nowrap">{(c as any).cadastrado_por_nome || '-'}</td>
                    <td className="px-3 py-1.5 text-sm text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!c.lida}
                        className="w-4 h-4 cursor-pointer accent-[#02572E]"
                        onChange={async (e) => {
                          const novoValor = e.target.checked;
                          await api.patch('/api/contratacoes/' + c.id, { lida: novoValor });
                          setContratacoes(prev => prev.map(x => x.id === c.id ? { ...x, lida: novoValor } : x));
                        }}
                      />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          ) : activeTab === 'todas' ? (
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
                        <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{getCnpj(c) || '-'}</td>
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
                    {contratacoes.map((c) => {
                      const cnpj = getCnpj(c);
                      const orgaoAtiva = cnpj ? vinculosMap[cnpj]?.orgao_nome : undefined;
                      const isSelected = selectedUnidade?.id === c.id;
                      return (
                        <tr
                          key={c.id}
                          className={cn("border-b transition-colors cursor-pointer", isSelected ? "bg-[#02572E] text-white" : "hover:bg-muted/50")}
                          onClick={() => handleSelectUnidade(c)}
                        >
                          <td className="p-4 align-middle py-1.5 text-sm">{c.uf || '-'}</td>
                          <td className="p-4 align-middle py-1.5 text-sm">{(c as any).esfera || '-'}</td>
                          <td className="p-4 align-middle py-1.5 text-sm">{(c as any).poder || '-'}</td>
                          <td className="p-4 align-middle py-1.5 text-sm max-w-xs truncate">{c.orgao_pncp || '-'}</td>
                          <td className="p-4 align-middle py-1.5 text-sm">{cnpj || '-'}</td>
                          <td className="p-4 align-middle py-1.5 text-sm">{(c as any).unidade || '-'}</td>
                          <td className="p-4 align-middle py-1.5 text-sm">{(c as any).un_cod || '-'}</td>
                          <td className="p-4 align-middle py-1.5 text-sm">{(c as any).municipio || '-'}</td>
                          <td className={cn("p-4 align-middle py-1.5 text-sm font-medium", orgaoAtiva ? (isSelected ? 'text-green-200' : 'text-green-700') : 'opacity-40')}>
                            {orgaoAtiva || '-'}
                          </td>
                          <td className="p-4 align-middle py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 p-0" onClick={() => navigate(`/licitacoes/cadastro?id=${c.id}`)} title="Visualizar"><Eye className="w-3.5 h-3.5" /></Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : filtroLayout === 'modalidade' ? (
                <div className="flex flex-col h-full min-h-0">
                  {/* Tabela de modalidades únicas */}
                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="caption-bottom text-sm border-collapse w-full">
                      <thead className="sticky top-0 bg-white z-20 shadow-sm [&_tr]:border-b">
                        <tr className="bg-white border-b">
                          <th className="h-10 px-4 text-left align-middle font-bold text-xs text-[#1A1A1A] bg-white w-[60px]">Id</th>
                          <th className="h-10 px-4 text-left align-middle font-bold text-xs text-[#1A1A1A] bg-white">ModalidadePncp</th>
                          <th className="h-10 px-4 text-left align-middle font-bold text-xs text-[#1A1A1A] bg-white">TipoLicitacaoAtiva</th>
                        </tr>
                      </thead>
                      <tbody className="[&_tr:last-child]:border-0">
                        {modalidadesUnicas.map((m, idx) => {
                          const isSelected = selectedModalidade === m.modalidade;
                          const tipoAssociado = m.tipo_licitacao ? `${m.tipo_licitacao.sigla} ${m.tipo_licitacao.descricao || ''}`.trim() : '';
                          return (
                            <tr
                              key={m.modalidade}
                              className={cn("border-b transition-colors cursor-pointer", isSelected ? "bg-blue-600 text-white" : "hover:bg-muted/50")}
                              onClick={() => {
                                setSelectedModalidade(m.modalidade);
                                setAssociarTipoId(m.descricao_modalidade || '');
                              }}
                            >
                              <td className="px-4 py-1.5 text-sm">{idx + 1}</td>
                              <td className="px-4 py-1.5 text-sm">{m.modalidade}</td>
                              <td className="px-4 py-1.5 text-sm">{tipoAssociado || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Painel de associação */}
                  {selectedModalidade && (
                    <div className="flex-shrink-0 border-t pt-3 mt-2 flex items-end gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">IdModalidade</Label>
                        <Input value={modalidadesUnicas.find(m => m.modalidade === selectedModalidade)?.descricao_modalidade || '-'} disabled className="h-8 text-sm w-[80px]" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <Label className="text-xs font-medium">Descrição da Modalidade</Label>
                        <Input value={selectedModalidade} disabled className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <Popover open={associarPopupOpen} onOpenChange={(open) => { setAssociarPopupOpen(open); if (!open) setAssociarSearchTerm(''); }}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="h-8 w-full text-sm justify-between font-normal">
                              <span className="truncate">
                                {associarTipoId
                                  ? (() => { const t = tiposLicitacao.find(t => t.id === associarTipoId); return t ? `${t.sigla} ${t.descricao || ''}`.trim() : 'Selecionar...'; })()
                                  : 'Selecionar tipo...'}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start" side="top" avoidCollisions>
                            <Command>
                              <CommandInput placeholder="Pesquisar tipo..." value={associarSearchTerm} onValueChange={setAssociarSearchTerm} />
                              <CommandList>
                                <CommandEmpty>Nenhum tipo encontrado.</CommandEmpty>
                                <CommandGroup className="p-0 max-h-[250px] overflow-y-auto">
                                  {tiposLicitacao.map((t) => {
                                    const label = `${t.sigla} ${t.descricao || ''}`.trim();
                                    return (
                                      <CommandItem key={t.id} value={label} onSelect={() => { setAssociarTipoId(t.id); setAssociarPopupOpen(false); setAssociarSearchTerm(''); }} className={cn("cursor-pointer", associarTipoId === t.id && "bg-accent")}>
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
                      <Button size="sm" className="h-8 bg-[#02572E] text-white hover:bg-[#024a27] whitespace-nowrap" onClick={handleAssociarModalidade}>
                        Associar Modalidade?
                      </Button>
                    </div>
                  )}
                </div>
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
          ) : activeTab === 'enviadas' ? (
            <table className="w-full caption-bottom text-sm border-collapse">
              <thead className="sticky top-0 bg-white z-20 shadow-sm">
                <tr className="border-b bg-white">
                  {['N. Controle', 'UF', 'Rev', 'Tipo', 'Edital', 'Órgão', 'Dt. Licitação', 'Dt. Envio'].map(col => (
                    <th key={col} className="h-10 px-3 text-left align-middle text-xs font-bold text-[#1A1A1A] bg-white whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contratacoes.map((c) => {
                  const isSelected = selectedEnviada?.id === c.id;
                  return (
                    <tr
                      key={c.id}
                      className={cn("border-b transition-colors cursor-pointer", isSelected ? "bg-[#02572E] text-white" : "hover:bg-muted/50")}
                      onClick={() => handleSelectEnviada(c)}
                    >
                      <td className="px-3 py-1.5 text-sm whitespace-nowrap">{formatarNumAtiva(c.num_ativa || c.n_controle_ativa || null, (c as any).created_at)}</td>
                      <td className="px-3 py-1.5 text-sm whitespace-nowrap">{c.uf || '-'}</td>
                      <td className="px-3 py-1.5 text-sm text-center">
                        {c.revisao ? <span className={isSelected ? 'text-white font-bold' : 'text-green-600 font-bold'}>S</span> : <span className="opacity-40">N</span>}
                      </td>
                      <td className="px-3 py-1.5 text-sm whitespace-nowrap">{c.tipo_licitacao?.sigla || c.modalidade || '-'}</td>
                      <td className="px-3 py-1.5 text-sm whitespace-nowrap">
                        {(() => {
                          const titulo = ((c as any).titulo || '').replace(/edital\s+n[ºo°]?\s*/i, '').trim();
                          const ano = (c as any).ano_compra;
                          return titulo && ano ? `${titulo}/${ano}` : titulo || c.num_licitacao || '-';
                        })()}
                      </td>
                      <td className="px-3 py-1.5 text-sm max-w-[200px] truncate">{c.orgao_pncp || '-'}</td>
                      <td className="px-3 py-1.5 text-sm whitespace-nowrap">{formatDate(c.dt_publicacao)}</td>
                      <td className="px-3 py-1.5 text-sm whitespace-nowrap">{formatDate((c as any).dt_envio)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </div>

        {/* Painel de detalhe - aba Conferir */}
        {activeTab === 'conferir' && selectedConferir && (
          <div className="h-48 flex-shrink-0 border-t border-border flex gap-0 bg-white">
            {/* Conteúdo */}
            <div className="flex-1 p-3 overflow-auto text-xs text-[#1A1A1A] leading-relaxed whitespace-pre-wrap border-r border-border">
              {(selectedConferir as any).conteudo || (selectedConferir as any).textos_cadastro_manual || 'Sem conteúdo'}
            </div>
            {/* Atividades */}
            <div className="w-56 flex-shrink-0 p-3 overflow-auto">
              <p className="text-xs font-semibold text-[#1A1A1A] mb-2">Atividades ({conferirRamos.length})</p>
              {loadingConferirRamos ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : conferirRamos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma atividade</p>
              ) : (
                <ul className="space-y-1">
                  {conferirRamos.map((nome, i) => (
                    <li key={i} className="text-xs text-[#1A1A1A]">• {nome}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Painel de associação - layout Unidades */}
        {activeTab === 'todas' && filtroLayout === 'unidades' && selectedUnidade && (
          <div className="h-40 flex-shrink-0 border-t border-border flex gap-0 bg-white">
            {/* Info da unidade PNCP */}
            <div className="w-72 flex-shrink-0 p-3 overflow-auto border-r border-border text-xs text-[#1A1A1A] space-y-0.5">
              <p className="font-semibold text-[11px] text-muted-foreground mb-1">UNIDADE PNCP</p>
              {(selectedUnidade as any).un_cod && <p><span className="font-medium">IdUnidade:</span> {(selectedUnidade as any).un_cod}</p>}
              {getCnpj(selectedUnidade) && <p><span className="font-medium">CNPJ:</span> {getCnpj(selectedUnidade)}</p>}
              {(selectedUnidade as any).esfera && <p><span className="font-medium">Esfera:</span> {(selectedUnidade as any).esfera}</p>}
              {(selectedUnidade as any).poder && <p><span className="font-medium">Poder:</span> {(selectedUnidade as any).poder}</p>}
              {selectedUnidade.orgao_pncp && <p><span className="font-medium">Órgão:</span> {selectedUnidade.orgao_pncp}</p>}
              {(selectedUnidade as any).unidade && <p><span className="font-medium">Unidade:</span> {(selectedUnidade as any).unidade}</p>}
              {selectedUnidade.uf && <p><span className="font-medium">UF:</span> {selectedUnidade.uf}</p>}
              {(selectedUnidade as any).municipio && <p><span className="font-medium">Município:</span> {(selectedUnidade as any).municipio}</p>}
            </div>

            {/* Área de associação */}
            <div className="flex-1 p-4 flex flex-col gap-3 overflow-auto">
              <p className="text-xs font-semibold text-[#1A1A1A]">Associar a Órgão Ativa</p>
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <Label className="text-xs text-muted-foreground">Órgão</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="Digite o nome ou Tab para buscar..."
                      value={vinculoOrgaoNome}
                      onChange={(e) => {
                        setVinculoOrgaoNome(e.target.value);
                        setVinculoOrgaoId(''); // limpa seleção ao digitar
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === 'Tab' && vinculoOrgaoNome.trim()) {
                          e.preventDefault();
                          try {
                            const data = await api.get<any[]>('/api/orgaos', { search: vinculoOrgaoNome.trim() });
                            if (data && data.length === 1) {
                              setVinculoOrgaoId(data[0].id);
                              setVinculoOrgaoNome(data[0].nome_orgao);
                            } else {
                              // não encontrou exatamente 1 — abre pesquisa avançada
                              setBuscarOrgaoUnidadeOpen(true);
                            }
                          } catch {
                            setBuscarOrgaoUnidadeOpen(true);
                          }
                        }
                      }}
                      className="h-8 text-sm flex-1 bg-white"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="rounded-full w-8 h-8 shrink-0 bg-gray-400 hover:bg-gray-500 text-white"
                      onClick={() => setBuscarOrgaoUnidadeOpen(true)}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    {vinculoOrgaoId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => { setVinculoOrgaoId(''); setVinculoOrgaoNome(''); }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-[#02572E] text-white hover:bg-[#024a27]"
                  onClick={handleAssociarOrgao}
                  disabled={!vinculoOrgaoId}
                >
                  Associar
                </Button>
                {vinculoOrgaoId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewOrgao(vinculoOrgaoId)}
                  >
                    Abrir Órgão
                  </Button>
                )}
              </div>
              {/* Mostra associação existente */}
              {getCnpj(selectedUnidade) && vinculosMap[getCnpj(selectedUnidade)] && (
                <p className="text-xs text-green-700 font-medium">
                  ✓ Atualmente associado a: <strong>{vinculosMap[getCnpj(selectedUnidade)].orgao_nome}</strong>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Painel de detalhe - aba Licitações Enviadas */}
        {activeTab === 'enviadas' && selectedEnviada && (
          <div className="h-48 flex-shrink-0 border-t border-border flex gap-0 bg-white">
            {/* Conteúdo */}
            <div className="flex-1 p-3 overflow-auto text-xs text-[#1A1A1A] leading-relaxed whitespace-pre-wrap border-r border-border">
              {(selectedEnviada as any).conteudo || (selectedEnviada as any).textos_cadastro_manual || 'Sem conteúdo'}
            </div>
            {/* Atividades */}
            <div className="w-56 flex-shrink-0 p-3 overflow-auto">
              <p className="text-xs font-semibold text-[#1A1A1A] mb-2">Atividades ({enviadasRamos.length})</p>
              {loadingEnviadasRamos ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : enviadasRamos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma atividade</p>
              ) : (
                <ul className="space-y-1">
                  {enviadasRamos.map((nome, i) => (
                    <li key={i} className="text-xs text-[#1A1A1A]">• {nome}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
      {/* Dialog de Visualização de Órgão */}
      <Dialog open={viewOrgaoDialogOpen} onOpenChange={setViewOrgaoDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#262626]">
              Visualização de Órgãos
            </DialogTitle>
          </DialogHeader>
          {loadingOrgaoView ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : orgaoViewData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-6 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Nome do Órgão</Label>
                  <Input value={orgaoViewData.nome_orgao || ''} className="h-9 text-[#262626]" disabled />
                </div>
                <div className="col-span-3 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Compras NET</Label>
                  <Input value={orgaoViewData.compras_net || ''} className="h-9 text-[#262626]" disabled />
                </div>
                <div className="col-span-3 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Compras MG</Label>
                  <Input value={orgaoViewData.compras_mg || ''} className="h-9 text-[#262626]" disabled />
                </div>
              </div>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-6 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Cidade IBGE</Label>
                  <Input value={orgaoViewData.uf && orgaoViewData.cidade_nome ? `${orgaoViewData.uf} - ${orgaoViewData.cidade_nome}` : orgaoViewData.uf || orgaoViewData.cidade_nome || ''} className="h-9 text-[#262626]" disabled />
                </div>
                <div className="col-span-6 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Grupos de Orgãos</Label>
                  <Input value={orgaoViewData.grupo_nome || ''} placeholder="Nenhum grupo selecionado" className="h-9 text-[#262626]" disabled />
                </div>
              </div>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-7 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Endereço</Label>
                  <Input value={orgaoViewData.endereco || ''} className="h-9 text-[#262626]" disabled />
                </div>
                <div className="col-span-5 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Telefone</Label>
                  <Input value={orgaoViewData.telefone || ''} className="h-9 text-[#262626]" disabled />
                </div>
              </div>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-4 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Orgão</Label>
                  <Textarea value={orgaoViewData.observacoes || ''} className="resize-none h-[120px] text-[14px] text-[#262626] bg-gray-50" disabled />
                </div>
                <div className="col-span-3 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">PNCP</Label>
                  <Textarea value={orgaoViewData.obs_pncp || ''} className="resize-none h-[120px] text-[14px] text-[#262626] bg-gray-50" disabled />
                </div>
                <div className="col-span-5 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">E-mails</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 h-[120px] overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {(orgaoViewData.emails || []).length > 0 ? (
                        orgaoViewData.emails.map((email: string, index: number) => (
                          <span key={index} className="inline-flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs">{email}</span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Nenhum e-mail cadastrado</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-[14px] font-normal text-[#262626]">Sites</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 mt-1">
                  <div className="flex flex-wrap gap-2">
                    {(orgaoViewData.sites || []).length > 0 ? (
                      orgaoViewData.sites.map((site: string, index: number) => (
                        <span key={index} className="inline-flex items-center gap-1 bg-muted px-3 py-1.5 rounded text-sm">
                          <a href={site} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{site}</a>
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Nenhum site cadastrado</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <BuscarOrgaoPopup
        open={buscarOrgaoUnidadeOpen}
        onOpenChange={setBuscarOrgaoUnidadeOpen}
        onOrgaoSelecionado={(orgao) => {
          setVinculoOrgaoId(orgao.id);
          setVinculoOrgaoNome(orgao.nome_orgao);
          setBuscarOrgaoUnidadeOpen(false);
        }}
        termoInicial={vinculoOrgaoNome}
      />

      <BuscarTipoPopup
        open={buscarTipoEnviadasOpen}
        onOpenChange={setBuscarTipoEnviadasOpen}
        onTipoSelecionado={(tipo) => {
          setFiltroEnviadasTipo(tipo.id);
          setFiltroEnviadasTipoLabel(tipo.sigla + (tipo.descricao ? ` - ${tipo.descricao}` : ''));
          setBuscarTipoEnviadasOpen(false);
        }}
      />

      <BuscarOrgaoPopup
        open={buscarOrgaoEnviadasOpen}
        onOpenChange={setBuscarOrgaoEnviadasOpen}
        onOrgaoSelecionado={(orgao) => {
          setFiltroEnviadasOrgao(orgao.nome_orgao);
          setBuscarOrgaoEnviadasOpen(false);
        }}
        termoInicial={filtroEnviadasOrgao}
      />
    </MainLayout>
  );
}