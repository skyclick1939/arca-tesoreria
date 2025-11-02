-- ============================================
-- FIX DEFINITIVO MANUAL - EJECUTAR AHORA
-- ============================================
-- Fecha: 23 de Octubre de 2025
-- Problema: Error 42501 persiste incluso con RLS deshabilitado
-- Solución: Reseteo COMPLETO de permisos y creación manual de perfiles
-- ============================================

-- PASO 0: INFORMACIÓN CRÍTICA
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔧 FIX DEFINITIVO MANUAL - INICIANDO...';
  RAISE NOTICE '   Este script va a:';
  RAISE NOTICE '   1. Deshabilitar RLS temporalmente';
  RAISE NOTICE '   2. Otorgar permisos COMPLETOS al schema public';
  RAISE NOTICE '   3. ELIMINAR todos los perfiles existentes';
  RAISE NOTICE '   4. CREAR perfiles para cada usuario en auth.users';
  RAISE NOTICE '   5. Re-habilitar RLS con políticas correctas';
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

-- ============================================
-- PASO 2: OTORGAR PERMISOS COMPLETOS
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 2: Otorgando permisos completos al schema public...';
END $$;

-- Otorgar TODOS los permisos en el schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Configurar permisos por defecto para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;

-- ============================================
-- PASO 3: LIMPIAR TABLA arca_user_profiles
-- ============================================

DO $$
DECLARE
  v_count_before INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 3: Limpiando tabla arca_user_profiles...';

  SELECT COUNT(*) INTO v_count_before FROM arca_user_profiles;

  RAISE NOTICE '   - Perfiles existentes: %', v_count_before;

  -- ELIMINAR TODOS los perfiles (empezar de cero)
  DELETE FROM arca_user_profiles;

  RAISE NOTICE '   - ✅ Tabla limpiada completamente';
END $$;

-- ============================================
-- PASO 4: CREAR PERFILES PARA TODOS LOS USUARIOS
-- ============================================

DO $$
DECLARE
  v_user RECORD;
  v_created_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 4: Creando perfiles para TODOS los usuarios...';
  RAISE NOTICE '';

  -- Iterar sobre TODOS los usuarios en auth.users
  FOR v_user IN
    SELECT
      id,
      email,
      created_at,
      COALESCE(raw_user_meta_data->>'full_name', email) as full_name
    FROM auth.users
    ORDER BY created_at ASC
  LOOP
    -- Insertar perfil
    INSERT INTO arca_user_profiles (user_id, role, full_name, created_at, updated_at)
    VALUES (
      v_user.id,
      CASE
        WHEN v_user.email = 'admin@arca.local' THEN 'admin'::user_role
        ELSE 'president'::user_role
      END,
      v_user.full_name,
      v_user.created_at,
      v_user.created_at
    );

    v_created_count := v_created_count + 1;

    RAISE NOTICE '   ✅ Perfil #% creado: % (rol: %)',
      v_created_count,
      v_user.email,
      CASE WHEN v_user.email = 'admin@arca.local' THEN 'admin' ELSE 'president' END;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '   📊 Total de perfiles creados: %', v_created_count;

  IF v_created_count = 0 THEN
    RAISE WARNING 'NO se crearon perfiles - Verifica que haya usuarios en auth.users';
  END IF;
END $$;

-- ============================================
-- PASO 5: VERIFICAR PERFILES CREADOS
-- ============================================

DO $$
DECLARE
  v_users_count INTEGER;
  v_profiles_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 5: Verificando sincronización...';
  RAISE NOTICE '';

  SELECT COUNT(*) INTO v_users_count FROM auth.users;
  SELECT COUNT(*) INTO v_profiles_count FROM arca_user_profiles;

  RAISE NOTICE '   - Usuarios en auth.users: %', v_users_count;
  RAISE NOTICE '   - Perfiles en arca_user_profiles: %', v_profiles_count;

  IF v_users_count = v_profiles_count THEN
    RAISE NOTICE '   ✅ Sincronización PERFECTA';
  ELSE
    RAISE WARNING 'DESINCRONIZACIÓN: % usuarios vs % perfiles', v_users_count, v_profiles_count;
  END IF;
END $$;

-- ============================================
-- PASO 6: RE-HABILITAR RLS CON POLÍTICAS CORRECTAS
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 6: Re-habilitando RLS con políticas correctas...';
END $$;

-- Re-habilitar RLS
ALTER TABLE arca_user_profiles ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes (si las hay)
DROP POLICY IF EXISTS "Users view own profile" ON arca_user_profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON arca_user_profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON arca_user_profiles;

-- Crear función is_admin (si no existe)
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

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated, anon;

-- Política 1: Usuarios autenticados ven su propio perfil
CREATE POLICY "Users view own profile"
ON arca_user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Política 2: Admins ven todos los perfiles
CREATE POLICY "Admins view all profiles"
ON arca_user_profiles
FOR SELECT
TO authenticated
USING (is_admin());

-- Política 3: Admins modifican cualquier perfil
CREATE POLICY "Admins manage profiles"
ON arca_user_profiles
FOR ALL
TO authenticated
USING (is_admin());

DO $$
BEGIN
  RAISE NOTICE '   ✅ RLS re-habilitado con 3 políticas';
END $$;

-- ============================================
-- PASO 7: RECREAR TRIGGER MEJORADO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 7: Recreando trigger on_auth_user_created...';
END $$;

-- Eliminar trigger y función si existen
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Crear función mejorada
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.arca_user_profiles (user_id, role, full_name)
  VALUES (
    NEW.id,
    'president'::user_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error al crear perfil para user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Crear trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DO $$
BEGIN
  RAISE NOTICE '   ✅ Trigger recreado con manejo de errores';
END $$;

-- ============================================
-- PASO 8: VALIDACIÓN FINAL COMPLETA
-- ============================================

DO $$
DECLARE
  v_users_count INTEGER;
  v_profiles_count INTEGER;
  v_admin_count INTEGER;
  v_president_count INTEGER;
  v_rls_enabled BOOLEAN;
  v_policy_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PASO 8: Validación final completa...';
  RAISE NOTICE '';

  -- Contar usuarios y perfiles
  SELECT COUNT(*) INTO v_users_count FROM auth.users;
  SELECT COUNT(*) INTO v_profiles_count FROM arca_user_profiles;

  -- Contar por rol
  SELECT COUNT(*) INTO v_admin_count
  FROM arca_user_profiles WHERE role = 'admin';

  SELECT COUNT(*) INTO v_president_count
  FROM arca_user_profiles WHERE role = 'president';

  -- Verificar RLS
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'arca_user_profiles' AND relkind = 'r';

  -- Contar políticas
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'arca_user_profiles';

  -- Validación
  IF v_users_count != v_profiles_count THEN
    RAISE EXCEPTION 'ERROR: Usuarios (%) != Perfiles (%)', v_users_count, v_profiles_count;
  END IF;

  IF NOT v_rls_enabled THEN
    RAISE EXCEPTION 'ERROR: RLS no está habilitado';
  END IF;

  IF v_policy_count != 3 THEN
    RAISE WARNING 'Advertencia: Se esperaban 3 políticas, hay %', v_policy_count;
  END IF;

  -- Resultado
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '✅ FIX DEFINITIVO EJECUTADO EXITOSAMENTE';
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Estado final:';
  RAISE NOTICE '   - Usuarios en auth.users: %', v_users_count;
  RAISE NOTICE '   - Perfiles en arca_user_profiles: %', v_profiles_count;
  RAISE NOTICE '   - Admins: %', v_admin_count;
  RAISE NOTICE '   - Presidentes: %', v_president_count;
  RAISE NOTICE '   - RLS habilitado: %', v_rls_enabled;
  RAISE NOTICE '   - Políticas RLS: %', v_policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '🔑 Credenciales para probar:';
  RAISE NOTICE '   - admin@arca.local / admin123';
  RAISE NOTICE '   - pres.vallarta@arca.local / pres1234';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Próximos pasos:';
  RAISE NOTICE '   1. Ejecutar: node diagnostico_simple.js';
  RAISE NOTICE '   2. Probar login en http://localhost:3000';
  RAISE NOTICE '';
END $$;

-- ============================================
-- PASO 9: LISTAR PERFILES FINALES
-- ============================================

DO $$
DECLARE
  v_profile RECORD;
  v_counter INTEGER := 0;
BEGIN
  RAISE NOTICE '📋 PERFILES FINALES EN arca_user_profiles:';
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
    v_counter := v_counter + 1;
    RAISE NOTICE '   %. % (%)',
      v_counter,
      v_profile.email,
      UPPER(v_profile.role::TEXT);
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Total: % perfil(es)', v_counter;
  RAISE NOTICE '';
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
