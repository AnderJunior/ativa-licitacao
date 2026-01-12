export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      contratacoes: {
        Row: {
          ano_compra: number | null
          cadastrado: boolean | null
          cadastrado_por: string | null
          cd_pn: string | null
          cnpj: string | null
          complemento: string | null
          conteudo: string | null
          created_at: string
          descricao_modalidade: string | null
          dt_alterado_ativa: string | null
          dt_atualizacao: string | null
          dt_criacao: string | null
          dt_encerramento_proposta: string | null
          dt_importacao: string | null
          dt_publicacao: string | null
          dt_vigencia_ini: string | null
          dt_vinculo_ativa: string | null
          enviada: boolean | null
          esfera: string | null
          id: string
          id_codigo_modalidade: number | null
          link_processo: string | null
          links: string[] | null
          modalidade: string | null
          modalidade_ativa: string | null
          municipio: string | null
          num_ativa: string | null
          num_licitacao: string | null
          orgao_pncp: string | null
          poder: string | null
          regiao: string | null
          sequencial_compra: number | null
          textos_cadastro_manual: string | null
          tipo_cadastro: string | null
          titulo: string | null
          uf: string | null
          un_cod: string | null
          unidade: string | null
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          ano_compra?: number | null
          cadastrado?: boolean | null
          cadastrado_por?: string | null
          cd_pn?: string | null
          cnpj?: string | null
          complemento?: string | null
          conteudo?: string | null
          created_at?: string
          descricao_modalidade?: string | null
          dt_alterado_ativa?: string | null
          dt_atualizacao?: string | null
          dt_criacao?: string | null
          dt_encerramento_proposta?: string | null
          dt_importacao?: string | null
          dt_publicacao?: string | null
          dt_vigencia_ini?: string | null
          dt_vinculo_ativa?: string | null
          enviada?: boolean | null
          esfera?: string | null
          id?: string
          id_codigo_modalidade?: number | null
          link_processo?: string | null
          links?: string[] | null
          modalidade?: string | null
          modalidade_ativa?: string | null
          municipio?: string | null
          num_ativa?: string | null
          num_licitacao?: string | null
          orgao_pncp?: string | null
          poder?: string | null
          regiao?: string | null
          sequencial_compra?: number | null
          textos_cadastro_manual?: string | null
          tipo_cadastro?: string | null
          titulo?: string | null
          uf?: string | null
          un_cod?: string | null
          unidade?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          ano_compra?: number | null
          cadastrado?: boolean | null
          cadastrado_por?: string | null
          cd_pn?: string | null
          cnpj?: string | null
          complemento?: string | null
          conteudo?: string | null
          created_at?: string
          descricao_modalidade?: string | null
          dt_alterado_ativa?: string | null
          dt_atualizacao?: string | null
          dt_criacao?: string | null
          dt_encerramento_proposta?: string | null
          dt_importacao?: string | null
          dt_publicacao?: string | null
          dt_vigencia_ini?: string | null
          dt_vinculo_ativa?: string | null
          enviada?: boolean | null
          esfera?: string | null
          id?: string
          id_codigo_modalidade?: number | null
          link_processo?: string | null
          links?: string[] | null
          modalidade?: string | null
          modalidade_ativa?: string | null
          municipio?: string | null
          num_ativa?: string | null
          num_licitacao?: string | null
          orgao_pncp?: string | null
          poder?: string | null
          regiao?: string | null
          sequencial_compra?: number | null
          textos_cadastro_manual?: string | null
          tipo_cadastro?: string | null
          titulo?: string | null
          uf?: string | null
          un_cod?: string | null
          unidade?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratacoes_descricao_modalidade_fkey"
            columns: ["descricao_modalidade"]
            isOneToOne: false
            referencedRelation: "tipo_licitacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      contratacoes_marcacoes: {
        Row: {
          contratacao_id: string
          created_at: string
          id: string
          ramo_id: string
        }
        Insert: {
          contratacao_id: string
          created_at?: string
          id?: string
          ramo_id: string
        }
        Update: {
          contratacao_id?: string
          created_at?: string
          id?: string
          ramo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratacoes_marcacoes_contratacao_id_fkey"
            columns: ["contratacao_id"]
            isOneToOne: false
            referencedRelation: "contratacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratacoes_marcacoes_ramo_id_fkey"
            columns: ["ramo_id"]
            isOneToOne: false
            referencedRelation: "ramos_de_atividade"
            referencedColumns: ["id"]
          },
        ]
      }
      grupo_de_orgaos: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      orgaos: {
        Row: {
          cidade_ibge: string | null
          compras_mg: string | null
          compras_net: string | null
          created_at: string
          emails: string[] | null
          endereco: string | null
          id: string
          nome_orgao: string
          obs_pncp: string | null
          observacoes: string | null
          sites: string[] | null
          telefone: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          cidade_ibge?: string | null
          compras_mg?: string | null
          compras_net?: string | null
          created_at?: string
          emails?: string[] | null
          endereco?: string | null
          id?: string
          nome_orgao: string
          obs_pncp?: string | null
          observacoes?: string | null
          sites?: string[] | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          cidade_ibge?: string | null
          compras_mg?: string | null
          compras_net?: string | null
          created_at?: string
          emails?: string[] | null
          endereco?: string | null
          id?: string
          nome_orgao?: string
          obs_pncp?: string | null
          observacoes?: string | null
          sites?: string[] | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      orgaos_grupos: {
        Row: {
          created_at: string
          grupo_id: string
          id: string
          orgao_id: string
        }
        Insert: {
          created_at?: string
          grupo_id: string
          id?: string
          orgao_id: string
        }
        Update: {
          created_at?: string
          grupo_id?: string
          id?: string
          orgao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orgaos_grupos_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupo_de_orgaos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orgaos_grupos_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgaos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ramos_de_atividade: {
        Row: {
          created_at: string
          e_grupo: boolean | null
          grupo_relacionado: string | null
          id: string
          nome: string
          palavras_chaves: string[] | null
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          e_grupo?: boolean | null
          grupo_relacionado?: string | null
          id?: string
          nome: string
          palavras_chaves?: string[] | null
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          e_grupo?: boolean | null
          grupo_relacionado?: string | null
          id?: string
          nome?: string
          palavras_chaves?: string[] | null
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ramos_de_atividade_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ramos_de_atividade"
            referencedColumns: ["id"]
          },
        ]
      }
      tipo_licitacoes: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          sigla: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          sigla: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          sigla?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
