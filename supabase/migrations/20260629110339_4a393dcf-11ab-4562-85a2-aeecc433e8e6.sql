
-- Company settings (single row)
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Ma Société',
  address TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'France',
  siret TEXT,
  vat_number TEXT,
  email TEXT,
  phone TEXT,
  iban TEXT,
  bic TEXT,
  logo_url TEXT,
  legal_footer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read company_settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage company_settings admin" ON public.company_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable'));
CREATE TRIGGER trg_company_settings_updated BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.company_settings (name) VALUES ('Ma Société');

-- Invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('draft','issued','paid','cancelled');

-- Invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_address TEXT,
  customer_email TEXT,
  customer_vat_number TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage invoices" ON public.invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable'));
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_issue_date ON public.invoices(issue_date DESC);

-- Invoice items
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read invoice_items" ON public.invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage invoice_items" ON public.invoice_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable'));
CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- Sequence helper
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  y INT := EXTRACT(YEAR FROM now());
  n INT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(number, '^FA-' || y || '-', ''), '')::int), 0) + 1
    INTO n FROM public.invoices WHERE number LIKE 'FA-' || y || '-%';
  RETURN 'FA-' || y || '-' || lpad(n::text, 4, '0');
END $$;

-- Create invoice from a sale
CREATE OR REPLACE FUNCTION public.create_invoice_from_sale(_sale_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale public.sales;
  v_customer public.customers;
  v_invoice_id UUID := gen_random_uuid();
  v_num TEXT;
  v_item public.sale_items;
  v_line_ht NUMERIC;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = _sale_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable'; END IF;

  IF EXISTS (SELECT 1 FROM public.invoices WHERE sale_id = _sale_id AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'Facture déjà existante pour cette vente';
  END IF;

  IF v_sale.customer_id IS NOT NULL THEN
    SELECT * INTO v_customer FROM public.customers WHERE id = v_sale.customer_id;
  END IF;

  v_num := public.next_invoice_number();

  INSERT INTO public.invoices (id, number, status, sale_id, customer_id,
    customer_name, customer_address, customer_email,
    subtotal, tax_amount, discount_amount, total, created_by)
  VALUES (v_invoice_id, v_num, 'issued', _sale_id, v_sale.customer_id,
    COALESCE(NULLIF(trim(coalesce(v_customer.first_name,'') || ' ' || coalesce(v_customer.last_name,'')), ''), 'Client comptoir'),
    v_customer.address, v_customer.email,
    v_sale.subtotal - v_sale.tax_amount, v_sale.tax_amount,
    v_sale.discount_amount, v_sale.total, auth.uid());

  FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = _sale_id LOOP
    v_line_ht := v_item.line_total / (1 + v_item.vat_rate/100);
    INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, vat_rate, line_total)
    VALUES (v_invoice_id,
      v_item.product_name || ' (' || v_item.sku || ')',
      v_item.quantity,
      v_line_ht / NULLIF(v_item.quantity, 0),
      v_item.vat_rate,
      v_item.line_total);
  END LOOP;

  RETURN v_invoice_id;
END $$;
