-- Fix errands RLS: allow customers to insert their own errands
DROP POLICY IF EXISTS "Customers can insert their own errands" ON errands;

CREATE POLICY "Customers can insert their own errands"
ON errands
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = customer_id);

-- Allow customers/runners to view errands
DROP POLICY IF EXISTS "Users can view errands" ON errands;
CREATE POLICY "Authenticated users can view errands"
ON errands
FOR SELECT
TO authenticated
USING (true);

-- Allow updates (for status changes, etc)
DROP POLICY IF EXISTS "Authenticated users can update errands" ON errands;
CREATE POLICY "Authenticated users can update errands"
ON errands
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
