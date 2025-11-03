-- ============================================================================
-- Migración 020: Actualizar Trigger para Forzar Cambio de Contraseña
-- ============================================================================
-- Descripción: Actualiza el trigger on_auth_user_created para que setee
--              must_change_password = TRUE en nuevos usuarios
--
-- Autor: Sistema El Arca
-- Fecha: 2025-11-02
--
-- Cambios:
-- 1. Actualizar función handle_new_user() para incluir must_change_password
-- ============================================================================

-- 1. Recrear función handle_new_user con nuevo campo
-- ============================================================================

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insertar perfil automáticamente con must_change_password = TRUE
  -- Esto fuerza al usuario a cambiar su contraseña en el primer login
  INSERT INTO public.arca_user_profiles (
    user_id,
    role,
    full_name,
    must_change_password,
    password_changed_at
  )
  VALUES (
    NEW.id,
    'president'::user_role, -- Por defecto presidente (cambiar manualmente a admin si es necesario)
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    TRUE, -- 🔐 FORZAR cambio de contraseña en primer login
    NULL  -- NULL = nunca ha cambiado la contraseña
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

COMMENT ON FUNCTION public.handle_new_user IS
'Crea perfil en arca_user_profiles al registrar usuario.
- Setea must_change_password = TRUE para forzar cambio en primer login
- Maneja errores sin fallar registro del usuario
- ON CONFLICT DO NOTHING previene duplicados';


-- 2. Recrear trigger (por si acaso)
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
'Trigger que ejecuta handle_new_user() después de crear un usuario en auth.users';


-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- Ejecutar después de aplicar la migración para verificar:

-- SELECT
--   routine_name,
--   routine_type,
--   specific_name
-- FROM information_schema.routines
-- WHERE routine_name = 'handle_new_user'
--   AND routine_schema = 'public';

-- SELECT
--   trigger_name,
--   event_manipulation,
--   event_object_table,
--   action_statement
-- FROM information_schema.triggers
-- WHERE trigger_name = 'on_auth_user_created';

-- Resultado esperado:
-- - Función handle_new_user existe y está actualizada
-- - Trigger on_auth_user_created está activo en auth.users
-- - Nuevos usuarios creados tendrán must_change_password = TRUE
