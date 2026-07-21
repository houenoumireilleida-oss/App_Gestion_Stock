
-- ===== SITES =====
CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read sites" ON public.sites FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin write sites" ON public.sites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL;

-- ===== CASH SESSION Z =====
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS z_report_number TEXT UNIQUE;

-- ===== NOTIFICATIONS =====
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notif read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notif update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notif delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
-- INSERT only through SECURITY DEFINER functions

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE OR REPLACE FUNCTION public.notify_admins(_type TEXT, _title TEXT, _body TEXT, _link TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT ur.user_id, _type, _title, _body, _link
  FROM public.user_roles ur WHERE ur.role = 'admin';
END $$;

CREATE OR REPLACE FUNCTION public.notify_user(_user UUID, _type TEXT, _title TEXT, _body TEXT, _link TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (_user, _type, _title, _body, _link);
  END IF;
END $$;

-- ===== DEFECTIVE =====
CREATE TYPE public.defective_severity AS ENUM ('mineur','majeur','critique');
CREATE TYPE public.defective_category AS ENUM ('casse','vol','peremption','defaut_fournisseur','autre');
CREATE TYPE public.defective_status AS ENUM ('applied','pending_confirmation','confirmed','rejected');

CREATE TABLE public.defective_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  severity public.defective_severity NOT NULL,
  category public.defective_category NOT NULL,
  reason TEXT NOT NULL,
  evidence_url TEXT,
  status public.defective_status NOT NULL DEFAULT 'applied',
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  movement_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.defective_items TO authenticated;
GRANT ALL ON public.defective_items TO service_role;
ALTER TABLE public.defective_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read defective" ON public.defective_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert defective" ON public.defective_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "admin update defective" ON public.defective_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.declare_defective(
  _product_id UUID, _warehouse_id UUID, _quantity INT,
  _severity public.defective_severity, _category public.defective_category,
  _reason TEXT, _evidence_url TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_status public.defective_status;
  v_mv UUID;
  v_pname TEXT;
BEGIN
  IF _severity = 'critique' THEN v_status := 'pending_confirmation'; ELSE v_status := 'applied'; END IF;

  INSERT INTO public.defective_items (id, product_id, warehouse_id, quantity, severity, category, reason, evidence_url, status, reported_by)
  VALUES (v_id, _product_id, _warehouse_id, _quantity, _severity, _category, _reason, _evidence_url, v_status, auth.uid());

  IF v_status = 'applied' THEN
    INSERT INTO public.stock_movements (product_id, warehouse_id, type, quantity, reason, reference, created_by)
    VALUES (_product_id, _warehouse_id, 'out', _quantity, 'Défectueux: '||_reason, 'DEF-'||substring(v_id::text,1,8), auth.uid())
    RETURNING id INTO v_mv;
    UPDATE public.defective_items SET movement_id = v_mv WHERE id = v_id;
  END IF;

  SELECT name INTO v_pname FROM public.products WHERE id = _product_id;
  PERFORM public.notify_admins('defective',
    'Nouveau défectueux ('||_severity||')',
    COALESCE(v_pname,'?')||' × '||_quantity, '/defective');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.decide_defective(_id UUID, _approve BOOLEAN)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.defective_items; v_mv UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès réservé aux administrateurs'; END IF;
  SELECT * INTO v_row FROM public.defective_items WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Introuvable'; END IF;

  IF _approve THEN
    IF v_row.status = 'pending_confirmation' THEN
      INSERT INTO public.stock_movements (product_id, warehouse_id, type, quantity, reason, reference, created_by)
      VALUES (v_row.product_id, v_row.warehouse_id, 'out', v_row.quantity, 'Défectueux confirmé: '||v_row.reason, 'DEF-'||substring(_id::text,1,8), auth.uid())
      RETURNING id INTO v_mv;
      UPDATE public.defective_items SET status='confirmed', decided_by=auth.uid(), decided_at=now(), movement_id=v_mv WHERE id=_id;
    ELSE
      UPDATE public.defective_items SET status='confirmed', decided_by=auth.uid(), decided_at=now() WHERE id=_id;
    END IF;
  ELSE
    -- reject: si mouvement déjà appliqué, réintégrer
    IF v_row.movement_id IS NOT NULL THEN
      INSERT INTO public.stock_movements (product_id, warehouse_id, type, quantity, reason, reference, created_by)
      VALUES (v_row.product_id, v_row.warehouse_id, 'in', v_row.quantity, 'Annulation défectueux', 'DEF-'||substring(_id::text,1,8), auth.uid());
    END IF;
    UPDATE public.defective_items SET status='rejected', decided_by=auth.uid(), decided_at=now() WHERE id=_id;
  END IF;
  PERFORM public.notify_user(v_row.reported_by,'defective_decided',
    CASE WHEN _approve THEN 'Défectueux confirmé' ELSE 'Défectueux rejeté' END,
    v_row.reason, '/defective');
END $$;

-- ===== DESTOCKING =====
CREATE TYPE public.request_status AS ENUM ('pending','approved','rejected','executed');

CREATE TABLE public.destocking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL,
  status public.request_status NOT NULL DEFAULT 'pending',
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approver_note TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destocking_requests TO authenticated;
GRANT ALL ON public.destocking_requests TO service_role;
ALTER TABLE public.destocking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read destock" ON public.destocking_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert destock" ON public.destocking_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "admin update destock" ON public.destocking_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.decide_destocking(_id UUID, _approve BOOLEAN, _note TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.destocking_requests; v_pname TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès réservé aux administrateurs'; END IF;
  SELECT * INTO v_row FROM public.destocking_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Introuvable'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'Déjà décidée'; END IF;

  IF _approve THEN
    INSERT INTO public.stock_movements (product_id, warehouse_id, type, quantity, reason, reference, created_by)
    VALUES (v_row.product_id, v_row.warehouse_id, 'out', v_row.quantity, 'Déstockage: '||v_row.reason, 'DST-'||substring(_id::text,1,8), auth.uid());
    UPDATE public.destocking_requests SET status='executed', approver_id=auth.uid(), approver_note=_note, decided_at=now() WHERE id=_id;
  ELSE
    UPDATE public.destocking_requests SET status='rejected', approver_id=auth.uid(), approver_note=_note, decided_at=now() WHERE id=_id;
  END IF;

  SELECT name INTO v_pname FROM public.products WHERE id=v_row.product_id;
  PERFORM public.notify_user(v_row.requested_by,'destocking_decided',
    CASE WHEN _approve THEN 'Déstockage approuvé' ELSE 'Déstockage rejeté' END,
    COALESCE(v_pname,'?')||' × '||v_row.quantity, '/destocking');
END $$;

CREATE OR REPLACE FUNCTION public.notify_new_destocking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_pname TEXT;
BEGIN
  SELECT name INTO v_pname FROM public.products WHERE id=NEW.product_id;
  PERFORM public.notify_admins('destocking_new','Nouvelle demande de déstockage',
    COALESCE(v_pname,'?')||' × '||NEW.quantity,'/destocking');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_destocking AFTER INSERT ON public.destocking_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_destocking();

-- ===== DISBURSEMENT =====
CREATE TYPE public.disbursement_status AS ENUM ('pending','approved','rejected','paid');
CREATE TYPE public.disbursement_category AS ENUM ('achat','salaire','loyer','charges','maintenance','autre');

CREATE TABLE public.disbursement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category public.disbursement_category NOT NULL,
  beneficiary TEXT NOT NULL,
  description TEXT NOT NULL,
  justification_url TEXT,
  status public.disbursement_status NOT NULL DEFAULT 'pending',
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approver_note TEXT,
  decided_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disbursement_requests TO authenticated;
GRANT ALL ON public.disbursement_requests TO service_role;
ALTER TABLE public.disbursement_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read disb" ON public.disbursement_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert disb" ON public.disbursement_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "admin update disb" ON public.disbursement_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.decide_disbursement(_id UUID, _approve BOOLEAN, _note TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.disbursement_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès réservé aux administrateurs'; END IF;
  SELECT * INTO v_row FROM public.disbursement_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Introuvable'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'Déjà décidée'; END IF;
  UPDATE public.disbursement_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    approver_id=auth.uid(), approver_note=_note, decided_at=now() WHERE id=_id;
  PERFORM public.notify_user(v_row.requested_by,'disbursement_decided',
    CASE WHEN _approve THEN 'Décaissement approuvé' ELSE 'Décaissement rejeté' END,
    v_row.beneficiary||' — '||v_row.amount||' €','/disbursement');
END $$;

CREATE OR REPLACE FUNCTION public.mark_disbursement_paid(_id UUID, _method TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_row public.disbursement_requests;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès réservé aux administrateurs'; END IF;
  SELECT * INTO v_row FROM public.disbursement_requests WHERE id=_id FOR UPDATE;
  IF v_row.status <> 'approved' THEN RAISE EXCEPTION 'Doit être approuvée'; END IF;
  UPDATE public.disbursement_requests SET status='paid', paid_at=now(), payment_method=_method WHERE id=_id;
  PERFORM public.notify_user(v_row.requested_by,'disbursement_paid','Décaissement exécuté',
    v_row.beneficiary||' — '||v_row.amount||' €','/disbursement');
END $$;

CREATE OR REPLACE FUNCTION public.notify_new_disbursement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.notify_admins('disbursement_new','Nouvelle demande de décaissement',
    NEW.beneficiary||' — '||NEW.amount||' €','/disbursement');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_disbursement AFTER INSERT ON public.disbursement_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_disbursement();

-- ===== CUSTOMER RETURNS =====
CREATE TYPE public.return_destination AS ENUM ('stock','defective');
CREATE TYPE public.refund_type AS ENUM ('cash','store_credit','none');
CREATE TYPE public.return_status AS ENUM ('pending','approved','rejected');

CREATE TABLE public.customer_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  destination public.return_destination NOT NULL DEFAULT 'stock',
  refund_type public.refund_type NOT NULL DEFAULT 'cash',
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.return_status NOT NULL DEFAULT 'pending',
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.customer_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.customer_returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_returns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_return_items TO authenticated;
GRANT ALL ON public.customer_returns TO service_role;
GRANT ALL ON public.customer_return_items TO service_role;
ALTER TABLE public.customer_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cret" ON public.customer_returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert cret" ON public.customer_returns FOR INSERT TO authenticated WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "admin update cret" ON public.customer_returns FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "auth read creti" ON public.customer_return_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write creti" ON public.customer_return_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_returns cr WHERE cr.id=return_id AND (cr.requested_by=auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customer_returns cr WHERE cr.id=return_id AND (cr.requested_by=auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE OR REPLACE FUNCTION public.decide_customer_return(_id UUID, _approve BOOLEAN)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ret public.customer_returns; v_item RECORD; v_wh UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès réservé aux administrateurs'; END IF;
  SELECT * INTO v_ret FROM public.customer_returns WHERE id=_id FOR UPDATE;
  IF v_ret.status <> 'pending' THEN RAISE EXCEPTION 'Déjà décidée'; END IF;

  IF _approve THEN
    SELECT warehouse_id INTO v_wh FROM public.sales WHERE id = v_ret.sale_id;
    FOR v_item IN SELECT * FROM public.customer_return_items WHERE return_id=_id LOOP
      IF v_ret.destination = 'stock' THEN
        INSERT INTO public.stock_movements (product_id, warehouse_id, type, quantity, reason, reference, created_by)
        VALUES (v_item.product_id, v_wh, 'in', v_item.quantity, 'Retour client: '||v_ret.reason, 'RC-'||substring(_id::text,1,8), auth.uid());
      ELSE
        INSERT INTO public.defective_items (product_id, warehouse_id, quantity, severity, category, reason, status, reported_by)
        VALUES (v_item.product_id, v_wh, v_item.quantity, 'majeur', 'autre', 'Retour client défectueux: '||v_ret.reason, 'applied', auth.uid());
        INSERT INTO public.stock_movements (product_id, warehouse_id, type, quantity, reason, reference, created_by)
        VALUES (v_item.product_id, v_wh, 'in', v_item.quantity, 'Retour → défectueux', 'RC-'||substring(_id::text,1,8), auth.uid());
        INSERT INTO public.stock_movements (product_id, warehouse_id, type, quantity, reason, reference, created_by)
        VALUES (v_item.product_id, v_wh, 'out', v_item.quantity, 'Défectueux (retour)', 'RC-'||substring(_id::text,1,8), auth.uid());
      END IF;
    END LOOP;
    UPDATE public.customer_returns SET status='approved', approver_id=auth.uid(), decided_at=now() WHERE id=_id;
  ELSE
    UPDATE public.customer_returns SET status='rejected', approver_id=auth.uid(), decided_at=now() WHERE id=_id;
  END IF;
  PERFORM public.notify_user(v_ret.requested_by,'return_decided',
    CASE WHEN _approve THEN 'Retour approuvé' ELSE 'Retour rejeté' END, v_ret.reason,'/returns');
END $$;

CREATE OR REPLACE FUNCTION public.notify_new_return() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.notify_admins('return_new','Nouveau retour client', NEW.reason,'/returns');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_return AFTER INSERT ON public.customer_returns
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_return();

-- ===== CASH SESSION CLOSE Z =====
CREATE OR REPLACE FUNCTION public.close_cash_session(_id UUID, _counted NUMERIC, _notes TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_sess public.cash_sessions; v_cash NUMERIC; v_expected NUMERIC; v_z TEXT;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'responsable')) THEN
    RAISE EXCEPTION 'Accès réservé';
  END IF;
  SELECT * INTO v_sess FROM public.cash_sessions WHERE id=_id FOR UPDATE;
  IF v_sess.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Déjà clôturée'; END IF;

  SELECT COALESCE(SUM(sp.amount - COALESCE(sp.change_given,0)),0) INTO v_cash
  FROM public.sale_payments sp
  JOIN public.sales s ON s.id = sp.sale_id
  WHERE s.cash_session_id = _id AND sp.method = 'cash';

  v_expected := v_sess.opening_float + v_cash;
  v_z := 'Z-'||to_char(now(),'YYYYMMDD')||'-'||lpad((floor(random()*9999))::int::text,4,'0');

  UPDATE public.cash_sessions SET
    closed_at = now(), closed_by = auth.uid(),
    expected_cash = v_expected, closing_counted = _counted,
    variance = _counted - v_expected,
    notes = COALESCE(notes,'')||CASE WHEN _notes IS NULL THEN '' ELSE E'\n'||_notes END,
    z_report_number = v_z
  WHERE id = _id;
  RETURN v_z;
END $$;
