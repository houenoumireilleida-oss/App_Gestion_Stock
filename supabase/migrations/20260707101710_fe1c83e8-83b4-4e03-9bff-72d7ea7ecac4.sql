
-- 1. Audit log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read admin" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit insert self" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_audit(_action text, _entity text, _entity_id uuid, _details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_log(actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), _action, _entity, _entity_id, _details);
$$;

-- 2. Défectueux : traitement post-confirmation
DO $$ BEGIN
  CREATE TYPE public.defective_treatment AS ENUM ('reparation','rebut','retour_fournisseur');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.defective_items
  ADD COLUMN IF NOT EXISTS treatment public.defective_treatment,
  ADD COLUMN IF NOT EXISTS treated_at timestamptz,
  ADD COLUMN IF NOT EXISTS treated_by uuid;

CREATE OR REPLACE FUNCTION public.set_defective_treatment(_id uuid, _treatment public.defective_treatment)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.defective_items;
BEGIN
  SELECT * INTO v_row FROM public.defective_items WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Introuvable'; END IF;
  IF v_row.status NOT IN ('applied','confirmed') THEN
    RAISE EXCEPTION 'Le défectueux doit être appliqué ou confirmé';
  END IF;
  UPDATE public.defective_items SET treatment=_treatment, treated_at=now(), treated_by=auth.uid() WHERE id=_id;
  PERFORM public.log_audit('defective_treatment', 'defective_items', _id, jsonb_build_object('treatment', _treatment));
END $$;

-- 3. Retours fournisseurs
CREATE TABLE public.supplier_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  defective_id uuid REFERENCES public.defective_items(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.supplier_returns TO authenticated;
GRANT ALL ON public.supplier_returns TO service_role;
ALTER TABLE public.supplier_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr read" ON public.supplier_returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "sr write" ON public.supplier_returns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sr update admin" ON public.supplier_returns FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.create_supplier_return(_supplier_id uuid, _product_id uuid, _quantity int, _defective_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := gen_random_uuid(); v_ref text;
BEGIN
  v_ref := 'RF-'||to_char(now(),'YYYYMMDD')||'-'||lpad((floor(random()*9999))::int::text,4,'0');
  INSERT INTO public.supplier_returns(id, reference, supplier_id, product_id, quantity, defective_id, reason, created_by)
  VALUES (v_id, v_ref, _supplier_id, _product_id, _quantity, _defective_id, _reason, auth.uid());
  PERFORM public.log_audit('supplier_return_create','supplier_returns',v_id, jsonb_build_object('ref',v_ref,'qty',_quantity));
  RETURN v_id;
END $$;

-- 4. Approbation partielle
ALTER TABLE public.destocking_requests ADD COLUMN IF NOT EXISTS approved_quantity int;
ALTER TABLE public.disbursement_requests ADD COLUMN IF NOT EXISTS approved_amount numeric;

CREATE OR REPLACE FUNCTION public.decide_destocking(_id uuid, _approve boolean, _note text, _partial_qty int DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.destocking_requests; v_qty int; v_pname text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès réservé aux administrateurs'; END IF;
  SELECT * INTO v_row FROM public.destocking_requests WHERE id=_id FOR UPDATE;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'Déjà décidée'; END IF;
  IF _approve THEN
    v_qty := COALESCE(_partial_qty, v_row.quantity);
    IF v_qty <= 0 OR v_qty > v_row.quantity THEN RAISE EXCEPTION 'Quantité invalide'; END IF;
    INSERT INTO public.stock_movements(product_id, warehouse_id, type, quantity, reason, reference, created_by)
    VALUES (v_row.product_id, v_row.warehouse_id, 'out', v_qty, 'Déstockage: '||v_row.reason, 'DST-'||substring(_id::text,1,8), auth.uid());
    UPDATE public.destocking_requests SET status='executed', approver_id=auth.uid(), approver_note=_note, decided_at=now(), approved_quantity=v_qty WHERE id=_id;
  ELSE
    UPDATE public.destocking_requests SET status='rejected', approver_id=auth.uid(), approver_note=_note, decided_at=now() WHERE id=_id;
  END IF;
  SELECT name INTO v_pname FROM public.products WHERE id=v_row.product_id;
  PERFORM public.notify_user(v_row.requested_by,'destocking_decided',
    CASE WHEN _approve THEN 'Déstockage approuvé' ELSE 'Déstockage rejeté' END,
    COALESCE(v_pname,'?')||' × '||COALESCE(_partial_qty,v_row.quantity),'/destocking');
  PERFORM public.log_audit('destocking_decide','destocking_requests',_id,
    jsonb_build_object('approve',_approve,'partial_qty',_partial_qty,'note',_note));
END $$;

CREATE OR REPLACE FUNCTION public.decide_disbursement(_id uuid, _approve boolean, _note text, _partial_amount numeric DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.disbursement_requests; v_amt numeric;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès réservé aux administrateurs'; END IF;
  SELECT * INTO v_row FROM public.disbursement_requests WHERE id=_id FOR UPDATE;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'Déjà décidée'; END IF;
  v_amt := COALESCE(_partial_amount, v_row.amount);
  IF _approve AND (v_amt <= 0 OR v_amt > v_row.amount) THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  UPDATE public.disbursement_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    approver_id=auth.uid(), approver_note=_note, decided_at=now(),
    approved_amount=CASE WHEN _approve THEN v_amt ELSE NULL END
  WHERE id=_id;
  PERFORM public.notify_user(v_row.requested_by,'disbursement_decided',
    CASE WHEN _approve THEN 'Décaissement approuvé' ELSE 'Décaissement rejeté' END,
    v_row.beneficiary||' — '||v_amt||' €','/disbursement');
  PERFORM public.log_audit('disbursement_decide','disbursement_requests',_id,
    jsonb_build_object('approve',_approve,'partial_amount',_partial_amount,'note',_note));
END $$;

-- 5. Seuil remise POS
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS discount_approval_threshold_pct numeric NOT NULL DEFAULT 15;

-- 6. Alerte écart caisse (surcharge close_cash_session)
CREATE OR REPLACE FUNCTION public.close_cash_session(_id uuid, _counted numeric, _notes text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sess public.cash_sessions; v_cash NUMERIC; v_expected NUMERIC; v_z TEXT; v_var NUMERIC;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable')) THEN
    RAISE EXCEPTION 'Accès réservé';
  END IF;
  SELECT * INTO v_sess FROM public.cash_sessions WHERE id=_id FOR UPDATE;
  IF v_sess.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Déjà clôturée'; END IF;
  SELECT COALESCE(SUM(sp.amount - COALESCE(sp.change_given,0)),0) INTO v_cash
  FROM public.sale_payments sp JOIN public.sales s ON s.id = sp.sale_id
  WHERE s.cash_session_id = _id AND sp.method = 'cash';
  v_expected := v_sess.opening_float + v_cash;
  v_z := 'Z-'||to_char(now(),'YYYYMMDD')||'-'||lpad((floor(random()*9999))::int::text,4,'0');
  v_var := _counted - v_expected;
  UPDATE public.cash_sessions SET closed_at=now(), closed_by=auth.uid(),
    expected_cash=v_expected, closing_counted=_counted, variance=v_var,
    notes=COALESCE(notes,'')||CASE WHEN _notes IS NULL THEN '' ELSE E'\n'||_notes END,
    z_report_number=v_z
  WHERE id=_id;
  IF v_var <> 0 THEN
    PERFORM public.notify_admins('cash_variance','Écart de caisse à la clôture',
      'Écart de '||v_var||' € ('||v_z||')','/cash-sessions');
  END IF;
  PERFORM public.log_audit('cash_close','cash_sessions',_id, jsonb_build_object('variance',v_var,'z',v_z));
  RETURN v_z;
END $$;

-- 7. Génération auto BC de réappro
CREATE OR REPLACE FUNCTION public.generate_reorder_po(_supplier_id uuid, _warehouse_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_po uuid := gen_random_uuid(); v_ref text; v_cnt int := 0; r RECORD;
BEGIN
  v_ref := 'PO-'||to_char(now(),'YYYYMMDD')||'-'||lpad((floor(random()*9999))::int::text,4,'0');
  INSERT INTO public.purchase_orders(id, reference, supplier_id, warehouse_id, status, notes)
  VALUES (v_po, v_ref, _supplier_id, _warehouse_id, 'draft', 'Réappro auto (stock bas)');
  FOR r IN
    SELECT p.id AS product_id, p.cost, GREATEST(p.low_stock_threshold*2 - COALESCE(sl.quantity,0), p.low_stock_threshold) AS qty
    FROM public.products p
    LEFT JOIN public.stock_levels sl ON sl.product_id=p.id AND sl.warehouse_id=_warehouse_id
    WHERE COALESCE(sl.quantity,0) < p.low_stock_threshold
  LOOP
    INSERT INTO public.purchase_order_items(po_id, product_id, ordered_qty, unit_cost)
    VALUES (v_po, r.product_id, r.qty, COALESCE(r.cost,0));
    v_cnt := v_cnt + 1;
  END LOOP;
  IF v_cnt = 0 THEN
    DELETE FROM public.purchase_orders WHERE id = v_po;
    RAISE EXCEPTION 'Aucun produit sous seuil';
  END IF;
  PERFORM public.log_audit('po_reorder_generate','purchase_orders',v_po,jsonb_build_object('ref',v_ref,'lines',v_cnt));
  RETURN v_po;
END $$;
