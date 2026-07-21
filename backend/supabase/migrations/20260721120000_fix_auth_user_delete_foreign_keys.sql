-- Ensure deleting an Auth user cleans up mutable user-owned rows while preserving history.

DO $$
DECLARE
  target record;
  existing_constraint text;
  new_constraint_name text;
BEGIN
  FOR target IN
    SELECT *
    FROM (
      VALUES
        ('user_profiles', 'user_id', 'CASCADE', false),
        ('user_roles', 'user_id', 'CASCADE', false),
        ('notifications', 'user_id', 'CASCADE', false),
        ('audit_log', 'actor_id', 'SET NULL', false),
        ('stock_movements', 'created_by', 'SET NULL', false),
        ('purchase_orders', 'created_by', 'SET NULL', false),
        ('cash_sessions', 'opened_by', 'SET NULL', true),
        ('cash_sessions', 'closed_by', 'SET NULL', false),
        ('sales', 'cashier_id', 'SET NULL', false),
        ('invoices', 'created_by', 'SET NULL', false),
        ('defective_items', 'reported_by', 'SET NULL', false),
        ('defective_items', 'decided_by', 'SET NULL', false),
        ('destocking_requests', 'requested_by', 'SET NULL', false),
        ('destocking_requests', 'approver_id', 'SET NULL', false),
        ('disbursement_requests', 'requested_by', 'SET NULL', false),
        ('disbursement_requests', 'approver_id', 'SET NULL', false),
        ('return_requests', 'requested_by', 'SET NULL', false),
        ('return_requests', 'approver_id', 'SET NULL', false)
    ) AS targets(table_name, column_name, delete_action, drop_not_null)
  LOOP
    IF to_regclass(format('public.%I', target.table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target.table_name
        AND column_name = target.column_name
    ) THEN
      CONTINUE;
    END IF;

    IF target.drop_not_null THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL',
        target.table_name,
        target.column_name
      );
    END IF;

    IF target.delete_action = 'SET NULL' THEN
      EXECUTE format(
        'UPDATE public.%I AS t SET %I = NULL WHERE %I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE u.id = t.%I)',
        target.table_name,
        target.column_name,
        target.column_name,
        target.column_name
      );
    END IF;

    FOR existing_constraint IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class table_class ON table_class.oid = c.conrelid
      JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
      JOIN pg_attribute column_attribute
        ON column_attribute.attrelid = table_class.oid
       AND column_attribute.attnum = ANY (c.conkey)
      WHERE c.contype = 'f'
        AND table_namespace.nspname = 'public'
        AND table_class.relname = target.table_name
        AND column_attribute.attname = target.column_name
        AND c.confrelid = 'auth.users'::regclass
    LOOP
      EXECUTE format(
        'ALTER TABLE public.%I DROP CONSTRAINT %I',
        target.table_name,
        existing_constraint
      );
    END LOOP;

    new_constraint_name := target.table_name || '_' || target.column_name || '_fkey';
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE %s',
      target.table_name,
      new_constraint_name,
      target.column_name,
      target.delete_action
    );
  END LOOP;
END $$;

CREATE OR REPLACE VIEW public.audit_log_with_actor
WITH (security_invoker = true) AS
SELECT
  a.id,
  a.actor_id,
  COALESCE(p.display_name, 'Utilisateur supprime') AS actor_display_name,
  a.action,
  a.entity,
  a.entity_id,
  a.details,
  a.created_at
FROM public.audit_log a
LEFT JOIN public.user_profiles p ON p.user_id = a.actor_id;

GRANT SELECT ON public.audit_log_with_actor TO authenticated;
