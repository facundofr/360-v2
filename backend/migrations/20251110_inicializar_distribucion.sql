-- Inicializar tabla distribucion_round_robin con las categorías activas
-- Esta tabla mantiene el estado de la distribución 3-2-1 cíclica

DELETE FROM distribucion_round_robin;

INSERT INTO distribucion_round_robin (categoria_id, ultimo_vendedor_id, contador_ronda, posicion_en_secuencia, fecha_ultima_asignacion)
SELECT id, NULL, 1, 0, NOW()
FROM categorias_config
WHERE activa = 1
ORDER BY prioridad ASC;

SELECT 'Inicialización completada' as resultado;
SELECT * FROM distribucion_round_robin;
