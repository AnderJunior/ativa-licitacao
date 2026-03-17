-- Migração: Criar tabela caixas_email
-- Execute este script no Supabase SQL Editor se a tabela ainda não existir

-- Caixas de E-mail
CREATE TABLE IF NOT EXISTS public.caixas_email (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sigla TEXT UNIQUE NOT NULL,
    descricao TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.caixas_email ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view caixas_email" 
ON public.caixas_email FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert caixas_email" 
ON public.caixas_email FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update caixas_email" 
ON public.caixas_email FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete caixas_email" 
ON public.caixas_email FOR DELETE TO authenticated USING (true);
