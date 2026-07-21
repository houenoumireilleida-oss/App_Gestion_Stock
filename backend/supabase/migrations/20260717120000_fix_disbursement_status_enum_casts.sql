-- Ensure disbursement status transitions assign explicit enum values.

CREATE OR REPLACE FUNCTION public.decide_disbursement(
  _id uuid,
  _approve boolean,
  _note text,
  _partial_amount numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.disbursement_requests;
  v_amt numeric;
BEGIN
  SELECT * INTO v_row FROM public.disbursement_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF v_row.status <> 'pending'::public.disbursement_status THEN RAISE EXCEPTION 'Déjà décidée'; END IF;

  v_amt := COALESCE(_partial_amount, v_row.amount);
  IF _approve AND (v_amt <= 0 OR v_amt > v_row.amount) THEN RAISE EXCEPTION 'Montant invalide'; END IF;

  UPDATE public.disbursement_requests
  SET
    status = CASE
      WHEN _approve THEN 'approved'::public.disbursement_status
      ELSE 'rejected'::public.disbursement_status
    END,
    approver_id = auth.uid(),
    approver_note = _note,
    decided_at = now(),
    approved_amount = CASE WHEN _approve THEN v_amt ELSE NULL END
  WHERE id = _id;

  PERFORM public.notify_user(
    v_row.requested_by,
    'disbursement_decided',
    CASE WHEN _approve THEN 'Décaissement approuvé' ELSE 'Décaissement rejeté' END,
    v_row.beneficiary || ' — ' || v_amt || ' €',
    '/disbursement'
  );

  PERFORM public.log_audit(
    'disbursement_decide',
    'disbursement_requests',
    _id,
    jsonb_build_object('approve', _approve, 'partial_amount', _partial_amount, 'note', _note)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_disbursement_paid(_id uuid, _method text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.disbursement_requests;
BEGIN
  SELECT * INTO v_row FROM public.disbursement_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;
  IF v_row.status <> 'approved'::public.disbursement_status THEN RAISE EXCEPTION 'Doit être approuvée'; END IF;

  UPDATE public.disbursement_requests
  SET
    status = 'paid'::public.disbursement_status,
    paid_at = now(),
    payment_method = _method
  WHERE id = _id;

  PERFORM public.notify_user(
    v_row.requested_by,
    'disbursement_paid',
    'Décaissement exécuté',
    v_row.beneficiary || ' — ' || v_row.amount || ' €',
    '/disbursement'
  );
END;
$$;
