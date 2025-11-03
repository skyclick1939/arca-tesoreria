-- Migración 014: Tabla de Configuración del Sistema
-- Fecha: 02/11/2025
-- Propósito: Centralizar configuraciones globales del sistema

-- ============================================================================
-- 1. CREAR TABLA arca_system_config
-- ============================================================================

CREATE TABLE IF NOT EXISTS arca_system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- 2. COMENTARIOS DE DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE arca_system_config IS 'Configuraciones globales del sistema';
COMMENT ON COLUMN arca_system_config.key IS 'Clave única de configuración (snake_case)';
COMMENT ON COLUMN arca_system_config.value IS 'Valor en formato JSON (permite tipos complejos)';
COMMENT ON COLUMN arca_system_config.description IS 'Descripción legible de la configuración';
COMMENT ON COLUMN arca_system_config.category IS 'Categoría: general, debts, uploads, notifications';
COMMENT ON COLUMN arca_system_config.updated_at IS 'Timestamp de última actualización';
COMMENT ON COLUMN arca_system_config.updated_by IS 'Usuario que realizó el último cambio';

-- ============================================================================
-- 3. INSERTAR CONFIGURACIONES INICIALES
-- ============================================================================

INSERT INTO arca_system_config (key, value, description, category) VALUES
  -- Configuraciones de Deudas
  ('debt_overdue_days', '30', 'Días antes de marcar una deuda como vencida', 'debts'),
  ('debt_reminder_enabled', 'false', 'Habilitar recordatorios automáticos de deudas', 'debts'),
  ('debt_reminder_days_before', '7', 'Días antes del vencimiento para enviar recordatorio', 'debts'),

  -- Configuraciones de Comprobantes
  ('max_upload_size_mb', '5', 'Tamaño máximo permitido para comprobantes en MB', 'uploads'),
  ('allowed_file_types', '["image/png", "image/jpeg", "application/pdf"]', 'Tipos MIME permitidos para comprobantes', 'uploads'),
  ('compress_images', 'true', 'Comprimir imágenes automáticamente al subir', 'uploads'),

  -- Configuraciones Generales
  ('system_name', '"El Arca"', 'Nombre del sistema', 'general'),
  ('support_email', '"tesoreria@arca.local"', 'Email de contacto para soporte', 'general'),
  ('maintenance_mode', 'false', 'Activar modo mantenimiento (bloquea acceso excepto admins)', 'general'),

  -- Configuraciones de Notificaciones
  ('notification_emails', '["admin@arca.local"]', 'Lista de emails para recibir notificaciones críticas', 'notifications'),
  ('notify_on_debt_approved', 'true', 'Notificar cuando se aprueba un pago', 'notifications'),
  ('notify_on_chapter_created', 'false', 'Notificar cuando se crea un capítulo nuevo', 'notifications')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 4. RLS POLICIES - Solo admins pueden editar configuración
-- ============================================================================

-- Habilitar RLS
ALTER TABLE arca_system_config ENABLE ROW LEVEL SECURITY;

-- Policy 1: Todos pueden leer configuración (necesario para funcionamiento)
CREATE POLICY "Anyone can read system config"
ON arca_system_config FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Solo admins pueden insertar configuración
CREATE POLICY "Only admins can insert config"
ON arca_system_config FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy 3: Solo admins pueden actualizar configuración
CREATE POLICY "Only admins can update config"
ON arca_system_config FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy 4: Solo admins pueden eliminar configuración
CREATE POLICY "Only admins can delete config"
ON arca_system_config FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================================================
-- 5. ÍNDICES PARA PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_arca_system_config_category
ON arca_system_config(category);

CREATE INDEX IF NOT EXISTS idx_arca_system_config_updated_at
ON arca_system_config(updated_at DESC);

-- ============================================================================
-- 6. TRIGGER PARA ACTUALIZAR updated_at AUTOMÁTICAMENTE
-- ============================================================================

CREATE OR REPLACE FUNCTION update_arca_system_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_arca_system_config_updated_at
BEFORE UPDATE ON arca_system_config
FOR EACH ROW
EXECUTE FUNCTION update_arca_system_config_updated_at();

-- ============================================================================
-- FIN DE MIGRACIÓN 014
-- ============================================================================
