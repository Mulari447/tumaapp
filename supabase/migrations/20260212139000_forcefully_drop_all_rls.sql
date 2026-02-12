-- Dynamically drop ALL RLS policies on the tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE tablename IN ('transactions', 'errands', 'wallets')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.tablename;
        RAISE NOTICE 'Dropped policy: % on %', r.policyname, r.tablename;
    END LOOP;
END $$;

-- Now explicitly disable RLS on these three tables
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE errands DISABLE ROW LEVEL SECURITY;
ALTER TABLE wallets DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('transactions', 'errands', 'wallets');
