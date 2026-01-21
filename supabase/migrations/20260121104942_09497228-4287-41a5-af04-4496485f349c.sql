-- First migration: Add new enum values
ALTER TYPE errand_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE errand_status ADD VALUE IF NOT EXISTS 'disputed';
ALTER TYPE errand_status ADD VALUE IF NOT EXISTS 'paid';