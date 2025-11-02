-- ============================================
-- MIGRACIÓN 006: CONFIGURACIÓN DE STORAGE BUCKET
-- ============================================
-- Proyecto: El Arca - Sistema de Tesorería para Moto Club
-- Descripción: Crear bucket para comprobantes de pago con RLS policies
-- Versión: 2.1
-- Fecha: 23 de Octubre de 2025
-- ============================================

-- ⚠️ IMPORTANTE: Ejecutar desde SQL Editor de Supabase Dashboard
-- Este script configura el almacenamiento para comprobantes de pago (PDFs e imágenes)

-- ============================================
-- PASO 1: CREAR BUCKET DE STORAGE
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'arca-comprobantes',
  'arca-comprobantes',
  false,                -- Bucket PRIVADO (requiere autenticación)
  5242880,              -- 5 MB máximo por archivo
  ARRAY['image/png', 'image/jpeg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- PASO 2: HABILITAR RLS EN STORAGE.OBJECTS
-- ============================================

-- RLS ya está habilitado por defecto en storage.objects
-- Verificar con: SELECT * FROM pg_tables WHERE tablename = 'objects' AND schemaname = 'storage';

-- ============================================
-- PASO 3: POLICIES PARA UPLOAD (INSERT)
-- ============================================

-- Policy 1: Solo Presidentes pueden subir comprobantes a SU capítulo
CREATE POLICY "Presidents upload to own chapter"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'arca-comprobantes' AND
  -- Extraer chapter_id del path (formato: chapter_id/debt_id/filename)
  (storage.foldername(name))[1] IN (
    SELECT c.id::TEXT
    FROM arca_chapters c
    WHERE c.president_id = auth.uid()
  )
);

-- Policy 2: Admins pueden subir a cualquier capítulo (para casos excepcionales)
CREATE POLICY "Admins upload to any chapter"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'arca-comprobantes' AND
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- PASO 4: POLICIES PARA DESCARGA (SELECT)
-- ============================================

-- Policy 3: Admins pueden ver TODOS los comprobantes
CREATE POLICY "Admins view all proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'arca-comprobantes' AND
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy 4: Presidentes solo ven comprobantes de SU capítulo
CREATE POLICY "Presidents view own chapter proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'arca-comprobantes' AND
  -- Extraer chapter_id del path
  (storage.foldername(name))[1] IN (
    SELECT c.id::TEXT
    FROM arca_chapters c
    WHERE c.president_id = auth.uid()
  )
);

-- ============================================
-- PASO 5: POLICIES PARA ACTUALIZACIÓN (UPDATE)
-- ============================================

-- Policy 5: Solo Presidentes pueden actualizar (reemplazar) comprobantes de SU capítulo
CREATE POLICY "Presidents update own chapter proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'arca-comprobantes' AND
  (storage.foldername(name))[1] IN (
    SELECT c.id::TEXT
    FROM arca_chapters c
    WHERE c.president_id = auth.uid()
  )
);

-- Policy 6: Admins pueden actualizar cualquier comprobante
CREATE POLICY "Admins update all proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'arca-comprobantes' AND
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- PASO 6: POLICIES PARA ELIMINACIÓN (DELETE)
-- ============================================

-- Policy 7: Solo Presidentes pueden eliminar comprobantes de SU capítulo
-- (útil para reemplazar archivo antes de aprobación)
CREATE POLICY "Presidents delete own chapter proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'arca-comprobantes' AND
  (storage.foldername(name))[1] IN (
    SELECT c.id::TEXT
    FROM arca_chapters c
    WHERE c.president_id = auth.uid()
  )
);

-- Policy 8: Admins pueden eliminar cualquier comprobante
CREATE POLICY "Admins delete all proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'arca-comprobantes' AND
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- PASO 7: VERIFICACIÓN FINAL
-- ============================================

DO $$
DECLARE
  v_bucket_exists BOOLEAN;
  v_policy_count INTEGER;
BEGIN
  -- Verificar que el bucket existe
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'arca-comprobantes'
  ) INTO v_bucket_exists;

  IF NOT v_bucket_exists THEN
    RAISE EXCEPTION 'Error: Bucket arca-comprobantes no fue creado';
  END IF;

  -- Contar políticas de storage.objects
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname LIKE '%arca%' OR policyname LIKE '%Presidents%' OR policyname LIKE '%Admins%';

  RAISE NOTICE '';
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '✅ MIGRACIÓN 006 EJECUTADA EXITOSAMENTE';
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Bucket creado: arca-comprobantes';
  RAISE NOTICE 'Tamaño máximo: 5 MB';
  RAISE NOTICE 'Tipos permitidos: PNG, JPEG, PDF';
  RAISE NOTICE 'Políticas RLS creadas: % (esperadas: 8)', v_policy_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Estructura de paths:';
  RAISE NOTICE '  arca-comprobantes/{chapter_id}/{debt_id}/{timestamp}-{filename}.{ext}';
  RAISE NOTICE '';
  RAISE NOTICE 'Ejemplo:';
  RAISE NOTICE '  arca-comprobantes/uuid-chapter-123/uuid-debt-456/1729641234567-comprobante.pdf';
  RAISE NOTICE '';
END $$;

-- ============================================
-- FIN DE MIGRACIÓN 006
-- ============================================
