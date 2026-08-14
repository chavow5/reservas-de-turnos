-- Migración para gestión de Abono Mensual y Registro de Pagos SaaS
ALTER TABLE public.negocios 
  ADD COLUMN IF NOT EXISTS precio_mensual NUMERIC DEFAULT 25000,
  ADD COLUMN IF NOT EXISTS estado_suscripcion TEXT DEFAULT 'al_dia',
  ADD COLUMN IF NOT EXISTS dia_vencimiento INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS ultimo_pago TIMESTAMPTZ;

-- Tabla para el historial de pagos de mensualidades de los clientes
CREATE TABLE IF NOT EXISTS public.pagos_suscripcion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE,
  mes TEXT NOT NULL,
  monto NUMERIC NOT NULL,
  fecha_pago TIMESTAMPTZ DEFAULT now(),
  metodo TEXT DEFAULT 'Transferencia',
  comprobante TEXT,
  notas TEXT,
  estado TEXT DEFAULT 'pagado',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de búsqueda
CREATE INDEX IF NOT EXISTS idx_pagos_suscripcion_negocio ON public.pagos_suscripcion(negocio_id);
CREATE INDEX IF NOT EXISTS idx_pagos_suscripcion_fecha ON public.pagos_suscripcion(fecha_pago);
