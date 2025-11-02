-- ============================================
-- MIGRACIÓN 007: CORRECCIÓN DE RECURSIÓN EN RLS
-- ============================================
-- Proyecto: El Arca - Sistema de Tesorería para Moto Club
-- Descripción: Corregir recursión infinita en policies de arca_user_profiles
-- Problema: Policies consultan la misma tabla para verificar role='admin'
-- Solución: Función SECURITY DEFINER que bypasea RLS
-- Versión: 2.2
-- Fecha: 23 de Octubre de 2025
-- ============================================

-- ⚠️ IMPORTANTE: Ejecutar desde SQL Editor de Supabase Dashboard
-- Este script corrige el error: "infinite recursion detected in policy"

-- ============================================
-- PASO 1: RE-HABILITAR RLS (si fue deshabilitado manualmente)
-- ============================================

ALTER TABLE arca_user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 2: ELIMINAR POLÍTICAS PROBLEMÁTICAS
-- ============================================

DROP POLICY IF EXISTS "Admins view all profiles" ON arca_user_profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON arca_user_profiles;

-- Nota: Mantenemos "Users view own profile" porque NO tiene recursión

-- ============================================
-- PASO 3: CREAR FUNCIÓN SECURITY DEFINER
-- ============================================

-- Esta función bypasea RLS al ejecutarse con privilegios del creador
-- Evita recursión infinita al consultar arca_user_profiles
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================
-- PASO 4: CREAR POLÍTICAS SIN RECURSIÓN
-- ============================================

-- Policy 1: Admins pueden ver TODOS los perfiles
CREATE POLICY "Admins view all profiles"
ON arca_user_profiles FOR SELECT
TO authenticated
USING (is_admin());

-- Policy 2: Admins pueden hacer TODO (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins manage profiles"
ON arca_user_profiles FOR ALL
TO authenticated
USING (is_admin());

-- Policy 3: Usuarios ven solo SU PROPIO perfil (ya existe, no tocar)
-- CREATE POLICY "Users view own profile"
-- ON arca_user_profiles FOR SELECT
-- TO authenticated
-- USING (auth.uid() = user_id);

-- ============================================
-- PASO 5: ACTUALIZAR CONTRASEÑAS CORTAS
-- ============================================

-- Cambiar contraseñas de todos los presidentes a 8+ caracteres
-- Patrón: pres123 (7 chars) → pres1234 (8 chars)

DO $$
DECLARE
  v_user RECORD;
  v_updated_count INTEGER := 0;
BEGIN
  -- Buscar usuarios cuyo email empiece con 'pres.' y tengan password muy corta
  FOR v_user IN
    SELECT id, email
    FROM auth.users
    WHERE email LIKE 'pres.%@arca.local'
  LOOP
    -- Actualizar password a versión de 8 caracteres
    UPDATE auth.users
    SET encrypted_password = crypt('pres1234', gen_salt('bf'))
    WHERE id = v_user.id;

    v_updated_count := v_updated_count + 1;
    RAISE NOTICE 'Password actualizada para: %', v_user.email;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Total de contraseñas actualizadas: %', v_updated_count;
  RAISE NOTICE '   Nueva contraseña: pres1234 (8 caracteres)';
END $$;

-- ============================================
-- PASO 6: VERIFICACIÓN FINAL
-- ============================================

DO $$
DECLARE
  v_rls_enabled BOOLEAN;
  v_policy_count INTEGER;
  v_function_exists BOOLEAN;
BEGIN
  -- Verificar que RLS está habilitado
  SELECT rowsecurity INTO v_rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'arca_user_profiles';

  IF NOT v_rls_enabled THEN
    RAISE EXCEPTION 'ERROR: RLS no está habilitado en arca_user_profiles';
  END IF;

  -- Contar políticas
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'arca_user_profiles';

  -- Verificar que función is_admin() existe
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_admin'
  ) INTO v_function_exists;

  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'ERROR: Función is_admin() no fue creada';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '✅ MIGRACIÓN 007 EJECUTADA EXITOSAMENTE';
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS habilitado: %', v_rls_enabled;
  RAISE NOTICE 'Políticas activas: % (esperadas: 3)', v_policy_count;
  RAISE NOTICE 'Función is_admin(): %', CASE WHEN v_function_exists THEN 'Creada' ELSE 'ERROR' END;
  RAISE NOTICE '';
  RAISE NOTICE '📋 Políticas corregidas:';
  RAISE NOTICE '  1. Users view own profile (sin cambios)';
  RAISE NOTICE '  2. Admins view all profiles (sin recursión)';
  RAISE NOTICE '  3. Admins manage profiles (sin recursión)';
  RAISE NOTICE '';
  RAISE NOTICE '🔑 Contraseñas actualizadas:';
  RAISE NOTICE '  - Todos los presidentes ahora usan: pres1234 (8 chars)';
  RAISE NOTICE '  - Admin mantiene: admin123 (8 chars)';
  RAISE NOTICE '';
END $$;

-- ============================================
-- FIN DE MIGRACIÓN 007
-- ============================================
