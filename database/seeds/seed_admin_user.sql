-- ============================================
-- SEED ADMIN USER: USUARIO ADMINISTRADOR PARA PRODUCCIÓN
-- ============================================
-- Proyecto: El Arca - Sistema de Tesorería para Moto Club
-- Descripción: Crea el usuario administrador inicial en producción
-- Versión: 1.0
-- Fecha: 28 de Octubre de 2025
-- ============================================

-- ⚠️  IMPORTANTE: EJECUTAR SOLO EN PRODUCCIÓN DESPUÉS DEL DEPLOYMENT
-- ⚠️  NO ejecutar en desarrollo (usa seed_dev_data.sql en su lugar)

-- ============================================
-- INSTRUCCIONES DE USO
-- ============================================
--
-- PASO 1: Crear usuario en Supabase Auth Dashboard
-- -----------------------------------------------
-- 1. Ir a: Supabase Dashboard → Authentication → Users → Add User
-- 2. Crear usuario con los siguientes datos:
--    - Email: admin@arca.com (o el email corporativo del administrador)
--    - Password: [GENERAR CONTRASEÑA SEGURA - Mínimo 16 caracteres]
--    - Auto Confirm User: YES (marcar checkbox)
--
-- 3. ANOTAR la contraseña generada en un lugar seguro (enviar al administrador)
--
-- PASO 2: Ejecutar este script SQL
-- ----------------------------------
-- 1. Copiar TODO el contenido de este archivo
-- 2. Ir a: Supabase Dashboard → SQL Editor → New Query
-- 3. Pegar el contenido
-- 4. Reemplazar los valores de configuración (ver sección CONFIG)
-- 5. Ejecutar (botón RUN)
--
-- PASO 3: Verificación
-- --------------------
-- 1. Ir a la tabla arca_user_profiles
-- 2. Verificar que existe un registro con role='admin'
-- 3. Probar inicio de sesión en la aplicación
--
-- ============================================

-- ============================================
-- CONFIG: VALORES A PERSONALIZAR
-- ============================================
--
-- ⚠️  MODIFICAR ESTOS VALORES ANTES DE EJECUTAR:

DO $$
DECLARE
  -- Email del administrador (debe coincidir con el creado en Auth)
  v_admin_email TEXT := 'admin@arca.com'; -- ← CAMBIAR AQUÍ

  -- Nombre completo del administrador
  v_admin_name TEXT := 'Administrador Principal'; -- ← CAMBIAR AQUÍ

  -- Variables internas (NO modificar)
  v_admin_id UUID;
  v_profile_exists BOOLEAN;
BEGIN
  -- ============================================
  -- VALIDACIONES PREVIAS
  -- ============================================

  -- 1. Verificar que el usuario existe en Supabase Auth
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = v_admin_email;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION '❌ ERROR: No se encontró un usuario con email "%".

    DEBES CREAR EL USUARIO EN SUPABASE AUTH PRIMERO:
    1. Ir a: Supabase Dashboard → Authentication → Users → Add User
    2. Email: %
    3. Password: [Generar segura]
    4. Auto Confirm: YES

    Después de crear el usuario, ejecuta este script nuevamente.',
    v_admin_email, v_admin_email;
  END IF;

  RAISE NOTICE '✅ Usuario encontrado en Auth: % (ID: %)', v_admin_email, v_admin_id;

  -- 2. Verificar si ya existe un perfil
  SELECT EXISTS(
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = v_admin_id
  ) INTO v_profile_exists;

  IF v_profile_exists THEN
    RAISE NOTICE '⚠️  El usuario ya tiene un perfil en arca_user_profiles';
    RAISE NOTICE '   Actualizando a rol admin...';

    -- Actualizar perfil existente
    UPDATE arca_user_profiles
    SET
      role = 'admin',
      full_name = v_admin_name,
      updated_at = NOW()
    WHERE user_id = v_admin_id;

    RAISE NOTICE '✅ Perfil actualizado correctamente';
  ELSE
    RAISE NOTICE '⚠️  El trigger on_auth_user_created debió crear el perfil automáticamente';
    RAISE NOTICE '   Si no existe, lo creamos manualmente...';

    -- Crear perfil manualmente (por si el trigger falló)
    INSERT INTO arca_user_profiles (user_id, role, full_name)
    VALUES (v_admin_id, 'admin', v_admin_name)
    ON CONFLICT (user_id) DO UPDATE
    SET
      role = 'admin',
      full_name = v_admin_name,
      updated_at = NOW();

    RAISE NOTICE '✅ Perfil creado correctamente';
  END IF;

  -- ============================================
  -- VERIFICACIÓN FINAL
  -- ============================================

  RAISE NOTICE '';
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '✅ USUARIO ADMINISTRADOR CONFIGURADO EXITOSAMENTE';
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Email: %', v_admin_email;
  RAISE NOTICE 'Nombre: %', v_admin_name;
  RAISE NOTICE 'Rol: admin';
  RAISE NOTICE 'User ID: %', v_admin_id;
  RAISE NOTICE '';
  RAISE NOTICE '🔐 CREDENCIALES DE ACCESO:';
  RAISE NOTICE '   Email: %', v_admin_email;
  RAISE NOTICE '   Password: [La que configuraste en Supabase Auth]';
  RAISE NOTICE '';
  RAISE NOTICE '📋 PRÓXIMOS PASOS:';
  RAISE NOTICE '   1. Inicia sesión en la aplicación con estas credenciales';
  RAISE NOTICE '   2. Verifica que accedes al Dashboard de Administrador';
  RAISE NOTICE '   3. Comienza a crear los capítulos del club';
  RAISE NOTICE '';

END $$;

-- ============================================
-- NOTAS ADICIONALES
-- ============================================
--
-- 🔒 SEGURIDAD:
-- - NUNCA compartas la contraseña por canales inseguros
-- - Usa un gestor de contraseñas para almacenarla
-- - El administrador debe cambiar la contraseña en el primer login (próxima feature)
--
-- 🛠️ TROUBLESHOOTING:
--
-- ERROR: "No se encontró un usuario con email..."
-- SOLUCIÓN: Crear el usuario en Supabase Auth primero (ver PASO 1)
--
-- ERROR: "El trigger on_auth_user_created falló"
-- SOLUCIÓN: Este script crea el perfil manualmente como fallback
--
-- ERROR: "El usuario no puede iniciar sesión"
-- SOLUCIÓN: Verificar que el email esté confirmado (Auto Confirm: YES)
--
-- 📞 SOPORTE:
-- Si tienes problemas, revisa la tabla arca_user_profiles:
-- SELECT * FROM arca_user_profiles WHERE role = 'admin';
--
