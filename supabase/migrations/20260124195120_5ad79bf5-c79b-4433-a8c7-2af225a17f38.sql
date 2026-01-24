-- Fix: make runner_stats an invoker view (avoid SECURITY DEFINER behavior)
CREATE OR REPLACE VIEW public.runner_stats
WITH (security_invoker = on)
AS
SELECT p.id AS runner_id,
       p.full_name,
       p.email,
       p.verification_status,
       count(DISTINCT e.id) FILTER (WHERE e.status = ANY (ARRAY['confirmed'::errand_status, 'paid'::errand_status])) AS total_completed,
       count(DISTINCT e.id) FILTER (WHERE e.status = 'cancelled'::errand_status AND e.runner_id IS NOT NULL) AS total_cancellations,
       count(DISTINCT e.id) FILTER (WHERE e.status = 'disputed'::errand_status) AS total_disputes,
       round(avg(r.rating), 2) AS average_rating,
       count(DISTINCT r.id) AS total_ratings,
       CASE
         WHEN count(DISTINCT e.id) FILTER (WHERE e.runner_id IS NOT NULL) > 0
           THEN round(
             count(DISTINCT e.id) FILTER (WHERE e.status = ANY (ARRAY['confirmed'::errand_status, 'paid'::errand_status]))::numeric /
             count(DISTINCT e.id) FILTER (WHERE e.runner_id IS NOT NULL)::numeric * 100::numeric,
             2
           )
         ELSE 0::numeric
       END AS completion_rate
FROM profiles p
LEFT JOIN errands e ON e.runner_id = p.id
LEFT JOIN ratings r ON r.runner_id = p.id
WHERE p.user_type = 'runner'::user_type
GROUP BY p.id, p.full_name, p.email, p.verification_status;