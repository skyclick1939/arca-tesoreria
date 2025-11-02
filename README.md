# El Arca - Sistema de Tesorería para Moto Club

## 🚀 Estado del Proyecto

✅ **T1.1**: Proyecto Supabase creado y configurado
✅ **T1.2**: Migraciones SQL ejecutadas (001-006) y validadas
✅ **T1.3**: Next.js + Tailwind configurado completamente
✅ **T1.4**: Storage Bucket configurado con RLS policies
✅ **T1.5**: Login con Email/Password implementado
✅ **T1.5.1**: Error 500 diagnosticado y migración 008 creada
⏳ **T1.6**: Ejecutar migración 008 y probar login (siguiente paso)

---

## 🔐 Acceso al Sistema

El sistema está corriendo en: **http://localhost:3000**

### Credenciales de Prueba

**⚠️ IMPORTANTE**: Ejecuta las migraciones `007_fix_rls_recursion.sql` y `008_fix_rls_policies.sql` antes de intentar hacer login.

**Administrador:**
- Email: `admin@arca.local`
- Password: `admin123`
- Acceso a: Panel de administración completo

**Presidente:**
- Email: `pres.vallarta@arca.local`
- Password: `pres1234` ← **ACTUALIZADA** (era `pres123`)
- Acceso a: Panel de presidente (solo su capítulo)

**Nota**: Todas las contraseñas de presidentes fueron actualizadas de 7 a 8 caracteres para cumplir requisitos de seguridad.

---

## 📋 Stack Tecnológico

- **Frontend**: Next.js 14.2.15 (Pages Router)
- **State Management**: React Query v4 + Context API
- **Styling**: Tailwind CSS v3
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **TypeScript**: 5.3.3

---

## 🛠️ Configuración Inicial

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

Copia el archivo de ejemplo y rellena con tus credenciales de Supabase:

```bash
cp .env.local.example .env.local
```

Edita `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

### 3. Ejecutar en Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 📁 Estructura del Proyecto

```
arca-app/
├── pages/
│   ├── _app.tsx              # App wrapper con React Query provider
│   └── index.tsx             # Página de inicio
├── lib/
│   ├── supabase.ts           # Cliente singleton de Supabase
│   └── storage/
│       └── storage-helpers.ts # Utilidades para manejo de archivos
├── hooks/
│   └── useUploadProof.ts     # Hooks para upload/delete de comprobantes
├── components/
│   └── FileUploadTest.tsx    # Componente de prueba de upload
├── styles/
│   └── globals.css           # Estilos globales + Tailwind
├── .env.local.example        # Template de variables de entorno
├── tailwind.config.js        # Configuración de Tailwind (paleta El Arca)
├── tsconfig.json             # Configuración de TypeScript
├── next.config.js            # Configuración de Next.js
└── package.json              # Dependencias
```

---

## 🎨 Paleta de Colores

Inspirada en la bandera mexicana 🇲🇽:

- **Primary**: `#006847` (Verde oscuro)
- **Primary Light**: `#4CAF50` (Verde Material)
- **Danger**: `#CE1126` (Rojo México)
- **Background Dark**: `#121212`
- **Surface Dark**: `#1E1E1E`

Ver `tailwind.config.js` para la paleta completa.

---

## 📝 React Query Configuración

```typescript
staleTime: 60000,    // 1 minuto (datos financieros frescos)
cacheTime: 300000,   // 5 minutos (mantener en caché)
retry: 2,            // 2 reintentos (Supabase tiene 99.9% uptime)
```

---

## 🗄️ Base de Datos

Las migraciones SQL ya fueron ejecutadas en Supabase:

- ✅ 4 ENUMs (user_role, debt_type_enum, debt_status_enum, regional_enum)
- ✅ 4 Tablas (arca_user_profiles, arca_chapters, arca_debts, arca_audit_logs)
- ✅ 13 Políticas RLS
- ✅ 9 Triggers (8 en public + 1 en auth)
- ✅ 6 Funciones de negocio
- ✅ 1 Storage Bucket (arca-comprobantes) con 8 políticas RLS

Ver `database/migrations/README.md` para más detalles.

---

## 📁 Storage de Comprobantes

### Configuración

**Bucket**: `arca-comprobantes`
- **Tipo**: Privado (requiere autenticación)
- **Tamaño máximo**: 5 MB por archivo
- **Tipos permitidos**: PNG, JPEG, PDF

### Estructura de Paths

```
arca-comprobantes/
├── {chapter_id}/
│   └── {debt_id}/
│       └── {timestamp}-{filename}.{ext}
```

**Ejemplo**:
```
arca-comprobantes/uuid-chapter-123/uuid-debt-456/1729641234567-comprobante.pdf
```

### Utilidades Disponibles

#### Helpers de Storage (`lib/storage/storage-helpers.ts`)

```typescript
import {
  validateFile,          // Validar tamaño y tipo de archivo
  generateProofPath,     // Generar path correcto
  formatFileSize,        // Formatear bytes a KB/MB
  sanitizeFilename,      // Limpiar nombre de archivo
} from '@/lib/storage/storage-helpers';
```

#### Hooks Personalizados (`hooks/useUploadProof.ts`)

```typescript
import {
  useUploadProof,    // Subir comprobante nuevo
  useReplaceProof,   // Reemplazar comprobante existente
  useDeleteProof,    // Eliminar comprobante
  useGetSignedUrl,   // Obtener URL firmada temporal
} from '@/hooks/useUploadProof';
```

### Ejemplo de Uso

```tsx
import { useUploadProof } from '@/hooks/useUploadProof';

function UploadComponent() {
  const { uploadProof, isUploading, error } = useUploadProof();

  const handleUpload = async (file: File) => {
    try {
      const result = await uploadProof({
        file,
        chapterId: 'uuid-chapter-123',
        debtId: 'uuid-debt-456',
      });
      console.log('Archivo subido:', result.path);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return (
    <input
      type="file"
      accept=".png,.jpg,.jpeg,.pdf"
      onChange={(e) => handleUpload(e.target.files![0])}
      disabled={isUploading}
    />
  );
}
```

### Políticas de Seguridad (RLS)

- ✅ **Presidentes**: Solo pueden subir/ver/modificar comprobantes de SU capítulo
- ✅ **Admins**: Pueden subir/ver/modificar comprobantes de TODOS los capítulos
- ✅ Validación automática de permisos por `chapter_id`

---

## 🔄 Próximos Pasos

1. **T1.4**: Configurar Storage Bucket para comprobantes de pago
2. **T1.5**: Implementar Login con Email/Password
3. **T1.6**: Crear Middleware de Protección de Rutas
4. **T1.7**: Crear Usuario Admin Seed
5. **T1.8-T1.10**: CRUD de Capítulos (Admin)

---

## 📚 Documentación

- [PRD](../PRD.md) - Product Requirements Document
- [Arquitectura Simplificada](../ARQUITECTURA_SIMPLIFICADA.md) - Decisiones arquitectónicas
- [Plan de Tareas](../PLAN_TAREAS.md) - Roadmap completo del proyecto
- [Migraciones SQL](../database/migrations/README.md) - Documentación de la base de datos

---

**Versión**: 1.0.0
**Última actualización**: 23 de Octubre de 2025
**Arquitectura**: Simplificada (100% Supabase Backend)
