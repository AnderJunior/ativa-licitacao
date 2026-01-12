import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

interface LicitacaoInput {
  cd_pn?: string
  titulo?: string
  cnpj?: string
  valor_estimado?: number
  modalidade?: string
  modalidade_ativa?: string
  dt_publicacao?: string
  dt_encerramento_proposta?: string
  dt_importacao?: string
  dt_atualizacao?: string
  dt_criacao?: string
  uf?: string
  municipio?: string
  regiao?: string
  esfera?: string
  poder?: string
  link_processo?: string
  links?: string[]
  conteudo?: string
  complemento?: string
  orgao_pncp?: string
  unidade?: string
  un_cod?: string
  num_licitacao?: string
  num_ativa?: string
  sequencial_compra?: number
  ano_compra?: number
  id_codigo_modalidade?: number
}

interface RequestBody {
  licitacoes: LicitacaoInput[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Validate API key
    const apiKey = req.headers.get('x-api-key')
    const expectedApiKey = Deno.env.get('IMPORT_API_KEY')

    if (!apiKey || apiKey !== expectedApiKey) {
      console.error('Invalid or missing API key')
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: RequestBody = await req.json()

    if (!body.licitacoes || !Array.isArray(body.licitacoes)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body - licitacoes array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (body.licitacoes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Empty licitacoes array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${body.licitacoes.length} licitações`)

    // Initialize Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const results = {
      inserted: 0,
      updated: 0,
      errors: [] as { cd_pn?: string; error: string }[],
      ids: [] as string[]
    }

    // Process each licitação
    for (const licitacao of body.licitacoes) {
      try {
        // Check if cd_pn exists for upsert logic
        if (licitacao.cd_pn) {
          const { data: existing } = await supabase
            .from('contratacoes')
            .select('id')
            .eq('cd_pn', licitacao.cd_pn)
            .maybeSingle()

          if (existing) {
            // Update existing
            const { data, error } = await supabase
              .from('contratacoes')
              .update({
                ...licitacao,
                updated_at: new Date().toISOString()
              })
              .eq('cd_pn', licitacao.cd_pn)
              .select('id')
              .single()

            if (error) {
              console.error(`Error updating ${licitacao.cd_pn}:`, error)
              results.errors.push({ cd_pn: licitacao.cd_pn, error: error.message })
            } else {
              results.updated++
              results.ids.push(data.id)
            }
          } else {
            // Insert new
            const { data, error } = await supabase
              .from('contratacoes')
              .insert({
                ...licitacao,
                tipo_cadastro: 'pncp'
              })
              .select('id')
              .single()

            if (error) {
              console.error(`Error inserting ${licitacao.cd_pn}:`, error)
              results.errors.push({ cd_pn: licitacao.cd_pn, error: error.message })
            } else {
              results.inserted++
              results.ids.push(data.id)
            }
          }
        } else {
          // No cd_pn, just insert
          const { data, error } = await supabase
            .from('contratacoes')
            .insert({
              ...licitacao,
              tipo_cadastro: 'pncp'
            })
            .select('id')
            .single()

          if (error) {
            console.error('Error inserting licitação:', error)
            results.errors.push({ error: error.message })
          } else {
            results.inserted++
            results.ids.push(data.id)
          }
        }
      } catch (err) {
        console.error('Error processing licitação:', err)
        results.errors.push({ cd_pn: licitacao.cd_pn, error: String(err) })
      }
    }

    console.log(`Completed: ${results.inserted} inserted, ${results.updated} updated, ${results.errors.length} errors`)

    return new Response(
      JSON.stringify({
        success: results.errors.length === 0,
        inserted: results.inserted,
        updated: results.updated,
        errors: results.errors.length > 0 ? results.errors : undefined,
        ids: results.ids
      }),
      { 
        status: results.errors.length === body.licitacoes.length ? 500 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Request processing error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
