-- Create errand category enum
CREATE TYPE public.errand_category AS ENUM ('groceries', 'delivery', 'cleaning', 'laundry', 'moving', 'other');

-- Create errand status enum
CREATE TYPE public.errand_status AS ENUM ('open', 'assigned', 'in_progress', 'completed', 'cancelled');

-- Create errands table
CREATE TABLE public.errands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  runner_id UUID,
  title TEXT NOT NULL,
  category errand_category NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  budget NUMERIC(10, 2) NOT NULL CHECK (budget > 0),
  status errand_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.errands ENABLE ROW LEVEL SECURITY;

-- Customers can create their own errands
CREATE POLICY "Customers can create errands"
ON public.errands
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = customer_id);

-- Customers can view their own errands
CREATE POLICY "Customers can view own errands"
ON public.errands
FOR SELECT
TO authenticated
USING (auth.uid() = customer_id);

-- Customers can update their own open errands
CREATE POLICY "Customers can update own open errands"
ON public.errands
FOR UPDATE
TO authenticated
USING (auth.uid() = customer_id AND status = 'open')
WITH CHECK (auth.uid() = customer_id);

-- Customers can cancel their own open errands
CREATE POLICY "Customers can delete own open errands"
ON public.errands
FOR DELETE
TO authenticated
USING (auth.uid() = customer_id AND status = 'open');

-- Verified runners can view open errands
CREATE POLICY "Verified runners can view open errands"
ON public.errands
FOR SELECT
TO authenticated
USING (
  status = 'open' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND user_type = 'runner'
    AND verification_status = 'verified'
  )
);

-- Runners can view errands assigned to them
CREATE POLICY "Runners can view assigned errands"
ON public.errands
FOR SELECT
TO authenticated
USING (auth.uid() = runner_id);

-- Runners can update errands assigned to them
CREATE POLICY "Runners can update assigned errands"
ON public.errands
FOR UPDATE
TO authenticated
USING (auth.uid() = runner_id)
WITH CHECK (auth.uid() = runner_id);

-- Admins can view all errands
CREATE POLICY "Admins can view all errands"
ON public.errands
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Admins can update all errands
CREATE POLICY "Admins can update all errands"
ON public.errands
FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_errands_updated_at
BEFORE UPDATE ON public.errands
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();