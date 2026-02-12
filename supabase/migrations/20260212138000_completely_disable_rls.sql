-- Completely disable RLS on transactions by dropping ALL policies
DROP POLICY IF EXISTS "Users can insert transactions for their wallet" ON transactions;
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view their transactions" ON transactions;
DROP POLICY IF EXISTS "Authenticated users can view their transactions" ON transactions;
DROP POLICY IF EXISTS "Service role can manage transactions" ON transactions;
DROP POLICY IF EXISTS "Authenticated users can update their transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their transactions" ON transactions;

-- Now disable RLS completely
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE errands DISABLE ROW LEVEL SECURITY;
ALTER TABLE wallets DISABLE ROW LEVEL SECURITY;
