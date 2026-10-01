-- Script para crear usuario Back Office
-- Ejecutar en la base de datos MySQL

-- Crear usuario Back Office de prueba
INSERT INTO users (
    first_name, 
    last_name, 
    email, 
    password, 
    role, 
    is_enabled, 
    verified,
    created_at,
    updated_at
) VALUES (
    'Back', 
    'Office', 
    'backoffice@cober.com', 
    '$2b$10$qQAkAHScreluRW7Nuot9eOq76CMWGt495wi3Z7SLKkGqOFLrZG.w6', 
    4, 
    1, 
    1,
    NOW(),
    NOW()
);

-- Verificar que se creó correctamente
SELECT id, first_name, last_name, email, role, is_enabled, verified 
FROM users 
WHERE role = 4;

-- También crear algunos supervisores de prueba si no existen
INSERT IGNORE INTO users (
    first_name, 
    last_name, 
    email, 
    password, 
    role, 
    is_enabled, 
    verified,
    created_at,
    updated_at
) VALUES 
('Supervisor', 'Uno', 'supervisor1@cober.com', '$2b$10$qQAkAHScreluRW7Nuot9eOq76CMWGt495wi3Z7SLKkGqOFLrZG.w6', 2, 1, 1, NOW(), NOW()),
('Supervisor', 'Dos', 'supervisor2@cober.com', '$2b$10$qQAkAHScreluRW7Nuot9eOq76CMWGt495wi3Z7SLKkGqOFLrZG.w6', 2, 1, 1, NOW(), NOW());

-- Verificar supervisores
SELECT id, first_name, last_name, email, role 
FROM users 
WHERE role = 2;
