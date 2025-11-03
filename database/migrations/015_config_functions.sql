-- Migración 015: Funciones para Gestión de Configuración
-- Fecha: 02/11/2025
-- Propósito: Crear funciones SQL para leer y actualizar configuración del sistema

-- ============================================================================
-- 1. FUNCIÓN: get_system_config() - Obtener valor de configuración
-- ============================================================================

/**
 * Obtiene el valor de una configuración del sistema
 *
 * @param p_key - Clave de configuración a buscar
 * @returns JSONB - Valor de la configuración
 *
 * Ejemplo:
 *   SELECT get_system_config('debt_overdue_days'); -- Retorna: 30
 *   SELECT get_system_config('allowed_file_types'); -- Retorna: ["image/png", "image/jpeg", "application/pdf"]
 */
CREATE OR REPLACE FUNCTION get_system_config(p_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con permisos del owner (bypass RLS)
STABLE -- Indica que no modifica la DB (permite optimización)
AS $$
DECLARE
  v_value JSONB;
BEGIN
  -- Buscar el valor de configuración
  SELECT value INTO v_value
  FROM arca_system_config
  WHERE key = p_key;

  -- Si no existe, retornar null
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN v_value;
END;
$$;

COMMENT ON FUNCTION get_system_config(TEXT) IS 'Obtiene el valor de una configuración del sistema por su clave';

-- ============================================================================
-- 2. FUNCIÓN: get_config_by_category() - Obtener configuraciones por categoría
-- ============================================================================

/**
 * Obtiene todas las configuraciones de una categoría específica
 *
 * @param p_category - Categoría a filtrar (general, debts, uploads, notifications)
 * @returns TABLE - Tabla con key, value, description de cada configuración
 *
 * Ejemplo:
 *   SELECT * FROM get_config_by_category('debts');
 */
CREATE OR REPLACE FUNCTION get_config_by_category(p_category TEXT)
RETURNS TABLE (
  key TEXT,
  value JSONB,
  description TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.key,
    c.value,
    c.description,
    c.updated_at
  FROM arca_system_config c
  WHERE c.category = p_category
  ORDER BY c.key;
END;
$$;

COMMENT ON FUNCTION get_config_by_category(TEXT) IS 'Obtiene todas las configuraciones de una categoría específica';

-- ============================================================================
-- 3. FUNCIÓN: update_system_config() - Actualizar configuración con auditoría
-- ============================================================================

/**
 * Actualiza una configuración del sistema y registra el cambio en audit log
 *
 * @param p_key - Clave de configuración a actualizar
 * @param p_value - Nuevo valor en formato JSONB
 * @param p_description - (Opcional) Nueva descripción
 * @returns BOOLEAN - true si actualizó, false si no existe la key
 *
 * RESTRICCIÓN: Solo ejecutable por usuarios con rol 'admin'
 *
 * Ejemplo:
 *   SELECT update_system_config('debt_overdue_days', '45', 'Cambio temporal por festivos');
 */
CREATE OR REPLACE FUNCTION update_system_config(
  p_key TEXT,
  p_value JSONB,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_value JSONB;
  v_current_user UUID;
  v_is_admin BOOLEAN;
  v_updated_rows INT;
BEGIN
  -- 1. Obtener usuario actual
  v_current_user := auth.uid();

  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;

  -- 2. Verificar que el usuario es admin
  SELECT EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = v_current_user AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can update system configuration';
  END IF;

  -- 3. Obtener valor anterior (para audit log)
  SELECT value INTO v_old_value
  FROM arca_system_config
  WHERE key = p_key;

  IF NOT FOUND THEN
    -- Si la key no existe, retornar false
    RETURN FALSE;
  END IF;

  -- 4. Actualizar configuración
  UPDATE arca_system_config
  SET
    value = p_value,
    description = COALESCE(p_description, description), -- Solo actualiza si se proporciona
    updated_at = NOW(),
    updated_by = v_current_user
  WHERE key = p_key;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  -- 5. Registrar en audit log
  INSERT INTO arca_audit_logs (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    changed_by
  ) VALUES (
    'arca_system_config',
    p_key, -- Usamos la key como record_id (es TEXT, pero UUID puede aceptarlo)
    'update',
    jsonb_build_object('value', v_old_value),
    jsonb_build_object('value', p_value),
    v_current_user
  );

  -- 6. Retornar true si actualizó
  RETURN v_updated_rows > 0;
END;
$$;

COMMENT ON FUNCTION update_system_config(TEXT, JSONB, TEXT) IS 'Actualiza una configuración del sistema (solo admins) y registra cambio en audit log';

-- ============================================================================
-- 4. FUNCIÓN: create_system_config() - Crear nueva configuración
-- ============================================================================

/**
 * Crea una nueva configuración en el sistema
 *
 * @param p_key - Clave única de configuración (snake_case)
 * @param p_value - Valor en formato JSONB
 * @param p_description - Descripción legible
 * @param p_category - Categoría (general, debts, uploads, notifications)
 * @returns BOOLEAN - true si creó, false si ya existe
 *
 * RESTRICCIÓN: Solo ejecutable por usuarios con rol 'admin'
 *
 * Ejemplo:
 *   SELECT create_system_config(
 *     'debt_auto_approve_threshold',
 *     '1000',
 *     'Monto máximo para aprobación automática de deudas',
 *     'debts'
 *   );
 */
CREATE OR REPLACE FUNCTION create_system_config(
  p_key TEXT,
  p_value JSONB,
  p_description TEXT,
  p_category TEXT DEFAULT 'general'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- 1. Obtener usuario actual
  v_current_user := auth.uid();

  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;

  -- 2. Verificar que el usuario es admin
  SELECT EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = v_current_user AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can create system configuration';
  END IF;

  -- 3. Intentar insertar (si existe, se ignora por ON CONFLICT)
  INSERT INTO arca_system_config (key, value, description, category, updated_by)
  VALUES (p_key, p_value, p_description, p_category, v_current_user)
  ON CONFLICT (key) DO NOTHING;

  -- 4. Verificar si se insertó
  IF FOUND THEN
    -- Registrar en audit log
    INSERT INTO arca_audit_logs (
      table_name,
      record_id,
      action,
      new_values,
      changed_by
    ) VALUES (
      'arca_system_config',
      p_key,
      'insert',
      jsonb_build_object('key', p_key, 'value', p_value, 'category', p_category),
      v_current_user
    );

    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

COMMENT ON FUNCTION create_system_config(TEXT, JSONB, TEXT, TEXT) IS 'Crea una nueva configuración del sistema (solo admins) con registro en audit log';

-- ============================================================================
-- 5. FUNCIÓN: delete_system_config() - Eliminar configuración
-- ============================================================================

/**
 * Elimina una configuración del sistema (usar con precaución)
 *
 * @param p_key - Clave de configuración a eliminar
 * @returns BOOLEAN - true si eliminó, false si no existe
 *
 * RESTRICCIÓN: Solo ejecutable por usuarios con rol 'admin'
 * ADVERTENCIA: No hay soft delete, la configuración se elimina permanentemente
 *
 * Ejemplo:
 *   SELECT delete_system_config('temp_config_key');
 */
CREATE OR REPLACE FUNCTION delete_system_config(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_value JSONB;
  v_current_user UUID;
  v_is_admin BOOLEAN;
  v_deleted_rows INT;
BEGIN
  -- 1. Obtener usuario actual
  v_current_user := auth.uid();

  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;

  -- 2. Verificar que el usuario es admin
  SELECT EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = v_current_user AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete system configuration';
  END IF;

  -- 3. Obtener valor antes de eliminar (para audit log)
  SELECT value INTO v_old_value
  FROM arca_system_config
  WHERE key = p_key;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 4. Eliminar configuración
  DELETE FROM arca_system_config
  WHERE key = p_key;

  GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;

  -- 5. Registrar en audit log
  IF v_deleted_rows > 0 THEN
    INSERT INTO arca_audit_logs (
      table_name,
      record_id,
      action,
      old_values,
      changed_by
    ) VALUES (
      'arca_system_config',
      p_key,
      'delete',
      jsonb_build_object('value', v_old_value),
      v_current_user
    );
  END IF;

  RETURN v_deleted_rows > 0;
END;
$$;

COMMENT ON FUNCTION delete_system_config(TEXT) IS 'Elimina una configuración del sistema (solo admins) con registro en audit log';

-- ============================================================================
-- 6. PERMISOS - Conceder ejecución a usuarios autenticados
-- ============================================================================

-- Funciones de lectura: Cualquier usuario autenticado puede ejecutarlas
GRANT EXECUTE ON FUNCTION get_system_config(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_config_by_category(TEXT) TO authenticated;

-- Funciones de escritura: Solo validadas internamente (SECURITY DEFINER valida rol admin)
-- No necesitamos REVOKE porque SECURITY DEFINER ya maneja permisos
GRANT EXECUTE ON FUNCTION update_system_config(TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_system_config(TEXT, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_system_config(TEXT) TO authenticated;

-- ============================================================================
-- FIN DE MIGRACIÓN 015
-- ============================================================================
