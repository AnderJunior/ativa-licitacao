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