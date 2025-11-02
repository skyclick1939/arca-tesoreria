-- ============================================
-- MIGRACIÓN 003: DATABASE FUNCTIONS
-- ============================================
-- Proyecto: El Arca - Sistema de Tesorería para Moto Club
-- Descripción: Funciones de lógica de negocio (cálculo, auditoría, métricas)
-- Versión: 2.1
-- Fecha: 22 de Octubre de 2025
-- ============================================

-- ============================================
-- FUNCIÓN 1: create_debts_batch()
-- ============================================
-- Crea deudas proporcionales para TODOS los capítulos activos
-- Cálculo: (Total Amount / Total Miembros Globales) × Miembros del Capítulo

CREATE OR REPLACE FUNCTION create_debts_batch(
  p_total_amount DECIMAL,
  p_due_date DATE,
  p_debt_type TEXT,
  p_description TEXT,
  p_bank_name TEXT,
  p_bank_clabe VARCHAR(18),
  p_bank_account VARCHAR(16),
  p_bank_holder TEXT
)
RETURNS TABLE(debt_id UUID, chapter_id UUID, amount DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_members INTEGER;
  v_amount_per_member DECIMAL;
BEGIN
  -- ==========================================
  -- VALIDACIÓN 1: Solo Admins pueden ejecutar
  -- ==========================================
  IF NOT EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden crear deudas';
  END IF;

  -- ==========================================
  -- VALIDACIÓN 2: Campos bancarios (al menos uno obligatorio)
  -- ==========================================
  IF p_bank_clabe IS NULL AND p_bank_account IS NULL THEN
    RAISE EXCEPTION 'Debe proporcionar al menos CLABE o Número de Cuenta';
  END IF;

  -- ==========================================
  -- VALIDACIÓN 3: Formato CLABE (si se proporciona)
  -- ==========================================
  IF p_bank_clabe IS NOT NULL THEN
    -- Validar longitud exacta de 18 dígitos
    IF LENGTH(p_bank_clabe) != 18 THEN
      RAISE EXCEPTION 'CLABE debe tener exactamente 18 dígitos (recibido: %)', LENGTH(p_bank_clabe);
    END IF;

    -- Validar que sea solo dígitos
    IF p_bank_clabe !~ '^[0-9]{18}$' THEN
      RAISE EXCEPTION 'CLABE debe contener solo dígitos numéricos';
    END IF;
  END IF;

  -- ==========================================
  -- VALIDACIÓN 4: Formato Número de Cuenta (si se proporciona)
  -- ==========================================
  IF p_bank_account IS NOT NULL THEN
    -- Validar longitud entre 10 y 16 dígitos
    IF LENGTH(p_bank_account) < 10 OR LENGTH(p_bank_account) > 16 THEN
      RAISE EXCEPTION 'Número de cuenta debe tener entre 10 y 16 dígitos (recibido: %)', LENGTH(p_bank_account);
    END IF;

    -- Validar que sea solo dígitos
    IF p_bank_account !~ '^[0-9]{10,16}$' THEN
      RAISE EXCEPTION 'Número de cuenta debe contener solo dígitos numéricos';
    END IF;
  END IF;

  -- ==========================================
  -- VALIDACIÓN 5: Fecha de vencimiento futura
  -- ==========================================
  IF p_due_date <= CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha de vencimiento debe ser futura (recibido: %)', p_due_date;
  END IF;

  -- ==========================================
  -- VALIDACIÓN 6: Monto positivo
  -- ==========================================
  IF p_total_amount <= 0 THEN
    RAISE EXCEPTION 'El monto total debe ser mayor a cero (recibido: %)', p_total_amount;
  END IF;

  -- ==========================================
  -- CÁLCULO 1: Total de miembros activos
  -- ==========================================
  SELECT COALESCE(SUM(member_count), 0) INTO v_total_members
  FROM arca_chapters
  WHERE is_active = true;

  IF v_total_members = 0 THEN
    RAISE EXCEPTION 'No hay capítulos activos para asignar deudas';
  END IF;

  -- ==========================================
  -- CÁLCULO 2: Monto por miembro
  -- ==========================================
  v_amount_per_member := p_total_amount / v_total_members;

  -- ==========================================
  -- INSERCIÓN ATÓMICA: Crear deudas proporcionales
  -- ==========================================
  -- PostgreSQL garantiza transacción implícita:
  -- Si 1 INSERT falla → TODAS se revierten automáticamente

  RETURN QUERY
  INSERT INTO arca_debts (
    chapter_id,
    amount,
    due_date,
    debt_type,
    description,
    bank_name,
    bank_clabe,
    bank_account,
    bank_holder,
    status,
    created_by
  )
  SELECT
    c.id,
    ROUND(v_amount_per_member * c.member_count, 2) AS calculated_amount,
    p_due_date,
    p_debt_type::debt_type_enum,
    p_description,
    p_bank_name,
    p_bank_clabe,
    p_bank_account,
    p_bank_holder,
    'pending'::debt_status_enum,
    auth.uid()
  FROM arca_chapters c
  WHERE c.is_active = true
  RETURNING id, chapter_id, amount;

  -- Log de éxito
  RAISE NOTICE 'Deudas creadas exitosamente para % capítulos (Monto por miembro: $%)',
    (SELECT COUNT(*) FROM arca_chapters WHERE is_active = true),
    ROUND(v_amount_per_member, 2);
END;
$$;

COMMENT ON FUNCTION create_debts_batch IS 'Crea deudas proporcionales con validaciones bancarias. Atomicidad garantizada por PostgreSQL.';

-- ============================================
-- FUNCIÓN 2: mark_overdue_debts()
-- ============================================
-- Marca deudas pending como overdue si están vencidas
-- Se llama desde cliente al cargar dashboard (NO pg_cron)

CREATE OR REPLACE FUNCTION mark_overdue_debts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Actualizar deudas vencidas sin comprobante
  WITH updated AS (
    UPDATE arca_debts
    SET
      status = 'overdue'::debt_status_enum,
      updated_at = NOW()
    WHERE status = 'pending'::debt_status_enum
      AND due_date < CURRENT_DATE
      AND proof_uploaded_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  -- Log del resultado
  IF v_updated_count > 0 THEN
    RAISE NOTICE '% deudas marcadas como atrasadas', v_updated_count;
  END IF;

  RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION mark_overdue_debts IS 'Marca deudas pending vencidas como overdue. Llamar desde cliente al cargar dashboard.';

-- ============================================
-- FUNCIÓN 3: audit_debt_changes()
-- ============================================
-- Trigger function para auditar cambios críticos en arca_debts
-- Se ejecuta automáticamente en UPDATE

CREATE OR REPLACE FUNCTION audit_debt_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo auditar si cambiaron campos críticos
  IF TG_OP = 'UPDATE' AND (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.proof_uploaded_at IS DISTINCT FROM NEW.proof_uploaded_at OR
    OLD.approved_at IS DISTINCT FROM NEW.approved_at
  ) THEN
    INSERT INTO arca_audit_logs (
      table_name,
      record_id,
      action,
      old_values,
      new_values,
      user_id
    ) VALUES (
      'arca_debts',
      NEW.id,
      TG_OP,
      jsonb_build_object(
        'status', OLD.status,
        'proof_uploaded_at', OLD.proof_uploaded_at,
        'approved_at', OLD.approved_at,
        'proof_file_url', OLD.proof_file_url
      ),
      jsonb_build_object(
        'status', NEW.status,
        'proof_uploaded_at', NEW.proof_uploaded_at,
        'approved_at', NEW.approved_at,
        'proof_file_url', NEW.proof_file_url
      ),
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION audit_debt_changes IS 'Trigger function para auditar cambios de status y comprobantes en arca_debts';

-- ============================================
-- FUNCIÓN 4: get_dashboard_stats_by_request()
-- ============================================
-- Dashboard Tab 2: Vista Por Solicitud
-- Agrupa deudas por concepto (description) con métricas

CREATE OR REPLACE FUNCTION get_dashboard_stats_by_request()
RETURNS TABLE(
  concepto TEXT,
  total_amount DECIMAL,
  collected_amount DECIMAL,
  pending_amount DECIMAL,
  overdue_amount DECIMAL,
  completion_percentage DECIMAL,
  chapters_count INTEGER,
  chapters_paid INTEGER,
  chapters_pending INTEGER,
  chapters_overdue INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo Admins pueden ver estadísticas globales
  IF NOT EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden ver estadísticas por solicitud';
  END IF;

  RETURN QUERY
  SELECT
    d.description AS concepto,
    SUM(d.amount) AS total_amount,
    SUM(CASE WHEN d.status = 'approved' THEN d.amount ELSE 0 END) AS collected_amount,
    SUM(CASE WHEN d.status = 'pending' THEN d.amount ELSE 0 END) AS pending_amount,
    SUM(CASE WHEN d.status = 'overdue' THEN d.amount ELSE 0 END) AS overdue_amount,
    ROUND(
      (SUM(CASE WHEN d.status = 'approved' THEN d.amount ELSE 0 END) / NULLIF(SUM(d.amount), 0)) * 100,
      2
    ) AS completion_percentage,
    COUNT(DISTINCT d.chapter_id)::INTEGER AS chapters_count,
    COUNT(DISTINCT CASE WHEN d.status = 'approved' THEN d.chapter_id END)::INTEGER AS chapters_paid,
    COUNT(DISTINCT CASE WHEN d.status = 'pending' THEN d.chapter_id END)::INTEGER AS chapters_pending,
    COUNT(DISTINCT CASE WHEN d.status = 'overdue' THEN d.chapter_id END)::INTEGER AS chapters_overdue
  FROM arca_debts d
  WHERE d.description IS NOT NULL
  GROUP BY d.description
  ORDER BY total_amount DESC;
END;
$$;

COMMENT ON FUNCTION get_dashboard_stats_by_request IS 'Dashboard Tab 2: Agrupa deudas por concepto/solicitud con métricas detalladas';

-- ============================================
-- FUNCIÓN 5: get_dashboard_stats_by_chapter()
-- ============================================
-- Dashboard Tab 3: Vista Por Capítulo
-- Agrupa deudas por capítulo con desglose completo

CREATE OR REPLACE FUNCTION get_dashboard_stats_by_chapter()
RETURNS TABLE(
  chapter_id UUID,
  chapter_name TEXT,
  regional TEXT,
  president_name TEXT,
  total_assigned DECIMAL,
  total_paid DECIMAL,
  total_pending DECIMAL,
  total_overdue DECIMAL,
  completion_percentage DECIMAL,
  debts_count INTEGER,
  debts_paid INTEGER,
  debts_pending INTEGER,
  debts_overdue INTEGER,
  last_payment_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo Admins pueden ver estadísticas globales
  IF NOT EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden ver estadísticas por capítulo';
  END IF;

  RETURN QUERY
  SELECT
    c.id AS chapter_id,
    c.name AS chapter_name,
    c.regional::TEXT AS regional,
    COALESCE(p.full_name, 'Sin asignar') AS president_name,
    SUM(d.amount) AS total_assigned,
    SUM(CASE WHEN d.status = 'approved' THEN d.amount ELSE 0 END) AS total_paid,
    SUM(CASE WHEN d.status = 'pending' THEN d.amount ELSE 0 END) AS total_pending,
    SUM(CASE WHEN d.status = 'overdue' THEN d.amount ELSE 0 END) AS total_overdue,
    ROUND(
      (SUM(CASE WHEN d.status = 'approved' THEN d.amount ELSE 0 END) / NULLIF(SUM(d.amount), 0)) * 100,
      2
    ) AS completion_percentage,
    COUNT(d.id)::INTEGER AS debts_count,
    COUNT(CASE WHEN d.status = 'approved' THEN 1 END)::INTEGER AS debts_paid,
    COUNT(CASE WHEN d.status = 'pending' THEN 1 END)::INTEGER AS debts_pending,
    COUNT(CASE WHEN d.status = 'overdue' THEN 1 END)::INTEGER AS debts_overdue,
    MAX(d.approved_at) AS last_payment_date
  FROM arca_chapters c
  LEFT JOIN arca_user_profiles p ON c.president_id = p.user_id
  LEFT JOIN arca_debts d ON c.id = d.chapter_id
  WHERE c.is_active = true
  GROUP BY c.id, c.name, c.regional, p.full_name
  ORDER BY total_overdue DESC, total_pending DESC;
END;
$$;

COMMENT ON FUNCTION get_dashboard_stats_by_chapter IS 'Dashboard Tab 3: Agrupa deudas por capítulo con desglose completo';

-- ============================================
-- FUNCIÓN 6: get_global_balance()
-- ============================================
-- Dashboard Tab 1: Vista General
-- Calcula saldo global según definición PRD v1.1

CREATE OR REPLACE FUNCTION get_global_balance()
RETURNS TABLE(
  total_adeudos DECIMAL,
  total_recabado DECIMAL,
  saldo_faltante DECIMAL,
  porcentaje_recaudado DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo Admins pueden ver balance global
  IF NOT EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden ver el balance global';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(amount), 0) AS total_adeudos,
    COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) AS total_recabado,
    COALESCE(SUM(amount), 0) - COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) AS saldo_faltante,
    ROUND(
      (COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) / NULLIF(SUM(amount), 0)) * 100,
      2
    ) AS porcentaje_recaudado
  FROM arca_debts;
END;
$$;

COMMENT ON FUNCTION get_global_balance IS 'Dashboard Tab 1: Calcula saldo global (Total Adeudos - Total Recabado)';

-- ============================================
-- FIN DE MIGRACIÓN 003
-- ============================================

-- Verificación rápida
DO $$
DECLARE
  v_function_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'create_debts_batch',
      'mark_overdue_debts',
      'audit_debt_changes',
      'get_dashboard_stats_by_request',
      'get_dashboard_stats_by_chapter',
      'get_global_balance'
    );

  RAISE NOTICE '✅ Migración 003 ejecutada exitosamente';
  RAISE NOTICE 'Funciones creadas: % de 6', v_function_count;
  RAISE NOTICE '  - create_debts_batch() - Cálculo proporcional con validaciones';
  RAISE NOTICE '  - mark_overdue_debts() - Marcar deudas vencidas';
  RAISE NOTICE '  - audit_debt_changes() - Trigger de auditoría';
  RAISE NOTICE '  - get_dashboard_stats_by_request() - Tab 2 Dashboard';
  RAISE NOTICE '  - get_dashboard_stats_by_chapter() - Tab 3 Dashboard';
  RAISE NOTICE '  - get_global_balance() - Tab 1 Dashboard';
  RAISE NOTICE 'Siguiente paso: Ejecutar 004_triggers.sql';
END $$;
