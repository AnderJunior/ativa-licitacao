import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface PermissoesContextType {
  isAdmin: boolean;
  canAbrir: (path: string) => boolean;
  canSalvar: (path: string) => boolean;
  canExcluir: (path: string) => boolean;
  loading: boolean;
}

interface MenuRecord {
  id: string;
  path: string | null;
}

interface PermissaoRecord {
  menu_id: string;
  abrir: boolean;
  salvar: boolean;
  excluir: boolean;
}

const PermissoesContext = createContext<PermissoesContextType | undefined>(undefined);

export function PermissoesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [menus, setMenus] = useState<MenuRecord[]>([]);
  const [permissoes, setPermissoes] = useState<PermissaoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setMenus([]);
      setPermissoes([]);
      setLoading(false);
      setLoadedUserId(null);
      return;
    }
    // Não recarregar se já carregou para este mesmo usuário
    if (loadedUserId === user.id) return;
    loadPermissoes(user.id);
  }, [user?.id]);

  const loadPermissoes = async (userId: string) => {
    setLoading(true);
    try {
      const [rolesRes, menusRes, permRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('menus').select('id, path'),
        supabase.from('user_permissoes').select('menu_id, abrir, salvar, excluir').eq('user_id', userId),
      ]);

      const roles = rolesRes.data || [];
      setIsAdmin(roles.some((r) => r.role === 'admin'));
      setMenus(menusRes.data || []);
      setPermissoes(permRes.data || []);
    } catch {
      // fallback: sem permissões
    }
    setLoadedUserId(userId);
    setLoading(false);
  };

  const getMenuIdByPath = (path: string): string | null => {
    const menu = menus.find((m) => m.path === path);
    return menu?.id || null;
  };

  const canAbrir = (path: string): boolean => {
    if (isAdmin) return true;
    // Permissões de Acesso sempre acessível para quem já está logado (admin controla)
    if (path === '/empresa/permissoes') return false;
    const menuId = getMenuIdByPath(path);
    if (!menuId) return false;
    const perm = permissoes.find((p) => p.menu_id === menuId);
    return perm?.abrir ?? false;
  };

  const canSalvar = (path: string): boolean => {
    if (isAdmin) return true;
    const menuId = getMenuIdByPath(path);
    if (!menuId) return false;
    const perm = permissoes.find((p) => p.menu_id === menuId);
    return perm?.salvar ?? false;
  };

  const canExcluir = (path: string): boolean => {
    if (isAdmin) return true;
    const menuId = getMenuIdByPath(path);
    if (!menuId) return false;
    const perm = permissoes.find((p) => p.menu_id === menuId);
    return perm?.excluir ?? false;
  };

  return (
    <PermissoesContext.Provider value={{ isAdmin, canAbrir, canSalvar, canExcluir, loading }}>
      {children}
    </PermissoesContext.Provider>
  );
}

export function usePermissoes() {
  const context = useContext(PermissoesContext);
  if (context === undefined) {
    throw new Error('usePermissoes must be used within a PermissoesProvider');
  }
  return context;
}
