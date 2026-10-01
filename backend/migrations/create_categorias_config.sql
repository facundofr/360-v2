-- Crear tabla para configuración de categorías de vendedores
CREATE TABLE `categorias_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `capacidad_maxima` int(11) NOT NULL DEFAULT 50,
  `prioridad` int(11) NOT NULL DEFAULT 1,
  `activa` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insertar categorías por defecto
INSERT INTO `categorias_config` (`nombre`, `descripcion`, `capacidad_maxima`, `prioridad`) VALUES 
('Junior', 'Vendedores con poca experiencia', 30, 3),
('Senior', 'Vendedores con experiencia media', 50, 2),
('Expert', 'Vendedores expertos con alta capacidad', 80, 1);

-- Agregar campo categoria_id a la tabla users
ALTER TABLE `users` ADD COLUMN `categoria_id` int(11) DEFAULT NULL AFTER `role`;

-- Crear foreign key constraint
ALTER TABLE `users` ADD CONSTRAINT `fk_categoria_config` 
FOREIGN KEY (`categoria_id`) REFERENCES `categorias_config` (`id`) ON DELETE SET NULL;

-- Crear tabla para tracking del round-robin
CREATE TABLE `distribucion_round_robin` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `categoria_id` int(11) NOT NULL,
  `ultimo_vendedor_id` int(11) DEFAULT NULL,
  `fecha_ultima_asignacion` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `categoria_id` (`categoria_id`),
  KEY `fk_ultimo_vendedor` (`ultimo_vendedor_id`),
  CONSTRAINT `fk_categoria_distribucion` FOREIGN KEY (`categoria_id`) REFERENCES `categorias_config` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ultimo_vendedor` FOREIGN KEY (`ultimo_vendedor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insertar registros iniciales para el round-robin
INSERT INTO `distribucion_round_robin` (`categoria_id`) 
SELECT `id` FROM `categorias_config`;
