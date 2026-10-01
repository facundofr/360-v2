-- =====================================================================================
-- Parte 2 de fk_polizas_cotizacion_set_null.sql
-- =====================================================================================
--
-- La parte 1 se aplicó y se cortó en medicals con:
--   ERROR 1452 ... Cannot add or update a child row: a foreign key constraint fails
--
-- Motivo: `cober360-medicals`.`polizas` tiene una fila huérfana — la póliza id 1
-- (COB-202605-0001, oficial "12345", creada 2026-05-21) apunta a cotizacion_id = 25,
-- que no existe en `cotizaciones`. Es un registro viejo de prueba, anterior a la FK
-- (o cargado con FOREIGN_KEY_CHECKS=0, como hace un restore de dump). Mientras exista
-- esa fila, la FK no puede recrearse.
--
-- ESTADO AL MOMENTO DE ESCRIBIR ESTE ARCHIVO:
--   cober360-produccion  -> FK ON DELETE SET NULL, cotizacion_id nullable   ✅ LISTA
--   cober360-bristol     -> FK ON DELETE SET NULL, cotizacion_id nullable   ✅ LISTA
--   cober360-medicals    -> SIN FK, cotizacion_id nullable, 1 huérfana      ⚠️ a completar
--   cober360-bariloche   -> FK ON DELETE CASCADE, cotizacion_id NOT NULL    ⚠️ sin aplicar
--
-- Este archivo solo toca medicals y bariloche. Es seguro re-ejecutarlo si algo falla:
-- los UPDATE afectan 0 filas cuando no hay huérfanas.
--
-- APLICAR CON:
--   mysql -u root -p < backend/migrations/fk_polizas_cotizacion_set_null_parte2.sql
-- =====================================================================================

-- ── cober360-medicals: limpiar la huérfana y recrear la FK ───────────────────────────
UPDATE `cober360-medicals`.`polizas` p
  LEFT JOIN `cober360-medicals`.`cotizaciones` c ON c.id = p.cotizacion_id
   SET p.cotizacion_id = NULL
 WHERE p.cotizacion_id IS NOT NULL AND c.id IS NULL;

ALTER TABLE `cober360-medicals`.`polizas`
  ADD CONSTRAINT `fk_polizas_cotizacion` FOREIGN KEY (`cotizacion_id`)
  REFERENCES `cober360-medicals`.`cotizaciones` (`id`) ON DELETE SET NULL;

-- ── cober360-bariloche ───────────────────────────────────────────────────────────────
ALTER TABLE `cober360-bariloche`.`polizas` DROP FOREIGN KEY `fk_polizas_cotizacion`;
ALTER TABLE `cober360-bariloche`.`polizas` MODIFY COLUMN `cotizacion_id` INT(11) NULL;

-- Red de seguridad: si apareciera alguna huérfana, dejarla en NULL antes de la FK
UPDATE `cober360-bariloche`.`polizas` p
  LEFT JOIN `cober360-bariloche`.`cotizaciones` c ON c.id = p.cotizacion_id
   SET p.cotizacion_id = NULL
 WHERE p.cotizacion_id IS NOT NULL AND c.id IS NULL;

ALTER TABLE `cober360-bariloche`.`polizas`
  ADD CONSTRAINT `fk_polizas_cotizacion` FOREIGN KEY (`cotizacion_id`)
  REFERENCES `cober360-bariloche`.`cotizaciones` (`id`) ON DELETE SET NULL;

-- ── Verificación: debe devolver SET NULL en las 4 bases ──────────────────────────────
SELECT CONSTRAINT_SCHEMA, CONSTRAINT_NAME, DELETE_RULE, UPDATE_RULE
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_NAME = 'fk_polizas_cotizacion'
 ORDER BY CONSTRAINT_SCHEMA;
