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
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_counted: number | null
          expected_cash: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_float: number
          variance: number | null
          warehouse_id: string
          z_report_number: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_counted?: number | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_float?: number
          variance?: number | null
          warehouse_id: string
          z_report_number?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_counted?: number | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_float?: number
          variance?: number | null
          warehouse_id?: string
          z_report_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          bic: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          iban: string | null
          id: string
          legal_footer: string | null
          logo_url: string | null
          name: string
          phone: string | null
          postal_code: string | null
          siret: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          bic?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          id?: string
          legal_footer?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          bic?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          id?: string
          legal_footer?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          siret?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      customer_return_items: {
        Row: {
          id: string
          product_id: string
          quantity: number
          return_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          product_id: string
          quantity: number
          return_id: string
          unit_price?: number
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          return_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "customer_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_returns: {
        Row: {
          approver_id: string | null
          created_at: string
          decided_at: string | null
          destination: Database["public"]["Enums"]["return_destination"]
          id: string
          reason: string
          refund_amount: number
          refund_type: Database["public"]["Enums"]["refund_type"]
          requested_by: string | null
          sale_id: string
          status: Database["public"]["Enums"]["return_status"]
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          destination?: Database["public"]["Enums"]["return_destination"]
          id?: string
          reason: string
          refund_amount?: number
          refund_type?: Database["public"]["Enums"]["refund_type"]
          requested_by?: string | null
          sale_id: string
          status?: Database["public"]["Enums"]["return_status"]
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          destination?: Database["public"]["Enums"]["return_destination"]
          id?: string
          reason?: string
          refund_amount?: number
          refund_type?: Database["public"]["Enums"]["refund_type"]
          requested_by?: string | null
          sale_id?: string
          status?: Database["public"]["Enums"]["return_status"]
        }
        Relationships: [
          {
            foreignKeyName: "customer_returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          code: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string
          loyalty_points: number
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name: string
          loyalty_points?: number
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string
          loyalty_points?: number
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      defective_items: {
        Row: {
          category: Database["public"]["Enums"]["defective_category"]
          created_at: string
          decided_at: string | null
          decided_by: string | null
          evidence_url: string | null
          id: string
          movement_id: string | null
          product_id: string
          quantity: number
          reason: string
          reported_by: string | null
          severity: Database["public"]["Enums"]["defective_severity"]
          status: Database["public"]["Enums"]["defective_status"]
          warehouse_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["defective_category"]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence_url?: string | null
          id?: string
          movement_id?: string | null
          product_id: string
          quantity: number
          reason: string
          reported_by?: string | null
          severity: Database["public"]["Enums"]["defective_severity"]
          status?: Database["public"]["Enums"]["defective_status"]
          warehouse_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["defective_category"]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence_url?: string | null
          id?: string
          movement_id?: string | null
          product_id?: string
          quantity?: number
          reason?: string
          reported_by?: string | null
          severity?: Database["public"]["Enums"]["defective_severity"]
          status?: Database["public"]["Enums"]["defective_status"]
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "defective_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defective_items_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      destocking_requests: {
        Row: {
          approver_id: string | null
          approver_note: string | null
          created_at: string
          decided_at: string | null
          id: string
          product_id: string
          quantity: number
          reason: string
          requested_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          warehouse_id: string
        }
        Insert: {
          approver_id?: string | null
          approver_note?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          product_id: string
          quantity: number
          reason: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          warehouse_id: string
        }
        Update: {
          approver_id?: string | null
          approver_note?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reason?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "destocking_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destocking_requests_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      disbursement_requests: {
        Row: {
          amount: number
          approver_id: string | null
          approver_note: string | null
          beneficiary: string
          category: Database["public"]["Enums"]["disbursement_category"]
          created_at: string
          decided_at: string | null
          description: string
          id: string
          justification_url: string | null
          paid_at: string | null
          payment_method: string | null
          requested_by: string | null
          status: Database["public"]["Enums"]["disbursement_status"]
        }
        Insert: {
          amount: number
          approver_id?: string | null
          approver_note?: string | null
          beneficiary: string
          category: Database["public"]["Enums"]["disbursement_category"]
          created_at?: string
          decided_at?: string | null
          description: string
          id?: string
          justification_url?: string | null
          paid_at?: string | null
          payment_method?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["disbursement_status"]
        }
        Update: {
          amount?: number
          approver_id?: string | null
          approver_note?: string | null
          beneficiary?: string
          category?: Database["public"]["Enums"]["disbursement_category"]
          created_at?: string
          decided_at?: string | null
          description?: string
          id?: string
          justification_url?: string | null
          paid_at?: string | null
          payment_method?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["disbursement_status"]
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          quantity: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total?: number
          quantity?: number
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          quantity?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_vat_number: string | null
          discount_amount: number
          due_date: string | null
          id: string
          issue_date: string
          notes: string | null
          number: string
          paid_amount: number
          sale_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_vat_number?: string | null
          discount_amount?: number
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          paid_amount?: number
          sale_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_vat_number?: string | null
          discount_amount?: number
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          paid_amount?: number
          sale_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          category: string | null
          cost: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          low_stock_threshold: number
          name: string
          price: number
          sku: string
          unit: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          low_stock_threshold?: number
          name: string
          price?: number
          sku: string
          unit?: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          barcode?: string | null
          category?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          low_stock_threshold?: number
          name?: string
          price?: number
          sku?: string
          unit?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          id: string
          ordered_qty: number
          po_id: string
          product_id: string
          received_qty: number
          unit_cost: number
        }
        Insert: {
          id?: string
          ordered_qty: number
          po_id: string
          product_id: string
          received_qty?: number
          unit_cost?: number
        }
        Update: {
          id?: string
          ordered_qty?: number
          po_id?: string
          product_id?: string
          received_qty?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_at: string | null
          id: string
          notes: string | null
          reference: string
          status: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          id?: string
          notes?: string | null
          reference: string
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          id?: string
          notes?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          discount_amount: number
          id: string
          line_total: number
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          sku: string
          unit_cost: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          discount_amount?: number
          id?: string
          line_total: number
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          sku: string
          unit_cost?: number
          unit_price: number
          vat_rate?: number
        }
        Update: {
          discount_amount?: number
          id?: string
          line_total?: number
          product_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          sku?: string
          unit_cost?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          change_given: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          sale_id: string
          tendered: number | null
        }
        Insert: {
          amount: number
          change_given?: number
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          sale_id: string
          tendered?: number | null
        }
        Update: {
          amount?: number
          change_given?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          sale_id?: string
          tendered?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cash_session_id: string | null
          cashier_id: string | null
          created_at: string
          customer_id: string | null
          discount_amount: number
          id: string
          notes: string | null
          reference: string
          refunded_sale_id: string | null
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          tax_amount: number
          total: number
          warehouse_id: string
        }
        Insert: {
          cash_session_id?: string | null
          cashier_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          reference: string
          refunded_sale_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          warehouse_id: string
        }
        Update: {
          cash_session_id?: string | null
          cashier_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          reference?: string
          refunded_sale_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_refunded_sale_id_fkey"
            columns: ["refunded_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      stock_levels: {
        Row: {
          id: string
          product_id: string
          quantity: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          destination_warehouse_id: string | null
          id: string
          product_id: string
          quantity: number
          reason: string | null
          reference: string | null
          type: Database["public"]["Enums"]["movement_type"]
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destination_warehouse_id?: string | null
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
          reference?: string | null
          type: Database["public"]["Enums"]["movement_type"]
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destination_warehouse_id?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          reference?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_destination_warehouse_id_fkey"
            columns: ["destination_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          code: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string
          pin_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          pin_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          pin_hash?: string | null
          updated_at?: string
          user_id?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      warehouses: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          site_id: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          site_id?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      checkout_sale: { Args: { _payload: Json }; Returns: string }
      close_cash_session: {
        Args: { _counted: number; _id: string; _notes: string }
        Returns: string
      }
      create_invoice_from_sale: { Args: { _sale_id: string }; Returns: string }
      decide_customer_return: {
        Args: { _approve: boolean; _id: string }
        Returns: undefined
      }
      decide_defective: {
        Args: { _approve: boolean; _id: string }
        Returns: undefined
      }
      decide_destocking: {
        Args: { _approve: boolean; _id: string; _note: string }
        Returns: undefined
      }
      decide_disbursement: {
        Args: { _approve: boolean; _id: string; _note: string }
        Returns: undefined
      }
      declare_defective: {
        Args: {
          _category: Database["public"]["Enums"]["defective_category"]
          _evidence_url: string
          _product_id: string
          _quantity: number
          _reason: string
          _severity: Database["public"]["Enums"]["defective_severity"]
          _warehouse_id: string
        }
        Returns: string
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_disbursement_paid: {
        Args: { _id: string; _method: string }
        Returns: undefined
      }
      next_invoice_number: { Args: never; Returns: string }
      notify_admins: {
        Args: { _body: string; _link: string; _title: string; _type: string }
        Returns: undefined
      }
      notify_user: {
        Args: {
          _body: string
          _link: string
          _title: string
          _type: string
          _user: string
        }
        Returns: undefined
      }
      receive_po_item: {
        Args: { _item_id: string; _qty: number }
        Returns: undefined
      }
      refund_sale: {
        Args: { _reason: string; _sale_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "responsable" | "vendeur"
      defective_category:
        | "casse"
        | "vol"
        | "peremption"
        | "defaut_fournisseur"
        | "autre"
      defective_severity: "mineur" | "majeur" | "critique"
      defective_status:
        | "applied"
        | "pending_confirmation"
        | "confirmed"
        | "rejected"
      disbursement_category:
        | "achat"
        | "salaire"
        | "loyer"
        | "charges"
        | "maintenance"
        | "autre"
      disbursement_status: "pending" | "approved" | "rejected" | "paid"
      invoice_status: "draft" | "issued" | "paid" | "cancelled"
      movement_type: "in" | "out" | "adjustment" | "transfer"
      payment_method:
        | "cash"
        | "card"
        | "transfer"
        | "check"
        | "voucher"
        | "other"
      po_status: "draft" | "ordered" | "partial" | "received" | "cancelled"
      refund_type: "cash" | "store_credit" | "none"
      request_status: "pending" | "approved" | "rejected" | "executed"
      return_destination: "stock" | "defective"
      return_status: "pending" | "approved" | "rejected"
      sale_status: "completed" | "refunded" | "partial_refund" | "voided"
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
      app_role: ["admin", "responsable", "vendeur"],
      defective_category: [
        "casse",
        "vol",
        "peremption",
        "defaut_fournisseur",
        "autre",
      ],
      defective_severity: ["mineur", "majeur", "critique"],
      defective_status: [
        "applied",
        "pending_confirmation",
        "confirmed",
        "rejected",
      ],
      disbursement_category: [
        "achat",
        "salaire",
        "loyer",
        "charges",
        "maintenance",
        "autre",
      ],
      disbursement_status: ["pending", "approved", "rejected", "paid"],
      invoice_status: ["draft", "issued", "paid", "cancelled"],
      movement_type: ["in", "out", "adjustment", "transfer"],
      payment_method: ["cash", "card", "transfer", "check", "voucher", "other"],
      po_status: ["draft", "ordered", "partial", "received", "cancelled"],
      refund_type: ["cash", "store_credit", "none"],
      request_status: ["pending", "approved", "rejected", "executed"],
      return_destination: ["stock", "defective"],
      return_status: ["pending", "approved", "rejected"],
      sale_status: ["completed", "refunded", "partial_refund", "voided"],
    },
  },
} as const
