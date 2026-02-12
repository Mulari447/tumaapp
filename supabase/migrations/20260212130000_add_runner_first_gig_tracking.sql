-- Add first_gig_completed_at column to track when runner completes their first gig
ALTER TABLE IF EXISTS runner_subscriptions
  ADD COLUMN IF NOT EXISTS first_gig_completed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS gigs_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_activated boolean NOT NULL DEFAULT false;

-- Create an index for faster queries on billing_activated status
CREATE INDEX IF NOT EXISTS idx_runner_subscriptions_billing_activated 
ON runner_subscriptions(billing_activated)
WHERE active = true;
