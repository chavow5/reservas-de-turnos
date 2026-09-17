-- ==============================================================================
-- SCRIPT DE INSTALACIÓN INICIAL PARA CLIENTE (SINGLE-TENANT PRODUCCIÓN)
-- Ejecutar este script una sola vez en el Editor SQL de Supabase para cada cliente nuevo.
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLA: NEGOCIO (Configuración central del cliente)
CREATE TABLE IF NOT EXISTS public.negocios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL DEFAULT 'Cancha de Fútbol',
  telefono text DEFAULT '3804201334',
  direccion text DEFAULT 'Av. San Martín 1234',
  activo boolean DEFAULT true,
  monto_sena numeric DEFAULT 100,
  precio_total numeric DEFAULT 100,
  mp_access_token text,
  canchas jsonb DEFAULT '[
    {"id": "1", "nombre": "Cancha 1", "activa": true},
    {"id": "2", "nombre": "Cancha 2", "activa": true}
  ]'::jsonb,
  horarios jsonb DEFAULT '[
    "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", 
    "21:00", "22:00", "23:00", "00:00", "01:00"
  ]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 3. TABLA: USUARIOS (Administradores y Colaboradores del Negocio)
CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  nombre text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('admin', 'colaborador')),
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 4. TABLA: RESERVAS (Turnos)
CREATE TABLE IF NOT EXISTS public.reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  fecha text NOT NULL,
  hora text NOT NULL,
  cancha text DEFAULT '1',
  pagado boolean DEFAULT false,
  estado_pago text CHECK (estado_pago IN ('pagado', 'señado', 'sin_pago')) DEFAULT 'sin_pago',
  monto_pagado numeric DEFAULT 0,
  payment_id text,
  creado_por text DEFAULT 'Cliente (Online - Mercado Pago)',
  created_at timestamptz DEFAULT now()
);

-- Índices para búsqueda rápida de disponibilidad y turnos ocupados
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_hora_cancha ON public.reservas (fecha, hora, cancha);
CREATE INDEX IF NOT EXISTS idx_reservas_payment_id ON public.reservas (payment_id);

-- 5. POLÍTICAS DE SEGURIDAD (Row Level Security - RLS)
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública de reservas (para el calendario de disponibilidad)
CREATE POLICY "Permitir lectura pública de turnos" ON public.reservas
  FOR SELECT USING (true);

-- Permitir lectura pública de configuración del negocio
CREATE POLICY "Permitir lectura pública de config negocio" ON public.negocios
  FOR SELECT USING (true);

-- Backend (service_role) tiene acceso total automático (bypass RLS).

-- 6. DATOS SEMILLA INICIALES (Configuración por defecto)
INSERT INTO public.negocios (id, nombre, telefono, direccion, monto_sena, precio_total)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Mi Complejo Deportivo',
  '3804201334',
  'Av. San Martín 1234',
  100,
  100
) ON CONFLICT (id) DO NOTHING;

-- Usuario Administrador por defecto
INSERT INTO public.usuarios (email, password, nombre, rol, activo)
VALUES (
  'admin@reservas.com',
  'admin123',
  'Administrador Principal',
  'admin',
  true
) ON CONFLICT (email) DO NOTHING;

