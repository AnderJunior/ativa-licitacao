import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { api } from '@/lib/api';

interface PermissoesContextType {
  isAdmin: boolean;
  canAbrir: (path: string) => boolean;
  canSalvar: (path: string) => boolean;
  canExcluir: (path: string) => boolean;
  loading: boolean;
}

interface PermissaoFromApi {
  menu_id: string;
  menu_path: string;
  menu_nome: string;
  abrir: boolean;
  salvar: boolean;
  excluir: boolean;
}

interface MeResponse {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  isAdmin: boolean;
  permissoes: PermissaoFromApi[];
}

const PermissoesContext = createContext<PermissoesContextType | undefined>(undefined);

export function PermissoesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissoes, setPermissoes] = useState<PermissaoFromApi[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setPermissoes([]);
      setLoading(false);
      setLoadedUserId(null);
      return;
    }
    // Nao recarregar se ja carregou para este mesmo usuario
    if (loadedUserId === user.id) return;
    loadPermissoes(user.id);
  }, [user?.id]);

  const loadPermissoes = async (userId: string) => {
    setLoading(true);
    try {
      const data = await api.get<MeResponse>('/api/auth/me');
      setIsAdmin(data.isAdmin);
      setPermissoes(data.permissoes || []);
    } catch {
      // fallback: sem permissoes
      setIsAdmin(false);
      setPermissoes([]);
    }
    setLoadedUserId(userId);
    setLoading(false);
  };

  const canAbrir = (path: string): boolean => {
    if (isAdmin) return true;
    // Permissoes de Acesso sempre acessivel apenas para admin
    if (path === '/empresa/permissoes') return false;
    const perm = permissoes.find((p) => p.menu_path === path);
    return perm?.abrir ?? false;
  };

  const canSalvar = (path: string): boolean => {
    if (isAdmin) return true;
    const perm = permissoes.find((p) => p.menu_path === path);
    return perm?.salvar ?? false;
  };

  const canExcluir = (path: string): boolean => {
    if (isAdmin) return true;
    const perm = permissoes.find((p) => p.menu_path === path);
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
