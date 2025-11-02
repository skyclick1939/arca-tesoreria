-- ============================================
-- SEED DATA: DATOS DE DESARROLLO/TESTING
-- ============================================
-- Proyecto: El Arca - Sistema de Tesorería para Moto Club
-- Descripción: Datos de prueba para desarrollo local
-- Versión: 2.1
-- Fecha: 22 de Octubre de 2025
-- ============================================

-- ⚠️  ADVERTENCIA: SOLO EJECUTAR EN AMBIENTE DE DESARROLLO
-- ⚠️  NO ejecutar en producción (eliminar usuarios reales)

-- ============================================
-- PASO 0: VERIFICACIÓN DE AMBIENTE
-- ============================================

DO $$
BEGIN
  -- Verificar que NO estemos en producción
  IF current_database() = 'production' OR current_database() LIKE '%prod%' THEN
    RAISE EXCEPTION 'PROHIBIDO ejecutar seed data en base de datos de producción';
  END IF;

  RAISE NOTICE '✅ Ambiente verificado: % (desarrollo)', current_database();
END $$;

-- ============================================
-- PASO 1: LIMPIAR DATOS ANTERIORES
-- ============================================

-- Eliminar en orden inverso (por dependencias FK)
TRUNCATE TABLE arca_audit_logs CASCADE;
TRUNCATE TABLE arca_debts CASCADE;
TRUNCATE TABLE arca_chapters CASCADE;
TRUNCATE TABLE arca_user_profiles CASCADE;

DO $$
BEGIN
  RAISE NOTICE 'Tablas limpiadas para seed fresh';
END $$;

-- ============================================
-- PASO 2: VERIFICAR USUARIOS CREADOS
-- ============================================

-- ⚠️  ANTES DE EJECUTAR ESTE SEED, DEBES CREAR USUARIOS EN SUPABASE AUTH
--
-- Ir a: Supabase Dashboard → Authentication → Add User
--
-- Crear los siguientes usuarios (Capítulos de Jalisco):
-- 1. admin@arca.local (password: admin123) → Role: admin
-- 2. pres.vallarta@arca.local (password: pres123) → Capítulo Vallarta
-- 3. pres.tonala@arca.local (password: pres123) → Capítulo Tonalá
-- 4. pres.guadalajara@arca.local (password: pres123) → Capítulo Guadalajara
-- 5. pres.zapopan@arca.local (password: pres123) → Capítulo Zapopan
-- 6. pres.poncitlan@arca.local (password: pres123) → Capítulo Poncitlán
-- 7. pres.ixtlahuacan@arca.local (password: pres123) → Capítulo Ixtlahuacán
--
-- El trigger 'on_auth_user_created' creará automáticamente el perfil en arca_user_profiles

DO $$
DECLARE
  v_user_count INTEGER;
BEGIN
  -- Verificar que existan al menos 7 usuarios (1 admin + 6 presidentes)
  SELECT COUNT(*) INTO v_user_count FROM arca_user_profiles;

  IF v_user_count < 7 THEN
    RAISE EXCEPTION 'Error: Solo hay % usuarios en arca_user_profiles. Debes crear 7 usuarios en Supabase Auth antes de ejecutar este seed (1 admin + 6 presidentes).', v_user_count;
  END IF;

  RAISE NOTICE '✅ Verificación OK: % usuarios encontrados', v_user_count;
END $$;

-- Convertir el primer usuario admin en Admin (solo para seed de desarrollo)
DO $$
BEGIN
  UPDATE arca_user_profiles
  SET role = 'admin', full_name = 'Administrador Principal'
  WHERE user_id = (
    SELECT u.id FROM auth.users u
    WHERE u.email LIKE '%admin%'
    LIMIT 1
  );

  IF NOT FOUND THEN
    RAISE NOTICE '⚠️  No se encontró usuario admin. Créalo manualmente con email: admin@arca.local';
  ELSE
    RAISE NOTICE '✅ Usuario admin configurado correctamente';
  END IF;
END $$;

-- ============================================
-- PASO 3: CREAR CAPÍTULOS DE JALISCO
-- ============================================

DO $$
DECLARE
  v_pres_vallarta_id UUID;
  v_pres_tonala_id UUID;
  v_pres_guadalajara_id UUID;
  v_pres_zapopan_id UUID;
  v_pres_poncitlan_id UUID;
  v_pres_ixtlahuacan_id UUID;
BEGIN
  -- Obtener UUIDs de presidentes basados en email
  SELECT u.id INTO v_pres_vallarta_id FROM auth.users u WHERE u.email = 'pres.vallarta@arca.local';
  SELECT u.id INTO v_pres_tonala_id FROM auth.users u WHERE u.email = 'pres.tonala@arca.local';
  SELECT u.id INTO v_pres_guadalajara_id FROM auth.users u WHERE u.email = 'pres.guadalajara@arca.local';
  SELECT u.id INTO v_pres_zapopan_id FROM auth.users u WHERE u.email = 'pres.zapopan@arca.local';
  SELECT u.id INTO v_pres_poncitlan_id FROM auth.users u WHERE u.email = 'pres.poncitlan@arca.local';
  SELECT u.id INTO v_pres_ixtlahuacan_id FROM auth.users u WHERE u.email = 'pres.ixtlahuacan@arca.local';

  -- Validar que todos los presidentes existan
  IF v_pres_vallarta_id IS NULL OR v_pres_tonala_id IS NULL OR
     v_pres_guadalajara_id IS NULL OR v_pres_zapopan_id IS NULL OR
     v_pres_poncitlan_id IS NULL OR v_pres_ixtlahuacan_id IS NULL THEN
    RAISE EXCEPTION 'Error: No se encontraron todos los presidentes. Verifica que los 6 usuarios presidentes estén creados en Supabase Auth.';
  END IF;

  -- Insertar capítulos de Jalisco con UUIDs reales (Regional Occidente)
  INSERT INTO arca_chapters (name, regional, president_id, member_count, is_active)
  VALUES
    ('Capítulo Vallarta', 'Occidente', v_pres_vallarta_id, 18, true),
    ('Capítulo Tonalá', 'Occidente', v_pres_tonala_id, 12, true),
    ('Capítulo Guadalajara', 'Occidente', v_pres_guadalajara_id, 25, true),
    ('Capítulo Zapopan', 'Occidente', v_pres_zapopan_id, 15, true),
    ('Capítulo Poncitlán', 'Occidente', v_pres_poncitlan_id, 10, true),
    ('Capítulo Ixtlahuacán', 'Occidente', v_pres_ixtlahuacan_id, 8, true),
    ('Capítulo Lagos (Inactivo)', 'Occidente', NULL, 6, false);

  RAISE NOTICE '✅ Capítulos de Jalisco creados exitosamente';
  RAISE NOTICE '   - Vallarta (18 miembros)';
  RAISE NOTICE '   - Tonalá (12 miembros)';
  RAISE NOTICE '   - Guadalajara (25 miembros)';
  RAISE NOTICE '   - Zapopan (15 miembros)';
  RAISE NOTICE '   - Poncitlán (10 miembros)';
  RAISE NOTICE '   - Ixtlahuacán (8 miembros)';
  RAISE NOTICE '   - Lagos - INACTIVO (6 miembros)';
END $$;

-- ============================================
-- PASO 4: CREAR DEUDAS DE PRUEBA
-- ============================================

DO $$
DECLARE
  v_admin_id UUID;
  v_vallarta_id UUID;
  v_tonala_id UUID;
  v_guadalajara_id UUID;
  v_zapopan_id UUID;
  v_debt_vallarta_id UUID;
  v_debt_tonala_id UUID;
  v_debt_guadalajara_id UUID;
  v_debt_zapopan_id UUID;
BEGIN
  -- Obtener IDs de admin y capítulos
  SELECT u.id INTO v_admin_id FROM auth.users u WHERE u.email LIKE '%admin%' LIMIT 1;
  SELECT id INTO v_vallarta_id FROM arca_chapters WHERE name = 'Capítulo Vallarta';
  SELECT id INTO v_tonala_id FROM arca_chapters WHERE name = 'Capítulo Tonalá';
  SELECT id INTO v_guadalajara_id FROM arca_chapters WHERE name = 'Capítulo Guadalajara';
  SELECT id INTO v_zapopan_id FROM arca_chapters WHERE name = 'Capítulo Zapopan';

  -- Solicitud 1: Apoyo Evento Aniversario (vencida hace 10 días)
  -- Vallarta: overdue (no ha subido comprobante)
  INSERT INTO arca_debts (
    chapter_id, amount, due_date, debt_type, status, description,
    bank_name, bank_clabe, bank_account, bank_holder, created_by
  )
  VALUES (
    v_vallarta_id, 3000.00, CURRENT_DATE - INTERVAL '10 days', 'apoyo', 'overdue',
    'Apoyo Evento Aniversario del Club',
    'BBVA', '012180001234567890', NULL, 'Club Arca Tesorería A.C.', v_admin_id
  )
  RETURNING id INTO v_debt_vallarta_id;

  -- Tonalá: in_review (subió comprobante hace 3 días)
  INSERT INTO arca_debts (
    chapter_id, amount, due_date, debt_type, status, description,
    bank_name, bank_clabe, bank_account, bank_holder, created_by,
    proof_file_url, proof_uploaded_at
  )
  VALUES (
    v_tonala_id, 2400.00, CURRENT_DATE - INTERVAL '10 days', 'apoyo', 'in_review',
    'Apoyo Evento Aniversario del Club',
    'BBVA', '012180001234567890', NULL, 'Club Arca Tesorería A.C.', v_admin_id,
    'https://example.com/comprobante-tonala-1.pdf', CURRENT_TIMESTAMP - INTERVAL '3 days'
  )
  RETURNING id INTO v_debt_tonala_id;

  -- Guadalajara: approved (pagó hace 5 días)
  INSERT INTO arca_debts (
    chapter_id, amount, due_date, debt_type, status, description,
    bank_name, bank_clabe, bank_account, bank_holder, created_by,
    proof_file_url, proof_uploaded_at, approved_at
  )
  VALUES (
    v_guadalajara_id, 4000.00, CURRENT_DATE - INTERVAL '10 days', 'apoyo', 'approved',
    'Apoyo Evento Aniversario del Club',
    'BBVA', '012180001234567890', NULL, 'Club Arca Tesorería A.C.', v_admin_id,
    'https://example.com/comprobante-guadalajara-1.pdf',
    CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'
  )
  RETURNING id INTO v_debt_guadalajara_id;

  -- Zapopan: overdue (vencido)
  INSERT INTO arca_debts (
    chapter_id, amount, due_date, debt_type, status, description,
    bank_name, bank_clabe, bank_account, bank_holder, created_by
  )
  VALUES (
    v_zapopan_id, 1600.00, CURRENT_DATE - INTERVAL '10 days', 'apoyo', 'overdue',
    'Apoyo Evento Aniversario del Club',
    'BBVA', '012180001234567890', NULL, 'Club Arca Tesorería A.C.', v_admin_id
  )
  RETURNING id INTO v_debt_zapopan_id;

  RAISE NOTICE '✅ Solicitud 1 creada (Apoyo Aniversario)';
END $$;

-- Solicitud 2: Aportación Fondo de Emergencias (vence en 15 días)
DO $$
DECLARE
  v_admin_id UUID;
  v_poncitlan_id UUID;
  v_ixtlahuacan_id UUID;
BEGIN
  SELECT u.id INTO v_admin_id FROM auth.users u WHERE u.email LIKE '%admin%' LIMIT 1;
  SELECT id INTO v_poncitlan_id FROM arca_chapters WHERE name = 'Capítulo Poncitlán';
  SELECT id INTO v_ixtlahuacan_id FROM arca_chapters WHERE name = 'Capítulo Ixtlahuacán';

  -- Solo creamos 2 deudas pendientes para simplicidad
  INSERT INTO arca_debts (
    chapter_id, amount, due_date, debt_type, status, description,
    bank_name, bank_clabe, bank_account, bank_holder, created_by
  )
  VALUES
    (v_poncitlan_id, 1500.00, CURRENT_DATE + INTERVAL '15 days', 'aportacion', 'pending',
     'Aportación Fondo de Emergencias Médicas',
     'Santander', NULL, '6012345678901234', 'Fondo Emergencia Club Arca', v_admin_id),
    (v_ixtlahuacan_id, 1200.00, CURRENT_DATE + INTERVAL '15 days', 'aportacion', 'pending',
     'Aportación Fondo de Emergencias Médicas',
     'Santander', NULL, '6012345678901234', 'Fondo Emergencia Club Arca', v_admin_id);

  RAISE NOTICE '✅ Solicitud 2 creada (Fondo Emergencias)';
END $$;

-- Solicitud 3: Multa por ausencia en asamblea (vence en 30 días)
DO $$
DECLARE
  v_admin_id UUID;
  v_vallarta_id UUID;
BEGIN
  SELECT u.id INTO v_admin_id FROM auth.users u WHERE u.email LIKE '%admin%' LIMIT 1;
  SELECT id INTO v_vallarta_id FROM arca_chapters WHERE name = 'Capítulo Vallarta';

  INSERT INTO arca_debts (
    chapter_id, amount, due_date, debt_type, status, description,
    bank_name, bank_clabe, bank_account, bank_holder, created_by
  )
  VALUES (
    v_vallarta_id, 750.00, CURRENT_DATE + INTERVAL '30 days', 'multa', 'pending',
    'Multa Ausencia Asamblea Ordinaria Octubre',
    'Citibanamex', '002180009876543210', '1234567890', 'Club Arca Sanciones', v_admin_id
  );

  RAISE NOTICE '✅ Solicitud 3 creada (Multa Asamblea)';
END $$;

-- ============================================
-- PASO 5: VERIFICACIÓN FINAL
-- ============================================

DO $$
DECLARE
  v_users INTEGER;
  v_chapters INTEGER;
  v_debts INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_users FROM arca_user_profiles;
  SELECT COUNT(*) INTO v_chapters FROM arca_chapters WHERE is_active = true;
  SELECT COUNT(*) INTO v_debts FROM arca_debts;

  RAISE NOTICE '';
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '✅ SEED DATA EJECUTADO EXITOSAMENTE';
  RAISE NOTICE '✅ ===============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Usuarios: % (1 admin + presidentes)', v_users;
  RAISE NOTICE 'Capítulos activos: %', v_chapters;
  RAISE NOTICE 'Deudas creadas: %', v_debts;
  RAISE NOTICE '';
  RAISE NOTICE 'Distribución de deudas por status:';
  RAISE NOTICE '  - Pending: %', (SELECT COUNT(*) FROM arca_debts WHERE status = 'pending');
  RAISE NOTICE '  - Overdue: %', (SELECT COUNT(*) FROM arca_debts WHERE status = 'overdue');
  RAISE NOTICE '  - In Review: %', (SELECT COUNT(*) FROM arca_debts WHERE status = 'in_review');
  RAISE NOTICE '  - Approved: %', (SELECT COUNT(*) FROM arca_debts WHERE status = 'approved');
  RAISE NOTICE '';
  RAISE NOTICE '📊 Puedes iniciar sesión con cualquiera de los usuarios creados';
  RAISE NOTICE '🔐 Contraseña por defecto: La que configuraste en Supabase Auth';
  RAISE NOTICE '';
END $$;
