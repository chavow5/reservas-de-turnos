-- Actualizar política de lectura pública de reservas para considerar todas las reservas (incluso manuales 'sin_pago') como ocupadas
DROP POLICY IF EXISTS "Public Read Reservas Ocupadas" ON public.reservas;

CREATE POLICY "Public Read Reservas Ocupadas" ON public.reservas
  FOR SELECT USING (true);
