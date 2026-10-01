-- Migración para agregar jerarquía supervisor-vendedor y rol Back Office
-- Fecha: 2025-08-31

-- 1. Agregar columna supervisor_id a la tabla users para establecer jerarquía
ALTER TABLE `users` 
ADD COLUMN `supervisor_id` int(11) DEFAULT NULL COMMENT 'ID del supervisor que supervisa este vendedor',
ADD KEY `fk_supervisor` (`supervisor_id`),
ADD CONSTRAINT `fk_supervisor` FOREIGN KEY (`supervisor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

-- 2. Comentario para aclarar la nueva jerarquía de roles:
-- 1 = VENDEDOR (supervisado por supervisor_id)
-- 2 = SUPERVISOR (puede supervisar vendedores, supervisado por back office)
-- 3 = ADMIN (acceso total)
-- 4 = BACK_OFFICE (supervisa supervisores y sus equipos)

-- 3. Crear tabla para equipos de supervisores (opcional, para mejor organización)
CREATE TABLE `equipos_supervision` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL COMMENT 'Nombre del equipo',
  `supervisor_id` int(11) NOT NULL COMMENT 'ID del supervisor del equipo',
  `descripcion` text DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_supervisor_equipo` (`supervisor_id`),
  CONSTRAINT `fk_supervisor_equipo` FOREIGN KEY (`supervisor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Crear vista para facilitar consultas de jerarquía
CREATE VIEW `vista_jerarquia_usuarios` AS
SELECT 
    v.id as vendedor_id,
    v.first_name as vendedor_nombre,
    v.last_name as vendedor_apellido,
    v.email as vendedor_email,
    v.role as vendedor_role,
    v.categoria_id as vendedor_categoria,
    v.is_enabled as vendedor_activo,
    v.last_login as vendedor_ultimo_login,
    
    s.id as supervisor_id,
    s.first_name as supervisor_nombre,
    s.last_name as supervisor_apellido,
    s.email as supervisor_email,
    s.is_enabled as supervisor_activo,
    
    c.nombre as categoria_nombre
FROM users v
LEFT JOIN users s ON v.supervisor_id = s.id AND s.role = 2
LEFT JOIN categorias_config c ON v.categoria_id = c.id
WHERE v.role IN (1, 2); -- vendedores y supervisores

-- 5. Crear vista para estadísticas de Back Office
CREATE VIEW `vista_estadisticas_equipos` AS
SELECT 
    s.id as supervisor_id,
    s.first_name as supervisor_nombre,
    s.last_name as supervisor_apellido,
    COUNT(v.id) as total_vendedores,
    COUNT(CASE WHEN v.is_enabled = 1 THEN 1 END) as vendedores_activos,
    COUNT(CASE WHEN v.last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as vendedores_activos_semana,
    MAX(v.last_login) as ultimo_login_equipo
FROM users s
LEFT JOIN users v ON v.supervisor_id = s.id AND v.role = 1
WHERE s.role = 2
GROUP BY s.id, s.first_name, s.last_name;
