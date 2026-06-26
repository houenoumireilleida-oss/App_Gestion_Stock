
-- =========================================================
-- ROLES
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'responsable', 'vendeur');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Bootstrap: first signed-in user becomes admin
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'responsable') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendeur') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendeur') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created_assign_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_admin();

-- =========================================================
-- USER PIN for POS quick switch
-- =========================================================
CREATE TABLE public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  pin_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read profiles" ON public.user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user write own profile" ON public.user_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER tg_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.bootstrap_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_user_profile();

-- =========================================================
-- SUPPLIERS
-- =========================================================
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  address text,
  payment_terms text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "responsable write suppliers" ON public.suppliers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable'));
CREATE TRIGGER tg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- PURCHASE ORDERS
-- =========================================================
CREATE TYPE public.po_status AS ENUM ('draft','ordered','partial','received','cancelled');

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  status public.po_status NOT NULL DEFAULT 'draft',
  expected_at date,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON public.purchase_orders(status);

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  ordered_qty integer NOT NULL CHECK (ordered_qty > 0),
  received_qty integer NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0
);
CREATE INDEX idx_poi_po ON public.purchase_order_items(po_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_orders, public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read po" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "responsable write po" ON public.purchase_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable'));
CREATE POLICY "auth read poi" ON public.purchase_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "responsable write poi" ON public.purchase_order_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable'));

CREATE TRIGGER tg_po_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Receive items: increments received_qty, creates stock_in movement, updates PO status
CREATE OR REPLACE FUNCTION public.receive_po_item(_item_id uuid, _qty integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item public.purchase_order_items;
  v_po public.purchase_orders;
  v_total_ordered integer;
  v_total_received integer;
BEGIN
  IF _qty <= 0 THEN RAISE EXCEPTION 'Quantité invalide'; END IF;
  SELECT * INTO v_item FROM public.purchase_order_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ligne introuvable'; END IF;
  IF v_item.received_qty + _qty > v_item.ordered_qty THEN
    RAISE EXCEPTION 'Quantité supérieure à la commande';
  END IF;
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = v_item.po_id FOR UPDATE;

  UPDATE public.purchase_order_items SET received_qty = received_qty + _qty WHERE id = _item_id;

  INSERT INTO public.stock_movements (product_id, warehouse_id, type, quantity, reason, reference, created_by)
  VALUES (v_item.product_id, v_po.warehouse_id, 'in', _qty,
          'Réception commande ' || v_po.reference, v_po.reference, auth.uid());

  SELECT SUM(ordered_qty), SUM(received_qty) INTO v_total_ordered, v_total_received
  FROM public.purchase_order_items WHERE po_id = v_po.id;

  UPDATE public.purchase_orders SET
    status = CASE WHEN v_total_received >= v_total_ordered THEN 'received'::po_status
                  WHEN v_total_received > 0 THEN 'partial'::po_status
                  ELSE status END
  WHERE id = v_po.id;
END $$;

-- =========================================================
-- CUSTOMERS + LOYALTY
-- =========================================================
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  first_name text,
  last_name text NOT NULL,
  email text,
  phone text,
  address text,
  loyalty_points integer NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_name ON public.customers(last_name, first_name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER tg_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- CASH SESSIONS (ouverture/fermeture caisse)
-- =========================================================
CREATE TABLE public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  opened_by uuid NOT NULL REFERENCES auth.users(id),
  closed_by uuid REFERENCES auth.users(id),
  opening_float numeric NOT NULL DEFAULT 0,
  closing_counted numeric,
  expected_cash numeric,
  variance numeric,
  notes text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX idx_cash_open ON public.cash_sessions(warehouse_id) WHERE closed_at IS NULL;
GRANT SELECT, INSERT, UPDATE ON public.cash_sessions TO authenticated;
GRANT ALL ON public.cash_sessions TO service_role;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cash" ON public.cash_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write cash" ON public.cash_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================
-- SALES (POS)
-- =========================================================
CREATE TYPE public.sale_status AS ENUM ('completed','refunded','partial_refund','voided');
CREATE TYPE public.payment_method AS ENUM ('cash','card','transfer','check','voucher','other');

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  cash_session_id uuid REFERENCES public.cash_sessions(id),
  customer_id uuid REFERENCES public.customers(id),
  cashier_id uuid REFERENCES auth.users(id),
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status public.sale_status NOT NULL DEFAULT 'completed',
  refunded_sale_id uuid REFERENCES public.sales(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_date ON public.sales(created_at DESC);
CREATE INDEX idx_sales_customer ON public.sales(customer_id);
CREATE INDEX idx_sales_cashier ON public.sales(cashier_id);

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  sku text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL
);
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON public.sale_items(product_id);

CREATE TABLE public.sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  method public.payment_method NOT NULL,
  amount numeric NOT NULL,
  tendered numeric,
  change_given numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.sales, public.sale_items, public.sale_payments TO authenticated;
GRANT ALL ON public.sales, public.sale_items, public.sale_payments TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write sales" ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read sale items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write sale items" ON public.sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read sale payments" ON public.sale_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write sale payments" ON public.sale_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Atomic checkout: creates sale + items + payments, deducts stock, accrues loyalty
CREATE OR REPLACE FUNCTION public.checkout_sale(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale_id uuid := gen_random_uuid();
  v_ref text;
  v_warehouse uuid := (_payload->>'warehouse_id')::uuid;
  v_customer uuid := NULLIF(_payload->>'customer_id','')::uuid;
  v_cash_session uuid := NULLIF(_payload->>'cash_session_id','')::uuid;
  v_subtotal numeric := 0;
  v_discount numeric := COALESCE((_payload->>'discount_amount')::numeric, 0);
  v_tax numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_pay jsonb;
  v_product public.products;
  v_line_total numeric;
  v_line_tax numeric;
BEGIN
  v_ref := 'V-' || to_char(now(),'YYYYMMDD') || '-' || lpad((floor(random()*9999))::text,4,'0');

  INSERT INTO public.sales (id, reference, warehouse_id, cash_session_id, customer_id, cashier_id, status)
  VALUES (v_sale_id, v_ref, v_warehouse, v_cash_session, v_customer, auth.uid(), 'completed');

  FOR v_item IN SELECT * FROM jsonb_array_elements(_payload->'items') LOOP
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;
    v_line_total := ((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric)
                    - COALESCE((v_item->>'discount_amount')::numeric, 0);
    v_line_tax := v_line_total - (v_line_total / (1 + v_product.vat_rate/100));
    v_subtotal := v_subtotal + v_line_total;
    v_tax := v_tax + v_line_tax;

    INSERT INTO public.sale_items
      (sale_id, product_id, product_name, sku, quantity, unit_price, unit_cost, discount_amount, vat_rate, line_total)
    VALUES (v_sale_id, v_product.id, v_product.name, v_product.sku,
            (v_item->>'quantity')::integer, (v_item->>'unit_price')::numeric,
            v_product.cost, COALESCE((v_item->>'discount_amount')::numeric,0),
            v_product.vat_rate, v_line_total);

    INSERT INTO public.stock_movements (product_id, warehouse_id, type, quantity, reason, reference, created_by)
    VALUES (v_product.id, v_warehouse, 'out', (v_item->>'quantity')::integer,
            'Vente ' || v_ref, v_ref, auth.uid());
  END LOOP;

  v_total := v_subtotal - v_discount;

  UPDATE public.sales SET subtotal = v_subtotal, discount_amount = v_discount,
    tax_amount = v_tax, total = v_total WHERE id = v_sale_id;

  FOR v_pay IN SELECT * FROM jsonb_array_elements(_payload->'payments') LOOP
    INSERT INTO public.sale_payments (sale_id, method, amount, tendered, change_given)
    VALUES (v_sale_id, (v_pay->>'method')::payment_method,
            (v_pay->>'amount')::numeric,
            NULLIF(v_pay->>'tendered','')::numeric,
            COALESCE((v_pay->>'change_given')::numeric, 0));
  END LOOP;

  -- Loyalty: 1 point per euro spent
  IF v_customer IS NOT NULL THEN
    UPDATE public.customers SET loyalty_points = loyalty_points + floor(v_total)::int
    WHERE id = v_customer;
  END IF;

  RETURN v_sale_id;
END $$;

-- Refund: reverses a sale, restocks
CREATE OR REPLACE FUNCTION public.refund_sale(_sale_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_orig public.sales;
  v_new_id uuid := gen_random_uuid();
  v_ref text;
  v_item public.sale_items;
BEGIN
  SELECT * INTO v_orig FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable'; END IF;
  IF v_orig.status = 'refunded' THEN RAISE EXCEPTION 'Déjà remboursée'; END IF;

  v_ref := 'R-' || to_char(now(),'YYYYMMDD') || '-' || lpad((floor(random()*9999))::text,4,'0');

  INSERT INTO public.sales (id, reference, warehouse_id, customer_id, cashier_id,
    subtotal, discount_amount, tax_amount, total, status, refunded_sale_id, notes)
  VALUES (v_new_id, v_ref, v_orig.warehouse_id, v_orig.customer_id, auth.uid(),
    -v_orig.subtotal, -v_orig.discount_amount, -v_orig.tax_amount, -v_orig.total,
    'refunded', _sale_id, _reason);

  FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = _sale_id LOOP
    INSERT INTO public.sale_items (sale_id, product_id, product_name, sku, quantity,
      unit_price, unit_cost, discount_amount, vat_rate, line_total)
    VALUES (v_new_id, v_item.product_id, v_item.product_name, v_item.sku, -v_item.quantity,
      v_item.unit_price, v_item.unit_cost, -v_item.discount_amount, v_item.vat_rate, -v_item.line_total);

    INSERT INTO public.stock_movements (product_id, warehouse_id, type, quantity, reason, reference, created_by)
    VALUES (v_item.product_id, v_orig.warehouse_id, 'in', v_item.quantity,
            'Remboursement ' || v_ref, v_ref, auth.uid());
  END LOOP;

  UPDATE public.sales SET status = 'refunded' WHERE id = _sale_id;

  IF v_orig.customer_id IS NOT NULL THEN
    UPDATE public.customers SET loyalty_points = greatest(0, loyalty_points - floor(v_orig.total)::int)
    WHERE id = v_orig.customer_id;
  END IF;

  RETURN v_new_id;
END $$;
