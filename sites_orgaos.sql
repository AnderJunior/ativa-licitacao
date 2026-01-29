-- ============================================
-- SQL PARA SITES E ORGÃOS
-- ============================================

-- Sites
CREATE TABLE IF NOT EXISTS public.sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dominio TEXT NOT NULL,
    site TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- Órgãos (já existe, mas mantendo para referência)
-- A coluna sites é um array de texto (TEXT[]) que armazena múltiplos sites
CREATE TABLE IF NOT EXISTS public.orgaos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_orgao TEXT NOT NULL,
    uf TEXT,
    cidade_ibge TEXT,
    endereco TEXT,
    telefone TEXT,
    compras_net TEXT,
    compras_mg TEXT,
    emails TEXT[],
    sites TEXT[],  -- Array de texto para armazenar múltiplos sites
    observacoes TEXT,
    obs_pncp TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orgaos ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES PARA SITES
-- ============================================

CREATE POLICY "Authenticated users can view sites" 
ON public.sites FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sites" 
ON public.sites FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update sites" 
ON public.sites FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete sites" 
ON public.sites FOR DELETE TO authenticated USING (true);

-- ============================================
-- RLS POLICIES PARA ORGÃOS (já existem, mas mantendo para referência)
-- ============================================

CREATE POLICY "Authenticated users can view orgaos" 
ON public.orgaos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert orgaos" 
ON public.orgaos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update orgaos" 
ON public.orgaos FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete orgaos" 
ON public.orgaos FOR DELETE TO authenticated USING (true);
