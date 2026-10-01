# Validador de WhatsApp compartido entre cober360-produccion y cober360-bariloche

> Propuesta de implementación — 2026-08-21. Responde a la decisión abierta marcada en
> `balanceador-leads-propuesta-tecnica.html` §11 ("¿Se homogenizan los dos CRM?"). Documento
> de análisis/planificación, todavía no implementado.

## Contexto

Hoy `cober360-produccion` tiene un circuito de validación de leads por WhatsApp (confirma
interés, después nivel de urgencia, recién ahí asigna vendedor; incluye seguimiento
automático post-asignación) que corre con un número y subcuenta de Twilio dedicados.
`cober360-bariloche` no tiene nada de esto — asigna vendedor apenas entra el lead.

El documento de propuesta técnica del balanceador (§11) dejó esto marcado como decisión
abierta sin resolver: *"¿Se homogenizan los dos CRM?"*. Este documento define esa decisión:
**sí, y con el mismo número de teléfono, el mismo webhook, "mismo todo"** — no duplicar el
circuito por unidad (lo que exigiría una subcuenta y número Twilio nuevos, con aprobación de
templates desde cero), sino centralizarlo en un único lugar que ambas unidades comparten.

El lugar natural es `lead-router` ("el compensador"): es el único componente que ya conoce a
las dos unidades, ya tiene acceso de solo lectura a sus bases (`config/crmDb.js`, usado hoy
por `validadorController.js` y `reconciliacionNocturna.js`), ya tiene infraestructura de
cron/workers (`jobs/index.js`, `services/outboxWorker.js`) y ya expone su panel admin de
forma transparente a ambas unidades vía el proxy existente (`compensadorController.js` en
cada unidad reenvía todo `/admin/api/compensador/*` tal cual a lead-router).

Restricción dura verificada: `crmDb.js` es explícitamente de **solo lectura** ("El router
nunca escribe en estas conexiones", comentario en el archivo). Esto descarta que lead-router
escriba directamente `prospectos`/`asignaciones` en la base de una unidad — la asignación de
vendedor y todo lo unit-local tiene que seguir viviendo en cada unidad, comunicado por
callback HTTP, no por escritura cruzada de DB.

Restricción dura verificada: lead-router **no está en producción todavía** (`docs/DEPLOY.md`:
"Nada de esto corrió en producción todavía"), y **ningún frontend que eventualmente le va a
pegar tiene lógica de polling** — todos hacen `POST /lead` seguido inmediato de
`GET /lead/:id/cotizaciones`, sin chequear `estado`. Por eso el diseño NO puede hacer que
`POST /lead` (ni el webhook síncrono unidad←compensador) espere a que WhatsApp resuelva
(puede tardar hasta 1 hora) — eso rompería tanto el contrato del frontend como el
`webhook_timeout_ms` de `despachoService`, y degradaría falsamente la salud de unidades sanas
(`UMBRAL_FALLOS_PARA_DEGRADAR = 3` en `unidadModel.js`).

## Arquitectura

```
Unidad (produccion o bariloche)
  createLead() ya insertó el prospecto localmente
    → POST 127.0.0.1:4007/leads-compensador/validador/leads   (timeout 1.5s, header X-Validador-Key)
    → 202 {aceptado:true}  → NO autoasignarVendedor todavía, estado local = "Pendiente validación WhatsApp"
    → 200 {aceptado:false} / timeout / error → autoasignarVendedor YA, como hoy (fallback seguro)

lead-router (compensador)
  recibe la solicitud → cupo diario por unidad → envía template de apertura por Twilio
  (subcuenta+número dedicados, movidos acá desde produccion)
  webhook de Twilio → acá, no en las unidades → corre la máquina de estados
  (interés → urgencia) → al resolver (o timeout de 1h vía cron) dispara:
    → POST {unidad}/webhooks/validador-callback  (con reintentos tipo outbox)

Unidad
  validadorCallbackController: autoasignarVendedor + UPDATE prospectos + notificación + sheets
  (exactamente lo que hoy hace la segunda mitad de finalizarValidacion())
```

Nutrición (seguimiento post-asignación) se centraliza también en lead-router, por una razón
técnica concreta y no solo por "mismo todo": los mensajes de nutrición salen del mismo número
Twilio del validador — si las credenciales de ese número solo existen en lead-router, ninguna
unidad puede mandarlos por su cuenta. El único dato unit-local que nutrición necesita leer
("¿ya escribió el vendedor?") se resuelve con una lectura vía `crmDb.js`, igual que ya hace
`reconciliacionNocturna`.

## Cambios concretos

### 1. lead-router (nuevo, todo aditivo)

- **`backend/migrations/003_validador_whatsapp.sql`** (idempotente, respeta que
  `migrate.js` re-ejecuta todo el directorio siempre):
  - Columnas nuevas en `unidades`: `validador_activo`, `validador_cupo_diario`,
    `validador_callback_url`, `validador_key_enc` — con guard vía
    `information_schema.COLUMNS` antes de cada `ALTER` (no hay `ADD COLUMN IF NOT EXISTS`
    confiable en la versión de MySQL/MariaDB en uso).
  - Tablas nuevas: `validaciones` (unidad_id, prospecto_id_remoto, telefono, estado,
    enviada_en/resuelta_en, callback_enviado — unique en `(unidad_id, prospecto_id_remoto)`),
    `validador_cupo_contador` (unidad_id, fecha, contador), `validador_conversaciones` /
    `validador_mensajes` (transcript, igual función que `chat_conversaciones_whatsapp` /
    `chat_mensajes` pero propio de lead-router), `validador_nutricion`,
    `validador_callbacks_outbox`.
- **`backend/services/validador/validadorService.js`**: puerto de
  `validacionWhatsappService.js` de produccion (getConfig/cupo/enviarTemplateApertura/
  enviarTemplateConfirmacion/normalizadores/máquina de 2 pasos), adaptado a leer/escribir en
  las tablas nuevas de lead-router en vez de `prospectos` local.
- **`backend/services/validador/nutricionService.js`**: puerto de
  `nutricionLeadsService.js`, con el chequeo "vendedor ya escribió" resuelto vía
  `withCrmConnection` (mismo patrón que `reconciliacionNocturna.js`).
- **`backend/jobs/validadorFallbackJob.js`** y **`backend/jobs/nutricionJob.js`**: puertos de
  `ValidacionFallbackJob.js` / `NutricionLeadsJob.js`, registrados en `jobs/index.js` con
  `cron.schedule(...)` y el mismo wrapper `.catch(console.error)` que ya usan
  `outboxWorker`/`reconciliacionNocturna`.
- **`backend/services/validadorCallbackWorker.js`**: entrega de callbacks a las unidades con
  reintentos, calcado 1:1 de `services/outboxWorker.js` (mismo backoff, mismo cuidado de no
  duplicar filas en cada corrida — ver el comentario ya existente en `despachoService.js`
  sobre el bug de 270 filas).
- **`backend/controllers/validadorController.js`**: `POST /leads-compensador/validador/leads`
  (encolar solicitud) y `POST /leads-compensador/validador/webhook` (Twilio inbound —
  reemplaza al de produccion para este número).
- **`backend/routes/admin/validadorRoutes.js`**: config/métricas, agregado como una línea
  nueva en `routes/admin/index.js` (los endpoints ahí son explícitos, no wildcard — a
  diferencia del lado unidad, que sí reenvía todo por wildcard vía
  `compensadorController.proxy`, así que del lado unidad no hace falta tocar nada).
- `.env` de lead-router recibe las credenciales Twilio del validador (movidas, no
  duplicadas, desde produccion — ver Fase 1).

### 2. Cada unidad (produccion y bariloche)

- **`controllers/formLead/formController.js`**: el bloque de cupo/template en `createLead`
  (líneas ~97-128 en produccion) se reemplaza por una llamada corta con timeout al enqueue de
  lead-router; en bariloche este bloque es net-new (hoy no existe nada ahí). Mismo
  try/catch-y-seguir-de-largo que ya existe hoy en produccion.
- **`controllers/validadorCallbackController.js`** (nuevo, ~80 líneas, extracción directa de
  la segunda mitad de `finalizarValidacion()`): recibe el resultado, llama
  `FormLead.autoasignarVendedor`, actualiza `prospectos`, reasigna la conversación, notifica,
  sincroniza sheets.
- Ruta nueva en `webhookRoutes.js`: `POST /webhooks/validador-callback`.
- **Bariloche necesita su propia migración local** (adaptada 1:1 de
  `20260710_validador_whatsapp.sql` de produccion): columnas `validado` /
  `validacion_enviada_at` / `validacion_resuelta_at` en `prospectos`, ENUM de `estado`
  ampliado con los mismos 6 valores nuevos, `chat_conversaciones_whatsapp.tipo_origen`
  ampliado con `'validacion'`, usuario de sistema `bot-validador@cober.internal`. Esto no es
  opcional aunque la mecánica de Twilio esté centralizada: la unidad sigue necesitando marcar
  localmente en qué estado está cada prospecto propio.

### 3. Limpieza en produccion (recién en la Fase 1, no antes)

Se borran (quedan superados por lead-router): `services/validacionWhatsappService.js`,
`services/nutricionLeadsService.js`, `jobs/ValidacionFallbackJob.js`,
`jobs/NutricionLeadsJob.js`, `controllers/admin/validacionWhatsappConfigController.js` +
`routes/admin/validacionWhatsappRoutes.js`, y el bloque de corte-circuito de validación
dentro de `controllers/whatsappWebhookController.js`. En `services/whatsappService.js` se
elimina el mecanismo de subcuenta (`_clientPara`, `TWILIO_SUBACCOUNT_SID_VALIDADOR`) ya que
ese número deja de enviarse desde acá.

Se mantiene sin tocar: `FormLead.autoasignarVendedor`, `notificationsService.js`,
`googleSheetsService.js` (ahora llamados desde el nuevo callback controller en vez de desde
`finalizarValidacion`). Las tablas locales `validacion_whatsapp_config` /
`validacion_piloto_contador` quedan huérfanas pero inofensivas — no hace falta un DROP
inmediato.

## Fases de rollout

**Fase 0 — todo aditivo, riesgo cero** (lead-router no tiene tráfico real): construir todo lo
de lead-router de la sección 1, con `unidades.validador_activo = 0` en ambas filas. Nada toca
tráfico en vivo.

**Fase 1 — corte de produccion (única fase que toca Twilio en vivo):**
1. Mover (no reprovisionar) las credenciales de la subcuenta/número/templates ya aprobados de
   produccion al `.env` de lead-router — así se conserva "el mismo número" sin re-pasar por
   aprobación de templates de Meta.
2. Ventana de mantenimiento: repuntar en la consola de Twilio el webhook de ese número, de
   produccion hacia `lead-router`. Dejar el código viejo de produccion intacto durante esta
   ventana como rollback instantáneo (repuntar el webhook de vuelta si algo falla).
3. Activar `validador_activo=1` solo para la unidad `produccion`.
4. Deploy del cambio chico en `formController.js` de produccion.
5. Observar métricas unos días vía el panel admin ya existente.
6. PR de limpieza: borrar lo listado en la sección 3.

**Fase 2 — alta de bariloche (puramente aditivo, sin tocar Twilio de nuevo):**
1. Migración local de bariloche.
2. `formController.js` (bloque nuevo) + `validadorCallbackController.js` + ruta, calcados de
   produccion.
3. `UPDATE unidades SET validador_activo=1, validador_cupo_diario=<valor> WHERE
   slug='bariloche'`.

No se toca ningún frontend en ninguna fase — el contrato síncrono actual de `POST /lead` no
cambia; la espera de WhatsApp queda resuelta puertas adentro, entre lead-router y cada
unidad, nunca expuesta al navegador.

## Preguntas abiertas — decisión del usuario, no técnica

1. **Cupo diario por unidad**: el mecanismo es por-unidad (`unidades.validador_cupo_diario`,
   dado que la capacidad comercial de cada una difiere), pero los valores concretos (mantener
   el piloto actual de producción, definir el de bariloche) son una decisión de negocio.
2. **Números internacionales de bariloche** (leads de Meta Ads con código de país no
   argentino): la lógica de validación de producción asume números de Argentina. Falta
   definir si estos leads entran al circuito de WhatsApp o van directo a asignación como hoy
   — puede haber una cuestión de política de WhatsApp Business de por medio, no es solo
   código.
3. **Nutrición compartida**: la decisión técnica (centralizarla, forzada por el número
   compartido) tiene sentido, pero si se prefiere que la nutrición quede unit-local igual,
   hay que resolver de dónde sale ese envío sin acceso al número del validador.
4. **Reutilizar la subcuenta Twilio existente vs. una nueva**: se asume reutilizar para no
   volver a pasar por aprobación de templates — confirmar que no hay una razón de
   facturación/titularidad que obligue a una subcuenta nueva.

## Verificación (cuando se implemente)

- Migraciones: correr `npm run migrate` en lead-router y en bariloche contra una base de
  staging, dos veces seguidas (confirma idempotencia, que es el modo de operación real acá).
- Circuito completo en staging: lead de prueba → confirmar que llega el WhatsApp de apertura
  desde el número compartido → responder por los dos pasos → confirmar que el callback llega
  a la unidad correcta y asigna vendedor.
- Probar el camino de fallback: cortar lead-router (o bajarle el timeout) y confirmar que la
  unidad asigna igual, sin quedar colgada — es el mismo comportamiento que produccion ya
  tiene hoy ante errores.
- Confirmar que un lead normal (sin validación, `validador_activo=0` o cupo agotado) sigue
  respondiendo 2xx rápido en `despachoService` — que no se degrade la salud de la unidad por
  este cambio.
