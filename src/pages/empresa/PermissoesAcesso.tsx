import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, Search, Trash2, Key, Pencil, Building2, Download, FileText, Shield, Copy, ChevronRight } from 'lucide-react';

const ABAS = [
  { id: 'usuarios', label: 'Cadastro de Usuários' },
  { id: 'direitos', label: 'Direitos de Usuários e Grupos' },
  { id: 'grupos', label: 'Cadastro de Grupos e Permissões' },
  { id: 'igualar', label: 'Igualar Permissões' },
] as const;

type AbaId = (typeof ABAS)[number]['id'];

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  cpf?: string | null;
  created_at: string;
}

interface Grupo {
  id: string;
  nome: string;
}

interface Menu {
  id: string;
  nome: string;
  path: string | null;
  ordem: number;
  parent_id: string | null;
}

interface GrupoPermissao {
  grupo_id: string;
  menu_id: string;
  abrir: boolean;
  salvar: boolean;
  excluir: boolean;
}

// Menus estáticos (fallback se tabela não existir)
const MENUS_FALLBACK: { id: string; nome: string; path: string | null; ordem: number; parent_id: string | null }[] = [
  { id: 'ativa', nome: 'ATIVA', path: null, ordem: 0, parent_id: null },
  { id: 'lic-cad', nome: '...Licitação - Cadastro', path: '/licitacoes/cadastro', ordem: 1, parent_id: 'ativa' },
  { id: 'lic-cons', nome: '...Licitação - Consulta', path: '/licitacoes/consulta', ordem: 2, parent_id: 'ativa' },
  { id: 'lic-tipos', nome: '...Licitação - Tipos de Licitação', path: '/licitacoes/tipos', ordem: 3, parent_id: 'ativa' },
  { id: 'lic-marc', nome: '...Licitação - Marcação Pendente', path: '/licitacoes/marcacoes-pendentes', ordem: 4, parent_id: 'ativa' },
  { id: 'org-cad', nome: '...Órgãos - Cadastro', path: '/orgaos/cadastro', ordem: 5, parent_id: 'ativa' },
  { id: 'org-cons', nome: '...Órgãos - Consulta', path: '/orgaos/sem-ibge', ordem: 6, parent_id: 'ativa' },
  { id: 'org-agr', nome: '...Órgãos - Agrupamentos', path: '/orgaos/agrupamentos', ordem: 7, parent_id: 'ativa' },
  { id: 'emp-sites', nome: '...Empresa - Sites', path: '/empresa/sites', ordem: 8, parent_id: 'ativa' },
  { id: 'emp-ativ', nome: '...Empresa - Atividades', path: '/empresa/atividades', ordem: 9, parent_id: 'ativa' },
  { id: 'emp-email', nome: '...Empresa - Caixas de E-mail', path: '/empresa/caixas-email', ordem: 10, parent_id: 'ativa' },
  { id: 'emp-perm', nome: '...Empresa - Permissões de Acesso', path: '/empresa/permissoes', ordem: 11, parent_id: 'ativa' },
];

export default function PermissoesAcesso() {
  const [activeTab, setActiveTab] = useState<AbaId>('usuarios');
  const { signUp } = useAuth();

  // Cadastro de Usuários - estados
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [selectedUsuario, setSelectedUsuario] = useState<Profile | null>(null);
  const [criarLoginOpen, setCriarLoginOpen] = useState(false);
  const [criarLoginSaving, setCriarLoginSaving] = useState(false);
  const [pessoaSearch, setPessoaSearch] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaSenha, setNovaSenha] = useState('');

  // Direitos de Usuários e Grupos - estados
  const [modoDireitos, setModoDireitos] = useState<'grupos' | 'usuarios'>('grupos');
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [gruposUsuarios, setGruposUsuarios] = useState<{ grupo_id: string; user_id: string }[]>([]);
  const [selectedGrupo, setSelectedGrupo] = useState<Grupo | null>(null);
  const [loadingDireitos, setLoadingDireitos] = useState(true);

  // Cadastro de Grupos e Permissões - estados
  const [gruposCadastro, setGruposCadastro] = useState<Grupo[]>([]);
  const [selectedGrupoCadastro, setSelectedGrupoCadastro] = useState<Grupo | null>(null);
  const [descricaoGrupo, setDescricaoGrupo] = useState('');
  const [menus, setMenus] = useState<Menu[]>([]);
  const [gruposPermissoes, setGruposPermissoes] = useState<GrupoPermissao[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(true);
  const [savingGrupo, setSavingGrupo] = useState(false);

  // Igualar Permissões - estados
  const [usuariosIgualar, setUsuariosIgualar] = useState<Profile[]>([]);
  const [selectedSourceUser, setSelectedSourceUser] = useState<Profile | null>(null);
  const [selectedTargetUser, setSelectedTargetUser] = useState<Profile | null>(null);
  const [loadingIgualar, setLoadingIgualar] = useState(true);
  const [copiandoPermissoes, setCopiandoPermissoes] = useState(false);

  useEffect(() => {
    if (activeTab === 'usuarios') {
      loadUsuarios();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'direitos') {
      loadDireitos();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'grupos') {
      loadGruposCadastro();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'igualar') {
      loadIgualar();
    }
  }, [activeTab]);

  const loadGruposCadastro = async () => {
    setLoadingGrupos(true);
    try {
      const [gruposRes, menusRes, permRes] = await Promise.all([
        supabase.from('grupos').select('id, nome').order('nome'),
        supabase.from('menus').select('id, nome, path, ordem, parent_id').order('ordem'),
        supabase.from('grupos_permissoes').select('grupo_id, menu_id, abrir, salvar, excluir'),
      ]);
      if (gruposRes.data) {
        setGruposCadastro(gruposRes.data);
        if (selectedGrupoCadastro) {
          const g = gruposRes.data.find((x) => x.id === selectedGrupoCadastro.id);
          setSelectedGrupoCadastro(g || null);
          if (g) setDescricaoGrupo(g.nome);
        }
      }
      if (menusRes.data) setMenus(menusRes.data);
      else setMenus([]);
      if (permRes.data) setGruposPermissoes(permRes.data);
    } catch {
      setMenus(MENUS_FALLBACK as Menu[]);
      const { data } = await supabase.from('grupos').select('id, nome').order('nome');
      if (data) setGruposCadastro(data);
    }
    setLoadingGrupos(false);
  };

  const loadIgualar = async () => {
    setLoadingIgualar(true);
    const { data } = await supabase.from('profiles').select('id, user_id, full_name, email').order('full_name');
    if (data) setUsuariosIgualar(data);
    setLoadingIgualar(false);
  };

  const handleCopiarPermissoes = async () => {
    if (!selectedSourceUser || !selectedTargetUser) {
      toast.error('Selecione o usuário de origem e o usuário de destino');
      return;
    }
    if (selectedSourceUser.user_id === selectedTargetUser.user_id) {
      toast.error('Selecione usuários diferentes');
      return;
    }
    setCopiandoPermissoes(true);
    const { data: gruposOrigem } = await supabase.from('grupos_usuarios').select('grupo_id').eq('user_id', selectedSourceUser.user_id);
    await supabase.from('grupos_usuarios').delete().eq('user_id', selectedTargetUser.user_id);
    if (gruposOrigem?.length) {
      const novos = gruposOrigem.map((g) => ({ grupo_id: g.grupo_id, user_id: selectedTargetUser.user_id }));
      const { error } = await supabase.from('grupos_usuarios').insert(novos);
      if (error) toast.error('Erro ao copiar: ' + error.message);
      else toast.success('Permissões copiadas com sucesso!');
    } else {
      toast.success('Permissões copiadas (usuário de origem não tinha grupos)');
    }
    setCopiandoPermissoes(false);
  };

  const loadDireitos = async () => {
    setLoadingDireitos(true);
    try {
      const [gruposRes, guRes, profilesRes] = await Promise.all([
        supabase.from('grupos').select('id, nome').order('nome'),
        supabase.from('grupos_usuarios').select('grupo_id, user_id'),
        supabase.from('profiles').select('id, user_id, full_name, email').order('full_name'),
      ]);
      if (gruposRes.data) setGrupos(gruposRes.data);
      if (guRes.data) setGruposUsuarios(guRes.data);
      if (profilesRes.data) setUsuarios(profilesRes.data);
      if (gruposRes.error) toast.error('Erro ao carregar grupos. Execute a migração supabase_migration_grupos.sql');
    } catch {
      toast.error('Erro ao carregar dados. Execute a migração supabase_migration_grupos.sql');
    }
    setLoadingDireitos(false);
  };

  const loadUsuarios = async () => {
    setLoadingUsuarios(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, email, cpf, created_at')
      .order('full_name');
    if (error) {
      toast.error('Erro ao carregar usuários');
    } else {
      setUsuarios(data || []);
    }
    setLoadingUsuarios(false);
  };

  const handleCriarLogin = async () => {
    const email = novoEmail.trim();
    const nome = novoNome.trim();
    const senha = novaSenha;

    if (!email) {
      toast.error('E-mail é obrigatório');
      return;
    }
    if (!senha || senha.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }

    setCriarLoginSaving(true);
    const { error } = await signUp(email, senha, nome || undefined);
    setCriarLoginSaving(false);

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        toast.error('Este e-mail já está cadastrado');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Login criado com sucesso! O usuário receberá um e-mail de confirmação.');
      setCriarLoginOpen(false);
      setNovoEmail('');
      setNovoNome('');
      setNovaSenha('');
      loadUsuarios();
    }
  };

  const handleExcluirUsuario = async (profile: Profile) => {
    toast.info('Exclusão de usuário requer integração com Supabase Admin API');
  };

  const handleResetSenha = async (profile: Profile) => {
    toast.info('Reset de senha requer integração com Supabase Auth');
  };

  const handleEditarCadastro = (profile: Profile) => {
    toast.info('Edição de cadastro em desenvolvimento');
  };

  const handleEditarEmpresa = () => {
    toast.info('Edição de empresa em desenvolvimento');
  };

  const handleExportar = (tipo: string) => {
    toast.info(`Exportar ${tipo} em desenvolvimento`);
  };

  const isUserInGrupo = (userId: string, grupoId: string) =>
    gruposUsuarios.some((gu) => gu.grupo_id === grupoId && gu.user_id === userId);

  const toggleGrupoUsuario = async (grupoId: string, userId: string, checked: boolean) => {
    if (checked) {
      const { error } = await supabase.from('grupos_usuarios').insert({ grupo_id: grupoId, user_id: userId });
      if (error) toast.error('Erro ao adicionar: ' + error.message);
      else {
        setGruposUsuarios((prev) => [...prev, { grupo_id: grupoId, user_id: userId }]);
        toast.success('Usuário adicionado ao grupo');
      }
    } else {
      const { error } = await supabase
        .from('grupos_usuarios')
        .delete()
        .eq('grupo_id', grupoId)
        .eq('user_id', userId);
      if (error) toast.error('Erro ao remover: ' + error.message);
      else {
        setGruposUsuarios((prev) => prev.filter((gu) => !(gu.grupo_id === grupoId && gu.user_id === userId)));
        toast.success('Usuário removido do grupo');
      }
    }
  };

  // Cadastro de Grupos - handlers
  const handleSelectGrupoCadastro = (g: Grupo) => {
    setSelectedGrupoCadastro(g);
    setDescricaoGrupo(g.nome);
  };

  const handleNovoGrupo = () => {
    setSelectedGrupoCadastro(null);
    setDescricaoGrupo('');
  };

  const handleSalvarGrupo = async () => {
    const nome = descricaoGrupo.trim();
    if (!nome) {
      toast.error('Descrição do grupo é obrigatória');
      return;
    }
    setSavingGrupo(true);
    if (selectedGrupoCadastro) {
      const { error } = await supabase.from('grupos').update({ nome }).eq('id', selectedGrupoCadastro.id);
      if (error) toast.error('Erro ao salvar: ' + error.message);
      else {
        toast.success('Grupo atualizado!');
        setSelectedGrupoCadastro({ ...selectedGrupoCadastro, nome });
        loadGruposCadastro();
      }
    } else {
      const { error } = await supabase.from('grupos').insert({ nome });
      if (error) {
        if (error.code === '23505') toast.error('Este grupo já existe');
        else toast.error('Erro ao criar: ' + error.message);
      } else {
        toast.success('Grupo criado!');
        handleNovoGrupo();
        loadGruposCadastro();
      }
    }
    setSavingGrupo(false);
  };

  const handleExcluirGrupo = async () => {
    if (!selectedGrupoCadastro) return;
    const { error } = await supabase.from('grupos').delete().eq('id', selectedGrupoCadastro.id);
    if (error) toast.error('Erro ao excluir: ' + error.message);
    else {
      toast.success('Grupo excluído!');
      handleNovoGrupo();
      loadGruposCadastro();
    }
  };

  const handleDuplicarGrupo = async () => {
    if (!selectedGrupoCadastro) return;
    const nome = selectedGrupoCadastro.nome + ' (cópia)';
    const { data, error } = await supabase.from('grupos').insert({ nome }).select('id').single();
    if (error) toast.error('Erro ao duplicar: ' + error.message);
    else if (data) {
      const { data: perms } = await supabase.from('grupos_permissoes').select('menu_id, abrir, salvar, excluir').eq('grupo_id', selectedGrupoCadastro.id);
      if (perms?.length) {
        await supabase.from('grupos_permissoes').insert(perms.map((p) => ({ grupo_id: data.id, menu_id: p.menu_id, abrir: p.abrir, salvar: p.salvar, excluir: p.excluir })));
      }
      toast.success('Grupo duplicado!');
      loadGruposCadastro();
    }
  };

  const getPermissao = (grupoId: string, menuId: string, campo: 'abrir' | 'salvar' | 'excluir') => {
    const p = gruposPermissoes.find((x) => x.grupo_id === grupoId && x.menu_id === menuId);
    return p?.[campo] ?? false;
  };

  const togglePermissao = async (grupoId: string, menuId: string, campo: 'abrir' | 'salvar' | 'excluir', valor: boolean) => {
    const existe = gruposPermissoes.find((x) => x.grupo_id === grupoId && x.menu_id === menuId);
    if (existe) {
      const { error } = await supabase.from('grupos_permissoes').update({ [campo]: valor }).eq('grupo_id', grupoId).eq('menu_id', menuId);
      if (error) {
        toast.error('Erro ao atualizar');
      } else {
        setGruposPermissoes((prev) => prev.map((p) => (p.grupo_id === grupoId && p.menu_id === menuId ? { ...p, [campo]: valor } : p)));
      }
    } else {
      const novoRegistro = {
        grupo_id: grupoId,
        menu_id: menuId,
        abrir: campo === 'abrir' ? valor : false,
        salvar: campo === 'salvar' ? valor : false,
        excluir: campo === 'excluir' ? valor : false,
      };
      const { error } = await supabase.from('grupos_permissoes').insert(novoRegistro);
      if (error) {
        toast.error('Erro ao salvar');
      } else {
        setGruposPermissoes((prev) => [...prev, novoRegistro]);
      }
    }
  };

  const menusOrdenados = menus.length > 0 && menus[0].id?.length > 10
    ? [...menus].sort((a, b) => a.ordem - b.ordem)
    : MENUS_FALLBACK.map((m, i) => ({ ...m, id: m.id, ordem: i })) as Menu[];
  const permissoesHabilitadas = menus.length > 0 && menus[0].id?.length > 10;

  return (
    <MainLayout>
      <div className="bg-white rounded-lg border border-border p-6 flex flex-col h-[calc(100vh-96px)] min-h-0 w-full overflow-hidden">
        {/* Título e abas */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <h1 className="text-xl font-bold shrink-0 text-[#262626]">Permissões de Acesso</h1>
            <div className="flex gap-2 shrink-0">
              {ABAS.map((aba) => (
                <button
                  key={aba.id}
                  type="button"
                  onClick={() => setActiveTab(aba.id)}
                  className={cn(
                    'px-4 py-2 rounded-[50px] text-[12px] font-medium transition-colors cursor-pointer',
                    activeTab === aba.id
                      ? 'bg-[#02572E] text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  )}
                >
                  {aba.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Conteúdo da aba */}
        <div className="flex-1 overflow-auto min-h-0 flex flex-col gap-6">
          {activeTab === 'usuarios' && (
            <>
              {/* Seção Criar Login */}
              <div className="flex gap-4 p-4 rounded-lg border border-border bg-muted/30">
                <Dialog open={criarLoginOpen} onOpenChange={setCriarLoginOpen}>
                  <DialogTrigger asChild>
                    <Card
                      className="w-44 shrink-0 cursor-pointer transition-colors hover:bg-muted/50 hover:border-[#02572E]/50 border-2"
                    >
                      <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                        <div className="rounded-lg bg-amber-100 p-3">
                          <Pencil className="w-10 h-10 text-amber-600" />
                        </div>
                        <span className="text-sm font-medium text-[#02572E] text-center">
                          Criar uma nova Pessoa?
                        </span>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Criar novo usuário</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>E-mail *</Label>
                          <Input
                            type="email"
                            value={novoEmail}
                            onChange={(e) => setNovoEmail(e.target.value)}
                            placeholder="email@exemplo.com"
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Nome</Label>
                          <Input
                            value={novoNome}
                            onChange={(e) => setNovoNome(e.target.value)}
                            placeholder="Nome completo"
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Senha *</Label>
                          <Input
                            type="password"
                            value={novaSenha}
                            onChange={(e) => setNovaSenha(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="bg-white"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button onClick={handleCriarLogin} disabled={criarLoginSaving} className="bg-[#02572E] text-white hover:bg-[#024a27]">
                          {criarLoginSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Criar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                  <h2 className="text-base font-semibold text-[#262626]">Criar Login de Acesso para Pessoas Existentes!</h2>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px] space-y-2">
                      <Label className="text-sm">Selecione a pessoa aqui</Label>
                      <div className="flex gap-2">
                        <Input
                          value={pessoaSearch}
                          onChange={(e) => setPessoaSearch(e.target.value)}
                          placeholder="Buscar pessoa..."
                          className="bg-white"
                        />
                        <Button variant="outline" size="icon" title="Buscar">
                          <Search className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <Button className="bg-[#02572E] text-white hover:bg-[#024a27]" onClick={() => setCriarLoginOpen(true)}>
                      Criar Login?
                    </Button>
                  </div>
                </div>
              </div>

              {/* Seção Usuários do Sistema */}
              <div className="flex-1 flex flex-col min-h-0">
                <h2 className="text-base font-semibold text-[#262626] mb-2">Usuários do Sistema</h2>
                {loadingUsuarios ? (
                  <div className="flex items-center justify-center flex-1">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : usuarios.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">Nenhum usuário cadastrado</div>
                ) : (
                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full caption-bottom text-sm">
                      <thead className="sticky top-0 bg-white z-20 shadow-sm [&_tr]:border-b">
                        <tr className="bg-white border-b">
                          <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">ID</th>
                          <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Nome</th>
                          <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">E-mail</th>
                          <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Senha</th>
                        </tr>
                      </thead>
                      <tbody className="[&_tr:last-child]:border-0">
                        {usuarios.map((p) => (
                          <tr
                            key={p.id}
                            className={cn(
                              'border-b transition-colors cursor-pointer',
                              selectedUsuario?.id === p.id ? 'bg-[#E5EEEA]' : 'hover:bg-muted/50'
                            )}
                            onClick={() => setSelectedUsuario(p)}
                          >
                            <td className="p-4 align-middle py-1.5 text-sm font-medium text-[#1A1A1A]">{p.user_id.slice(0, 8)}...</td>
                            <td className="p-4 align-middle py-1.5 text-sm font-medium text-[#1A1A1A]">{p.full_name || '-'}</td>
                            <td className="p-4 align-middle py-1.5 text-sm font-medium text-[#1A1A1A]">{p.email || '-'}</td>
                            <td className="p-4 align-middle py-1.5 text-sm font-medium text-[#1A1A1A]">ok</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Botões de ação */}
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={!selectedUsuario}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir Usuário?
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir o usuário &quot;{selectedUsuario?.full_name || selectedUsuario?.email}&quot;? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => selectedUsuario && handleExcluirUsuario(selectedUsuario)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button variant="outline" size="sm" disabled={!selectedUsuario} onClick={() => selectedUsuario && handleResetSenha(selectedUsuario)}>
                    <Key className="w-4 h-4 mr-2" />
                    Reset Senha?
                  </Button>
                  <Button variant="outline" size="sm" disabled={!selectedUsuario} onClick={() => selectedUsuario && handleEditarCadastro(selectedUsuario)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar Cadastro?
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleEditarEmpresa}>
                    <Building2 className="w-4 h-4 mr-2" />
                    Editar Empresa?
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExportar('Usuários')}>
                    <Download className="w-4 h-4 mr-2" />
                    Exportar Usuários
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExportar('Permissões')}>
                    <Shield className="w-4 h-4 mr-2" />
                    Exportar Permissões
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExportar('Log Acesso')}>
                    <FileText className="w-4 h-4 mr-2" />
                    Exportar Log Acesso
                  </Button>
                </div>
              </div>
            </>
          )}
          {activeTab === 'direitos' && (
            <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
              {/* Painel esquerdo */}
              <div className="w-72 flex-shrink-0 flex flex-col gap-3 border border-border rounded-lg p-4 bg-muted/20">
                <RadioGroup
                  value={modoDireitos}
                  onValueChange={(v) => {
                    setModoDireitos(v as 'grupos' | 'usuarios');
                    setSelectedGrupo(null);
                    setSelectedUsuario(null);
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="grupos" id="modo-grupos" />
                    <Label htmlFor="modo-grupos" className="cursor-pointer font-normal">Grupos/Funções</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="usuarios" id="modo-usuarios" />
                    <Label htmlFor="modo-usuarios" className="cursor-pointer font-normal">Usuários</Label>
                  </div>
                </RadioGroup>
                <div className="flex-1 overflow-auto min-h-0 border rounded-md bg-white">
                  {loadingDireitos ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : modoDireitos === 'grupos' ? (
                    <ul className="p-2">
                      {grupos.map((g) => (
                        <li
                          key={g.id}
                          onClick={() => {
                            setSelectedGrupo(g);
                            setSelectedUsuario(null);
                          }}
                          className={cn(
                            'px-3 py-2 rounded cursor-pointer text-sm',
                            selectedGrupo?.id === g.id ? 'bg-[#02572E] text-white' : 'hover:bg-muted'
                          )}
                        >
                          Grupo - {g.nome}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="p-2">
                      {usuarios.map((u) => (
                        <li
                          key={u.id}
                          onClick={() => {
                            setSelectedUsuario(u);
                            setSelectedGrupo(null);
                          }}
                          className={cn(
                            'px-3 py-2 rounded cursor-pointer text-sm',
                            selectedUsuario?.id === u.id ? 'bg-[#02572E] text-white' : 'hover:bg-muted'
                          )}
                        >
                          {u.full_name || u.email || '-'}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Painel direito */}
              <div className="flex-1 flex flex-col min-w-0 border border-border rounded-lg p-4 bg-muted/20">
                {loadingDireitos ? (
                  <div className="flex items-center justify-center flex-1">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : modoDireitos === 'grupos' && selectedGrupo ? (
                  <>
                    <h3 className="text-base font-semibold text-[#262626] mb-3">Grupo - {selectedGrupo.nome}</h3>
                    <div className="flex-1 overflow-auto min-h-0 border rounded-md bg-white p-3">
                      {usuarios.map((u) => (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 py-2 px-2 rounded hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={isUserInGrupo(u.user_id, selectedGrupo.id)}
                            onCheckedChange={(checked) =>
                              toggleGrupoUsuario(selectedGrupo.id, u.user_id, !!checked)
                            }
                          />
                          <span className="text-sm">
                            {u.full_name || u.email || '-'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </>
                ) : modoDireitos === 'usuarios' && selectedUsuario ? (
                  <>
                    <h3 className="text-base font-semibold text-[#262626] mb-3 bg-[#02572E] text-white px-3 py-2 rounded">
                      {selectedUsuario.full_name || selectedUsuario.email}
                    </h3>
                    <div className="flex-1 overflow-auto min-h-0 border rounded-md bg-white p-3">
                      {grupos.map((g) => (
                        <label
                          key={g.id}
                          className="flex items-center gap-2 py-2 px-2 rounded hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={isUserInGrupo(selectedUsuario.user_id, g.id)}
                            onCheckedChange={(checked) =>
                              toggleGrupoUsuario(g.id, selectedUsuario.user_id, !!checked)
                            }
                          />
                          <span className="text-sm">Grupo - {g.nome}</span>
                        </label>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
                    Selecione um grupo ou usuário na lista à esquerda
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'grupos' && (
            <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
              {/* Painel esquerdo - Grupos */}
              <div className="w-80 flex-shrink-0 flex flex-col gap-3 border border-border rounded-lg p-4 bg-muted/20">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleNovoGrupo}>
                    <Plus className="w-4 h-4 mr-1" />
                    Novo
                  </Button>
                  <Button size="sm" className="bg-[#02572E] hover:bg-[#024a27]" onClick={handleSalvarGrupo} disabled={savingGrupo}>
                    {savingGrupo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                    Salvar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExcluirGrupo} disabled={!selectedGrupoCadastro}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Excluir
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDuplicarGrupo} disabled={!selectedGrupoCadastro}>
                    <Copy className="w-4 h-4 mr-1" />
                    Duplicar Grupo
                  </Button>
                </div>
                <div className="flex-1 overflow-auto min-h-0 border rounded-md bg-white">
                  {loadingGrupos ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <table className="w-full caption-bottom text-sm">
                      <thead className="sticky top-0 bg-white border-b">
                        <tr>
                          <th className="h-9 px-3 text-left text-xs font-bold text-[#1A1A1A]">Descrição do Grupo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gruposCadastro.map((g) => (
                          <tr
                            key={g.id}
                            onClick={() => handleSelectGrupoCadastro(g)}
                            className={cn(
                              'border-b cursor-pointer',
                              selectedGrupoCadastro?.id === g.id ? 'bg-[#02572E] text-white' : 'hover:bg-muted'
                            )}
                          >
                            <td className="px-3 py-2 text-sm flex items-center gap-1">
                              {selectedGrupoCadastro?.id === g.id && <ChevronRight className="w-4 h-4 shrink-0" />}
                              {g.nome}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Descrição do Grupo</Label>
                  <Input
                    value={descricaoGrupo}
                    onChange={(e) => setDescricaoGrupo(e.target.value)}
                    placeholder="Nome do grupo"
                    className="bg-white"
                  />
                </div>
              </div>

              {/* Painel direito - Permissões */}
              <div className="flex-1 flex flex-col min-w-0 border border-border rounded-lg overflow-hidden bg-muted/20">
                {selectedGrupoCadastro ? (
                  <>
                    <div className="bg-amber-500/90 text-white px-4 py-2 font-semibold text-base shrink-0">
                      {selectedGrupoCadastro.nome}
                    </div>
                    {!permissoesHabilitadas && (
                      <div className="px-4 py-2 bg-amber-50 text-amber-800 text-sm">
                        Execute a migração supabase_migration_permissoes.sql para gerenciar permissões.
                      </div>
                    )}
                    <div className="flex-1 overflow-auto min-h-0">
                      <table className="w-full caption-bottom text-sm">
                        <thead className="sticky top-0 bg-white z-10 shadow-sm">
                          <tr className="border-b">
                            <th className="h-10 px-4 text-left text-xs font-bold text-[#1A1A1A] w-12">id</th>
                            <th className="h-10 px-4 text-left text-xs font-bold text-[#1A1A1A]">Menus</th>
                            <th className="h-10 px-4 text-center text-xs font-bold text-[#1A1A1A] w-20">Abrir</th>
                            <th className="h-10 px-4 text-center text-xs font-bold text-[#1A1A1A] w-20">Salvar</th>
                            <th className="h-10 px-4 text-center text-xs font-bold text-[#1A1A1A] w-20">Excluir</th>
                          </tr>
                        </thead>
                        <tbody>
                          {menusOrdenados.map((menu, idx) => (
                            <tr key={menu.id} className={cn('border-b', !menu.parent_id && 'bg-amber-100/50')}>
                              <td className="px-4 py-2 text-sm">{idx + 1}</td>
                              <td className="px-4 py-2 text-sm">{menu.nome}</td>
                              <td className="px-4 py-2 text-center">
                                {menu.path && permissoesHabilitadas ? (
                                  <Checkbox
                                    checked={getPermissao(selectedGrupoCadastro.id, menu.id, 'abrir')}
                                    onCheckedChange={(c) => togglePermissao(selectedGrupoCadastro.id, menu.id, 'abrir', !!c)}
                                  />
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {menu.path && permissoesHabilitadas ? (
                                  <Checkbox
                                    checked={getPermissao(selectedGrupoCadastro.id, menu.id, 'salvar')}
                                    onCheckedChange={(c) => togglePermissao(selectedGrupoCadastro.id, menu.id, 'salvar', !!c)}
                                  />
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {menu.path && permissoesHabilitadas ? (
                                  <Checkbox
                                    checked={getPermissao(selectedGrupoCadastro.id, menu.id, 'excluir')}
                                    onCheckedChange={(c) => togglePermissao(selectedGrupoCadastro.id, menu.id, 'excluir', !!c)}
                                  />
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
                    Selecione um grupo à esquerda ou clique em Novo para criar
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'igualar' && (
            <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
              {/* Painel esquerdo - Copie as permissões deste usuário */}
              <div className="flex-1 flex flex-col min-w-0 border border-border rounded-lg p-4 bg-muted/20">
                <h3 className="text-base font-semibold text-[#262626] mb-3">Copie as permissões deste usuário</h3>
                {loadingIgualar ? (
                  <div className="flex items-center justify-center flex-1">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto min-h-0 border rounded-md bg-white">
                    <ul className="p-2">
                      {usuariosIgualar.map((u) => (
                        <li
                          key={u.id}
                          onClick={() => setSelectedSourceUser(u)}
                          className={cn(
                            'px-3 py-2 rounded cursor-pointer text-sm',
                            selectedSourceUser?.id === u.id ? 'bg-[#02572E] text-white' : 'hover:bg-muted'
                          )}
                        >
                          {u.full_name || u.email || '-'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Painel direito - E aplique neste usuário */}
              <div className="flex-1 flex flex-col min-w-0 border border-border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-[#262626]">E aplique neste usuário</h3>
                  <Button
                    className="bg-[#02572E] hover:bg-[#024a27]"
                    onClick={handleCopiarPermissoes}
                    disabled={!selectedSourceUser || !selectedTargetUser || copiandoPermissoes}
                  >
                    {copiandoPermissoes ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                    Copiar Permissões?
                  </Button>
                </div>
                {loadingIgualar ? (
                  <div className="flex items-center justify-center flex-1">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto min-h-0 border rounded-md bg-white">
                    <ul className="p-2">
                      {usuariosIgualar.map((u) => (
                        <li
                          key={u.id}
                          onClick={() => setSelectedTargetUser(u)}
                          className={cn(
                            'px-3 py-2 rounded cursor-pointer text-sm',
                            selectedTargetUser?.id === u.id ? 'bg-[#02572E] text-white' : 'hover:bg-muted'
                          )}
                        >
                          {u.full_name || u.email || '-'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
