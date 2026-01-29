import { useState, useEffect, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Dialog,
  DialogPortal,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Loader2, Save, Plus, X, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CidadePopup } from '@/components/orgaos/CidadePopup';
import { cn } from '@/lib/utils';

interface Site {
  id: string;
  dominio: string;
  site: string;
}

interface Orgao {
  id: string;
  nome_orgao: string;
  uf: string | null;
  cidade_ibge: string | null;
  endereco: string | null;
  telefone: string | null;
  compras_net: string | null;
  compras_mg: string | null;
  emails: string[] | null;
  sites: string[] | null;
  observacoes: string | null;
  obs_pncp: string | null;
}

interface GrupoOrgao {
  id: string;
  nome: string;
}

interface CadastrarOrgaoPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrgaoCadastrado?: () => void;
}

export function CadastrarOrgaoPopup({
  open,
  onOpenChange,
  onOrgaoCadastrado,
}: CadastrarOrgaoPopupProps) {
  const [saving, setSaving] = useState(false);
  const [grupos, setGrupos] = useState<GrupoOrgao[]>([]);
  const [selectedGrupo, setSelectedGrupo] = useState<string>('');
  const [grupoPopupOpen, setGrupoPopupOpen] = useState(false);
  const [cidadePopupOpen, setCidadePopupOpen] = useState(false);
  const [cidadeDisplay, setCidadeDisplay] = useState('');

  const [formData, setFormData] = useState<Partial<Orgao>>({
    nome_orgao: '',
    uf: '',
    cidade_ibge: '',
    compras_net: '',
    compras_mg: '',
    emails: [],
    sites: [],
    observacoes: '',
    obs_pncp: '',
  });

  const [newEmail, setNewEmail] = useState('');
  
  // Estados para dropdown de sites
  const [sites, setSites] = useState<Site[]>([]);
  const [sitePopupOpen, setSitePopupOpen] = useState(false);
  const [siteSearchTerm, setSiteSearchTerm] = useState('');
  const siteSearchInputRef = useRef<HTMLInputElement>(null);

  // Estados para arrastar o dialog
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const dialogContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      loadGrupos();
      loadSites();
      // Quando o popup abre, garante que está no centro
      setPosition({ x: 0, y: 0 });
    } else {
      // Limpa o formulário quando fecha
      setFormData({
        nome_orgao: '',
        uf: '',
        cidade_ibge: '',
        compras_net: '',
        compras_mg: '',
        emails: [],
        sites: [],
        observacoes: '',
        obs_pncp: '',
      });
      setSelectedGrupo('');
      setCidadeDisplay('');
      setNewEmail('');
      setSiteSearchTerm('');
      setPosition({ x: 0, y: 0 });
    }
  }, [open]);

  // Foca no input quando o popover de sites abre
  useEffect(() => {
    if (sitePopupOpen && siteSearchInputRef.current) {
      setTimeout(() => {
        siteSearchInputRef.current?.focus();
      }, 100);
    }
  }, [sitePopupOpen]);

  const loadGrupos = async () => {
    const { data } = await supabase.from('grupo_de_orgaos').select('*').order('nome');
    if (data) setGrupos(data);
  };

  const loadSites = async () => {
    const { data } = await supabase.from('sites').select('*').order('dominio');
    if (data) setSites(data);
  };

  const handleSelectCidade = (uf: string, cidadeId: string, cidadeNome: string) => {
    setFormData(prev => ({
      ...prev,
      uf: uf,
      cidade_ibge: cidadeId,
    }));
    setCidadeDisplay(`${uf} - ${cidadeNome}`);
  };

  // Aplica o transform diretamente no elemento DOM sem animação
  useEffect(() => {
    if (dialogContentRef.current && open) {
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
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragStart]);

  const handleSave = async () => {
    if (!formData.nome_orgao?.trim()) {
      toast.error('Nome do órgão é obrigatório');
      return;
    }
    
    if (!formData.cidade_ibge || !formData.uf) {
      toast.error('Cidade é obrigatória');
      return;
    }
    
    if (!formData.sites || formData.sites.length === 0) {
      toast.error('É necessário adicionar pelo menos um site');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('orgaos')
        .insert({
          nome_orgao: formData.nome_orgao,
          uf: formData.uf || null,
          cidade_ibge: formData.cidade_ibge || null,
          compras_net: formData.compras_net || null,
          compras_mg: formData.compras_mg || null,
          emails: formData.emails || [],
          sites: formData.sites || [],
          observacoes: formData.observacoes || null,
          obs_pncp: formData.obs_pncp || null,
        })
        .select('id')
        .single();
      
      if (error) throw error;

      // Sincronizar grupo
      if (data.id && selectedGrupo) {
        await supabase.from('orgaos_grupos').insert({
          orgao_id: data.id,
          grupo_id: selectedGrupo,
        });
      }

      toast.success('Órgão salvo com sucesso!');
      onOrgaoCadastrado?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const addEmail = () => {
    const email = newEmail.trim();
    if (!email) {
      return;
    }
    
    if (!isValidEmail(email)) {
      toast.error('Por favor, insira um e-mail válido');
      return;
    }
    
    if (formData.emails?.includes(email)) {
      toast.error('Este e-mail já foi adicionado');
      return;
    }
    
    setFormData({
      ...formData,
      emails: [...(formData.emails || []), email],
    });
    setNewEmail('');
  };

  const removeEmail = (index: number) => {
    const emails = [...(formData.emails || [])];
    emails.splice(index, 1);
    setFormData({ ...formData, emails });
  };

  const addSite = (siteUrl: string) => {
    // Verifica se o site já foi adicionado
    if (formData.sites?.includes(siteUrl)) {
      toast.error('Este site já foi adicionado');
      return;
    }
    
    setFormData({
      ...formData,
      sites: [...(formData.sites || []), siteUrl],
    });
    setSitePopupOpen(false);
    setSiteSearchTerm('');
  };

  const removeSite = (index: number) => {
    const sites = [...(formData.sites || [])];
    sites.splice(index, 1);
    setFormData({ ...formData, sites });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogPrimitive.Content
            ref={dialogContentRef}
            className={cn(
              "fixed left-[50%] top-[50%] z-50 w-full sm:max-w-[1000px] max-w-[95vw] max-h-[90vh] flex flex-col gap-0 border bg-background p-0 shadow-2xl sm:rounded-lg overflow-hidden",
              "data-[state=open]:opacity-100 data-[state=closed]:opacity-0"
            )}
            style={{ transition: 'none' }}
          >
            {/* Header arrastável */}
            <div 
              className={`p-4 border-b select-none bg-white ${isDragging ? 'cursor-grabbing' : 'cursor-move'}`}
              onMouseDown={handleMouseDown}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#262626]">
                  Cadastro de Órgão
                </h2>
                <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>
            </div>

            {/* Conteúdo com scroll */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {/* Linha 1: Nome do Órgão, Compras NET, Compras MG */}
              <div className="grid grid-cols-12 gap-4 mb-3">
                <div className="col-span-6 space-y-0.5">
                  <Label htmlFor="nome_orgao" className="text-[14px] font-normal text-[#262626]">Nome do Órgão</Label>
                  <Input
                    id="nome_orgao"
                    value={formData.nome_orgao || ''}
                    onChange={(e) => setFormData({ ...formData, nome_orgao: e.target.value })}
                    className="h-9 bg-white"
                  />
                </div>
                <div className="col-span-3 space-y-0.5">
                  <Label htmlFor="compras_net" className="text-[14px] font-normal text-[#262626]">Compras NET</Label>
                  <Input
                    id="compras_net"
                    value={formData.compras_net || ''}
                    onChange={(e) => setFormData({ ...formData, compras_net: e.target.value })}
                    className="h-9 bg-white"
                  />
                </div>
                <div className="col-span-3 space-y-0.5">
                  <Label htmlFor="compras_mg" className="text-[14px] font-normal text-[#262626]">Compras MG</Label>
                  <Input
                    id="compras_mg"
                    value={formData.compras_mg || ''}
                    onChange={(e) => setFormData({ ...formData, compras_mg: e.target.value })}
                    className="h-9 bg-white"
                  />
                </div>
              </div>

              {/* Linha 2: Cidade IBGE, Grupos de Orgãos */}
              <div className="grid grid-cols-12 gap-4 mb-3">
                <div className="col-span-6 space-y-0.5">
                  <Label htmlFor="cidade_ibge" className="text-[14px] font-normal text-[#262626]">Cidade IBGE</Label>
                  <Input
                    id="cidade_ibge"
                    value={cidadeDisplay}
                    onClick={() => setCidadePopupOpen(true)}
                    readOnly
                    placeholder="Selecione a Cidade"
                    className="h-9 cursor-pointer bg-white"
                  />
                </div>
                <div className="col-span-6 space-y-0.5">
                  <Label htmlFor="grupo" className="text-[14px] font-normal text-[#262626]">Grupos de Orgãos</Label>
                  <Popover open={grupoPopupOpen} onOpenChange={setGrupoPopupOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={grupoPopupOpen}
                        className="h-9 w-full justify-between font-normal bg-white"
                      >
                        {selectedGrupo
                          ? grupos.find((grupo) => grupo.id === selectedGrupo)?.nome
                          : "Selecione o Grupo"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar grupo..." />
                        <CommandList>
                          <CommandEmpty>Nenhum grupo encontrado.</CommandEmpty>
                          <CommandGroup className="p-0">
                            {grupos.map((grupo) => (
                              <CommandItem
                                key={grupo.id}
                                value={grupo.nome}
                                onSelect={() => {
                                  setSelectedGrupo(grupo.id === selectedGrupo ? '' : grupo.id);
                                  setGrupoPopupOpen(false);
                                }}
                                className={cn(
                                  "px-3 py-2 rounded-none cursor-pointer",
                                  selectedGrupo === grupo.id 
                                    ? "!bg-[#02572E]/10 !text-[#02572E]" 
                                    : "!bg-transparent !text-foreground hover:!bg-accent hover:!text-accent-foreground"
                                )}
                              >
                                {grupo.nome}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Linha 3: Orgão (textarea), PNCP (textarea), E-mails */}
              <div className="grid grid-cols-12 gap-4 mb-3">
                <div className="col-span-4 space-y-0.5">
                  <Label htmlFor="observacoes" className="text-[14px] font-normal text-[#262626]">Orgão</Label>
                  <Textarea
                    id="observacoes"
                    placeholder="Adicione anotações do Orgão"
                    value={formData.observacoes || ''}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    className="resize-none h-[142px] text-[14px] bg-white"
                  />
                </div>
                <div className="col-span-3 space-y-0.5">
                  <Label htmlFor="obs_pncp" className="text-[14px] font-normal text-[#262626]">PNCP</Label>
                  <Textarea
                    id="obs_pncp"
                    placeholder="Adicione anotações do Orgão"
                    value={formData.obs_pncp || ''}
                    onChange={(e) => setFormData({ ...formData, obs_pncp: e.target.value })}
                    className="resize-none h-[142px] text-[14px] bg-white"
                  />
                </div>
                <div className="col-span-5">
                  <Label className="text-[14px] font-normal text-[#262626]">E-mails</Label>
                  <div className="flex gap-2 mt-1 mb-3">
                    <Input
                      type="email"
                      placeholder="Digite o E-mail"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                      className="h-9 flex-1 bg-white"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={addEmail}
                      className="h-9 w-9 shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 h-[90px]">
                    <div className="flex flex-wrap gap-2">
                      {(formData.emails || []).map((email, index) => (
                        <span key={index} className="inline-flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs">
                          {email}
                          <button onClick={() => removeEmail(index)} className="hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Linha 4: Sites */}
              <div className="mb-3">
                <Label className="text-[14px] font-normal text-[#262626]">Sites</Label>
                <div className="mt-1">
                  <Popover 
                    open={sitePopupOpen} 
                    onOpenChange={(open) => {
                      setSitePopupOpen(open);
                      if (!open) {
                        setSiteSearchTerm('');
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={sitePopupOpen}
                        className="h-9 w-full justify-between font-normal bg-white"
                      >
                        Selecione um site
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-[--radix-popover-trigger-width] p-0" 
                      align="start"
                    >
                      <Command>
                        <CommandInput 
                          ref={siteSearchInputRef}
                          placeholder="Buscar site..." 
                          value={siteSearchTerm}
                          onValueChange={(value) => {
                            setSiteSearchTerm(value);
                          }}
                          autoFocus={sitePopupOpen}
                          onKeyDown={(e) => {
                            if (e.key === 'Tab' && !e.shiftKey) {
                              e.preventDefault();
                              // Encontra o item destacado na lista
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
                              setSitePopupOpen(false);
                            }
                          }}
                        />
                        {siteSearchTerm && (
                          <CommandList>
                            <CommandEmpty>Nenhum site encontrado.</CommandEmpty>
                            <CommandGroup className="p-0 max-h-[300px] overflow-y-auto">
                              {sites
                                .filter((site) => {
                                  if (!siteSearchTerm) return false;
                                  const searchLower = siteSearchTerm.toLowerCase();
                                  const dominioLower = site.dominio?.toLowerCase() || '';
                                  const siteLower = site.site?.toLowerCase() || '';
                                  return dominioLower.includes(searchLower) || siteLower.includes(searchLower);
                                })
                                .map((site) => {
                                  const isSelected = formData.sites?.includes(site.site) || false;
                                  return (
                                    <CommandItem
                                      key={site.id}
                                      value={`${site.dominio} - ${site.site}`}
                                      onSelect={() => {
                                        if (!isSelected) {
                                          addSite(site.site);
                                        }
                                      }}
                                      disabled={isSelected}
                                      className={cn(
                                        "px-3 py-2 rounded-none cursor-pointer",
                                        isSelected
                                          ? "!bg-gray-100 !text-gray-400 cursor-not-allowed"
                                          : "!bg-transparent !text-foreground hover:!bg-accent hover:!text-accent-foreground"
                                      )}
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">{site.dominio}</span>
                                        <span className="text-xs text-gray-500">{site.site}</span>
                                      </div>
                                      {isSelected && (
                                        <span className="ml-auto text-xs text-gray-400">Já adicionado</span>
                                      )}
                                    </CommandItem>
                                  );
                                })}
                            </CommandGroup>
                          </CommandList>
                        )}
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Área pontilhada para sites */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[150px]">
                <div className="flex flex-wrap gap-2">
                  {(formData.sites || []).map((site, index) => (
                    <span key={index} className="inline-flex items-center gap-1 bg-muted px-3 py-1.5 rounded text-sm">
                      <a href={site} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {site}
                      </a>
                      <button onClick={() => removeSite(index)} className="hover:text-red-500 ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer com botão salvar */}
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <Button 
                onClick={handleSave} 
                disabled={saving || !formData.nome_orgao?.trim() || !formData.cidade_ibge || !formData.uf || !formData.sites || formData.sites.length === 0}
                className="bg-[#02572E] text-white hover:bg-[#024a27] px-6"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      {/* Popup de seleção de cidade */}
      <CidadePopup
        open={cidadePopupOpen}
        onOpenChange={setCidadePopupOpen}
        onSelect={handleSelectCidade}
      />
    </>
  );
}
