-- Add runner_subscription transaction type
ALTER TYPE public.transaction_type ADD VALUE 'runner_subscription' BEFORE 'commission';
