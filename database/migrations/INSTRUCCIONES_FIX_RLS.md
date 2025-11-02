# 🔧 CORRECCIÓN URGENTE: Recursión en RLS

## 🚨 Problema Detectado

Al intentar hacer login en http://localhost:3000, se detectaron **3 problemas críticos**:

### Problema 1: Recursión Infinita en RLS
```
Error: infinite recursion detected in policy for relation "arca_user_profiles"
Code: 42P17
```

**Causa**: Las políticas RLS de `arca_user_profiles` consultan la misma tabla para verificar si el usuario es admin, creando un loop infinito:

```sql
-- POLÍTICA PROBLEMÁTICA (consulta la misma tabla)
CREATE POLICY "Admins view all profiles"
USING (
  EXISTS (
    SELECT 1 FROM arca_user_profiles  -- ¡RECURSIÓN!
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

### Problema 2: RLS Deshabilitado = 403 Forbidden
```
Error: permission denied for table arca_user_profiles
Code: 42501
```

**Causa**: Al deshabilitar RLS manualmente para "arreglar" el error, se bloqueó TODO el acceso a la tabla.

### Problema 3: Contraseñas Muy Cortas
```
Validación frontend: "La contraseña debe tener al menos 8 caracteres"
Password actual: pres123 (7 caracteres)
```

**Causa**: Las contraseñas de los presidentes tienen solo 7 caracteres, pero el formulario exige mínimo 8.

---

## ✅ Solución: Migración 007

**Archivo**: `007_fix_rls_recursion.sql`

### ¿Qué hace esta migración?

1. ✅ **Re-habilita RLS** en `arca_user_profiles`
2. ✅ **Elimina políticas problemáticas** (con recursión)
3. ✅ **Crea función `is_admin()` con SECURITY DEFINER**
4. ✅ **Recrea políticas SIN recursión** (usando `is_admin()`)
5. ✅ **Actualiza contraseñas** de 7 → 8 caracteres
6. ✅ **Verifica** que todo quedó correcto

### ¿Cómo funciona SECURITY DEFINER?

La función `is_admin()` se ejecuta con los **privilegios del creador** (no del usuario), lo que le permite **bypassear RLS** al consultar `arca_user_profiles`. Esto rompe el ciclo de recursión.

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
SECURITY DEFINER  -- ← Clave: bypasea RLS
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM arca_user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;
```

Luego, las políticas usan esta función:

```sql
CREATE POLICY "Admins view all profiles"
USING (is_admin());  -- ← Sin recursión
```

---

## 🚀 Pasos de Ejecución

### Paso 1: Acceder a Supabase SQL Editor

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto "El Arca"
3. Navega a **SQL Editor**

### Paso 2: Ejecutar Migración 007

1. Abre el archivo `database/migrations/007_fix_rls_recursion.sql`
2. Copia TODO el contenido
3. Pégalo en el SQL Editor de Supabase
4. Haz clic en **Run** (esquina inferior derecha)

### Paso 3: Verificar Salida

Deberías ver:

```
✅ ===============================================
✅ MIGRACIÓN 007 EJECUTADA EXITOSAMENTE
✅ ===============================================

RLS habilitado: true
Políticas activas: 3 (esperadas: 3)
Función is_admin(): Creada

📋 Políticas corregidas:
  1. Users view own profile (sin cambios)
  2. Admins view all profiles (sin recursión)
  3. Admins manage profiles (sin recursión)

🔑 Contraseñas actualizadas:
  - Todos los presidentes ahora usan: pres1234 (8 chars)
  - Admin mantiene: admin123 (8 chars)
```

---

## 🧪 Pruebas Post-Migración

### Prueba 1: Login como Admin

1. Ve a http://localhost:3000/login
2. Credenciales:
   - Email: `admin@arca.local`
   - Password: `admin123` (sin cambios)
3. Click en **Iniciar Sesión**

**Resultado esperado:**
- ✅ Login exitoso (sin error 42P17)
- ✅ Redirige a `/admin/dashboard`
- ✅ Muestra perfil correctamente

### Prueba 2: Login como Presidente

1. Ve a http://localhost:3000/login
2. Credenciales:
   - Email: `pres.vallarta@arca.local`
   - Password: `pres1234` ← **NUEVA** (antes era `pres123`)
3. Click en **Iniciar Sesión**

**Resultado esperado:**
- ✅ Login exitoso (sin error de validación)
- ✅ Redirige a `/presidente/dashboard`
- ✅ Muestra perfil correctamente

### Prueba 3: Verificar Políticas

Ejecuta en SQL Editor:

```sql
-- Ver todas las políticas de arca_user_profiles
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'arca_user_profiles'
ORDER BY policyname;
```

**Resultado esperado:**

| policyname | cmd | qual |
|------------|-----|------|
| Admins manage profiles | ALL | is_admin() |
| Admins view all profiles | SELECT | is_admin() |
| Users view own profile | SELECT | (auth.uid() = user_id) |

### Prueba 4: Verificar Función is_admin()

```sql
-- Verificar que la función existe
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'is_admin';
```

**Resultado esperado:**

| routine_name | routine_type | security_type |
|--------------|--------------|---------------|
| is_admin | FUNCTION | DEFINER |

---

## 🐛 Troubleshooting

### Error: "function is_admin already exists"

**Causa**: Ya ejecutaste la migración anteriormente.

**Solución**: El script usa `CREATE OR REPLACE`, por lo que puedes ejecutarlo múltiples veces sin problema.

### Error: "policy already exists"

**Causa**: Las políticas no se eliminaron correctamente.

**Solución**: Ejecuta manualmente:

```sql
DROP POLICY IF EXISTS "Admins view all profiles" ON arca_user_profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON arca_user_profiles;
```

Luego vuelve a ejecutar la migración 007.

### Error: "permission denied" después de migración

**Causa**: RLS está habilitado pero no hay ninguna política que permita acceso.

**Solución**: Verifica que las 3 políticas existen:

```sql
SELECT COUNT(*) FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'arca_user_profiles';
```

Debería retornar **3**.

### Login sigue fallando con error 403

**Causa**: Usuario no autenticado está intentando acceder a `arca_user_profiles`.

**Solución**: Verifica que el usuario está autenticado:

```sql
-- Conectar con usuario autenticado y ejecutar
SELECT auth.uid(), is_admin();
```

Si `auth.uid()` es NULL, el problema es de autenticación, no de RLS.

---

## 📝 Nuevas Credenciales

**Admin (sin cambios):**
- Email: `admin@arca.local`
- Password: `admin123`

**Presidentes (actualizadas):**
- Email: `pres.vallarta@arca.local`
- Password: `pres1234` ← **NUEVA**

- Email: `pres.tonala@arca.local`
- Password: `pres1234` ← **NUEVA**

- Email: `pres.guadalajara@arca.local`
- Password: `pres1234` ← **NUEVA**

- Email: `pres.zapopan@arca.local`
- Password: `pres1234` ← **NUEVA**

- Email: `pres.poncitlan@arca.local`
- Password: `pres1234` ← **NUEVA**

- Email: `pres.ixtlahuacan@arca.local`
- Password: `pres1234` ← **NUEVA**

---

## 📚 Referencias Técnicas

### ¿Por qué SECURITY DEFINER?

En PostgreSQL, las funciones pueden ejecutarse con dos tipos de privilegios:

1. **SECURITY INVOKER** (default): Se ejecuta con los privilegios del usuario que la llama
2. **SECURITY DEFINER**: Se ejecuta con los privilegios del usuario que la creó

Al usar SECURITY DEFINER, la función `is_admin()` se ejecuta con privilegios de superusuario, lo que le permite leer `arca_user_profiles` **sin pasar por RLS**, evitando la recursión.

### ¿Es seguro SECURITY DEFINER?

✅ **Sí**, si se implementa correctamente:

1. **SET search_path = public**: Previene ataques de secuestro de ruta
2. **STABLE**: Indica que la función no modifica datos
3. **Consulta simple**: Solo verifica `role = 'admin'`, sin lógica compleja

❌ **No sería seguro** si:
- Permitiera parámetros dinámicos (SQL injection)
- Modificara datos sin validación
- No estableciera `search_path`

### Alternativas consideradas

1. **JWT Custom Claims**: Más performante, pero requiere configuración compleja en Supabase Auth
2. **Tablas separadas**: Más complejo de mantener, sin beneficio claro
3. **Deshabilitar RLS**: ❌ **Inaceptable** - elimina toda la seguridad

**Decisión**: SECURITY DEFINER es el balance perfecto entre seguridad, simplicidad y performance.

---

**Fecha de creación**: 23 de Octubre de 2025
**Versión**: 1.0
**Autor**: Arquitecto de Software - El Arca
**Revisión**: Gemini-CLI (Validación técnica)
