import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Trash2, Key, Pencil, Building2, Download, FileText, Shield, ShieldCheck, ShieldOff } from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  cpf?: string | null;
  created_at: string;
}

interface Menu {
  id: string;
  nome: string;
  path: string | null;
  ordem: number;
  parent_id: string | null;
}

interface UserPermissao {
  user_id: string;
  menu_id: string;
  abrir: boolean;
  salvar: boolean;
  excluir: boolean;
}

// Menus estáticos (fallback se tabela não existir)
const MENUS_FALLBACK: Menu[] = [
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
  const { signUp } = useAuth();

  // Usuários
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [selectedUsuario, setSelectedUsuario] = useState<Profile | null>(null);
  const [criarLoginOpen, setCriarLoginOpen] = useState(false);
  const [criarLoginSaving, setCriarLoginSaving] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaSenha, setNovaSenha] = useState('');

  // Menus, Permissões e Roles
  const [menus, setMenus] = useState<Menu[]>([]);
  const [userPermissoes, setUserPermissoes] = useState<UserPermissao[]>([]);
  const [adminUserIds, setAdminUserIds] = useState<string[]>([]);

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    setLoadingUsuarios(true);
    try {
      const [usersData, menusData, permData] = await Promise.all([
        api.get<(Profile & { role?: string })[]>('/api/users'),
        api.get<Menu[]>('/api/menus'),
        api.get<UserPermissao[]>('/api/permissoes'),
      ]);
      setUsuarios(usersData || []);
      if (menusData) setMenus(menusData);
      if (permData) setUserPermissoes(permData);
      setAdminUserIds(
        (usersData || []).filter((u) => u.role === 'admin').map((u) => u.user_id)
      );
    } catch (err: any) {
      toast.error('Erro ao carregar dados: ' + err.message);
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
    try {
      await api.delete('/api/auth/users/' + profile.user_id);
      toast.success('Usuário excluído com sucesso!');
      setSelectedUsuario(null);
      setUserPermissoes((prev) => prev.filter((p) => p.user_id !== profile.user_id));
      setUsuarios((prev) => prev.filter((u) => u.id !== profile.id));
    } catch (err: any) {
      toast.error('Erro ao excluir usuário: ' + err.message);
    }
  };

  const handleResetSenha = async (profile: Profile) => {
    toast.info('Funcionalidade de reset de senha em desenvolvimento');
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

  const isAdmin = (userId: string) => adminUserIds.includes(userId);

  const handleToggleAdmin = async (profile: Profile) => {
    const userId = profile.user_id;
    const newRole = isAdmin(userId) ? 'user' : 'admin';
    try {
      await api.patch('/api/users/' + profile.id + '/role', { role: newRole });
      if (newRole === 'admin') {
        setAdminUserIds((prev) => [...prev, userId]);
        toast.success('Usuário agora é Admin!');
      } else {
        setAdminUserIds((prev) => prev.filter((id) => id !== userId));
        toast.success('Admin removido com sucesso!');
      }
    } catch (err: any) {
      toast.error('Erro ao alterar role: ' + err.message);
    }
  };

  const menusOrdenados = menus.length > 0 && menus[0].id?.length > 10
    ? [...menus].sort((a, b) => a.ordem - b.ordem)
    : MENUS_FALLBACK.map((m, i) => ({ ...m, id: m.id, ordem: i })) as Menu[];
  const permissoesHabilitadas = menus.length > 0 && menus[0].id?.length > 10;

  const getUserPermissao = (userId: string, menuId: string, campo: 'abrir' | 'salvar' | 'excluir') => {
    if (isAdmin(userId)) return true;
    const p = userPermissoes.find((x) => x.user_id === userId && x.menu_id === menuId);
    return p?.[campo] ?? false;
  };

  const toggleUserPermissao = async (userId: string, menuId: string, campo: 'abrir' | 'salvar' | 'excluir', valor: boolean) => {
    try {
      await api.patch('/api/permissoes', { user_id: userId, menu_id: menuId, field: campo, value: valor });
      const existe = userPermissoes.find((x) => x.user_id === userId && x.menu_id === menuId);
      if (existe) {
        setUserPermissoes((prev) => prev.map((p) => (p.user_id === userId && p.menu_id === menuId ? { ...p, [campo]: valor } : p)));
      } else {
        const novoRegistro: UserPermissao = {
          user_id: userId,
          menu_id: menuId,
          abrir: campo === 'abrir' ? valor : false,
          salvar: campo === 'salvar' ? valor : false,
          excluir: campo === 'excluir' ? valor : false,
        };
        setUserPermissoes((prev) => [...prev, novoRegistro]);
      }
    } catch (err: any) {
      toast.error('Erro ao salvar permissão: ' + err.message);
    }
  };

  return (
    <MainLayout>
      <div className="bg-white rounded-lg border border-border p-6 flex flex-col h-[calc(100vh-96px)] min-h-0 w-full overflow-hidden">
        {/* Título + Novo Usuário */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h1 className="text-xl font-bold text-[#262626]">Permissões de Acesso</h1>
          <div className="flex items-center gap-2">
            {selectedUsuario && (
              <Button
                variant="outline"
                className={isAdmin(selectedUsuario.user_id)
                  ? 'border-amber-500 text-amber-600 hover:bg-amber-50'
                  : 'border-[#02572E] text-[#02572E] hover:bg-[#02572E]/10'
                }
                onClick={() => handleToggleAdmin(selectedUsuario)}
              >
                {isAdmin(selectedUsuario.user_id) ? (
                  <><ShieldOff className="w-4 h-4 mr-2" />Remover Admin</>
                ) : (
                  <><ShieldCheck className="w-4 h-4 mr-2" />Tornar Admin</>
                )}
              </Button>
            )}
            {selectedUsuario && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="bg-red-500 hover:bg-red-600 text-white px-4">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir o usuário &quot;{selectedUsuario.full_name || selectedUsuario.email}&quot; e todas as suas permissões? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleExcluirUsuario(selectedUsuario)} className="bg-red-600 hover:bg-red-700">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Dialog open={criarLoginOpen} onOpenChange={setCriarLoginOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#02572E] text-white hover:bg-[#024a27]">
                  Novo Usuário
                </Button>
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
          </div>
        </div>

        {/* Painel principal: Lista de Usuários + Permissões */}
        <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
          {/* Painel esquerdo - Lista de Usuários */}
          <div className="w-72 flex-shrink-0 flex flex-col overflow-auto min-h-0 border border-border rounded-lg bg-white">
            {loadingUsuarios ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <ul className="p-2">
                {usuarios.map((u) => (
                  <li
                    key={u.id}
                    onClick={() => setSelectedUsuario(u)}
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

          {/* Painel direito - Permissões do Usuário */}
          <div className="flex-1 flex flex-col min-w-0 border border-border rounded-lg overflow-hidden bg-muted/20">
            {selectedUsuario ? (
              <>
                <div className="bg-amber-500/90 text-white px-4 py-2 font-semibold text-base shrink-0">
                  {selectedUsuario.full_name || selectedUsuario.email}
                </div>
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
                                checked={getUserPermissao(selectedUsuario.user_id, menu.id, 'abrir')}
                                onCheckedChange={(c) => toggleUserPermissao(selectedUsuario.user_id, menu.id, 'abrir', !!c)}
                              />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {menu.path && permissoesHabilitadas ? (
                              <Checkbox
                                checked={getUserPermissao(selectedUsuario.user_id, menu.id, 'salvar')}
                                onCheckedChange={(c) => toggleUserPermissao(selectedUsuario.user_id, menu.id, 'salvar', !!c)}
                              />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {menu.path && permissoesHabilitadas ? (
                              <Checkbox
                                checked={getUserPermissao(selectedUsuario.user_id, menu.id, 'excluir')}
                                onCheckedChange={(c) => toggleUserPermissao(selectedUsuario.user_id, menu.id, 'excluir', !!c)}
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
                Selecione um usuário na lista à esquerda
              </div>
            )}
          </div>
        </div>

      </div>
    </MainLayout>
  );
}
