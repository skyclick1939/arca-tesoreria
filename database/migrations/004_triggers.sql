-- ============================================
-- MIGRACIÓN 004: TRIGGERS
-- ============================================
-- Proyecto: El Arca - Sistema de Tesorería para Moto Club
-- Descripción: Triggers automáticos (updated_at, auditoría)
-- Versión: 2.1
-- Fecha: 22 de Octubre de 2025
-- ============================================

-- ============================================
-- TRIGGER FUNCTION 1: update_updated_at()
-- ============================================
-- Actualiza automáticamente el campo updated_at en cada UPDATE
-- Se usa en múltiples tablas

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_updated_at IS 'Actualiza automáticamente updated_at en UPDATE (trigger genérico)';

-- ============================================
-- PASO 1: TRIGGERS PARA updated_at
-- ============================================

-- Trigger 1: arca_user_profiles
CREATE TRIGGER update_arca_user_profiles_updated_at
BEFORE UPDATE ON arca_user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Trigger 2: arca_chapters
CREATE TRIGGER update_arca_chapters_updated_at
BEFORE UPDATE ON arca_chapters
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Trigger 3: arca_debts
CREATE TRIGGER update_arca_debts_updated_at
BEFORE UPDATE ON arca_debts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================
-- PASO 2: TRIGGER DE AUDITORÍA
-- ============================================

-- Trigger 4: Auditar cambios críticos en arca_debts
-- Ejecuta la función audit_debt_changes() definida en 003_functions.sql
CREATE TRIGGER arca_debts_audit_trigger
AFTER UPDATE ON arca_debts
FOR EACH ROW
EXECUTE FUNCTION audit_debt_changes();

-- ============================================
-- PASO 3: TRIGGER DE VALIDACIÓN DE STATUS
-- ============================================

-- Trigger function para validar transiciones de estado
CREATE OR REPLACE FUNCTION validate_debt_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validar transiciones permitidas de status
  -- pending → overdue
  -- pending → in_review (cuando se sube comprobante)
  -- overdue → in_review (cuando se sube comprobante)
  -- in_review → approved (solo Admin)
  -- in_review → pending (si Admin rechaza)

  -- Validación 1: Solo pending/overdue pueden cambiar a in_review
  IF NEW.status = 'in_review' AND OLD.status NOT IN ('pending', 'overdue') THEN
    RAISE EXCEPTION 'Status % no puede cambiar a in_review', OLD.status;
  END IF;

  -- Validación 2: Solo in_review puede cambiar a approved
  IF NEW.status = 'approved' AND OLD.status != 'in_review' THEN
    RAISE EXCEPTION 'Solo deudas en in_review pueden ser aprobadas (status actual: %)', OLD.status;
  END IF;

  -- Validación 3: Si cambia a in_review, debe tener comprobante
  IF NEW.status = 'in_review' AND NEW.proof_file_url IS NULL THEN
    RAISE EXCEPTION 'Deuda en in_review debe tener comprobante subido';
  END IF;

  -- Validación 4: Si cambia a approved, debe tener approved_at
  IF NEW.status = 'approved' AND NEW.approved_at IS NULL THEN
    NEW.approved_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_debt_status_transition IS 'Valida transiciones permitidas de status en arca_debts';

-- Trigger 5: Validar transiciones de status
CREATE TRIGGER validate_arca_debts_status_transition
BEFORE UPDATE OF status ON arca_debts
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION validate_debt_status_transition();

-- ============================================
-- PASO 4: TRIGGER DE AUTO-STATUS IN_REVIEW
-- ============================================

-- Trigger function para cambiar automáticamente a in_review al subir comprobante
CREATE OR REPLACE FUNCTION auto_set_in_review_on_proof_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si se sube comprobante y el status es pending/overdue,
  -- cambiar automáticamente a in_review
  IF NEW.proof_file_url IS NOT NULL
     AND OLD.proof_file_url IS NULL
     AND NEW.status IN ('pending', 'overdue') THEN

    NEW.status := 'in_review'::debt_status_enum;
    NEW.proof_uploaded_at := NOW();

    RAISE NOTICE 'Deuda % cambiada automáticamente a in_review', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_set_in_review_on_proof_upload IS 'Cambia automáticamente status a in_review al subir comprobante';

-- Trigger 6: Auto-cambio a in_review al subir comprobante
CREATE TRIGGER auto_arca_debts_in_review
BEFORE UPDATE OF proof_file_url ON arca_debts
FOR EACH ROW
WHEN (OLD.proof_file_url IS NULL AND NEW.proof_file_url IS NOT NULL)
EXECUTE FUNCTION auto_set_in_review_on_proof_upload();

-- ============================================
-- PASO 6: TRIGGER DE PROTECCIÓN DE CAMPOS BANCARIOS
-- ============================================

-- Trigger function para evitar que Presidentes modifiquen campos críticos
CREATE OR REPLACE FUNCTION prevent_presidents_modify_critical_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Verificar si el usuario es Admin
  SELECT EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  -- Si es Admin, permitir TODO
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- Si NO es Admin (es Presidente), validar que NO modifique campos críticos
  IF OLD.chapter_id IS DISTINCT FROM NEW.chapter_id THEN
    RAISE EXCEPTION 'Presidentes no pueden cambiar chapter_id';
  END IF;

  IF OLD.amount IS DISTINCT FROM NEW.amount THEN
    RAISE EXCEPTION 'Presidentes no pueden cambiar el monto';
  END IF;

  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    RAISE EXCEPTION 'Presidentes no pueden cambiar la fecha de vencimiento';
  END IF;

  IF OLD.debt_type IS DISTINCT FROM NEW.debt_type THEN
    RAISE EXCEPTION 'Presidentes no pueden cambiar el tipo de deuda';
  END IF;

  IF OLD.description IS DISTINCT FROM NEW.description THEN
    RAISE EXCEPTION 'Presidentes no pueden cambiar la descripción';
  END IF;

  -- CAMPOS BANCARIOS: CRÍTICOS
  IF OLD.bank_name IS DISTINCT FROM NEW.bank_name THEN
    RAISE EXCEPTION 'Presidentes no pueden cambiar el banco';
  END IF;

  IF OLD.bank_clabe IS DISTINCT FROM NEW.bank_clabe THEN
    RAISE EXCEPTION 'Presidentes no pueden cambiar la CLABE';
  END IF;

  IF OLD.bank_account IS DISTINCT FROM NEW.bank_account THEN
    RAISE EXCEPTION 'Presidentes no pueden cambiar el número de cuenta';
  END IF;

  IF OLD.bank_holder IS DISTINCT FROM NEW.bank_holder THEN
    RAISE EXCEPTION 'Presidentes no pueden cambiar el titular de la cuenta';
  END IF;

  -- CAMPOS DE AUDITORÍA
  IF OLD.approved_at IS DISTINCT FROM NEW.approved_at THEN
    RAISE EXCEPTION 'Presidentes no pueden cambiar approved_at';
  END IF;

  IF OLD.created_by IS DISTINCT FROM NEW.created_by THEN
    RAISE EXCEPTION 'Presidentes no pueden cambiar created_by';
  END IF;

  IF OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Presidentes no pueden cambiar created_at';
  END IF;

  -- Si pasó todas las validaciones, permitir UPDATE
  -- Presidente solo puede modificar: proof_file_url, proof_uploaded_at, status
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION prevent_presidents_modify_critical_fields IS 'Evita que Presidentes modifiquen campos bancarios y críticos (solo Admins pueden)';

-- Trigger 7: Protección de campos críticos para Presidentes
CREATE TRIGGER prevent_presidents_critical_fields
BEFORE UPDATE ON arca_debts
FOR EACH ROW
EXECUTE FUNCTION prevent_presidents_modify_critical_fields();

-- ============================================
-- PASO 7: TRIGGER DE PREVENCIÓN DE ELIMINACIÓN
-- ============================================

-- Trigger function para prevenir eliminación accidental de deudas aprobadas
CREATE OR REPLACE FUNCTION prevent_approved_debt_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prevenir eliminación de deudas aprobadas (auditoría)
  IF OLD.status = 'approved' THEN
    RAISE EXCEPTION 'No se pueden eliminar deudas aprobadas (usar soft delete)';
  END IF;

  -- Log de eliminación
  RAISE NOTICE 'Deuda % eliminada (Status: %, Monto: $%)',
    OLD.id, OLD.status, OLD.amount;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION prevent_approved_debt_deletion IS 'Previene eliminación de deudas aprobadas (protección de auditoría)';

-- Trigger 8: Protección contra eliminación de aprobadas
CREATE TRIGGER prevent_arca_debts_approved_deletion
BEFORE DELETE ON arca_debts
FOR EACH ROW
EXECUTE FUNCTION prevent_approved_debt_deletion();

-- ============================================
-- PASO 8: TRIGGER DE CREACIÓN AUTOMÁTICA DE PERFILES
-- ============================================

-- Trigger function para crear perfil automáticamente al registrar usuario en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insertar perfil automáticamente con datos del registro
  INSERT INTO public.arca_user_profiles (user_id, role, full_name)
  VALUES (
    NEW.id,
    'president', -- Por defecto todos son presidentes (Admin se cambia manualmente)
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) -- Usar full_name o email como fallback
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION handle_new_user IS 'Crea automáticamente perfil en arca_user_profiles al crear usuario en auth.users';

-- Trigger 9: Crear perfil automáticamente al registrar usuario
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- FIN DE MIGRACIÓN 004
-- ============================================

-- Verificación rápida
DO $$
DECLARE
  v_trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger
  WHERE tgrelid IN (
    'arca_user_profiles'::regclass,
    'arca_chapters'::regclass,
    'arca_debts'::regclass
  );

  RAISE NOTICE '✅ Migración 004 ejecutada exitosamente';
  RAISE NOTICE 'Triggers creados: %', v_trigger_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Lista de triggers activos:';
  RAISE NOTICE '  1. update_arca_user_profiles_updated_at (BEFORE UPDATE)';
  RAISE NOTICE '  2. update_arca_chapters_updated_at (BEFORE UPDATE)';
  RAISE NOTICE '  3. update_arca_debts_updated_at (BEFORE UPDATE)';
  RAISE NOTICE '  4. arca_debts_audit_trigger (AFTER UPDATE - Auditoría)';
  RAISE NOTICE '  5. validate_arca_debts_status_transition (BEFORE UPDATE - Validación)';
  RAISE NOTICE '  6. auto_arca_debts_in_review (BEFORE UPDATE - Auto-status)';
  RAISE NOTICE '  7. prevent_presidents_critical_fields (BEFORE UPDATE - Protección campos)';
  RAISE NOTICE '  8. prevent_arca_debts_approved_deletion (BEFORE DELETE - Protección)';
  RAISE NOTICE '  9. on_auth_user_created (AFTER INSERT auth.users - Auto-perfil)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE: El trigger on_auth_user_created crea perfiles automáticamente';
  RAISE NOTICE '⚠️  Crear usuarios desde Supabase Dashboard → Authentication → Add User';
  RAISE NOTICE '';
  RAISE NOTICE 'Siguiente paso: Crear usuarios en Authentication, luego seed_dev_data.sql';
END $$;
