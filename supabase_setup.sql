-- ============================================
-- SQL COMPLETO PARA CRIAÇÃO DAS TABELAS NO SUPABASE
-- ============================================

-- Enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Tabela de roles de usuário
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função para verificar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger para criar profile automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tipo Licitações
CREATE TABLE public.tipo_licitacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sigla TEXT UNIQUE NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tipo_licitacoes ENABLE ROW LEVEL SECURITY;

-- Grupo de Órgãos
CREATE TABLE public.grupo_de_orgaos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.grupo_de_orgaos ENABLE ROW LEVEL SECURITY;

-- Órgãos
CREATE TABLE public.orgaos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_orgao TEXT NOT NULL,
    uf TEXT,
    cidade_ibge TEXT,
    endereco TEXT,
    telefone TEXT,
    compras_net TEXT,
    compras_mg TEXT,
    emails TEXT[],
    sites TEXT[],
    observacoes TEXT,
    obs_pncp TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orgaos ENABLE ROW LEVEL SECURITY;

-- Join table para órgãos e grupos (N:N)
CREATE TABLE public.orgaos_grupos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orgao_id UUID REFERENCES public.orgaos(id) ON DELETE CASCADE NOT NULL,
    grupo_id UUID REFERENCES public.grupo_de_orgaos(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(orgao_id, grupo_id)
);

ALTER TABLE public.orgaos_grupos ENABLE ROW LEVEL SECURITY;

-- Ramos de Atividade (árvore)
CREATE TABLE public.ramos_de_atividade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    e_grupo BOOLEAN DEFAULT false,
    grupo_relacionado TEXT,
    palavras_chaves TEXT[],
    parent_id UUID REFERENCES public.ramos_de_atividade(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ramos_de_atividade ENABLE ROW LEVEL SECURITY;

-- Contratações (Licitações)
CREATE TABLE public.contratacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cd_pn TEXT UNIQUE,
    cadastrado BOOLEAN DEFAULT false,
    cadastrado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    enviada BOOLEAN DEFAULT false,
    ano_compra INTEGER,
    cnpj TEXT,
    complemento TEXT,
    conteudo TEXT,
    descricao_modalidade UUID REFERENCES public.tipo_licitacoes(id) ON DELETE SET NULL,
    dt_alterado_ativa DATE,
    dt_atualizacao DATE,
    dt_criacao DATE,
    dt_encerramento_proposta DATE,
    dt_importacao DATE,
    dt_publicacao DATE,
    dt_vigencia_ini DATE,
    dt_vinculo_ativa DATE,
    esfera TEXT,
    id_codigo_modalidade INTEGER,
    link_processo TEXT,
    links TEXT[],
    modalidade TEXT,
    modalidade_ativa TEXT,
    municipio TEXT,
    num_licitacao TEXT,
    num_ativa TEXT,
    orgao_pncp TEXT,
    poder TEXT,
    regiao TEXT,
    sequencial_compra INTEGER,
    textos_cadastro_manual TEXT,
    tipo_cadastro TEXT DEFAULT 'pncp',
    titulo TEXT,
    uf TEXT,
    un_cod TEXT,
    unidade TEXT,
    valor_estimado NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contratacoes ENABLE ROW LEVEL SECURITY;

-- Join table para contratações e ramos (marcações)
CREATE TABLE public.contratacoes_marcacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contratacao_id UUID REFERENCES public.contratacoes(id) ON DELETE CASCADE NOT NULL,
    ramo_id UUID REFERENCES public.ramos_de_atividade(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(contratacao_id, ramo_id)
);

ALTER TABLE public.contratacoes_marcacoes ENABLE ROW LEVEL SECURITY;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers de updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orgaos_updated_at
  BEFORE UPDATE ON public.orgaos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contratacoes_updated_at
  BEFORE UPDATE ON public.contratacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS POLICIES (Row Level Security)
-- ============================================

-- Profiles
CREATE POLICY "Authenticated users can view all profiles" 
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- User Roles
CREATE POLICY "Authenticated users can view roles" 
ON public.user_roles FOR SELECT TO authenticated USING (true);

-- Tipo Licitações
CREATE POLICY "Authenticated users can view tipo_licitacoes" 
ON public.tipo_licitacoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tipo_licitacoes" 
ON public.tipo_licitacoes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update tipo_licitacoes" 
ON public.tipo_licitacoes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete tipo_licitacoes" 
ON public.tipo_licitacoes FOR DELETE TO authenticated USING (true);

-- Grupo de Órgãos
CREATE POLICY "Authenticated users can view grupo_de_orgaos" 
ON public.grupo_de_orgaos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert grupo_de_orgaos" 
ON public.grupo_de_orgaos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update grupo_de_orgaos" 
ON public.grupo_de_orgaos FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete grupo_de_orgaos" 
ON public.grupo_de_orgaos FOR DELETE TO authenticated USING (true);

-- Órgãos
CREATE POLICY "Authenticated users can view orgaos" 
ON public.orgaos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert orgaos" 
ON public.orgaos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update orgaos" 
ON public.orgaos FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete orgaos" 
ON public.orgaos FOR DELETE TO authenticated USING (true);

-- Órgãos Grupos
CREATE POLICY "Authenticated users can view orgaos_grupos" 
ON public.orgaos_grupos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert orgaos_grupos" 
ON public.orgaos_grupos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete orgaos_grupos" 
ON public.orgaos_grupos FOR DELETE TO authenticated USING (true);

-- Ramos de Atividade
CREATE POLICY "Authenticated users can view ramos_de_atividade" 
ON public.ramos_de_atividade FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert ramos_de_atividade" 
ON public.ramos_de_atividade FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update ramos_de_atividade" 
ON public.ramos_de_atividade FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete ramos_de_atividade" 
ON public.ramos_de_atividade FOR DELETE TO authenticated USING (true);

-- Contratações
CREATE POLICY "Authenticated users can view contratacoes" 
ON public.contratacoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert contratacoes" 
ON public.contratacoes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update contratacoes" 
ON public.contratacoes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete contratacoes" 
ON public.contratacoes FOR DELETE TO authenticated USING (true);

-- Contratações Marcações
CREATE POLICY "Authenticated users can view contratacoes_marcacoes" 
ON public.contratacoes_marcacoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert contratacoes_marcacoes" 
ON public.contratacoes_marcacoes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contratacoes_marcacoes" 
ON public.contratacoes_marcacoes FOR DELETE TO authenticated USING (true);




