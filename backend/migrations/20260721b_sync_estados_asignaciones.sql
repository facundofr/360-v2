-- ============================================================
-- Migración: Reconciliar ENUM de asignaciones.estado
-- Descripción: El ENUM había quedado sin 'WhatsApp enviado'
--              (sobreescrito por una migración posterior que no
--              lo incluía). Se restaura junto con 'Póliza iniciada'
--              (estado que se activa al abrir el formulario de
--              generar póliza, antes de que la póliza exista).
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
    'Póliza iniciada',
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
