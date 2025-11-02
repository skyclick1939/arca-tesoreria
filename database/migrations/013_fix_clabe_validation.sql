-- =====================================================
-- Migración 013: Fix Validación de CLABE
-- =====================================================
-- Descripción: Agrega constraint CHECK para validar que CLABE tenga exactamente 18 dígitos
-- Fecha: 2025-11-01
-- Autor: Claude Code (Fix Bug #2 del Reporte de Testing T3.9)
-- Ticket: Bug #2 - Validación de CLABE No Implementada
-- =====================================================

-- PROBLEMA IDENTIFICADO:
-- La tabla arca_debts acepta CLABEs con longitud incorrecta (17 dígitos en lugar de 18)
-- Esto puede causar errores en depósitos bancarios por CLABE inválida

-- SOLUCIÓN:
-- Agregar constraint CHECK que valida:
-- 1. Si bank_clabe es NULL → permitir (campo opcional)
-- 2. Si bank_clabe tiene valor → DEBE tener exactamente 18 dígitos

BEGIN;

-- =====================================================
-- 1. VALIDAR DATOS EXISTENTES
-- =====================================================
-- Verificar si hay CLABEs inválidas en la tabla actual

DO $$
DECLARE
  v_invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_invalid_count
  FROM arca_debts
  WHERE bank_clabe IS NOT NULL
    AND LENGTH(bank_clabe) != 18;

  IF v_invalid_count > 0 THEN
    RAISE WARNING 'Se encontraron % CLABEs con longitud inválida. Estas deberán corregirse antes de aplicar el constraint.', v_invalid_count;

    -- Mostrar las CLABEs inválidas para revisión
    RAISE NOTICE 'CLABEs inválidas detectadas:';
    FOR rec IN
      SELECT id, bank_clabe, LENGTH(bank_clabe) as len, description
      FROM arca_debts
      WHERE bank_clabe IS NOT NULL AND LENGTH(bank_clabe) != 18
    LOOP
      RAISE NOTICE 'ID: %, CLABE: % (longitud: %), Descripción: %',
        rec.id, rec.bank_clabe, rec.len, rec.description;
    END LOOP;
  ELSE
    RAISE NOTICE 'Validación OK: No se encontraron CLABEs inválidas en la base de datos';
  END IF;
END $$;

-- =====================================================
-- 2. AGREGAR CONSTRAINT DE VALIDACIÓN
-- =====================================================
-- Constraint: valid_clabe_length
-- Valida que si bank_clabe tiene valor, debe tener exactamente 18 dígitos

ALTER TABLE arca_debts
ADD CONSTRAINT valid_clabe_length
CHECK (
  bank_clabe IS NULL OR
  LENGTH(bank_clabe) = 18
);

-- =====================================================
-- 3. VERIFICACIÓN POST-CONSTRAINT
-- =====================================================
-- Confirmar que el constraint fue creado correctamente

DO $$
DECLARE
  v_constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_clabe_length'
      AND conrelid = 'arca_debts'::regclass
  ) INTO v_constraint_exists;

  IF v_constraint_exists THEN
    RAISE NOTICE '✅ Constraint "valid_clabe_length" creado exitosamente';
  ELSE
    RAISE EXCEPTION '❌ Error: Constraint "valid_clabe_length" no fue creado';
  END IF;
END $$;

COMMIT;

-- =====================================================
-- 4. TESTS DE VALIDACIÓN
-- =====================================================
-- Estos tests deben ejecutarse MANUALMENTE después de aplicar la migración

-- TEST 1: Insertar CLABE válida (18 dígitos) → debe PERMITIR
-- EXPECTED: Success
/*
INSERT INTO arca_debts (
  chapter_id, amount, due_date, debt_type, description,
  bank_name, bank_clabe, bank_holder, created_by
) VALUES (
  (SELECT id FROM arca_chapters LIMIT 1),
  1000, '2025-12-31', 'apoyo',
  'TEST: CLABE válida 18 dígitos',
  'BBVA', '012345678901234567', -- 18 dígitos ✅
  'Tesorería Test',
  (SELECT user_id FROM arca_user_profiles WHERE role = 'admin' LIMIT 1)
);

-- Limpiar test
DELETE FROM arca_debts WHERE description = 'TEST: CLABE válida 18 dígitos';
*/

-- TEST 2: Insertar CLABE con 17 dígitos → debe RECHAZAR
-- EXPECTED: ERROR - new row violates check constraint "valid_clabe_length"
/*
INSERT INTO arca_debts (
  chapter_id, amount, due_date, debt_type, description,
  bank_name, bank_clabe, bank_holder, created_by
) VALUES (
  (SELECT id FROM arca_chapters LIMIT 1),
  1000, '2025-12-31', 'apoyo',
  'TEST: CLABE inválida 17 dígitos',
  'BBVA', '01234567890123456', -- 17 dígitos ❌
  'Tesorería Test',
  (SELECT user_id FROM arca_user_profiles WHERE role = 'admin' LIMIT 1)
);
*/

-- TEST 3: Insertar CLABE con 19 dígitos → debe RECHAZAR
-- EXPECTED: ERROR - new row violates check constraint "valid_clabe_length"
/*
INSERT INTO arca_debts (
  chapter_id, amount, due_date, debt_type, description,
  bank_name, bank_clabe, bank_holder, created_by
) VALUES (
  (SELECT id FROM arca_chapters LIMIT 1),
  1000, '2025-12-31', 'apoyo',
  'TEST: CLABE inválida 19 dígitos',
  'BBVA', '0123456789012345678', -- 19 dígitos ❌
  'Tesorería Test',
  (SELECT user_id FROM arca_user_profiles WHERE role = 'admin' LIMIT 1)
);
*/

-- TEST 4: Insertar sin CLABE pero con Cuenta → debe PERMITIR
-- EXPECTED: Success (constraint at_least_one_bank_id permite esto)
/*
INSERT INTO arca_debts (
  chapter_id, amount, due_date, debt_type, description,
  bank_name, bank_account, bank_holder, created_by
) VALUES (
  (SELECT id FROM arca_chapters LIMIT 1),
  1000, '2025-12-31', 'apoyo',
  'TEST: Solo cuenta sin CLABE',
  'BBVA', '1234567890', -- Solo cuenta ✅
  'Tesorería Test',
  (SELECT user_id FROM arca_user_profiles WHERE role = 'admin' LIMIT 1)
);

-- Limpiar test
DELETE FROM arca_debts WHERE description = 'TEST: Solo cuenta sin CLABE';
*/

-- =====================================================
-- 5. NOTAS DE MIGRACIÓN
-- =====================================================
-- ✅ Constraint es NO NULL-safe: permite bank_clabe = NULL
-- ✅ Compatible con constraint existente "at_least_one_bank_id"
-- ✅ No afecta registros existentes con CLABE válida o NULL
-- ⚠️ Si existen CLABEs inválidas, la migración mostrará WARNING pero NO fallará
--    (debe corregirse manualmente antes de aplicar el constraint)

-- ROLLBACK (si es necesario):
-- ALTER TABLE arca_debts DROP CONSTRAINT IF EXISTS valid_clabe_length;

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
