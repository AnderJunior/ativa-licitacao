# 🚀 Guia para Iniciar o Sistema

## Pré-requisitos

1. **Node.js** instalado (versão 18 ou superior)
2. **Supabase** configurado com as tabelas criadas
3. **Credenciais do Supabase** disponíveis

## Passo a Passo

### 1. Configurar Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com o seguinte conteúdo:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica-aqui
```

**Onde encontrar essas credenciais:**
- Acesse: https://app.supabase.com
- Vá em: Settings > API
- Copie o **Project URL** → `VITE_SUPABASE_URL`
- Copie a **anon/public key** → `VITE_SUPABASE_PUBLISHABLE_KEY`

### 2. Instalar Dependências (se necessário)

Se ainda não instalou as dependências, execute:

```bash
npm install
```

ou se estiver usando Bun:

```bash
bun install
```

### 3. Iniciar o Servidor de Desenvolvimento

Execute o comando:

```bash
npm run dev
```

ou se estiver usando Bun:

```bash
bun run dev
```

### 4. Acessar a Aplicação

Após iniciar, o sistema estará disponível em:
- **URL local**: http://localhost:5173 (ou a porta indicada no terminal)

## Comandos Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Cria build de produção
- `npm run preview` - Visualiza o build de produção
- `npm run lint` - Executa o linter

## Verificação de Problemas

### Erro: "Missing environment variables"
- Verifique se o arquivo `.env.local` existe na raiz do projeto
- Confirme que as variáveis começam com `VITE_`
- Reinicie o servidor após criar/editar o `.env.local`

### Erro de conexão com Supabase
- Verifique se as credenciais no `.env.local` estão corretas
- Confirme que as tabelas foram criadas no Supabase (execute o `supabase_setup.sql`)

### Porta já em uso
- O Vite tentará usar outra porta automaticamente
- Ou pare o processo que está usando a porta 5173

## Próximos Passos

1. ✅ Criar as tabelas no Supabase (usando `supabase_setup.sql`)
2. ✅ Configurar o `.env.local`
3. ✅ Instalar dependências
4. ✅ Iniciar o servidor
5. 🎉 Acessar e usar o sistema!






