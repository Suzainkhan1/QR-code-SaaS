-- Supabase Row Level Security (RLS) Lockdown Script
-- Enables RLS on all public tables to prevent unauthorized exposure via Supabase PostgREST public REST API (anon key).
-- Note: Prisma connects using standard Postgres role with BYPASS RLS permissions, so application queries will NOT be affected.

ALTER TABLE IF EXISTS "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Restaurant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Table" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "TableSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "MenuCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "MenuItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "MenuItemIngredient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "InventoryItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ServiceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ActivityLog" ENABLE ROW LEVEL SECURITY;

-- Verification query: run in SQL Editor to confirm RLS state
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
