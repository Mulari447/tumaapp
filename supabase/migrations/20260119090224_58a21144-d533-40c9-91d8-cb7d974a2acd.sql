-- Add admin tracking fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verified_by UUID;

-- Assign admin role to the specified email
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'mdlazaro46@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;