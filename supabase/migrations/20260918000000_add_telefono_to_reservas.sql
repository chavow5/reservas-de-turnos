-- ==============================================================================
-- MIGRATION: Agregar columna telefono en la tabla reservas
-- Fecha: 2026-09-18
-- ==============================================================================

ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS telefono text;
