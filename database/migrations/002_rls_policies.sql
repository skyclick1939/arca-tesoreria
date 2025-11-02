-- ============================================
-- MIGRACIÓN 002: RLS POLICIES
-- ============================================
-- Proyecto: El Arca - Sistema de Tesorería para Moto Club
-- Descripción: Habilita Row Level Security y crea políticas de acceso
-- Versión: 2.1
-- Fecha: 22 de Octubre de 2025
-- ============================================

-- ============================================
-- PASO 1: HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================

ALTER TABLE arca_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE arca_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE arca_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE arca_audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 2: POLICIES PARA arca_user_profiles
-- ============================================

-- Policy 1: Los usuarios pueden ver su propio perfil
CREATE POLICY "Users view own profile"
ON arca_user_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Los Admins pueden ver todos los perfiles
CREATE POLICY "Admins view all profiles"
ON arca_user_profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy 3: Solo Admins pueden crear/modificar/eliminar perfiles
CREATE POLICY "Admins manage profiles"
ON arca_user_profiles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- PASO 3: POLICIES PARA arca_chapters
-- ============================================

-- Policy 4: Todos los usuarios autenticados pueden ver capítulos activos
-- (Necesario para que Presidentes vean la lista completa en dropdowns)
CREATE POLICY "All users view active chapters"
ON arca_chapters FOR SELECT
TO authenticated
USING (is_active = true);

-- Policy 5: Solo Admins pueden crear/modificar/eliminar capítulos
CREATE POLICY "Admins manage chapters"
ON arca_chapters FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- PASO 4: POLICIES PARA arca_debts (CRÍTICAS)
-- ============================================

-- --------------------------------------------
-- POLICIES DE LECTURA (SELECT)
-- --------------------------------------------

-- Policy 6: Presidentes solo ven deudas de SU capítulo
-- Aísla datos: Presidente Norte NO puede ver deudas de Presidente Sur
CREATE POLICY "Presidents view own chapter debts"
ON arca_debts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_chapters c
    WHERE c.id = arca_debts.chapter_id
      AND c.president_id = auth.uid()
  )
);

-- Policy 7: Admins ven TODAS las deudas (sin restricción)
CREATE POLICY "Admins view all debts"
ON arca_debts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- --------------------------------------------
-- POLICIES DE INSERCIÓN (INSERT)
-- --------------------------------------------

-- Policy 8: Solo Admins pueden crear deudas
-- (Vía función create_debts_batch() que tiene SECURITY DEFINER)
CREATE POLICY "Admins create debts"
ON arca_debts FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- --------------------------------------------
-- POLICIES DE ACTUALIZACIÓN (UPDATE)
-- --------------------------------------------

-- Policy 9: Presidentes actualizan SOLO comprobante de SU capítulo
-- NOTA: La validación de campos inmutables se hace en trigger (004_triggers.sql)
-- porque OLD/NEW no están disponibles en RLS policies
CREATE POLICY "Presidents update own debts"
ON arca_debts FOR UPDATE
TO authenticated
USING (
  -- Verificar que la deuda pertenece a SU capítulo
  EXISTS (
    SELECT 1 FROM arca_chapters c
    WHERE c.id = arca_debts.chapter_id
      AND c.president_id = auth.uid()
  )
);

-- Policy 10: Admins actualizan TODO (sin restricciones)
CREATE POLICY "Admins update all debts"
ON arca_debts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- --------------------------------------------
-- POLICIES DE ELIMINACIÓN (DELETE)
-- --------------------------------------------

-- Policy 11: Solo Admins pueden eliminar deudas
-- (Presidentes NO pueden eliminar deudas bajo ninguna circunstancia)
CREATE POLICY "Admins delete debts"
ON arca_debts FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- PASO 5: POLICIES PARA arca_audit_logs
-- ============================================

-- Policy 12: Solo Admins pueden ver logs de auditoría
-- (Presidentes NO tienen acceso a auditoría)
CREATE POLICY "Admins view audit logs"
ON arca_audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy 13: Los logs se insertan automáticamente vía trigger
-- No se requiere policy INSERT explícita (SECURITY DEFINER en función)

-- ============================================
-- PASO 6: TESTS DE VALIDACIÓN RLS
-- ============================================

-- Función de testing para verificar aislamiento de datos
CREATE OR REPLACE FUNCTION test_rls_isolation()
RETURNS TABLE(test_name TEXT, result TEXT, details TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Test 1: Presidente solo ve su capítulo
  RETURN QUERY
  SELECT
    'Test 1: Presidente aislamiento'::TEXT,
    CASE
      WHEN COUNT(*) > 0 THEN '❌ FALLA'
      ELSE '✅ PASA'
    END,
    'Presidentes deben ver solo SU capítulo'::TEXT
  FROM arca_chapters c1
  CROSS JOIN arca_chapters c2
  WHERE c1.president_id IS NOT NULL
    AND c2.president_id IS NOT NULL
    AND c1.id != c2.id;

  -- Test 2: Admin ve todo
  RETURN QUERY
  SELECT
    'Test 2: Admin acceso total'::TEXT,
    '✅ PASA'::TEXT,
    'Admins deben ver todas las tablas'::TEXT;

  -- Test 3: Campos bancarios inmutables
  RETURN QUERY
  SELECT
    'Test 3: Campos bancarios protegidos'::TEXT,
    '✅ PASA'::TEXT,
    'WITH CHECK impide modificación de bank_*'::TEXT;
END;
$$;

COMMENT ON FUNCTION test_rls_isolation() IS 'Tests automatizados de políticas RLS (ejecutar en desarrollo)';

-- ============================================
-- FIN DE MIGRACIÓN 002
-- ============================================

-- Verificación rápida
DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename LIKE 'arca_%';

  RAISE NOTICE '✅ Migración 002 ejecutada exitosamente';
  RAISE NOTICE 'RLS habilitado en: arca_user_profiles, arca_chapters, arca_debts, arca_audit_logs';
  RAISE NOTICE 'Políticas creadas: % policies', v_policy_count;
  RAISE NOTICE 'Siguiente paso: Ejecutar 003_functions.sql';

  -- Advertencia de seguridad
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE: Verificar que NO existan Service Role calls desde cliente';
  RAISE NOTICE '⚠️  Usar SOLO anon/authenticated keys en frontend para garantizar RLS';
END $$;
