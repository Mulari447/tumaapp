
-- Price proposals table for in-chat negotiation
CREATE TABLE public.price_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  errand_id uuid NOT NULL REFERENCES public.errands(id) ON DELETE CASCADE,
  proposed_by uuid NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

ALTER TABLE public.price_proposals ENABLE ROW LEVEL SECURITY;

-- Both customer and runner can view proposals for their errands
CREATE POLICY "Participants can view proposals" ON public.price_proposals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM errands
      WHERE errands.id = price_proposals.errand_id
      AND (errands.customer_id = auth.uid() OR errands.runner_id = auth.uid())
    )
  );

-- Both can create proposals
CREATE POLICY "Participants can create proposals" ON public.price_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = proposed_by
    AND EXISTS (
      SELECT 1 FROM errands
      WHERE errands.id = price_proposals.errand_id
      AND (errands.customer_id = auth.uid() OR errands.runner_id = auth.uid())
    )
  );

-- Both can update (accept/reject)
CREATE POLICY "Participants can update proposals" ON public.price_proposals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM errands
      WHERE errands.id = price_proposals.errand_id
      AND (errands.customer_id = auth.uid() OR errands.runner_id = auth.uid())
    )
  );

-- Enable realtime for price proposals
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_proposals;
