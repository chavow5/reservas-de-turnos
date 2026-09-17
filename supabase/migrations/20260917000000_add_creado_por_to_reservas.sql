-- ==============================================================================
-- MIGRATION: Agregar columna creado_por en la tabla reservas
-- Fecha: 2026-09-17
-- ==============================================================================

ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS creado_por text;

