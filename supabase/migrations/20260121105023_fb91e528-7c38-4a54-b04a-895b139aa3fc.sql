-- Fix security issues: Drop permissive policies and recreate with proper checks

-- Drop the overly permissive notification insert policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create a security definer function to insert notifications (for edge functions)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type notification_type,
  p_title text,
  p_message text,
  p_errand_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, errand_id)
  VALUES (p_user_id, p_type, p_title, p_message, p_errand_id)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Drop the overly permissive status history insert policy  
DROP POLICY IF EXISTS "System can insert status history" ON public.errand_status_history;

-- Create a security definer function to insert status history
CREATE OR REPLACE FUNCTION public.log_status_change(
  p_errand_id uuid,
  p_previous_status errand_status,
  p_new_status errand_status,
  p_changed_by uuid,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_history_id uuid;
BEGIN
  INSERT INTO errand_status_history (errand_id, previous_status, new_status, changed_by, notes)
  VALUES (p_errand_id, p_previous_status, p_new_status, p_changed_by, p_notes)
  RETURNING id INTO v_history_id;
  
  RETURN v_history_id;
END;
$$;

-- Fix runner_stats view - drop and recreate without SECURITY DEFINER
DROP VIEW IF EXISTS public.runner_stats;

CREATE VIEW public.runner_stats AS
SELECT 
  p.id as runner_id,
  p.full_name,
  p.email,
  p.verification_status,
  COUNT(DISTINCT e.id) FILTER (WHERE e.status IN ('confirmed', 'paid')) as total_completed,
  COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'cancelled' AND e.runner_id IS NOT NULL) as total_cancellations,
  COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'disputed') as total_disputes,
  ROUND(AVG(r.rating)::numeric, 2) as average_rating,
  COUNT(DISTINCT r.id) as total_ratings,
  CASE 
    WHEN COUNT(DISTINCT e.id) FILTER (WHERE e.runner_id IS NOT NULL) > 0 
    THEN ROUND(
      (COUNT(DISTINCT e.id) FILTER (WHERE e.status IN ('confirmed', 'paid'))::numeric / 
       COUNT(DISTINCT e.id) FILTER (WHERE e.runner_id IS NOT NULL)::numeric) * 100, 2
    )
    ELSE 0
  END as completion_rate
FROM profiles p
LEFT JOIN errands e ON e.runner_id = p.id
LEFT JOIN ratings r ON r.runner_id = p.id
WHERE p.user_type = 'runner'
GROUP BY p.id, p.full_name, p.email, p.verification_status;