-- ============================================
-- MIGRACIÓN 001: SCHEMA INICIAL
-- ============================================
-- Proyecto: El Arca - Sistema de Tesorería para Moto Club
-- Descripción: Crea ENUMs, tablas principales e índices
-- Versión: 2.1
-- Fecha: 22 de Octubre de 2025
-- ============================================

-- ============================================
-- PASO 1: ENUMS
-- ============================================

-- Roles de usuario
CREATE TYPE user_role AS ENUM ('admin', 'president');

-- Tipos de deuda
CREATE TYPE debt_type_enum AS ENUM ('apoyo', 'aportacion', 'multa');

-- Estados de deuda
CREATE TYPE debt_status_enum AS ENUM ('pending', 'overdue', 'in_review', 'approved');

-- Regionales de México
CREATE TYPE regional_enum AS ENUM ('Centro', 'Norte', 'Sur', 'Este', 'Occidente', 'Bajío');

-- ============================================
-- PASO 2: TABLAS PRINCIPALES
-- ============================================

-- --------------------------------------------
-- TABLA 1: arca_user_profiles
-- --------------------------------------------
-- Extiende auth.users de Supabase con información de perfil
-- Relación 1:1 con auth.users

CREATE TABLE arca_user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'president',
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE arca_user_profiles IS 'Perfiles de usuario extendidos (Admin y Presidentes)';
COMMENT ON COLUMN arca_user_profiles.user_id IS 'FK a auth.users de Supabase';
COMMENT ON COLUMN arca_user_profiles.role IS 'Rol: admin (1 único) o president (múltiples)';
COMMENT ON COLUMN arca_user_profiles.full_name IS 'Nombre completo del usuario';

-- --------------------------------------------
-- TABLA 2: arca_chapters
-- --------------------------------------------
-- Capítulos del moto club (regionales)
-- Cada capítulo tiene un presidente asignado

CREATE TABLE arca_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  regional regional_enum NOT NULL,
  president_id UUID REFERENCES arca_user_profiles(user_id) ON DELETE SET NULL,
  member_count INTEGER NOT NULL CHECK (member_count > 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE arca_chapters IS 'Capítulos regionales del moto club';
COMMENT ON COLUMN arca_chapters.name IS 'Nombre único del capítulo (ej. "Capítulo Norte")';
COMMENT ON COLUMN arca_chapters.regional IS 'Regional a la que pertenece';
COMMENT ON COLUMN arca_chapters.president_id IS 'FK al usuario con rol president';
COMMENT ON COLUMN arca_chapters.member_count IS 'Cantidad de miembros del capítulo (para cálculo proporcional)';
COMMENT ON COLUMN arca_chapters.is_active IS 'Si es false, no recibe nuevas deudas';

-- --------------------------------------------
-- TABLA 3: arca_debts
-- --------------------------------------------
-- Deudas asignadas a capítulos (apoyos, aportaciones, multas)
-- Incluye campos bancarios para transferencias

CREATE TABLE arca_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES arca_chapters(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  debt_type debt_type_enum NOT NULL,
  status debt_status_enum NOT NULL DEFAULT 'pending',
  description TEXT,

  -- ==========================================
  -- CAMPOS BANCARIOS (v1.1 - 22/10/2025)
  -- ==========================================
  bank_name TEXT NOT NULL,              -- ej. "BBVA", "Santander"
  bank_clabe VARCHAR(18),               -- CLABE Interbancaria (18 dígitos, opcional)
  bank_account VARCHAR(16),             -- Número de cuenta (10-16 dígitos, opcional)
  bank_holder TEXT NOT NULL,            -- Titular de la cuenta (obligatorio)

  -- Comprobante de pago
  proof_file_url TEXT,                  -- URL del archivo en Storage
  proof_uploaded_at TIMESTAMPTZ,        -- Timestamp de subida

  -- Auditoría
  approved_at TIMESTAMPTZ,              -- Timestamp de aprobación por Admin
  created_by UUID REFERENCES arca_user_profiles(user_id),  -- Usuario que creó la deuda
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- ==========================================
  -- CONSTRAINT CRÍTICO: VALIDACIÓN BANCARIA
  -- ==========================================
  -- Al menos uno de CLABE o Número de Cuenta debe estar lleno
  CONSTRAINT at_least_one_bank_id CHECK (
    bank_clabe IS NOT NULL OR bank_account IS NOT NULL
  )
);

COMMENT ON TABLE arca_debts IS 'Deudas asignadas a capítulos (cálculo proporcional por miembros)';
COMMENT ON COLUMN arca_debts.chapter_id IS 'FK al capítulo que debe pagar';
COMMENT ON COLUMN arca_debts.amount IS 'Monto proporcional calculado: (Total / Miembros Globales) × Miembros Capítulo';
COMMENT ON COLUMN arca_debts.due_date IS 'Fecha límite de pago';
COMMENT ON COLUMN arca_debts.debt_type IS 'Tipo: apoyo, aportacion o multa';
COMMENT ON COLUMN arca_debts.status IS 'Estado: pending → overdue → in_review → approved';
COMMENT ON COLUMN arca_debts.description IS 'Concepto de la deuda (ej. "Apoyo Evento Aniversario")';
COMMENT ON COLUMN arca_debts.bank_name IS 'Banco destino (dropdown de 20 bancos mexicanos)';
COMMENT ON COLUMN arca_debts.bank_clabe IS 'CLABE Interbancaria de 18 dígitos (opcional si hay Cuenta)';
COMMENT ON COLUMN arca_debts.bank_account IS 'Número de cuenta 10-16 dígitos (opcional si hay CLABE)';
COMMENT ON COLUMN arca_debts.bank_holder IS 'Nombre del titular de la cuenta';
COMMENT ON COLUMN arca_debts.proof_file_url IS 'URL del comprobante subido por Presidente';
COMMENT ON COLUMN arca_debts.proof_uploaded_at IS 'Fecha en que Presidente subió comprobante (cambia status a in_review)';
COMMENT ON COLUMN arca_debts.approved_at IS 'Fecha en que Admin aprobó el comprobante (cambia status a approved)';
COMMENT ON COLUMN arca_debts.created_by IS 'Usuario Admin que creó la solicitud original';
COMMENT ON CONSTRAINT at_least_one_bank_id ON arca_debts IS 'Validación: CLABE o Cuenta obligatorio (mínimo 1)';

-- --------------------------------------------
-- TABLA 4: arca_audit_logs
-- --------------------------------------------
-- Log de auditoría de cambios críticos
-- Trigger automático en UPDATE de arca_debts

CREATE TABLE arca_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,             -- Tabla afectada
  record_id UUID NOT NULL,              -- ID del registro modificado
  action TEXT NOT NULL,                 -- Acción: INSERT, UPDATE, DELETE
  old_values JSONB,                     -- Valores antes del cambio
  new_values JSONB,                     -- Valores después del cambio
  user_id UUID REFERENCES arca_user_profiles(user_id),  -- Usuario que hizo el cambio
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE arca_audit_logs IS 'Log de auditoría para cambios críticos (status, comprobantes)';
COMMENT ON COLUMN arca_audit_logs.table_name IS 'Nombre de la tabla modificada';
COMMENT ON COLUMN arca_audit_logs.record_id IS 'UUID del registro afectado';
COMMENT ON COLUMN arca_audit_logs.action IS 'Tipo de acción: UPDATE, INSERT, DELETE';
COMMENT ON COLUMN arca_audit_logs.old_values IS 'JSONB con valores anteriores';
COMMENT ON COLUMN arca_audit_logs.new_values IS 'JSONB con valores nuevos';
COMMENT ON COLUMN arca_audit_logs.user_id IS 'Usuario que realizó la acción (auth.uid())';

-- ============================================
-- PASO 3: ÍNDICES OPTIMIZADOS
-- ============================================

-- Índice 1: Consulta frecuente del dashboard de Presidente
-- Filtra deudas de su capítulo con status pending/overdue
CREATE INDEX idx_arca_debts_chapter_status
ON arca_debts(chapter_id, status)
WHERE status IN ('pending', 'overdue');

COMMENT ON INDEX idx_arca_debts_chapter_status IS 'Optimiza carga de dashboard de Presidente (filtro por capítulo y status)';

-- Índice 2: Función mark_overdue_debts()
-- Busca deudas pending vencidas para marcar como overdue
CREATE INDEX idx_arca_debts_overdue
ON arca_debts(due_date)
WHERE status = 'pending' AND proof_uploaded_at IS NULL;

COMMENT ON INDEX idx_arca_debts_overdue IS 'Optimiza función mark_overdue_debts() (búsqueda de vencidas)';

-- Índice 3: Consultas de auditoría
-- Buscar logs por tabla + registro + fecha descendente
CREATE INDEX idx_arca_audit_logs_lookup
ON arca_audit_logs(table_name, record_id, created_at DESC);

COMMENT ON INDEX idx_arca_audit_logs_lookup IS 'Optimiza consultas de auditoría por tabla y registro';

-- ============================================
-- FIN DE MIGRACIÓN 001
-- ============================================

-- Verificación rápida
DO $$
BEGIN
  RAISE NOTICE '✅ Migración 001 ejecutada exitosamente';
  RAISE NOTICE 'Tablas creadas: arca_user_profiles, arca_chapters, arca_debts, arca_audit_logs';
  RAISE NOTICE 'ENUMs creados: user_role, debt_type_enum, debt_status_enum, regional_enum';
  RAISE NOTICE 'Índices creados: 3';
  RAISE NOTICE 'Siguiente paso: Ejecutar 002_rls_policies.sql';
END $$;
