-- Create transaction type enum
CREATE TYPE public.transaction_type AS ENUM (
  'deposit',
  'withdrawal', 
  'errand_payment',
  'errand_release',
  'refund',
  'commission'
);

-- Create transaction status enum
CREATE TYPE public.transaction_status AS ENUM (
  'pending',
  'completed',
  'failed',
  'cancelled'
);

-- Create wallets table
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  escrow_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (escrow_balance >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  errand_id UUID REFERENCES public.errands(id) ON DELETE SET NULL,
  type public.transaction_type NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status public.transaction_status NOT NULL DEFAULT 'pending',
  mpesa_reference TEXT,
  phone_number TEXT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Wallet policies
CREATE POLICY "Users can view their own wallet"
ON public.wallets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can create wallets"
ON public.wallets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets"
ON public.wallets FOR SELECT
USING (is_admin());

-- Transaction policies
CREATE POLICY "Users can view their own transactions"
ON public.transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.wallets 
    WHERE wallets.id = transactions.wallet_id 
    AND wallets.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all transactions"
ON public.transactions FOR SELECT
USING (is_admin());

-- Create updated_at triggers
CREATE TRIGGER update_wallets_updated_at
BEFORE UPDATE ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Function to auto-create wallet for new users
CREATE OR REPLACE FUNCTION public.create_wallet_for_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger to create wallet when profile is created
CREATE TRIGGER create_wallet_on_profile
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.create_wallet_for_user();