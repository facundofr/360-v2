-- =====================================================
-- MIGRACIÓN: Estados de urgencia post-confirmación del validador de WhatsApp
-- Fecha: 2026-07-24
-- Motivo: el template de confirmación (HX65e0778e58b6a5de91da10011b47291b) cambió
-- sus botones de "correctos/incorrectos" a "Lo antes posible/Solo estoy
-- averiguando" (urgencia de compra, no corrección de datos). Ambas respuestas
-- ahora asignan vendedor, pero con un estado final distinto. prospectos.estado
-- es un ENUM cerrado (ver 20260710b) — hay que ampliarlo antes del UPDATE.
-- Ejecutar directamente en MySQL.
-- =====================================================

ALTER TABLE prospectos MODIFY COLUMN estado ENUM(
  'Lead','1º Contacto','Calificado Cotización','Calificado Póliza','Calificado Pago','Venta',
  'Fuera de zona','Fuera de edad','Preexistencia','Reafiliación','No contesta','prueba interna',
  'Ya es socio','Busca otra Cobertura','Teléfono erróneo','No le interesa (económico)',
  'No le interesa cartilla','Dato repetido',
  'Pendiente validación WhatsApp','Validación: esperando confirmación','Corregir datos','No interesado',
  'Lead (sin respuesta a validación)',
  'Lead (validado - interesado)','Lead (validado - averiguando)'
) NULL DEFAULT NULL;

-- Verificación:
-- SHOW COLUMNS FROM prospectos LIKE 'estado';
