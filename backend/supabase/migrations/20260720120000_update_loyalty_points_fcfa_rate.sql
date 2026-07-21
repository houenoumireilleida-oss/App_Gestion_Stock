-- Loyalty now uses FCFA display rules: 1 point per 1000 FCFA spent.

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

  -- Loyalty: 1 point per 1000 FCFA spent.
  IF v_customer IS NOT NULL THEN
    UPDATE public.customers
    SET loyalty_points = loyalty_points + floor(greatest(v_total, 0) / 1000)::int
    WHERE id = v_customer;
  END IF;

  RETURN v_sale_id;
END $$;

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
    UPDATE public.customers
    SET loyalty_points = greatest(0, loyalty_points - floor(greatest(v_orig.total, 0) / 1000)::int)
    WHERE id = v_orig.customer_id;
  END IF;

  RETURN v_new_id;
END $$;
