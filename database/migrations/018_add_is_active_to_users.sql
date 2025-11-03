-- ============================================
-- Migración 018: Agregar is_active a arca_user_profiles
-- ============================================
-- Fecha: 2025-02-11
-- Propósito: Agregar columna is_active para soft-delete de usuarios
--
-- Justificación:
-- - El código frontend y API routes ya implementan esta funcionalidad
-- - is_active es un flag de estado UI/lógica de negocio
-- - La seguridad se maneja con auth.admin.signOut() al desactivar
-- - No requiere modificación de políticas RLS (auth.uid() es suficiente)
--
-- Contexto:
-- - Cuando is_active = false, el API route llama signOut(userId)
-- - Esto invalida la sesión a nivel de Supabase Auth
-- - RLS policies existentes ya filtran por auth.uid(), bloqueando usuarios sin sesión

-- 1. Agregar columna is_active con valor por defecto true
ALTER TABLE arca_user_profiles
ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;

-- 2. Crear índice para optimizar queries de usuarios activos
-- (la mayoría de queries filtrarán por is_active = true)
CREATE INDEX idx_user_profiles_active
ON arca_user_profiles(is_active)
WHERE is_active = true;

-- 3. Agregar comentario explicativo
COMMENT ON COLUMN arca_user_profiles.is_active IS
'Flag de estado: false = usuario desactivado (soft delete). Al desactivar, se invalida automáticamente su sesión con auth.admin.signOut()';

-- 4. Verificación: Todos los usuarios existentes deben estar activos
DO $$
DECLARE
  inactive_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO inactive_count
  FROM arca_user_profiles
  WHERE is_active = false;

  IF inactive_count > 0 THEN
    RAISE EXCEPTION 'ERROR: Se encontraron % usuarios inactivos después de agregar columna. Esto no debería ocurrir con DEFAULT true.', inactive_count;
  END IF;

  RAISE NOTICE '✅ Verificación exitosa: Todos los usuarios están activos (is_active = true)';
END $$;

-- ============================================
-- Fin Migración 018
-- ============================================
