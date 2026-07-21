-- Preview customers whose loyalty points differ from the FCFA rule.
-- New rule: 1 loyalty point per full 1000 FCFA spent, calculated per sale.

WITH recalculated AS (
  SELECT
    c.id,
    c.first_name,
    c.last_name,
    c.loyalty_points AS current_points,
    COALESCE(SUM(floor(greatest(s.total, 0) / 1000)) FILTER (
      WHERE s.status IN ('completed', 'partial_refund')
    ), 0)::int AS recalculated_points
  FROM public.customers c
  LEFT JOIN public.sales s ON s.customer_id = c.id
  GROUP BY c.id, c.first_name, c.last_name, c.loyalty_points
)
SELECT
  id,
  first_name,
  last_name,
  current_points,
  recalculated_points,
  current_points - recalculated_points AS points_to_remove
FROM recalculated
WHERE current_points <> recalculated_points
ORDER BY points_to_remove DESC, last_name, first_name;

-- Apply the correction after reviewing the preview above.
-- Uncomment this block when you are ready to update existing customer points.
/*
WITH recalculated AS (
  SELECT
    c.id,
    COALESCE(SUM(floor(greatest(s.total, 0) / 1000)) FILTER (
      WHERE s.status IN ('completed', 'partial_refund')
    ), 0)::int AS recalculated_points
  FROM public.customers c
  LEFT JOIN public.sales s ON s.customer_id = c.id
  GROUP BY c.id
)
UPDATE public.customers c
SET loyalty_points = r.recalculated_points
FROM recalculated r
WHERE c.id = r.id
  AND c.loyalty_points <> r.recalculated_points;
*/
