-- ============================================================================
-- Migración 019: Password Change Tracking
-- ============================================================================
-- Descripción: Agrega campos para forzar cambio de contraseña en primer login
--              y tracking de última actualización de contraseña
--
-- Autor: Sistema El Arca
-- Fecha: 2025-11-02
--
-- Cambios:
-- 1. Agregar campo must_change_password a arca_user_profiles
-- 2. Agregar campo password_changed_at a arca_user_profiles
-- 3. Actualizar usuarios existentes (no forzar cambio)
-- ============================================================================

-- 1. Agregar campo must_change_password
-- ============================================================================
-- Indica si el usuario DEBE cambiar su contraseña en el próximo login
-- Por defecto TRUE para nuevos usuarios (seguridad)
-- Se actualiza a FALSE después del primer cambio de contraseña

ALTER TABLE arca_user_profiles
ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN arca_user_profiles.must_change_password IS
'Indica si el usuario debe cambiar su contraseña en el próximo login. TRUE para nuevos usuarios por seguridad.';


-- 2. Agregar campo password_changed_at
-- ============================================================================
-- Timestamp de la última vez que el usuario cambió su contraseña
-- Útil para auditoría y políticas de rotación de contraseñas

ALTER TABLE arca_user_profiles
ADD COLUMN password_changed_at TIMESTAMPTZ;

COMMENT ON COLUMN arca_user_profiles.password_changed_at IS
'Timestamp de la última vez que el usuario cambió su contraseña. NULL si nunca la ha cambiado.';


-- 3. Actualizar usuarios existentes
-- ============================================================================
-- Los usuarios que ya existen NO deben ser forzados a cambiar contraseña
-- (asumimos que sus contraseñas actuales son válidas)

UPDATE arca_user_profiles
SET must_change_password = FALSE
WHERE created_at < NOW();

-- Comentario explicativo
COMMENT ON TABLE arca_user_profiles IS
'Perfiles extendidos de usuarios del sistema.
Campos de seguridad:
- must_change_password: Forzar cambio en primer login (nuevos usuarios)
- password_changed_at: Tracking de última actualización de contraseña';


-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- Ejecutar después de aplicar la migración para verificar:

-- SELECT
--   user_id,
--   full_name,
--   role,
--   must_change_password,
--   password_changed_at,
--   created_at
-- FROM arca_user_profiles
-- ORDER BY created_at DESC;

-- Resultado esperado:
-- - Usuarios existentes: must_change_password = FALSE, password_changed_at = NULL
-- - Nuevos usuarios: must_change_password = TRUE (por defecto), password_changed_at = NULL
