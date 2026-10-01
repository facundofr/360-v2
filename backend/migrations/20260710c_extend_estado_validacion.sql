-- =====================================================
-- MIGRACIÓN: Segundo paso del validador (apertura → confirmación) inline en cober360
-- Fecha: 2026-07-10
-- Motivo: el validador deja de depender de bot-wss-baileys; la máquina de estados
-- de 2 pasos corre dentro de cober360. Hace falta distinguir "esperando apertura"
-- de "esperando confirmación" dentro del mismo ENUM que ya usa prospectos.estado.
-- Ejecutar directamente en MySQL.
-- =====================================================

ALTER TABLE prospectos MODIFY COLUMN estado ENUM(
  'Lead','1º Contacto','Calificado Cotización','Calificado Póliza','Calificado Pago','Venta',
  'Fuera de zona','Fuera de edad','Preexistencia','Reafiliación','No contesta','prueba interna',
  'Ya es socio','Busca otra Cobertura','Teléfono erróneo','No le interesa (económico)',
  'No le interesa cartilla','Dato repetido',
  'Pendiente validación WhatsApp','Validación: esperando confirmación',
  'Corregir datos','No interesado','Lead (sin respuesta a validación)'
) NULL DEFAULT NULL;

-- Verificación:
-- SHOW COLUMNS FROM prospectos LIKE 'estado';
