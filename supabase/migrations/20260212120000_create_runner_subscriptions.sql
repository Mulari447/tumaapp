-- Create runner_subscriptions table
CREATE TABLE IF NOT EXISTS runner_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  runner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'trial', -- trial | active | paused | cancelled
  started_at timestamptz NOT NULL DEFAULT now(),
  trial_end_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  weekly_fee numeric NOT NULL DEFAULT 300,
  last_billed_at timestamptz,
  next_billing_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runner_subscriptions_runner_id ON runner_subscriptions (runner_id);
