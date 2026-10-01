-- ============================================================
-- Migración: Nuevo estado 'WhatsApp enviado' en `asignaciones.estado`
-- Descripción: Se separa el envío del primer contacto por WhatsApp
--              (acción automática del botón) del estado '1º Contacto',
--              para poder distinguirlo de una respuesta real del
--              cliente ('Conversación iniciada por WhatsApp').
-- Fecha: 2026-07-21
-- ============================================================

ALTER TABLE asignaciones
MODIFY COLUMN estado ENUM(
    'Lead',
    '1º Contacto',
    'WhatsApp enviado',
    'Llamada telefónica',
    'Conversación iniciada por WhatsApp',
    'Promoción aplicada',
    'Calificado Cotización',
    'Calificado Póliza',
    'Calificado Pago',
    'Póliza generada',
    'Póliza enviada a supervisor',
    'Póliza pendiente a firma',
    'Póliza firmada',
    'Venta',
    'No Interesado',
    'Fuera de zona',
    'Fuera de edad',
    'Preexistencia',
    'Reafiliación',
    'No contesta',
    'prueba interna',
    'Ya es socio',
    'Busca otra Cobertura',
    'Teléfono erróneo',
    'No le interesa (económico)',
    'No le interesa cartilla',
    'No busca cobertura médica',
    'Dato repetido'
) DEFAULT 'Lead';
