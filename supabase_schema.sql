-- =================================================================
-- ESQUEMA COMPLETO DE BASE DE DATOS SUPABASE - PLATAFORMA SWSV
-- Copiar y ejecutar este script en el Editor SQL de Supabase
-- =================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE EVENTOS
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subtitle TEXT,
  location TEXT NOT NULL,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  no_bed_max_capacity INT DEFAULT 15 NOT NULL,
  no_bed_price NUMERIC(10, 2) DEFAULT 80.00 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA DE HABITACIONES
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLA DE CAMAS (RECURSO PRINCIPAL DE CAPACIDAD)
CREATE TABLE IF NOT EXISTS public.beds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  bed_number INT NOT NULL,
  bed_type TEXT NOT NULL, -- ej: 'King Size VIP', 'Queen Size'
  capacity_label TEXT DEFAULT '1 Pareja (2 personas)',
  price NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'occupied', 'locked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_room_bed_number UNIQUE (room_id, bed_number)
);

-- 5. TABLA DE RESERVAS (PAREJAS)
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_code TEXT UNIQUE NOT NULL, -- ej: SWSV-9812
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  bed_id UUID REFERENCES public.beds(id) ON DELETE SET NULL, -- NULL si es cupo 'no_bed'
  booking_type TEXT NOT NULL CHECK (booking_type IN ('with_bed', 'no_bed')),
  partner1_name TEXT NOT NULL,
  partner2_name TEXT NOT NULL,
  whatsapp_phone TEXT NOT NULL,
  price_total NUMERIC(10, 2) NOT NULL,
  payment_method TEXT DEFAULT 'pay_on_site' CHECK (payment_method IN ('pay_on_site', 'bank_transfer')),
  payment_status TEXT DEFAULT 'pending_postpay' CHECK (payment_status IN ('pending_postpay', 'paid', 'cancelled', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. INDICES PARA BÚSQUEDA RÁPIDA
CREATE INDEX IF NOT EXISTS idx_beds_room_id ON public.beds(room_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON public.beds(status);
CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON public.bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_ticket_code ON public.bookings(ticket_code);

-- 7. FUNCIÓN TRANSACCIONAL ATÓMICA PARA EVITAR SOBRE-RESERVA (CONCURRENCIA SAFE)
CREATE OR REPLACE FUNCTION public.book_bed_atomic(
  p_event_id UUID,
  p_bed_id UUID,
  p_booking_type TEXT,
  p_partner1 TEXT,
  p_partner2 TEXT,
  p_phone TEXT,
  p_payment_method TEXT,
  p_price NUMERIC,
  p_ticket_code TEXT
) RETURNS UUID AS $$
DECLARE
  v_booking_id UUID;
  v_current_status TEXT;
BEGIN
  -- Si es reserva con cama, verificar y bloquear la cama atómicamente
  IF p_booking_type = 'with_bed' THEN
    SELECT status INTO v_current_status 
    FROM public.beds 
    WHERE id = p_bed_id 
    FOR UPDATE; -- Bloqueo de fila para transacciones concurrentes

    IF v_current_status IS NULL THEN
      RAISE EXCEPTION 'La cama especificada no existe.';
    END IF;

    IF v_current_status != 'available' THEN
      RAISE EXCEPTION 'La cama seleccionada ya ha sido reservada por otro usuario.';
    END IF;

    -- Cambiar estado de la cama a reservada
    UPDATE public.beds 
    SET status = 'reserved' 
    WHERE id = p_bed_id;
  END IF;

  -- Crear la reserva
  INSERT INTO public.bookings (
    ticket_code, event_id, bed_id, booking_type, 
    partner1_name, partner2_name, whatsapp_phone, 
    price_total, payment_method, payment_status
  ) VALUES (
    p_ticket_code, p_event_id, p_bed_id, p_booking_type,
    p_partner1, p_partner2, p_phone,
    p_price, p_payment_method, 'pending_postpay'
  ) RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql;

-- 8. HABILITAR PUBLIC SUBSCRIPTIONS EN REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.beds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
