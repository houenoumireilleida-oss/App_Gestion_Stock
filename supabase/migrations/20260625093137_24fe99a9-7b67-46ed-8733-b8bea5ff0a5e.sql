
-- Movement type enum
CREATE TYPE public.movement_type AS ENUM ('in', 'out', 'adjustment', 'transfer');

-- Warehouses
CREATE TABLE public.warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read warehouses" ON public.warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write warehouses" ON public.warehouses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Products
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
  image_url TEXT,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_name ON public.products(name);

-- Stock levels (one row per product x warehouse)
CREATE TABLE public.stock_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, warehouse_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_levels TO authenticated;
GRANT ALL ON public.stock_levels TO service_role;
ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read stock" ON public.stock_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write stock" ON public.stock_levels FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Stock movements (immutable log)
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  destination_warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  type public.movement_type NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT,
  reference TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read movements" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_movements_product ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX idx_movements_created ON public.stock_movements(created_at DESC);

-- Trigger to update stock_levels when movement inserted
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta INTEGER;
BEGIN
  IF NEW.type = 'in' THEN
    delta := NEW.quantity;
  ELSIF NEW.type = 'out' THEN
    delta := -NEW.quantity;
  ELSIF NEW.type = 'adjustment' THEN
    -- adjustment sets the quantity directly (positive=set to value, but simpler: treat as delta)
    delta := NEW.quantity;
  ELSIF NEW.type = 'transfer' THEN
    delta := -NEW.quantity;
  END IF;

  INSERT INTO public.stock_levels (product_id, warehouse_id, quantity, updated_at)
  VALUES (NEW.product_id, NEW.warehouse_id, delta, now())
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET quantity = stock_levels.quantity + delta, updated_at = now();

  IF NEW.type = 'transfer' AND NEW.destination_warehouse_id IS NOT NULL THEN
    INSERT INTO public.stock_levels (product_id, warehouse_id, quantity, updated_at)
    VALUES (NEW.product_id, NEW.destination_warehouse_id, NEW.quantity, now())
    ON CONFLICT (product_id, warehouse_id)
    DO UPDATE SET quantity = stock_levels.quantity + NEW.quantity, updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_stock_movement
AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- updated_at trigger for products
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
