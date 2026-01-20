-- Create wallets for existing users who don't have one
INSERT INTO public.wallets (user_id)
SELECT id FROM public.profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.wallets WHERE wallets.user_id = profiles.id
);