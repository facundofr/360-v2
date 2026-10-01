-- =====================================================
-- MIGRACIÓN: Consolidar conversaciones por prospecto
-- Fecha: 2025-09-05
-- Descripción: Asegurar que cada prospecto tenga una sola conversación activa
-- =====================================================

-- 1. Identificar y marcar conversaciones duplicadas para cada prospecto
-- Mantener solo la conversación más reciente por prospecto

CREATE TEMPORARY TABLE conversaciones_a_mantener AS
SELECT 
    prospecto_id,
    MAX(id) as conversacion_principal_id
FROM chat_conversaciones_whatsapp 
WHERE prospecto_id IS NOT NULL 
    AND estado IN ('activa', 'pausada')
GROUP BY prospecto_id
HAVING COUNT(*) > 1;

-- 2. Pausar conversaciones duplicadas (no las eliminamos para mantener historial)
UPDATE chat_conversaciones_whatsapp c
SET 
    estado = 'cerrada',
    updated_at = NOW()
WHERE c.prospecto_id IN (SELECT prospecto_id FROM conversaciones_a_mantener)
    AND c.id NOT IN (SELECT conversacion_principal_id FROM conversaciones_a_mantener)
    AND c.estado IN ('activa', 'pausada');

-- 3. Normalizar números de teléfono en conversaciones existentes
UPDATE chat_conversaciones_whatsapp 
SET telefono = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefono, ' ', ''), '(', ''), ')', ''), '-', ''), '+', '')
WHERE telefono REGEXP '[^0-9]';

-- 4. Crear índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_chat_prospecto_estado ON chat_conversaciones_whatsapp(prospecto_id, estado);
CREATE INDEX IF NOT EXISTS idx_chat_telefono_normalizado ON chat_conversaciones_whatsapp(telefono);

-- 5. Limpiar tabla temporal
DROP TEMPORARY TABLE conversaciones_a_mantener;

-- 6. Mostrar resumen de consolidación
SELECT 
    'Conversaciones por estado' as tipo,
    estado,
    COUNT(*) as cantidad
FROM chat_conversaciones_whatsapp 
GROUP BY estado
UNION ALL
SELECT 
    'Prospectos con conversación',
    CASE WHEN prospecto_id IS NOT NULL THEN 'Con prospecto' ELSE 'Sin prospecto' END,
    COUNT(*)
FROM chat_conversaciones_whatsapp 
WHERE estado IN ('activa', 'pausada')
GROUP BY CASE WHEN prospecto_id IS NOT NULL THEN 'Con prospecto' ELSE 'Sin prospecto' END;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
