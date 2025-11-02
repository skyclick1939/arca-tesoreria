-- ============================================
-- MIGRACIÓN 009: CREAR PERFILES FALTANTES Y ARREGLAR TRIGGER
-- ============================================
-- Proyecto: El Arca - Sistema de Tesorería para Moto Club
-- Problema: arca_user_profiles está VACÍA (trigger no funcionó)
-- Causa: Usuarios creados ANTES del trigger o RLS bloqueó inserción
-- Solución: Crear perfiles para usuarios existentes + arreglar trigger
-- Versión: 2.4
-- Fecha: 23 de Octubre de 2025
-- ============================================

-- ⚠️ IMPORTANTE: Ejecutar desde SQL Editor de Supabase Dashboard
-- ⚠️ Esta migración es CRÍTICA para que el sistema funcione

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 INICIANDO MIGRACIÓN 009...';
  RAISE NOTICE '   Problema: arca_user_profiles está vacía';
  RAISE NOTICE '   Solución: Crear perfiles para usuarios existentes';
  RAISE NOTICE '';
END $$;

-- ============================================
-- PASO 1: VERIFICAR ESTADO ACTUAL
-- ============================================

DO $$
DECLARE
  v_users_count INTEGER;
  v_profiles_count INTEGER;
  v_missing_count INTEGER;
BEGIN
  RAISE NOTICE '📋 PASO 1: Verificando estado actual...';
  RAISE NOTICE '';

  -- Contar usuarios en auth.users
  SELECT COUNT(*) INTO v_users_count
  FROM auth.users;

  -- Contar perfiles en arca_user_profiles
  SELECT COUNT(*) INTO v_profiles_count
  FROM arca_user_profiles;

  -- Calcular faltantes
  v_missing_count := v_users_count - v_profiles_count;

  RAISE NOTICE '   - Usuarios en auth.users: %', v_users_count;
  RAISE NOTICE '   - Perfiles en arca_user_profiles: %', v_profiles_count;
  RAISE NOTICE '   - Perfiles faltantes: %', v_missing_count;
  RAISE NOTICE '';

  IF v_missing_count = 0 THEN
    RAISE NOTICE '   ✅ Todos los usuarios tienen perfil';
  ELSE
    RAISE NOTICE '   ⚠️  Hay % usuario(s) sin perfil', v_missing_count;
  END IF;
END $$;

-- ============================================
-- PASO 2: CREAR PERFILES FALTANTES
-- ============================================

DO $$
DECLARE
  v_user RECORD;
  v_created_count INTEGER := 0;
  v_admin_email TEXT := 'admin@arca.local';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 2: Creando perfiles faltantes...';
  RAISE NOTICE '';

  -- Iterar sobre usuarios que NO tienen perfil
  FOR v_user IN
    SELECT
      u.id,
      u.email,
      u.created_at,
      COALESCE(u.raw_user_meta_data->>'full_name', u.email) as full_name
    FROM auth.users u
    LEFT JOIN arca_user_profiles p ON p.user_id = u.id
    WHERE p.user_id IS NULL
    ORDER BY u.created_at ASC
  LOOP
    -- Insertar perfil
    INSERT INTO arca_user_profiles (user_id, role, full_name)
    VALUES (
      v_user.id,
      CASE
        WHEN v_user.email = v_admin_email THEN 'admin'::user_role
        ELSE 'president'::user_role
      END,
      v_user.full_name
    );

    v_created_count := v_created_count + 1;

    RAISE NOTICE '   ✅ Perfil creado para: % (rol: %)',
      v_user.email,
      CASE WHEN v_user.email = v_admin_email THEN 'admin' ELSE 'president' END;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '   📊 Total de perfiles creados: %', v_created_count;
  RAISE NOTICE '';

  IF v_created_count = 0 THEN
    RAISE NOTICE '   ℹ️  No había perfiles faltantes';
  END IF;
END $$;

-- ============================================
-- PASO 3: VERIFICAR Y ARREGLAR TRIGGER
-- ============================================

DO $$
DECLARE
  v_trigger_exists BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 3: Verificando trigger on_auth_user_created...';
  RAISE NOTICE '';

  -- Verificar si el trigger existe
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) INTO v_trigger_exists;

  IF v_trigger_exists THEN
    RAISE NOTICE '   ✅ Trigger on_auth_user_created existe';
  ELSE
    RAISE NOTICE '   ❌ Trigger on_auth_user_created NO existe';
    RAISE NOTICE '   ⚠️  Ejecuta la migración 004_triggers.sql';
  END IF;
END $$;

-- Recrear trigger con configuración mejorada
-- NOTA: Usar search_path = public (no vacío) para evitar errores

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insertar perfil automáticamente
  INSERT INTO public.arca_user_profiles (user_id, role, full_name)
  VALUES (
    NEW.id,
    'president'::user_role, -- Por defecto presidente (cambiar manualmente a admin si es necesario)
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (user_id) DO NOTHING; -- Evitar error si ya existe

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log del error pero NO fallar el registro del usuario
    RAISE WARNING 'Error al crear perfil automático para user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS 'Crea perfil en arca_user_profiles al registrar usuario (con manejo de errores)';

-- Recrear trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '   ✅ Trigger on_auth_user_created recreado con mejoras:';
  RAISE NOTICE '      - search_path = public (en vez de vacío)';
  RAISE NOTICE '      - ON CONFLICT DO NOTHING (evita errores de duplicados)';
  RAISE NOTICE '      - EXCEPTION handler (no falla registro si hay error)';
  RAISE NOTICE '';
END $$;

-- ============================================
-- PASO 4: VALIDACIÓN FINAL
-- ============================================

DO $$
DECLARE
  v_users_count INTEGER;
  v_profiles_count INTEGER;
  v_admin_count INTEGER;
  v_president_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 4: Validación final...';
  RAISE NOTICE '';

  -- Contar usuarios y perfiles
  SELECT COUNT(*) INTO v_users_count FROM auth.users;
  SELECT COUNT(*) INTO v_profiles_count FROM arca_user_profiles;

  -- Contar por rol
  SELECT COUNT(*) INTO v_admin_count
  FROM arca_user_profiles WHERE role = 'admin';

  SELECT COUNT(*) INTO v_president_count
  FROM arca_user_profiles WHERE role = 'president';

  -- Validar que coincidan
  IF v_users_count != v_profiles_count THEN
    RAISE EXCEPTION 'ERROR: Usuarios (%) != Perfiles (%) - Algo falló', v_users_count, v_profiles_count;
  END IF;

  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '✅ MIGRACIÓN 009 EJECUTADA EXITOSAMENTE';
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Estado de la base de datos:';
  RAISE NOTICE '   - Usuarios en auth.users: %', v_users_count;
  RAISE NOTICE '   - Perfiles en arca_user_profiles: %', v_profiles_count;
  RAISE NOTICE '   - Admins: %', v_admin_count;
  RAISE NOTICE '   - Presidentes: %', v_president_count;
  RAISE NOTICE '';
  RAISE NOTICE '🔑 Credenciales de prueba:';
  RAISE NOTICE '   - Admin: admin@arca.local / admin123';
  RAISE NOTICE '   - Presidente: pres.vallarta@arca.local / pres1234';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Próximo paso:';
  RAISE NOTICE '   1. Ejecutar migración 008 (si no lo has hecho)';
  RAISE NOTICE '   2. Ejecutar: node diagnostico_simple.js';
  RAISE NOTICE '   3. Probar login en http://localhost:3000';
  RAISE NOTICE '';
END $$;

-- ============================================
-- PASO 5: LISTAR PERFILES CREADOS
-- ============================================

DO $$
DECLARE
  v_profile RECORD;
  v_counter INTEGER := 0;
BEGIN
  RAISE NOTICE '📋 PERFILES EXISTENTES EN arca_user_profiles:';
  RAISE NOTICE '';

  FOR v_profile IN
    SELECT
      p.user_id,
      p.role,
      p.full_name,
      u.email,
      p.created_at
    FROM arca_user_profiles p
    JOIN auth.users u ON u.id = p.user_id
    ORDER BY p.created_at ASC
  LOOP
    v_counter := v_counter + 1;
    RAISE NOTICE '   %. % (%)',
      v_counter,
      v_profile.email,
      v_profile.role;
    RAISE NOTICE '      - Nombre: %', v_profile.full_name;
    RAISE NOTICE '      - User ID: %', SUBSTRING(v_profile.user_id::TEXT FROM 1 FOR 8) || '...';
    RAISE NOTICE '      - Creado: %', v_profile.created_at;
    RAISE NOTICE '';
  END LOOP;

  IF v_counter = 0 THEN
    RAISE WARNING 'NO hay perfiles en arca_user_profiles (esto NO debería pasar)';
  END IF;
END $$;

-- ============================================
-- FIN DE MIGRACIÓN 009
-- ============================================
