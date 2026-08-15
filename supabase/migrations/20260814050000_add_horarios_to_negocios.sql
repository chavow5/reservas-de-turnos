-- ==============================================================================
-- MIGRACIÓN: Horarios de Atención y Turnos Disponibles por Negocio
-- ==============================================================================

-- 1. Agregar columna horarios (array jsonb) a public.negocios si no existe
ALTER TABLE public.negocios 
  ADD COLUMN IF NOT EXISTS horarios JSONB DEFAULT '[
    "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00", "01:00"
  ]'::jsonb;

-- 2. Asegurar que los negocios existentes tengan sus horarios iniciales configurados
UPDATE public.negocios 
SET horarios = '[
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00", "01:00"
]'::jsonb 
WHERE horarios IS NULL;
