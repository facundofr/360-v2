-- Auditoría de borrados físicos de pólizas
-- Motivo: la aplicación solo hace soft delete (deleted_at). El 2026-09-10 la póliza
-- COB-202609-0057 (id 1161) desapareció por un DELETE manual sobre la base y no hubo
-- forma de atribuirlo: binlog y general_log están apagados y no hay plugin de auditoría.
-- Este trigger deja registro de quién ejecuta cualquier DELETE sobre `polizas` y guarda
-- la fila completa en JSON para poder restaurarla.
--
-- Aplicado el 2026-09-10 en: cober360-produccion, cober360-bristol, cober360-medicals,
-- cober360-bariloche.
--
-- Limitaciones conocidas de MariaDB:
--   * Los borrados en cascada sobre tablas hijas (poliza_documentos, etc.) NO disparan
--     triggers propios; queda igual la fila padre completa en `fila_completa`.
--   * TRUNCATE y DROP TABLE no disparan triggers.

CREATE TABLE IF NOT EXISTS `polizas_auditoria_borrado` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  poliza_id INT NOT NULL,
  numero_poliza VARCHAR(255) NULL,
  numero_poliza_oficial VARCHAR(255) NULL,
  estado VARCHAR(255) NULL,
  prospecto_id INT NULL,
  created_by INT NULL,
  poliza_created_at DATETIME NULL,
  poliza_updated_at DATETIME NULL,
  tenia_deleted_at TIMESTAMP NULL DEFAULT NULL,
  usuario_bd VARCHAR(255) NULL COMMENT 'CURRENT_USER(): cuenta MySQL que ejecutó el DELETE',
  cliente_bd VARCHAR(255) NULL COMMENT 'USER(): usuario@host de origen de la conexión',
  connection_id BIGINT NULL,
  fecha_borrado DATETIME NOT NULL,
  fila_completa LONGTEXT NULL COMMENT 'JSON con la fila completa, para poder restaurarla',
  INDEX idx_poliza (poliza_id),
  INDEX idx_fecha (fecha_borrado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Auditoría de borrados fisicos de polizas (la app solo hace soft delete)';

DROP TRIGGER IF EXISTS `trg_polizas_auditoria_borrado`;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` TRIGGER `cober360-produccion`.`trg_polizas_auditoria_borrado` BEFORE DELETE ON `cober360-produccion`.polizas
      FOR EACH ROW 
INSERT INTO `cober360-produccion`.`polizas_auditoria_borrado`
  (poliza_id, numero_poliza, numero_poliza_oficial, estado, prospecto_id, created_by,
   poliza_created_at, poliza_updated_at, tenia_deleted_at,
   usuario_bd, cliente_bd, connection_id, fecha_borrado, fila_completa)
VALUES
  (OLD.id, OLD.numero_poliza, OLD.numero_poliza_oficial, OLD.estado, OLD.prospecto_id, OLD.created_by,
   OLD.created_at, OLD.updated_at, OLD.deleted_at,
   CURRENT_USER(), USER(), CONNECTION_ID(), NOW(),
   JSON_OBJECT('id', OLD.`id`, 'prospecto_id', OLD.`prospecto_id`, 'cotizacion_id', OLD.`cotizacion_id`, 'numero_poliza', OLD.`numero_poliza`, 'numero_poliza_oficial', OLD.`numero_poliza_oficial`, 'pdf_hash', OLD.`pdf_hash`, 'estado', OLD.`estado`, 'requiere_auditoria_medica', OLD.`requiere_auditoria_medica`, 'estado_anterior', OLD.`estado_anterior`, 'fecha_cambio_estado', OLD.`fecha_cambio_estado`, 'motivo_cambio_estado', OLD.`motivo_cambio_estado`, 'revisado_por', OLD.`revisado_por`, 'fecha_revision', OLD.`fecha_revision`, 'datos_personales', OLD.`datos_personales`, 'integrantes', OLD.`integrantes`, 'documentos_titular', OLD.`documentos_titular`, 'documentos_integrantes', OLD.`documentos_integrantes`, 'referencias', OLD.`referencias`, 'declaracion_salud', OLD.`declaracion_salud`, 'cobertura_anterior', OLD.`cobertura_anterior`, 'datos_adicionales', OLD.`datos_adicionales`, 'terminos_aceptados', OLD.`terminos_aceptados`, 'fecha_aceptacion_terminos', OLD.`fecha_aceptacion_terminos`, 'created_at', OLD.`created_at`, 'updated_at', OLD.`updated_at`, 'created_by', OLD.`created_by`, 'observaciones', OLD.`observaciones`, 'fecha_finalizacion', OLD.`fecha_finalizacion`, 'deleted_at', OLD.`deleted_at`, 'deleted_by', OLD.`deleted_by`, 'motivo_eliminacion', OLD.`motivo_eliminacion`, 'restored_at', OLD.`restored_at`, 'restored_by', OLD.`restored_by`, 'informacion_afiliado', OLD.`informacion_afiliado`, 'informacion_facturacion', OLD.`informacion_facturacion`, 'solicitud_afiliacion', OLD.`solicitud_afiliacion`, 'datos_comerciales', OLD.`datos_comerciales`, 'hash_seguro', OLD.`hash_seguro`))$$
DELIMITER ;
