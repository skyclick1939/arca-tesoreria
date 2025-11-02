-- ============================================
-- MIGRACIÓN 005: ACTUALIZAR ENUM regional_enum
-- ============================================
-- Proyecto: El Arca - Sistema de Tesorería para Moto Club
-- Descripción: Agrega valores 'Occidente' y 'Bajío' al ENUM existente
-- Versión: 2.1
-- Fecha: 23 de Octubre de 2025
-- ============================================

-- ⚠️ IMPORTANTE: Este script es IDEMPOTENTE
-- Puedes ejecutarlo múltiples veces sin causar errores
-- Solo agrega los valores si NO existen

-- ============================================
-- PASO 1: AGREGAR 'Occidente' SI NO EXISTE
-- ============================================

DO $$
BEGIN
  -- Verificar si 'Occidente' ya existe en el ENUM
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'Occidente'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'regional_enum'
      )
  ) THEN
    -- Agregar 'Occidente' al ENUM
    ALTER TYPE regional_enum ADD VALUE 'Occidente';
    RAISE NOTICE '✅ Valor ''Occidente'' agregado a regional_enum';
  ELSE
    RAISE NOTICE 'ℹ️  Valor ''Occidente'' ya existe en regional_enum (omitiendo)';
  END IF;
END $$;

-- ============================================
-- PASO 2: AGREGAR 'Bajío' SI NO EXISTE
-- ============================================

DO $$
BEGIN
  -- Verificar si 'Bajío' ya existe en el ENUM
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'Bajío'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'regional_enum'
      )
  ) THEN
    -- Agregar 'Bajío' al ENUM
    ALTER TYPE regional_enum ADD VALUE 'Bajío';
    RAISE NOTICE '✅ Valor ''Bajío'' agregado a regional_enum';
  ELSE
    RAISE NOTICE 'ℹ️  Valor ''Bajío'' ya existe en regional_enum (omitiendo)';
  END IF;
END $$;

-- ============================================
-- PASO 3: VERIFICACIÓN FINAL
-- ============================================

DO $$
DECLARE
  v_enum_values TEXT[];
BEGIN
  -- Obtener todos los valores del ENUM
  SELECT ARRAY_AGG(enumlabel ORDER BY enumsortorder)
  INTO v_enum_values
  FROM pg_enum
  WHERE enumtypid = (
    SELECT oid FROM pg_type WHERE typname = 'regional_enum'
  );

  RAISE NOTICE '';
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '✅ MIGRACIÓN 005 EJECUTADA EXITOSAMENTE';
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Valores actuales de regional_enum: %', v_enum_values;
  RAISE NOTICE '';
  RAISE NOTICE 'Valores esperados:';
  RAISE NOTICE '  1. Centro';
  RAISE NOTICE '  2. Norte';
  RAISE NOTICE '  3. Sur';
  RAISE NOTICE '  4. Este';
  RAISE NOTICE '  5. Occidente';
  RAISE NOTICE '  6. Bajío';
  RAISE NOTICE '';
END $$;

-- ============================================
-- FIN DE MIGRACIÓN 005
-- ============================================
