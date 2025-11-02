-- ============================================
-- Migración 011: Funciones de Dashboard - Estadísticas
-- ============================================
-- Fecha: 31/10/2025
-- Propósito: Implementar funciones SQL para Tab 2 y Tab 3 del Dashboard Admin
--
-- Funciones creadas:
-- 1. get_dashboard_stats_by_request() - Agrupa por concepto de solicitud
-- 2. get_dashboard_stats_by_chapter() - Agrupa por capítulo
--
-- Sprint 3 - T3.2 y T3.4
-- ============================================

-- ============================================
-- FUNCIÓN 1: get_dashboard_stats_by_request
-- ============================================
-- Agrupa deudas por concepto/descripción de solicitud
-- Calcula totales, recabado, pendiente y % de cumplimiento
--
-- Retorna una fila por cada solicitud única (description)
-- Ordenado por fecha de creación de la solicitud más reciente
--
-- Ejemplo de uso:
-- SELECT * FROM get_dashboard_stats_by_request();
--
-- Resultado:
-- | request_name              | total_amount | collected_amount | pending_amount | completion_percentage | debts_count | first_created_at |
-- |---------------------------|--------------|------------------|----------------|----------------------|-------------|------------------|
-- | Apoyo Aniversario Jalisco | 9000.00      | 4500.00          | 4500.00        | 50.00                | 4           | 2025-10-20       |
-- ============================================

CREATE OR REPLACE FUNCTION get_dashboard_stats_by_request()
RETURNS TABLE(
  request_name TEXT,
  total_amount DECIMAL(10, 2),
  collected_amount DECIMAL(10, 2),
  pending_amount DECIMAL(10, 2),
  completion_percentage DECIMAL(5, 2),
  debts_count INTEGER,
  first_created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.description AS request_name,
    SUM(d.amount)::DECIMAL(10, 2) AS total_amount,
    SUM(CASE WHEN d.status = 'approved' THEN d.amount ELSE 0 END)::DECIMAL(10, 2) AS collected_amount,
    SUM(CASE WHEN d.status != 'approved' THEN d.amount ELSE 0 END)::DECIMAL(10, 2) AS pending_amount,
    (
      CASE
        WHEN SUM(d.amount) > 0 THEN
          (SUM(CASE WHEN d.status = 'approved' THEN d.amount ELSE 0 END) / SUM(d.amount) * 100)::DECIMAL(5, 2)
        ELSE
          0::DECIMAL(5, 2)
      END
    ) AS completion_percentage,
    COUNT(d.id)::INTEGER AS debts_count,
    MIN(d.created_at) AS first_created_at
  FROM arca_debts d
  WHERE d.description IS NOT NULL
  GROUP BY d.description
  ORDER BY MIN(d.created_at) DESC;
END;
$$;

-- ============================================
-- FUNCIÓN 2: get_dashboard_stats_by_chapter
-- ============================================
-- Agrupa deudas por capítulo
-- Calcula totales asignados, pagados, pendientes y vencidos
--
-- Retorna una fila por cada capítulo
-- Ordenado por total_overdue DESC (capítulos con más atrasos primero)
--
-- Ejemplo de uso:
-- SELECT * FROM get_dashboard_stats_by_chapter();
--
-- Resultado:
-- | chapter_id | chapter_name      | regional   | total_assigned | total_paid | total_pending | total_overdue | total_in_review |
-- |------------|-------------------|------------|----------------|------------|---------------|---------------|-----------------|
-- | uuid-123   | Guadalajara       | Occidente  | 5000.00        | 2000.00    | 2000.00       | 1000.00       | 0.00            |
-- ============================================

CREATE OR REPLACE FUNCTION get_dashboard_stats_by_chapter()
RETURNS TABLE(
  chapter_id UUID,
  chapter_name TEXT,
  regional regional_enum,
  member_count INTEGER,
  total_assigned DECIMAL(10, 2),
  total_paid DECIMAL(10, 2),
  total_pending DECIMAL(10, 2),
  total_overdue DECIMAL(10, 2),
  total_in_review DECIMAL(10, 2),
  completion_percentage DECIMAL(5, 2)
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS chapter_id,
    c.name AS chapter_name,
    c.regional,
    c.member_count,
    COALESCE(SUM(d.amount), 0)::DECIMAL(10, 2) AS total_assigned,
    COALESCE(SUM(CASE WHEN d.status = 'approved' THEN d.amount ELSE 0 END), 0)::DECIMAL(10, 2) AS total_paid,
    COALESCE(SUM(CASE WHEN d.status = 'pending' THEN d.amount ELSE 0 END), 0)::DECIMAL(10, 2) AS total_pending,
    COALESCE(SUM(CASE WHEN d.status = 'overdue' THEN d.amount ELSE 0 END), 0)::DECIMAL(10, 2) AS total_overdue,
    COALESCE(SUM(CASE WHEN d.status = 'in_review' THEN d.amount ELSE 0 END), 0)::DECIMAL(10, 2) AS total_in_review,
    (
      CASE
        WHEN COALESCE(SUM(d.amount), 0) > 0 THEN
          (COALESCE(SUM(CASE WHEN d.status = 'approved' THEN d.amount ELSE 0 END), 0) / SUM(d.amount) * 100)::DECIMAL(5, 2)
        ELSE
          0::DECIMAL(5, 2)
      END
    ) AS completion_percentage
  FROM arca_chapters c
  LEFT JOIN arca_debts d ON d.chapter_id = c.id
  WHERE c.is_active = true
  GROUP BY c.id, c.name, c.regional, c.member_count
  ORDER BY total_overdue DESC, chapter_name ASC;
END;
$$;

-- ============================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ============================================

COMMENT ON FUNCTION get_dashboard_stats_by_request() IS
'Retorna estadísticas agregadas por concepto de solicitud.
Calcula monto total, recabado, pendiente y % de cumplimiento.
Ordenado por fecha de creación (solicitudes más recientes primero).
Usado en Tab 2 del Dashboard Admin.';

COMMENT ON FUNCTION get_dashboard_stats_by_chapter() IS
'Retorna estadísticas agregadas por capítulo.
Calcula montos asignados, pagados, pendientes, vencidos y en revisión.
Incluye % de cumplimiento por capítulo.
Ordenado por monto vencido DESC (capítulos con más atrasos primero).
Usado en Tab 3 del Dashboard Admin.';

-- ============================================
-- PERMISOS
-- ============================================
-- Solo admins pueden ejecutar estas funciones (verificado vía RLS en frontend)

GRANT EXECUTE ON FUNCTION get_dashboard_stats_by_request() TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats_by_chapter() TO authenticated;

-- ============================================
-- TESTING MANUAL (Ejecutar después de migración)
-- ============================================
-- 1. Test get_dashboard_stats_by_request:
--    SELECT * FROM get_dashboard_stats_by_request();
--    Esperado: Una fila por cada solicitud única con métricas calculadas
--
-- 2. Test get_dashboard_stats_by_chapter:
--    SELECT * FROM get_dashboard_stats_by_chapter();
--    Esperado: Una fila por cada capítulo activo con desglose de montos
--
-- 3. Verificar cálculo de porcentajes:
--    SELECT chapter_name, total_assigned, total_paid, completion_percentage
--    FROM get_dashboard_stats_by_chapter()
--    WHERE total_assigned > 0;
--    Validar: completion_percentage = (total_paid / total_assigned) * 100
--
-- 4. Verificar ordenamiento:
--    SELECT chapter_name, total_overdue
--    FROM get_dashboard_stats_by_chapter();
--    Validar: Ordenado por total_overdue DESC
-- ============================================
