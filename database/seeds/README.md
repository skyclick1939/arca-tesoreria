# Seeds de Base de Datos - El Arca

Este directorio contiene scripts SQL para inicializar datos en la base de datos.

## 📁 Archivos Disponibles

### `seed_admin_user.sql` - **PRODUCCIÓN**

**Propósito**: Crear el usuario administrador inicial en el ambiente de producción.

**Cuándo usar**:
- Después del deployment inicial a producción
- Cuando necesites crear un nuevo administrador
- NUNCA en desarrollo (usa `seed_dev_data.sql`)

**Pasos para ejecutar**:

1. **Crear usuario en Supabase Auth Dashboard**:
   ```
   Ir a: Supabase Dashboard → Authentication → Users → Add User

   Datos:
   - Email: admin@arca.com (o email corporativo)
   - Password: [Generar segura - mínimo 16 caracteres]
   - Auto Confirm User: YES ✓
   ```

2. **Ejecutar script SQL**:
   ```
   1. Abrir: Supabase Dashboard → SQL Editor → New Query
   2. Copiar TODO el contenido de seed_admin_user.sql
   3. Pegar en el editor
   4. MODIFICAR las variables de configuración:
      - v_admin_email: Email del administrador
      - v_admin_name: Nombre completo
   5. Click en RUN
   ```

3. **Verificar**:
   ```sql
   SELECT * FROM arca_user_profiles WHERE role = 'admin';
   ```

4. **Probar inicio de sesión**:
   - Ir a la aplicación
   - Login con email y contraseña configurados
   - Verificar acceso al Dashboard de Administrador

**Resultado esperado**:
```
✅ USUARIO ADMINISTRADOR CONFIGURADO EXITOSAMENTE
Email: admin@arca.com
Rol: admin
```

---

### `seed_dev_data.sql` - **DESARROLLO**

**Propósito**: Crear datos de prueba completos para desarrollo y testing.

**Incluye**:
- 1 usuario administrador (admin@arca.local)
- 6 usuarios presidentes
- 7 capítulos (6 activos + 1 inactivo)
- 7 deudas de prueba con diferentes estados

**Cuándo usar**:
- Ambiente de desarrollo local
- Testing de funcionalidades
- Demos y presentaciones
- NUNCA en producción

**Pasos para ejecutar**:

1. **Crear usuarios en Supabase Auth Dashboard** (7 usuarios):
   ```
   admin@arca.local (admin123)
   pres.vallarta@arca.local (pres1234)
   pres.tonala@arca.local (pres1234)
   pres.guadalajara@arca.local (pres1234)
   pres.zapopan@arca.local (pres1234)
   pres.poncitlan@arca.local (pres1234)
   pres.ixtlahuacan@arca.local (pres1234)
   ```

2. **Ejecutar script SQL**:
   ```
   Copiar y pegar seed_dev_data.sql en SQL Editor → RUN
   ```

3. **Verificar**:
   ```sql
   SELECT COUNT(*) FROM arca_user_profiles; -- Debe ser 7
   SELECT COUNT(*) FROM arca_chapters WHERE is_active = true; -- Debe ser 6
   SELECT COUNT(*) FROM arca_debts; -- Debe ser 7
   ```

**Resultado esperado**:
```
✅ SEED DATA EJECUTADO EXITOSAMENTE
Usuarios: 7 (1 admin + 6 presidentes)
Capítulos activos: 6
Deudas creadas: 7
```

---

## 🔒 Seguridad

### Variables de Entorno Requeridas

Para ejecutar seeds en producción, asegúrate de tener:

```bash
# .env.local (NUNCA commitear este archivo)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key # Solo servidor
```

### Buenas Prácticas

✅ **SÍ**:
- Usar contraseñas seguras (16+ caracteres)
- Almacenar credenciales en gestor de contraseñas
- Verificar el ambiente antes de ejecutar seeds
- Hacer backup antes de ejecutar en producción

❌ **NO**:
- Commitear contraseñas en el código
- Usar seed_dev_data.sql en producción
- Compartir contraseñas por email/WhatsApp
- Reutilizar contraseñas entre ambientes

---

## 🛠️ Troubleshooting

### Error: "No se encontró un usuario con email..."

**Causa**: El usuario no existe en Supabase Auth.

**Solución**:
1. Crear el usuario en Supabase Dashboard → Authentication
2. Ejecutar el script nuevamente

---

### Error: "El trigger on_auth_user_created falló"

**Causa**: El trigger automático no se ejecutó.

**Solución**: El script crea el perfil manualmente como fallback (no requiere acción).

---

### Error: "El usuario no puede iniciar sesión"

**Causa**: Email no confirmado.

**Solución**:
1. Ir a Supabase Dashboard → Authentication → Users
2. Buscar el usuario
3. Click en "..." → Confirm email

---

## 📞 Soporte

Si encuentras problemas:

1. Verifica que las migraciones estén ejecutadas:
   ```sql
   SELECT COUNT(*) FROM arca_user_profiles; -- Tabla debe existir
   ```

2. Revisa los logs del script SQL en Supabase Dashboard

3. Consulta la documentación completa en `/database/migrations/README.md`

---

**Última actualización**: 28 de Octubre de 2025
**Versión**: 1.0
