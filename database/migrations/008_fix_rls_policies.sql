-- ============================================
-- MIGRACIÓN 008: CORRECCIÓN FINAL DE POLÍTICAS RLS
-- ============================================
-- Proyecto: El Arca - Sistema de Tesorería para Moto Club
-- Problema: Error 42501 "permission denied for table arca_user_profiles"
-- Causa: Políticas RLS bloqueando acceso incluso para usuarios autenticados
-- Diagnóstico: La política "Users view own profile" no funciona
-- Solución: Recrear todas las políticas RLS con sintaxis correcta
-- Versión: 2.3
-- Fecha: 23 de Octubre de 2025
-- ============================================

-- ⚠️ IMPORTANTE: Ejecutar desde SQL Editor de Supabase Dashboard

-- ============================================
-- DIAGNÓSTICO INICIAL
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 INICIANDO MIGRACIÓN 008...';
  RAISE NOTICE '';
END $$;

-- ============================================
-- PASO 1: VERIFICAR Y HABILITAR RLS
-- ============================================

DO $$
DECLARE
  v_rls_enabled BOOLEAN;
BEGIN
  RAISE NOTICE '📋 PASO 1: Verificando RLS...';

  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'arca_user_profiles' AND relkind = 'r';

  IF v_rls_enabled THEN
    RAISE NOTICE '   ✅ RLS ya está habilitado';
  ELSE
    RAISE NOTICE '   ⚠️  RLS está deshabilitado, habilitando...';
    ALTER TABLE arca_user_profiles ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '   ✅ RLS habilitado';
  END IF;
END $$;

-- ============================================
-- PASO 2: LISTAR POLÍTICAS EXISTENTES
-- ============================================

DO $$
DECLARE
  v_policy RECORD;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 2: Listando políticas existentes...';

  FOR v_policy IN
    SELECT policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'arca_user_profiles'
    ORDER BY policyname
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '   %: % (%) ', v_count, v_policy.policyname, v_policy.cmd;
  END LOOP;

  IF v_count = 0 THEN
    RAISE NOTICE '   ⚠️  NO hay políticas RLS (esto explica el error 42501)';
  ELSE
    RAISE NOTICE '   ✅ Se encontraron % política(s)', v_count;
  END IF;
END $$;

-- ============================================
-- PASO 3: ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 3: Eliminando políticas existentes...';

  -- Eliminar política de usuarios ven su propio perfil
  DROP POLICY IF EXISTS "Users view own profile" ON arca_user_profiles;
  RAISE NOTICE '   ✅ Eliminada: Users view own profile';

  -- Eliminar políticas de admin (si existen de migración 007)
  DROP POLICY IF EXISTS "Admins view all profiles" ON arca_user_profiles;
  RAISE NOTICE '   ✅ Eliminada: Admins view all profiles';

  DROP POLICY IF EXISTS "Admins manage profiles" ON arca_user_profiles;
  RAISE NOTICE '   ✅ Eliminada: Admins manage profiles';

  -- Eliminar cualquier otra política que pueda existir
  DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON arca_user_profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON arca_user_profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON arca_user_profiles;

  RAISE NOTICE '   ✅ Todas las políticas eliminadas';
END $$;

-- ============================================
-- PASO 4: VERIFICAR/CREAR FUNCIÓN is_admin()
-- ============================================

DO $$
DECLARE
  v_function_exists BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 4: Verificando función is_admin()...';

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'is_admin'
  ) INTO v_function_exists;

  IF v_function_exists THEN
    RAISE NOTICE '   ✅ Función is_admin() ya existe';
  ELSE
    RAISE NOTICE '   ⚠️  Función is_admin() NO existe, creando...';
  END IF;
END $$;

-- Crear/Recrear función is_admin() con SECURITY DEFINER
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Dar permisos de ejecución a todos los roles autenticados
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;

-- ============================================
-- PASO 5: CREAR POLÍTICAS RLS CORRECTAS
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 5: Creando políticas RLS correctas...';
END $$;

-- Política 1: Usuarios autenticados pueden ver su propio perfil
CREATE POLICY "Users view own profile"
ON arca_user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Política 2: Admins pueden ver TODOS los perfiles
CREATE POLICY "Admins view all profiles"
ON arca_user_profiles
FOR SELECT
TO authenticated
USING (is_admin());

-- Política 3: Admins pueden modificar TODOS los perfiles
CREATE POLICY "Admins manage profiles"
ON arca_user_profiles
FOR ALL
TO authenticated
USING (is_admin());

DO $$
BEGIN
  RAISE NOTICE '   ✅ Política 1: Users view own profile (SELECT)';
  RAISE NOTICE '   ✅ Política 2: Admins view all profiles (SELECT)';
  RAISE NOTICE '   ✅ Política 3: Admins manage profiles (ALL)';
END $$;

-- ============================================
-- PASO 6: VALIDACIÓN FINAL
-- ============================================

DO $$
DECLARE
  v_rls_enabled BOOLEAN;
  v_policy_count INTEGER;
  v_function_exists BOOLEAN;
  v_admin_count INTEGER;
  v_total_profiles INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 6: Validación final...';
  RAISE NOTICE '';

  -- Verificar RLS
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'arca_user_profiles' AND relkind = 'r';

  -- Contar políticas
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'arca_user_profiles';

  -- Verificar función
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_admin'
  ) INTO v_function_exists;

  -- Contar perfiles admin y totales
  SELECT COUNT(*) FILTER (WHERE role = 'admin') INTO v_admin_count
  FROM arca_user_profiles;

  SELECT COUNT(*) INTO v_total_profiles
  FROM arca_user_profiles;

  -- Mostrar resultados
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '✅ MIGRACIÓN 008 EJECUTADA EXITOSAMENTE';
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Estado de la base de datos:';
  RAISE NOTICE '   - RLS habilitado: %', v_rls_enabled;
  RAISE NOTICE '   - Políticas activas: % (esperadas: 3)', v_policy_count;
  RAISE NOTICE '   - Función is_admin(): %', CASE WHEN v_function_exists THEN 'Existe' ELSE 'ERROR' END;
  RAISE NOTICE '   - Perfiles totales: %', v_total_profiles;
  RAISE NOTICE '   - Admins: %', v_admin_count;
  RAISE NOTICE '';

  IF v_policy_count <> 3 THEN
    RAISE WARNING 'ADVERTENCIA: Se esperaban 3 políticas pero hay %', v_policy_count;
  END IF;

  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'ERROR: Función is_admin() no fue creada correctamente';
  END IF;

  IF NOT v_rls_enabled THEN
    RAISE EXCEPTION 'ERROR: RLS no está habilitado en arca_user_profiles';
  END IF;

  RAISE NOTICE '📋 Políticas RLS creadas:';
  RAISE NOTICE '   1. Users view own profile';
  RAISE NOTICE '      - Permite: Usuarios autenticados ven SU PROPIO perfil';
  RAISE NOTICE '      - Condición: auth.uid() = user_id';
  RAISE NOTICE '';
  RAISE NOTICE '   2. Admins view all profiles';
  RAISE NOTICE '      - Permite: Admins ven TODOS los perfiles';
  RAISE NOTICE '      - Condición: is_admin() = true';
  RAISE NOTICE '';
  RAISE NOTICE '   3. Admins manage profiles';
  RAISE NOTICE '      - Permite: Admins pueden INSERT/UPDATE/DELETE cualquier perfil';
  RAISE NOTICE '      - Condición: is_admin() = true';
  RAISE NOTICE '';
  RAISE NOTICE '🔑 Credenciales de prueba:';
  RAISE NOTICE '   - Admin: admin@arca.local / admin123';
  RAISE NOTICE '   - Presidente: pres.vallarta@arca.local / pres1234';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Próximo paso: Probar login en http://localhost:3000';
  RAISE NOTICE '';
END $$;

-- ============================================
-- FIN DE MIGRACIÓN 008
-- ============================================
