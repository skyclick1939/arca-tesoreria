El Arca: Sistema de Tesorería de Moto Club2.1 Metadatos y Contexto del ProyectoTítulo del Proyecto: El ArcaEstado: v1.0 - Aprobado para DesarrolloStakeholders Clave:Propietario del Producto (Admin): (Tu Nombre/Rol)Gestión de Producto: AI PRD ArchitectLíder Técnico (Tech Lead): (Por definir)Fecha de Lanzamiento Objetivo: Q1 (Por definir)Historial de Cambios (Versionamiento):
v1.0 (21/10/2025): Creación inicial del documento basada en los mockups HTML y las sesiones de definición de requisitos
v1.1 (22/10/2025): Actualización crítica - Integración de campos bancarios, dashboard multi-vista (3 tabs), validaciones y flujo de upload con modal
3.2.2 El Núcleo Estratégico: El "Porqué"Contexto y Antecedentes (Background)Actualmente, la mesa directiva del motoclub gestiona todos los cobros (apoyos, multas, cuotas) y pagos a través de una combinación de hojas de Excel y grupos de WhatsApp. Este método es manual, lento, propenso a errores y carece de un sistema centralizado de registro y auditoría.Planteamiento del Problema (Problem Statement)La gestión financiera descentralizada y manual (Excel + WhatsApp) es ineficiente y consume mucho tiempo4. Provoca una falta de transparencia sobre el estado de las deudas y pagos, lo que dificulta la aplicación de una contabilidad clara y el cobro enérgico de las cuotas a los capítulos morosos. Esto impacta la salud financiera y la confianza dentro del club5.Encaje Estratégico (Strategic Fit)"El Arca" se alinea con el objetivo de profesionalizar la tesorería del motoclub. Su propósito es asegurar la solvencia financiera y la continuidad operativa mediante un sistema transparente, auditable y eficiente6.2.3 Objetivos y Métricas de ÉxitoEl objetivo de este producto es centralizar y automatizar la gestión de tesorería del motoclub para mejorar la eficiencia de la cobranza y la transparencia financiera.Objetivos y Resultados Clave (OKRs) 7Objetivo: Profesionalizar las operaciones financieras del club para garantizar la transparencia, la contabilidad y la solvencia.Resultados Clave (KRs):Reducir el tiempo manual de conciliación y seguimiento del Administrador en un 90% en los primeros 3 meses post-lanzamiento.Aumentar la tasa de cumplimiento de pagos (pagos realizados antes de la fecha límite) al 95%.Lograr una adopción del 100% de la plataforma para todas las solicitudes de pago y carga de comprobantes, eliminando el uso de WhatsApp/Excel para este fin en el primer mes.2.4 Enfoque en el UsuarioPersonas 81. "El Admin" (Administrador / Tesorero)Vistas: code_.html (Login), code_DASHBO.html (Dashboard Global), code_admincapi.html (Gestión de Capítulos), code_registro.html (Registrar Movimiento).Objetivo: Tener control total. Crear solicitudes de pago, rastrear el estado de la cobranza de todos los capítulos en tiempo real y auditar/validar los comprobantes de pago para asegurar la integridad de las finanzas.Dolor (Actual): "Pierdo horas en Excel y persiguiendo gente por WhatsApp. No sé quién ha pagado hasta que reviso manualmente el banco y mi hoja de cálculo."2. "El Presidente" (Presidente de Capítulo)Vistas: code_.html (Login), code_Comprob.html (Subir Comprobante), code_MULTA.html (Detalle), y un Dashboard de Capítulo (vista por definir).Objetivo: Ver clara y rápidamente solo las deudas de su capítulo. Entender por qué debe, cuánto debe y para cuándo. Poder subir el comprobante de pago consolidado de su capítulo de forma sencilla.Dolor (Actual): "A veces no estoy seguro de cuánto debemos o si mi pago anterior ya fue registrado. Tengo que preguntar por WhatsApp y esperar respuesta."Escenarios de Usuario (Use Cases) 9Escenario Principal (Happy Path): Flujo de Cobranza ConsolidadoEl Admin da de alta los capítulos en code_admincapi.html (ej. Capítulo A - 10 Miembros, Capítulo B - 20 Miembros, Capítulo C - 15 Miembros). Total Global: 45 Miembros.El Admin crea un "Registro de Apoyo" por $9,000 MXN en code_registro.html.El Sistema calcula el costo por miembro:$$\text{CostoPorMiembro} = \frac{\text{Monto Total}}{\text{Total Miembros Global}} = \frac{\$9,000}{45} = \$200 \text{ por miembro}$$El Sistema asigna la deuda consolidada a cada capítulo y la marca como Pendiente:Capítulo A debe: $200 \times 10 = \$2,000$Capítulo B debe: $200 \times 20 = \$4,000$Capítulo C debe: $200 \times 15 = \$3,000$El Presidente del Capítulo B inicia sesión. Ve en su dashboard una deuda "Pendiente" de $4,000. Recolecta el dinero de sus 20 miembros (por fuera de la app).El Presidente hace la transferencia bancaria y sube el comprobante usando el formulario code_Comprob.html.El Sistema actualiza el estado de esa deuda a En Revisión.El Admin ve en su code_DASHBO.html una deuda "En Revisión". Abre el detalle, revisa el comprobante subido y confirma que el monto es correcto.El Admin presiona el botón "Aprobar" (botón no mostrado en mockups, debe añadirse).El Sistema actualiza el estado de la deuda a Aprobado (mostrado como "Pagado" en code_MULTA.html). El "Saldo General" del dashboard del Admin se actualiza.Escenarios Secundarios (Unhappy Paths) 10101010Pago Atrasado: Un Presidente no sube el comprobante antes de la fecha_limite_pago. El estado cambia automáticamente de Pendiente a Atrasado (color rojo, como en code_DASHBO.html).Comprobante Incorrecto: Un Presidente sube un archivo erróneo (borroso, monto incorrecto). El estado cambia a En Revisión. El Admin lo revisa, no lo aprueba, y contacta al Presidente por fuera de la app (WhatsApp) para que lo corrija. El Presidente debe poder reemplazar el archivo.2.5 Requisitos Funcionales (El "Qué")Épica 1: Autenticación y PerfilesIDHistoria de Usuario Criterios de Aceptación F-1.1Como usuario (Admin o Presidente), quiero iniciar sesión con mi usuario y contraseña (visto en code_.html).- La autenticación se valida contra Supabase Auth.
- En caso de éxito, el usuario es redirigido a su dashboard correspondiente (Global o de Capítulo).
- En caso de fallo, se muestra un mensaje de error claro.F-1.2Como Admin, quiero que el sistema me identifique con un rol de "Admin" para ver todas las funciones de gestión.- La sesión del usuario debe contener un role = admin.F-1.3Como Presidente, quiero que el sistema me identifique como "Presidente" y me asocie a mi capítulo.- La sesión del usuario debe contener un role = presidente y un chapter_id asociado.Épica 2: Gestión de Capítulos (Solo Admin)IDHistoria de UsuarioCriterios de AceptaciónF-2.1Como Admin, quiero crear, ver, editar y eliminar Capítulos desde la vista code_admincapi.html.- Un Capítulo debe tener: Nombre, Regional y Número de Miembros (campo numérico).
- El Número de Miembros es crítico para la lógica de cálculo de deudas.F-2.2Como Admin, quiero ver tarjetas de resumen con el total de capítulos y miembros.- La vista code_admincapi.html debe mostrar estas tarjetas, calculadas dinámicamente desde la BD.F-2.3Como Admin, quiero buscar capítulos o miembros en la lista.- El campo de búsqueda en code_admincapi.html debe filtrar la lista de capítulos en tiempo real.F-2.4Como Admin, quiero gestionar (crear/asignar) los inicios de sesión para los Presidentes de Capítulo desde el mismo formulario de creación/edición de capítulos.
- **Ubicación:** Modal de "Añadir/Editar Capítulo" en code_admincapi.html
- **Campos adicionales del formulario:**
  - Email del Presidente (obligatorio)
  - Contraseña temporal (obligatorio en creación, opcional en edición)
- **Lógica:**
  - Al crear capítulo: se crea automáticamente el usuario en Supabase Auth con role='presidente' y chapter_id asignado
  - Al editar capítulo: se puede actualizar email o resetear contraseña del Presidente asociado
- **Constraint:** Un capítulo solo puede tener UN Presidente asociado (relación 1:1)Épica 3: Gestión de Movimientos (Admin)IDHistoria de UsuarioCriterios de AceptaciónF-3.1Como Admin, quiero registrar un nuevo movimiento (Apoyo o Multa) con toda la información bancaria necesaria.- Debo poder seleccionar el tipo de movimiento (Apoyo/Multa).
- Debo poder ingresar: Monto Total, Fecha límite de pago, Tipo/Categoría y Descripción.
- **NUEVO:** Debo especificar los datos bancarios de destino:
  - Banco (dropdown con 20 bancos mexicanos: BBVA, Santander, Citibanamex, Banorte, HSBC, Scotiabank, Inbursa, Banco Azteca, BanCoppel, Banregio, Spin by OXXO, STP, Hey Banco, Nu México, Stori, Albo, Afirme, Banjercito, Compartamos Banco, Otro)
  - CLABE Interbancaria (18 dígitos, opcional)
  - Número de Cuenta (10-16 dígitos, opcional)
  - Titular de la Cuenta (obligatorio)
- **Validación Crítica:** Al menos uno de los campos CLABE o Número de Cuenta debe estar lleno correctamente.
- **ELIMINADO:** El campo "Comprobante" del mockup original NO se incluye (el Admin no sube comprobantes, solo los Presidentes).F-3.2Como Sistema, al crear un movimiento, debo calcular y asignar la deuda consolidada a CADA capítulo.- La lógica debe seguir el "Escenario Principal" (Sección 2.4).
- Se debe crear un registro de deuda individual para cada capítulo (ej. chapter_payment_request).
- El estado inicial de todas estas deudas debe ser Pendiente.F-3.3Como Sistema, quiero cambiar automáticamente el estado de una deuda a Atrasado.- Un proceso (ej. un cron job o una validación al cargar) debe verificar las deudas.
- Si fecha_actual > fecha_limite_pago Y estado == 'Pendiente', el estado debe cambiar a Atrasado.F-3.4Como Admin, quiero poder editar o eliminar un Movimiento que creé por error.- Esta acción (Editar/Eliminar) debe estar permitida solo si ningún capítulo ha subido un comprobante (es decir, todos los estados de pago asociados son Pendiente o Atrasado).Épica 4: Dashboard y Flujo de PagoIDHistoria de UsuarioCriterios de AceptaciónF-4.1Como Admin, quiero ver un Dashboard Multi-Vista con 3 tabs para monitorear la salud financiera desde diferentes perspectivas.
- **Tab 1 - Vista General:**
  - Mostrar métricas globales: Total Adeudos, Total Recabado, Faltante por Cobrar (diferencia)
  - Gráfica de cumplimiento general
  - Lista de "Últimas Transacciones" con filtros (Todo, Pagado, Pendiente, Atrasado, **En Revisión**)
  - Badge de notificaciones mostrando cantidad de pagos "En Revisión"
- **Tab 2 - Vista Por Solicitud:**
  - Lista de todas las solicitudes activas (ej. "Apoyo Aniversario Jalisco", "Multa Evento Monterrey")
  - Al hacer clic en una solicitud, mostrar drill-down con:
    - Monto total de la solicitud
    - Monto recabado (% de cumplimiento)
    - Monto faltante
    - Desglose por capítulo (cuánto debe cada uno, cuánto han pagado)
- **Tab 3 - Vista Por Capítulo:**
  - Lista de todos los capítulos
  - Por cada capítulo mostrar:
    - Adeudos totales asignados
    - Monto pagado (Aprobado)
    - Monto pendiente
    - Monto atrasado
- **Definición de "Saldo General":** Total Adeudos - Total Recabado (Aprobado) = Faltante por CobrarF-4.2Como Presidente de Capítulo, quiero ver un Dashboard filtrado automáticamente con solo los adeudos de mi capítulo.
- **Campos por cada adeudo:**
  - Nombre del Capítulo (solo lectura, siempre el mío)
  - Regional (solo lectura)
  - Número de Miembros del capítulo (solo lectura)
  - Concepto de apoyo (ej. "Apoyo Aniversario Jalisco")
  - Monto del apoyo asignado al capítulo
  - **Monto por miembro** (calculado: monto capítulo / número miembros)
  - Fecha de vencimiento con **indicador de urgencia** (ej. "Vencido hace 5 días")
  - Estatus (Pendiente/Atrasado/En Revisión/Aprobado) con código de color
  - **Datos bancarios de destino (solo lectura):**
    - Banco
    - CLABE Interbancaria
    - Número de Cuenta
    - Titular
  - **Botón "Subir Comprobante"** (solo habilitado para adeudos de su propio capítulo en estado Pendiente/Atrasado)
  - Si ya subió comprobante: mostrar "Comprobante subido el [fecha]" con botones "Ver Comprobante" y "Reemplazar"F-4.3Como Presidente, quiero hacer clic en "Subir Comprobante" desde mi dashboard y que se abra un modal inline con el formulario.
- **Flujo con Modal Inline (UX optimizada):**
  - Click en "Subir Comprobante" → Se abre modal sin navegar a otra página
  - Modal mantiene el contexto visual del dashboard
  - Al enviar → Modal se cierra → Dashboard se actualiza automáticamente
- **Campos del Modal (todos pre-cargados y NO editables excepto archivo y notas):**
  - [SOLO LECTURA] Solicitud: "Apoyo Aniversario Jalisco"
  - [SOLO LECTURA] Mi Capítulo: "Norte"
  - [SOLO LECTURA] Monto que debo: $2,000
  - [SOLO LECTURA] Depositar a: "BBVA - CLABE: 012345678901234567 - Titular: Tesorería Moto Club"
  - [EDITABLE] Archivo comprobante (Imagen o PDF, máx 5MB)
  - [EDITABLE] Notas adicionales (opcional)
- **Seguridad Anti-Error:** RLS Policy impide que Presidente suba comprobante a debt_id que no sea de su capítulo (error 403 si manipula URL)
F-4.4Como Presidente, al subir el comprobante exitosamente, el sistema debe actualizar el estado.
- El archivo se guarda en Supabase Storage en: `arca-comprobantes/{chapter_id}/{debt_id}/{timestamp}-{filename}`
- El estado de la deuda cambia automáticamente a "En Revisión"
- El Presidente puede ver el estado actualizado en su dashboard inmediatamenteF-4.5Como Presidente, quiero poder reemplazar un comprobante que subí (en caso de error).- Si el estado es En Revisión (es decir, el Admin aún no aprueba), debo poder subir un archivo nuevo que reemplace al anterior.F-4.6Como Admin, quiero auditar y aprobar los pagos que están "En Revisión".- En mi dashboard, debo poder ver/filtrar los pagos "En Revisión".
- Debo poder ver/descargar el comprobante subido por el Presidente.
- Debo tener un botón de "Aprobar" para esa transacción.F-4.7Como Admin, al "Aprobar" un pago...- ...el estado de la deuda debe cambiar a Aprobado.
- ...las métricas del Dashboard Global (code_DASHBO.html) deben recalcularse para incluir este monto.F-4.8Como Admin o Presidente, quiero ver el detalle de un movimiento completado (code_MULTA.html).- Debe mostrar el concepto, monto, fecha y el estado final "Pagado" (Aprobado).2.6 Requisitos No Funcionales (NFRs - El "Cómo de Bien") 14Rendimiento:La carga inicial de la aplicación (SPA) debe completarse en $< 3$ segundos en una conexión 4G15.Todas las transiciones de vistas y consultas a la base de datos deben responder en $< 1$ segundo (p95).Compatibilidad:La aplicación web debe ser Mobile-First y 100% funcional en los motores de navegador de las webviews: Chrome para Android (últimas 2 versiones) y Safari para iOS (últimas 2 versiones)16.Seguridad:La autenticación debe ser manejada por Supabase Auth17.Control de Acceso (Crítico): Un Presidente de Capítulo SÓLO puede ver/acceder a los datos (deudas, comprobantes) asociados a su chapter_id. Las queries de Supabase deben implementar Seguridad a Nivel de Fila (RLS) para forzar esta regla de negocio a nivel de base de datos18.Almacenamiento: Los comprobantes de pago subidos (archivos en Supabase Storage) deben ser privados y solo accesibles por el Presidente que lo subió y los usuarios con rol "Admin".Disponibilidad y Fiabilidad:El servicio debe tener una disponibilidad del 99.9% (gestionado por Supabase)19.Almacenamiento (Constraints de Archivo):Basado en el mockup code_registro.html, los archivos de comprobantes estarán limitados a 5MB y los tipos permitidos son PNG, JPG, PDF.Mantenibilidad:El código debe seguir las mejores prácticas de Next.js y Supabase20.2.7 Alcance y LímitesFuera de Alcance (Out of Scope / Won't Do) 21Gestión de Miembros Individuales: La app NO gestiona la lista de miembros individuales de cada capítulo, ni rastrea quién ha pagado a su Presidente. Toda la lógica es consolidada a nivel Capítulo.Procesamiento de Pagos: La app NO se integra con pasarelas de pago (Stripe, etc.). Solo actúa como un sistema de rastreo de comprobantes de transferencias bancarias externas.Flujo de "Rechazo" Explícito: No habrá un botón de "Rechazar". Si un comprobante está mal, el Admin contacta al Presidente por un medio externo y el Presidente reemplaza el archivo (ver F-4.5).Notificaciones Push Nativas: Debido a la restricción de webintoapp.com (webview), no se implementarán notificaciones push nativas en esta versión.Supuestos (Assumptions) 22Se asume que la pila tecnológica será Next.js (Frontend) y Supabase (Backend, Auth, Storage).Se asume que los Presidentes de Capítulo tienen la capacidad de obtener un comprobante digital (imagen/PDF) de sus transacciones.Restricciones (Constraints) 23Plataforma: El producto final será una Aplicación Web (SPA) renderizada dentro de un webview (usando webintoapp.com). No es una app nativa.Backend: El backend debe utilizar la infraestructura serverless de Supabase para minimizar el mantenimiento.2.8 Diseño y Experiencia de Usuario

**2.8.1 Paleta de Colores Unificada**

Los mockups HTML originales presentaban inconsistencias en los colores. Se ha definido la siguiente paleta unificada inspirada en los colores de la bandera mexicana 🇲🇽:

```javascript
colors: {
  // Verdes
  "primary": "#006847",        // Verde oscuro principal (bandera México)
  "primary-light": "#4CAF50",  // Verde Material para acentos/gráficas
  "primary-accent": "#103C10",  // Verde muy oscuro para fondos de íconos

  // Rojos
  "danger": "#CE1126",         // Rojo principal (bandera México)
  "danger-light": "#F44336",   // Rojo Material para acentos

  // Fondos dark mode
  "background-dark": "#121212", // Fondo principal
  "surface-dark": "#1E1E1E",   // Cards y superficies elevadas
  "card-dark": "#1E1E1E",      // Alias para cards

  // Textos
  "text-primary": "#FFFFFF",   // Texto principal
  "text-secondary": "#A0A0A0", // Texto secundario/hints
  "text-muted": "#9db89d",     // Texto deshabilitado

  // Bordes
  "border-dark": "#333333",    // Bordes y divisores
}
```

**2.8.2 Mockups de Referencia**

Los artefactos de diseño se encuentran en los archivos HTML proporcionados (solo como referencia visual, NO como implementación final):
- code_.html (Login)
- code_DASHBO.html (Dashboard Admin)
- code_admincapi.html (Gestión de Capítulos)
- code_registro.html (Nuevo Movimiento)
- code_Comprob.html (Subir Comprobante - Presidente)
- code_MULTA.html (Detalle de Movimiento)

**IMPORTANTE:** Los mockups HTML contienen inconsistencias que han sido corregidas en este PRD y en la arquitectura técnica.2.9 Plan de Lanzamiento y Go-To-Market 26Hitos Clave (Milestones):Fase 1 (Desarrollo): Construcción del MVP basado en este PRD.Fase 2 (Beta Cerrada): Pruebas internas con el Admin y 1-2 Presidentes de Capítulo voluntarios para validar el flujo completo.Fase 3 (Lanzamiento): Lanzamiento oficial a todos los Capítulos.Estrategia de Go-To-Market:El lanzamiento será 100% interno para el motoclub.Requerirá una sesión de capacitación obligatoria (virtual o presencial) para todos los Presidentes de Capítulo, dirigida por el Admin.Checklist de Lanzamiento:[ ] Plataforma desplegada y estable.[ ] Carga inicial de todos los Capítulos y Presidentes en la base de datos.[ ] Sesión de capacitación completada.[ ] Un documento simple (1-pager) de "Cómo Usar El Arca" enviado a todos los usuarios.2.10 Cuestiones Abiertas y Registro de Decisiones 27Cuestión Abierta 1: ¿Cómo se notificará al Admin que un pago está "En Revisión"?Opción 1 (MVP - Pasiva): El Admin debe entrar a la app y ver una insignia o filtro en su dashboard (requerido por F-4.6).Opción 2 (Futuro - Activa): ¿Configurar un trigger de Supabase para enviar un correo electrónico al Admin? (Fuera de alcance para MVP).Decisión (21/10/2025): Se implementará un flujo de auditoría de 3 pasos (Pendiente $\rightarrow$ En Revisión $\rightarrow$ Aprobado) para dar poder de validación explícito al Admin y asegurar la integridad de los datos financieros28