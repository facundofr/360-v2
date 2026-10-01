-- ============================================
-- MIGRACIÓN: Sistema de cola para Refritos
-- Fecha: 2026-01-30
-- Descripción: Solo 1 refrito visible a la vez por vendedor
-- ============================================

-- 1. Agregar columna visible_refrito si no existe
ALTER TABLE asignaciones 
ADD COLUMN IF NOT EXISTS visible_refrito TINYINT(1) DEFAULT 0 NOT NULL
COMMENT 'Indica si el refrito está visible (1) o en cola (0) para el vendedor';

-- 2. Verificar que la columna existe
SELECT COUNT(*) as 'Tiene visible_refrito' FROM information_schema.columns 
WHERE table_schema='cober360' AND table_name='asignaciones' AND column_name='visible_refrito';

-- 3. Crear índice para optimizar consultas (si no existe)
CREATE INDEX IF NOT EXISTS idx_asig_visible_refrito ON asignaciones(id_vendedor, visible_refrito);

-- 4. Resetear todos a 0 primero
UPDATE asignaciones SET visible_refrito = 0;

-- 5. Backfill: Marcar como visible el refrito más antiguo en estado Lead por vendedor
UPDATE asignaciones a
INNER JOIN prospectos p ON p.id = a.id_prospecto
SET a.visible_refrito = 1
WHERE p.es_reciclado = 1 
  AND a.estado = 'Lead'
  AND a.id = (
    SELECT MIN(a2.id)
    FROM (SELECT * FROM asignaciones) a2
    INNER JOIN prospectos p2 ON p2.id = a2.id_prospecto
    WHERE a2.id_vendedor = a.id_vendedor
      AND p2.es_reciclado = 1
      AND a2.estado = 'Lead'
  );

-- 6. Verificar resultados
SELECT 
    a.id_vendedor,
    COUNT(*) as total_refritos,
    SUM(CASE WHEN a.visible_refrito = 1 THEN 1 ELSE 0 END) as visibles,
    SUM(CASE WHEN a.visible_refrito = 0 THEN 1 ELSE 0 END) as en_cola
FROM asignaciones a
INNER JOIN prospectos p ON p.id = a.id_prospecto
WHERE p.es_reciclado = 1 AND a.estado = 'Lead'
GROUP BY a.id_vendedor;

SELECT 'Migración completada exitosamente' as resultado;
