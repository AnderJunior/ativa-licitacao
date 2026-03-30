-- ============================================
-- MIGRATION: Tabela de associação unidade PNCP → Órgão Ativa
-- ============================================

CREATE TABLE IF NOT EXISTS public.orgaos_vinculados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT NOT NULL UNIQUE,
  orgao_id UUID REFERENCES public.orgaos(id) ON DELETE SET NULL,
  orgao_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orgaos_vinculados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage orgaos_vinculados"
  ON public.orgaos_vinculados FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
