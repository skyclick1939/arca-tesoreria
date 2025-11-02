# Guía Completa de Configuración para Deployment Automático
## El Arca - Integración de MCPs de Vercel y GitHub

**Fecha:** 2025-11-01
**Para:** Usuario No Técnico
**Objetivo:** Configurar MCPs de Vercel y GitHub para deployment automático vía Claude Code

---

## 📋 ¿Qué Vamos a Lograr?

Al finalizar esta guía, Claude Code podrá:
- ✅ Crear repositorios en GitHub automáticamente
- ✅ Subir código a GitHub sin tu intervención
- ✅ Deployar tu aplicación a Vercel
- ✅ Configurar variables de entorno necesarias
- ✅ Gestionar actualizaciones futuras

Todo esto **SIN que tengas que tocar comandos** de Git o configuraciones complejas.

---

## 🎯 Resumen de Lo Que Necesitas

Antes de empezar, necesitarás generar **2 tokens** (llaves de acceso):

| Token | ¿Para qué sirve? | ¿Dónde se genera? |
|-------|------------------|-------------------|
| **GitHub Personal Access Token (PAT)** | Permite a Claude crear repos, subir código, gestionar tu cuenta de GitHub | https://github.com/settings/tokens |
| **Vercel Access Token** | Permite a Claude deployar apps, configurar variables, gestionar proyectos | https://vercel.com/account/tokens |

**IMPORTANTE:** Estos tokens son como **contraseñas especiales** que le das a Claude para que trabaje en tu nombre. Debes guardarlos en un lugar seguro.

---

## 📝 PASO 1: Crear GitHub Personal Access Token (PAT)

### ¿Qué es un PAT?
Es una "llave digital" que le permite a Claude Code acceder a tu cuenta de GitHub para crear repositorios, subir código y gestionar tu proyecto.

### Pasos Detallados

#### 1.1. Ir a la Página de Configuración de Tokens

1. **Abre tu navegador** y ve a: https://github.com
2. **Haz clic en tu foto de perfil** (esquina superior derecha)
3. En el menú desplegable, haz clic en **"Settings"** (Configuración)
4. En la barra lateral izquierda, **baja hasta el final** y haz clic en **"Developer settings"**
5. En la nueva barra lateral, haz clic en **"Personal access tokens"**
6. Haz clic en **"Fine-grained tokens"** (Tokens de grano fino - RECOMENDADO)
   - *Nota: También puedes usar "Tokens (classic)" si prefieres, pero los Fine-grained son más seguros*

#### 1.2. Crear el Token

1. Haz clic en el botón verde **"Generate new token"**
2. Si pide autenticación, ingresa tu contraseña de GitHub

#### 1.3. Configurar el Token

Llena el formulario con estos datos:

**Token name (Nombre del token):**
```
claude-code-arca-deployment
```
*Esto es solo para que recuerdes para qué sirve*

**Description (Descripción) - OPCIONAL:**
```
Token para que Claude Code pueda deployar El Arca a Vercel y GitHub
```

**Expiration (Expiración):**
- Selecciona: **"Custom..."** (Personalizado)
- Elige una fecha **1 año en el futuro** (por ejemplo: 2026-11-01)
- *Nota: Puedes elegir "No expiration" pero GitHub lo desaconseja por seguridad*

**Resource owner (Propietario del recurso):**
- Deja tu nombre de usuario (debería estar pre-seleccionado)

**Repository access (Acceso a repositorios):**
- Selecciona: **"All repositories"** (Todos los repositorios)
- *Esto permite a Claude crear nuevos repos y acceder a los existentes*

#### 1.4. Permisos (Permissions)

Ahora viene la parte importante. Activa estos permisos:

**Repository permissions (Permisos de repositorio):**

| Permiso | Nivel de Acceso | ¿Por qué? |
|---------|-----------------|-----------|
| **Contents** | Read and write | Para subir código |
| **Metadata** | Read-only | Información básica del repo |
| **Pull requests** | Read and write | Para crear PRs si es necesario |
| **Workflows** | Read and write | Para configurar GitHub Actions (futuro) |
| **Administration** | Read and write | Para crear repositorios nuevos |

**Account permissions (Permisos de cuenta):**

| Permiso | Nivel de Acceso | ¿Por qué? |
|---------|-----------------|-----------|
| **Email addresses** | Read-only | Para identificación |

#### 1.5. Generar y Copiar el Token

1. Baja hasta el final de la página
2. Haz clic en el botón verde **"Generate token"**
3. **MUY IMPORTANTE:** GitHub mostrará tu token **UNA SOLA VEZ**
4. El token se ve así: `github_pat_11AAAA...` (mucho más largo)
5. Haz clic en el icono de **"Copy"** (copiar) al lado del token
6. **Pega el token en un archivo de texto temporal** (Notepad)
   - NO cierres la página hasta que estés seguro de que lo guardaste

**Ejemplo de dónde guardarlo temporalmente:**
```
C:\Users\USUARIO\Desktop\tokens_temporales.txt
```

Y escribe:
```
GITHUB_PAT=github_pat_11AAAA...tu-token-completo-aquí
```

---

## 🚀 PASO 2: Crear Vercel Access Token

### ¿Qué es un Vercel Access Token?
Es la "llave digital" que le permite a Claude Code deployar tu aplicación a Vercel, configurar variables de entorno y gestionar tus proyectos.

### Pasos Detallados

#### 2.1. Ir a la Página de Tokens de Vercel

1. **Abre tu navegador** y ve a: https://vercel.com
2. **Inicia sesión** con tu cuenta
3. Haz clic en tu **foto de perfil / avatar** (esquina superior derecha)
4. Selecciona **"Settings"** (Configuración)
5. En la barra lateral izquierda, haz clic en **"Tokens"**

#### 2.2. Crear el Token

1. Haz clic en el botón **"Create"** (Crear)
2. Se abrirá un modal (ventana emergente)

#### 2.3. Configurar el Token

**Token Name (Nombre del token):**
```
claude-code-deployment
```

**Scope (Alcance):**
- Si ves un dropdown de "Teams", selecciona tu team
- **IMPORTANTE:** Usa el Team ID que me proporcionaste: `team_FbMaLFKwLMlJnhdAjkdsnwG6`
- Si no aparece el dropdown, significa que el token tendrá acceso a tu cuenta personal (está bien)

**Expiration (Expiración):**
- Selecciona: **"1 year"** (1 año)
- Fecha sugerida: 2026-11-01

#### 2.4. Generar y Copiar el Token

1. Haz clic en **"Create Token"**
2. Vercel mostrará tu token **UNA SOLA VEZ**
3. El token se ve así: `vercel_abcd1234...` (cadena larga de caracteres)
4. Haz clic en **"Copy"** para copiarlo
5. **Pega el token en tu archivo temporal** (el mismo `tokens_temporales.txt`)

Añade en el archivo:
```
VERCEL_TOKEN=vercel_abcd1234...tu-token-completo-aquí
```

**Tu archivo `tokens_temporales.txt` ahora debería verse así:**
```
GITHUB_PAT=github_pat_11AAAA...
VERCEL_TOKEN=vercel_abcd1234...
```

---

## 🔧 PASO 3: Datos Adicionales que Necesito

Para completar la configuración, también necesito algunos datos de tu proyecto.

### 3.1. Información de Vercel

**Team ID:** ✅ Ya lo tengo → `team_FbMaLFKwLMlJnhdAjkdsnwG6`

**Team Slug (Nombre corto del equipo):**
- Ve a: https://vercel.com/account
- En la sección "Teams", verás tu equipo
- El "slug" es la parte de la URL cuando estás en tu equipo
- Por ejemplo: `https://vercel.com/tu-equipo-slug`

👉 **Por favor proporciona tu Team Slug:** _______________

### 3.2. Información de GitHub

**Tu Nombre de Usuario de GitHub:**
- Es el nombre que aparece en tu perfil
- Por ejemplo: si tu perfil es `https://github.com/juan-perez`, tu username es `juan-perez`

👉 **Tu GitHub Username:** _______________

**Nombre para el Repositorio (sugerencia):**
```
arca-tesoreria
```
*Puedes cambiarlo si deseas otro nombre*

### 3.3. Variables de Entorno de Supabase

Necesito las credenciales de Supabase para configurarlas en Vercel. Ya las tienes en tu archivo `.env.local`:

1. Abre el archivo: `C:\Users\USUARIO\Downloads\desarrollos externos\arca-app\.env.local`
2. Copia EXACTAMENTE los valores de:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Ejemplo de lo que verás:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://tuproyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

👉 **Supabase URL:** _______________
👉 **Supabase Anon Key:** _______________

---

## ✅ Checklist Final - ¿Tienes Todo?

Antes de que yo configure los MCPs, verifica que tengas:

- [ ] **GitHub Personal Access Token** - Copiado y guardado
- [ ] **Vercel Access Token** - Copiado y guardado
- [ ] **Vercel Team Slug** - Identificado
- [ ] **GitHub Username** - Identificado
- [ ] **Supabase URL** - Copiado de `.env.local`
- [ ] **Supabase Anon Key** - Copiado de `.env.local`
- [ ] **Nombre del repositorio decidido** - Por defecto: `arca-tesoreria`

---

## 🎯 Próximos Pasos (Lo Haré Yo - Claude)

Una vez que me proporciones todos los datos anteriores, yo ejecutaré automáticamente:

### Fase 1: Configuración de MCPs ⚙️
1. Instalar GitHub MCP Server
2. Instalar Vercel MCP Server
3. Configurar autenticación con tus tokens

### Fase 2: Preparación del Código 📦
1. Inicializar Git en el proyecto local
2. Crear `.gitignore` apropiado
3. Preparar archivos de configuración de Vercel

### Fase 3: Deployment a GitHub 🐙
1. Crear repositorio en GitHub
2. Subir todo el código
3. Configurar rama principal

### Fase 4: Deployment a Vercel 🚀
1. Crear proyecto en Vercel
2. Vincular con repositorio de GitHub
3. Configurar variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Ejecutar primer deployment
5. Configurar dominio

### Fase 5: Verificación ✅
1. Verificar que la app esté funcionando en producción
2. Probar autenticación
3. Verificar conexión con Supabase
4. Entregar URL de producción

---

## ⚠️ Medidas de Seguridad

### Cosas que NUNCA debes hacer:

❌ **NO compartas tus tokens con nadie más**
❌ **NO subas tus tokens a GitHub o servicios públicos**
❌ **NO publiques capturas de pantalla de tus tokens**
❌ **NO uses los mismos tokens en múltiples servicios**

### Cosas que DEBES hacer:

✅ **Guarda tus tokens en un gestor de contraseñas** (1Password, Bitwarden, LastPass)
✅ **Borra el archivo `tokens_temporales.txt` después de configurar**
✅ **Revoca tokens antiguos que ya no uses**
✅ **Establece fechas de expiración**

---

## 🆘 Problemas Comunes y Soluciones

### "No encuentro la opción de Developer Settings en GitHub"
- Verifica que estés viendo tu perfil personal, no el de una organización
- La opción está al final de la barra lateral izquierda en Settings

### "Vercel no me muestra la opción de Tokens"
- Verifica que iniciaste sesión
- Si estás en un equipo, necesitas permisos de Owner o Member

### "Mi token de GitHub fue rechazado"
- Verifica que copiaste el token completo (empieza con `github_pat_`)
- Asegúrate de que no tiene espacios al inicio o final
- Confirma que seleccionaste los permisos correctos

### "El token de Vercel no funciona"
- Verifica que el token no haya expirado
- Confirma que el scope incluye el team correcto

---

## 📞 ¿Listo para Continuar?

Una vez que tengas **TODOS los datos** listados en el Checklist Final, proporciónamelos y yo me encargaré del resto.

**Formato para compartir los datos:**

```
GITHUB_PAT: github_pat_...
VERCEL_TOKEN: vercel_...
VERCEL_TEAM_SLUG: tu-team-slug
GITHUB_USERNAME: tu-username
REPO_NAME: arca-tesoreria
SUPABASE_URL: https://...
SUPABASE_ANON_KEY: eyJ...
```

**¡No te preocupes! Una vez que me des estos datos, yo me encargo de TODO el proceso técnico.** 🚀

---

**Última actualización:** 2025-11-01
**Versión:** 1.0
**Proyecto:** El Arca - Sistema de Tesorería
