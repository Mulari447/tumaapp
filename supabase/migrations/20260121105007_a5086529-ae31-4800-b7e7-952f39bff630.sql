-- Add new columns to errands table
ALTER TABLE public.errands 
ADD COLUMN IF NOT EXISTS pickup_location text,
ADD COLUMN IF NOT EXISTS dropoff_location text,
ADD COLUMN IF NOT EXISTS estimated_hours numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS base_rate numeric DEFAULT 150,
ADD COLUMN IF NOT EXISTS hourly_rate numeric DEFAULT 150,
ADD COLUMN IF NOT EXISTS total_price numeric GENERATED ALWAYS AS (base_rate + (estimated_hours * hourly_rate)) STORED,
ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS disputed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS dispute_reason text,
ADD COLUMN IF NOT EXISTS admin_notes text;

-- Create notification_type enum
CREATE TYPE notification_type AS ENUM (
  'job_posted',
  'job_accepted',
  'job_started',
  'job_completed',
  'confirmation_requested',
  'job_confirmed',
  'job_disputed',
  'job_paid',
  'job_reassigned',
  'runner_suspended',
  'runner_reinstated',
  'admin_action',
  'new_message',
  'rating_received'
);

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  errand_id uuid REFERENCES public.errands(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  read_at timestamp with time zone
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Create errand_status_history table for audit trail
CREATE TABLE public.errand_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  errand_id uuid NOT NULL REFERENCES public.errands(id) ON DELETE CASCADE,
  previous_status errand_status,
  new_status errand_status NOT NULL,
  changed_by uuid NOT NULL,
  changed_at timestamp with time zone DEFAULT now(),
  notes text
);

ALTER TABLE public.errand_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view status history for their errands"
ON public.errand_status_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM errands 
    WHERE errands.id = errand_status_history.errand_id 
    AND (errands.customer_id = auth.uid() OR errands.runner_id = auth.uid())
  )
  OR is_admin()
);

CREATE POLICY "System can insert status history"
ON public.errand_status_history FOR INSERT
WITH CHECK (true);

-- Create errand_messages table
CREATE TABLE public.errand_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  errand_id uuid NOT NULL REFERENCES public.errands(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.errand_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view messages"
ON public.errand_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM errands 
    WHERE errands.id = errand_messages.errand_id 
    AND (errands.customer_id = auth.uid() OR errands.runner_id = auth.uid())
  )
  OR is_admin()
);

CREATE POLICY "Participants can send messages"
ON public.errand_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM errands 
    WHERE errands.id = errand_messages.errand_id 
    AND (errands.customer_id = auth.uid() OR errands.runner_id = auth.uid())
  )
);

-- Create ratings table
CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  errand_id uuid NOT NULL REFERENCES public.errands(id) ON DELETE CASCADE UNIQUE,
  customer_id uuid NOT NULL,
  runner_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ratings"
ON public.ratings FOR SELECT
USING (true);

CREATE POLICY "Customers can create ratings for their errands"
ON public.ratings FOR INSERT
WITH CHECK (
  auth.uid() = customer_id AND
  EXISTS (
    SELECT 1 FROM errands 
    WHERE errands.id = ratings.errand_id 
    AND errands.customer_id = auth.uid()
    AND errands.status IN ('confirmed', 'paid')
  )
);

-- Create admin_decisions table
CREATE TABLE public.admin_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  errand_id uuid REFERENCES public.errands(id) ON DELETE CASCADE,
  runner_id uuid,
  admin_id uuid NOT NULL,
  decision_type text NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.admin_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage decisions"
ON public.admin_decisions FOR ALL
USING (is_admin());

CREATE POLICY "Users can view decisions about their errands"
ON public.admin_decisions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM errands 
    WHERE errands.id = admin_decisions.errand_id 
    AND (errands.customer_id = auth.uid() OR errands.runner_id = auth.uid())
  )
);

-- Create runner_stats view
CREATE OR REPLACE VIEW public.runner_stats AS
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

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.errand_messages;