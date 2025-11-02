-- ============================================
-- Migración 010: Función Atómica para Upload de Comprobantes
-- ============================================
-- Fecha: 31/10/2025
-- Propósito: Resolver CRÍTICO #1 (Atomicidad) y CRÍTICO #2 (Seguridad)
--
-- Problemas Resueltos:
-- 1. Atomicidad: Toda lógica de validación y actualización en una transacción
-- 2. Seguridad: Validación backend de permisos (auth.uid = presidente del capítulo)
-- 3. Consistencia: Validación de estado de deuda antes de actualizar
--
-- Arquitectura: "Supabase-first" - Toda lógica crítica en PostgreSQL
-- ============================================

-- ============================================
-- FUNCIÓN: update_debt_proof
-- ============================================
-- Actualiza comprobante de pago de una deuda con validación de seguridad
--
-- Validaciones:
-- 1. Usuario autenticado es el presidente del capítulo que posee la deuda
-- 2. La deuda existe y está en estado 'pending' o 'overdue'
-- 3. El proof_file_url es válido (no vacío)
--
-- Parámetros:
-- @param p_debt_id UUID - ID de la deuda a actualizar
-- @param p_proof_file_url TEXT - URL del comprobante subido a Storage
--
-- Retorna:
-- JSONB con estructura:
-- {
--   "success": boolean,
--   "message": string,
--   "debt_id": uuid (si success=true)
-- }
--
-- Ejemplo de uso:
-- SELECT update_debt_proof(
--   'uuid-deuda-123',
--   'https://supabase.co/storage/arca-comprobantes/...'
-- );
-- ============================================

CREATE OR REPLACE FUNCTION update_debt_proof(
  p_debt_id UUID,
  p_proof_file_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con permisos del owner de la función
SET search_path = public
AS $$
DECLARE
  v_debt_record RECORD;
  v_chapter_id UUID;
  v_current_status debt_status_enum;
  v_president_id UUID;
BEGIN
  -- ============================================
  -- VALIDACIÓN 1: Verificar que la deuda existe
  -- ============================================
  SELECT
    id,
    chapter_id,
    status,
    proof_file_url
  INTO v_debt_record
  FROM arca_debts
  WHERE id = p_debt_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Deuda no encontrada'
    );
  END IF;

  -- Extraer datos del registro
  v_chapter_id := v_debt_record.chapter_id;
  v_current_status := v_debt_record.status;

  -- ============================================
  -- VALIDACIÓN 2: Verificar que el usuario autenticado es el presidente del capítulo
  -- ============================================
  SELECT president_id
  INTO v_president_id
  FROM arca_chapters
  WHERE id = v_chapter_id
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Capítulo no encontrado o inactivo'
    );
  END IF;

  -- Verificar que auth.uid() es el presidente
  IF v_president_id != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No tienes permiso para actualizar esta deuda. Solo el presidente del capítulo puede subir comprobantes.'
    );
  END IF;

  -- ============================================
  -- VALIDACIÓN 3: Verificar estado de la deuda
  -- ============================================
  -- Solo permitir upload si está en 'pending', 'overdue' o 'in_review' (reemplazo)
  IF v_current_status NOT IN ('pending', 'overdue', 'in_review') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('No se puede subir comprobante. Estado actual: %s', v_current_status)
    );
  END IF;

  -- ============================================
  -- VALIDACIÓN 4: Verificar que la URL no esté vacía
  -- ============================================
  IF p_proof_file_url IS NULL OR trim(p_proof_file_url) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'URL del comprobante no puede estar vacía'
    );
  END IF;

  -- ============================================
  -- ACTUALIZACIÓN ATÓMICA
  -- ============================================
  -- Actualizar deuda con nuevo comprobante y cambiar status a 'in_review'
  UPDATE arca_debts
  SET
    proof_file_url = p_proof_file_url,
    proof_uploaded_at = NOW(),
    status = 'in_review',
    updated_at = NOW()
  WHERE id = p_debt_id;

  -- ============================================
  -- RETORNO EXITOSO
  -- ============================================
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Comprobante subido exitosamente. Status actualizado a "En Revisión"',
    'debt_id', p_debt_id
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Capturar cualquier error inesperado
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Error al actualizar comprobante: %s', SQLERRM)
    );
END;
$$;

-- ============================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ============================================
COMMENT ON FUNCTION update_debt_proof(UUID, TEXT) IS
'Actualiza comprobante de pago de una deuda con validación de seguridad.
Valida que el usuario autenticado es el presidente del capítulo que posee la deuda.
Solo permite upload si la deuda está en estado pending, overdue o in_review.
Retorna JSONB con success, message y debt_id.';

-- ============================================
-- PERMISOS
-- ============================================
-- Permitir que usuarios autenticados ejecuten la función
GRANT EXECUTE ON FUNCTION update_debt_proof(UUID, TEXT) TO authenticated;

-- ============================================
-- TESTING MANUAL (Ejecutar después de migración)
-- ============================================
-- 1. Caso exitoso (presidente correcto, deuda pending):
--    SELECT update_debt_proof('uuid-deuda-123', 'https://storage.url/proof.jpg');
--    Esperado: {"success": true, "message": "...", "debt_id": "uuid-deuda-123"}
--
-- 2. Caso de error (presidente incorrecto):
--    Autenticarse como otro usuario
--    SELECT update_debt_proof('uuid-deuda-123', 'https://storage.url/proof.jpg');
--    Esperado: {"success": false, "message": "No tienes permiso..."}
--
-- 3. Caso de error (deuda aprobada):
--    UPDATE arca_debts SET status = 'approved' WHERE id = 'uuid-deuda-123';
--    SELECT update_debt_proof('uuid-deuda-123', 'https://storage.url/proof.jpg');
--    Esperado: {"success": false, "message": "No se puede subir comprobante. Estado actual: approved"}
-- ============================================
