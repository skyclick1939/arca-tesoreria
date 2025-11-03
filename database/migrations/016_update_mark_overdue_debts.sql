-- Migración 016: Actualizar mark_overdue_debts() para usar configuración dinámica
-- Fecha: 02/11/2025
-- Propósito: Integrar debt_overdue_days desde arca_system_config

-- ============================================================================
-- 1. ACTUALIZAR DESCRIPCIÓN DE CONFIGURACIÓN (para claridad)
-- ============================================================================

UPDATE arca_system_config
SET description = 'Días de tolerancia después del vencimiento antes de marcar como overdue (grace period)'
WHERE key = 'debt_overdue_days';

-- ============================================================================
-- 2. REEMPLAZAR FUNCIÓN mark_overdue_debts() CON CONFIGURACIÓN DINÁMICA
-- ============================================================================

/**
 * Marca deudas pending como overdue si exceden el período de tolerancia
 *
 * CAMBIOS EN ESTA VERSIÓN:
 * - Usa get_system_config('debt_overdue_days') en lugar de valor hardcodeado
 * - Permite configurar "grace period" dinámicamente desde UI
 * - Default: 30 días de tolerancia
 *
 * EJEMPLO:
 * - Deuda vence: 01/11/2025
 * - Grace period: 30 días
 * - Se marca overdue: 02/12/2025 (31 días después)
 *
 * @returns INTEGER - Cantidad de deudas marcadas como overdue
 */
CREATE OR REPLACE FUNCTION mark_overdue_debts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER;
  v_overdue_days INTEGER;
BEGIN
  -- 1. Obtener configuración de días de tolerancia (grace period)
  SELECT (get_system_config('debt_overdue_days')::TEXT)::INTEGER INTO v_overdue_days;

  -- Fallback: Si no existe la configuración, usar 30 días por defecto
  IF v_overdue_days IS NULL THEN
    v_overdue_days := 30;
    RAISE WARNING 'Configuración debt_overdue_days no encontrada, usando default: 30 días';
  END IF;

  -- 2. Actualizar deudas que exceden el grace period
  -- Lógica: due_date + grace_period < TODAY
  -- Ejemplo: due_date = 2025-11-01, grace = 30 días
  --          → debe marcar overdue el 2025-12-02
  WITH updated AS (
    UPDATE arca_debts
    SET
      status = 'overdue'::debt_status_enum,
      updated_at = NOW()
    WHERE status = 'pending'::debt_status_enum
      AND (CURRENT_DATE - due_date) > v_overdue_days  -- Tolerancia excedida
      AND proof_uploaded_at IS NULL  -- Sin comprobante subido
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  -- 3. Log del resultado
  IF v_updated_count > 0 THEN
    RAISE NOTICE '% deudas marcadas como overdue (grace period: % días)', v_updated_count, v_overdue_days;
  ELSE
    RAISE NOTICE 'No hay deudas que marcar como overdue (grace period: % días)', v_overdue_days;
  END IF;

  RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION mark_overdue_debts IS 'Marca deudas pending vencidas como overdue usando configuración dinámica de grace period';

-- ============================================================================
-- 3. VERIFICACIÓN DE ACTUALIZACIÓN
-- ============================================================================

DO $$
DECLARE
  v_config_value TEXT;
BEGIN
  -- Verificar que la configuración existe
  SELECT value::TEXT INTO v_config_value
  FROM arca_system_config
  WHERE key = 'debt_overdue_days';

  IF v_config_value IS NOT NULL THEN
    RAISE NOTICE '✅ Migración 016 ejecutada exitosamente';
    RAISE NOTICE 'Configuración debt_overdue_days: % días', v_config_value;
    RAISE NOTICE 'Función mark_overdue_debts() actualizada para usar configuración dinámica';
  ELSE
    RAISE WARNING 'Configuración debt_overdue_days no encontrada. Ejecutar 014_system_config.sql primero.';
  END IF;
END $$;

-- ============================================================================
-- FIN DE MIGRACIÓN 016
-- ============================================================================
