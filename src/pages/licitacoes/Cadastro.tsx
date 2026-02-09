import { useState, useEffect, useRef, useCallback } from 'react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Save, Trash2, X, Search, Link2, ChevronsUpDown, CalendarIcon, FileText, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LinksPopup } from '@/components/licitacoes/LinksPopup';
import { BuscarLicitacaoPopup } from '@/components/licitacoes/BuscarLicitacaoPopup';
import { BuscarOrgaoPopup } from '@/components/orgaos/BuscarOrgaoPopup';
import { BuscarTipoPopup } from '@/components/licitacoes/BuscarTipoPopup';
import { cn } from '@/lib/utils';
import { ORDEM_ARVORE_ATIVIDADES } from '@/lib/ordemArvoreAtividades';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useResizable } from '@/hooks/use-resizable';

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
  palavras_chaves?: string[] | null;
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
  const [pncpPopupOpen, setPncpPopupOpen] = useState(false);
  const [pncpSearchTerm, setPncpSearchTerm] = useState('');
  const [tipoPopupOpen, setTipoPopupOpen] = useState(false);
  const [tipoSearchTerm, setTipoSearchTerm] = useState('');
  const [orgaoPopupOpen, setOrgaoPopupOpen] = useState(false);
  const [orgaoSearchTerm, setOrgaoSearchTerm] = useState('');
  const [buscarOrgaoPopupOpen, setBuscarOrgaoPopupOpen] = useState(false);
  const [termoInicialOrgao, setTermoInicialOrgao] = useState<string>('');
  const [buscarTipoPopupOpen, setBuscarTipoPopupOpen] = useState(false);
  const [termoInicialTipo, setTermoInicialTipo] = useState<string>('');
  const [conteudoIgnorado, setConteudoIgnorado] = useState<string>(''); // Rastreia conteúdo que o usuário fechou o popup
  const [dataPopupOpen, setDataPopupOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [duplicidadeDialogOpen, setDuplicidadeDialogOpen] = useState(false);
  const [atividadesVaziasDialogOpen, setAtividadesVaziasDialogOpen] = useState(false);
  const [palavrasChavesModalOpen, setPalavrasChavesModalOpen] = useState(false);
  const [palavrasChavesModalItem, setPalavrasChavesModalItem] = useState<RamoAtividade | null>(null);
  const [palavrasChavesFloatingPos, setPalavrasChavesFloatingPos] = useState<{ top: number; left: number; placement: 'above' | 'below' } | null>(null);
  const [palavrasChavesEditValue, setPalavrasChavesEditValue] = useState('');
  const [palavrasChavesSaving, setPalavrasChavesSaving] = useState(false);
  const FLOATING_PANEL_ESTIMATED_H = 220;
  const FLOATING_PANEL_W = 320;
  
  // Estados para preenchimento automático
  const [autoPreencherUASG, setAutoPreencherUASG] = useState(false);
  const [autoPreencherDATA, setAutoPreencherDATA] = useState(false);
  const [autoPreencherTIPO, setAutoPreencherTIPO] = useState(false);
  /** Revisão: marcado somente quando a licitação já está cadastrada E já foi enviada em relatório ao cliente. Não é marcado apenas por estar cadastrada. Ver docs/REVISAO-CHECKBOX.md */
  const [revisao, setRevisao] = useState(false);
  
  // Estados para pesquisa por digitação
  const [searchBuffer, setSearchBuffer] = useState('');
  const [highlightedAtividadeId, setHighlightedAtividadeId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const atividadesScrollRef = useRef<HTMLDivElement>(null);
  
  // Hook para redimensionar a área de atividades
  const atividadesResizable = useResizable({
    initialWidth: 350,
    minWidth: 250,
    maxWidth: 600,
    storageKey: 'licitacao-atividades-width',
  });

  // Garante que o valor nunca ultrapasse 600px (proteção adicional)
  useEffect(() => {
    if (atividadesResizable.width > 600) {
      // Se por algum motivo o valor estiver acima do limite, corrige
      if (typeof window !== 'undefined') {
        localStorage.setItem('licitacao-atividades-width', '600');
      }
    }
  }, [atividadesResizable.width]);

  // Map para rastrear últimos tempos de seleção e evitar múltiplas chamadas
  const lastSelectTimeMap = useRef<Map<string, number>>(new Map());
  // Refs para focar nos inputs de pesquisa quando os dropdowns abrirem
  const pncpSearchInputRef = useRef<HTMLInputElement>(null);
  const tipoSearchInputRef = useRef<HTMLInputElement>(null);
  const orgaoSearchInputRef = useRef<HTMLInputElement>(null);

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


  // Foca no input de pesquisa quando o dropdown de PNCP abrir
  useEffect(() => {
    if (pncpPopupOpen && pncpSearchInputRef.current) {
      const timeoutId = setTimeout(() => {
        pncpSearchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [pncpPopupOpen]);

  // Abre o popover de PNCP quando recebe foco via TAB (não via clique)
  useEffect(() => {
    const pncpButton = document.querySelector('[role="combobox"][tabindex="1"]') as HTMLElement;
    if (!pncpButton) return;

    const handleFocus = (e: FocusEvent) => {
      // Verifica se o foco veio de um clique ou de TAB
      const wasClick = (e as any).detail === 0 || (e as any).relatedTarget === null;
      if (!wasClick && !pncpPopupOpen) {
        // Foco veio via TAB, abre o popover
        setPncpPopupOpen(true);
      }
    };

    pncpButton.addEventListener('focus', handleFocus);
    return () => pncpButton.removeEventListener('focus', handleFocus);
  }, [pncpPopupOpen]);

  // Foca no input de pesquisa quando o dropdown de tipo abrir
  useEffect(() => {
    if (tipoPopupOpen) {
      // Delay maior para garantir que o popover e o input estejam totalmente renderizados
      const timeoutId = setTimeout(() => {
        // Tenta usar a ref primeiro
        if (tipoSearchInputRef.current) {
          tipoSearchInputRef.current.focus();
        } else {
          // Fallback: busca o input no DOM
          const input = document.querySelector('[cmdk-input]') as HTMLInputElement;
          if (input) {
            input.focus();
          }
        }
      }, 200);
      
      // Tenta focar novamente após um delay adicional para garantir
      const timeoutId2 = setTimeout(() => {
        if (tipoSearchInputRef.current) {
          tipoSearchInputRef.current.focus();
        } else {
          const input = document.querySelector('[cmdk-input]') as HTMLInputElement;
          if (input) {
            input.focus();
          }
        }
      }, 300);
      
      return () => {
        clearTimeout(timeoutId);
        clearTimeout(timeoutId2);
      };
    }
  }, [tipoPopupOpen]);

  // Abre o popover de Tipo quando recebe foco via TAB (não via clique)
  useEffect(() => {
    const tipoButton = document.querySelector('[role="combobox"][tabindex="2"]') as HTMLElement;
    if (!tipoButton) return;

    const handleFocus = (e: FocusEvent) => {
      // Verifica se o foco veio de um clique ou de TAB
      // Se relatedTarget existe, provavelmente veio de outro elemento (TAB)
      const cameFromTab = e.relatedTarget !== null;
      if (cameFromTab && !tipoPopupOpen) {
        // Foco veio via TAB, abre o popover
        setTipoPopupOpen(true);
        // Aguarda o popover abrir e foca no input
        setTimeout(() => {
          if (tipoSearchInputRef.current) {
            tipoSearchInputRef.current.focus();
          }
        }, 200);
      }
    };

    tipoButton.addEventListener('focus', handleFocus);
    return () => tipoButton.removeEventListener('focus', handleFocus);
  }, [tipoPopupOpen]);

  // Foca no input de pesquisa quando o dropdown de órgão abrir
  useEffect(() => {
    if (orgaoPopupOpen) {
      // Delay maior para garantir que o popover e o input estejam totalmente renderizados
      const timeoutId = setTimeout(() => {
        // Tenta usar a ref primeiro
        if (orgaoSearchInputRef.current) {
          orgaoSearchInputRef.current.focus();
        } else {
          // Fallback: busca o input no DOM
          const input = document.querySelector('[cmdk-input]') as HTMLInputElement;
          if (input) {
            input.focus();
          }
        }
      }, 200);
      
      // Tenta focar novamente após um delay adicional para garantir
      const timeoutId2 = setTimeout(() => {
        if (orgaoSearchInputRef.current) {
          orgaoSearchInputRef.current.focus();
        } else {
          const input = document.querySelector('[cmdk-input]') as HTMLInputElement;
          if (input) {
            input.focus();
          }
        }
      }, 300);
      
      return () => {
        clearTimeout(timeoutId);
        clearTimeout(timeoutId2);
      };
    }
  }, [orgaoPopupOpen]);

  // Abre o popover de Órgão quando recebe foco via TAB (não via clique)
  useEffect(() => {
    const orgaoButton = document.querySelector('[role="combobox"][tabindex="5"]') as HTMLElement;
    if (!orgaoButton) return;

    const handleFocus = (e: FocusEvent) => {
      // Verifica se o foco veio de um clique ou de TAB
      // Se relatedTarget existe, provavelmente veio de outro elemento (TAB)
      const cameFromTab = e.relatedTarget !== null;
      if (cameFromTab && !orgaoPopupOpen) {
        // Foco veio via TAB, abre o popover
        setOrgaoPopupOpen(true);
        // Aguarda o popover abrir e foca no input
        setTimeout(() => {
          if (orgaoSearchInputRef.current) {
            orgaoSearchInputRef.current.focus();
          } else {
            const input = document.querySelector('[cmdk-input]') as HTMLInputElement;
            if (input) {
              input.focus();
            }
          }
        }, 200);
      }
    };

    orgaoButton.addEventListener('focus', handleFocus);
    return () => orgaoButton.removeEventListener('focus', handleFocus);
  }, [orgaoPopupOpen]);

  // Valida o orgão quando os orgãos são carregados e há uma licitação com orgão preenchido
  // Se vier da consulta (tem id na URL), sempre valida. Se for busca PNCP, só valida se o checkbox UASG estiver marcado
  useEffect(() => {
    // Verifica se vem da consulta (tem id na URL sem naoPreencherNumero)
    const vemDaConsulta = contratacaoId && searchParams.get('naoPreencherNumero') !== 'true';
    
    // Se não vier da consulta e o checkbox não estiver marcado, não valida
    if (!vemDaConsulta && !autoPreencherUASG) {
      return;
    }
    
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
  }, [orgaos.length, formData.id, formData.orgao_pncp, autoPreencherUASG, contratacaoId, searchParams]);

  // Detecta quando o texto do textarea corresponde apenas a um nome de órgão e abre o popup automaticamente
  useEffect(() => {
    // Só funciona se o popup não estiver aberto e houver órgãos carregados
    if (buscarOrgaoPopupOpen || orgaos.length === 0) return;
    
    const conteudo = formData.conteudo || '';
    const conteudoTrim = conteudo.trim();
    
    // Ignora se o conteúdo estiver vazio ou tiver múltiplas linhas
    if (!conteudoTrim || conteudoTrim.includes('\n')) {
      // Se o conteúdo mudou e não corresponde mais ao ignorado, limpa a flag
      if (conteudoIgnorado && conteudoTrim !== conteudoIgnorado) {
        setConteudoIgnorado('');
      }
      return;
    }
    
    // Se o usuário já fechou o popup para este conteúdo, não reabre
    const conteudoNormalizado = conteudoTrim.toLowerCase().replace(/\s+/g, ' ').trim();
    const ignoradoNormalizado = conteudoIgnorado.toLowerCase().replace(/\s+/g, ' ').trim();
    if (conteudoNormalizado === ignoradoNormalizado && conteudoIgnorado) {
      return;
    }
    
    // Verifica se o conteúdo corresponde apenas a um nome de órgão (ou parte dele)
    // Remove espaços extras e normaliza
    
    // Verifica se algum órgão corresponde ao texto digitado
    const orgaoEncontrado = orgaos.find(orgao => {
      const nomeOrgaoNormalizado = orgao.nome_orgao.toLowerCase().replace(/\s+/g, ' ').trim();
      
      // Verifica se o texto digitado corresponde exatamente ou é parte do nome do órgão
      // E vice-versa: se o nome do órgão corresponde ao texto digitado
      return nomeOrgaoNormalizado === conteudoNormalizado || 
             nomeOrgaoNormalizado.startsWith(conteudoNormalizado) ||
             conteudoNormalizado.startsWith(nomeOrgaoNormalizado);
    });
    
    // Se encontrou um órgão e o texto corresponde apenas ao nome (sem outros caracteres)
    if (orgaoEncontrado) {
      const nomeOrgaoNormalizado = orgaoEncontrado.nome_orgao.toLowerCase().replace(/\s+/g, ' ').trim();
      
      // Verifica se o texto corresponde exatamente ou é uma parte inicial do nome do órgão
      // E não contém outros caracteres além do nome do órgão
      // Mínimo de 3 caracteres para evitar abertura muito precoce
      if (nomeOrgaoNormalizado === conteudoNormalizado || 
          (conteudoNormalizado.length >= 3 && nomeOrgaoNormalizado.startsWith(conteudoNormalizado))) {
        // Usa um timeout para evitar abertura imediata enquanto o usuário está digitando
        const timeoutId = setTimeout(() => {
          // Verifica novamente se o conteúdo ainda corresponde (pode ter mudado)
          const conteudoAtual = (formData.conteudo || '').trim();
          const conteudoAtualNormalizado = conteudoAtual.toLowerCase().replace(/\s+/g, ' ').trim();
          const ignoradoAtualNormalizado = conteudoIgnorado.toLowerCase().replace(/\s+/g, ' ').trim();
          
          // Não abre se o conteúdo foi ignorado ou se o popup já está aberto
          if (conteudoAtual === conteudoTrim && 
              !buscarOrgaoPopupOpen && 
              conteudoAtualNormalizado !== ignoradoAtualNormalizado) {
            setTermoInicialOrgao(conteudoTrim);
            setBuscarOrgaoPopupOpen(true);
          }
        }, 500); // Aguarda 500ms após parar de digitar
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [formData.conteudo, orgaos, buscarOrgaoPopupOpen, conteudoIgnorado]);

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
      
      // Ao começar a digitar para pesquisar, fecha o modal de palavras-chave
      if (palavrasChavesModalOpen && (e.key === 'Backspace' || e.key === 'Delete' || e.key === ' ' || /^[a-zA-Z0-9]$/.test(e.key))) {
        setPalavrasChavesModalOpen(false);
        setPalavrasChavesModalItem(null);
        setPalavrasChavesFloatingPos(null);
      }
      
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
        
        // Se houver uma atividade destacada, marca/desmarca o checkbox
        if (highlightedAtividadeId) {
          toggleRamo(highlightedAtividadeId);
          // Limpa o buffer de pesquisa ao marcar
          setSearchBuffer('');
          if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
          }
          return;
        }
        
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
  }, [searchBuffer, ramos, highlightedAtividadeId, palavrasChavesModalOpen]);

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
      const orderMap = new Map(
        ORDEM_ARVORE_ATIVIDADES.map((nome, i) => [nome.trim().toLowerCase(), i])
      );
      sortTreeByDocumentOrder(tree, orderMap);
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

  /** Ordena a árvore conforme docs/ordem-arvore-de-atividades-licitacao.md */
  const sortTreeByDocumentOrder = (nodes: RamoAtividade[], orderMap: Map<string, number>): void => {
    nodes.sort((a, b) => {
      const keyA = a.nome.trim().toLowerCase();
      const keyB = b.nome.trim().toLowerCase();
      const idxA = orderMap.get(keyA) ?? 1e9;
      const idxB = orderMap.get(keyB) ?? 1e9;
      return idxA - idxB;
    });
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        sortTreeByDocumentOrder(node.children, orderMap);
      }
    });
  };

  /** Atualiza palavras_chaves de um nó na árvore por id (retorna nova árvore imutável) */
  const updateRamoPalavrasChavesInTree = (nodes: RamoAtividade[], ramoId: string, novasPalavras: string[]): RamoAtividade[] => {
    return nodes.map(node => {
      if (node.id === ramoId) {
        return { ...node, palavras_chaves: novasPalavras };
      }
      if (node.children?.length) {
        return { ...node, children: updateRamoPalavrasChavesInTree(node.children, ramoId, novasPalavras) };
      }
      return node;
    });
  };

  const handleSalvarPalavrasChaves = async () => {
    if (!palavrasChavesModalItem) return;
    const parsed = palavrasChavesEditValue
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    setPalavrasChavesSaving(true);
    try {
      const { error } = await supabase
        .from('ramos_de_atividade')
        .update({ palavras_chaves: parsed })
        .eq('id', palavrasChavesModalItem.id);
      if (error) throw error;
      setRamos(prev => updateRamoPalavrasChavesInTree(prev, palavrasChavesModalItem.id, parsed));
      setPalavrasChavesModalItem(prev => prev ? { ...prev, palavras_chaves: parsed } : null);
      toast.success('Palavras-chave atualizadas.');
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar palavras-chave.');
    } finally {
      setPalavrasChavesSaving(false);
    }
  };

  // Formata o conteúdo da licitação no layout padrão
  const formatarConteudoLicitacao = (licitacao: any): string => {
    const formatarDataHora = (data: string | null) => {
      if (!data) return 'Não informado';
      
      // Parse manual da data para evitar problemas de timezone
      // Formato esperado: YYYY-MM-DDTHH:mm:ss ou YYYY-MM-DDTHH:mm:ss-03:00
      const partes = data.split('T');
      if (partes.length < 2) {
        // Se não tiver hora, assume apenas data
        const partesData = data.split('-');
        if (partesData.length === 3) {
          const dia = partesData[2].padStart(2, '0');
          const mes = partesData[1].padStart(2, '0');
          const ano = partesData[0];
          return `${dia}/${mes}/${ano}`;
        }
        return 'Não informado';
      }
      
      const dataParte = partes[0]; // YYYY-MM-DD
      const horaParte = partes[1]; // HH:mm:ss ou HH:mm:ss-03:00
      
      // Extrai apenas a hora e minuto (ignora segundos e timezone)
      const horaMinuto = horaParte.split(':');
      const hora = horaMinuto[0]?.padStart(2, '0') || '21';
      const minuto = horaMinuto[1]?.padStart(2, '0') || '00';
      
      // Parse da data (YYYY-MM-DD)
      const partesData = dataParte.split('-');
      if (partesData.length === 3) {
        const dia = partesData[2].padStart(2, '0');
        const mes = partesData[1].padStart(2, '0');
        const ano = partesData[0];
        return `${dia}/${mes}/${ano}`;
      }
      
      return 'Não informado';
    };

    const formatarValor = (valor: number | null) => {
      if (!valor) return 'Não informado';
      return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const modalidadeDescricao = licitacao.modalidade || licitacao.modalidade_ativa || 'Não informado';
    const numLicitacao = licitacao.num_licitacao || 'S/N';
    const anoCompra = licitacao.ano_compra || new Date().getFullYear();
    const titulo = licitacao.titulo || 'Não informado';

    const linhas = [
      `${modalidadeDescricao} – Nº ${titulo}/${anoCompra}`,
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
    
    // Verifica se deve preencher o número automaticamente
    const naoPreencherNumero = searchParams.get('naoPreencherNumero') === 'true';
    
    // Remove o parâmetro da URL após ler
    if (naoPreencherNumero) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('naoPreencherNumero');
      setSearchParams(newSearchParams, { replace: true });
    }
    
    const { data, error } = await supabase
      .from('contratacoes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      // Se for cadastro Manual, usa o conteúdo diretamente sem formatação
      // Se for PNCP, formata o conteúdo no padrão se não tiver conteúdo formatado
      let conteudoFormatado = '';
      if (data.tipo_cadastro === 'Manual') {
        // Manual: usa o conteúdo direto do banco (pode estar em conteudo ou textos_cadastro_manual)
        conteudoFormatado = data.textos_cadastro_manual || data.conteudo || '';
      } else {
        // PNCP: formata no padrão se não tiver conteúdo formatado
        conteudoFormatado = data.conteudo?.includes('Local:') 
          ? data.conteudo 
          : formatarConteudoLicitacao(data);
      }

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

      // Formata num_licitacao baseado no tipo_cadastro:
      // - Se tipo_cadastro = 'pncp': SEMPRE usa sequencial_compra/ano_compra
      // - Se tipo_cadastro = 'Manual': usa num_licitacao do banco
      // - Se naoPreencherNumero = true: não preenche o número (deixa vazio)
      let numLicitacaoFormatado = '';
      if (!naoPreencherNumero) {
        if (data.tipo_cadastro === 'pncp') {
          // PNCP: SEMPRE usa sequencial_compra/ano_compra
          if (sequencialCompra !== null && anoCompra !== null) {
            numLicitacaoFormatado = `${sequencialCompra}/${anoCompra}`;
          }
        } else if (data.tipo_cadastro === 'Manual') {
          // Manual: usa num_licitacao do banco
          numLicitacaoFormatado = data.num_licitacao || '';
        } else {
          // Fallback: se não tiver tipo_cadastro definido, tenta usar sequencial_compra/ano_compra
          if (sequencialCompra !== null && anoCompra !== null) {
            numLicitacaoFormatado = `${sequencialCompra}/${anoCompra}`;
          } else if (data.num_licitacao && data.num_licitacao.trim() !== '') {
            numLicitacaoFormatado = data.num_licitacao;
          }
        }
      }

      // Mantém a UF selecionada: sempre usa a UF da licitação se existir
      // Se não tiver UF na licitação, mantém a UF anteriormente selecionada no formulário
      const ufParaManter = data.uf || formData.pncp || '';

      // Verifica se é uma busca do PNCP (tem naoPreencherNumero) ou se vem da consulta
      // Se vem da consulta (sem naoPreencherNumero), sempre preenche automaticamente
      // Se é busca do PNCP (com naoPreencherNumero), respeita os checkboxes
      const isBuscaPNCP = naoPreencherNumero;

      // Prepara os valores baseados nos checkboxes de preenchimento automático
      // Se vier da consulta, sempre preenche. Se for busca PNCP, respeita os checkboxes
      // UASG = Órgão, DATA = Data Licitação, TIPO = Tipo
      let orgaoParaPreencher = '';
      if (isBuscaPNCP) {
        // Busca do PNCP: só preenche se checkbox UASG estiver marcado
        orgaoParaPreencher = autoPreencherUASG ? orgaoValido : (formData.orgao_pncp || '');
      } else {
        // Vem da consulta: sempre preenche
        orgaoParaPreencher = orgaoValido;
      }
      
      // Lógica de preenchimento da data: se for busca PNCP, respeita o checkbox DATA
      let dataParaPreencher = '';
      if (isBuscaPNCP) {
        // Busca do PNCP: só preenche se checkbox DATA estiver marcado
        if (autoPreencherDATA && data.dt_encerramento_proposta) {
          dataParaPreencher = formatarDataISO(data.dt_encerramento_proposta);
        } else {
          // Se checkbox DATA não está marcado, mantém o valor atual do formulário
          dataParaPreencher = formData.dt_publicacao || '';
        }
      } else {
        // Vem da consulta: sempre preenche se houver data disponível
        if (data.dt_encerramento_proposta) {
          dataParaPreencher = formatarDataISO(data.dt_encerramento_proposta);
        }
      }
      
      // Lógica de preenchimento do tipo: se for busca PNCP, respeita o checkbox TIPO
      let tipoParaPreencher = '';
      let descricaoModalidadeParaPreencher = null;
      if (isBuscaPNCP) {
        // Busca do PNCP: só preenche se checkbox TIPO estiver marcado
        if (autoPreencherTIPO) {
          tipoParaPreencher = tipoId || '';
          descricaoModalidadeParaPreencher = tipoId || null;
        } else {
          // Se checkbox TIPO não está marcado, mantém o valor atual do formulário
          tipoParaPreencher = formData.modalidade || '';
          descricaoModalidadeParaPreencher = formData.descricao_modalidade || null;
        }
      } else {
        // Vem da consulta: sempre preenche
        tipoParaPreencher = tipoId || '';
        descricaoModalidadeParaPreencher = tipoId || null;
      }

      setFormData({
        ...data,
        num_ativa: numAtivaFormatado,
        cadastrado_por: nomeUsuario,
        pncp: ufParaManter, // Mantém a UF selecionada
        modalidade: tipoParaPreencher,
        descricao_modalidade: descricaoModalidadeParaPreencher,
        orgao_pncp: orgaoParaPreencher, // Preenche automaticamente se vier da consulta, ou respeita checkbox se for busca PNCP
        dt_publicacao: dataParaPreencher, // Preenche automaticamente se vier da consulta, ou respeita checkbox se for busca PNCP
        dt_vinculo_ativa: data.dt_vinculo_ativa || null, // Mantém dt_vinculo_ativa do banco
        link_processo: data.link_processo || null,
        links: data.links || [],
        conteudo: conteudoFormatado,
        sequencial_compra: naoPreencherNumero ? null : sequencialCompra,
        ano_compra: naoPreencherNumero ? null : anoCompra,
        num_licitacao: numLicitacaoFormatado,
      });
      // Revisão: marcado apenas quando cadastrada E já enviada em relatório ao cliente
      setRevisao(data.cadastrado === true && data.enviada === true);
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
      // Adiciona parâmetro para indicar que não deve preencher o número automaticamente
      navigate(`/licitacoes/cadastro?id=${data.id}&naoPreencherNumero=true`);
      // O useEffect vai detectar a mudança no contratacaoId e carregar a licitação automaticamente
      
    } catch (error) {
      console.error('Erro ao buscar próxima licitação:', error);
      toast.error('Erro ao buscar próxima licitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleLicitacaoEncontrada = async (licitacao: any, ramos: string[]) => {
    // Se for cadastro Manual, usa o conteúdo diretamente sem formatação
    // Se for PNCP, formata o conteúdo no padrão
    let conteudoFormatado = '';
    if (licitacao.tipo_cadastro === 'Manual') {
      // Manual: usa o conteúdo direto do banco (pode estar em conteudo ou textos_cadastro_manual)
      conteudoFormatado = licitacao.textos_cadastro_manual || licitacao.conteudo || '';
    } else {
      // PNCP: formata no padrão
      conteudoFormatado = formatarConteudoLicitacao(licitacao);
    }

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

    // Formata num_licitacao baseado no tipo_cadastro:
    // - Se tipo_cadastro = 'pncp': SEMPRE usa sequencial_compra/ano_compra
    // - Se tipo_cadastro = 'Manual': usa num_licitacao do banco
    let numLicitacaoFormatado = '';
    if (licitacao.tipo_cadastro === 'pncp') {
      // PNCP: SEMPRE usa sequencial_compra/ano_compra
      if (sequencialCompra !== null && anoCompra !== null) {
        numLicitacaoFormatado = `${sequencialCompra}/${anoCompra}`;
      }
    } else if (licitacao.tipo_cadastro === 'Manual') {
      // Manual: usa num_licitacao do banco
      numLicitacaoFormatado = licitacao.num_licitacao || '';
    } else {
      // Fallback: se não tiver tipo_cadastro definido, tenta usar sequencial_compra/ano_compra
      if (sequencialCompra !== null && anoCompra !== null) {
        numLicitacaoFormatado = `${sequencialCompra}/${anoCompra}`;
      } else if (licitacao.num_licitacao && licitacao.num_licitacao.trim() !== '') {
        numLicitacaoFormatado = licitacao.num_licitacao;
      }
    }

    // Preenche o formulário com os dados da licitação encontrada
    setFormData({
      ...licitacao,
      num_ativa: numAtivaFormatado,
      cadastrado_por: nomeUsuario,
      pncp: licitacao.cd_pn || '',
      modalidade: tipoId || '',
      orgao_pncp: orgaoValido,
      dt_publicacao: licitacao.dt_encerramento_proposta 
        ? formatarDataISO(licitacao.dt_encerramento_proposta)
        : '',
      dt_vinculo_ativa: licitacao.dt_vinculo_ativa || null, // Inclui dt_vinculo_ativa se existir
      link_processo: licitacao.link_processo || null,
      links: licitacao.links || [],
      conteudo: conteudoFormatado,
      sequencial_compra: sequencialCompra,
      ano_compra: anoCompra,
      num_licitacao: numLicitacaoFormatado,
    });
    // Revisão: marcado apenas quando cadastrada E já enviada em relatório ao cliente
    setRevisao(licitacao.cadastrado === true && licitacao.enviada === true);
    
    // Marca os ramos de atividade
    setSelectedRamos(ramos);
  };

  const handleSave = async () => {
    // Verifica se há atividades selecionadas antes de salvar
    if (selectedRamos.length === 0) {
      setAtividadesVaziasDialogOpen(true);
      return;
    }

    // Se chegou aqui, há atividades selecionadas, então salva normalmente
    await salvarLicitacao();
  };

  const salvarLicitacao = async () => {
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

      // Verificação de duplicidade: Tipo, Número (sequencial_compra + ano_compra), Órgão e Conteúdo
      const licitacaoId = formData.id || contratacaoId;
      const conteudoParaVerificar = (formData.conteudo || '').trim();
      
      // Função para normalizar strings (remove acentos, converte para minúsculas, remove espaços extras)
      const normalizarString = (str: string | null | undefined): string => {
        if (!str) return '';
        return String(str)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/\r\n/g, ' ') // Substitui quebras de linha Windows por espaço
          .replace(/\n/g, ' ') // Substitui quebras de linha Unix por espaço
          .replace(/\r/g, ' ') // Substitui carriage return por espaço
          .replace(/\s+/g, ' ') // Substitui múltiplos espaços por um único espaço
          .trim();
      };

      // Normaliza o conteúdo para comparação
      const conteudoNormalizado = normalizarString(conteudoParaVerificar);
      
      // Busca licitações com os mesmos dados básicos (Tipo, Número, Órgão)
      // Garante que os valores numéricos sejam do tipo correto
      const sequencialCompra = Number(formData.sequencial_compra);
      const anoCompra = Number(formData.ano_compra);
      
      let query = supabase
        .from('contratacoes')
        .select('id, descricao_modalidade, sequencial_compra, ano_compra, orgao_pncp, conteudo, textos_cadastro_manual')
        .eq('descricao_modalidade', tipoIdParaSalvar)
        .eq('sequencial_compra', sequencialCompra)
        .eq('ano_compra', anoCompra);

      const { data: licitacoesCandidatas, error: errorVerificacao } = await query;

      if (errorVerificacao) {
        console.error('Erro ao verificar duplicidade:', errorVerificacao);
        toast.error('Erro ao verificar duplicidade. Tente novamente.');
        setSaving(false);
        return;
      }

      // Log para debug
      console.log('Verificação de duplicidade:', {
        tipoId: tipoIdParaSalvar,
        sequencial: sequencialCompra,
        ano: anoCompra,
        orgao: orgaoParaSalvar,
        conteudoLength: conteudoParaVerificar.length,
        candidatasEncontradas: licitacoesCandidatas?.length || 0,
        licitacaoIdAtual: licitacaoId
      });

      // Filtra pelas que têm o mesmo órgão (comparação normalizada) e mesmo conteúdo
      if (licitacoesCandidatas && licitacoesCandidatas.length > 0) {
        const licitacaoDuplicada = licitacoesCandidatas.find((lic: any) => {
          // Normaliza o órgão para comparação
          const orgaoExistenteNormalizado = normalizarString(lic.orgao_pncp || '');
          const orgaoNovoNormalizado = normalizarString(orgaoParaSalvar);
          
          // Se os órgãos não coincidem, não é duplicata
          if (orgaoExistenteNormalizado !== orgaoNovoNormalizado) {
            return false;
          }

          // Compara o conteúdo (pode estar em conteudo ou textos_cadastro_manual)
          const conteudoExistente = (lic.conteudo || lic.textos_cadastro_manual || '').trim();
          
          // Normaliza o conteúdo existente para comparação
          const conteudoExistenteNormalizado = normalizarString(conteudoExistente);
          
          // Compara os conteúdos normalizados (mesmo se ambos forem vazios, serão iguais)
          return conteudoExistenteNormalizado === conteudoNormalizado;
        });

        // Se encontrou duplicata e não é a mesma licitação (não é UPDATE)
        // Se licitacaoId for null/undefined, é um novo cadastro, então qualquer duplicata deve bloquear
        if (licitacaoDuplicada && (!licitacaoId || licitacaoDuplicada.id !== licitacaoId)) {
          console.log('Duplicata encontrada:', {
            idExistente: licitacaoDuplicada.id,
            idAtual: licitacaoId,
            tipo: tipoIdParaSalvar,
            sequencial: sequencialCompra,
            ano: anoCompra,
            orgao: orgaoParaSalvar,
            conteudoExistenteLength: (licitacaoDuplicada.conteudo || licitacaoDuplicada.textos_cadastro_manual || '').length,
            conteudoNovoLength: conteudoParaVerificar.length
          });
          setSaving(false);
          setDuplicidadeDialogOpen(true);
          return;
        }
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
      // Para cadastros manuais, o conteúdo é salvo exatamente como está no textarea
      let conteudoParaSalvar: string | null = null;
      if (isCadastroManual) {
        // Manual: salva exatamente o que está no textarea, sem formatação
        conteudoParaSalvar = formData.conteudo || null;
      } else {
        // PNCP: mantém o conteúdo formatado (já vem formatado do banco ou foi formatado)
        conteudoParaSalvar = formData.conteudo || null;
      }

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
        conteudo: conteudoParaSalvar, // Conteúdo a ser salvo (formatado para PNCP, direto para Manual)
        textos_cadastro_manual: isCadastroManual && conteudoParaSalvar ? conteudoParaSalvar : null,
        links: formData.links || [],
        link_processo: formData.link_processo || null,
      };

      // Atualiza updated_at automaticamente quando cadastrado = true
      if (dataToSave.cadastrado === true) {
        dataToSave.updated_at = dataAtual;
      }

      // Adiciona num_ativa apenas para cadastros manuais (novas licitações)
      if (numAtivaParaSalvar !== null) {
        dataToSave.num_ativa = numAtivaParaSalvar;
      }

      // Garante que num_licitacao seja salvo com o valor formatado completo (preservando zeros à esquerda)
      // Usa o valor digitado pelo usuário no campo (formData.num_licitacao) que já preserva os zeros
      if (formData.num_licitacao && formData.num_licitacao.trim() !== '') {
        dataToSave.num_licitacao = formData.num_licitacao.trim();
      } else if (formData.sequencial_compra !== null && formData.ano_compra !== null) {
        // Fallback: se não tiver num_licitacao formatado, monta a partir dos números
        // Mas preserva os zeros à esquerda usando o valor original do campo se disponível
        dataToSave.num_licitacao = `${formData.sequencial_compra}/${formData.ano_compra}`;
      }

      // Converte dt_publicacao do formulário para dt_encerramento_proposta no banco
      // Sempre salva em dt_encerramento_proposta em horário de Brasília (21:00)
      if (formData.dt_publicacao && formData.dt_publicacao.trim() !== '') {
        const dataParseada = parsearData(formData.dt_publicacao);
        if (dataParseada) {
          // Usa os valores diretamente do parse para evitar problemas de fuso horário
          const ano = dataParseada.getFullYear();
          const mes = String(dataParseada.getMonth() + 1).padStart(2, '0');
          const dia = String(dataParseada.getDate()).padStart(2, '0');
          
          // Cria a data em horário de Brasília (UTC-3) às 21:00
          // Formato ISO com timezone: YYYY-MM-DDTHH:mm:ss-03:00
          dataToSave.dt_encerramento_proposta = `${ano}-${mes}-${dia}T21:00:00-03:00`;
          
          // Remove dt_publicacao do dataToSave se existir (não deve ser salvo)
          delete dataToSave.dt_publicacao;
        } else {
          // Se não conseguir parsear, define como null
          dataToSave.dt_encerramento_proposta = null;
          delete dataToSave.dt_publicacao;
        }
      } else {
        // Se estiver vazio ou não existir, define como null (permitido para cadastros manuais)
        dataToSave.dt_encerramento_proposta = null;
        delete dataToSave.dt_publicacao;
      }

      // Remove o id se ainda estiver presente (não deve ser salvo no objeto)
      // Mas salvamos a referência para determinar se é UPDATE ou INSERT
      // licitacaoId já foi declarado anteriormente na verificação de duplicidade
      delete dataToSave.id;

      let contratacaoIdToUse = licitacaoId;

      // Se tem ID (da URL ou do formData), faz UPDATE
      // Se não tem ID, faz INSERT (nova licitação)
      if (licitacaoId) {
        // Em UPDATE, não altera num_ativa (mantém o valor original do banco)
        // Remove num_ativa se estiver presente no dataToSave
        delete dataToSave.num_ativa;
        
        // Garante que updated_at seja sempre atualizado quando cadastrado = true
        if (dataToSave.cadastrado === true) {
          dataToSave.updated_at = dataAtual;
        }
        
        const { error } = await supabase
          .from('contratacoes')
          .update(dataToSave)
          .eq('id', licitacaoId);
        if (error) throw error;
        contratacaoIdToUse = licitacaoId;
      } else {
        // Garante que updated_at seja sempre atualizado quando cadastrado = true
        if (dataToSave.cadastrado === true) {
          dataToSave.updated_at = dataAtual;
        }
        
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

  // Função para lidar com a confirmação do popup de atividades vazias
  const handleConfirmarAtividadesVazias = async () => {
    setAtividadesVaziasDialogOpen(false);
    toast.info('A administração irá ajudar você a marcar a atividade correta.');
    await salvarLicitacao();
  };

  const handleCancelarAtividadesVazias = () => {
    setAtividadesVaziasDialogOpen(false);
  };

  // Atalho Ctrl+S para salvar licitação
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Verifica se é Ctrl+S (ou Cmd+S no Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        // Sempre previne o comportamento padrão (salvar página do navegador)
        e.preventDefault();
        e.stopPropagation();
        
        // Verifica se está digitando em um input ou textarea
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true'
        );
        
        // Se estiver em um input/textarea, apenas previne o comportamento padrão mas não salva
        // Isso permite que o usuário continue digitando sem salvar acidentalmente
        if (isInputFocused) {
          return;
        }
        
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

    window.addEventListener('keydown', handleKeyDown, true); // Usa capture phase para interceptar antes
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [saving, formData.modalidade, formData.orgao_pncp, formData.sequencial_compra, formData.ano_compra, tipos, orgaos, handleSave]);

  const handleDelete = async () => {
    if (!contratacaoId) return;

    try {
      const { error } = await supabase
        .from('contratacoes')
        .delete()
        .eq('id', contratacaoId);
      if (error) throw error;
      toast.success('Licitação excluída!');
      setDeleteDialogOpen(false);
      window.history.back();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
      setDeleteDialogOpen(false);
    }
  };

  const handleLimpar = () => {
    // Preserva o valor de PNCP se for uma UF válida
    const pncpAtual = formData.pncp;
    const pncpPreservado = pncpAtual && UFS.includes(pncpAtual) ? pncpAtual : '';
    
    // Limpa todos os campos do formulário, exceto PNCP se for uma UF válida
    setFormData({
      num_ativa: '',
      cadastrado_por: '',
      pncp: pncpPreservado,
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
    setRevisao(false);
    
    // Fecha popovers se estiverem abertos
    setTipoPopupOpen(false);
    setOrgaoPopupOpen(false);
    setLinksPopupOpen(false);
    setBuscarPopupOpen(false);
    
    toast.success('Todos os campos foram limpos!');
  };

  // Extrai o número do num_ativa (formato: "numero.mes/ano" -> retorna apenas o número)
  // Pode receber string, número ou null/undefined
  const extrairNumeroAtiva = (numAtiva: string | number | null | undefined): number | null => {
    if (numAtiva === null || numAtiva === undefined) return null;
    
    // Se for número, retorna diretamente
    if (typeof numAtiva === 'number') {
      return isNaN(numAtiva) ? null : numAtiva;
    }
    
    // Se for string, processa
    const numAtivaStr = String(numAtiva).trim();
    if (numAtivaStr === '') return null;
    
    // Remove espaços e pega a parte antes do ponto
    const parteNumerica = numAtivaStr.split('.')[0];
    const numero = parseInt(parteNumerica, 10);
    return isNaN(numero) ? null : numero;
  };

  // Busca todas as licitações com num_ativa usando paginação (Supabase limita a 1000 por padrão)
  const buscarTodasLicitacoesComNumAtiva = async () => {
    const todasLicitacoes: Array<{ id: string; num_ativa: string | number | null }> = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('contratacoes')
        .select('id, num_ativa')
        .not('num_ativa', 'is', null)
        .order('num_ativa', { ascending: true }) // Ordena por num_ativa antes de paginar
        .range(from, from + pageSize - 1);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        todasLicitacoes.push(...data);
        from += pageSize;
        hasMore = data.length === pageSize; // Se retornou menos que pageSize, não há mais registros
      } else {
        hasMore = false;
      }
    }

    return todasLicitacoes;
  };

  const handleAnterior = async () => {
    setLoading(true);
    try {
      // Busca o num_ativa atual da licitação no banco (não do formData formatado)
      let numAtivaAtual: number | null = null;
      if (contratacaoId) {
        const { data: licitacaoAtual } = await supabase
          .from('contratacoes')
          .select('num_ativa')
          .eq('id', contratacaoId)
          .maybeSingle();
        
        if (licitacaoAtual?.num_ativa) {
          numAtivaAtual = extrairNumeroAtiva(licitacaoAtual.num_ativa);
        }
      }
      
      // Se não encontrou no banco, tenta extrair do formData (pode estar formatado)
      if (numAtivaAtual === null && formData.num_ativa) {
        numAtivaAtual = extrairNumeroAtiva(formData.num_ativa);
      }
      
      // Busca todas as licitações com num_ativa usando paginação (para buscar todos os 7001 registros)
      let todasLicitacoes;
      try {
        todasLicitacoes = await buscarTodasLicitacoesComNumAtiva();
      } catch (error) {
        console.error('Erro ao buscar licitações:', error);
        toast.error('Erro ao buscar licitação anterior. Tente novamente.');
        setLoading(false);
        return;
      }

      if (!todasLicitacoes || todasLicitacoes.length === 0) {
        toast.info('Nenhuma licitação cadastrada encontrada.');
        setLoading(false);
        return;
      }

      // Converte num_ativa para número e ordena numericamente
      const licitacoesComNumero = todasLicitacoes
        .map(l => {
          const numExtraido = extrairNumeroAtiva(l.num_ativa);
          return {
            id: l.id,
            numAtiva: numExtraido,
            numAtivaOriginal: l.num_ativa
          };
        })
        .filter(l => l.numAtiva !== null && typeof l.numAtiva === 'number');

      // Ordena numericamente (garantindo que são números)
      const licitacoesOrdenadas = licitacoesComNumero.sort((a, b) => {
        const numA = a.numAtiva as number;
        const numB = b.numAtiva as number;
        return numA - numB;
      });

      if (licitacoesOrdenadas.length === 0) {
        toast.info('Nenhuma licitação com número válido encontrada.');
        setLoading(false);
        return;
      }


      let licitacaoEncontrada;
      if (numAtivaAtual === null) {
        // Se não tem num_ativa atual, busca a menor (primeira)
        licitacaoEncontrada = licitacoesOrdenadas[0];
      } else {
        // Busca a licitação com num_ativa menor (anterior)
        // Filtra apenas as que são menores que o atual e pega a maior entre elas
        const menoresQueAtual = licitacoesOrdenadas
          .filter(l => (l.numAtiva as number) < numAtivaAtual)
          .sort((a, b) => (b.numAtiva as number) - (a.numAtiva as number)); // Ordena decrescente
        
        licitacaoEncontrada = menoresQueAtual[0]; // Pega a primeira (maior entre as menores)
      }

      if (!licitacaoEncontrada || !licitacaoEncontrada.id) {
        if (numAtivaAtual === null) {
          toast.info('Nenhuma licitação cadastrada encontrada.');
        } else {
          toast.info('Não há licitação anterior.');
        }
        setLoading(false);
        return;
      }

      // Navega para a licitação encontrada
      navigate(`/licitacoes/cadastro?id=${licitacaoEncontrada.id}`);
    } catch (error) {
      console.error('Erro ao buscar licitação anterior:', error);
      toast.error('Erro ao buscar licitação anterior. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleProximo = async () => {
    setLoading(true);
    try {
      // Busca o num_ativa atual da licitação no banco (não do formData formatado)
      let numAtivaAtual: number | null = null;
      if (contratacaoId) {
        const { data: licitacaoAtual } = await supabase
          .from('contratacoes')
          .select('num_ativa')
          .eq('id', contratacaoId)
          .maybeSingle();
        
        if (licitacaoAtual?.num_ativa) {
          numAtivaAtual = extrairNumeroAtiva(licitacaoAtual.num_ativa);
        }
      }
      
      // Se não encontrou no banco, tenta extrair do formData (pode estar formatado)
      if (numAtivaAtual === null && formData.num_ativa) {
        numAtivaAtual = extrairNumeroAtiva(formData.num_ativa);
      }
      
      // Busca todas as licitações com num_ativa usando paginação (para buscar todos os 7001 registros)
      let todasLicitacoes;
      try {
        todasLicitacoes = await buscarTodasLicitacoesComNumAtiva();
      } catch (error) {
        console.error('Erro ao buscar licitações:', error);
        toast.error('Erro ao buscar próxima licitação. Tente novamente.');
        setLoading(false);
        return;
      }

      if (!todasLicitacoes || todasLicitacoes.length === 0) {
        toast.info('Nenhuma licitação cadastrada encontrada.');
        setLoading(false);
        return;
      }

      // Converte num_ativa para número e ordena numericamente
      const licitacoesComNumero = todasLicitacoes
        .map(l => {
          const numExtraido = extrairNumeroAtiva(l.num_ativa);
          return {
            id: l.id,
            numAtiva: numExtraido,
            numAtivaOriginal: l.num_ativa
          };
        })
        .filter(l => l.numAtiva !== null && typeof l.numAtiva === 'number');

      // Ordena numericamente (garantindo que são números)
      const licitacoesOrdenadas = licitacoesComNumero.sort((a, b) => {
        const numA = a.numAtiva as number;
        const numB = b.numAtiva as number;
        return numA - numB;
      });

      if (licitacoesOrdenadas.length === 0) {
        toast.info('Nenhuma licitação com número válido encontrada.');
        setLoading(false);
        return;
      }

      let licitacaoEncontrada;
      if (numAtivaAtual === null) {
        // Se não tem num_ativa atual, busca a maior (última da lista ordenada)
        // Garante que está pegando realmente o maior número
        licitacaoEncontrada = licitacoesOrdenadas.reduce((maior, atual) => {
          const numMaior = maior.numAtiva as number;
          const numAtual = atual.numAtiva as number;
          return numAtual > numMaior ? atual : maior;
        }, licitacoesOrdenadas[0]);
      } else {
        // Busca a próxima sequencial: a menor entre as que são maiores que o atual
        const maioresQueAtual = licitacoesOrdenadas
          .filter(l => (l.numAtiva as number) > numAtivaAtual)
          .sort((a, b) => (a.numAtiva as number) - (b.numAtiva as number));
        
        licitacaoEncontrada = maioresQueAtual[0]; // Pega a primeira (menor entre as maiores)
      }

      if (!licitacaoEncontrada || !licitacaoEncontrada.id) {
        if (numAtivaAtual === null) {
          toast.info('Nenhuma licitação cadastrada encontrada.');
        } else {
          toast.info('Não há próxima licitação.');
        }
        setLoading(false);
        return;
      }

      // Navega para a licitação encontrada
      navigate(`/licitacoes/cadastro?id=${licitacaoEncontrada.id}`);
    } catch (error) {
      console.error('Erro ao buscar próxima licitação:', error);
      toast.error('Erro ao buscar próxima licitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleNovo = () => {
    // Limpa todos os campos do formulário para iniciar um novo cadastro
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
    
    // Remove o ID da URL se existir
    if (contratacaoId) {
      setSearchParams({});
    }
    
    toast.success('Formulário limpo para novo cadastro!');
  };

  const handlePuxarOrgaoUltimaLicitacao = async () => {
    try {
      // Busca a última licitação cadastrada ordenando por updated_at (sempre atualizado quando cadastrado = true)
      // Se não tiver updated_at, ordena por dt_alterado_ativa, depois por dt_vinculo_ativa, depois por created_at
      const { data, error } = await supabase
        .from('contratacoes')
        .select('orgao_pncp, updated_at, dt_alterado_ativa, dt_vinculo_ativa, created_at')
        .eq('cadastrado', true)
        .not('orgao_pncp', 'is', null)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data && data.orgao_pncp && data.orgao_pncp.trim() !== '') {
        setFormData({ ...formData, orgao_pncp: data.orgao_pncp });
        toast.success('Órgão da última licitação cadastrada preenchido!');
      } else {
        // Fallback: tenta buscar por dt_alterado_ativa se não encontrou por updated_at
        const { data: dataFallback, error: errorFallback } = await supabase
          .from('contratacoes')
          .select('orgao_pncp')
          .eq('cadastrado', true)
          .not('orgao_pncp', 'is', null)
          .order('dt_alterado_ativa', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (errorFallback) throw errorFallback;

        if (dataFallback && dataFallback.orgao_pncp && dataFallback.orgao_pncp.trim() !== '') {
          setFormData({ ...formData, orgao_pncp: dataFallback.orgao_pncp });
          toast.success('Órgão da última licitação cadastrada preenchido!');
        } else {
          // Último fallback: busca por created_at
          const { data: dataCreated, error: errorCreated } = await supabase
            .from('contratacoes')
            .select('orgao_pncp')
            .eq('cadastrado', true)
            .not('orgao_pncp', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (errorCreated) throw errorCreated;

          if (dataCreated && dataCreated.orgao_pncp && dataCreated.orgao_pncp.trim() !== '') {
            setFormData({ ...formData, orgao_pncp: dataCreated.orgao_pncp });
            toast.success('Órgão da última licitação cadastrada preenchido!');
          } else {
            toast.warning('Nenhuma licitação cadastrada encontrada.');
          }
        }
      }
    } catch (error: any) {
      toast.error('Erro ao buscar última licitação: ' + error.message);
    }
  };

  const toggleRamo = (ramoId: string) => {
    setSelectedRamos(prev =>
      prev.includes(ramoId)
        ? prev.filter(id => id !== ramoId)
        : [...prev, ramoId]
    );
  };

  const formatarNumeroLicitacao = (): string => {
    // Sempre prioriza num_licitacao do formData (já formatado com zeros à esquerda se existir)
    if (formData.num_licitacao && formData.num_licitacao.trim() !== '') {
      return formData.num_licitacao;
    }
    
    // Fallback: se não tiver num_licitacao formatado, tenta montar de sequencial/ano
    // Mas apenas como último recurso
    if (formData.tipo_cadastro === 'pncp') {
      const sequencial = formData.sequencial_compra;
      const ano = formData.ano_compra;
      if (sequencial !== null && sequencial !== undefined && ano !== null && ano !== undefined) {
        return `${sequencial}/${ano}`;
      }
    }
    // Retorna vazio se não conseguir formatar
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

  // Converte string ISO (YYYY-MM-DD) para DD/MM/AAAA sem problemas de fuso horário
  const formatarDataISO = (dataISO: string | null): string => {
    if (!dataISO || dataISO.trim() === '') return '';
    
    // Parse manual da string ISO para evitar problemas de fuso horário
    const partes = dataISO.split('T')[0].split('-'); // Pega apenas a parte da data (antes do T)
    if (partes.length !== 3) return '';
    
    const ano = parseInt(partes[0]);
    const mes = parseInt(partes[1]);
    const dia = parseInt(partes[2]);
    
    if (isNaN(ano) || isNaN(mes) || isNaN(dia)) return '';
    
    // Formata como DD/MM/AAAA
    return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
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
            onClick={(e) => {
              handleItemClick(item.id);
              const el = e.currentTarget as HTMLElement;
              const rect = el.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              const spaceAbove = rect.top;
              const placement: 'above' | 'below' =
                spaceBelow >= FLOATING_PANEL_ESTIMATED_H || spaceBelow >= spaceAbove ? 'below' : 'above';
              const top =
                placement === 'below'
                  ? rect.bottom + 6
                  : Math.max(8, rect.top - FLOATING_PANEL_ESTIMATED_H - 6);
              let left = rect.left;
              if (left + FLOATING_PANEL_W > window.innerWidth - 8) left = window.innerWidth - FLOATING_PANEL_W - 8;
              if (left < 8) left = 8;
              setPalavrasChavesFloatingPos({ top, left, placement });
              setPalavrasChavesModalItem(item);
              setPalavrasChavesEditValue(item.palavras_chaves?.length ? item.palavras_chaves.join(', ') : '');
              setPalavrasChavesModalOpen(true);
            }}
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
      <div className="flex gap-[16px] h-full overflow-hidden">
        {/* Formulário Central */}
        <div className="flex-1 bg-white rounded-lg border border-border pl-6 pr-6 pt-4 pb-4 flex flex-col relative min-w-[600px] max-w-[1400px] overflow-x-auto">
          {/* Título e Botões de ação */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-[#262626]">Cadastros</h1>
            
            {/* Botões de ação no topo direito */}
            <div className="flex items-center gap-2">
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleNovo}
                className="text-white px-4"
                style={{ backgroundColor: '#414AC8' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3539A3'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#414AC8'}
              >
                <FileText className="w-4 h-4 mr-2" />
                Novo
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setDeleteDialogOpen(true)}
                disabled={!contratacaoId || !formData.num_ativa || formData.num_ativa.trim() === ''}
                className="bg-red-500 hover:bg-red-600 text-white px-4 disabled:opacity-50 disabled:cursor-not-allowed"
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
                variant="secondary" 
                size="icon" 
                onClick={handleAnterior}
                disabled={loading}
                className="rounded-full w-9 h-9 bg-gray-700 hover:bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title="Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button 
                variant="secondary" 
                size="icon" 
                onClick={handleProximo}
                disabled={loading}
                className="rounded-full w-9 h-9 bg-gray-700 hover:bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title="Próximo"
              >
                <ChevronRight className="w-4 h-4" />
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
              <div className="flex items-center justify-between">
                <Label htmlFor="pncp" className="text-sm font-normal text-[#262626]">PNCP</Label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="auto-uasg"
                      checked={autoPreencherUASG}
                      onCheckedChange={(checked) => setAutoPreencherUASG(checked === true)}
                    />
                    <Label htmlFor="auto-uasg" className="text-xs font-normal cursor-pointer">UASG</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="auto-data"
                      checked={autoPreencherDATA}
                      onCheckedChange={(checked) => setAutoPreencherDATA(checked === true)}
                    />
                    <Label htmlFor="auto-data" className="text-xs font-normal cursor-pointer">DATA</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="auto-tipo"
                      checked={autoPreencherTIPO}
                      onCheckedChange={(checked) => setAutoPreencherTIPO(checked === true)}
                    />
                    <Label htmlFor="auto-tipo" className="text-xs font-normal cursor-pointer">TIPO</Label>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Popover 
                  open={pncpPopupOpen} 
                  onOpenChange={(open) => {
                    setPncpPopupOpen(open);
                    if (!open) {
                      setPncpSearchTerm(''); // Limpa a busca quando fechar
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={pncpPopupOpen}
                      className="h-9 flex-1 justify-between font-normal bg-white"
                      tabIndex={1}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && !e.shiftKey) {
                          e.preventDefault();
                          e.stopPropagation();
                          // Fecha o popover de PNCP se estiver aberto
                          if (pncpPopupOpen) {
                            setPncpPopupOpen(false);
                          }
                          // Avança para o próximo campo
                          setTimeout(() => {
                            const tipoButton = document.querySelector('[role="combobox"][tabindex="2"]') as HTMLElement;
                            if (tipoButton) {
                              tipoButton.focus();
                              // Abre o popover de tipo após focar
                              if (!tipoPopupOpen) {
                                setTipoPopupOpen(true);
                              }
                            }
                          }, 100);
                        }
                      }}
                    >
                      {formData.pncp || "Selecione uma UF"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-[--radix-popover-trigger-width] p-0" 
                    align="start"
                    onInteractOutside={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('[role="combobox"]')) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <Command 
                      filter={(value, search) => {
                        return 1;
                      }}
                    >
                      <CommandInput 
                        ref={pncpSearchInputRef}
                        placeholder="Buscar UF..." 
                        value={pncpSearchTerm}
                        onValueChange={(value) => {
                          setPncpSearchTerm(value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab' && !e.shiftKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            // Encontra o item destacado na lista
                            const selectedItem = document.querySelector('[cmdk-item][data-selected="true"], [cmdk-item][aria-selected="true"]') as HTMLElement;
                            let ufToSelect = '';
                            
                            if (selectedItem) {
                              ufToSelect = selectedItem.textContent?.trim() || '';
                            } else {
                              // Se não houver item destacado, seleciona o primeiro da lista
                              const firstItem = document.querySelector('[cmdk-item]') as HTMLElement;
                              if (firstItem) {
                                ufToSelect = firstItem.textContent?.trim() || '';
                              }
                            }
                            
                            // Seleciona a UF diretamente sem chamar handleSelect
                            if (ufToSelect && UFS.includes(ufToSelect)) {
                              // Atualiza o estado primeiro
                              setFormData({ ...formData, pncp: ufToSelect });
                              setPncpSearchTerm('');
                              
                              // Fecha o popover imediatamente
                              setPncpPopupOpen(false);
                              
                              // Aguarda para garantir que o popover feche completamente antes de focar no próximo
                              requestAnimationFrame(() => {
                                requestAnimationFrame(() => {
                                  // Força o fechamento novamente para garantir
                                  setPncpPopupOpen(false);
                                  
                                  // Abre o popover de tipo primeiro
                                  if (!tipoPopupOpen) {
                                    setTipoPopupOpen(true);
                                  }
                                  
                                  // Aguarda o popover abrir e então foca no input de pesquisa
                                  setTimeout(() => {
                                    // Tenta focar no input de pesquisa do tipo
                                    const tipoInput = tipoSearchInputRef.current || 
                                      document.querySelector('[cmdk-input]') as HTMLInputElement;
                                    
                                    if (tipoInput) {
                                      tipoInput.focus();
                                      // Força o foco novamente para garantir
                                      setTimeout(() => {
                                        tipoInput.focus();
                                      }, 50);
                                    } else {
                                      // Fallback: foca no botão se o input não estiver disponível
                                      const tipoButton = document.querySelector('[role="combobox"][tabindex="2"]') as HTMLElement;
                                      if (tipoButton) {
                                        tipoButton.focus();
                                      }
                                    }
                                  }, 200);
                                });
                              });
                            }
                          }
                        }}
                      />
                      {pncpSearchTerm && (
                        <CommandList>
                          <CommandEmpty>Nenhuma UF encontrada.</CommandEmpty>
                          <CommandGroup className="p-0">
                            {UFS
                              .filter((uf) => {
                                if (!pncpSearchTerm) return false;
                                const searchLower = pncpSearchTerm.toLowerCase();
                                const ufLower = uf.toLowerCase();
                                return ufLower.startsWith(searchLower);
                              })
                              .slice(0, 1) // Mostra apenas 1 item
                              .map((uf) => {
                              const handleSelect = () => {
                                setFormData({ ...formData, pncp: uf });
                                setPncpPopupOpen(false);
                                setPncpSearchTerm('');
                                // Não avança automaticamente quando selecionado por clique - deixa o usuário decidir
                              };
                              
                              return (
                                <CommandItem
                                  key={uf}
                                  value={uf}
                                  onSelect={handleSelect}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSelect();
                                  }}
                                  className={cn(
                                    "px-3 py-2 rounded-none cursor-pointer",
                                    formData.pncp === uf
                                      ? "!bg-[#02572E]/10 !text-[#02572E]"
                                      : "!bg-transparent !text-foreground hover:!bg-accent hover:!text-accent-foreground"
                                  )}
                                >
                                  {uf}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      )}
                    </Command>
                  </PopoverContent>
                </Popover>
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
          <div className="grid grid-cols-3 gap-4 mb-4 items-end">
            <div className="space-y-1 flex flex-col">
              <Label htmlFor="tipo" className="text-sm font-normal text-[#262626]">Tipo</Label>
              <div className="flex gap-2">
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
                        className="h-9 flex-1 justify-between font-normal bg-white text-xs min-w-0"
                        tabIndex={2}
                      >
                      <span className="truncate flex-1 text-left">
                        {formData.modalidade
                          ? tipos.find((tipo) => tipo.id === formData.modalidade) 
                            ? `${tipos.find((tipo) => tipo.id === formData.modalidade)?.sigla} - ${tipos.find((tipo) => tipo.id === formData.modalidade)?.descricao}`
                            : "Selecione o Tipo"
                          : "Selecione o Tipo"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 flex-shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-[--radix-popover-trigger-width] p-0" 
                    align="start"
                    onInteractOutside={(e) => {
                      // Permite interação com elementos dentro do popover
                      const target = e.target as HTMLElement;
                      if (target.closest('[role="combobox"]')) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <Command 
                      filter={(value, search) => {
                        // Desabilita o filtro padrão - vamos filtrar manualmente
                        return 1;
                      }}
                    >
                      <CommandInput 
                        ref={tipoSearchInputRef}
                        placeholder="Buscar tipo..." 
                        value={tipoSearchTerm}
                        onValueChange={(value) => {
                          setTipoSearchTerm(value);
                        }}
                        autoFocus={tipoPopupOpen}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab' && !e.shiftKey) {
                            e.preventDefault();
                            // Encontra o item destacado na lista (cmdk usa data-selected ou aria-selected)
                            const selectedItem = document.querySelector('[cmdk-item][data-selected="true"], [cmdk-item][aria-selected="true"]') as HTMLElement;
                            if (selectedItem) {
                              // Dispara o evento de seleção
                              selectedItem.click();
                            } else {
                              // Se não houver item destacado, seleciona o primeiro da lista
                              const firstItem = document.querySelector('[cmdk-item]') as HTMLElement;
                              if (firstItem) {
                                firstItem.click();
                              }
                            }
                            // Fecha o popover
                            setTipoPopupOpen(false);
                            // Avança para o próximo campo (input número)
                            setTimeout(() => {
                              const numeroInput = document.getElementById('num_licitacao') as HTMLElement;
                              if (numeroInput) {
                                numeroInput.focus();
                              }
                            }, 100);
                          }
                        }}
                      />
                      {tipoSearchTerm && (
                        <CommandList>
                          <CommandEmpty>Nenhum tipo encontrado.</CommandEmpty>
                          <CommandGroup className="p-0">
                            {tipos
                              .filter((tipo) => {
                                if (!tipoSearchTerm) return false;
                                // Filtra apenas os que começam com o termo de busca (case insensitive)
                                const searchLower = tipoSearchTerm.toLowerCase();
                                const siglaLower = tipo.sigla?.toLowerCase() || '';
                                return siglaLower.startsWith(searchLower);
                              })
                              .slice(0, 1) // Mostra apenas 1 item
                              .map((tipo) => {
                              const handleSelect = () => {
                                const now = Date.now();
                                const lastTime = lastSelectTimeMap.current.get(tipo.id) || 0;
                                
                                // Previne múltiplas chamadas em menos de 200ms
                                if (now - lastTime < 200) {
                                  return;
                                }
                                lastSelectTimeMap.current.set(tipo.id, now);
                                
                                setFormData({ 
                                  ...formData, 
                                  modalidade: tipo.id, // ID do tipo (para o dropdown)
                                  descricao_modalidade: tipo.id // ID do tipo (UUID) - não a descrição!
                                });
                                setTipoPopupOpen(false);
                                setTipoSearchTerm(''); // Limpa a busca ao selecionar
                              };
                              
                              return (
                                <CommandItem
                                  key={tipo.id}
                                  value={`${tipo.sigla} ${tipo.descricao || ''}`}
                                  onSelect={handleSelect}
                                  onClick={(e) => {
                                    // Fallback para garantir que funcione em todos os navegadores
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSelect();
                                  }}
                                  onMouseDown={(e) => {
                                    // Fallback adicional para mouse
                                    if (e.button === 0) {
                                      e.preventDefault();
                                      handleSelect();
                                    }
                                  }}
                                  onTouchStart={(e) => {
                                    // Fallback para dispositivos touch
                                    e.preventDefault();
                                    handleSelect();
                                  }}
                                  className={cn(
                                    "px-3 py-2 rounded-none cursor-pointer",
                                    formData.modalidade === tipo.id
                                      ? "!bg-[#02572E]/10 !text-[#02572E]"
                                      : "!bg-transparent !text-foreground hover:!bg-accent hover:!text-accent-foreground"
                                  )}
                                  style={{ 
                                    pointerEvents: 'auto', 
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                    MozUserSelect: 'none',
                                    msUserSelect: 'none',
                                    touchAction: 'manipulation'
                                  }}
                                >
                                  {tipo.sigla} - {tipo.descricao}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      )}
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full w-9 h-9 shrink-0 bg-gray-400 hover:bg-gray-500 text-white"
                  type="button"
                  onClick={() => setBuscarTipoPopupOpen(true)}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1 flex flex-col">
              <div className="flex items-center justify-between">
                <Label htmlFor="num_licitacao" className="text-sm font-normal text-[#262626]">Número</Label>
                <div className="flex items-center gap-1.5">
                  {/* Revisão = licitação cadastrada E já enviada em relatório ao cliente (não apenas cadastrada). Ver docs/REVISAO-CHECKBOX.md */}
                  <Checkbox
                    id="revisao"
                    checked={revisao}
                    onCheckedChange={(checked) => setRevisao(checked === true)}
                  />
                  <Label htmlFor="revisao" className="text-xs font-normal cursor-pointer">Revisão</Label>
                </div>
              </div>
              <Input
                id="num_licitacao"
                tabIndex={3}
                placeholder="Digite o número (ex: 02/2026)"
                value={formData.num_licitacao || formatarNumeroLicitacao()}
                onKeyDown={(e) => {
                  if (e.key === 'Tab' && !e.shiftKey) {
                    e.preventDefault();
                    const dataInput = document.getElementById('dt_publicacao') as HTMLElement;
                    if (dataInput) {
                      dataInput.focus();
                    }
                  }
                }}
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
            <div className="space-y-1 flex flex-col">
              <Label htmlFor="dt_publicacao" className="text-sm font-normal text-[#262626]">Data Licitação</Label>
              <div className="relative">
                <Input
                  id="dt_publicacao"
                  tabIndex={4}
                  value={formData.dt_publicacao || ''}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' && !e.shiftKey) {
                      e.preventDefault();
                      // Abre o popover de órgão primeiro
                      if (!orgaoPopupOpen) {
                        setOrgaoPopupOpen(true);
                      }
                      // Foca no botão de órgão - o useEffect vai cuidar de focar no input
                      setTimeout(() => {
                        const orgaoButton = document.querySelector('[role="combobox"][tabindex="5"]') as HTMLElement;
                        if (orgaoButton) {
                          orgaoButton.focus();
                        }
                      }, 100);
                    }
                  }}
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
              <Popover 
                open={orgaoPopupOpen} 
                onOpenChange={(open) => {
                  setOrgaoPopupOpen(open);
                  if (!open) {
                    setOrgaoSearchTerm('');
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={orgaoPopupOpen}
                    className="h-9 flex-1 justify-between font-normal bg-white"
                    tabIndex={5}
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
                <PopoverContent 
                  className="w-[--radix-popover-trigger-width] p-0" 
                  align="start"
                  onInteractOutside={(e) => {
                    // Permite interação com elementos dentro do popover
                    const target = e.target as HTMLElement;
                    if (target.closest('[role="combobox"]')) {
                      e.preventDefault();
                    }
                  }}
                >
                  <Command>
                    <CommandInput 
                      ref={orgaoSearchInputRef}
                      placeholder="Buscar orgão..." 
                      value={orgaoSearchTerm}
                      onValueChange={(value) => {
                        setOrgaoSearchTerm(value);
                      }}
                      autoFocus={orgaoPopupOpen}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && !e.shiftKey) {
                          e.preventDefault();
                          // Encontra o item destacado na lista (cmdk usa data-selected ou aria-selected)
                          const selectedItem = document.querySelector('[cmdk-item][data-selected="true"], [cmdk-item][aria-selected="true"]') as HTMLElement;
                          if (selectedItem) {
                            // Dispara o evento de seleção
                            selectedItem.click();
                          } else {
                            // Se não houver item destacado, seleciona o primeiro da lista
                            const firstItem = document.querySelector('[cmdk-item]') as HTMLElement;
                            if (firstItem) {
                              firstItem.click();
                            }
                          }
                          // Fecha o popover
                          setOrgaoPopupOpen(false);
                          // Avança para o próximo campo (textarea conteúdo)
                          setTimeout(() => {
                            const conteudoTextarea = document.getElementById('conteudo') as HTMLElement;
                            if (conteudoTextarea) {
                              conteudoTextarea.focus();
                            }
                          }, 100);
                        }
                      }}
                    />
                    {orgaoSearchTerm && (
                      <CommandList>
                        <CommandEmpty>Nenhum orgão encontrado.</CommandEmpty>
                        <CommandGroup className="p-0">
                          {orgaos
                            .filter((orgao) => {
                              if (!orgaoSearchTerm) return false;
                              const searchLower = orgaoSearchTerm.toLowerCase();
                              const nomeLower = orgao.nome_orgao?.toLowerCase() || '';
                              return nomeLower.includes(searchLower);
                            })
                            .slice(0, 1) // Mostra apenas 1 item
                            .map((orgao) => {
                          const handleSelect = () => {
                            const now = Date.now();
                            const lastTime = lastSelectTimeMap.current.get(orgao.id) || 0;
                            
                            // Previne múltiplas chamadas em menos de 200ms
                            if (now - lastTime < 200) {
                              return;
                            }
                            lastSelectTimeMap.current.set(orgao.id, now);
                            
                            setFormData({ ...formData, orgao_pncp: orgao.nome_orgao });
                            setOrgaoPopupOpen(false);
                          };
                          
                          return (
                            <CommandItem
                              key={orgao.id}
                              value={orgao.nome_orgao}
                              onSelect={handleSelect}
                              onClick={(e) => {
                                // Fallback para garantir que funcione em todos os navegadores
                                e.preventDefault();
                                e.stopPropagation();
                                handleSelect();
                              }}
                              onMouseDown={(e) => {
                                // Fallback adicional para mouse
                                if (e.button === 0) {
                                  e.preventDefault();
                                  handleSelect();
                                }
                              }}
                              onTouchStart={(e) => {
                                // Fallback para dispositivos touch
                                e.preventDefault();
                                handleSelect();
                              }}
                              className={cn(
                                "px-3 py-2 rounded-none cursor-pointer",
                                (formData.orgao_pncp === orgao.nome_orgao || formData.orgao_pncp === orgao.id)
                                  ? "!bg-[#02572E]/10 !text-[#02572E]"
                                  : "!bg-transparent !text-foreground hover:!bg-accent hover:!text-accent-foreground"
                              )}
                              style={{ 
                                pointerEvents: 'auto', 
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                                MozUserSelect: 'none',
                                msUserSelect: 'none',
                                touchAction: 'manipulation'
                              }}
                            >
                              {orgao.nome_orgao}
                            </CommandItem>
                          );
                        })}
                        </CommandGroup>
                      </CommandList>
                    )}
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
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full w-9 h-9 shrink-0 bg-gray-400 hover:bg-gray-500 text-white"
                type="button"
                onClick={handlePuxarOrgaoUltimaLicitacao}
                title="Puxar órgão da última licitação cadastrada"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              id="conteudo"
              tabIndex={6}
              value={formData.conteudo || ''}
              onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
              className="resize-none flex-1 min-h-[120px] text-[12px] text-[#1a1a1a] bg-white"
              placeholder=""
            />
          </div>

          {/* Botões inferiores */}
          <div className="flex gap-2 mt-4 items-end">
            <Button 
              variant="outline" 
              className="bg-gray-100 hover:bg-gray-200 text-[#262626]"
              onClick={() => setLinksPopupOpen(true)}
            >
              <Link2 className="w-4 h-4 mr-2" />
              Links (F2)
            </Button>
            <Button 
              variant="outline" 
              className="bg-gray-100 hover:bg-gray-200 text-[#262626]"
              onClick={() => setExibirPopupOpen(true)}
            >
              Exibir Licitação
            </Button>
            {/* Datepicker bloqueado para data de publicação */}
            <div>
              <div className="space-y-1">
                <Label className="text-sm font-normal text-[#262626]">Data de Publicação</Label>
                <div className="relative">
                  <Input
                    value={formData.dt_vinculo_ativa ? formatarDataISO(formData.dt_vinculo_ativa) : ''}
                    readOnly
                    placeholder="DD/MM/AAAA"
                    className="h-9 pr-8 bg-gray-50 cursor-not-allowed w-[140px]"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-9 w-9 hover:bg-transparent cursor-not-allowed"
                    disabled
                  >
                    <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Divisor redimensionável */}
        <div
          className={cn(
            "flex-shrink-0 relative group z-10",
            atividadesResizable.isResizing && "cursor-col-resize"
          )}
          style={{ userSelect: 'none' }}
        >
          {/* Área de arrasto invisível maior */}
          <div
            className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 cursor-col-resize"
            onMouseDown={atividadesResizable.handleMouseDown}
            title="Arraste para redimensionar"
          />
          {/* Barra visual */}
          <div
            className={cn(
              "w-1 bg-gray-200 hover:bg-gray-300 transition-colors mx-auto h-full",
              atividadesResizable.isResizing && "bg-gray-400"
            )}
          />
        </div>

        {/* Sidebar Direita - Atividades */}
        <div 
          className="bg-white rounded-lg border border-border p-4 flex flex-col text-[14px] flex-shrink-0"
          style={{ width: `${atividadesResizable.width}px` }}
        >
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
        onOpenChange={(open) => {
          setBuscarOrgaoPopupOpen(open);
          if (!open) {
            // Quando o popup é fechado, marca o conteúdo atual como ignorado para não reabrir automaticamente
            const conteudoAtual = (formData.conteudo || '').trim();
            if (conteudoAtual) {
              setConteudoIgnorado(conteudoAtual);
            }
            // Limpa o termo inicial quando o popup fecha
            setTermoInicialOrgao('');
          }
        }}
        onOrgaoSelecionado={(orgao) => {
          setFormData({ ...formData, orgao_pncp: orgao.nome_orgao });
          // Limpa o conteúdo ignorado quando um órgão é selecionado
          setConteudoIgnorado('');
        }}
        termoInicial={termoInicialOrgao}
      />

      <BuscarTipoPopup
        open={buscarTipoPopupOpen}
        onOpenChange={(open) => {
          setBuscarTipoPopupOpen(open);
          if (!open) {
            // Limpa o termo inicial quando o popup fecha
            setTermoInicialTipo('');
          }
        }}
        onTipoSelecionado={(tipo) => {
          setFormData({ 
            ...formData, 
            modalidade: tipo.id,
            descricao_modalidade: tipo.id
          });
        }}
        termoInicial={termoInicialTipo}
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
            {formData.link_processo && formData.link_processo.trim() !== '' ? (
              <iframe
                src={formData.link_processo}
                className="w-full h-[calc(90vh-120px)] border border-gray-200 rounded-lg"
                title="Licitação"
                allowFullScreen
              />
            ) : (
              <div className="flex items-center justify-center h-[calc(90vh-120px)] border border-gray-200 rounded-lg bg-gray-50">
                <p className="text-muted-foreground text-sm">
                  Nenhum link de processo cadastrado. Cadastre um link através do botão "Links (F2)".
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta licitação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de alerta de duplicidade */}
      <AlertDialog open={duplicidadeDialogOpen} onOpenChange={setDuplicidadeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Licitação já cadastrada</AlertDialogTitle>
            <AlertDialogDescription>
              Uma licitação com os mesmos dados (Tipo, Número, Órgão e Conteúdo) já existe no sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-0">
            <AlertDialogCancel 
              onClick={() => setDuplicidadeDialogOpen(false)}
              className="sm:mr-2"
            >
              Não
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => setDuplicidadeDialogOpen(false)}
              className="bg-[#5046E5] hover:bg-[#4338CA]"
            >
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating panel de palavras-chave (abaixo ou acima do item clicado) */}
      {palavrasChavesModalOpen && palavrasChavesFloatingPos && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => {
              setPalavrasChavesModalOpen(false);
              setPalavrasChavesModalItem(null);
              setPalavrasChavesFloatingPos(null);
              setPalavrasChavesEditValue('');
            }}
          />
          <div
            className="fixed z-50 rounded-lg border border-border bg-white shadow-lg overflow-hidden flex flex-col"
            style={{
              top: palavrasChavesFloatingPos.top,
              left: palavrasChavesFloatingPos.left,
              width: FLOATING_PANEL_W,
              maxHeight: 300,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Textarea
              className="min-h-[120px] max-h-[220px] resize-none border-0 text-[13px] lowercase focus-visible:ring-0 focus-visible:ring-offset-0 rounded-t-lg p-3"
              placeholder="Digite palavras separadas por vírgula..."
              value={palavrasChavesEditValue}
              onChange={(e) => setPalavrasChavesEditValue(e.target.value)}
            />
            <div className="border-t border-border px-2 py-2 flex justify-end">
              <Button
                type="button"
                size="sm"
                disabled={palavrasChavesSaving}
                onClick={handleSalvarPalavrasChaves}
                className="text-xs h-8"
              >
                {palavrasChavesSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Dialog de confirmação quando não há atividades selecionadas */}
      <AlertDialog open={atividadesVaziasDialogOpen} onOpenChange={setAtividadesVaziasDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nenhuma atividade selecionada</AlertDialogTitle>
            <AlertDialogDescription>
              Você está com dúvida em qual atividade marcar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-0">
            <AlertDialogCancel 
              onClick={handleCancelarAtividadesVazias}
              className="sm:mr-2"
            >
              Não
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmarAtividadesVazias}
              className="bg-[#5046E5] hover:bg-[#4338CA]"
            >
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
