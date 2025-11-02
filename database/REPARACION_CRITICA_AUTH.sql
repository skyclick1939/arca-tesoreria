-- ============================================
-- REPARACIÓN CRÍTICA: AUTH CORROMPIDO
-- ============================================
-- Fecha: 23 de Octubre de 2025
-- Problema: Migración 007 modificó directamente auth.users rompiendo el sistema
-- Causa: UPDATE a auth.users.encrypted_password bypaseó mecanismos de Supabase Auth
-- Solución: Eliminar usuarios afectados y recrearlos desde el Dashboard
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '⚠️  REPARACIÓN CRÍTICA: AUTH CORROMPIDO';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'PROBLEMA DETECTADO:';
  RAISE NOTICE '  La migración 007 modificó directamente auth.users.encrypted_password';
  RAISE NOTICE '  Esto corrompió el sistema de autenticación de Supabase.';
  RAISE NOTICE '';
  RAISE NOTICE 'SÍNTOMAS:';
  RAISE NOTICE '  - Login de presidentes falla con error 500';
  RAISE NOTICE '  - "Database error querying schema"';
  RAISE NOTICE '  - Admin puede funcionar parcialmente';
  RAISE NOTICE '';
  RAISE NOTICE 'SOLUCIÓN:';
  RAISE NOTICE '  1. Deshabilitar RLS temporalmente';
  RAISE NOTICE '  2. Limpiar perfiles afectados';
  RAISE NOTICE '  3. Eliminar usuarios corrompidos de auth.users (SOLO vía Dashboard)';
  RAISE NOTICE '  4. Recrear usuarios con contraseñas correctas';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE: Este script prepara la limpieza.';
  RAISE NOTICE '   Los usuarios deben recrearse MANUALMENTE desde Supabase Dashboard.';
  RAISE NOTICE '';
END $$;

-- ============================================
-- PASO 1: DESHABILITAR RLS TEMPORALMENTE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '📋 PASO 1: Deshabilitando RLS temporalmente...';
END $$;

ALTER TABLE arca_user_profiles DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE '   ✅ RLS deshabilitado';
END $$;

-- ============================================
-- PASO 2: LISTAR USUARIOS CORROMPIDOS
-- ============================================

DO $$
DECLARE
  v_user RECORD;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 2: Identificando usuarios corrompidos...';
  RAISE NOTICE '';
  RAISE NOTICE '   Usuarios que fueron modificados en migración 007:';
  RAISE NOTICE '';

  FOR v_user IN
    SELECT id, email, created_at
    FROM auth.users
    WHERE email LIKE 'pres.%@arca.local'
    ORDER BY email
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '   % %. % (ID: %)',
      '❌',
      v_count,
      v_user.email,
      v_user.id;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '   Total de usuarios afectados: %', v_count;
  RAISE NOTICE '';
END $$;

-- ============================================
-- PASO 3: LIMPIAR PERFILES DE USUARIOS CORROMPIDOS
-- ============================================

DO $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  RAISE NOTICE '📋 PASO 3: Eliminando perfiles de usuarios corrompidos...';

  -- Eliminar perfiles de presidentes (los recrearemos)
  DELETE FROM arca_user_profiles
  WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE 'pres.%@arca.local'
  );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RAISE NOTICE '   ✅ Perfiles eliminados: %', v_deleted_count;
  RAISE NOTICE '';
END $$;

-- ============================================
-- PASO 4: INSTRUCCIONES MANUALES
-- ============================================

DO $$
DECLARE
  v_user RECORD;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '📋 PASO 4: INSTRUCCIONES MANUALES (CRÍTICO)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NO se pueden eliminar usuarios desde SQL de forma segura.';
  RAISE NOTICE '   Debes hacerlo desde Supabase Dashboard.';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'ACCIONES REQUERIDAS EN SUPABASE DASHBOARD:';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '1. Ir a: Authentication > Users';
  RAISE NOTICE '';
  RAISE NOTICE '2. ELIMINAR los siguientes usuarios (botón "..." > Delete):';
  RAISE NOTICE '';

  FOR v_user IN
    SELECT id, email
    FROM auth.users
    WHERE email LIKE 'pres.%@arca.local'
    ORDER BY email
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '   [❌ ELIMINAR] %', v_user.email;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '3. RECREAR usuarios con contraseñas seguras:';
  RAISE NOTICE '';
  RAISE NOTICE '   Desde Authentication > Users > "Add user" (botón verde):';
  RAISE NOTICE '';

  FOR v_user IN
    SELECT email
    FROM auth.users
    WHERE email LIKE 'pres.%@arca.local'
    ORDER BY email
  LOOP
    RAISE NOTICE '   [✅ CREAR] Email: %', v_user.email;
    RAISE NOTICE '             Password: pres1234';
    RAISE NOTICE '             Auto-confirm: ✓';
    RAISE NOTICE '';
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '4. VERIFICAR que cada usuario nuevo tenga su perfil creado';
  RAISE NOTICE '   (el trigger on_auth_user_created debería hacerlo automáticamente)';
  RAISE NOTICE '';
  RAISE NOTICE '5. EJECUTAR el script de verificación: database/VERIFICAR_REPARACION.sql';
  RAISE NOTICE '';
END $$;

-- ============================================
-- PASO 5: RE-HABILITAR RLS
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '📋 PASO 5: Re-habilitando RLS...';
END $$;

ALTER TABLE arca_user_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE '   ✅ RLS re-habilitado';
  RAISE NOTICE '';
END $$;

-- ============================================
-- RESUMEN FINAL
-- ============================================

DO $$
DECLARE
  v_profiles_count INTEGER;
  v_users_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_profiles_count FROM arca_user_profiles;
  SELECT COUNT(*) INTO v_users_count FROM auth.users;

  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '📊 ESTADO ACTUAL:';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '   Usuarios en auth.users: %', v_users_count;
  RAISE NOTICE '   Perfiles en arca_user_profiles: %', v_profiles_count;
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Los perfiles de presidentes fueron eliminados.';
  RAISE NOTICE '   Deben recrearse automáticamente al crear los usuarios en Dashboard.';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '🎯 PRÓXIMOS PASOS OBLIGATORIOS:';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '1. Abrir Supabase Dashboard';
  RAISE NOTICE '2. Ir a: https://supabase.com/dashboard/project/qjswicjxwsbwnxrrowsi/auth/users';
  RAISE NOTICE '3. Eliminar usuarios pres.* (ver lista arriba)';
  RAISE NOTICE '4. Recrear usuarios con "Add user"';
  RAISE NOTICE '5. Ejecutar: database/VERIFICAR_REPARACION.sql';
  RAISE NOTICE '6. Probar login en http://localhost:3000';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  ADVERTENCIA CRÍTICA:';
  RAISE NOTICE '   NUNCA modifiques directamente auth.users.encrypted_password';
  RAISE NOTICE '   Usa siempre el Dashboard o el Auth API para cambiar contraseñas.';
  RAISE NOTICE '';
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
