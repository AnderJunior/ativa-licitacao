-- Migração: Criar tabelas grupos e grupos_usuarios para Direitos de Usuários e Grupos
-- Execute este script no Supabase SQL Editor

-- Tabela de grupos/cargos
CREATE TABLE IF NOT EXISTS public.grupos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;

-- Tabela de vínculo usuário-grupo (N:N)
CREATE TABLE IF NOT EXISTS public.grupos_usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(grupo_id, user_id)
);

ALTER TABLE public.grupos_usuarios ENABLE ROW LEVEL SECURITY;

-- Coluna cpf opcional em profiles (para exibição)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Inserir grupos padrão
INSERT INTO public.grupos (nome) VALUES 
    ('Administrador'),
    ('COORDENADOR'),
    ('DIGITADOR')
ON CONFLICT (nome) DO NOTHING;

-- Migrar usuários admin existentes para grupo Administrador
INSERT INTO public.grupos_usuarios (grupo_id, user_id)
SELECT g.id, ur.user_id
FROM public.user_roles ur
CROSS JOIN public.grupos g
WHERE ur.role = 'admin' AND g.nome = 'Administrador'
ON CONFLICT (grupo_id, user_id) DO NOTHING;

-- Migrar usuários comuns para grupo DIGITADOR
INSERT INTO public.grupos_usuarios (grupo_id, user_id)
SELECT g.id, ur.user_id
FROM public.user_roles ur
CROSS JOIN public.grupos g
WHERE ur.role = 'user' AND g.nome = 'DIGITADOR'
ON CONFLICT (grupo_id, user_id) DO NOTHING;

-- RLS Policies
CREATE POLICY "Authenticated users can view grupos" 
ON public.grupos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert grupos" 
ON public.grupos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update grupos" 
ON public.grupos FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete grupos" 
ON public.grupos FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view grupos_usuarios" 
ON public.grupos_usuarios FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert grupos_usuarios" 
ON public.grupos_usuarios FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update grupos_usuarios" 
ON public.grupos_usuarios FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete grupos_usuarios" 
ON public.grupos_usuarios FOR DELETE TO authenticated USING (true);
