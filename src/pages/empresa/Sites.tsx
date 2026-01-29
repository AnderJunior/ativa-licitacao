import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Site {
  id: string;
  dominio: string;
  site: string;
  orgao_id?: string | null;
  created_at: string;
}

interface Orgao {
  id: string;
  nome_orgao: string;
}

export default function Sites() {
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<Site[]>([]);
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSiteInput, setNewSiteInput] = useState('');
  
  // Filtros
  const [filtroDominio, setFiltroDominio] = useState('');
  const [filtroSite, setFiltroSite] = useState('');
  const [filtroOrgao, setFiltroOrgao] = useState<string | null>(null);
  
  // Dropdown de orgãos
  const [orgaos, setOrgaos] = useState<Orgao[]>([]);
  const [orgaoPopupOpen, setOrgaoPopupOpen] = useState(false);
  const [orgaoSearchTerm, setOrgaoSearchTerm] = useState('');
  const orgaoSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSites();
    loadOrgaos();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filtroDominio, filtroSite, filtroOrgao, allSites]);

  const loadOrgaos = async () => {
    const { data } = await supabase.from('orgaos').select('id, nome_orgao').order('nome_orgao');
    if (data) setOrgaos(data);
  };

  const applyFilters = () => {
    let filtered = [...allSites];

    if (filtroDominio.trim()) {
      filtered = filtered.filter(site =>
        site.dominio.toLowerCase().includes(filtroDominio.toLowerCase())
      );
    }

    if (filtroSite.trim()) {
      filtered = filtered.filter(site =>
        site.site.toLowerCase().includes(filtroSite.toLowerCase())
      );
    }

    if (filtroOrgao) {
      filtered = filtered.filter(site => site.orgao_id === filtroOrgao);
    }

    setSites(filtered);
  };

  const loadSites = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .order('dominio');
    
    if (error) {
      toast.error('Erro ao carregar sites');
    } else {
      setAllSites(data || []);
    }
    setLoading(false);
  };

  const parseSiteUrl = (input: string): { dominio: string; site: string } | null => {
    if (!input.trim()) return null;

    let url = input.trim();
    
    // Remove espaços
    url = url.replace(/\s+/g, '');
    
    // Remove protocolo se existir (vamos adicionar depois)
    url = url.replace(/^https?:\/\//i, '');
    
    // Remove barras no início se existirem
    url = url.replace(/^\/+/, '');
    
    // Divide em partes (domínio e caminho)
    const parts = url.split('/');
    let dominio = parts[0];
    
    // Garante que o domínio tenha www.
    if (!dominio.match(/^www\./i)) {
      dominio = 'www.' + dominio;
    }
    
    // Monta o caminho completo (tudo após o domínio)
    const path = parts.length > 1 ? '/' + parts.slice(1).join('/') : '';
    
    // Monta o site completo com https://
    const site = `https://${dominio}${path}`;
    
    return { dominio, site };
  };

  const handleAdd = async () => {
    if (!newSiteInput.trim()) {
      toast.error('Site é obrigatório');
      return;
    }

    const parsed = parseSiteUrl(newSiteInput);
    if (!parsed) {
      toast.error('URL inválida');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('sites')
      .insert({ dominio: parsed.dominio, site: parsed.site });

    if (error) {
      if (error.code === '23505') {
        toast.error('Este domínio já existe');
      } else {
        toast.error('Erro ao adicionar: ' + error.message);
      }
    } else {
      toast.success('Site adicionado!');
      setNewSiteInput('');
      setDialogOpen(false);
      loadSites();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('sites').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
    } else {
      toast.success('Site excluído!');
      loadSites();
    }
  };

  return (
    <MainLayout>
      <div className="bg-white rounded-lg border border-border p-6 h-full flex flex-col">
        <div className="flex items-start justify-between mb-[12px]">
          <h1 className="text-xl font-bold text-[#262626]">Sites</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#02572E] text-white hover:bg-[#024a27]">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar novo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-[#262626]">Novo Site</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="site" className="text-[#262626]">Site *</Label>
                  <Input
                    id="site"
                    value={newSiteInput}
                    onChange={(e) => setNewSiteInput(e.target.value)}
                    placeholder="Ex: teste.com/oocs ou www.teste.com/oocs"
                    className="bg-white"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAdd();
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    O domínio e URL completa serão gerados automaticamente
                  </p>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button onClick={handleAdd} disabled={saving} className="bg-[#02572E] text-white hover:bg-[#024a27]">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtros */}
        <div className="mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="filtro-dominio" className="text-sm font-normal text-[#262626]">Domínio</Label>
              <Input
                id="filtro-dominio"
                value={filtroDominio}
                onChange={(e) => setFiltroDominio(e.target.value)}
                placeholder="Filtrar por domínio..."
                className="bg-white h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-site" className="text-sm font-normal text-[#262626]">Site</Label>
              <Input
                id="filtro-site"
                value={filtroSite}
                onChange={(e) => setFiltroSite(e.target.value)}
                placeholder="Filtrar por site..."
                className="bg-white h-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filtro-orgao" className="text-sm font-normal text-[#262626]">Orgão</Label>
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
                  className="h-9 w-full justify-between font-normal bg-white"
                >
                  {filtroOrgao
                    ? (() => {
                        const orgaoEncontrado = orgaos.find((orgao) => orgao.id === filtroOrgao);
                        return orgaoEncontrado ? orgaoEncontrado.nome_orgao : 'Orgão selecionado';
                      })()
                    : "Selecione o Orgão"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-[--radix-popover-trigger-width] p-0" 
                align="start"
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
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum orgão encontrado.</CommandEmpty>
                    <CommandGroup className="p-0 max-h-[300px] overflow-y-auto">
                      {orgaos.map((orgao) => (
                        <CommandItem
                          key={orgao.id}
                          value={orgao.nome_orgao}
                          onSelect={() => {
                            setFiltroOrgao(orgao.id);
                            setOrgaoPopupOpen(false);
                          }}
                          className={cn(
                            "px-3 py-2 rounded-none cursor-pointer",
                            filtroOrgao === orgao.id
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
            {filtroOrgao && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltroOrgao(null)}
                className="h-7 text-xs text-gray-600 hover:text-gray-900"
              >
                Limpar filtro de orgão
              </Button>
            )}
          </div>
        </div>

        {/* Lista de Sites */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : sites.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {allSites.length === 0 
                ? 'Nenhum site cadastrado'
                : 'Nenhum site encontrado com os filtros aplicados'}
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="sticky top-0 bg-white z-20 shadow-sm [&_tr]:border-b">
                  <tr className="bg-white border-b">
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Domínio</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Site</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] text-right bg-white">Ações</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {sites.map((site) => (
                    <tr key={site.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle py-1.5 text-sm font-medium text-[#1A1A1A]">
                        {site.dominio}
                      </td>
                      <td className="p-4 align-middle py-1.5 text-sm font-medium text-[#1A1A1A]">
                        {site.site}
                      </td>
                      <td className="p-4 align-middle py-1.5 text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-7 w-7 rounded-full bg-red-100 hover:bg-red-600 text-red-700 hover:text-white p-0"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir site?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o site "{site.dominio}"? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(site.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
