-- ==============================================================================
-- MIGRACIÓN: Canchas Dinámicas con Estado de Disponibilidad por Negocio
-- ==============================================================================

-- 1. Agregar columna canchas (array jsonb) a public.negocios si no existe
ALTER TABLE public.negocios 
  ADD COLUMN IF NOT EXISTS canchas JSONB DEFAULT '[
    {"id": "1", "nombre": "Cancha 1", "activa": true},
    {"id": "2", "nombre": "Cancha 2", "activa": true}
  ]'::jsonb;

-- 2. Asegurar que todos los negocios existentes tengan sus canchas configuradas
UPDATE public.negocios 
SET canchas = '[
  {"id": "1", "nombre": "Cancha 1", "activa": true},
  {"id": "2", "nombre": "Cancha 2", "activa": true}
]'::jsonb 
WHERE canchas IS NULL;
