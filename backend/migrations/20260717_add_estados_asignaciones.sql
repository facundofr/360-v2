-- ============================================================
-- Migración: Nuevos estados de seguimiento en `asignaciones.estado`
-- Descripción: La columna `estado` es un ENUM y rechazaba en
--              silencio los estados nuevos agregados en el código
--              (llamada telefónica, whatsapp, promoción, flujo de
--              póliza/firma). Se agregan esos valores al ENUM sin
--              quitar ninguno de los existentes.
-- Fecha: 2026-07-17
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
