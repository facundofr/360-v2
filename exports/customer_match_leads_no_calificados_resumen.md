# Resumen — Customer Match leads "no calificados" (Cober360-producción)

Generado: 2026-09-21T15:24:20.804Z

**Nota: a pedido explícito del usuario, el set de "no calificado" fue acotado a solo 3 estados** (Fuera de zona, No busca cobertura médica, No interesado). Se removieron del set original: Fuera de edad, Preexistencia, Teléfono erróneo, No le interesa (económico), No le interesa cartilla.

## Totales

- Prospectos evaluados como candidatos (estado consolidado en set no_calificado acotado, antes de exclusiones): **3576**
- Total incluido en el CSV final: **3085**
- Duplicados consolidados: **12**
- Casos con apellidos incompatibles compartiendo teléfono/email (revisión manual): **0**

### Exclusión / revisión por motivo

- interaccion_whatsapp_posterior_a_descarte: 479

### Composición de contacto (sobre los 3085 incluidos)

- Solo teléfono: 177
- Solo email: 5
- Ambos: 2903

### Validación de datos crudos (antes de dedup, sobre los 3576 candidatos)

- Emails presentes pero inválidos/placeholder: 0
- Teléfonos presentes pero inválidos: 6

## Estados incluidos (set acotado por pedido explícito del usuario)

| Estado (consolidado) | Cantidad candidata |
|---|---|
| No busca cobertura médica | 2133 |
| Fuera de zona | 1219 |
| No interesado | 224 |

Estados EXCLUIDOS del set (por pedido explícito del usuario en esta iteración): Fuera de edad, Preexistencia, Teléfono erróneo, No le interesa (económico), No le interesa cartilla.
Estados excluidos por decisión previa (ver iteración anterior): No contesta, Ya es socio, Busca otra Cobertura, Dato repetido, prueba interna, Reafiliación, y todos los estados de funnel activo/venta.

## Consultas y reglas utilizadas

- Estado consolidado: `asignaciones` (MAX fecha_estado por id_prospecto) con fallback a `prospectos.estado`.
- Exclusión adicional: `gecros_estado = 'Con Cobertura'`, `edad < 18`.
- Contradicción por WhatsApp: mensaje `chat_mensajes.origen='cliente'` posterior a la fecha de referencia del descarte → PENDIENTE_REVISION.
- Teléfono: E.164 Argentina, sin agregar el 9 salvo marca explícita (validado contra `backend/utils/telefonoProspecto.js` / `formModel.js`).
- Email: replica `validator.normalizeEmail` (gmail/googlemail sin puntos, sin subaddress), más blocklist de placeholders.
- Deduplicación: sufijo de teléfono de 10 dígitos → email normalizado → id de prospecto.

## Advertencias de cumplimiento

- No existe ningún campo de consentimiento, opt-out o "no contactar" funcional en el esquema (`whatsapp_opt_in` vale 0 en el 100% de los registros).
- No hay código postal almacenado — columna Zip vacía en todo el archivo.
- Edad usada para excluir menores es un entero capturado al alta, puede estar desactualizado.
- **Cober comercializa cobertura médica (categoría sensible). Validar contra políticas de Google Ads para salud/seguros antes de crear cualquier audiencia — este archivo no fue subido ni configurado como audiencia.**
