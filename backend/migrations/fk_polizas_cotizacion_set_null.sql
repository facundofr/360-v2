-- =====================================================================================
-- polizas.cotizacion_id: pasar la FK de ON DELETE CASCADE a ON DELETE SET NULL
-- =====================================================================================
--
-- PROBLEMA
-- `cotizarLead()` (backend/models/formLead/formModel.js:511-514) borra todas las
-- cotizaciones del prospecto al recotizar:
--     DELETE FROM cotizaciones WHERE prospecto_id = ?
-- Como `polizas.cotizacion_id` tenía ON DELETE CASCADE, esa recotización borraba
-- FÍSICAMENTE las pólizas del prospecto y, en cascada, sus poliza_documentos,
-- poliza_estados_historial, poliza_hashes, poliza_envios y polizas_vafirma_envios.
-- Los archivos de los documentos quedaban huérfanos en backend/uploads/polizas/documentos.
--
-- Caso testigo (2026-09-10): back office eliminó la póliza 51935 / COB-202609-0057
-- (id 1161) a las 14:30 con soft delete y motivo "aportes erroneos". A las 15:20 el
-- vendedor recotizó el prospecto 33430 y la fila desapareció de la tabla junto con
-- sus 14 documentos. Al cruzar historial_acciones contra polizas: 23 de 347 pólizas
-- generadas ya no existen por este mismo mecanismo.
--
-- SOLUCIÓN
-- Con ON DELETE SET NULL el flujo de trabajo no cambia (back office elimina, el
-- vendedor recotiza), pero la póliza eliminada sobrevive con su deleted_at,
-- deleted_by, motivo_eliminacion, sus documentos y su historial.
-- Requiere que cotizacion_id acepte NULL (hoy es NOT NULL).
--
-- IMPACTO EN CONSULTAS
-- Los listados de pólizas usan LEFT JOIN cotizaciones, así que una póliza con
-- cotizacion_id NULL sigue apareciendo. Los únicos INNER JOIN sobre cotizaciones son
-- planes->cotizaciones (c.plan_id), no tocan polizas.cotizacion_id.
--
-- NOTA SOBRE ON UPDATE
-- La FK se recrea sin cláusula ON UPDATE (queda en RESTRICT, el default). En la
-- práctica es indistinto: cotizaciones.id es un AUTO_INCREMENT que nunca se modifica.
-- Para ver la regla previa antes de aplicar:
--   SELECT CONSTRAINT_SCHEMA, DELETE_RULE, UPDATE_RULE
--     FROM information_schema.REFERENTIAL_CONSTRAINTS
--    WHERE CONSTRAINT_NAME = 'fk_polizas_cotizacion';
--
-- APLICAR CON:
--   mysql -u root -p < backend/migrations/fk_polizas_cotizacion_set_null.sql
--
-- ESTADO: aplicado el 2026-09-10. Cortó en medicals con ERROR 1452 por una fila
-- huérfana; produccion y bristol quedaron listas. Lo que faltaba (medicals y
-- bariloche) está en fk_polizas_cotizacion_set_null_parte2.sql.
-- =====================================================================================

-- ── cober360-produccion ──────────────────────────────────────────────────────────────
ALTER TABLE `cober360-produccion`.`polizas` DROP FOREIGN KEY `fk_polizas_cotizacion`;
ALTER TABLE `cober360-produccion`.`polizas` MODIFY COLUMN `cotizacion_id` INT(11) NULL;
ALTER TABLE `cober360-produccion`.`polizas`
  ADD CONSTRAINT `fk_polizas_cotizacion` FOREIGN KEY (`cotizacion_id`)
  REFERENCES `cober360-produccion`.`cotizaciones` (`id`) ON DELETE SET NULL;

-- ── cober360-bristol ─────────────────────────────────────────────────────────────────
ALTER TABLE `cober360-bristol`.`polizas` DROP FOREIGN KEY `fk_polizas_cotizacion`;
ALTER TABLE `cober360-bristol`.`polizas` MODIFY COLUMN `cotizacion_id` INT(11) NULL;
ALTER TABLE `cober360-bristol`.`polizas`
  ADD CONSTRAINT `fk_polizas_cotizacion` FOREIGN KEY (`cotizacion_id`)
  REFERENCES `cober360-bristol`.`cotizaciones` (`id`) ON DELETE SET NULL;

-- ── cober360-medicals ────────────────────────────────────────────────────────────────
ALTER TABLE `cober360-medicals`.`polizas` DROP FOREIGN KEY `fk_polizas_cotizacion`;
ALTER TABLE `cober360-medicals`.`polizas` MODIFY COLUMN `cotizacion_id` INT(11) NULL;
ALTER TABLE `cober360-medicals`.`polizas`
  ADD CONSTRAINT `fk_polizas_cotizacion` FOREIGN KEY (`cotizacion_id`)
  REFERENCES `cober360-medicals`.`cotizaciones` (`id`) ON DELETE SET NULL;

-- ── cober360-bariloche ───────────────────────────────────────────────────────────────
ALTER TABLE `cober360-bariloche`.`polizas` DROP FOREIGN KEY `fk_polizas_cotizacion`;
ALTER TABLE `cober360-bariloche`.`polizas` MODIFY COLUMN `cotizacion_id` INT(11) NULL;
ALTER TABLE `cober360-bariloche`.`polizas`
  ADD CONSTRAINT `fk_polizas_cotizacion` FOREIGN KEY (`cotizacion_id`)
  REFERENCES `cober360-bariloche`.`cotizaciones` (`id`) ON DELETE SET NULL;

-- ── Verificación (debe devolver SET NULL en las 4 bases) ─────────────────────────────
SELECT CONSTRAINT_SCHEMA, CONSTRAINT_NAME, DELETE_RULE, UPDATE_RULE
  FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_NAME = 'fk_polizas_cotizacion'
 ORDER BY CONSTRAINT_SCHEMA;

-- =====================================================================================
-- ROLLBACK (volver al comportamiento anterior; NO recomendado: destruye pólizas)
-- =====================================================================================
-- ALTER TABLE `<base>`.`polizas` DROP FOREIGN KEY `fk_polizas_cotizacion`;
-- UPDATE `<base>`.`polizas` SET cotizacion_id = 0 WHERE cotizacion_id IS NULL; -- ojo: hay que resolver los NULL primero
-- ALTER TABLE `<base>`.`polizas` MODIFY COLUMN `cotizacion_id` INT(11) NOT NULL;
-- ALTER TABLE `<base>`.`polizas`
--   ADD CONSTRAINT `fk_polizas_cotizacion` FOREIGN KEY (`cotizacion_id`)
--   REFERENCES `<base>`.`cotizaciones` (`id`) ON DELETE CASCADE;
