
-- Create house_listings table
CREATE TABLE public.house_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  runner_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  monthly_rent NUMERIC NOT NULL,
  bedrooms INTEGER DEFAULT 1,
  bathrooms INTEGER DEFAULT 1,
  amenities TEXT[],
  photos TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'taken', 'removed')),
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.house_listings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view available listings
CREATE POLICY "Anyone can view available listings"
ON public.house_listings FOR SELECT
TO authenticated
USING (status = 'available' OR runner_id = auth.uid());

-- Runners can insert their own listings
CREATE POLICY "Runners can create listings"
ON public.house_listings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = runner_id);

-- Runners can update their own listings
CREATE POLICY "Runners can update own listings"
ON public.house_listings FOR UPDATE
TO authenticated
USING (auth.uid() = runner_id);

-- Runners can delete their own listings
CREATE POLICY "Runners can delete own listings"
ON public.house_listings FOR DELETE
TO authenticated
USING (auth.uid() = runner_id);

-- Create house_inquiries table for customers to express interest
CREATE TABLE public.house_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.house_listings(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  message TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.house_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can create inquiries"
ON public.house_inquiries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Users can view their own inquiries"
ON public.house_inquiries FOR SELECT
TO authenticated
USING (auth.uid() = customer_id OR auth.uid() IN (
  SELECT runner_id FROM public.house_listings WHERE id = listing_id
));

CREATE POLICY "Runners can update inquiry status"
ON public.house_inquiries FOR UPDATE
TO authenticated
USING (auth.uid() IN (
  SELECT runner_id FROM public.house_listings WHERE id = listing_id
));

-- Trigger for updated_at
CREATE TRIGGER update_house_listings_updated_at
BEFORE UPDATE ON public.house_listings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.house_listings;

-- Create storage bucket for house photos
INSERT INTO storage.buckets (id, name, public) VALUES ('house-photos', 'house-photos', true);

-- Storage policies
CREATE POLICY "Anyone can view house photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'house-photos');

CREATE POLICY "Authenticated users can upload house photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'house-photos');

CREATE POLICY "Users can delete own house photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'house-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
