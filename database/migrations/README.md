# Migraciones SQL - El Arca

## 📋 Descripción

Esta carpeta contiene las migraciones SQL para inicializar la base de datos de **El Arca** en Supabase PostgreSQL.

**Versión**: 2.1 (Arquitectura Simplificada + Campos Bancarios)
**Fecha**: 22 de Octubre de 2025

---

## 🚀 Orden de Ejecución

**IMPORTANTE**: Ejecutar en este orden exacto desde la terminal SQL de Supabase.

### Paso 1: Schema Inicial
```bash
\i database/migrations/001_schema_inicial.sql
```

**Crea**:
- 4 ENUMs (user_role, debt_type_enum, debt_status_enum, regional_enum)
- 4 Tablas (arca_user_profiles, arca_chapters, arca_debts, arca_audit_logs)
- 3 Índices optimizados

**Tiempo estimado**: 2-3 segundos

---

### Paso 2: Políticas RLS
```bash
\i database/migrations/002_rls_policies.sql
```

**Crea**:
- Habilita Row Level Security en todas las tablas
- 13 políticas de acceso (aislamiento Presidente/Admin)
- Función de testing `test_rls_isolation()`

**Tiempo estimado**: 1-2 segundos

---

### Paso 3: Funciones de Negocio
```bash
\i database/migrations/003_functions.sql
```

**Crea**:
- `create_debts_batch()` - Cálculo proporcional con validaciones bancarias
- `mark_overdue_debts()` - Marcar deudas vencidas
- `audit_debt_changes()` - Trigger function de auditoría
- `get_dashboard_stats_by_request()` - Dashboard Tab 2 (Por Solicitud)
- `get_dashboard_stats_by_chapter()` - Dashboard Tab 3 (Por Capítulo)
- `get_global_balance()` - Dashboard Tab 1 (Vista General)

**Tiempo estimado**: 3-4 segundos

---

### Paso 4: Triggers
```bash
\i database/migrations/004_triggers.sql
```

**Crea**:
- 9 triggers automáticos:
  - 3 triggers `update_updated_at` (user_profiles, chapters, debts)
  - 1 trigger `arca_debts_audit_trigger` (auditoría automática)
  - 1 trigger `validate_arca_debts_status_transition` (validación de estados)
  - 1 trigger `auto_arca_debts_in_review` (auto-cambio al subir comprobante)
  - 1 trigger `prevent_presidents_critical_fields` (protección campos bancarios)
  - 1 trigger `prevent_arca_debts_approved_deletion` (protección de eliminación)
  - 1 trigger `on_auth_user_created` (creación automática de perfiles)

**Tiempo estimado**: 2-3 segundos

---

### Paso 4.5: Actualizar ENUM regional_enum (Solo si ya ejecutaste migraciones anteriores)

**⚠️ IMPORTANTE**: Solo ejecutar este paso si:
- Ya ejecutaste las migraciones 001-004 anteriormente
- Recibes el error `ERROR: type "user_role" already exists` al intentar ejecutar 001
- Necesitas agregar los valores "Occidente" y "Bajío" al ENUM `regional_enum`

```bash
\i database/migrations/005_update_regional_enum.sql
```

**Hace**:
- Agrega 'Occidente' al ENUM `regional_enum` (si no existe)
- Agrega 'Bajío' al ENUM `regional_enum` (si no existe)
- Es IDEMPOTENTE: puedes ejecutarlo múltiples veces sin causar errores

**Tiempo estimado**: 1 segundo

---

### Paso 5: Datos de Prueba (OPCIONAL - Solo Desarrollo)

**⚠️ ADVERTENCIA**: Solo ejecutar en ambiente de desarrollo/testing.

**IMPORTANTE - PASOS PREVIOS OBLIGATORIOS**:

1. **Crear usuarios en Supabase Auth** (Dashboard → Authentication → Add User):
   - `admin@arca.local` (password: admin123)
   - `pres.norte@arca.local` (password: pres123)
   - `pres.sur@arca.local` (password: pres123)
   - `pres.centro@arca.local` (password: pres123)
   - `pres.este@arca.local` (password: pres123)

2. **El trigger creará automáticamente los perfiles** en `arca_user_profiles`

3. **Ejecutar el seed**:
```bash
\i database/migrations/seed_dev_data.sql
```

**Crea**:
- 5 capítulos (4 activos, 1 inactivo)
- 7 deudas de prueba en diferentes estados
- Convierte el usuario admin en role 'admin'

**Tiempo estimado**: 1-2 segundos

---

### Paso 6: Configuración de Storage Bucket

**⚠️ IMPORTANTE**: Ejecutar después de las migraciones 001-005.

```bash
\i database/migrations/006_storage_bucket.sql
```

**Crea**:
- Bucket privado `arca-comprobantes` (5 MB máximo, tipos: PNG, JPEG, PDF)
- 8 políticas RLS para Storage:
  - 2 policies para INSERT (Presidentes suben a su capítulo, Admins suben a cualquiera)
  - 2 policies para SELECT (Admins ven todo, Presidentes solo su capítulo)
  - 2 policies para UPDATE (control de actualización de archivos)
  - 2 policies para DELETE (control de eliminación de archivos)

**Tiempo estimado**: 1-2 segundos

**Estructura de paths**:
```
arca-comprobantes/{chapter_id}/{debt_id}/{timestamp}-{filename}.{ext}
```

**Ejemplo**:
```
arca-comprobantes/uuid-chapter-123/uuid-debt-456/1729641234567-comprobante.pdf
```

---

### Paso 7: Corrección de Recursión en RLS (CRÍTICO)

**🚨 EJECUTAR ANTES DE PROBAR LOGIN**

```bash
\i database/migrations/007_fix_rls_recursion.sql
```

**Problema que resuelve**:
- ❌ Error: "infinite recursion detected in policy for relation arca_user_profiles"
- ❌ Error: "permission denied for table arca_user_profiles"
- ❌ Contraseñas de presidentes muy cortas (7 chars → 8 chars)

**Solución implementada**:
- ✅ Función `is_admin()` con SECURITY DEFINER (bypasea RLS, evita recursión)
- ✅ Políticas RLS sin recursión (usan `is_admin()`)
- ✅ Contraseñas actualizadas a 8 caracteres mínimo

**Hace**:
1. Re-habilita RLS en `arca_user_profiles`
2. Elimina políticas con recursión
3. Crea función `is_admin()` con SECURITY DEFINER
4. Recrea 2 políticas SIN recursión:
   - "Admins view all profiles" (usa `is_admin()`)
   - "Admins manage profiles" (usa `is_admin()`)
5. Actualiza contraseñas: `pres123` → `pres1234`

**Tiempo estimado**: 2-3 segundos

**Nuevas credenciales**:
- Admin: `admin@arca.local` / `admin123` (sin cambios)
- Presidentes: `pres.*@arca.local` / `pres1234` (actualizada de 7 a 8 chars)

**Ver**: `INSTRUCCIONES_FIX_RLS.md` para detalles técnicos

---

## ✅ Verificación Post-Migración

Ejecutar los siguientes queries para verificar la instalación:

### 1. Verificar Tablas
```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'arca_%'
ORDER BY tablename;
```

**Resultado esperado**: 4 tablas (arca_audit_logs, arca_chapters, arca_debts, arca_user_profiles)

---

### 2. Verificar RLS Habilitado
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'arca_%';
```

**Resultado esperado**: `rowsecurity = true` en todas

---

### 3. Verificar Políticas
```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'arca_%'
ORDER BY tablename, policyname;
```

**Resultado esperado**: 13 políticas

---

### 4. Verificar Funciones
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_debts_batch',
    'mark_overdue_debts',
    'audit_debt_changes',
    'get_dashboard_stats_by_request',
    'get_dashboard_stats_by_chapter',
    'get_global_balance'
  )
ORDER BY routine_name;
```

**Resultado esperado**: 6 funciones

---

### 5. Verificar Triggers
```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND (event_object_table LIKE 'arca_%' OR event_object_table = 'users')
ORDER BY event_object_table, trigger_name;
```

**Resultado esperado**: 9 triggers (8 en arca_* + 1 en auth.users)

---

## 🧪 Testing de RLS (Desarrollo)

Ejecutar la función de testing incluida:

```sql
SELECT * FROM test_rls_isolation();
```

**Resultado esperado**: Todos los tests deben pasar (✅ PASA)

---

## 📝 Notas Importantes

1. **Nomenclatura**: Todas las tablas usan prefijo `arca_*` para evitar colisiones
2. **Validaciones Bancarias**: Al menos CLABE (18 dígitos) o Cuenta (10-16 dígitos) obligatoria
3. **Atomicidad**: `create_debts_batch()` usa transacción implícita de PostgreSQL
4. **Auditoría**: Todos los cambios de status se registran automáticamente en `arca_audit_logs`
5. **Protección**: Deudas aprobadas NO pueden eliminarse (trigger de protección)

---

## 🐛 Troubleshooting

### Error: "type 'user_role' already exists" o "type 'regional_enum' already exists"
**Causa**: Ya ejecutaste las migraciones anteriormente y los ENUMs ya existen
**Solución**:
1. **NO vuelvas a ejecutar 001_schema_inicial.sql completo**
2. Si solo necesitas actualizar el ENUM `regional_enum` para agregar "Occidente" y "Bajío":
   ```bash
   \i database/migrations/005_update_regional_enum.sql
   ```
3. Si necesitas agregar campos nuevos a tablas existentes, ejecuta SOLO las migraciones incrementales (002, 003, 004) que aún no hayas ejecutado

### Error: "relation already exists"
**Causa**: Tablas ya creadas en ejecución anterior
**Solución**: Eliminar tablas manualmente o usar entorno limpio

```sql
DROP TABLE IF EXISTS arca_audit_logs CASCADE;
DROP TABLE IF EXISTS arca_debts CASCADE;
DROP TABLE IF EXISTS arca_chapters CASCADE;
DROP TABLE IF EXISTS arca_user_profiles CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS debt_type_enum CASCADE;
DROP TYPE IF EXISTS debt_status_enum CASCADE;
DROP TYPE IF EXISTS regional_enum CASCADE;
```

Luego re-ejecutar desde 001_schema_inicial.sql

---

### Error: "permission denied for schema public"
**Causa**: Usuario sin permisos suficientes
**Solución**: Usar Service Role Key en Supabase Dashboard

---

### Error: "function auth.uid() does not exist"
**Causa**: Ejecutando desde conexión externa sin contexto de Supabase Auth
**Solución**: Ejecutar desde SQL Editor de Supabase Dashboard

---

## 📚 Referencias

- [Documentación PRD](../PRD.md)
- [Arquitectura Simplificada](../ARQUITECTURA_SIMPLIFICADA.md)
- [Plan de Tareas](../PLAN_TAREAS.md)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Functions](https://www.postgresql.org/docs/15/sql-createfunction.html)

---

**Última actualización**: 22 de Octubre de 2025
**Versión**: 2.1
**Autor**: Arquitecto de Software - El Arca
