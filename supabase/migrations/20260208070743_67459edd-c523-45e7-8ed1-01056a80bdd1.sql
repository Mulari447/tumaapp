-- Add transport_type and driving_license_url columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS transport_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS driving_license_url TEXT DEFAULT NULL;

-- Add location columns for geolocation-based matching
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS current_latitude DOUBLE PRECISION DEFAULT NULL,
ADD COLUMN IF NOT EXISTS current_longitude DOUBLE PRECISION DEFAULT NULL,
ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add location columns to errands table for proximity matching
ALTER TABLE public.errands
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION DEFAULT NULL,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION DEFAULT NULL;

-- Create index for geospatial queries on profiles (runners)
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles(current_latitude, current_longitude) 
WHERE current_latitude IS NOT NULL AND current_longitude IS NOT NULL;

-- Create index for geospatial queries on errands
CREATE INDEX IF NOT EXISTS idx_errands_location ON public.errands(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Update handle_new_user function to also save transport_type for runners
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, user_type, transport_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    COALESCE((NEW.raw_user_meta_data->>'user_type')::public.user_type, 'customer'),
    COALESCE(NEW.raw_user_meta_data->>'transport_type', NULL)
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;

-- Create a function to find nearby errands for runners
CREATE OR REPLACE FUNCTION public.find_nearby_errands(
  runner_lat DOUBLE PRECISION,
  runner_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 10
)
RETURNS TABLE (
  errand_id UUID,
  title TEXT,
  description TEXT,
  category public.errand_category,
  budget NUMERIC,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as errand_id,
    e.title,
    e.description,
    e.category,
    e.budget,
    e.location,
    e.latitude,
    e.longitude,
    (
      6371 * acos(
        cos(radians(runner_lat)) * cos(radians(e.latitude)) *
        cos(radians(e.longitude) - radians(runner_lng)) +
        sin(radians(runner_lat)) * sin(radians(e.latitude))
      )
    ) AS distance_km,
    e.created_at
  FROM errands e
  WHERE e.status = 'open'
    AND e.latitude IS NOT NULL 
    AND e.longitude IS NOT NULL
    AND (
      6371 * acos(
        cos(radians(runner_lat)) * cos(radians(e.latitude)) *
        cos(radians(e.longitude) - radians(runner_lng)) +
        sin(radians(runner_lat)) * sin(radians(e.latitude))
      )
    ) <= radius_km
  ORDER BY distance_km ASC;
END;
$function$;