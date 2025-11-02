-- ============================================
-- Migración 012: Optimización de Índices para Dashboard
-- ============================================
-- Fecha: 01/11/2025
-- Propósito: Agregar índice en arca_debts.created_at para optimizar
--            "Últimas Transacciones" en Dashboard Admin
--
-- Sprint 3 - T3.6: Optimización de Queries y Performance
-- ============================================

-- ============================================
-- ÍNDICE 4: Optimización de "Últimas Transacciones"
-- ============================================
-- Dashboard Admin Tab 1 muestra las últimas 10 deudas
-- ordenadas por created_at DESC
--
-- Sin este índice, PostgreSQL debe hacer table scan completo
-- y ordenar en memoria cada vez que se carga el dashboard.
--
-- Con este índice, el ordenamiento es instantáneo.
-- ============================================

CREATE INDEX IF NOT EXISTS idx_arca_debts_created_at
ON arca_debts(created_at DESC);

COMMENT ON INDEX idx_arca_debts_created_at IS 'Optimiza "Últimas Transacciones" en Dashboard Admin (order by created_at DESC)';

-- ============================================
-- TESTING MANUAL (Ejecutar después de migración)
-- ============================================
-- 1. Verificar que el índice fue creado:
--    SELECT indexname, indexdef
--    FROM pg_indexes
--    WHERE tablename = 'arca_debts' AND indexname = 'idx_arca_debts_created_at';
--
-- 2. Ver plan de ejecución ANTES del índice:
--    EXPLAIN ANALYZE
--    SELECT * FROM arca_debts
--    ORDER BY created_at DESC
--    LIMIT 10;
--    -- Esperado SIN índice: "Seq Scan" + "Sort"
--
-- 3. Ver plan de ejecución DESPUÉS del índice:
--    EXPLAIN ANALYZE
--    SELECT * FROM arca_debts
--    ORDER BY created_at DESC
--    LIMIT 10;
--    -- Esperado CON índice: "Index Scan using idx_arca_debts_created_at"
--
-- 4. Performance esperada:
--    - Con 100 deudas: ~0.1ms (vs ~5ms sin índice)
--    - Con 1000 deudas: ~0.2ms (vs ~50ms sin índice)
--    - Con 10000 deudas: ~0.3ms (vs ~500ms sin índice)
-- ============================================

-- ============================================
-- ROLLBACK (si es necesario)
-- ============================================
-- DROP INDEX IF EXISTS idx_arca_debts_created_at;
-- ============================================
