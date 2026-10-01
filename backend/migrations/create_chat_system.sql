-- Crear sistema de chat interno
-- Este script crea las tablas necesarias para el sistema de chat

-- 1. Tabla de conversaciones
CREATE TABLE IF NOT EXISTS chat_conversaciones_whatsapp (
    id INT PRIMARY KEY AUTO_INCREMENT,
    numero_conversacion VARCHAR(50) UNIQUE NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    prospecto_id INT NULL,
    poliza_id INT NULL,
    vendedor_id INT NOT NULL,
    estado ENUM('activa', 'pausada', 'cerrada') DEFAULT 'activa',
    tipo_origen ENUM('cotizacion', 'poliza', 'manual') NOT NULL,
    twilio_conversation_sid VARCHAR(100) NULL,
    ultima_actividad TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_telefono (telefono),
    INDEX idx_vendedor (vendedor_id),
    INDEX idx_estado (estado),
    INDEX idx_prospecto (prospecto_id),
    INDEX idx_poliza (poliza_id),
    
    FOREIGN KEY (vendedor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (prospecto_id) REFERENCES prospectos(id) ON DELETE SET NULL,
    FOREIGN KEY (poliza_id) REFERENCES polizas(id) ON DELETE SET NULL
);

-- 2. Tabla de mensajes del chat
CREATE TABLE IF NOT EXISTS chat_mensajes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversacion_id INT NOT NULL,
    mensaje TEXT NOT NULL,
    tipo ENUM('enviado', 'recibido', 'sistema') NOT NULL,
    origen ENUM('vendedor', 'cliente', 'sistema', 'whatsapp') NOT NULL,
    twilio_message_sid VARCHAR(100) NULL,
    estado_entrega ENUM('pendiente', 'enviado', 'entregado', 'leido', 'fallido') DEFAULT 'pendiente',
    metadata JSON NULL, -- Para datos adicionales como adjuntos, templates, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_conversacion (conversacion_id),
    INDEX idx_tipo (tipo),
    INDEX idx_created_at (created_at),
    INDEX idx_twilio_sid (twilio_message_sid),
    
    FOREIGN KEY (conversacion_id) REFERENCES chat_conversaciones_whatsapp(id) ON DELETE CASCADE
);

-- 3. Tabla de plantillas de mensajes rápidos
CREATE TABLE IF NOT EXISTS chat_plantillas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    contenido TEXT NOT NULL,
    categoria ENUM('saludo', 'seguimiento', 'cierre', 'informacion', 'personalizado') DEFAULT 'personalizado',
    vendedor_id INT NULL, -- NULL = plantilla global
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_categoria (categoria),
    INDEX idx_vendedor (vendedor_id),
    
    FOREIGN KEY (vendedor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Tabla de estados de conversación
CREATE TABLE IF NOT EXISTS chat_estados (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversacion_id INT NOT NULL,
    estado_anterior ENUM('activa', 'pausada', 'cerrada'),
    estado_nuevo ENUM('activa', 'pausada', 'cerrada'),
    motivo VARCHAR(255) NULL,
    changed_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_conversacion (conversacion_id),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (conversacion_id) REFERENCES chat_conversaciones_whatsapp(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Insertar plantillas predeterminadas
INSERT INTO chat_plantillas (nombre, contenido, categoria, vendedor_id) VALUES
('Saludo inicial', '¡Hola! Soy {{vendedor}} de COBER. ¿Cómo estás? ¿Tienes alguna consulta sobre tu cotización/póliza?', 'saludo', NULL),
('Seguimiento cotización', 'Hola {{cliente}}, ¿has podido revisar la cotización que te envié? ¿Tienes alguna consulta?', 'seguimiento', NULL),
('Seguimiento póliza', 'Hola {{cliente}}, ¿recibiste correctamente tu póliza? ¿Necesitas ayuda con algo?', 'seguimiento', NULL),
('Información adicional', 'Si necesitas más información sobre tu plan de salud, no dudes en consultarme. Estoy aquí para ayudarte.', 'informacion', NULL),
('Cierre conversación', 'Perfecto, cualquier otra consulta no dudes en escribirme. ¡Que tengas un excelente día!', 'cierre', NULL);

-- 6. Función para generar número de conversación único
DELIMITER //

CREATE FUNCTION IF NOT EXISTS generar_numero_conversacion() 
RETURNS VARCHAR(50)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE nuevo_numero VARCHAR(50);
    DECLARE contador INT DEFAULT 1;
    DECLARE existe INT DEFAULT 1;
    
    WHILE existe > 0 DO
        SET nuevo_numero = CONCAT('CONV-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', LPAD(contador, 4, '0'));
        SELECT COUNT(*) INTO existe FROM chat_conversaciones_whatsapp WHERE numero_conversacion = nuevo_numero;
        SET contador = contador + 1;
    END WHILE;
    
    RETURN nuevo_numero;
END //

DELIMITER ;

-- 7. Trigger para actualizar ultima_actividad
DELIMITER //

CREATE TRIGGER IF NOT EXISTS actualizar_actividad_conversacion 
AFTER INSERT ON chat_mensajes
FOR EACH ROW
BEGIN
    UPDATE chat_conversaciones_whatsapp 
    SET ultima_actividad = NOW() 
    WHERE id = NEW.conversacion_id;
END //

DELIMITER ;

-- 8. Vista para listado de conversaciones con información completa
CREATE VIEW IF NOT EXISTS vista_conversaciones_completas AS
SELECT 
    c.id,
    c.numero_conversacion,
    c.telefono,
    c.estado,
    c.tipo_origen,
    c.ultima_actividad,
    c.created_at,
    
    -- Datos del vendedor
    u.first_name as vendedor_nombre,
    u.last_name as vendedor_apellido,
    
    -- Datos del prospecto (si existe)
    p.nombre as prospecto_nombre,
    p.apellido as prospecto_apellido,
    p.correo as prospecto_email,
    
    -- Datos de la póliza (si existe)
    pol.numero_poliza,
    pl.nombre as plan_nombre,
    
    -- Último mensaje
    (
        SELECT cm.mensaje 
        FROM chat_mensajes cm 
        WHERE cm.conversacion_id = c.id 
        ORDER BY cm.created_at DESC 
        LIMIT 1
    ) as ultimo_mensaje,
    
    -- Contador de mensajes no leídos (del cliente)
    (
        SELECT COUNT(*) 
        FROM chat_mensajes cm 
        WHERE cm.conversacion_id = c.id 
        AND cm.origen = 'cliente' 
        AND cm.estado_entrega != 'leido'
    ) as mensajes_no_leidos

FROM chat_conversaciones_whatsapp c
LEFT JOIN users u ON c.vendedor_id = u.id
LEFT JOIN prospectos p ON c.prospecto_id = p.id
LEFT JOIN polizas pol ON c.poliza_id = pol.id
LEFT JOIN cotizaciones cot ON pol.cotizacion_id = cot.id
LEFT JOIN planes pl ON cot.plan_id = pl.id;

COMMIT;
