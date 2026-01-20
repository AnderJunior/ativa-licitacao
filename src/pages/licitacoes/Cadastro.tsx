import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Save, Trash2, X, Search, Link2, ChevronsUpDown, CalendarIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LinksPopup } from '@/components/licitacoes/LinksPopup';
import { BuscarLicitacaoPopup } from '@/components/licitacoes/BuscarLicitacaoPopup';
import { BuscarOrgaoPopup } from '@/components/orgaos/BuscarOrgaoPopup';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Contratacao {
  id: string;
  cd_pn: string | null;
  titulo: string | null;
  conteudo: string | null;
  uf: string | null;
  municipio: string | null;
  orgao_pncp: string | null;
  modalidade: string | null;
  descricao_modalidade: string | null;
  num_licitacao: string | null;
  dt_publicacao: string | null;
  dt_encerramento_proposta: string | null;
  valor_estimado: number | null;
  link_processo: string | null;
  links: string[] | null;
  tipo_cadastro: string | null;
  cadastrado: boolean;
  enviada: boolean;
  num_ativa?: string | null;
  pncp?: string | null;
  sequencial_compra?: number | null;
  ano_compra?: number | null;
  cadastrado_por?: string | null;
  dt_vinculo_ativa?: string | null;
  dt_alterado_ativa?: string | null;
  textos_cadastro_manual?: string | null;
}

interface RamoAtividade {
  id: string;
  nome: string;
  e_grupo: boolean;
  grupo_relacionado: string | null;
  children?: RamoAtividade[];
}

interface TipoLicitacao {
  id: string;
  sigla: string;
  descricao: string | null;
}

interface Orgao {
  id: string;
  nome_orgao: string;
}

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function LicitacaoCadastro() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const contratacaoId = searchParams.get('id');
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tipos, setTipos] = useState<TipoLicitacao[]>([]);
  const [orgaos, setOrgaos] = useState<Orgao[]>([]);
  const [ramos, setRamos] = useState<RamoAtividade[]>([]);
  const [selectedRamos, setSelectedRamos] = useState<string[]>([]);
  const [linksPopupOpen, setLinksPopupOpen] = useState(false);
  const [buscarPopupOpen, setBuscarPopupOpen] = useState(false);
  const [exibirPopupOpen, setExibirPopupOpen] = useState(false);
  const [tipoPopupOpen, setTipoPopupOpen] = useState(false);
  const [tipoSearchTerm, setTipoSearchTerm] = useState('');
  const [orgaoPopupOpen, setOrgaoPopupOpen] = useState(false);
  const [buscarOrgaoPopupOpen, setBuscarOrgaoPopupOpen] = useState(false);
  const [dataPopupOpen, setDataPopupOpen] = useState(false);
  
  // Estados para pesquisa por digitação
  const [searchBuffer, setSearchBuffer] = useState('');
  const [highlightedAtividadeId, setHighlightedAtividadeId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const atividadesScrollRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<Partial<Contratacao>>({
    num_ativa: '',
    cadastrado_por: '',
    pncp: '',
    uf: '',
    modalidade: '',
    num_licitacao: '',
    dt_publicacao: '',
    orgao_pncp: '',
    conteudo: '',
    tipo_cadastro: 'manual',
    link_processo: null,
    links: [],
    sequencial_compra: null,
    ano_compra: null,
  });

  useEffect(() => {
    loadTipos();
    loadOrgaos();
    loadRamos();
    if (contratacaoId) {
      loadContratacao(contratacaoId);
    }
  }, [contratacaoId]);


  // Valida o orgão quando os orgãos são carregados e há uma licitação com orgão preenchido
  useEffect(() => {
    if (orgaos.length > 0 && formData.id && formData.orgao_pncp) {
      // Verifica se o orgão existe na lista de orgãos cadastrados
      const orgaoEncontrado = orgaos.find(o => 
        o.id === formData.orgao_pncp || o.nome_orgao === formData.orgao_pncp
      );
      
      if (!orgaoEncontrado) {
        // Tenta buscar por nome parcial
        const orgaoPorNome = orgaos.find(o => 
          o.nome_orgao.toLowerCase().includes(formData.orgao_pncp?.toLowerCase() || '') ||
          formData.orgao_pncp?.toLowerCase().includes(o.nome_orgao.toLowerCase() || '')
        );
        
        if (orgaoPorNome) {
          setFormData(prev => ({
            ...prev,
            orgao_pncp: orgaoPorNome.nome_orgao,
          }));
        } else {
          // Se não encontrou, limpa para o usuário selecionar manualmente
          setFormData(prev => ({
            ...prev,
            orgao_pncp: '',
          }));
          toast.warning(`Órgão "${formData.orgao_pncp}" não encontrado. Por favor, selecione um órgão cadastrado.`);
        }
      }
    }
  }, [orgaos.length, formData.id, formData.orgao_pncp]);

  // Atalho F2 para abrir popup de links
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setLinksPopupOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Pesquisa por digitação na área de atividades
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Verifica se o elemento ativo está dentro da área de atividades
      const activeElement = document.activeElement;
      const atividadesArea = atividadesScrollRef.current;
      
      if (!atividadesArea || !activeElement) return;
      
      // Verifica se o elemento ativo está dentro da área de atividades
      // Verifica também se está dentro do viewport do ScrollArea
      const viewport = atividadesArea.querySelector('[data-radix-scroll-area-viewport]');
      const isInAtividadesArea = atividadesArea.contains(activeElement) || 
                                  (viewport && viewport.contains(activeElement));
      
      if (!isInAtividadesArea) return;
      
      // Ignora se estiver digitando em um input ou textarea
      if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') return;
      
      // Ignora teclas especiais (Ctrl, Alt, Shift, etc.)
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      
      // Ignora teclas de navegação e função
      if (e.key.length > 1 && !['Backspace', 'Delete', 'Space'].includes(e.key)) return;
      
      // Se for Backspace ou Delete, limpa o buffer
      if (e.key === 'Backspace' || e.key === 'Delete') {
        setSearchBuffer(prev => {
          if (prev.length > 0) {
            const novoBuffer = prev.slice(0, -1);
            // Busca novamente com o buffer reduzido
            if (novoBuffer.length > 0) {
              setTimeout(() => {
                const atividadeEncontrada = buscarAtividadePorNome(ramos, novoBuffer);
                if (atividadeEncontrada) {
                  scrollParaAtividade(atividadeEncontrada.id);
                } else {
                  // Se não encontrou, limpa o destaque
                  setHighlightedAtividadeId(null);
                }
              }, 0);
            } else {
              // Se o buffer ficou vazio, limpa o destaque
              setHighlightedAtividadeId(null);
            }
            return novoBuffer;
          }
          // Se já estava vazio, limpa o destaque
          setHighlightedAtividadeId(null);
          return '';
        });
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
        return;
      }
      
      // Permite letras, números e espaço
      if (e.key === ' ') {
        e.preventDefault();
        
        // Limpa timeout anterior
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
        
        // Adiciona espaço ao buffer
        const agora = Date.now();
        const tempoDesdeUltimaTecla = agora - lastKeyTimeRef.current;
        const deveResetarBuffer = tempoDesdeUltimaTecla > 800 || searchBuffer === '';
        
        lastKeyTimeRef.current = agora;
        
        const novoBuffer = deveResetarBuffer ? ' ' : (searchBuffer + ' ');
        setSearchBuffer(novoBuffer);
        
        // Busca a atividade
        const atividadeEncontrada = buscarAtividadePorNome(ramos, novoBuffer);
        
        if (atividadeEncontrada) {
          scrollParaAtividade(atividadeEncontrada.id);
        } else {
          // Se não encontrou, limpa o destaque mas mantém o buffer por mais tempo
          setHighlightedAtividadeId(null);
          if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
          }
          // Aumenta o timeout para 2 segundos quando há espaço (permite continuar digitando)
          searchTimeoutRef.current = setTimeout(() => {
            setSearchBuffer('');
            setHighlightedAtividadeId(null);
          }, 2000);
        }
        return;
      }
      
      // Ignora se não for uma letra ou número
      if (!/^[a-zA-Z0-9]$/.test(e.key)) return;
      
      e.preventDefault();
      
      // Limpa timeout anterior
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      const agora = Date.now();
      const tempoDesdeUltimaTecla = agora - lastKeyTimeRef.current;
      
      // Se passou mais de 800ms desde a última tecla, começa uma nova pesquisa do zero
      // Isso permite que o usuário faça múltiplas pesquisas seguidas
      const deveResetarBuffer = tempoDesdeUltimaTecla > 800 || searchBuffer === '';
      
      // Atualiza o timestamp da última tecla
      lastKeyTimeRef.current = agora;
      
      // Adiciona a tecla ao buffer (ou começa novo se deve resetar)
      const novoBuffer = deveResetarBuffer 
        ? e.key.toLowerCase() 
        : (searchBuffer + e.key.toLowerCase()).toLowerCase();
      
      setSearchBuffer(novoBuffer);
      
      // Busca a atividade
      const atividadeEncontrada = buscarAtividadePorNome(ramos, novoBuffer);
      
      if (atividadeEncontrada) {
        scrollParaAtividade(atividadeEncontrada.id);
        // A função scrollParaAtividade já cuida de resetar o buffer
      } else {
        // Se não encontrou, limpa o destaque
        setHighlightedAtividadeId(null);
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        
        // Limpa o buffer após 1 segundo sem digitar (se não encontrou nada)
        searchTimeoutRef.current = setTimeout(() => {
          setSearchBuffer('');
          setHighlightedAtividadeId(null);
        }, 1000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [searchBuffer, ramos]);

  // Remove outline do viewport quando recebe foco
  useEffect(() => {
    const removeOutline = () => {
      const viewport = atividadesScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        (viewport as HTMLElement).style.outline = 'none';
        (viewport as HTMLElement).style.outlineOffset = '0';
      }
    };

    // Remove outline quando o componente monta
    removeOutline();

    // Adiciona listener para remover outline quando recebe foco
    const viewport = atividadesScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.addEventListener('focus', removeOutline);
      viewport.addEventListener('focusin', removeOutline);
      
      return () => {
        viewport.removeEventListener('focus', removeOutline);
        viewport.removeEventListener('focusin', removeOutline);
      };
    }
  }, [ramos]);

  const loadTipos = async () => {
    const { data } = await supabase.from('tipo_licitacoes').select('*').order('sigla');
    if (data) setTipos(data);
  };

  const loadOrgaos = async () => {
    const { data } = await supabase.from('orgaos').select('id, nome_orgao').order('nome_orgao');
    if (data) setOrgaos(data);
  };

  const loadRamos = async () => {
    const { data } = await supabase.from('ramos_de_atividade').select('*').order('nome');
    if (data) {
      const tree = buildTree(data);
      setRamos(tree);
    }
  };

  const buildTree = (items: RamoAtividade[]): RamoAtividade[] => {
    // Mapeia por nome para encontrar grupos pai
    const mapByName = new Map<string, RamoAtividade>();
    const roots: RamoAtividade[] = [];

    // Primeiro, cria todos os nós com children vazio
    items.forEach(item => {
      mapByName.set(item.nome, { ...item, children: [] });
    });

    // Depois, organiza a hierarquia
    items.forEach(item => {
      const node = mapByName.get(item.nome)!;
      
      // Se tem grupo_relacionado, é filho de outro grupo
      if (item.grupo_relacionado && mapByName.has(item.grupo_relacionado)) {
        mapByName.get(item.grupo_relacionado)!.children!.push(node);
      } else {
        // Se não tem grupo_relacionado, é item raiz (pai)
        roots.push(node);
      }
    });

    return roots;
  };

  // Formata o conteúdo da licitação no layout padrão
  const formatarConteudoLicitacao = (licitacao: any): string => {
    const formatarDataHora = (data: string | null) => {
      if (!data) return 'Não informado';
      const d = new Date(data);
      return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (horário de Brasília)`;
    };

    const formatarValor = (valor: number | null) => {
      if (!valor) return 'Não informado';
      return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const modalidadeDescricao = licitacao.modalidade || licitacao.modalidade_ativa || 'Não informado';
    const numLicitacao = licitacao.num_licitacao || 'S/N';
    const anoCompra = licitacao.ano_compra || new Date().getFullYear();

    const linhas = [
      `${modalidadeDescricao} – Nº ${licitacao.sequencial_compra}/${anoCompra}`,
      `Local: ${licitacao.municipio || 'Não informado'}/${licitacao.uf || ''}`,
      `Órgão: ${licitacao.orgao_pncp || 'Não informado'}`,
      `Unidade Compradora: ${licitacao.un_cod || ''} – ${licitacao.unidade || 'Não informado'}`,
      `Modalidade de Compra: ${modalidadeDescricao}`,
      `ID Contratação PNCP: ${numLicitacao || 'Não informado'}`,
      `Objeto: ${licitacao.conteudo || licitacao.titulo || 'Não informado'}`,
      `Complemento: ${licitacao.complemento || 'Nenhum'}`,
      `Período para recebimento de propostas:`,
      `Início: ${formatarDataHora(licitacao.dt_publicacao)}`,
      `Fim: ${formatarDataHora(licitacao.dt_encerramento_proposta)}`,
      `Última atualização: ${formatarDataHora(licitacao.updated_at)}`,
      `Valor Estimado: ${formatarValor(licitacao.valor_estimado)}`,
    ];

    return linhas.join('\n');
  };

  const buscarNomeUsuario = async (userId: string | null): Promise<string | null> => {
    if (!userId) return null;
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('nome')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Erro ao buscar nome do usuário:', error);
        return null;
      }
      
      // @ts-ignore - A coluna nome foi adicionada manualmente pelo usuário
      return data?.nome || null;
    } catch (error) {
      console.error('Erro ao buscar nome do usuário:', error);
      return null;
    }
  };

  const loadContratacao = async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contratacoes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      // Formata o conteúdo no padrão se não tiver conteúdo formatado
      const conteudoFormatado = data.conteudo?.includes('Local:') 
        ? data.conteudo 
        : formatarConteudoLicitacao(data);

      // Extrai sequencial_compra e ano_compra de num_licitacao se não existirem
      let sequencialCompra = data.sequencial_compra ?? null;
      let anoCompra = data.ano_compra ?? null;
      
      if ((!sequencialCompra || !anoCompra) && data.num_licitacao) {
        const parsed = parsearNumeroLicitacao(data.num_licitacao);
        sequencialCompra = sequencialCompra ?? parsed.sequencial;
        anoCompra = anoCompra ?? parsed.ano;
      }

      // Busca o nome do usuário se a licitação estiver cadastrada
      let nomeUsuario = '';
      if (data.cadastrado && data.cadastrado_por) {
        nomeUsuario = (await buscarNomeUsuario(data.cadastrado_por)) || '';
      }

      // Usa o descricao_modalidade (ID do tipo) se existir
      // Se não existir, a identificação automática será feita pelo useEffect quando os tipos forem carregados
      const tipoId = data.descricao_modalidade || null;

      // Valida e ajusta o orgão para garantir que existe nos orgãos cadastrados
      let orgaoValido = data.orgao_pncp || '';
      if (orgaoValido && orgaos.length > 0) {
        // Verifica se o orgão existe na lista de orgãos cadastrados
        const orgaoEncontrado = orgaos.find(o => 
          o.id === orgaoValido || o.nome_orgao === orgaoValido
        );
        
        // Se não encontrou, tenta buscar por nome parcial
        if (!orgaoEncontrado) {
          const orgaoPorNome = orgaos.find(o => 
            o.nome_orgao.toLowerCase().includes(orgaoValido.toLowerCase()) ||
            orgaoValido.toLowerCase().includes(o.nome_orgao.toLowerCase())
          );
          if (orgaoPorNome) {
            orgaoValido = orgaoPorNome.nome_orgao;
          } else {
            // Se não encontrou, limpa para o usuário selecionar manualmente
            orgaoValido = '';
            toast.warning(`Órgão "${data.orgao_pncp}" não encontrado. Por favor, selecione um órgão cadastrado.`);
          }
        } else {
          orgaoValido = orgaoEncontrado.nome_orgao;
        }
      }

      // Calcula num_ativa no formato: num_ativa.mes/ano para exibição
      const numAtivaFormatado = data.num_ativa 
        ? `${data.num_ativa}.${String(new Date(data.created_at).getMonth() + 1).padStart(2, '0')}/${String(new Date(data.created_at).getFullYear()).slice(-2)}`
        : '';

      // Formata num_licitacao: SEMPRE usa sequencial_compra/ano_compra (nunca num_licitacao do banco)
      let numLicitacaoFormatado = '';
      if (sequencialCompra !== null && anoCompra !== null) {
        numLicitacaoFormatado = `${sequencialCompra}/${anoCompra}`;
      }

      // Mantém a UF selecionada: sempre usa a UF da licitação se existir
      // Se não tiver UF na licitação, mantém a UF anteriormente selecionada no formulário
      const ufParaManter = data.uf || formData.pncp || '';

      setFormData({
        ...data,
        num_ativa: numAtivaFormatado,
        cadastrado_por: nomeUsuario,
        pncp: ufParaManter, // Mantém a UF selecionada
        modalidade: tipoId || '', // Usa apenas o tipo que vem do banco
        descricao_modalidade: tipoId || null,
        orgao_pncp: orgaoValido,
        dt_publicacao: data.dt_publicacao 
          ? new Date(data.dt_publicacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        link_processo: data.link_processo || null,
        links: data.links || [],
        conteudo: conteudoFormatado,
        sequencial_compra: sequencialCompra,
        ano_compra: anoCompra,
        num_licitacao: numLicitacaoFormatado,
      });
      // Load marcações
      const { data: marcacoes } = await supabase
        .from('contratacoes_marcacoes')
        .select('ramo_id')
        .eq('contratacao_id', id);
      if (marcacoes) {
        setSelectedRamos(marcacoes.map(m => m.ramo_id));
      }
    }
    setLoading(false);
  };

  const handleSaveLinks = (linkProcesso: string | null, links: string[]) => {
    setFormData(prev => ({
      ...prev,
      link_processo: linkProcesso,
      links: links,
    }));
    toast.success('Links atualizados! Salve a licitação para persistir.');
  };

  const handleProximaLicitacaoUF = async () => {
    const ufSelecionada = formData.pncp;
    
    if (!ufSelecionada || ufSelecionada.trim() === '') {
      toast.warning('Por favor, selecione uma UF no campo PNCP antes de buscar a próxima licitação.');
      return;
    }

    setLoading(true);
    try {
      // Busca a primeira licitação não cadastrada da UF selecionada
      // Ordena por created_at ascendente (mais antiga primeiro)
      const { data, error } = await supabase
        .from('contratacoes')
        .select('id')
        .eq('uf', ufSelecionada)
        .eq('cadastrado', false)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar licitação:', error);
        toast.error('Erro ao buscar licitação. Tente novamente.');
        setLoading(false);
        return;
      }

      if (!data || !data.id) {
        toast.info(`Todas as licitações do estado ${ufSelecionada} já foram cadastradas.`);
        setLoading(false);
        return;
      }

      // Navega para a URL com o ID da licitação encontrada
      navigate(`/licitacoes/cadastro?id=${data.id}`);
      // O useEffect vai detectar a mudança no contratacaoId e carregar a licitação automaticamente
      
    } catch (error) {
      console.error('Erro ao buscar próxima licitação:', error);
      toast.error('Erro ao buscar próxima licitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleLicitacaoEncontrada = async (licitacao: any, ramos: string[]) => {
    // Formata o conteúdo no padrão
    const conteudoFormatado = formatarConteudoLicitacao(licitacao);

    // Extrai sequencial_compra e ano_compra de num_licitacao se não existirem
    let sequencialCompra = licitacao.sequencial_compra ?? null;
    let anoCompra = licitacao.ano_compra ?? null;
    
    if ((!sequencialCompra || !anoCompra) && licitacao.num_licitacao) {
      const parsed = parsearNumeroLicitacao(licitacao.num_licitacao);
      sequencialCompra = sequencialCompra ?? parsed.sequencial;
      anoCompra = anoCompra ?? parsed.ano;
    }

    // Busca o nome do usuário se a licitação estiver cadastrada
    let nomeUsuario = '';
    if (licitacao.cadastrado && licitacao.cadastrado_por) {
      nomeUsuario = (await buscarNomeUsuario(licitacao.cadastrado_por)) || '';
    }

    // Usa o descricao_modalidade (ID do tipo) se existir
    const tipoId = licitacao.descricao_modalidade || null;

    // Valida e ajusta o orgão para garantir que existe nos orgãos cadastrados
    let orgaoValido = licitacao.orgao_pncp || '';
    if (orgaoValido && orgaos.length > 0) {
      // Verifica se o orgão existe na lista de orgãos cadastrados
      const orgaoEncontrado = orgaos.find(o => 
        o.id === orgaoValido || o.nome_orgao === orgaoValido
      );
      
      // Se não encontrou, tenta buscar por nome parcial
      if (!orgaoEncontrado) {
        const orgaoPorNome = orgaos.find(o => 
          o.nome_orgao.toLowerCase().includes(orgaoValido.toLowerCase()) ||
          orgaoValido.toLowerCase().includes(o.nome_orgao.toLowerCase())
        );
        if (orgaoPorNome) {
          orgaoValido = orgaoPorNome.nome_orgao;
        } else {
          // Se não encontrou, limpa para o usuário selecionar manualmente
          orgaoValido = '';
          toast.warning(`Órgão "${licitacao.orgao_pncp}" não encontrado. Por favor, selecione um órgão cadastrado.`);
        }
      } else {
        orgaoValido = orgaoEncontrado.nome_orgao;
      }
    }

    // Calcula num_ativa no formato: num_ativa.mes/ano para exibição
    const numAtivaFormatado = licitacao.num_ativa 
      ? `${licitacao.num_ativa}.${String(new Date(licitacao.created_at).getMonth() + 1).padStart(2, '0')}/${String(new Date(licitacao.created_at).getFullYear()).slice(-2)}`
      : '';

    // Formata num_licitacao: SEMPRE usa sequencial_compra/ano_compra (nunca num_licitacao do banco)
    let numLicitacaoFormatado = '';
    if (sequencialCompra !== null && anoCompra !== null) {
      numLicitacaoFormatado = `${sequencialCompra}/${anoCompra}`;
    }

    // Preenche o formulário com os dados da licitação encontrada
    setFormData({
      ...licitacao,
      num_ativa: numAtivaFormatado,
      cadastrado_por: nomeUsuario,
      pncp: licitacao.cd_pn || '',
      modalidade: tipoId || '',
      orgao_pncp: orgaoValido,
      dt_publicacao: licitacao.dt_publicacao 
        ? new Date(licitacao.dt_publicacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '',
      link_processo: licitacao.link_processo || null,
      links: licitacao.links || [],
      conteudo: conteudoFormatado,
      sequencial_compra: sequencialCompra,
      ano_compra: anoCompra,
      num_licitacao: numLicitacaoFormatado,
    });
    
    // Marca os ramos de atividade
    setSelectedRamos(ramos);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validação dos campos obrigatórios antes de salvar
      if (!formData.modalidade || !tipos.find(t => t.id === formData.modalidade)) {
        toast.error('Por favor, selecione um Tipo válido.');
        setSaving(false);
        return;
      }

      if (!formData.orgao_pncp || !orgaos.find(o => o.nome_orgao === formData.orgao_pncp || o.id === formData.orgao_pncp)) {
        toast.error('Por favor, selecione um Órgão válido da lista.');
        setSaving(false);
        return;
      }

      if (!formData.sequencial_compra || !formData.ano_compra) {
        toast.error('Por favor, preencha o Número corretamente (formato: sequencial/ano).');
        setSaving(false);
        return;
      }

      // Remove campos que não devem ser salvos na tabela
      // cadastrado_por é apenas para exibição, não deve ser salvo
      // pncp é apenas um campo auxiliar do formulário, na tabela é cd_pn
      // modalidade e modalidade_ativa não devem ser atualizados ao salvar
      // id não deve ser incluído no INSERT (banco gera automaticamente) nem no UPDATE (usado apenas na WHERE)
      // num_ativa é apenas para exibição (formato formatado), não deve ser salvo diretamente
      // O num_ativa será calculado e salvo apenas para cadastros manuais novos através de numAtivaParaSalvar
      const formDataAny = formData as any;
      const { cadastrado_por, pncp, id, modalidade, modalidade_ativa, num_ativa, ...formDataToSave } = formDataAny;
      
      // Busca o tipo de licitação selecionado
      // descricao_modalidade deve receber o ID (UUID) do tipo, não a descrição!
      const tipoSelecionado = tipos.find(t => t.id === formData.modalidade);
      if (!tipoSelecionado) {
        toast.error('Tipo selecionado não encontrado. Por favor, selecione novamente.');
        setSaving(false);
        return;
      }

      // descricao_modalidade recebe o ID do tipo (UUID)
      const tipoIdParaSalvar = tipoSelecionado.id;

      // Garante que orgao_pncp é o nome do orgão cadastrado, não um ID
      let orgaoParaSalvar = formData.orgao_pncp;
      const orgaoValido = orgaos.find(o => o.id === formData.orgao_pncp || o.nome_orgao === formData.orgao_pncp);
      if (orgaoValido) {
        orgaoParaSalvar = orgaoValido.nome_orgao;
      }

      // Determina o tipo de cadastro e se é manual:
      // - PNCP: Licitação vem da automação externa (já existe no banco com tipo_cadastro = 'PNCP')
      //         Ao salvar, mantém 'PNCP' mas muda cadastrado = true
      // - Manual: Licitação criada do zero pelo usuário na tela (nova licitação, sem contratacaoId)
      //           Ao salvar, tipo_cadastro = 'Manual' e cadastrado = true
      let tipoCadastro: string | null;
      let isCadastroManual: boolean;

      if (contratacaoId) {
        // Editando licitação existente: sempre busca o tipo_cadastro original do banco
        // para garantir que nunca mude de PNCP para Manual
        const licitacaoId = formData.id || contratacaoId;
        const { data: licitacaoOriginal } = await supabase
          .from('contratacoes')
          .select('tipo_cadastro')
          .eq('id', licitacaoId)
          .maybeSingle();
        
        // Se existe no banco e tem tipo_cadastro, sempre usa o valor do banco
        // Isso garante que se for PNCP, sempre será mantido como PNCP
        if (licitacaoOriginal?.tipo_cadastro) {
          tipoCadastro = licitacaoOriginal.tipo_cadastro;
        } else {
          // Se não tem tipo_cadastro no banco (pode ser null ou não definido),
          // e não é uma nova licitação, usa o valor do formData ou mantém null
          tipoCadastro = formData.tipo_cadastro || null;
        }
        isCadastroManual = tipoCadastro === 'Manual';
      } else {
        // Nova licitação: sempre é Manual (PNCP sempre vem da automação)
        tipoCadastro = 'Manual';
        isCadastroManual = true;
      }

      // Data atual para salvamento
      const dataAtual = new Date().toISOString();

      // dt_vinculo_ativa: Data de quando a licitação foi vinculada/completada pela primeira vez
      // - Se é nova licitação (sem contratacaoId) ou não estava cadastrada: dt_vinculo_ativa = data atual
      // - Se já estava cadastrada (cadastrado = true): mantém o dt_vinculo_ativa original
      let dtVinculoAtiva: string | null;
      if (contratacaoId && formData.cadastrado) {
        // Já estava cadastrada: mantém o valor original
        dtVinculoAtiva = formData.dt_vinculo_ativa || dataAtual;
      } else {
        // Primeira vez sendo cadastrada: define como data atual
        dtVinculoAtiva = dataAtual;
      }

      // Calcula num_ativa para cadastros manuais (apenas para novas licitações)
      // num_ativa = quantidade total de licitações no sistema + 1
      let numAtivaParaSalvar: string | null = null;
      if (isCadastroManual && !contratacaoId) {
        // Busca a quantidade total de licitações no sistema
        const { count, error: countError } = await supabase
          .from('contratacoes')
          .select('*', { count: 'exact', head: true });
        
        if (countError) {
          console.error('Erro ao contar licitações:', countError);
          // Em caso de erro, não impede o salvamento, apenas não define num_ativa
        } else {
          // num_ativa = total + 1 (índice)
          const totalLicitacoes = count || 0;
          numAtivaParaSalvar = String(totalLicitacoes + 1);
        }
      }

      // Cria objeto limpo com apenas os campos que devem ser salvos na tabela
      // modalidade e modalidade_ativa não são atualizados ao salvar (mantém valores originais)
      const dataToSave: any = {
        ...formDataToSave,
        cd_pn: formData.pncp || null,
        descricao_modalidade: tipoIdParaSalvar, // Campo UUID - recebe o ID do tipo
        orgao_pncp: orgaoParaSalvar, // Usa o orgão validado
        cadastrado: true,
        cadastrado_por: user?.id || null,
        dt_vinculo_ativa: dtVinculoAtiva,
        dt_alterado_ativa: dataAtual, // Sempre atualiza a data de alteração
        tipo_cadastro: tipoCadastro,
        textos_cadastro_manual: isCadastroManual && formData.conteudo ? formData.conteudo : null,
        links: formData.links || [],
        link_processo: formData.link_processo || null,
        updated_at: dataAtual,
      };

      // Adiciona num_ativa apenas para cadastros manuais (novas licitações)
      if (numAtivaParaSalvar !== null) {
        dataToSave.num_ativa = numAtivaParaSalvar;
      }

      // Converte dt_publicacao de DD/MM/AAAA para YYYY-MM-DD (formato ISO) se existir
      // Se estiver vazio, define como null (permitido para cadastros manuais)
      if (dataToSave.dt_publicacao && dataToSave.dt_publicacao.trim() !== '') {
        const dataParseada = parsearData(dataToSave.dt_publicacao);
        if (dataParseada) {
          // Formata como YYYY-MM-DD para o banco de dados
          const ano = dataParseada.getFullYear();
          const mes = String(dataParseada.getMonth() + 1).padStart(2, '0');
          const dia = String(dataParseada.getDate()).padStart(2, '0');
          dataToSave.dt_publicacao = `${ano}-${mes}-${dia}`;
        } else {
          // Se não conseguir parsear, define como null
          dataToSave.dt_publicacao = null;
        }
      } else {
        // Se estiver vazio ou não existir, define como null (permitido para cadastros manuais)
        dataToSave.dt_publicacao = null;
      }

      // Remove o id se ainda estiver presente (não deve ser salvo no objeto)
      // Mas salvamos a referência para determinar se é UPDATE ou INSERT
      const licitacaoId = formData.id || contratacaoId;
      delete dataToSave.id;

      let contratacaoIdToUse = licitacaoId;

      // Se tem ID (da URL ou do formData), faz UPDATE
      // Se não tem ID, faz INSERT (nova licitação)
      if (licitacaoId) {
        // Em UPDATE, não altera num_ativa (mantém o valor original do banco)
        // Remove num_ativa se estiver presente no dataToSave
        delete dataToSave.num_ativa;
        
        const { error } = await supabase
          .from('contratacoes')
          .update(dataToSave)
          .eq('id', licitacaoId);
        if (error) throw error;
        contratacaoIdToUse = licitacaoId;
      } else {
        const { data, error } = await supabase
          .from('contratacoes')
          .insert(dataToSave)
          .select('id, created_at, num_ativa')
          .single();
        if (error) throw error;
        contratacaoIdToUse = data.id;
        
        // Atualiza o num_ativa formatado no formData se foi calculado
        if (data.num_ativa && isCadastroManual) {
          const numAtivaFormatado = `${data.num_ativa}.${String(new Date(data.created_at).getMonth() + 1).padStart(2, '0')}/${String(new Date(data.created_at).getFullYear()).slice(-2)}`;
          setFormData(prev => ({
            ...prev,
            num_ativa: numAtivaFormatado,
          }));
        }
        
        // Atualiza a URL para incluir o ID da licitação criada
        window.history.replaceState({}, '', `/licitacoes/cadastro?id=${data.id}`);
      }

      // Sincronizar marcações
      if (contratacaoIdToUse) {
        await supabase
          .from('contratacoes_marcacoes')
          .delete()
          .eq('contratacao_id', contratacaoIdToUse);

        if (selectedRamos.length > 0) {
          const marcacoes = selectedRamos.map(ramo_id => ({
            contratacao_id: contratacaoIdToUse,
            ramo_id,
          }));
          await supabase.from('contratacoes_marcacoes').insert(marcacoes);
        }
      }

      // Busca o nome do usuário e atualiza o campo "Incluído por" para exibição
      if (user?.id) {
        const nomeUsuario = await buscarNomeUsuario(user.id);
        setFormData(prev => ({
          ...prev,
          cadastrado_por: nomeUsuario || '', // Nome do usuário para exibição no campo
          cadastrado: true,
          modalidade: tipoIdParaSalvar, // Mantém o ID do tipo selecionado
          descricao_modalidade: tipoIdParaSalvar, // ID do tipo (UUID)
          tipo_cadastro: tipoCadastro,
          dt_vinculo_ativa: dtVinculoAtiva,
          dt_alterado_ativa: dataAtual,
        }));
      }

      toast.success('Licitação salva com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Atalho Ctrl+S para salvar licitação
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Verifica se é Ctrl+S (ou Cmd+S no Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        // Verifica se não está digitando em um input ou textarea
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          // Se estiver em um input/textarea, permite o comportamento padrão (salvar página)
          return;
        }
        
        e.preventDefault();
        
        // Verifica se está salvando
        if (saving) {
          return;
        }
        
        // Verifica campos obrigatórios e mostra notificação se faltar algum
        const camposFaltando: string[] = [];
        
        if (!formData.modalidade || !tipos.find(t => t.id === formData.modalidade)) {
          camposFaltando.push('Tipo');
        }
        
        if (!formData.orgao_pncp || !orgaos.find(o => o.nome_orgao === formData.orgao_pncp || o.id === formData.orgao_pncp)) {
          camposFaltando.push('Órgão');
        }
        
        if (!formData.sequencial_compra && !formData.ano_compra) {
          camposFaltando.push('Número');
        }
        
        // Se faltar algum campo, mostra notificação
        if (camposFaltando.length > 0) {
          toast.error(`Por favor, preencha os campos obrigatórios: ${camposFaltando.join(', ')}`);
          return;
        }
        
        // Se todos os campos estiverem preenchidos, salva
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saving, formData.modalidade, formData.orgao_pncp, formData.sequencial_compra, formData.ano_compra, tipos, orgaos, handleSave]);

  const handleDelete = async () => {
    if (!contratacaoId) return;
    if (!confirm('Tem certeza que deseja excluir esta licitação?')) return;

    try {
      const { error } = await supabase
        .from('contratacoes')
        .delete()
        .eq('id', contratacaoId);
      if (error) throw error;
      toast.success('Licitação excluída!');
      window.history.back();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const handleLimpar = () => {
    // Limpa todos os campos do formulário
    setFormData({
      num_ativa: '',
      cadastrado_por: '',
      pncp: '',
      uf: '',
      modalidade: '',
      num_licitacao: '',
      dt_publicacao: '',
      orgao_pncp: '',
      conteudo: '',
      tipo_cadastro: 'manual',
      link_processo: null,
      links: [],
      sequencial_compra: null,
      ano_compra: null,
    });
    
    // Limpa checkboxes selecionados (ramos de atividade)
    setSelectedRamos([]);
    
    // Fecha popovers se estiverem abertos
    setTipoPopupOpen(false);
    setOrgaoPopupOpen(false);
    setLinksPopupOpen(false);
    setBuscarPopupOpen(false);
    
    toast.success('Todos os campos foram limpos!');
  };

  const toggleRamo = (ramoId: string) => {
    setSelectedRamos(prev =>
      prev.includes(ramoId)
        ? prev.filter(id => id !== ramoId)
        : [...prev, ramoId]
    );
  };

  const formatarNumeroLicitacao = (): string => {
    // SEMPRE formata como sequencial_compra/ano_compra se disponível
    const sequencial = formData.sequencial_compra;
    const ano = formData.ano_compra;
    if (sequencial !== null && sequencial !== undefined && ano !== null && ano !== undefined) {
      return `${sequencial}/${ano}`;
    }
    return '';
  };

  const parsearNumeroLicitacao = (valor: string) => {
    if (!valor || valor.trim() === '') {
      return { sequencial: null, ano: null, valorString: '' };
    }
    const partes = valor.split('/').map(p => p.trim());
    // Mantém os zeros à esquerda preservando como string
    const sequencialStr = partes[0] && partes[0] !== '' ? partes[0] : '';
    const anoStr = partes[1] && partes[1] !== '' ? partes[1] : '';
    
    // Converte para número apenas se for válido (para salvar no banco)
    // Mas preserva a string original para exibição
    const sequencial = sequencialStr !== '' && /^\d+$/.test(sequencialStr) ? parseInt(sequencialStr) : null;
    const ano = anoStr !== '' && /^\d+$/.test(anoStr) ? parseInt(anoStr) : null;
    
    return { 
      sequencial, 
      ano, 
      valorString: valor.trim() // Mantém o valor original digitado com zeros à esquerda e "/"
    };
  };

  // Formata data com máscara DD/MM/AAAA enquanto digita
  const formatarDataInput = (valor: string): string => {
    // Remove tudo que não é número
    const apenasNumeros = valor.replace(/\D/g, '');
    
    // Limita a 8 dígitos (DDMMAAAA)
    const numerosLimitados = apenasNumeros.slice(0, 8);
    
    // Aplica a máscara DD/MM/AAAA
    if (numerosLimitados.length === 0) return '';
    if (numerosLimitados.length <= 2) return numerosLimitados;
    if (numerosLimitados.length <= 4) {
      return `${numerosLimitados.slice(0, 2)}/${numerosLimitados.slice(2)}`;
    }
    return `${numerosLimitados.slice(0, 2)}/${numerosLimitados.slice(2, 4)}/${numerosLimitados.slice(4)}`;
  };

  // Converte string DD/MM/AAAA para Date
  const parsearData = (valor: string): Date | null => {
    if (!valor || valor.trim() === '') return null;
    
    const partes = valor.split('/');
    if (partes.length !== 3) return null;
    
    const dia = parseInt(partes[0]);
    const mes = parseInt(partes[1]) - 1; // Meses são 0-indexed
    const ano = parseInt(partes[2]);
    
    if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null;
    
    // Validação básica
    if (dia < 1 || dia > 31 || mes < 0 || mes > 11 || ano < 1900 || ano > 2100) return null;
    
    const data = new Date(ano, mes, dia);
    
    // Verifica se a data é válida
    if (data.getDate() !== dia || data.getMonth() !== mes || data.getFullYear() !== ano) {
      return null;
    }
    
    return data;
  };

  // Converte Date para string DD/MM/AAAA
  const formatarDataParaString = (data: Date | null): string => {
    if (!data) return '';
    return format(data, 'dd/MM/yyyy');
  };

  // Normaliza texto removendo acentos e normalizando espaços
  const normalizarTexto = (texto: string): string => {
    if (!texto) return '';
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/\s+/g, ' ') // Normaliza espaços múltiplos para um único espaço
      .trim(); // Remove espaços no início e fim, mas mantém espaços no meio
  };

  // Busca recursiva de atividade por nome
  const buscarAtividadePorNome = (items: RamoAtividade[], termo: string): RamoAtividade | null => {
    if (!termo) return null;
    // Remove espaços apenas no início e fim, mantém espaços no meio
    const termoLimpo = termo.trim();
    if (termoLimpo === '') return null;
    
    const termoNormalizado = normalizarTexto(termoLimpo);
    if (!termoNormalizado) return null;
    
    // Lista para armazenar resultados com prioridade
    const resultados: Array<{ item: RamoAtividade; prioridade: number }> = [];
    
    const buscarRecursivo = (items: RamoAtividade[]): void => {
      for (const item of items) {
        const nomeNormalizado = normalizarTexto(item.nome);
        let prioridade = 0;
        
        // Prioridade 1: Nome começa exatamente com o termo completo
        if (nomeNormalizado.startsWith(termoNormalizado)) {
          prioridade = 1;
        }
        // Prioridade 2: Nome contém o termo completo como substring
        else if (nomeNormalizado.includes(termoNormalizado)) {
          prioridade = 2;
        }
        
        if (prioridade > 0) {
          resultados.push({ item, prioridade });
        }
        
        // Busca nos filhos recursivamente
        if (item.children && item.children.length > 0) {
          buscarRecursivo(item.children);
        }
      }
    };
    
    buscarRecursivo(items);
    
    // Retorna o item com maior prioridade (menor número = maior prioridade)
    if (resultados.length > 0) {
      resultados.sort((a, b) => {
        // Ordena por prioridade primeiro
        if (a.prioridade !== b.prioridade) {
          return a.prioridade - b.prioridade;
        }
        // Se mesma prioridade, ordena por posição no nome (mais próximo do início = melhor)
        const nomeA = normalizarTexto(a.item.nome);
        const nomeB = normalizarTexto(b.item.nome);
        const posA = nomeA.indexOf(termoNormalizado);
        const posB = nomeB.indexOf(termoNormalizado);
        return posA - posB;
      });
      return resultados[0].item;
    }
    
    return null;
  };

  // Rola até o elemento encontrado e destaca
  const scrollParaAtividade = (atividadeId: string) => {
    const elemento = document.querySelector(`[data-atividade-id="${atividadeId}"]`);
    if (elemento && atividadesScrollRef.current) {
      elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Limpa timeout anterior de destaque
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      
      // Define a atividade como destacada
      setHighlightedAtividadeId(atividadeId);
      
      // Remove o destaque após 2 segundos
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedAtividadeId(null);
      }, 2000);
      
      // Reseta o buffer após 500ms para permitir nova pesquisa
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        setSearchBuffer('');
        lastKeyTimeRef.current = 0; // Reseta o timestamp para forçar nova pesquisa
      }, 500);
    }
  };

  const handleItemClick = (atividadeId: string) => {
    // Limpa timeout anterior de destaque
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    
    // Define a atividade como destacada
    setHighlightedAtividadeId(atividadeId);
    
    // Remove o destaque após 2 segundos (opcional - pode remover se quiser que fique marcado até clicar em outro)
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedAtividadeId(null);
    }, 2000);
  };

  const renderRamoTree = (items: RamoAtividade[], level = 0) => {
    return items.map(item => {
      const isHighlighted = highlightedAtividadeId === item.id;
      const isSelected = selectedRamos.includes(item.id);
      
      return (
        <div key={item.id}>
          {/* Item principal */}
          <div 
            className={cn(
              "relative py-1 rounded px-1 flex items-start transition-colors duration-200 cursor-pointer",
              isSelected ? "bg-yellow-200" : isHighlighted ? "bg-blue-100" : ""
            )}
            data-atividade-id={item.id}
            onClick={() => handleItemClick(item.id)}
          >
            <Checkbox
              id={item.id}
              checked={isSelected}
              onCheckedChange={(checked) => {
                toggleRamo(item.id);
                // Também destaca ao marcar/desmarcar o checkbox
                if (checked) {
                  handleItemClick(item.id);
                }
              }}
              className="h-3.5 w-3.5 mt-0.5"
              onClick={(e) => e.stopPropagation()}
            />
            <span 
              className="pl-2 text-[13px] text-[#262626] lowercase cursor-pointer select-none flex-1"
            >
              {item.nome}
            </span>
          </div>
          {/* Filhos com linha vertical centralizada no checkbox */}
          {item.children && item.children.length > 0 && (
            <div className="ml-[10px] pl-[14px] border-l border-gray-300">
              {renderRamoTree(item.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex gap-[16px] h-full">
        {/* Formulário Central */}
        <div className="flex-1 bg-white rounded-lg border border-border pl-6 pr-6 pt-4 pb-4 flex flex-col relative">
          {/* Título e Botões de ação */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-[#262626]">Cadastros</h1>
            
            {/* Botões de ação no topo direito */}
            <div className="flex items-center gap-2">
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDelete}
                disabled={!contratacaoId}
                className="bg-red-500 hover:bg-red-600 text-white px-4"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleSave} 
                disabled={
                  saving || 
                  !formData.modalidade || 
                  !tipos.find(t => t.id === formData.modalidade) ||
                  !formData.orgao_pncp || 
                  !orgaos.find(o => o.nome_orgao === formData.orgao_pncp || o.id === formData.orgao_pncp) ||
                  (!formData.sequencial_compra && !formData.ano_compra)
                }
                className="bg-[#02572E] text-white hover:bg-[#024a27] px-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar
              </Button>
              <Button 
                variant="destructive" 
                size="icon" 
                onClick={handleLimpar}
                className="rounded-full w-9 h-9 bg-red-500 hover:bg-red-600"
                title="Limpar campos"
              >
                <X className="w-4 h-4" />
              </Button>
              <Button 
                variant="secondary" 
                size="icon" 
                className="rounded-full w-9 h-9"
                onClick={() => setBuscarPopupOpen(true)}
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Campos superiores */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="space-y-1">
              <Label htmlFor="num_ativa" className="text-sm font-normal text-[#262626]">N. Controle Ativa:</Label>
              <Input
                id="num_ativa"
                value={formData.num_ativa || ''}
                readOnly
                className="h-9 bg-gray-50 cursor-not-allowed"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cadastrado_por" className="text-sm font-normal text-[#262626]">Incluído por</Label>
              <Input
                id="cadastrado_por"
                value={formData.cadastrado_por || ''}
                readOnly
                className="h-9 bg-gray-50 cursor-not-allowed"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pncp" className="text-sm font-normal text-[#262626]">PNCP</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.pncp || ''}
                  onValueChange={(value) => setFormData({ ...formData, pncp: value })}
                >
                  <SelectTrigger id="pncp" className="h-9 bg-white flex-1">
                    <SelectValue placeholder="Selecione uma UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full w-9 h-9 shrink-0 bg-gray-400 hover:bg-gray-500 text-white"
                  type="button"
                  onClick={handleLimpar}
                >
                  ==
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full w-9 h-9 shrink-0 bg-gray-400 hover:bg-gray-500 text-white"
                  type="button"
                  onClick={handleProximaLicitacaoUF}
                  disabled={loading}
                >
                  →
                </Button>
              </div>
            </div>
          </div>

          {/* Campos do meio */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="space-y-1">
              <Label htmlFor="tipo" className="text-sm font-normal text-[#262626]">Tipo</Label>
              <Popover 
                open={tipoPopupOpen} 
                onOpenChange={(open) => {
                  setTipoPopupOpen(open);
                  if (!open) {
                    setTipoSearchTerm(''); // Limpa a busca quando fechar
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={tipoPopupOpen}
                    className="h-9 w-full justify-between font-normal bg-white"
                  >
                    {formData.modalidade
                      ? tipos.find((tipo) => tipo.id === formData.modalidade) 
                        ? `${tipos.find((tipo) => tipo.id === formData.modalidade)?.sigla} - ${tipos.find((tipo) => tipo.id === formData.modalidade)?.descricao}`
                        : "Selecione o Tipo"
                      : "Selecione o Tipo"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command 
                    filter={(value, search) => {
                      // Desabilita o filtro padrão - vamos filtrar manualmente
                      return 1;
                    }}
                  >
                    <CommandInput 
                      placeholder="Buscar tipo..." 
                      value={tipoSearchTerm}
                      onValueChange={(value) => {
                        setTipoSearchTerm(value);
                      }}
                    />
                    <CommandList>
                      <CommandEmpty>Nenhum tipo encontrado.</CommandEmpty>
                      <CommandGroup className="p-0">
                        {tipos
                          .filter((tipo) => {
                            if (!tipoSearchTerm) return true;
                            // Filtra apenas os que começam com o termo de busca (case insensitive)
                            const searchLower = tipoSearchTerm.toLowerCase();
                            const siglaLower = tipo.sigla?.toLowerCase() || '';
                            return siglaLower.startsWith(searchLower);
                          })
                          .map((tipo) => (
                            <CommandItem
                              key={tipo.id}
                              value={`${tipo.sigla} ${tipo.descricao || ''}`}
                              onSelect={() => {
                                setFormData({ 
                                  ...formData, 
                                  modalidade: tipo.id, // ID do tipo (para o dropdown)
                                  descricao_modalidade: tipo.id // ID do tipo (UUID) - não a descrição!
                                });
                                setTipoPopupOpen(false);
                                setTipoSearchTerm(''); // Limpa a busca ao selecionar
                              }}
                              className={cn(
                                "px-3 py-2 rounded-none cursor-pointer",
                                formData.modalidade === tipo.id
                                  ? "!bg-[#02572E]/10 !text-[#02572E]"
                                  : "!bg-transparent !text-foreground hover:!bg-accent hover:!text-accent-foreground"
                              )}
                            >
                              {tipo.sigla} - {tipo.descricao}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label htmlFor="num_licitacao" className="text-sm font-normal text-[#262626]">Número</Label>
              <Input
                id="num_licitacao"
                placeholder="Digite o número (ex: 02/2026)"
                value={formData.num_licitacao || formatarNumeroLicitacao()}
                onChange={(e) => {
                  const valor = e.target.value;
                  // Permite apenas números e "/"
                  const valorLimpo = valor.replace(/[^\d\/]/g, '');
                  
                  // Limita a uma barra "/" apenas
                  const partes = valorLimpo.split('/');
                  let valorFormatado = partes[0] || '';
                  if (partes.length > 1) {
                    valorFormatado += '/' + partes.slice(1).join('').replace(/\//g, '');
                  }
                  
                  const { sequencial, ano } = parsearNumeroLicitacao(valorFormatado);
                  setFormData({ 
                    ...formData, 
                    sequencial_compra: sequencial,
                    ano_compra: ano,
                    num_licitacao: valorFormatado // Preserva o valor original digitado (incluindo zeros à esquerda e "/")
                  });
                }}
                className="h-9 bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dt_publicacao" className="text-sm font-normal text-[#262626]">Data Licitação</Label>
              <div className="relative">
                <Input
                  id="dt_publicacao"
                  value={formData.dt_publicacao || ''}
                  onChange={(e) => {
                    const valorFormatado = formatarDataInput(e.target.value);
                    setFormData({ ...formData, dt_publicacao: valorFormatado });
                  }}
                  placeholder="DD/MM/AAAA"
                  className="h-9 pr-9 bg-white"
                  maxLength={10}
                />
                <Popover open={dataPopupOpen} onOpenChange={setDataPopupOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-9 w-9 hover:bg-transparent"
                      onClick={() => setDataPopupOpen(true)}
                    >
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parsearData(formData.dt_publicacao || '') || undefined}
                      onSelect={(date) => {
                        if (date) {
                          const dataFormatada = formatarDataParaString(date);
                          setFormData({ ...formData, dt_publicacao: dataFormatada });
                          setDataPopupOpen(false);
                        }
                      }}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Seção Órgão */}
          <div className="flex-1 flex flex-col min-h-0">
            <Label htmlFor="orgao" className="text-sm font-normal mb-2 block text-[#262626]">Orgão</Label>
            <div className="flex gap-2 mb-2">
              <Popover open={orgaoPopupOpen} onOpenChange={setOrgaoPopupOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={orgaoPopupOpen}
                    className="h-9 flex-1 justify-between font-normal bg-white"
                  >
                    {formData.orgao_pncp
                      ? (() => {
                          const orgaoEncontrado = orgaos.find((orgao) => orgao.id === formData.orgao_pncp || orgao.nome_orgao === formData.orgao_pncp);
                          return orgaoEncontrado ? orgaoEncontrado.nome_orgao : formData.orgao_pncp;
                        })()
                      : "Selecione o Orgão"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar orgão..." />
                    <CommandList>
                      <CommandEmpty>Nenhum orgão encontrado.</CommandEmpty>
                      <CommandGroup className="p-0">
                        {orgaos.map((orgao) => (
                          <CommandItem
                            key={orgao.id}
                            value={orgao.nome_orgao}
                            onSelect={() => {
                              setFormData({ ...formData, orgao_pncp: orgao.nome_orgao });
                              setOrgaoPopupOpen(false);
                            }}
                            className={cn(
                              "px-3 py-2 rounded-none cursor-pointer",
                              (formData.orgao_pncp === orgao.nome_orgao || formData.orgao_pncp === orgao.id)
                                ? "!bg-[#02572E]/10 !text-[#02572E]"
                                : "!bg-transparent !text-foreground hover:!bg-accent hover:!text-accent-foreground"
                            )}
                          >
                            {orgao.nome_orgao}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full w-9 h-9 shrink-0 bg-gray-400 hover:bg-gray-500 text-white"
                type="button"
                onClick={() => setBuscarOrgaoPopupOpen(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              id="conteudo"
              value={formData.conteudo || ''}
              onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
              className="resize-none flex-1 min-h-[120px] text-[12px] text-[#1a1a1a] bg-white"
              placeholder=""
            />
          </div>

          {/* Botões inferiores */}
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              className="bg-gray-100 hover:bg-gray-200 text-[#262626]"
              onClick={() => setLinksPopupOpen(true)}
            >
              <Link2 className="w-4 h-4 mr-2" />
              Links (F2)
            </Button>
            {formData.link_processo && formData.link_processo.trim() !== '' && (
              <Button 
                variant="outline" 
                className="bg-gray-100 hover:bg-gray-200 text-[#262626]"
                onClick={() => setExibirPopupOpen(true)}
              >
                Exibir Licitação
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar Direita - Atividades */}
        <div className="w-[350px] bg-white rounded-lg border border-border p-4 flex flex-col text-[14px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[#262626]">Atividades - ({selectedRamos.length})</h2>
          </div>

          <ScrollArea 
            ref={atividadesScrollRef}
            className="flex-1 focus:outline-none"
            tabIndex={0}
            onClick={(e) => {
              // Foca no viewport interno para capturar eventos de teclado
              const viewport = e.currentTarget.querySelector('[data-radix-scroll-area-viewport]');
              if (viewport) {
                (viewport as HTMLElement).focus();
                // Remove outline do viewport
                (viewport as HTMLElement).style.outline = 'none';
              }
            }}
            onFocus={(e) => {
              // Foca no viewport interno para capturar eventos de teclado
              const viewport = e.currentTarget.querySelector('[data-radix-scroll-area-viewport]');
              if (viewport) {
                (viewport as HTMLElement).focus();
                // Remove outline do viewport
                (viewport as HTMLElement).style.outline = 'none';
              }
              // Remove outline do próprio ScrollArea
              e.currentTarget.style.outline = 'none';
            }}
          >
            <div tabIndex={-1} style={{ outline: 'none' }}>
              {ramos.length === 0 ? (
                <p className="text-muted-foreground text-sm py-2">
                  Nenhum ramo cadastrado.
                </p>
              ) : (
                renderRamoTree(ramos)
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Popup de Links */}
      <LinksPopup
        open={linksPopupOpen}
        onOpenChange={setLinksPopupOpen}
        linkProcesso={formData.link_processo || null}
        links={formData.links || []}
        onSave={handleSaveLinks}
      />

      {/* Popup de Buscar Licitação */}
      <BuscarLicitacaoPopup
        open={buscarPopupOpen}
        onOpenChange={setBuscarPopupOpen}
        onLicitacaoEncontrada={handleLicitacaoEncontrada}
      />

      {/* Popup de Buscar Órgão */}
      <BuscarOrgaoPopup
        open={buscarOrgaoPopupOpen}
        onOpenChange={setBuscarOrgaoPopupOpen}
        onOrgaoSelecionado={(orgao) => {
          setFormData({ ...formData, orgao_pncp: orgao.nome_orgao });
        }}
      />

      {/* Popup de Exibir Licitação */}
      <Dialog open={exibirPopupOpen} onOpenChange={setExibirPopupOpen}>
        <DialogContent className="sm:max-w-[90vw] max-w-[90vw] w-[90vw] h-[90vh] p-0 gap-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-semibold text-[#262626]">
              Exibir Licitação
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 px-6 pb-6">
            {formData.link_processo && (
              <iframe
                src={formData.link_processo}
                className="w-full h-[calc(90vh-120px)] border border-gray-200 rounded-lg"
                title="Licitação"
                allowFullScreen
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
