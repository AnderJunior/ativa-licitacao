-- Migração: Criar tabelas menus e grupos_permissoes para Cadastro de Grupos e Permissões
-- Execute este script no Supabase SQL Editor

-- Tabela de menus do sistema
CREATE TABLE IF NOT EXISTS public.menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT UNIQUE NOT NULL,
    path TEXT,
    ordem INTEGER NOT NULL DEFAULT 0,
    parent_id UUID REFERENCES public.menus(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;

-- Tabela de permissões por grupo
CREATE TABLE IF NOT EXISTS public.grupos_permissoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE NOT NULL,
    menu_id UUID REFERENCES public.menus(id) ON DELETE CASCADE NOT NULL,
    abrir BOOLEAN NOT NULL DEFAULT false,
    salvar BOOLEAN NOT NULL DEFAULT false,
    excluir BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(grupo_id, menu_id)
);

ALTER TABLE public.grupos_permissoes ENABLE ROW LEVEL SECURITY;

-- Inserir menus (usar DO block para evitar duplicatas)
DO $$
DECLARE ativa_id UUID;
BEGIN
  INSERT INTO public.menus (nome, path, ordem, parent_id) VALUES ('ATIVA', NULL, 0, NULL)
  ON CONFLICT (nome) DO NOTHING;
  SELECT id INTO ativa_id FROM public.menus WHERE nome = 'ATIVA' LIMIT 1;
  
  INSERT INTO public.menus (nome, path, ordem, parent_id) VALUES
    ('Licitação - Cadastro', '/licitacoes/cadastro', 1, ativa_id),
    ('Licitação - Consulta', '/licitacoes/consulta', 2, ativa_id),
    ('Licitação - Tipos de Licitação', '/licitacoes/tipos', 3, ativa_id),
    ('Licitação - Marcação Pendente', '/licitacoes/marcacoes-pendentes', 4, ativa_id),
    ('Órgãos - Cadastro', '/orgaos/cadastro', 5, ativa_id),
    ('Órgãos - Consulta', '/orgaos/sem-ibge', 6, ativa_id),
    ('Órgãos - Agrupamentos', '/orgaos/agrupamentos', 7, ativa_id),
    ('Empresa - Sites', '/empresa/sites', 8, ativa_id),
    ('Empresa - Atividades', '/empresa/atividades', 9, ativa_id),
    ('Empresa - Caixas de E-mail', '/empresa/caixas-email', 10, ativa_id),
    ('Empresa - Permissões de Acesso', '/empresa/permissoes', 11, ativa_id)
  ON CONFLICT (nome) DO NOTHING;
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

-- RLS Policies
CREATE POLICY "Authenticated users can view menus" 
ON public.menus FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert menus" 
ON public.menus FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update menus" 
ON public.menus FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete menus" 
ON public.menus FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view grupos_permissoes" 
ON public.grupos_permissoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert grupos_permissoes" 
ON public.grupos_permissoes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update grupos_permissoes" 
ON public.grupos_permissoes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete grupos_permissoes" 
ON public.grupos_permissoes FOR DELETE TO authenticated USING (true);
