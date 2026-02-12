-- Add billing attempt tracking to runner_subscriptions
ALTER TABLE IF EXISTS runner_subscriptions
  ADD COLUMN IF NOT EXISTS billing_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_billing_error text NULL;
