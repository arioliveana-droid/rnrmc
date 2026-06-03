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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      boleto_copias: {
        Row: {
          copiado_em: string
          cpf: string
          crm: string
          debito_codigo: string
          id: string
          linha_digitavel: string
          nome: string
          valor: number
        }
        Insert: {
          copiado_em?: string
          cpf: string
          crm: string
          debito_codigo: string
          id?: string
          linha_digitavel: string
          nome: string
          valor: number
        }
        Update: {
          copiado_em?: string
          cpf?: string
          crm?: string
          debito_codigo?: string
          id?: string
          linha_digitavel?: string
          nome?: string
          valor?: number
        }
        Relationships: []
      }
      boletos_gerados: {
        Row: {
          copiado: boolean
          copiado_em: string | null
          cpf: string
          crm: string
          debito_codigo: string
          descricao: string | null
          gerado_em: string
          id: string
          ip: string | null
          linha_digitavel: string
          nome: string
          stripe_account_id: string | null
          user_agent: string | null
          valor: number
          vezes_copiado: number
        }
        Insert: {
          copiado?: boolean
          copiado_em?: string | null
          cpf: string
          crm: string
          debito_codigo: string
          descricao?: string | null
          gerado_em?: string
          id?: string
          ip?: string | null
          linha_digitavel: string
          nome: string
          stripe_account_id?: string | null
          user_agent?: string | null
          valor: number
          vezes_copiado?: number
        }
        Update: {
          copiado?: boolean
          copiado_em?: string | null
          cpf?: string
          crm?: string
          debito_codigo?: string
          descricao?: string | null
          gerado_em?: string
          id?: string
          ip?: string | null
          linha_digitavel?: string
          nome?: string
          stripe_account_id?: string | null
          user_agent?: string | null
          valor?: number
          vezes_copiado?: number
        }
        Relationships: [
          {
            foreignKeyName: "boletos_gerados_stripe_account_id_fkey"
            columns: ["stripe_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      consultas: {
        Row: {
          cpf: string
          criado_em: string
          crm: string
          encontrado: boolean
          id: string
          ip: string | null
          motivo: string | null
          nome: string | null
          user_agent: string | null
        }
        Insert: {
          cpf: string
          criado_em?: string
          crm: string
          encontrado?: boolean
          id?: string
          ip?: string | null
          motivo?: string | null
          nome?: string | null
          user_agent?: string | null
        }
        Update: {
          cpf?: string
          criado_em?: string
          crm?: string
          encontrado?: boolean
          id?: string
          ip?: string | null
          motivo?: string | null
          nome?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      debitos: {
        Row: {
          codigo: string | null
          cpf: string
          created_at: string
          crm: string
          debito_codigo: string
          descricao: string
          id: string
          nome: string
          status: string
          valor: number
        }
        Insert: {
          codigo?: string | null
          cpf: string
          created_at?: string
          crm: string
          debito_codigo: string
          descricao: string
          id?: string
          nome: string
          status?: string
          valor?: number
        }
        Update: {
          codigo?: string | null
          cpf?: string
          created_at?: string
          crm?: string
          debito_codigo?: string
          descricao?: string
          id?: string
          nome?: string
          status?: string
          valor?: number
        }
        Relationships: []
      }
      stripe_accounts: {
        Row: {
          account_id: string | null
          ativo: boolean
          bearer_token: string | null
          boletos_na_janela: number
          created_at: string
          id: string
          janela_iniciada_em: string | null
          nome: string
          original_first_name: string | null
          original_last_name: string | null
          person_id: string | null
          replacement_first_name: string | null
          replacement_last_name: string | null
          token: string
          total_boletos: number
          ultimo_uso_em: string | null
        }
        Insert: {
          account_id?: string | null
          ativo?: boolean
          bearer_token?: string | null
          boletos_na_janela?: number
          created_at?: string
          id?: string
          janela_iniciada_em?: string | null
          nome: string
          original_first_name?: string | null
          original_last_name?: string | null
          person_id?: string | null
          replacement_first_name?: string | null
          replacement_last_name?: string | null
          token: string
          total_boletos?: number
          ultimo_uso_em?: string | null
        }
        Update: {
          account_id?: string | null
          ativo?: boolean
          bearer_token?: string | null
          boletos_na_janela?: number
          created_at?: string
          id?: string
          janela_iniciada_em?: string | null
          nome?: string
          original_first_name?: string | null
          original_last_name?: string | null
          person_id?: string | null
          replacement_first_name?: string | null
          replacement_last_name?: string | null
          token?: string
          total_boletos?: number
          ultimo_uso_em?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
