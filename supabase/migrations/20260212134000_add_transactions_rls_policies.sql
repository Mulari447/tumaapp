-- Add RLS Policies for Transactions Table

-- Enable RLS on transactions table if not already enabled
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert transactions for their wallet" ON transactions;
DROP POLICY IF EXISTS "Users can view their transactions" ON transactions;
DROP POLICY IF EXISTS "Service role can manage transactions" ON transactions;

-- Allow authenticated users to insert transaction records for their own wallet
CREATE POLICY "Users can insert transactions for their wallet"
ON transactions
FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM wallets WHERE id = wallet_id
  )
);

-- Allow authenticated users to view their own transactions
CREATE POLICY "Users can view their transactions"
ON transactions
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM wallets WHERE id = wallet_id
  )
);

-- Allow service role (backend functions) to manage all transactions
CREATE POLICY "Service role can manage transactions"
ON transactions
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated users to update their own transactions (for status updates)
CREATE POLICY "Users can update their transactions"
ON transactions
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT user_id FROM wallets WHERE id = wallet_id
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM wallets WHERE id = wallet_id
  )
);
