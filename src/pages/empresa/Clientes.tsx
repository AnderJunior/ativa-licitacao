import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Eye, ArrowLeft, X, Search } from 'lucide-react';
import { usePermissoes } from '@/contexts/PermissoesContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ORDEM_ARVORE_ATIVIDADES } from '@/lib/ordemArvoreAtividades';

// ─── Types ───────────────────────────────────────────────
interface Cliente {
  id: string;
  nome: string;
  contato: string | null;
  fone: string | null;
  fax: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  cnpj: string | null;
  cpf: string | null;
  cod_interno: string | null;
  obs: string | null;
  cliente_ativo: boolean;
  cortesia_bloqueio: string | null;
  created_at: string;
  updated_at: string;
  alterado_por: string | null;
}

interface RamoAtividade {
  id: string;
  nome: string;
  e_grupo: boolean;
  grupo_relacionado: string | null;
  children?: RamoAtividade[];
}

interface GrupoOrgao {
  id: string;
  nome: string;
}

// ─── Constants ───────────────────────────────────────────
const UF_LIST = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

const REGIOES: { regiao: string; ufs: string[] }[] = [
  { regiao: 'Sudeste', ufs: ['ES','MG','RJ','SP'] },
  { regiao: 'Nordeste', ufs: ['AL','BA','CE','MA','PB','PE','PI','RN','SE'] },
  { regiao: 'Sul', ufs: ['PR','RS','SC'] },
  { regiao: 'Centro-Oeste', ufs: ['DF','GO','MS','MT'] },
  { regiao: 'Norte', ufs: ['AC','AM','AP','PA','RO','RR','TO'] },
];

const EMPTY_FORM: Omit<Cliente, 'id' | 'created_at' | 'updated_at'> = {
  nome: '', contato: '', fone: '', fax: '', endereco: '', bairro: '',
  cidade: '', uf: '', cep: '', cnpj: '', cpf: '', cod_interno: '',
  obs: '', cliente_ativo: true, cortesia_bloqueio: null, alterado_por: null,
};

// ─── Tree helpers ────────────────────────────────────────
function buildTree(items: RamoAtividade[]): RamoAtividade[] {
  const mapByName = new Map<string, RamoAtividade>();
  const roots: RamoAtividade[] = [];
  items.forEach(item => mapByName.set(item.nome, { ...item, children: [] }));
  items.forEach(item => {
    const node = mapByName.get(item.nome)!;
    if (item.grupo_relacionado && mapByName.has(item.grupo_relacionado)) {
      mapByName.get(item.grupo_relacionado)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function sortTree(nodes: RamoAtividade[], orderMap: Map<string, number>): void {
  nodes.sort((a, b) => {
    const idxA = orderMap.get(a.nome.trim().toLowerCase()) ?? 1e9;
    const idxB = orderMap.get(b.nome.trim().toLowerCase()) ?? 1e9;
    return idxA - idxB;
  });
  nodes.forEach(n => { if (n.children?.length) sortTree(n.children, orderMap); });
}

function normalizarTexto(texto: string): string {
  if (!texto) return '';
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

// ─── Component ───────────────────────────────────────────
export default function Clientes() {
  const { canSalvar, canExcluir } = usePermissoes();
  const { user } = useAuth();

  // ─ Lista ─
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroUF, setFiltroUF] = useState('');

  // ─ Formulário ─
  const [view, setView] = useState<'lista' | 'form'>('lista');
  const [formMode, setFormMode] = useState<'novo' | 'editar' | 'visualizar'>('novo');
  const [activeTab, setActiveTab] = useState<'dados' | 'emails' | 'licitacoes' | 'grupos'>('dados');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // ─ Emails ─
  const [emails, setEmails] = useState<{ id?: string; email: string; tipo: string }[]>([]);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoEmailTipo, setNovoEmailTipo] = useState('Email');

  // ─ Licitações (Perfis com UFs + Atividades) ─
  interface Perfil { id?: string; nome: string; ufs: Set<string>; ramos: Set<string>; }
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [perfilAtivo, setPerfilAtivo] = useState(0);
  const [ramos, setRamos] = useState<RamoAtividade[]>([]);

  // ─ Pesquisa por digitação na árvore ─
  const [searchBuffer, setSearchBuffer] = useState('');
  const [highlightedAtividadeId, setHighlightedAtividadeId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const atividadesScrollRef = useRef<HTMLDivElement>(null);

  const selectedUFs = perfis[perfilAtivo]?.ufs || new Set<string>();
  const selectedRamos = perfis[perfilAtivo]?.ramos || new Set<string>();

  const setSelectedUFs = (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setPerfis(prev => prev.map((p, i) => i === perfilAtivo
      ? { ...p, ufs: typeof updater === 'function' ? updater(p.ufs) : updater }
      : p
    ));
  };

  const setSelectedRamos = (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setPerfis(prev => prev.map((p, i) => i === perfilAtivo
      ? { ...p, ramos: typeof updater === 'function' ? updater(p.ramos) : updater }
      : p
    ));
  };

  const addPerfil = () => {
    const nextLetter = String.fromCharCode(65 + perfis.length); // A=65, B=66...
    setPerfis(prev => [...prev, { nome: nextLetter, ufs: new Set(), ramos: new Set() }]);
    setPerfilAtivo(perfis.length);
  };

  const removePerfil = (idx: number) => {
    if (perfis.length <= 1) return;
    setPerfis(prev => prev.filter((_, i) => i !== idx));
    setPerfilAtivo(prev => prev >= idx ? Math.max(0, prev - 1) : prev);
  };

  // ─ Grupos de Órgãos ─
  const [grupos, setGrupos] = useState<GrupoOrgao[]>([]);
  const [selectedGrupos, setSelectedGrupos] = useState<Set<string>>(new Set());
  const [filtroGrupo, setFiltroGrupo] = useState('');

  // ─── Load data ─────────────────────────────────────────
  useEffect(() => { loadClientes(); loadRamos(); loadGrupos(); }, []);

  const loadClientes = async () => {
    setLoading(true);
    try {
      const data = await api.get<Cliente[]>('/api/clientes');
      setClientes(data || []);
    } catch (err: any) {
      toast.error('Erro ao carregar clientes: ' + err.message);
    }
    setLoading(false);
  };

  const loadRamos = async () => {
    try {
      const data = await api.get<RamoAtividade[]>('/api/ramos-atividade');
      if (data) {
        const tree = buildTree(data as any);
        const orderMap = new Map(ORDEM_ARVORE_ATIVIDADES.map((n, i) => [n.trim().toLowerCase(), i]));
        sortTree(tree, orderMap);
        setRamos(tree);
      }
    } catch (err: any) {
      toast.error('Erro ao carregar ramos: ' + err.message);
    }
  };

  const loadGrupos = async () => {
    try {
      const data = await api.get<GrupoOrgao[]>('/api/grupo-orgaos');
      if (data) setGrupos(data);
    } catch (err: any) {
      toast.error('Erro ao carregar grupos: ' + err.message);
    }
  };

  // ─── Open form ─────────────────────────────────────────
  const openNovo = () => {
    setForm({ ...EMPTY_FORM });
    setEmails([]);
    setPerfis([{ nome: 'A', ufs: new Set(), ramos: new Set() }]);
    setPerfilAtivo(0);
    setSelectedGrupos(new Set());
    setEditingId(null);
    setFormMode('novo');
    setActiveTab('dados');
    setView('form');
  };

  const openClienteForm = async (cliente: Cliente, mode: 'editar' | 'visualizar') => {
    setForm({
      nome: cliente.nome, contato: cliente.contato || '', fone: cliente.fone || '',
      fax: cliente.fax || '', endereco: cliente.endereco || '', bairro: cliente.bairro || '',
      cidade: cliente.cidade || '', uf: cliente.uf || '', cep: cliente.cep || '',
      cnpj: cliente.cnpj || '', cpf: cliente.cpf || '', cod_interno: cliente.cod_interno || '',
      obs: cliente.obs || '', cliente_ativo: cliente.cliente_ativo,
      cortesia_bloqueio: cliente.cortesia_bloqueio, alterado_por: cliente.alterado_por,
    });
    setEditingId(cliente.id);
    setFormMode(mode);
    setActiveTab('dados');

    try {
      const full = await api.get<any>('/api/clientes/' + cliente.id);

      // Load emails
      setEmails((full.emails || []).map((e: any) => ({ id: e.id, email: e.email, tipo: e.tipo || 'Email' })));

      // Load Perfis with UFs and Atividades
      const loadedPerfis: Perfil[] = (full.perfis || []).map((p: any) => ({
        id: p.id,
        nome: p.nome,
        ufs: new Set((p.ufs || []).map((u: any) => u.uf)),
        ramos: new Set((p.atividades || []).map((a: any) => a.ramo_id)),
      }));
      if (loadedPerfis.length === 0) loadedPerfis.push({ nome: 'A', ufs: new Set(), ramos: new Set() });
      setPerfis(loadedPerfis);
      setPerfilAtivo(0);

      // Load Grupos
      setSelectedGrupos(new Set((full.grupos_orgaos || []).map((g: any) => g.grupo_id)));
    } catch (err: any) {
      toast.error('Erro ao carregar dados do cliente: ' + err.message);
    }

    setView('form');
  };

  // ─── Save ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);

    const dados = {
      nome: form.nome.trim(),
      contato: form.contato || null,
      fone: form.fone || null,
      fax: form.fax || null,
      endereco: form.endereco || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      uf: form.uf || null,
      cep: form.cep || null,
      cnpj: form.cnpj || null,
      cpf: form.cpf || null,
      cod_interno: form.cod_interno || null,
      obs: form.obs || null,
      cliente_ativo: form.cliente_ativo,
      cortesia_bloqueio: form.cortesia_bloqueio || null,
      alterado_por: user?.user_metadata?.full_name || user?.email || null,
    };

    try {
      let clienteId = editingId;

      if (!clienteId) {
        const created = await api.post<any>('/api/clientes', { nome: dados.nome });
        clienteId = created.id;
      }

      await api.post('/api/clientes/' + clienteId + '/save-all', {
        dados,
        emails: emails.map(e => ({ email: e.email, tipo: e.tipo })),
        perfis: perfis.map(p => ({
          nome: p.nome,
          ufs: Array.from(p.ufs),
          atividades: Array.from(p.ramos),
        })),
        grupo_ids: Array.from(selectedGrupos),
      });

      toast.success(editingId ? 'Cliente atualizado!' : 'Cliente cadastrado!');
      setView('lista');
      loadClientes();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    }

    setSaving(false);
  };

  // ─── Delete ────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await api.delete('/api/clientes/' + id);
      toast.success('Cliente excluído!');
      loadClientes();
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  // ─── Filtered list ─────────────────────────────────────
  const clientesFiltrados = clientes.filter(c => {
    if (filtroNome && !c.nome.toLowerCase().includes(filtroNome.toLowerCase())) return false;
    if (filtroCidade && !(c.cidade || '').toLowerCase().includes(filtroCidade.toLowerCase())) return false;
    if (filtroUF && c.uf !== filtroUF) return false;
    return true;
  });

  // ─── Ramo toggle (individual, sem propagar para filhos) ─
  const toggleRamo = (ramoId: string) => {
    setSelectedRamos(prev => {
      const next = new Set(prev);
      if (next.has(ramoId)) next.delete(ramoId); else next.add(ramoId);
      return next;
    });
  };

  // ─── UF toggle ─────────────────────────────────────────
  const toggleUF = (uf: string) => {
    setSelectedUFs(prev => {
      const next = new Set(prev);
      if (next.has(uf)) next.delete(uf); else next.add(uf);
      return next;
    });
  };

  const toggleRegiao = (ufs: string[]) => {
    setSelectedUFs(prev => {
      const allSelected = ufs.every(uf => prev.has(uf));
      const next = new Set(prev);
      if (allSelected) ufs.forEach(uf => next.delete(uf));
      else ufs.forEach(uf => next.add(uf));
      return next;
    });
  };

  const toggleAllUFs = () => {
    setSelectedUFs(prev => prev.size === UF_LIST.length ? new Set() : new Set(UF_LIST));
  };

  // ─── Busca de atividade por nome ─────────────────────────
  const buscarAtividadePorNome = (items: RamoAtividade[], termo: string): RamoAtividade | null => {
    if (!termo) return null;
    const termoLimpo = termo.trim();
    if (termoLimpo === '') return null;
    const termoNormalizado = normalizarTexto(termoLimpo);
    if (!termoNormalizado) return null;

    const resultados: Array<{ item: RamoAtividade; prioridade: number }> = [];
    const buscarRecursivo = (items: RamoAtividade[]): void => {
      for (const item of items) {
        const nomeNormalizado = normalizarTexto(item.nome);
        let prioridade = 0;
        if (nomeNormalizado.startsWith(termoNormalizado)) prioridade = 1;
        else if (nomeNormalizado.includes(termoNormalizado)) prioridade = 2;
        if (prioridade > 0) resultados.push({ item, prioridade });
        if (item.children?.length) buscarRecursivo(item.children);
      }
    };
    buscarRecursivo(items);
    if (resultados.length > 0) {
      resultados.sort((a, b) => {
        if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
        const posA = normalizarTexto(a.item.nome).indexOf(termoNormalizado);
        const posB = normalizarTexto(b.item.nome).indexOf(termoNormalizado);
        return posA - posB;
      });
      return resultados[0].item;
    }
    return null;
  };

  const scrollParaAtividade = (atividadeId: string) => {
    const elemento = document.querySelector(`[data-atividade-id="${atividadeId}"]`);
    if (elemento && atividadesScrollRef.current) {
      elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      setHighlightedAtividadeId(atividadeId);
      highlightTimeoutRef.current = setTimeout(() => setHighlightedAtividadeId(null), 2000);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => { setSearchBuffer(''); lastKeyTimeRef.current = 0; }, 500);
    }
  };

  const handleItemClick = (atividadeId: string) => {
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    setHighlightedAtividadeId(atividadeId);
    highlightTimeoutRef.current = setTimeout(() => setHighlightedAtividadeId(null), 2000);
  };

  // ─── Pesquisa por digitação na área de atividades ─────────
  useEffect(() => {
    if (activeTab !== 'licitacoes') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const atividadesArea = atividadesScrollRef.current;
      if (!atividadesArea || !activeElement) return;
      const isInArea = atividadesArea.contains(activeElement);
      if (!isInArea) return;
      if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key.length > 1 && !['Backspace', 'Delete', 'Space'].includes(e.key)) return;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        setSearchBuffer(prev => {
          if (prev.length > 0) {
            const novoBuffer = prev.slice(0, -1);
            if (novoBuffer.length > 0) {
              setTimeout(() => {
                const found = buscarAtividadePorNome(ramos, novoBuffer);
                if (found) scrollParaAtividade(found.id);
                else setHighlightedAtividadeId(null);
              }, 0);
            } else {
              setHighlightedAtividadeId(null);
            }
            return novoBuffer;
          }
          setHighlightedAtividadeId(null);
          return '';
        });
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        if (highlightedAtividadeId) {
          toggleRamo(highlightedAtividadeId);
          setSearchBuffer('');
          if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
          return;
        }
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        const agora = Date.now();
        const tempoDesdeUltima = agora - lastKeyTimeRef.current;
        const deveResetar = tempoDesdeUltima > 800 || searchBuffer === '';
        lastKeyTimeRef.current = agora;
        const novoBuffer = deveResetar ? ' ' : (searchBuffer + ' ');
        setSearchBuffer(novoBuffer);
        const found = buscarAtividadePorNome(ramos, novoBuffer);
        if (found) { scrollParaAtividade(found.id); }
        else {
          setHighlightedAtividadeId(null);
          if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
          searchTimeoutRef.current = setTimeout(() => { setSearchBuffer(''); setHighlightedAtividadeId(null); }, 2000);
        }
        return;
      }

      if (!/^[a-zA-Z0-9]$/.test(e.key)) return;
      e.preventDefault();
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      const agora = Date.now();
      const tempoDesdeUltima = agora - lastKeyTimeRef.current;
      const deveResetar = tempoDesdeUltima > 800 || searchBuffer === '';
      lastKeyTimeRef.current = agora;
      const novoBuffer = deveResetar ? e.key.toLowerCase() : (searchBuffer + e.key.toLowerCase());
      setSearchBuffer(novoBuffer);
      const found = buscarAtividadePorNome(ramos, novoBuffer);
      if (found) { scrollParaAtividade(found.id); }
      else {
        setHighlightedAtividadeId(null);
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => { setSearchBuffer(''); setHighlightedAtividadeId(null); }, 1000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, [searchBuffer, ramos, highlightedAtividadeId, activeTab]);

  // ─── Render tree (mesmo estilo do Cadastro) ─────────────
  const renderRamoTree = (nodes: RamoAtividade[], level: number = 0): React.ReactNode => {
    return nodes.map(node => {
      const isSelected = selectedRamos.has(node.id);
      const isHighlighted = highlightedAtividadeId === node.id;
      const disabled = formMode === 'visualizar';
      return (
        <div key={node.id}>
          <div
            className={cn(
              "relative py-1 rounded px-1 flex items-start transition-colors duration-200 cursor-pointer",
              isSelected ? "bg-yellow-200" : isHighlighted ? "bg-blue-100" : ""
            )}
            data-atividade-id={node.id}
            onClick={() => handleItemClick(node.id)}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => {
                if (!disabled) {
                  toggleRamo(node.id);
                  if (checked) handleItemClick(node.id);
                }
              }}
              disabled={disabled}
              className="h-3.5 w-3.5 mt-0.5"
              onClick={(e) => e.stopPropagation()}
            />
            <span className="pl-2 text-[13px] text-[#262626] lowercase select-none flex-1">
              {node.nome}
            </span>
          </div>
          {node.children && node.children.length > 0 && (
            <div className="ml-[10px] pl-[14px] border-l border-gray-300">
              {renderRamoTree(node.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const isDisabled = formMode === 'visualizar';

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <MainLayout>
      <div className="bg-white rounded-lg border border-border p-6 flex flex-col h-[calc(100vh-96px)] min-h-0 w-full overflow-hidden">

        {/* ══════ LISTA ══════ */}
        {view === 'lista' && (
          <>
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h1 className="text-xl font-bold text-[#1A1A1A]">
                Clientes <span className="text-primary font-normal text-base">({clientesFiltrados.length})</span>
              </h1>
              {canSalvar('/empresa/clientes') && (
                <Button size="sm" className="bg-[#02572E] text-white hover:bg-[#024a27]" onClick={openNovo}>
                  <Plus className="h-4 w-4 mr-1" /> Novo Cliente
                </Button>
              )}
            </div>

            {/* Filtros */}
            <div className="flex gap-3 mb-3 flex-shrink-0">
              <Input placeholder="Filtrar por nome..." value={filtroNome} onChange={e => setFiltroNome(e.target.value)} className="h-8 text-sm max-w-xs" />
              <Input placeholder="Cidade..." value={filtroCidade} onChange={e => setFiltroCidade(e.target.value)} className="h-8 text-sm max-w-[160px]" />
              <Select value={filtroUF} onValueChange={setFiltroUF}>
                <SelectTrigger className="h-8 text-sm w-[100px]">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
              {(filtroNome || filtroCidade || filtroUF) && (
                <Button variant="ghost" size="sm" className="h-8" onClick={() => { setFiltroNome(''); setFiltroCidade(''); setFiltroUF(''); }}>
                  <X className="h-4 w-4 mr-1" /> Limpar
                </Button>
              )}
            </div>

            {/* Tabela */}
            <div className="flex-1 overflow-auto min-h-0">
              {loading ? (
                <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : clientesFiltrados.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">Nenhum cliente encontrado</div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b">
                      <th className="text-left px-3 py-2 font-bold text-xs text-[#1A1A1A]">Nome</th>
                      <th className="text-left px-3 py-2 font-bold text-xs text-[#1A1A1A]">CNPJ</th>
                      <th className="text-left px-3 py-2 font-bold text-xs text-[#1A1A1A]">Cidade</th>
                      <th className="text-left px-3 py-2 font-bold text-xs text-[#1A1A1A]">UF</th>
                      <th className="text-left px-3 py-2 font-bold text-xs text-[#1A1A1A]">Fone</th>
                      <th className="text-left px-3 py-2 font-bold text-xs text-[#1A1A1A]">Status</th>
                      <th className="text-right px-3 py-2 font-bold text-xs text-[#1A1A1A]">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.map(c => (
                      <tr key={c.id} className="border-b hover:bg-muted/50">
                        <td className="px-3 py-1.5 text-[#1A1A1A]">{c.nome}</td>
                        <td className="px-3 py-1.5 text-[#1A1A1A]">{c.cnpj || '-'}</td>
                        <td className="px-3 py-1.5 text-[#1A1A1A]">{c.cidade || '-'}</td>
                        <td className="px-3 py-1.5 text-[#1A1A1A]">{c.uf || '-'}</td>
                        <td className="px-3 py-1.5 text-[#1A1A1A]">{c.fone || '-'}</td>
                        <td className="px-3 py-1.5">
                          <span className={cn("px-2 py-0.5 rounded text-xs font-medium", c.cliente_ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                            {c.cliente_ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 p-0" onClick={() => openClienteForm(c, 'visualizar')} title="Visualizar">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {canSalvar('/empresa/clientes') && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-yellow-100 hover:bg-yellow-200 text-yellow-700 p-0" onClick={() => openClienteForm(c, 'editar')} title="Editar">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {canExcluir('/empresa/clientes') && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-red-100 hover:bg-red-200 text-red-700 p-0" title="Excluir">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                                    <AlertDialogDescription>Tem certeza que deseja excluir "{c.nome}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(c.id)}>Excluir</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ══════ FORMULÁRIO ══════ */}
        {view === 'form' && (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView('lista')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-bold text-[#1A1A1A] flex-1">
                {formMode === 'novo' ? 'Novo Cliente' : formMode === 'editar' ? 'Editar Cliente' : 'Visualizar Cliente'}
              </h1>
              {formMode !== 'visualizar' && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setView('lista')}>Cancelar</Button>
                  <Button className="bg-[#02572E] text-white hover:bg-[#024a27]" onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    {editingId ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                  </Button>
                </div>
              )}
            </div>

            {/* Abas */}
            <div className="flex gap-0 border-b border-border mb-4 flex-shrink-0">
              {(['dados', 'emails', 'licitacoes', 'grupos'] as const).map(tab => (
                <button
                  key={tab}
                  className={cn(
                    "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                    activeTab === tab ? "border-[#02572E] text-[#02572E]" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setActiveTab(tab)}
                >
                  {{ dados: 'Dados Gerais', emails: 'E-mails', licitacoes: 'Licitações', grupos: 'Grupo de Órgãos' }[tab]}
                </button>
              ))}
            </div>

            {/* Conteúdo da aba */}
            <div className="flex-1 overflow-auto min-h-0">

              {/* ── ABA DADOS GERAIS ── */}
              {activeTab === 'dados' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Nome / Empresa *</Label>
                    <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} disabled={isDisabled} className="h-9" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Contato</Label>
                      <Input value={form.contato || ''} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} disabled={isDisabled} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Fone</Label>
                      <Input value={form.fone || ''} onChange={e => setForm(f => ({ ...f, fone: e.target.value }))} disabled={isDisabled} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Fax</Label>
                      <Input value={form.fax || ''} onChange={e => setForm(f => ({ ...f, fax: e.target.value }))} disabled={isDisabled} className="h-9" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Endereço</Label>
                    <Input value={form.endereco || ''} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} disabled={isDisabled} className="h-9" />
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Bairro</Label>
                      <Input value={form.bairro || ''} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} disabled={isDisabled} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Cidade</Label>
                      <Input value={form.cidade || ''} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} disabled={isDisabled} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">UF</Label>
                      <Select value={form.uf || ''} onValueChange={v => setForm(f => ({ ...f, uf: v }))} disabled={isDisabled}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="UF" /></SelectTrigger>
                        <SelectContent>
                          {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">CEP</Label>
                      <Input value={form.cep || ''} onChange={e => setForm(f => ({ ...f, cep: e.target.value }))} disabled={isDisabled} className="h-9" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">CNPJ</Label>
                      <Input value={form.cnpj || ''} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} disabled={isDisabled} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">CPF</Label>
                      <Input value={form.cpf || ''} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} disabled={isDisabled} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Cod. Interno</Label>
                      <Input value={form.cod_interno || ''} onChange={e => setForm(f => ({ ...f, cod_interno: e.target.value }))} disabled={isDisabled} className="h-9" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Obs</Label>
                    <Textarea value={form.obs || ''} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))} disabled={isDisabled} className="resize-none h-[80px]" />
                  </div>

                  {/* Status Cliente */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold text-[#1A1A1A]">Status Cliente</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Cliente Ativo?</Label>
                        <Select value={form.cliente_ativo ? 'sim' : 'nao'} onValueChange={v => setForm(f => ({ ...f, cliente_ativo: v === 'sim' }))} disabled={isDisabled}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sim">Sim</SelectItem>
                            <SelectItem value="nao">Não</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Cortesia Bloqueio</Label>
                        <Input type="date" value={form.cortesia_bloqueio || ''} onChange={e => setForm(f => ({ ...f, cortesia_bloqueio: e.target.value || null }))} disabled={isDisabled} className="h-9" />
                      </div>
                    </div>
                  </div>

                  {/* Datas de controle */}
                  {editingId && (
                    <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground pt-2 border-t">
                      <div>
                        <span className="font-medium">Dt Inclusão:</span> {form.created_at ? new Date((form as any).created_at).toLocaleDateString('pt-BR') : '-'}
                      </div>
                      <div>
                        <span className="font-medium">Dt Ult. Alteração:</span> {form.updated_at ? new Date((form as any).updated_at).toLocaleString('pt-BR') : '-'}
                      </div>
                      <div>
                        <span className="font-medium">Alterado por:</span> {form.alterado_por || '-'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── ABA E-MAILS ── */}
              {activeTab === 'emails' && (
                <div className="max-w-2xl space-y-4">
                  {!isDisabled && (
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs font-medium">Novo E-mail</Label>
                        <Input value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="email@exemplo.com" className="h-9"
                          onKeyDown={e => {
                            if (e.key === 'Enter' && novoEmail.trim()) {
                              setEmails(prev => [...prev, { email: novoEmail.trim(), tipo: novoEmailTipo }]);
                              setNovoEmail('');
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Tipo</Label>
                        <Select value={novoEmailTipo} onValueChange={setNovoEmailTipo}>
                          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Email">Email</SelectItem>
                            <SelectItem value="GBoletim">GBoletim</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" className="h-9 bg-[#02572E] text-white hover:bg-[#024a27]"
                        onClick={() => {
                          if (!novoEmail.trim()) return;
                          setEmails(prev => [...prev, { email: novoEmail.trim(), tipo: novoEmailTipo }]);
                          setNovoEmail('');
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Adicionar
                      </Button>
                    </div>
                  )}

                  <div className="border rounded-lg">
                    {emails.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground text-center">Nenhum e-mail cadastrado</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left px-3 py-2 font-bold text-xs">E-mail</th>
                            <th className="text-left px-3 py-2 font-bold text-xs">Tipo</th>
                            {!isDisabled && <th className="w-10"></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {emails.map((em, idx) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="px-3 py-1.5">{em.email}</td>
                              <td className="px-3 py-1.5">{em.tipo}</td>
                              {!isDisabled && (
                                <td className="px-2 py-1.5">
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => setEmails(prev => prev.filter((_, i) => i !== idx))}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Total: {emails.length}</p>
                </div>
              )}

              {/* ── ABA LICITAÇÕES (Perfis: UFs + Atividades) ── */}
              {activeTab === 'licitacoes' && (
                <div className="flex gap-6 h-full min-h-0">
                  {/* Esquerda: Perfil + UFs */}
                  <div className="flex-shrink-0 space-y-3">
                    {/* Seletor de Perfil */}
                    <div className="flex items-center gap-2 overflow-visible pt-2 pr-2">
                      <span className="text-sm font-semibold text-[#1A1A1A]">PERFIL</span>
                      {perfis.map((p, idx) => (
                        <div key={idx} className="relative">
                          <button
                            type="button"
                            className={cn(
                              "w-10 h-10 rounded border-2 text-lg font-bold transition-colors",
                              perfilAtivo === idx
                                ? "bg-blue-600 border-blue-600 text-white"
                                : "bg-white border-border text-[#1A1A1A] hover:bg-muted"
                            )}
                            onClick={() => setPerfilAtivo(idx)}
                          >
                            {p.nome}
                          </button>
                          {!isDisabled && perfis.length > 1 && perfilAtivo === idx && (
                            <button
                              type="button"
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center hover:bg-red-600"
                              onClick={(e) => { e.stopPropagation(); removePerfil(idx); }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      {!isDisabled && perfis.length < 26 && (
                        <Button variant="outline" size="sm" className="h-10 w-10 p-0 text-lg" onClick={addPerfil}>
                          +
                        </Button>
                      )}
                    </div>

                    {/* UFs */}
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Estados</Label>
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={toggleAllUFs}
                        className="text-xs text-[#02572E] hover:underline font-medium disabled:opacity-50"
                      >
                        TODOS
                      </button>
                    </div>
                    <div className="space-y-1 text-xs">
                      {REGIOES.map(r => (
                        <div key={r.regiao} className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            disabled={isDisabled}
                            onClick={() => toggleRegiao(r.ufs)}
                            className="text-muted-foreground min-w-[90px] text-left hover:text-foreground hover:underline cursor-pointer disabled:opacity-50"
                          >
                            {r.regiao}:
                          </button>
                          {r.ufs.map(uf => (
                            <button
                              key={uf}
                              type="button"
                              disabled={isDisabled}
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

                  {/* Atividades - Árvore */}
                  <div className="flex-1 min-h-0 flex flex-col">
                    <p className="text-sm font-semibold text-[#1A1A1A] mb-2">Atividades - ({selectedRamos.size})</p>
                    <div ref={atividadesScrollRef} className="flex-1 overflow-auto border rounded-lg p-2 min-h-0" tabIndex={0} style={{ outline: 'none' }}>
                      {ramos.length === 0 ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary m-4" />
                      ) : (
                        renderRamoTree(ramos)
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── ABA GRUPO DE ÓRGÃOS ── */}
              {activeTab === 'grupos' && (
                <div className="max-w-xl space-y-3">
                  <p className="text-sm font-semibold text-[#1A1A1A]">Grupos de Órgãos</p>
                  <Input placeholder="Filtrar grupo..." value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)} className="h-8 text-sm" />
                  <div className="border rounded-lg p-2 max-h-[400px] overflow-auto">
                    {grupos
                      .filter(g => !filtroGrupo || g.nome.toLowerCase().includes(filtroGrupo.toLowerCase()))
                      .map(g => (
                        <div key={g.id} className="flex items-center gap-2 py-1 px-1 hover:bg-muted/30 rounded">
                          <Checkbox
                            checked={selectedGrupos.has(g.id)}
                            onCheckedChange={() => {
                              if (isDisabled) return;
                              setSelectedGrupos(prev => {
                                const next = new Set(prev);
                                if (next.has(g.id)) next.delete(g.id); else next.add(g.id);
                                return next;
                              });
                            }}
                            disabled={isDisabled}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-sm">{g.nome}</span>
                        </div>
                      ))}
                    {grupos.length === 0 && <p className="text-sm text-muted-foreground p-2">Nenhum grupo cadastrado</p>}
                  </div>
                </div>
              )}
            </div>

          </>
        )}
      </div>
    </MainLayout>
  );
}
