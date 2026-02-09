import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ORDEM_ARVORE_ATIVIDADES } from '@/lib/ordemArvoreAtividades';

interface RamoAtividade {
  id: string;
  nome: string;
  e_grupo: boolean;
  grupo_relacionado: string | null;
  palavras_chaves?: string[] | null;
  children?: RamoAtividade[];
}

const FLOATING_PANEL_ESTIMATED_H = 220;
const FLOATING_PANEL_W = 440;

export default function Atividades() {
  const [loading, setLoading] = useState(true);
  const [ramos, setRamos] = useState<RamoAtividade[]>([]);
  const [selectedRamos, setSelectedRamos] = useState<string[]>([]);
  const [highlightedAtividadeId, setHighlightedAtividadeId] = useState<string | null>(null);
  const [searchBuffer, setSearchBuffer] = useState('');

  const [palavrasChavesModalOpen, setPalavrasChavesModalOpen] = useState(false);
  const [palavrasChavesModalItem, setPalavrasChavesModalItem] = useState<RamoAtividade | null>(null);
  const [palavrasChavesFloatingPos, setPalavrasChavesFloatingPos] = useState<{ top: number; left: number; placement: 'above' | 'below' } | null>(null);
  const [palavrasChavesEditValue, setPalavrasChavesEditValue] = useState('');
  const [palavrasChavesSaving, setPalavrasChavesSaving] = useState(false);

  const [editarDialogOpen, setEditarDialogOpen] = useState(false);
  const [editarItem, setEditarItem] = useState<RamoAtividade | null>(null);
  const [editarNome, setEditarNome] = useState('');
  const [editarSaving, setEditarSaving] = useState(false);

  const [adicionarParent, setAdicionarParent] = useState<RamoAtividade | null>(null);
  const [adicionarComoPai, setAdicionarComoPai] = useState(false);
  const [adicionarNome, setAdicionarNome] = useState('');
  const [adicionarSaving, setAdicionarSaving] = useState(false);
  const adicionarInputRef = useRef<HTMLInputElement>(null);

  const [removerDialogOpen, setRemoverDialogOpen] = useState(false);
  const [removerItem, setRemoverItem] = useState<RamoAtividade | null>(null);
  const [removerSaving, setRemoverSaving] = useState(false);

  const atividadesScrollRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyTimeRef = useRef(0);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadRamos();
  }, []);

  useEffect(() => {
    if (adicionarParent || adicionarComoPai) setAdicionarNome('');
  }, [adicionarParent, adicionarComoPai]);

  useLayoutEffect(() => {
    if (!adicionarParent && !adicionarComoPai) return;
    const focusInput = () => adicionarInputRef.current?.focus();
    focusInput();
    const id = requestAnimationFrame(() => focusInput());
    return () => cancelAnimationFrame(id);
  }, [adicionarParent, adicionarComoPai]);

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
    setLoading(false);
  };

  const buildTree = (items: RamoAtividade[]): RamoAtividade[] => {
    const mapByName = new Map<string, RamoAtividade>();
    const roots: RamoAtividade[] = [];
    items.forEach(item => {
      mapByName.set(item.nome, { ...item, children: [] });
    });
    items.forEach(item => {
      const node = mapByName.get(item.nome)!;
      if (item.grupo_relacionado && mapByName.has(item.grupo_relacionado)) {
        mapByName.get(item.grupo_relacionado)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  };

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

  const handleEditarAtividade = () => {
    if (!editarItem) return;
    const nome = editarNome.trim();
    if (!nome) {
      toast.error('Informe o nome da atividade.');
      return;
    }
    setEditarSaving(true);
    supabase
      .from('ramos_de_atividade')
      .update({ nome })
      .eq('id', editarItem.id)
      .then(({ error }) => {
        setEditarSaving(false);
        setEditarDialogOpen(false);
        setEditarItem(null);
        setEditarNome('');
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success('Atividade atualizada.');
        loadRamos();
      });
  };

  const handleAdicionarAtividade = () => {
    if (!adicionarParent) return;
    const nome = adicionarNome.trim();
    if (!nome) {
      toast.error('Informe o nome da nova atividade.');
      return;
    }
    setAdicionarSaving(true);
    supabase
      .from('ramos_de_atividade')
      .insert({
        nome,
        e_grupo: false,
        grupo_relacionado: adicionarParent.nome,
        parent_id: adicionarParent.id,
      })
      .then(({ error }) => {
        setAdicionarSaving(false);
        setAdicionarParent(null);
        setAdicionarNome('');
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success('Atividade adicionada.');
        loadRamos();
      });
  };

  const cancelarAdicionar = () => {
    setAdicionarParent(null);
    setAdicionarComoPai(false);
    setAdicionarNome('');
  };

  const handleAdicionarAtividadePai = () => {
    const nome = adicionarNome.trim();
    if (!nome) {
      toast.error('Informe o nome da nova atividade.');
      return;
    }
    setAdicionarSaving(true);
    supabase
      .from('ramos_de_atividade')
      .insert({
        nome,
        e_grupo: false,
        grupo_relacionado: null,
        parent_id: null,
      })
      .then(({ error }) => {
        setAdicionarSaving(false);
        setAdicionarComoPai(false);
        setAdicionarNome('');
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success('Atividade adicionada.');
        loadRamos();
      });
  };

  const handleRemoverAtividade = async () => {
    if (!removerItem) return;
    setRemoverSaving(true);
    const { error } = await supabase.from('ramos_de_atividade').delete().eq('id', removerItem.id);
    setRemoverSaving(false);
    setRemoverDialogOpen(false);
    setRemoverItem(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Atividade removida.');
    loadRamos();
  };

  const toggleRamo = (id: string) => {
    setSelectedRamos(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const normalizarTexto = (texto: string): string => {
    if (!texto) return '';
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const buscarAtividadePorNome = (items: RamoAtividade[], termo: string): RamoAtividade | null => {
    if (!termo?.trim()) return null;
    const termoNormalizado = normalizarTexto(termo.trim());
    if (!termoNormalizado) return null;
    const resultados: Array<{ item: RamoAtividade; prioridade: number }> = [];
    const buscarRecursivo = (list: RamoAtividade[]): void => {
      for (const item of list) {
        const nomeNormalizado = normalizarTexto(item.nome);
        let prioridade = 0;
        if (nomeNormalizado.startsWith(termoNormalizado)) prioridade = 1;
        else if (nomeNormalizado.includes(termoNormalizado)) prioridade = 2;
        if (prioridade > 0) resultados.push({ item, prioridade });
        if (item.children?.length) buscarRecursivo(item.children);
      }
    };
    buscarRecursivo(items);
    if (resultados.length === 0) return null;
    resultados.sort((a, b) => {
      if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
      const posA = normalizarTexto(a.item.nome).indexOf(termoNormalizado);
      const posB = normalizarTexto(b.item.nome).indexOf(termoNormalizado);
      return posA - posB;
    });
    return resultados[0].item;
  };

  const scrollParaAtividade = (atividadeId: string) => {
    const elemento = document.querySelector(`[data-atividade-id="${atividadeId}"]`);
    if (elemento && atividadesScrollRef.current) {
      elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      setHighlightedAtividadeId(atividadeId);
      highlightTimeoutRef.current = setTimeout(() => setHighlightedAtividadeId(null), 2000);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        setSearchBuffer('');
        lastKeyTimeRef.current = 0;
      }, 500);
    }
  };

  const handleItemClick = (atividadeId: string) => {
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    setHighlightedAtividadeId(atividadeId);
    highlightTimeoutRef.current = setTimeout(() => setHighlightedAtividadeId(null), 2000);
  };

  // Pesquisa por digitação na área de atividades + fecha modal ao digitar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const atividadesArea = atividadesScrollRef.current;
      if (!atividadesArea || !activeElement) return;
      const viewport = atividadesArea.querySelector('[data-radix-scroll-area-viewport]');
      const isInAtividadesArea = atividadesArea.contains(activeElement) || (viewport && viewport.contains(activeElement));
      if (!isInAtividadesArea) return;
      if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key.length > 1 && !['Backspace', 'Delete', 'Space'].includes(e.key)) return;

      if (palavrasChavesModalOpen && (e.key === 'Backspace' || e.key === 'Delete' || e.key === ' ' || /^[a-zA-Z0-9]$/.test(e.key))) {
        setPalavrasChavesModalOpen(false);
        setPalavrasChavesModalItem(null);
        setPalavrasChavesFloatingPos(null);
        setPalavrasChavesEditValue('');
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        setSearchBuffer(prev => {
          const novoBuffer = prev.length > 0 ? prev.slice(0, -1) : '';
          if (novoBuffer.length > 0) {
            setTimeout(() => {
              const encontrada = buscarAtividadePorNome(ramos, novoBuffer);
              if (encontrada) scrollParaAtividade(encontrada.id);
              else setHighlightedAtividadeId(null);
            }, 0);
          } else setHighlightedAtividadeId(null);
          return novoBuffer;
        });
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        if (highlightedAtividadeId) {
          toggleRamo(highlightedAtividadeId);
          setSearchBuffer('');
          return;
        }
        const agora = Date.now();
        const deveResetar = agora - lastKeyTimeRef.current > 800 || searchBuffer === '';
        lastKeyTimeRef.current = agora;
        const novoBuffer = deveResetar ? ' ' : (searchBuffer + ' ');
        setSearchBuffer(novoBuffer);
        const encontrada = buscarAtividadePorNome(ramos, novoBuffer);
        if (encontrada) scrollParaAtividade(encontrada.id);
        else {
          setHighlightedAtividadeId(null);
          searchTimeoutRef.current = setTimeout(() => {
            setSearchBuffer('');
            setHighlightedAtividadeId(null);
          }, 2000);
        }
        return;
      }

      if (!/^[a-zA-Z0-9]$/.test(e.key)) return;
      e.preventDefault();
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      const agora = Date.now();
      const deveResetar = agora - lastKeyTimeRef.current > 800 || searchBuffer === '';
      lastKeyTimeRef.current = agora;
      const novoBuffer = deveResetar ? e.key.toLowerCase() : (searchBuffer + e.key.toLowerCase()).toLowerCase();
      setSearchBuffer(novoBuffer);
      const encontrada = buscarAtividadePorNome(ramos, novoBuffer);
      if (encontrada) scrollParaAtividade(encontrada.id);
      else {
        setHighlightedAtividadeId(null);
        searchTimeoutRef.current = setTimeout(() => {
          setSearchBuffer('');
          setHighlightedAtividadeId(null);
        }, 1000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, [searchBuffer, ramos, highlightedAtividadeId, palavrasChavesModalOpen]);

  const renderRamoTree = (items: RamoAtividade[], level = 0) => {
    return items.map(item => {
      const isHighlighted = highlightedAtividadeId === item.id;
      const isSelected = selectedRamos.includes(item.id);
      return (
        <div key={item.id}>
          <ContextMenu>
            <ContextMenuTrigger asChild>
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
                  const top = placement === 'below' ? rect.bottom + 6 : Math.max(8, rect.top - FLOATING_PANEL_ESTIMATED_H - 6);
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
                  id={`atividades-${item.id}`}
                  checked={isSelected}
                  onCheckedChange={(checked) => {
                    toggleRamo(item.id);
                    if (checked) handleItemClick(item.id);
                  }}
                  className="h-3.5 w-3.5 mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="pl-2 text-[13px] text-[#262626] lowercase cursor-pointer select-none flex-1">
                  {item.nome}
                </span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                onSelect={() => {
                  setEditarItem(item);
                  setEditarNome(item.nome);
                  setEditarDialogOpen(true);
                }}
              >
                Editar atividade
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => {
                  setAdicionarComoPai(false);
                  setAdicionarParent(item);
                }}
              >
                Adicionar Atividade
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => {
                  setRemoverItem(item);
                  setRemoverDialogOpen(true);
                }}
              >
                Remover Atividade
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          {(item.children?.length > 0 || item.id === adicionarParent?.id) && (
            <div className="ml-[10px] pl-[14px] border-l border-gray-300">
              {item.children && renderRamoTree(item.children, level + 1)}
              {item.id === adicionarParent?.id && (
                <div className="py-1 rounded px-1 flex items-center gap-2">
                  <Checkbox disabled className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" checked={false} />
                  <Input
                    ref={adicionarInputRef}
                    value={adicionarNome}
                    onChange={(e) => setAdicionarNome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAdicionarAtividade();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelarAdicionar();
                      }
                    }}
                    placeholder="Nome da nova atividade (Enter para cadastrar)"
                    className="h-7 text-[13px] lowercase flex-1"
                    disabled={adicionarSaving}
                  />
                </div>
              )}
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
      <div className="flex flex-col h-full overflow-hidden">
        <div className="bg-white rounded-lg border border-border p-4 flex flex-col flex-1 min-h-0">
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <h2 className="text-base font-semibold text-[#262626] mb-4 cursor-context-menu select-none pr-2">
                Atividades - ({selectedRamos.length})
              </h2>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                onSelect={() => {
                  setAdicionarParent(null);
                  setAdicionarComoPai(true);
                }}
              >
                Adicionar Atividade
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          <ScrollArea
            ref={atividadesScrollRef}
            className="flex-1 focus:outline-none"
            tabIndex={0}
          >
            <div>
              {adicionarComoPai && (
                <div className="py-1 rounded px-1 flex items-center gap-2 mb-1">
                  <Checkbox disabled className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" checked={false} />
                  <Input
                    ref={adicionarInputRef}
                    value={adicionarNome}
                    onChange={(e) => setAdicionarNome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAdicionarAtividadePai();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelarAdicionar();
                      }
                    }}
                    placeholder="Nome da nova atividade pai (Enter para cadastrar)"
                    className="h-7 text-[13px] lowercase flex-1"
                    disabled={adicionarSaving}
                  />
                </div>
              )}
              {ramos.length === 0 && !adicionarComoPai ? (
                <p className="text-muted-foreground text-sm py-2">Nenhum ramo cadastrado.</p>
              ) : (
                renderRamoTree(ramos)
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Floating panel de palavras-chave */}
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

      {/* Modal Editar atividade */}
      <Dialog open={editarDialogOpen} onOpenChange={(open) => { setEditarDialogOpen(open); if (!open) setEditarItem(null); setEditarNome(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar atividade</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="editar-nome">Nome</Label>
            <Input
              id="editar-nome"
              value={editarNome}
              onChange={(e) => setEditarNome(e.target.value)}
              className="lowercase"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditarDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditarAtividade} disabled={editarSaving}>
              {editarSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Remover Atividade */}
      <AlertDialog open={removerDialogOpen} onOpenChange={(open) => { setRemoverDialogOpen(open); if (!open) setRemoverItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover atividade</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover &quot;{removerItem?.nome}&quot;? Subatividades vinculadas podem ser afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoverAtividade} disabled={removerSaving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {removerSaving ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
