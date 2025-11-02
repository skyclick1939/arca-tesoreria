# 📁 Instrucciones: Configuración de Storage Bucket

## 🎯 Objetivo

Configurar el bucket de Supabase Storage para almacenar comprobantes de pago (imágenes y PDFs) con políticas de seguridad RLS.

---

## 📋 Pre-requisitos

✅ Migraciones 001-005 ejecutadas exitosamente
✅ Acceso al SQL Editor de Supabase Dashboard
✅ Usuario con permisos de administrador en Supabase

---

## 🚀 Pasos de Ejecución

### 1. Acceder a Supabase Dashboard

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto "El Arca"
3. Navega a **SQL Editor** en el menú lateral

### 2. Ejecutar Migración 006

Copia y pega el contenido completo del archivo `006_storage_bucket.sql` en el editor SQL:

```bash
# Desde el SQL Editor de Supabase:
\i database/migrations/006_storage_bucket.sql
```

O **pega manualmente** todo el contenido del archivo en el editor.

### 3. Ejecutar el Script

1. Haz clic en el botón **"Run"** (esquina inferior derecha)
2. Espera la confirmación de ejecución (1-2 segundos)

### 4. Verificar Salida

Deberías ver un mensaje similar a:

```
✅ ===============================================
✅ MIGRACIÓN 006 EJECUTADA EXITOSAMENTE
✅ ===============================================

Bucket creado: arca-comprobantes
Tamaño máximo: 5 MB
Tipos permitidos: PNG, JPEG, PDF
Políticas RLS creadas: 8 (esperadas: 8)

Estructura de paths:
  arca-comprobantes/{chapter_id}/{debt_id}/{timestamp}-{filename}.{ext}

Ejemplo:
  arca-comprobantes/uuid-chapter-123/uuid-debt-456/1729641234567-comprobante.pdf
```

---

## ✅ Verificación Manual

### Verificar Bucket Creado

1. Ve a **Storage** en el menú lateral de Supabase
2. Deberías ver el bucket `arca-comprobantes`
3. Configuración esperada:
   - **Public**: ❌ No (privado)
   - **File size limit**: 5 MB
   - **Allowed MIME types**: image/png, image/jpeg, application/pdf

### Verificar Políticas RLS

Ejecuta este query en el SQL Editor:

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;
```

**Resultado esperado**: 8 políticas (o más si hay otras políticas de otros buckets):

1. `Admins delete all proofs`
2. `Admins update all proofs`
3. `Admins upload to any chapter`
4. `Admins view all proofs`
5. `Presidents delete own chapter proofs`
6. `Presidents update own chapter proofs`
7. `Presidents upload to own chapter`
8. `Presidents view own chapter proofs`

---

## 🧪 Prueba de Funcionalidad

### Desde el Frontend (Opcional)

Si ya tienes el proyecto Next.js corriendo:

1. Navega a la página de pruebas (crear una ruta temporal)
2. Usa el componente `<FileUploadTest />`:

```tsx
import FileUploadTest from '@/components/FileUploadTest';

// En tu página de pruebas
<FileUploadTest
  chapterId="uuid-de-capitulo-real"
  debtId="uuid-de-deuda-real"
/>
```

3. Intenta subir un archivo de prueba
4. Verifica en Supabase Storage que el archivo se creó correctamente

### Desde Supabase Dashboard

1. Ve a **Storage** → **arca-comprobantes**
2. Intenta subir un archivo manualmente
3. Verifica que la estructura de carpetas se cree correctamente

---

## 🔒 Políticas de Seguridad Implementadas

### INSERT (Subir archivos)

- ✅ **Presidentes**: Solo pueden subir a su propio capítulo
- ✅ **Admins**: Pueden subir a cualquier capítulo

### SELECT (Ver/Descargar archivos)

- ✅ **Presidentes**: Solo ven archivos de su capítulo
- ✅ **Admins**: Ven todos los archivos

### UPDATE (Actualizar archivos)

- ✅ **Presidentes**: Solo pueden actualizar archivos de su capítulo
- ✅ **Admins**: Pueden actualizar cualquier archivo

### DELETE (Eliminar archivos)

- ✅ **Presidentes**: Solo pueden eliminar archivos de su capítulo
- ✅ **Admins**: Pueden eliminar cualquier archivo

---

## 📐 Estructura de Paths

Los archivos se organizan con esta estructura:

```
arca-comprobantes/
├── {chapter_id_1}/
│   ├── {debt_id_1}/
│   │   ├── 1729641234567-comprobante.pdf
│   │   └── 1729641298765-pago-actualizado.jpg
│   └── {debt_id_2}/
│       └── 1729641334567-transferencia.png
└── {chapter_id_2}/
    └── {debt_id_3}/
        └── 1729641434567-deposito.pdf
```

**Beneficios**:
- ✅ Organización clara por capítulo y deuda
- ✅ RLS funciona con `storage.foldername(name)[1]` para extraer `chapter_id`
- ✅ Timestamps evitan colisiones de nombres
- ✅ Fácil de limpiar archivos antiguos por capítulo

---

## 🐛 Troubleshooting

### Error: "duplicate key value violates unique constraint"

**Causa**: El bucket `arca-comprobantes` ya existe.

**Solución**: El script usa `ON CONFLICT DO UPDATE`, por lo que debería actualizar el bucket existente. Si el error persiste, elimina el bucket manualmente desde Storage y vuelve a ejecutar la migración.

### Error: "policy already exists"

**Causa**: Las políticas ya fueron creadas anteriormente.

**Solución**: Elimina las políticas manualmente:

```sql
DROP POLICY IF EXISTS "Presidents upload to own chapter" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload to any chapter" ON storage.objects;
DROP POLICY IF EXISTS "Admins view all proofs" ON storage.objects;
DROP POLICY IF EXISTS "Presidents view own chapter proofs" ON storage.objects;
DROP POLICY IF EXISTS "Presidents update own chapter proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins update all proofs" ON storage.objects;
DROP POLICY IF EXISTS "Presidents delete own chapter proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete all proofs" ON storage.objects;
```

Luego vuelve a ejecutar la migración 006.

### Error al subir archivo desde frontend

**Posibles causas**:

1. **Archivo muy grande**: Verifica que sea ≤5 MB
2. **Tipo de archivo no permitido**: Solo PNG, JPEG, PDF
3. **Usuario no autenticado**: Verifica que `auth.uid()` no sea NULL
4. **Chapter_id incorrecto**: Verifica que el presidente esté asignado al capítulo correcto

**Debug**:

```sql
-- Verificar presidentes y sus capítulos
SELECT
  u.email,
  c.name AS chapter_name,
  c.id AS chapter_id
FROM arca_user_profiles u
JOIN arca_chapters c ON c.president_id = u.user_id
WHERE u.role = 'president';
```

---

## 📚 Próximos Pasos

Una vez completada esta migración:

✅ **T1.4 completado**: Storage Bucket configurado
⏭️ **T1.5**: Implementar Login con Email/Password
⏭️ **T1.6**: Crear Middleware de Protección de Rutas

---

**Fecha de creación**: 23 de Octubre de 2025
**Versión**: 1.0
**Autor**: Arquitecto de Software - El Arca
