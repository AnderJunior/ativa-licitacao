-- OBSOLETO: Esta migração foi substituída por supabase_migration_user_permissoes.sql
-- As tabelas grupos, grupos_usuarios e grupos_permissoes foram removidas.
-- Agora as permissões são gerenciadas diretamente por usuário na tabela user_permissoes.

-- Coluna cpf opcional em profiles (mantida)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf TEXT;
