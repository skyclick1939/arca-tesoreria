-- ============================================
-- DIAGNÓSTICO PROFUNDO: ERROR 500 EN LOGIN DE PRESIDENTE
-- ============================================
-- Fecha: 23 de Octubre de 2025
-- Problema: Admin puede login, Presidente NO (error 500)
-- Error: "Database error querying schema" en POST /auth/v1/token
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '🔍 DIAGNÓSTICO COMPLETO: ERROR 500 PRESIDENTE';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ============================================
-- 1. VERIFICAR USUARIOS EN auth.users
-- ============================================

DO $$
DECLARE
  v_user RECORD;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '📋 1. USUARIOS EN auth.users:';
  RAISE NOTICE '';

  FOR v_user IN
    SELECT
      id,
      email,
      email_confirmed_at IS NOT NULL as email_confirmed,
      created_at,
      raw_user_meta_data
    FROM auth.users
    ORDER BY email
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '   Usuario #%: %', v_count, v_user.email;
    RAISE NOTICE '      - ID: %', v_user.id;
    RAISE NOTICE '      - Email confirmado: %', v_user.email_confirmed;
    RAISE NOTICE '      - Metadata: %', v_user.raw_user_meta_data;
    RAISE NOTICE '';
  END LOOP;

  RAISE NOTICE '   Total usuarios: %', v_count;
  RAISE NOTICE '';
END $$;

-- ============================================
-- 2. VERIFICAR PERFILES EN arca_user_profiles
-- ============================================

DO $$
DECLARE
  v_profile RECORD;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '📋 2. PERFILES EN arca_user_profiles:';
  RAISE NOTICE '';

  FOR v_profile IN
    SELECT
      p.user_id,
      p.role,
      p.full_name,
      p.created_at,
      p.updated_at,
      u.email
    FROM arca_user_profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    ORDER BY
      CASE WHEN p.role = 'admin' THEN 1 ELSE 2 END,
      u.email
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '   Perfil #%: % (rol: %)', v_count, v_profile.email, UPPER(v_profile.role::TEXT);
    RAISE NOTICE '      - user_id: %', v_profile.user_id;
    RAISE NOTICE '      - full_name: %', v_profile.full_name;
    RAISE NOTICE '      - created_at: %', v_profile.created_at;
    RAISE NOTICE '      - updated_at: %', v_profile.updated_at;

    -- Verificar si el user_id corresponde a un usuario real
    IF v_profile.email IS NULL THEN
      RAISE WARNING '      ⚠️  PERFIL HUÉRFANO: user_id no existe en auth.users!';
    END IF;
    RAISE NOTICE '';
  END LOOP;

  RAISE NOTICE '   Total perfiles: %', v_count;
  RAISE NOTICE '';
END $$;

-- ============================================
-- 3. VERIFICAR USUARIOS SIN PERFIL
-- ============================================

DO $$
DECLARE
  v_user RECORD;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '📋 3. USUARIOS SIN PERFIL (ORPHANS):';
  RAISE NOTICE '';

  FOR v_user IN
    SELECT
      u.id,
      u.email
    FROM auth.users u
    LEFT JOIN arca_user_profiles p ON p.user_id = u.id
    WHERE p.user_id IS NULL
  LOOP
    v_count := v_count + 1;
    RAISE WARNING '   ⚠️  Usuario sin perfil: %', v_user.email;
    RAISE WARNING '      - ID: %', v_user.id;
  END LOOP;

  IF v_count = 0 THEN
    RAISE NOTICE '   ✅ Todos los usuarios tienen perfil';
  ELSE
    RAISE WARNING '   ⚠️  HAY % USUARIO(S) SIN PERFIL', v_count;
  END IF;
  RAISE NOTICE '';
END $$;

-- ============================================
-- 4. VERIFICAR POLÍTICAS RLS ACTIVAS
-- ============================================

DO $$
DECLARE
  v_policy RECORD;
  v_count INTEGER := 0;
BEGIN
  RAISE NOTICE '📋 4. POLÍTICAS RLS EN arca_user_profiles:';
  RAISE NOTICE '';

  FOR v_policy IN
    SELECT
      policyname,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'arca_user_profiles'
    ORDER BY policyname
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '   Política #%: %', v_count, v_policy.policyname;
    RAISE NOTICE '      - Comando: %', v_policy.cmd;
    RAISE NOTICE '      - Condición USING: %', v_policy.qual;
    RAISE NOTICE '      - Condición WITH CHECK: %', v_policy.with_check;
    RAISE NOTICE '';
  END LOOP;

  RAISE NOTICE '   Total políticas: %', v_count;
  RAISE NOTICE '';
END $$;

-- ============================================
-- 5. VERIFICAR TRIGGER on_auth_user_created
-- ============================================

DO $$
DECLARE
  v_trigger_exists BOOLEAN;
  v_function_exists BOOLEAN;
BEGIN
  RAISE NOTICE '📋 5. VERIFICAR TRIGGER on_auth_user_created:';
  RAISE NOTICE '';

  -- Verificar trigger
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'on_auth_user_created'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) INTO v_trigger_exists;

  IF v_trigger_exists THEN
    RAISE NOTICE '   ✅ Trigger on_auth_user_created existe';
  ELSE
    RAISE WARNING '   ⚠️  Trigger on_auth_user_created NO EXISTE';
  END IF;

  -- Verificar función
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'handle_new_user'
      AND n.nspname = 'public'
  ) INTO v_function_exists;

  IF v_function_exists THEN
    RAISE NOTICE '   ✅ Función handle_new_user() existe';
  ELSE
    RAISE WARNING '   ⚠️  Función handle_new_user() NO EXISTE';
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================
-- 6. SIMULAR LOGIN DE ADMIN (FUNCIONA)
-- ============================================

DO $$
DECLARE
  v_admin_id UUID;
  v_admin_profile RECORD;
BEGIN
  RAISE NOTICE '📋 6. SIMULAR LOGIN DE ADMIN (admin@arca.local):';
  RAISE NOTICE '';

  -- Obtener ID de admin
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin@arca.local'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE WARNING '   ⚠️  Usuario admin@arca.local NO EXISTE en auth.users';
  ELSE
    RAISE NOTICE '   ✅ Usuario existe: %', v_admin_id;

    -- Intentar obtener perfil (simulando la query que hace el frontend)
    BEGIN
      SELECT * INTO v_admin_profile
      FROM arca_user_profiles
      WHERE user_id = v_admin_id;

      IF FOUND THEN
        RAISE NOTICE '   ✅ Perfil encontrado:';
        RAISE NOTICE '      - Rol: %', v_admin_profile.role;
        RAISE NOTICE '      - Nombre: %', v_admin_profile.full_name;
      ELSE
        RAISE WARNING '   ⚠️  Perfil NO encontrado (tabla vacía para este user_id)';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '   ❌ ERROR al obtener perfil:';
        RAISE WARNING '      - SQLSTATE: %', SQLSTATE;
        RAISE WARNING '      - Mensaje: %', SQLERRM;
    END;
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================
-- 7. SIMULAR LOGIN DE PRESIDENTE (FALLA)
-- ============================================

DO $$
DECLARE
  v_pres_id UUID;
  v_pres_profile RECORD;
BEGIN
  RAISE NOTICE '📋 7. SIMULAR LOGIN DE PRESIDENTE (pres.vallarta@arca.local):';
  RAISE NOTICE '';

  -- Obtener ID de presidente
  SELECT id INTO v_pres_id
  FROM auth.users
  WHERE email = 'pres.vallarta@arca.local'
  LIMIT 1;

  IF v_pres_id IS NULL THEN
    RAISE WARNING '   ⚠️  Usuario pres.vallarta@arca.local NO EXISTE en auth.users';
  ELSE
    RAISE NOTICE '   ✅ Usuario existe: %', v_pres_id;

    -- Intentar obtener perfil (simulando la query que hace el frontend)
    BEGIN
      SELECT * INTO v_pres_profile
      FROM arca_user_profiles
      WHERE user_id = v_pres_id;

      IF FOUND THEN
        RAISE NOTICE '   ✅ Perfil encontrado:';
        RAISE NOTICE '      - Rol: %', v_pres_profile.role;
        RAISE NOTICE '      - Nombre: %', v_pres_profile.full_name;
      ELSE
        RAISE WARNING '   ⚠️  Perfil NO encontrado (tabla vacía para este user_id)';
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '   ❌ ERROR al obtener perfil:';
        RAISE WARNING '      - SQLSTATE: %', SQLSTATE;
        RAISE WARNING '      - Mensaje: %', SQLERRM;
    END;
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================
-- 8. VERIFICAR FUNCIÓN is_admin()
-- ============================================

DO $$
DECLARE
  v_function_body TEXT;
BEGIN
  RAISE NOTICE '📋 8. VERIFICAR FUNCIÓN is_admin():';
  RAISE NOTICE '';

  SELECT pg_get_functiondef(oid) INTO v_function_body
  FROM pg_proc
  WHERE proname = 'is_admin'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LIMIT 1;

  IF v_function_body IS NOT NULL THEN
    RAISE NOTICE '   ✅ Función is_admin() existe';
    RAISE NOTICE '';
    RAISE NOTICE '   Definición:';
    RAISE NOTICE '%', v_function_body;
  ELSE
    RAISE WARNING '   ⚠️  Función is_admin() NO EXISTE';
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================
-- RESUMEN FINAL
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '📊 FIN DEL DIAGNÓSTICO';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'PRÓXIMOS PASOS:';
  RAISE NOTICE '1. Revisar las secciones marcadas con ⚠️  o ❌';
  RAISE NOTICE '2. Comparar diferencias entre admin (funciona) y presidente (falla)';
  RAISE NOTICE '3. Si hay usuarios sin perfil → crear perfiles';
  RAISE NOTICE '4. Si hay perfiles huérfanos → eliminarlos o corregir user_id';
  RAISE NOTICE '5. Verificar que todas las políticas RLS estén correctas';
  RAISE NOTICE '';
END $$;
