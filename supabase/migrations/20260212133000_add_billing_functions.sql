-- Create function to sync gigs_completed count
CREATE OR REPLACE FUNCTION public.sync_runner_gigs_completed(p_runner_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM errands
  WHERE runner_id = p_runner_id
    AND status IN ('confirmed', 'paid')
    AND (completed_at IS NOT NULL OR confirmed_at IS NOT NULL);
$$;

-- Create function to check and activate runner billing
CREATE OR REPLACE FUNCTION public.activate_runner_billing_if_needed(p_runner_id UUID)
RETURNS TABLE(subscription_id UUID, activated BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription runner_subscriptions%ROWTYPE;
  v_completed_count INTEGER;
BEGIN
  -- Get the runner's subscription
  SELECT * INTO v_subscription
  FROM runner_subscriptions
  WHERE runner_id = p_runner_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, false, 'No subscription found'::TEXT;
    RETURN;
  END IF;

  -- Count confirmed/paid errands
  SELECT COUNT(*)::INTEGER INTO v_completed_count
  FROM errands
  WHERE runner_id = p_runner_id
    AND status IN ('confirmed', 'paid')
    AND (completed_at IS NOT NULL OR confirmed_at IS NOT NULL);

  -- If subscription not activated and at least 1 gig completed, activate it
  IF NOT v_subscription.billing_activated AND v_completed_count > 0 THEN
    UPDATE runner_subscriptions
    SET 
      billing_activated = true,
      gigs_completed = v_completed_count,
      first_gig_completed_at = (
        SELECT MIN(confirmed_at)
        FROM errands
        WHERE runner_id = p_runner_id
          AND status IN ('confirmed', 'paid')
          AND confirmed_at IS NOT NULL
      ),
      next_billing_at = CASE 
        WHEN v_subscription.status = 'trial' THEN v_subscription.trial_end_at
        ELSE now()
      END
    WHERE id = v_subscription.id;

    RETURN QUERY SELECT v_subscription.id, true, 'Billing activated after first gig completion'::TEXT;
  ELSIF v_subscription.gigs_completed <> v_completed_count THEN
    -- Update gigs_completed count
    UPDATE runner_subscriptions
    SET gigs_completed = v_completed_count
    WHERE id = v_subscription.id;
    
    RETURN QUERY SELECT v_subscription.id, false, format('Gigs count updated to %s', v_completed_count)::TEXT;
  ELSE
    RETURN QUERY SELECT v_subscription.id, false, 'No changes needed'::TEXT;
  END IF;
END;
$$;
