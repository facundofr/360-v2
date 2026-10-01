-- Migración para implementar distribución 3-2-1 cíclica exacta
-- Agregar campo para tracking de posición en secuencia

-- Verificar si la columna ya existe antes de agregarla
ALTER TABLE `distribucion_round_robin` 
ADD COLUMN IF NOT EXISTS `posicion_en_secuencia` INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS `contador_ronda` INT DEFAULT 1;

-- Crear índices para mejor rendimiento
ALTER TABLE `distribucion_round_robin`
ADD INDEX IF NOT EXISTS `idx_posicion_secuencia` (`posicion_en_secuencia`),
ADD INDEX IF NOT EXISTS `idx_contador_ronda` (`contador_ronda`);

-- Actualizar documentación
-- Tabla distribucion_round_robin ahora contiene:
-- - categoria_id: ID de la categoría
-- - ultimo_vendedor_id: ID del último vendedor asignado (para round-robin)
-- - posicion_en_secuencia: Posición actual en la secuencia 3-2-1
-- - contador_ronda: Contador de rondas completadas
-- - fecha_ultima_asignacion: Timestamp del último cambio

-- La secuencia de distribución funciona así:
-- Para 1 Expert, 1 Senior, 1 Junior:
-- Secuencia: [Expert(1), Expert(1), Expert(1), Senior(2), Senior(2), Junior(3)]
-- Posición 0 → Asignar a Expert
-- Posición 1 → Asignar a Expert
-- Posición 2 → Asignar a Expert
-- Posición 3 → Asignar a Senior
-- Posición 4 → Asignar a Senior
-- Posición 5 → Asignar a Junior
-- Posición 0 → (vuelve al inicio, completó 1 ronda)
