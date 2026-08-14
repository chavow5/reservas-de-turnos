-- ==============================================================================
-- MIGRATION: Multi-Tenant Setup, SuperAdmin, Roles, MP Credentials & Payment States
-- Fecha: 2026-08-14
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLA: NEGOCIOS (Tenants)
CREATE TABLE IF NOT EXISTS public.negocios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  slug text NOT NULL UNIQUE,
  email_contacto text,
  plan text DEFAULT 'free',
  activo boolean DEFAULT true,
  modo_prueba boolean DEFAULT false,
  monto_sena numeric DEFAULT 100,
  precio_total numeric DEFAULT 100,
  mp_access_token text,
  mp_public_key text,
  created_at timestamptz DEFAULT now()
);

-- 3. TABLA: USUARIOS (Super Admin, Admins de Negocio y Colaboradores)
CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid REFERENCES public.negocios(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  nombre text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('superadmin', 'admin', 'colaborador')),
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 4. TABLA: RESERVAS (Actualización Multi-Tenant y Estados de Pago)
CREATE TABLE IF NOT EXISTS public.reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  fecha text NOT NULL,
  hora text NOT NULL,
  cancha text DEFAULT '1',
  pagado boolean DEFAULT false,
  payment_id text,
  created_at timestamptz DEFAULT now()
);

-- Agregar columnas a reservas si no existen
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES public.negocios(id) ON DELETE CASCADE;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS estado_pago text CHECK (estado_pago IN ('pagado', 'señado', 'sin_pago')) DEFAULT 'sin_pago';
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS monto_pagado numeric DEFAULT 0;

-- 5. SEMILLAS INICIALES (Seed Data)

-- Negocio 1: Modo Prueba
INSERT INTO public.negocios (id, nombre, slug, email_contacto, plan, activo, modo_prueba, monto_sena, precio_total)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Pruebas-Reservas',
  'pruebas-reservas',
  'contacto@pruebas.com',
  'pro',
  true,
  true,
  100,
  100
) ON CONFLICT (slug) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  modo_prueba = true,
  monto_sena = EXCLUDED.monto_sena;

-- Negocio 2: Negocio Principal Real
INSERT INTO public.negocios (id, nombre, slug, email_contacto, plan, activo, modo_prueba, monto_sena, precio_total)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Reservas Fútbol',
  'reservas-futbol',
  'contacto@reservas.com',
  'pro',
  true,
  false,
  100,
  100
) ON CONFLICT (slug) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  modo_prueba = false,
  monto_sena = EXCLUDED.monto_sena;

-- Usuarios Iniciales:
-- A) Super Admin
INSERT INTO public.usuarios (email, password, nombre, rol, negocio_id, activo)
VALUES (
  'chavow5@superadmin',
  'superadmin123',
  'Super Administrador',
  'superadmin',
  NULL,
  true
) ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  rol = 'superadmin';

-- B) Negocio Pruebas: Admin y Colaborador
INSERT INTO public.usuarios (email, password, nombre, rol, negocio_id, activo)
VALUES (
  'admin@pruebas.com',
  '123456',
  'Admin Pruebas',
  'admin',
  '11111111-1111-1111-1111-111111111111',
  true
) ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password;

INSERT INTO public.usuarios (email, password, nombre, rol, negocio_id, activo)
VALUES (
  'colaborador@pruebas.com',
  '123456',
  'Colaborador Pruebas',
  'colaborador',
  '11111111-1111-1111-1111-111111111111',
  true
) ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password;

-- C) Negocio Principal: Admin y Colaborador
INSERT INTO public.usuarios (email, password, nombre, rol, negocio_id, activo)
VALUES (
  'admin@reservas.com',
  'admin123',
  'Admin Reservas',
  'admin',
  '22222222-2222-2222-2222-222222222222',
  true
) ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password;

INSERT INTO public.usuarios (email, password, nombre, rol, negocio_id, activo)
VALUES (
  'colaborador@reservas.com',
  '123456',
  'Colaborador Reservas',
  'colaborador',
  '22222222-2222-2222-2222-222222222222',
  true
) ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password;

-- 6. MIGRAR RESERVAS EXISTENTES AL NEGOCIO PRINCIPAL
UPDATE public.reservas
SET negocio_id = '22222222-2222-2222-2222-222222222222'
WHERE negocio_id IS NULL;

UPDATE public.reservas
SET estado_pago = CASE WHEN pagado = true THEN 'pagado' ELSE 'sin_pago' END
WHERE estado_pago IS NULL OR estado_pago = 'sin_pago';

-- 7. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_negocios_slug ON public.negocios (slug);
CREATE INDEX IF NOT EXISTS idx_usuarios_negocio_id ON public.usuarios (negocio_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios (email);
CREATE INDEX IF NOT EXISTS idx_reservas_negocio_id ON public.reservas (negocio_id);
CREATE INDEX IF NOT EXISTS idx_reservas_negocio_fecha ON public.reservas (negocio_id, fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_slot ON public.reservas (negocio_id, fecha, hora, cancha);

-- 8. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

-- Políticas de Negocios:
-- Lectura pública para negocios activos (obtener info en frontend)
CREATE POLICY "Public Read Negocios Activos" ON public.negocios
  FOR SELECT USING (activo = true);

-- Acceso total para Service Role
CREATE POLICY "Service Role All Negocios" ON public.negocios
  FOR ALL USING (auth.role() = 'service_role');

-- Políticas de Usuarios:
CREATE POLICY "Service Role All Usuarios" ON public.usuarios
  FOR ALL USING (auth.role() = 'service_role');

-- Políticas de Reservas:
-- Clientes pueden leer turnos confirmados/señados para ver disponibilidad en calendario
CREATE POLICY "Public Read Reservas Ocupadas" ON public.reservas
  FOR SELECT USING (
    (pagado = true OR estado_pago IN ('pagado', 'señado'))
  );

-- Acceso total para Service Role
CREATE POLICY "Service Role All Reservas" ON public.reservas
  FOR ALL USING (auth.role() = 'service_role');
