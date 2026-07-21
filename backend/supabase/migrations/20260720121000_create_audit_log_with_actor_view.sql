CREATE INDEX IF NOT EXISTS idx_audit_log_created_at_desc ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON public.audit_log(actor_id);

CREATE OR REPLACE VIEW public.audit_log_with_actor
WITH (security_invoker = true) AS
SELECT
  a.id,
  a.actor_id,
  p.display_name AS actor_display_name,
  a.action,
  a.entity,
  a.entity_id,
  a.details,
  a.created_at
FROM public.audit_log a
LEFT JOIN public.user_profiles p ON p.user_id = a.actor_id;

GRANT SELECT ON public.audit_log_with_actor TO authenticated;
