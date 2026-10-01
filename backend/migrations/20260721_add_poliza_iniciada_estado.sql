-- ============================================================
-- Migración: Agregar estado "Póliza iniciada" a asignaciones.estado
-- Descripción: Agrega el estado "Póliza iniciada" que se activa
--              cuando el vendedor hace clic en el botón "Generar Póliza"
--              antes de que la póliza sea efectivamente generada.
-- Fecha: 2026-07-21
-- ============================================================

ALTER TABLE asignaciones
MODIFY COLUMN estado ENUM(
    'Lead',
    '1º Contacto',
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
