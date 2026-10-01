-- Migration: Remover capacidad_maxima (no se usa con distribución 3-2-1)
-- Fecha: 2025-11-10
-- Descripción: Remover la restricción de capacidad máxima ya que el sistema 3-2-1 cíclico no la requiere

-- Step 1: Remover índices que usen capacidad_maxima (si existen)
ALTER TABLE categorias_config DROP INDEX IF EXISTS idx_capacidad_maxima;

-- Step 2: Registrar que capacidad_maxima ya no se usa
-- Nota: La columna permanece en BD para compatibilidad histórica
-- pero no es usada por el sistema de distribución 3-2-1

-- Step 3: Confirmación
SELECT 'Migration completada: capacidad_maxima ya no se usa en distribución 3-2-1' as resultado;
