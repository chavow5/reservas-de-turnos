-- Migración para agregar Teléfono, DNI y Ubicación/Dirección a los negocios
ALTER TABLE public.negocios 
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS dni TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT;
