import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Plus, X, ChevronsUpDown, ArrowLeft } from 'lucide-react';
import { CidadePopup } from '@/components/orgaos/CidadePopup';
import { cn } from '@/lib/utils';

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

export default function OrgaoCadastro() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orgaoId = searchParams.get('id');
  const isViewMode = searchParams.get('view') === 'true';

  const [loading, setLoading] = useState(false);
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
    endereco: '',
    telefone: '',
    compras_net: '',
    compras_mg: '',
    emails: [],
    sites: [],
    observacoes: '',
    obs_pncp: '',
  });

  const [newEmail, setNewEmail] = useState('');
  const [newSite, setNewSite] = useState('');

  useEffect(() => {
    loadGrupos();
    if (orgaoId) {
      loadOrgao(orgaoId);
    }
  }, [orgaoId]);

  const loadGrupos = async () => {
    const { data } = await supabase.from('grupo_de_orgaos').select('*').order('nome');
    if (data) setGrupos(data);
  };

  const handleSelectCidade = (uf: string, cidadeId: string, cidadeNome: string) => {
    setFormData(prev => ({
      ...prev,
      uf: uf,
      cidade_ibge: cidadeId,
    }));
    setCidadeDisplay(`${uf} - ${cidadeNome}`);
  };

  const loadOrgao = async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orgaos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      setFormData(data);
      
      // Carregar nome da cidade se tiver UF e cidade_ibge
      if (data.uf && data.cidade_ibge) {
        try {
          const response = await fetch(
            `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${data.cidade_ibge}`
          );
          const municipio = await response.json();
          if (municipio && municipio.nome) {
            setCidadeDisplay(`${data.uf} - ${municipio.nome}`);
          }
        } catch (error) {
          console.error('Erro ao carregar nome da cidade:', error);
        }
      }
      
      // Carregar grupos vinculados
      const { data: vinculos } = await supabase
        .from('orgaos_grupos')
        .select('grupo_id')
        .eq('orgao_id', id);
      if (vinculos && vinculos.length > 0) {
        setSelectedGrupo(vinculos[0].grupo_id);
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.nome_orgao?.trim()) {
      toast.error('Nome do órgão é obrigatório');
      return;
    }

    setSaving(true);
    try {
      let orgaoIdToUse = orgaoId;

      if (orgaoId) {
        const { error } = await supabase
          .from('orgaos')
          .update({
            nome_orgao: formData.nome_orgao,
            uf: formData.uf || null,
            cidade_ibge: formData.cidade_ibge || null,
            endereco: formData.endereco || null,
            telefone: formData.telefone || null,
            compras_net: formData.compras_net || null,
            compras_mg: formData.compras_mg || null,
            emails: formData.emails || [],
            sites: formData.sites || [],
            observacoes: formData.observacoes || null,
            obs_pncp: formData.obs_pncp || null,
          })
          .eq('id', orgaoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('orgaos')
          .insert({
            nome_orgao: formData.nome_orgao,
            uf: formData.uf || null,
            cidade_ibge: formData.cidade_ibge || null,
            endereco: formData.endereco || null,
            telefone: formData.telefone || null,
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
        orgaoIdToUse = data.id;
      }

      // Sincronizar grupo
      if (orgaoIdToUse) {
        await supabase.from('orgaos_grupos').delete().eq('orgao_id', orgaoIdToUse);

        if (selectedGrupo) {
          await supabase.from('orgaos_grupos').insert({
            orgao_id: orgaoIdToUse,
            grupo_id: selectedGrupo,
          });
        }
      }

      toast.success(orgaoId ? 'Órgão atualizado com sucesso!' : 'Órgão salvo com sucesso!');
      
      // Se for um novo cadastro (não há orgaoId), limpar todos os campos
      if (!orgaoId) {
        setFormData({
          nome_orgao: '',
          uf: '',
          cidade_ibge: '',
          endereco: '',
          telefone: '',
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
        setNewSite('');
      }
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
    
    // Verifica se o email já existe
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

  const addSite = () => {
    if (newSite.trim()) {
      setFormData({
        ...formData,
        sites: [...(formData.sites || []), newSite.trim()],
      });
      setNewSite('');
    }
  };

  const removeSite = (index: number) => {
    const sites = [...(formData.sites || [])];
    sites.splice(index, 1);
    setFormData({ ...formData, sites });
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
      <div className="bg-white rounded-lg border border-border p-6">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between mb-[12px]">
          <div className="flex items-center gap-3">
            {orgaoId && !isViewMode && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/orgaos/sem-ibge')}
                className="h-8 w-8"
                title="Voltar para lista de órgãos"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-xl font-bold text-[#262626]">
              {isViewMode 
                ? 'Visualização de Órgãos' 
                : orgaoId 
                  ? 'Atualizar Informações de Órgãos' 
                  : 'Cadastro de Órgãos'}
            </h1>
          </div>
          {!isViewMode && (
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-[#02572E] text-white hover:bg-[#024a27] px-6"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          )}
        </div>

        {/* Linha 1: Nome do Órgão, Compras NET, Compras MG */}
        <div className="grid grid-cols-12 gap-4 mb-[12px]">
          <div className="col-span-6 space-y-0.5">
            <Label htmlFor="nome_orgao" className="text-[14px] font-normal text-[#262626]">Nome do Órgão</Label>
            <Input
              id="nome_orgao"
              value={formData.nome_orgao || ''}
              onChange={(e) => setFormData({ ...formData, nome_orgao: e.target.value })}
              className="h-9 bg-white"
              disabled={isViewMode}
            />
          </div>
          <div className="col-span-3 space-y-0.5">
            <Label htmlFor="compras_net" className="text-[14px] font-normal text-[#262626]">Compras NET</Label>
            <Input
              id="compras_net"
              value={formData.compras_net || ''}
              onChange={(e) => setFormData({ ...formData, compras_net: e.target.value })}
              className="h-9 bg-white"
              disabled={isViewMode}
            />
          </div>
          <div className="col-span-3 space-y-0.5">
            <Label htmlFor="compras_mg" className="text-[14px] font-normal text-[#262626]">Compras MG</Label>
            <Input
              id="compras_mg"
              value={formData.compras_mg || ''}
              onChange={(e) => setFormData({ ...formData, compras_mg: e.target.value })}
              className="h-9 bg-white"
              disabled={isViewMode}
            />
          </div>
        </div>

        {/* Linha 2: Cidade IBGE, Grupos de Orgãos */}
        <div className="grid grid-cols-12 gap-4 mb-[12px]">
          <div className="col-span-6 space-y-0.5">
            <Label htmlFor="cidade_ibge" className="text-[14px] font-normal text-[#262626]">Cidade IBGE</Label>
            <Input
              id="cidade_ibge"
              value={cidadeDisplay}
              onClick={() => !isViewMode && setCidadePopupOpen(true)}
              readOnly
              placeholder="Selecione a Cidade"
              className="h-9 cursor-pointer bg-white"
              disabled={isViewMode}
            />
          </div>
          <div className="col-span-6 space-y-0.5">
            <Label htmlFor="grupo" className="text-[14px] font-normal text-[#262626]">Grupos de Orgãos</Label>
            <Popover open={grupoPopupOpen} onOpenChange={(open) => !isViewMode && setGrupoPopupOpen(open)}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={grupoPopupOpen}
                  className="h-9 w-full justify-between font-normal bg-white"
                  disabled={isViewMode}
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

        {/* Linha 3: Endereço, Telefone, E-mails */}
        <div className="grid grid-cols-12 gap-4 mb-[12px]">
          <div className="col-span-5 space-y-0.5">
            <Label htmlFor="endereco" className="text-[14px] font-normal text-[#262626]">Endereço</Label>
            <Input
              id="endereco"
              placeholder="Endereço do Orgão"
              value={formData.endereco || ''}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              className="h-9 bg-white"
              disabled={isViewMode}
            />
          </div>
          <div className="col-span-2 space-y-0.5">
            <Label htmlFor="telefone" className="text-[14px] font-normal text-[#262626]">Telefone</Label>
            <Input
              id="telefone"
              placeholder="Digite o telefone"
              value={formData.telefone || ''}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              className="h-9 bg-white"
              disabled={isViewMode}
            />
          </div>
          <div className="col-span-5 space-y-0.5">
            <Label className="text-[14px] font-normal text-[#262626]">E-mails</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Digite o E-mail"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                className="h-9 flex-1 bg-white"
                disabled={isViewMode}
              />
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={addEmail}
                className="h-9 w-9 shrink-0"
                disabled={isViewMode}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Linha 4: Orgão (textarea), PNCP (textarea), área de emails */}
        <div className="grid grid-cols-12 gap-4 mb-[12px]">
          <div className="col-span-4 space-y-0.5">
            <Label htmlFor="observacoes" className="text-[14px] font-normal text-[#262626]">Orgão</Label>
            <Textarea
              id="observacoes"
              placeholder="Adicione anotações do Orgão"
              value={formData.observacoes || ''}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              className="resize-none h-[120px] text-[14px] bg-white"
              disabled={isViewMode}
            />
          </div>
          <div className="col-span-3 space-y-0.5">
            <Label htmlFor="obs_pncp" className="text-[14px] font-normal text-[#262626]">PNCP</Label>
            <Textarea
              id="obs_pncp"
              placeholder="Adicione anotações do Orgão"
              value={formData.obs_pncp || ''}
              onChange={(e) => setFormData({ ...formData, obs_pncp: e.target.value })}
              className="resize-none h-[120px] text-[14px] bg-white"
              disabled={isViewMode}
            />
          </div>
          {/* Área pontilhada para emails - alinhada com a coluna de E-mails acima (5 colunas) */}
          <div className="col-span-5">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 h-full min-h-[140px]">
              <div className="flex flex-wrap gap-2">
                {(formData.emails || []).map((email, index) => (
                  <span key={index} className="inline-flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs">
                    {email}
                    {!isViewMode && (
                      <button onClick={() => removeEmail(index)} className="hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Linha 5: Sites */}
        <div className="mb-[12px]">
          <Label className="text-[14px] font-normal text-[#262626]">Sites</Label>
          <div className="flex gap-2 mt-1">
            <Input
              type="url"
              placeholder="Digite o link do site"
              value={newSite}
              onChange={(e) => setNewSite(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSite())}
              className="h-9 flex-1 bg-white"
              disabled={isViewMode}
            />
            <Button 
              type="button" 
              variant="outline" 
              size="icon"
              onClick={addSite}
              className="h-9 w-9 shrink-0"
              disabled={isViewMode}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Área pontilhada para sites e arquivos */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[150px]">
          <div className="flex flex-wrap gap-2">
            {(formData.sites || []).map((site, index) => (
              <span key={index} className="inline-flex items-center gap-1 bg-muted px-3 py-1.5 rounded text-sm">
                <a href={site} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {site}
                </a>
                {!isViewMode && (
                  <button onClick={() => removeSite(index)} className="hover:text-red-500 ml-1">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Popup de seleção de cidade */}
      {!isViewMode && (
        <CidadePopup
          open={cidadePopupOpen}
          onOpenChange={setCidadePopupOpen}
          onSelect={handleSelectCidade}
        />
      )}
    </MainLayout>
  );
}
