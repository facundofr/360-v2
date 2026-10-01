-- =====================================================
-- MIGRACIÓN: Ampliar ENUM prospectos.estado para el validador de WhatsApp
-- Fecha: 2026-07-10
-- Motivo: UPDATE prospectos SET estado = 'Pendiente validación WhatsApp' (y demás
-- valores nuevos del circuito de validación) fallaba con "Data truncated for
-- column 'estado'" porque el campo es un ENUM cerrado, no texto libre.
-- Ejecutar directamente en MySQL.
-- =====================================================

ALTER TABLE prospectos MODIFY COLUMN estado ENUM(
  'Lead','1º Contacto','Calificado Cotización','Calificado Póliza','Calificado Pago','Venta',
  'Fuera de zona','Fuera de edad','Preexistencia','Reafiliación','No contesta','prueba interna',
  'Ya es socio','Busca otra Cobertura','Teléfono erróneo','No le interesa (económico)',
  'No le interesa cartilla','Dato repetido',
  'Pendiente validación WhatsApp','Corregir datos','No interesado','Lead (sin respuesta a validación)'
) NULL DEFAULT NULL;

-- Verificación:
-- SHOW COLUMNS FROM prospectos LIKE 'estado';
