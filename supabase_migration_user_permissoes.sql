-- ============================================
-- MIGRATION: Remover tabelas de grupos e criar user_permissoes
-- ============================================

-- 1. Remover tabelas de grupos (na ordem correta por dependências)
DROP TABLE IF EXISTS public.grupos_permissoes CASCADE;
DROP TABLE IF EXISTS public.grupos_usuarios CASCADE;
DROP TABLE IF EXISTS public.grupos CASCADE;

-- 2. Criar tabela de permissões por usuário
CREATE TABLE IF NOT EXISTS public.user_permissoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    menu_id UUID REFERENCES public.menus(id) ON DELETE CASCADE NOT NULL,
    abrir BOOLEAN NOT NULL DEFAULT false,
    salvar BOOLEAN NOT NULL DEFAULT false,
    excluir BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, menu_id)
);

ALTER TABLE public.user_permissoes ENABLE ROW LEVEL SECURITY;

-- 3. Policies RLS para user_permissoes
CREATE POLICY "Authenticated users can view user_permissoes"
    ON public.user_permissoes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert user_permissoes"
    ON public.user_permissoes FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update user_permissoes"
    ON public.user_permissoes FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete user_permissoes"
    ON public.user_permissoes FOR DELETE
    TO authenticated
    USING (true);

-- 4. Função para excluir usuário completo (auth + profiles + permissões)
CREATE OR REPLACE FUNCTION public.delete_user(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deletar permissões do usuário
  DELETE FROM public.user_permissoes WHERE user_id = _user_id;
  -- Deletar profile
  DELETE FROM public.profiles WHERE user_id = _user_id;
  -- Deletar user_roles
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  -- Deletar o auth user (cascadeia para profiles/roles se ainda existirem)
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;
