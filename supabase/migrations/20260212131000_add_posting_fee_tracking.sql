-- Add errand posting fee tracking
ALTER TABLE IF EXISTS public.transactions
  ADD COLUMN IF NOT EXISTS posting_fee_type text CHECK (posting_fee_type IN ('errand_posting', 'house_posting'));

-- Create index for faster lookups of errand posting fees
CREATE INDEX IF NOT EXISTS idx_transactions_errand_posting 
ON public.transactions(errand_id, posting_fee_type)
WHERE type = 'errand_payment' AND posting_fee_type = 'errand_posting';
