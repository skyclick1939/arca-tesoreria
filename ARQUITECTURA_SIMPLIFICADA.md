# ARQUITECTURA SIMPLIFICADA: EL ARCA
## Sistema de Tesorería para Moto Club

**Versión**: 2.1 (Simplificada + Campos Bancarios + Nomenclatura arca_*)
**Fecha**: 22 de Octubre de 2025
**Estado**: Aprobado - Arquitectura Definitiva Actualizada

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitectura de Backend](#3-arquitectura-de-backend)
4. [Modelo de Base de Datos](#4-modelo-de-base-de-datos)
5. [Estrategia de Seguridad](#5-estrategia-de-seguridad)
6. [Estimación de Recursos](#6-estimación-de-recursos)
7. [Monitoreo](#7-monitoreo)
8. [Roadmap](#8-roadmap)
9. [Riesgos y Mitigaciones](#9-riesgos-y-mitigaciones)
10. [Checklist de Implementación](#10-checklist-de-implementación)

---

## 1. RESUMEN EJECUTIVO

### 1.1 Decisión Arquitectónica

Tras riguroso debate interno, se aprobó la **Arquitectura Simplificada (Opción A)** sobre la arquitectura compleja inicialmente propuesta.

**Razón**: El usuario confirmó que es una **operación ligera** con **70-100 usuarios máximo** que **NO excederá** el plan gratuito de Supabase. La arquitectura compleja (App Router + Backend híbrido) era **over-engineering** innecesario.

### 1.2 Principio Rector

> **"Si puedes hacerlo en Supabase, hazlo en Supabase"**

Toda la lógica de negocio vive en la base de datos (Database Functions + RLS + Triggers). Next.js es SOLO la capa de presentación.

### 1.3 Comparación con Arquitectura Rechazada

| Aspecto | Compleja (Rechazada) | Simplificada (Aprobada) |
|---------|----------------------|-------------------------|
| **Frontend** | Next.js 14 App Router (RSC) | Next.js 14 Pages Router |
| **State** | Zustand + React Query | Solo React Query + Context |
| **Backend** | Next.js API Routes + Supabase | **Solo Supabase** |
| **Monitoreo** | 4 herramientas | 2 herramientas |
| **Tiempo** | 6 semanas | 4.5 semanas |
| **Complejidad** | Alta (3 capas lógica) | Baja (1 capa) |
| **Costo** | $0/mes | $0/mes |

---

## 2. STACK TECNOLÓGICO

### 2.1 Frontend

```typescript
// Stack Frontend
Next.js 14 (Pages Router)
  ↓
React Query v4 (server state)
Context API (UI state)
  ↓
Tailwind CSS v3 (puro, sin shadcn/ui)
  ↓
TypeScript 5
```

**Justificación de Pages Router sobre App Router**:

| Criterio | Pages Router | App Router |
|----------|-------------|------------|
| **Madurez** | 5+ años producción | <2 años |
| **Documentación** | Exhaustiva | Limitada |
| **Curva aprendizaje** | Baja | Alta (RSC, Server Actions) |
| **Rendimiento** | <2s para 100 usuarios | <1.5s (ganancia marginal) |
| **Debugging** | Simple | Complejo (cliente/servidor) |

**Decisión**: Para 100 usuarios, la ganancia de 500ms NO justifica la complejidad adicional.

### 2.2 Backend

**100% Supabase** (sin Next.js API Routes)

| Componente | Tecnología | Propósito |
|------------|-----------|----------|
| **Base de Datos** | PostgreSQL 15 | Almacenamiento + Lógica de negocio |
| **Autenticación** | Supabase Auth | Login + Roles |
| **Storage** | Supabase Storage | Comprobantes de pago |
| **API** | PostgREST (auto-generado) | CRUD automático |
| **Lógica** | PL/pgSQL Functions | Cálculos de deudas |
| **Seguridad** | Row Level Security | Aislamiento de datos |

### 2.3 Dependencias (package.json)

```json
{
  "dependencies": {
    "next": "14.2.15",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "@supabase/supabase-js": "^2.45.0",
    "@tanstack/react-query": "^4.36.1",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

**Total de dependencias**: 10 (vs 25+ en arquitectura compleja)

---

## 3. ARQUITECTURA DE BACKEND

### 3.1 Diagrama Simplificado

```
┌───────────────────────────────────────┐
│     NEXT.JS (Presentación)            │
│  - Renderiza UI                       │
│  - Valida input (UX)                  │
│  - Llama Supabase Client              │
└─────────────┬─────────────────────────┘
              │ supabase-js
              ↓
┌───────────────────────────────────────┐
│     SUPABASE POSTGRESQL               │
│                                       │
│  1. RLS Policies ← Firewall de datos │
│  2. Database Functions ← Lógica      │
│  3. Triggers ← Automatizaciones      │
│  4. Tablas ← Datos                   │
└───────────────────────────────────────┘
```

### 3.2 División de Responsabilidades

| Funcionalidad | Implementación | Archivo |
|---------------|----------------|---------|
| **Cálculo de deudas** | `create_debts_batch()` function | `schema.sql` |
| **Marcar atrasado** | ~~pg_cron~~ → **Trigger on dashboard load** | `schema.sql` |
| **Validación permisos** | RLS Policies | `schema.sql` |
| **Auditoría** | `audit_debt_changes()` trigger | `schema.sql` |
| **CRUD básico** | PostgREST auto-generado | N/A |

### 3.3 Funciones Críticas (PL/pgSQL)

#### Función 1: Cálculo de Deudas (ACTUALIZADA con campos bancarios)

```sql
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
  -- 1. Validar que usuario sea Admin
  IF NOT EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden crear deudas';
  END IF;

  -- 2. Validar campos bancarios (al menos uno obligatorio)
  IF p_bank_clabe IS NULL AND p_bank_account IS NULL THEN
    RAISE EXCEPTION 'Debe proporcionar al menos CLABE o Número de Cuenta';
  END IF;

  -- 3. Validar formato CLABE (si se proporciona)
  IF p_bank_clabe IS NOT NULL AND LENGTH(p_bank_clabe) != 18 THEN
    RAISE EXCEPTION 'CLABE debe tener exactamente 18 dígitos';
  END IF;

  -- 4. Validar formato Número de Cuenta (si se proporciona)
  IF p_bank_account IS NOT NULL AND (LENGTH(p_bank_account) < 10 OR LENGTH(p_bank_account) > 16) THEN
    RAISE EXCEPTION 'Número de cuenta debe tener entre 10 y 16 dígitos';
  END IF;

  -- 5. Calcular total de miembros
  SELECT COALESCE(SUM(member_count), 0) INTO v_total_members
  FROM arca_chapters WHERE is_active = true;

  IF v_total_members = 0 THEN
    RAISE EXCEPTION 'No hay capítulos activos';
  END IF;

  v_amount_per_member := p_total_amount / v_total_members;

  -- 6. Crear deudas proporcionales (transacción atómica)
  RETURN QUERY
  INSERT INTO arca_debts (
    chapter_id, amount, due_date, debt_type, description,
    bank_name, bank_clabe, bank_account, bank_holder,
    status, created_by
  )
  SELECT
    c.id,
    ROUND(v_amount_per_member * c.member_count, 2),
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
END;
$$;
```

**Timeout mitigation**: Para >50 capítulos, usar batch de 25 con múltiples llamadas desde cliente.

#### Función 2: Marcar Deudas Atrasadas (CORREGIDA)

**Problema identificado**: pg_cron en plan gratuito NO es fiable.

**Solución**: Llamada desde cliente al cargar dashboard.

```sql
CREATE OR REPLACE FUNCTION mark_overdue_debts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE arca_debts
    SET status = 'overdue'::debt_status_enum
    WHERE status = 'pending'::debt_status_enum
      AND due_date < CURRENT_DATE
      AND proof_uploaded_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  RETURN v_updated_count;
END;
$$;
```

**Invocación desde Next.js**:
```typescript
// pages/index.tsx (dashboard)
useEffect(() => {
  // Llamar al cargar dashboard (1 vez por sesión)
  supabase.rpc('mark_overdue_debts').then(({ data }) => {
    console.log(`${data} deudas marcadas como atrasadas`);
  });
}, []);
```

**Trade-off aceptado**: Depende de que usuarios carguen dashboard, pero garantiza ejecución sin pg_cron.

#### Función 3: Auditoría Automática

```sql
CREATE OR REPLACE FUNCTION audit_debt_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.proof_uploaded_at IS DISTINCT FROM NEW.proof_uploaded_at OR
    OLD.approved_at IS DISTINCT FROM NEW.approved_at
  ) THEN
    INSERT INTO arca_audit_logs (
      table_name, record_id, action, old_values, new_values, user_id
    ) VALUES (
      'arca_debts', NEW.id, TG_OP,
      jsonb_build_object(
        'status', OLD.status,
        'proof_uploaded_at', OLD.proof_uploaded_at,
        'approved_at', OLD.approved_at
      ),
      jsonb_build_object(
        'status', NEW.status,
        'proof_uploaded_at', NEW.proof_uploaded_at,
        'approved_at', NEW.approved_at
      ),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER arca_debts_audit_trigger
AFTER UPDATE ON arca_debts
FOR EACH ROW
EXECUTE FUNCTION audit_debt_changes();
```

---

## 4. MODELO DE BASE DE DATOS

### 4.1 Esquema SQL Completo

```sql
-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE user_role AS ENUM ('admin', 'president');
CREATE TYPE debt_type_enum AS ENUM ('apoyo', 'aportacion', 'multa');
CREATE TYPE debt_status_enum AS ENUM ('pending', 'overdue', 'in_review', 'approved');
CREATE TYPE regional_enum AS ENUM ('Centro', 'Norte', 'Sur', 'Este', 'Occidente', 'Bajío');

-- ============================================
-- TABLAS (Nomenclatura con prefijo arca_)
-- ============================================

-- 1. arca_user_profiles (extiende auth.users)
CREATE TABLE arca_user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'president',
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. arca_chapters
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

-- 3. arca_debts (ACTUALIZADO con campos bancarios)
CREATE TABLE arca_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES arca_chapters(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  debt_type debt_type_enum NOT NULL,
  status debt_status_enum NOT NULL DEFAULT 'pending',
  description TEXT,

  -- NUEVOS CAMPOS BANCARIOS
  bank_name TEXT NOT NULL,              -- ej. "BBVA"
  bank_clabe VARCHAR(18),               -- CLABE Interbancaria (18 dígitos)
  bank_account VARCHAR(16),             -- Número de cuenta (10-16 dígitos)
  bank_holder TEXT NOT NULL,            -- Titular de la cuenta

  -- Comprobante de pago
  proof_file_url TEXT,
  proof_uploaded_at TIMESTAMPTZ,

  -- Auditoría
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES arca_user_profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- CONSTRAINT CRÍTICO: Al menos CLABE o Cuenta debe estar lleno
  CONSTRAINT at_least_one_bank_id CHECK (
    bank_clabe IS NOT NULL OR bank_account IS NOT NULL
  )
);

-- 4. arca_audit_logs
CREATE TABLE arca_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES arca_user_profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES (Solo los necesarios)
-- ============================================

-- Consulta frecuente: Dashboard de Presidente
CREATE INDEX idx_arca_debts_chapter_status
ON arca_debts(chapter_id, status)
WHERE status IN ('pending', 'overdue');

-- Consulta frecuente: Deudas vencidas
CREATE INDEX idx_arca_debts_overdue
ON arca_debts(due_date)
WHERE status = 'pending' AND proof_uploaded_at IS NULL;

-- Auditoría
CREATE INDEX idx_arca_audit_logs_lookup
ON arca_audit_logs(table_name, record_id, created_at DESC);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_arca_chapters_updated_at
BEFORE UPDATE ON arca_chapters
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_arca_debts_updated_at
BEFORE UPDATE ON arca_debts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 4.2 Diagrama de Relaciones

```
auth.users (Supabase)
    ↓ 1:1
arca_user_profiles
    ↓ 1:N
arca_chapters ←─────┐
    ↓ 1:N           │ FK
arca_debts ─────────┘
    ↓ Trigger
arca_audit_logs
```

---

## 5. ESTRATEGIA DE SEGURIDAD

### 5.1 RLS Policies (Completas)

```sql
-- Habilitar RLS en TODAS las tablas
ALTER TABLE arca_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE arca_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE arca_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE arca_audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES: arca_user_profiles
-- ============================================

CREATE POLICY "Users view own profile"
ON arca_user_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all profiles"
ON arca_user_profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins manage profiles"
ON arca_user_profiles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- POLICIES: arca_chapters
-- ============================================

CREATE POLICY "All users view active chapters"
ON arca_chapters FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Admins manage chapters"
ON arca_chapters FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- POLICIES: arca_debts (CRÍTICO)
-- ============================================

-- Presidentes solo ven deudas de SU capítulo
CREATE POLICY "Presidents view own chapter debts"
ON arca_debts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_chapters c
    WHERE c.id = arca_debts.chapter_id
      AND c.president_id = auth.uid()
  )
);

-- Admins ven TODAS las deudas
CREATE POLICY "Admins view all debts"
ON arca_debts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Solo admins crean deudas
CREATE POLICY "Admins create debts"
ON arca_debts FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Presidentes actualizan solo proof_file_url de SU capítulo
CREATE POLICY "Presidents update own debts"
ON arca_debts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_chapters c
    WHERE c.id = arca_debts.chapter_id
      AND c.president_id = auth.uid()
  )
)
WITH CHECK (
  -- Solo pueden modificar estos campos
  OLD.chapter_id = NEW.chapter_id AND
  OLD.amount = NEW.amount AND
  OLD.due_date = NEW.due_date AND
  OLD.bank_name = NEW.bank_name AND
  OLD.bank_clabe = NEW.bank_clabe AND
  OLD.bank_account = NEW.bank_account AND
  OLD.bank_holder = NEW.bank_holder
);

-- Admins actualizan TODO
CREATE POLICY "Admins update all debts"
ON arca_debts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- POLICIES: arca_audit_logs
-- ============================================

CREATE POLICY "Admins view audit logs"
ON arca_audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

### 5.2 Tests de RLS

```sql
-- Test 1: Presidente ve solo SU capítulo
BEGIN;
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "uuid-presidente-norte"}';

SELECT COUNT(*) FROM debts; -- Debe retornar solo deudas de su capítulo

ROLLBACK;

-- Test 2: Admin ve TODO
BEGIN;
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "uuid-admin"}';

SELECT COUNT(*) FROM debts; -- Debe retornar TODAS las deudas

ROLLBACK;
```

---

## 6. ESTIMACIÓN DE RECURSOS

### 6.1 Base de Datos (Límite: 500 MB)

| Tabla | Tamaño/Fila | Cantidad | Total |
|-------|-------------|----------|-------|
| `user_profiles` | 200 bytes | 100 | 20 KB |
| `chapters` | 150 bytes | 100 | 15 KB |
| `debts` | 250 bytes | 2,000 | 500 KB |
| `audit_logs` | 400 bytes | 5,000 | 2 MB |
| **Índices** | - | - | 800 KB |
| **Total** | - | - | **3.5 MB** |

**Uso**: 3.5 MB / 500 MB = **0.7%** ✅

### 6.2 Storage (Límite: 1 GB)

**Estrategia**: Comprimir imágenes a máx 1 MB antes de subir.

| Escenario | Cálculo | Total |
|-----------|---------|-------|
| Promedio | 500 comprobantes × 1 MB | 500 MB |
| Extremo | 1,000 comprobantes × 1 MB | 1,000 MB |

**Política del bucket**:
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'arca-comprobantes',
  'arca-comprobantes',
  false,
  5242880, -- 5 MB máx
  ARRAY['image/png', 'image/jpeg', 'application/pdf']
);
```

**Estructura de paths**:
```
arca-comprobantes/
  ├── {chapter_id}/
  │   └── {debt_id}/
  │       └── {timestamp}-{filename}.{ext}
```

**Ejemplo**:
```
arca-comprobantes/uuid-chapter-norte/uuid-debt-123/1729641234567-comprobante.pdf
```

### 6.3 Autenticaciones (Límite: 50K/mes)

100 usuarios × 20 logins/mes = **2,000** (4% del límite) ✅

### 6.4 Database Requests (Límite: 2M/mes)

100 usuarios × 20 sesiones/mes × 50 queries/sesión = **100K** (5% del límite) ✅

---

## 7. MONITOREO

### 7.1 Solo 2 Herramientas

| Herramienta | Qué Monitorea | Costo |
|-------------|---------------|-------|
| **Supabase Dashboard** | BD, Storage, Auth, Logs | $0 |
| **Sentry** | Errores de frontend | $0 (5K errors/mes) |

### 7.2 Configuración de Sentry

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Solo errores CRÍTICOS
  beforeSend(event, hint) {
    // Ignorar errores de red (comunes)
    if (event.exception?.values?.[0]?.type === 'NetworkError') {
      return null;
    }

    // Ignorar 401/403 (manejados por UX)
    if (hint.originalException?.response?.status < 500) {
      return null;
    }

    return event;
  },

  tracesSampleRate: 0.1, // 10% de transacciones
});
```

---

## 8. ROADMAP

### 8.1 Resumen

| Sprint | Duración | Objetivo |
|--------|----------|----------|
| Sprint 1 | 1.5 semanas | Auth + CRUD Capítulos |
| Sprint 2 | 1.5 semanas | Core de Deudas + Comprobantes |
| Sprint 3 | 1.5 semanas | Dashboards + Métricas |

**Total**: **4.5 semanas** (ajustado de 4 semanas tras revisión)

### 8.2 Sprint 1: Fundación (1.5 semanas)

**Día 1-2**: Setup
- [ ] Crear proyecto Supabase
- [ ] Ejecutar `schema.sql` completo
- [ ] Verificar RLS con tests
- [ ] Setup Next.js + Tailwind

**Día 3-5**: Auth
- [ ] Login con Magic Link
- [ ] Middleware de Next.js (protección rutas)
- [ ] Crear usuario admin seed

**Día 6-8**: CRUD Capítulos
- [ ] Formulario crear/editar capítulo
- [ ] Tabla con React Query
- [ ] Asignación de presidentes

**Día 9**: Demo y testing

**Entregable**: Admin puede CRUD capítulos.

### 8.3 Sprint 2: Core de Deudas (1.5 semanas)

**Día 1-3**: Cálculo de Deudas
- [ ] Form de creación de deuda
- [ ] Preview de distribución
- [ ] Implementar `create_debts_batch()`

**Día 4-6**: Comprobantes
- [ ] Configurar bucket Storage
- [ ] Formulario subida (validación 2MB)
- [ ] Vista de Presidente (filtro por capítulo)

**Día 7-9**: Flujo de Aprobación
- [ ] Estado "En Revisión"
- [ ] Botón "Aprobar" (Admin)
- [ ] Trigger de auditoría

**Entregable**: Flujo completo de deuda.

### 8.3 Sprint 3: Dashboards (1.5 semanas)

**Día 1-4**: Métricas (AJUSTADO)
- [ ] Función `get_dashboard_stats()`
- [ ] Cards de métricas (Tailwind)
- [ ] Dashboard de Admin
- [ ] Dashboard de Presidente

**Día 5-7**: Optimización
- [ ] Índices adicionales
- [ ] Setup Sentry
- [ ] Error boundaries

**Día 8-9**: Testing final

**Entregable**: Sistema en producción.

---

## 9. RIESGOS Y MITIGACIONES

### 9.1 Riesgos Identificados (Post-Revisión gemini-cli)

| ID | Riesgo | Impacto | Mitigación |
|----|--------|---------|------------|
| **R1** | pg_cron no fiable en plan gratuito | Alto | ✅ **CORREGIDO**: Llamar `mark_overdue_debts()` desde cliente |
| **R2** | Timeout de Database Functions (2s) | Medio | Batch de 25 capítulos por llamada + manejo de errores |
| **R3** | Sprint 3 muy optimista | Bajo | ✅ **CORREGIDO**: Extendido a 1.5 semanas |
| **R4** | Usuario sin experiencia en SQL | Medio | Documentación exhaustiva + ejemplos |
| **R5** | Bloqueo operacional: Presidente no puede corregir CLABE errónea | **Alto** | **Agregar botón "Reportar Error" que notifique al Admin vía flag en DB** |
| **R6** | Validación CLABE insuficiente (solo longitud, no dígito control) | **Alto** | **ACEPTADO**: Validar longitud + formato numérico. Dígito de control en v2.0 (requiere algoritmo complejo) |
| **R7** | Falta de atomicidad en create_debts_batch() | **Crítico** | ✅ **GARANTIZADO**: PostgreSQL ejecuta INSERT dentro de transacción implícita. Si 1 falla → TODAS se revierten automáticamente |

### 9.2 Plan de Contingencia

**Si excedemos límites gratuitos**:
1. **BD > 400 MB**: Archivar `audit_logs` > 2 años
2. **Storage > 800 MB**: Comprimir comprobantes antiguos
3. **Requests > 1.5M/mes**: Implementar cache local (React Query)

---

## 10. CHECKLIST DE IMPLEMENTACIÓN

### Día 1
- [ ] Crear proyecto en https://supabase.com
- [ ] Copiar URL y anon key a `.env.local`
- [ ] Ejecutar SQL completo (sección 4.1)
- [ ] Verificar RLS con tests (sección 5.2)

### Día 2
- [ ] `npx create-next-app@14 arca --use-npm`
- [ ] Instalar: `@supabase/supabase-js @tanstack/react-query tailwindcss`
- [ ] Crear `lib/supabase.ts`
- [ ] Configurar Tailwind

### Semana 1
- [ ] Login con Magic Link
- [ ] CRUD de capítulos
- [ ] Testing manual

### Semana 2-3
- [ ] Implementar todas las Database Functions
- [ ] Subida de comprobantes
- [ ] Flujo de aprobación

### Semana 4-4.5
- [ ] Dashboards con métricas
- [ ] Setup Sentry
- [ ] Deploy a producción

---

## ANEXOS

### A. Ejemplo de Invocación de Función desde Next.js

```typescript
// pages/admin/debts/create.tsx
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function CreateDebtPage() {
  const queryClient = useQueryClient();

  const createDebtMutation = useMutation({
    mutationFn: async (formData: DebtFormData) => {
      const { data, error } = await supabase.rpc('create_debts_batch', {
        p_total_amount: formData.totalAmount,
        p_due_date: formData.dueDate,
        p_debt_type: formData.type,
        p_description: formData.description
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      toast.success('Deudas creadas exitosamente');
      router.push('/admin/debts');
    }
  });

  // ...
}
```

### B. Estructura de Proyecto

```
arca/
├── pages/
│   ├── _app.tsx
│   ├── index.tsx (dashboard)
│   ├── login.tsx
│   ├── admin/
│   │   ├── chapters/
│   │   │   └── index.tsx
│   │   └── debts/
│   │       ├── index.tsx
│   │       └── create.tsx
│   └── president/
│       └── dashboard.tsx
├── lib/
│   ├── supabase.ts
│   └── sentry.ts
├── components/
│   ├── DebtCard.tsx
│   └── ChapterTable.tsx
├── hooks/
│   ├── useDebts.ts
│   └── useChapters.ts
└── public/
```

---

## 11. DISEÑO Y UI

### 11.1 Paleta de Colores Unificada

**Inspirada en bandera mexicana 🇲🇽:**

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Verdes (México)
        'primary': '#006847',        // Verde oscuro principal
        'primary-light': '#4CAF50',  // Verde Material (acentos/gráficas)
        'primary-accent': '#103C10', // Verde muy oscuro (fondos íconos)

        // Rojos (México)
        'danger': '#CE1126',         // Rojo principal
        'danger-light': '#F44336',   // Rojo Material (acentos)

        // Fondos dark mode
        'background-dark': '#121212', // Fondo principal
        'surface-dark': '#1E1E1E',   // Cards y superficies elevadas
        'card-dark': '#1E1E1E',      // Alias para cards

        // Textos
        'text-primary': '#FFFFFF',   // Texto principal
        'text-secondary': '#A0A0A0', // Texto secundario/hints
        'text-muted': '#9db89d',     // Texto deshabilitado

        // Bordes
        'border-dark': '#333333',    // Bordes y divisores
      }
    }
  }
}
```

### 11.2 Componentes Clave

**Librería de gráficas**: Recharts (23KB, ligera)
**Loading states**: Skeleton loaders para dashboards, spinners para botones
**Validación de archivos**: Client-side, mensajes de error claros, sin compresión automática

---

**FIN DEL DOCUMENTO**

**Versión**: 2.1 (Simplificada + Campos Bancarios + Nomenclatura arca_*)
**Última actualización**: 22 de Octubre de 2025
**Aprobado por**: Usuario + Líder Técnico + Arquitecto
**Revisado por**: Gemini-CLI (Auditoría de coherencia)
**Próximo paso**: Generar plan de tareas atómico y archivos SQL de migración
