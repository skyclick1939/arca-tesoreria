-- ============================================
-- VERIFICACIÓN POST-REPARACIÓN
-- ============================================
-- Ejecutar DESPUÉS de recrear usuarios en Dashboard
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '🔍 VERIFICACIÓN POST-REPARACIÓN';
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
    SELECT id, email, email_confirmed_at IS NOT NULL as confirmed
    FROM auth.users
    ORDER BY email
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '   %. % (confirmado: %)',
      v_count,
      v_user.email,
      CASE WHEN v_user.confirmed THEN 'Sí' ELSE 'NO ⚠️' END;
  END LOOP;

  RAISE NOTICE '';
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
      u.email
    FROM arca_user_profiles p
    JOIN auth.users u ON u.id = p.user_id
    ORDER BY
      CASE WHEN p.role = 'admin' THEN 1 ELSE 2 END,
      u.email
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '   %. % (rol: %)',
      v_count,
      v_profile.email,
      UPPER(v_profile.role::TEXT);
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '   Total perfiles: %', v_count;
  RAISE NOTICE '';
END $$;

-- ============================================
-- 3. VERIFICAR SINCRONIZACIÓN
-- ============================================

DO $$
DECLARE
  v_users_count INTEGER;
  v_profiles_count INTEGER;
BEGIN
  RAISE NOTICE '📋 3. VERIFICAR SINCRONIZACIÓN:';
  RAISE NOTICE '';

  SELECT COUNT(*) INTO v_users_count FROM auth.users;
  SELECT COUNT(*) INTO v_profiles_count FROM arca_user_profiles;

  RAISE NOTICE '   Usuarios: %', v_users_count;
  RAISE NOTICE '   Perfiles: %', v_profiles_count;
  RAISE NOTICE '';

  IF v_users_count = v_profiles_count THEN
    RAISE NOTICE '   ✅ SINCRONIZACIÓN PERFECTA';
  ELSE
    RAISE WARNING '   ⚠️  DESINCRONIZACIÓN: % usuarios vs % perfiles',
      v_users_count,
      v_profiles_count;
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================
-- 4. VERIFICAR TRIGGER on_auth_user_created
-- ============================================

DO $$
DECLARE
  v_trigger_exists BOOLEAN;
  v_function_exists BOOLEAN;
BEGIN
  RAISE NOTICE '📋 4. VERIFICAR TRIGGER on_auth_user_created:';
  RAISE NOTICE '';

  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'on_auth_user_created'
      AND c.relname = 'users'
  ) INTO v_trigger_exists;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'handle_new_user'
  ) INTO v_function_exists;

  RAISE NOTICE '   Trigger existe: %',
    CASE WHEN v_trigger_exists THEN '✅ Sí' ELSE '❌ NO' END;
  RAISE NOTICE '   Función handle_new_user(): %',
    CASE WHEN v_function_exists THEN '✅ Sí' ELSE '❌ NO' END;

  RAISE NOTICE '';
END $$;

-- ============================================
-- 5. VERIFICAR POLÍTICAS RLS
-- ============================================

DO $$
DECLARE
  v_policy RECORD;
  v_count INTEGER := 0;
  v_rls_enabled BOOLEAN;
BEGIN
  RAISE NOTICE '📋 5. VERIFICAR POLÍTICAS RLS:';
  RAISE NOTICE '';

  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'arca_user_profiles';

  RAISE NOTICE '   RLS habilitado: %',
    CASE WHEN v_rls_enabled THEN '✅ Sí' ELSE '❌ NO' END;
  RAISE NOTICE '';

  FOR v_policy IN
    SELECT policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'arca_user_profiles'
    ORDER BY policyname
  LOOP
    v_count := v_count + 1;
    RAISE NOTICE '   %: % (%)', v_count, v_policy.policyname, v_policy.cmd;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '   Total políticas: % (esperadas: 3)', v_count;

  IF v_count != 3 THEN
    RAISE WARNING '   ⚠️  Se esperaban 3 políticas pero hay %', v_count;
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================
-- 6. VERIFICAR FUNCIÓN is_admin()
-- ============================================

DO $$
DECLARE
  v_function_exists BOOLEAN;
BEGIN
  RAISE NOTICE '📋 6. VERIFICAR FUNCIÓN is_admin():';
  RAISE NOTICE '';

  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_admin'
  ) INTO v_function_exists;

  RAISE NOTICE '   Función is_admin() existe: %',
    CASE WHEN v_function_exists THEN '✅ Sí' ELSE '❌ NO' END;

  RAISE NOTICE '';
END $$;

-- ============================================
-- RESUMEN FINAL
-- ============================================

DO $$
DECLARE
  v_users_count INTEGER;
  v_profiles_count INTEGER;
  v_admin_count INTEGER;
  v_president_count INTEGER;
  v_all_ok BOOLEAN := TRUE;
BEGIN
  SELECT COUNT(*) INTO v_users_count FROM auth.users;
  SELECT COUNT(*) INTO v_profiles_count FROM arca_user_profiles;

  SELECT COUNT(*) INTO v_admin_count
  FROM arca_user_profiles WHERE role = 'admin';

  SELECT COUNT(*) INTO v_president_count
  FROM arca_user_profiles WHERE role = 'president';

  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '📊 RESUMEN FINAL:';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '   Usuarios en auth.users: %', v_users_count;
  RAISE NOTICE '   Perfiles en arca_user_profiles: %', v_profiles_count;
  RAISE NOTICE '   - Admins: %', v_admin_count;
  RAISE NOTICE '   - Presidentes: %', v_president_count;
  RAISE NOTICE '';

  IF v_users_count != v_profiles_count THEN
    RAISE WARNING '   ⚠️  DESINCRONIZACIÓN DETECTADA';
    v_all_ok := FALSE;
  END IF;

  IF v_all_ok THEN
    RAISE NOTICE '✅ ===============================================';
    RAISE NOTICE '✅ REPARACIÓN EXITOSA - TODO CORRECTO';
    RAISE NOTICE '✅ ===============================================';
    RAISE NOTICE '';
    RAISE NOTICE '🧪 Próximo paso: Probar login en http://localhost:3000';
    RAISE NOTICE '';
    RAISE NOTICE '🔑 Credenciales:';
    RAISE NOTICE '   - admin@arca.local / admin123';
    RAISE NOTICE '   - pres.vallarta@arca.local / pres1234';
    RAISE NOTICE '';
  ELSE
    RAISE WARNING '⚠️  ADVERTENCIA: Se detectaron problemas';
    RAISE WARNING '   Revisa los mensajes anteriores marcados con ⚠️ o ❌';
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
