-- Migración 017: Funciones para Consulta de Audit Logs
-- Fecha: 02/11/2025
-- Propósito: Crear funciones SQL para obtener y filtrar registros de auditoría con paginación

-- ============================================================================
-- 1. FUNCIÓN: get_audit_logs_paginated() - Consulta principal con paginación
-- ============================================================================

/**
 * Obtiene logs de auditoría con paginación, filtros y ordenamiento
 *
 * PARÁMETROS:
 * @param p_limit - Cantidad de registros por página (default: 50, max: 200)
 * @param p_offset - Offset para paginación (default: 0)
 * @param p_table_name - Filtro por nombre de tabla (opcional)
 * @param p_action - Filtro por acción (INSERT, UPDATE, DELETE) (opcional)
 * @param p_user_id - Filtro por usuario que realizó la acción (opcional)
 * @param p_from_date - Filtro por fecha desde (opcional)
 * @param p_to_date - Filtro por fecha hasta (opcional)
 *
 * RETORNA: Tabla con registros de auditoría + metadatos
 *
 * EJEMPLO:
 *   -- Obtener primeros 50 logs de arca_debts
 *   SELECT * FROM get_audit_logs_paginated(50, 0, 'arca_debts');
 *
 *   -- Obtener logs de UPDATE en la última semana
 *   SELECT * FROM get_audit_logs_paginated(
 *     50, 0, NULL, 'UPDATE', NULL,
 *     NOW() - INTERVAL '7 days', NOW()
 *   );
 */
CREATE OR REPLACE FUNCTION get_audit_logs_paginated(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_table_name TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_from_date TIMESTAMPTZ DEFAULT NULL,
  p_to_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  table_name TEXT,
  record_id TEXT,
  action TEXT,
  old_values JSONB,
  new_values JSONB,
  user_id UUID,
  changed_by UUID,
  timestamp TIMESTAMPTZ,
  user_email TEXT,
  user_name TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- 1. Validar que el usuario es admin
  SELECT EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE arca_user_profiles.user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Solo administradores pueden consultar logs de auditoría';
  END IF;

  -- 2. Validar límites de paginación
  IF p_limit > 200 THEN
    p_limit := 200; -- Max 200 registros por página
  END IF;

  IF p_limit < 1 THEN
    p_limit := 50; -- Default
  END IF;

  -- 3. Construir query con filtros dinámicos
  RETURN QUERY
  WITH filtered_logs AS (
    SELECT
      l.id,
      l.table_name,
      l.record_id,
      l.action,
      l.old_values,
      l.new_values,
      l.user_id,
      l.changed_by,
      l.timestamp,
      -- Obtener email y nombre del usuario desde auth.users y arca_user_profiles
      COALESCE(au.email, 'Desconocido') AS email,
      COALESCE(up.full_name, 'Usuario Eliminado') AS full_name
    FROM arca_audit_logs l
    LEFT JOIN auth.users au ON l.changed_by = au.id
    LEFT JOIN arca_user_profiles up ON l.changed_by = up.user_id
    WHERE
      (p_table_name IS NULL OR l.table_name = p_table_name)
      AND (p_action IS NULL OR l.action = p_action)
      AND (p_user_id IS NULL OR l.changed_by = p_user_id)
      AND (p_from_date IS NULL OR l.timestamp >= p_from_date)
      AND (p_to_date IS NULL OR l.timestamp <= p_to_date)
    ORDER BY l.timestamp DESC
  ),
  counted_logs AS (
    SELECT COUNT(*) AS total FROM filtered_logs
  )
  SELECT
    fl.id,
    fl.table_name,
    fl.record_id,
    fl.action,
    fl.old_values,
    fl.new_values,
    fl.user_id,
    fl.changed_by,
    fl.timestamp,
    fl.email,
    fl.full_name,
    cl.total
  FROM filtered_logs fl
  CROSS JOIN counted_logs cl
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_audit_logs_paginated IS 'Consulta logs de auditoría con filtros y paginación (solo admins)';

-- ============================================================================
-- 2. FUNCIÓN: get_audit_logs_by_record() - Historial de un registro específico
-- ============================================================================

/**
 * Obtiene el historial completo de cambios de un registro específico
 *
 * @param p_table_name - Nombre de la tabla (e.g., 'arca_debts')
 * @param p_record_id - ID del registro a consultar
 *
 * @returns Tabla con todos los cambios del registro ordenados cronológicamente
 *
 * EJEMPLO:
 *   SELECT * FROM get_audit_logs_by_record('arca_debts', 'abc-123-def-456');
 */
CREATE OR REPLACE FUNCTION get_audit_logs_by_record(
  p_table_name TEXT,
  p_record_id TEXT
)
RETURNS TABLE(
  id UUID,
  action TEXT,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  timestamp TIMESTAMPTZ,
  user_email TEXT,
  user_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Solo admins pueden ver historial de auditoría
  SELECT EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE arca_user_profiles.user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Solo administradores pueden consultar historial de auditoría';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.action,
    l.old_values,
    l.new_values,
    l.changed_by,
    l.timestamp,
    COALESCE(au.email, 'Desconocido') AS email,
    COALESCE(up.full_name, 'Usuario Eliminado') AS full_name
  FROM arca_audit_logs l
  LEFT JOIN auth.users au ON l.changed_by = au.id
  LEFT JOIN arca_user_profiles up ON l.changed_by = up.user_id
  WHERE l.table_name = p_table_name
    AND l.record_id = p_record_id
  ORDER BY l.timestamp ASC; -- Cronológico (más antiguo primero)
END;
$$;

COMMENT ON FUNCTION get_audit_logs_by_record IS 'Obtiene historial completo de cambios de un registro específico';

-- ============================================================================
-- 3. FUNCIÓN: get_audit_stats() - Estadísticas de auditoría
-- ============================================================================

/**
 * Obtiene estadísticas agregadas de los logs de auditoría
 *
 * @param p_days - Días hacia atrás a considerar (default: 30)
 *
 * @returns Tabla con estadísticas por tabla y acción
 *
 * EJEMPLO:
 *   SELECT * FROM get_audit_stats(7); -- Últimos 7 días
 */
CREATE OR REPLACE FUNCTION get_audit_stats(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  table_name TEXT,
  action TEXT,
  count BIGINT,
  first_occurrence TIMESTAMPTZ,
  last_occurrence TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_from_date TIMESTAMPTZ;
BEGIN
  -- Solo admins pueden ver estadísticas
  SELECT EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE arca_user_profiles.user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Solo administradores pueden consultar estadísticas de auditoría';
  END IF;

  -- Calcular fecha de inicio
  v_from_date := NOW() - (p_days || ' days')::INTERVAL;

  RETURN QUERY
  SELECT
    l.table_name,
    l.action,
    COUNT(*) AS count,
    MIN(l.timestamp) AS first_occurrence,
    MAX(l.timestamp) AS last_occurrence
  FROM arca_audit_logs l
  WHERE l.timestamp >= v_from_date
  GROUP BY l.table_name, l.action
  ORDER BY count DESC, l.table_name, l.action;
END;
$$;

COMMENT ON FUNCTION get_audit_stats IS 'Estadísticas agregadas de logs de auditoría (solo admins)';

-- ============================================================================
-- 4. FUNCIÓN: get_user_activity() - Actividad de un usuario específico
-- ============================================================================

/**
 * Obtiene el registro de actividad de un usuario específico
 *
 * @param p_user_id - UUID del usuario
 * @param p_days - Días hacia atrás a consultar (default: 30)
 * @param p_limit - Máximo de registros (default: 100)
 *
 * @returns Tabla con actividad del usuario
 *
 * EJEMPLO:
 *   SELECT * FROM get_user_activity('abc-123-def', 7, 50);
 */
CREATE OR REPLACE FUNCTION get_user_activity(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
  id UUID,
  table_name TEXT,
  record_id TEXT,
  action TEXT,
  timestamp TIMESTAMPTZ,
  summary TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_from_date TIMESTAMPTZ;
BEGIN
  -- Solo admins pueden ver actividad de otros usuarios
  SELECT EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE arca_user_profiles.user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Solo administradores pueden consultar actividad de usuarios';
  END IF;

  -- Calcular fecha de inicio
  v_from_date := NOW() - (p_days || ' days')::INTERVAL;

  RETURN QUERY
  SELECT
    l.id,
    l.table_name,
    l.record_id,
    l.action,
    l.timestamp,
    -- Generar resumen legible
    CASE
      WHEN l.action = 'INSERT' THEN 'Creó registro en ' || l.table_name
      WHEN l.action = 'UPDATE' THEN 'Actualizó registro en ' || l.table_name
      WHEN l.action = 'DELETE' THEN 'Eliminó registro en ' || l.table_name
      ELSE 'Acción en ' || l.table_name
    END AS summary
  FROM arca_audit_logs l
  WHERE l.changed_by = p_user_id
    AND l.timestamp >= v_from_date
  ORDER BY l.timestamp DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_user_activity IS 'Registro de actividad de un usuario específico (solo admins)';

-- ============================================================================
-- 5. PERMISOS - Conceder ejecución a usuarios autenticados
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_audit_logs_paginated TO authenticated;
GRANT EXECUTE ON FUNCTION get_audit_logs_by_record TO authenticated;
GRANT EXECUTE ON FUNCTION get_audit_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity TO authenticated;

-- ============================================================================
-- 6. VERIFICACIÓN DE MIGRACIÓN
-- ============================================================================

DO $$
DECLARE
  v_function_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'get_audit_logs_paginated',
      'get_audit_logs_by_record',
      'get_audit_stats',
      'get_user_activity'
    );

  RAISE NOTICE '✅ Migración 017 ejecutada exitosamente';
  RAISE NOTICE 'Funciones de audit logs creadas: % de 4', v_function_count;
  RAISE NOTICE '  - get_audit_logs_paginated() - Consulta principal con filtros';
  RAISE NOTICE '  - get_audit_logs_by_record() - Historial de un registro';
  RAISE NOTICE '  - get_audit_stats() - Estadísticas agregadas';
  RAISE NOTICE '  - get_user_activity() - Actividad de un usuario';
  RAISE NOTICE 'Siguiente paso: Crear página de Auditoría en /admin/auditoria';
END $$;

-- ============================================================================
-- FIN DE MIGRACIÓN 017
-- ============================================================================
