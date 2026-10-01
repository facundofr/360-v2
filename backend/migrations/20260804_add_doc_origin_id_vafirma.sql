-- Agrega doc_origin_id para permitir lookup desde webhook VaFirma por docOriginId
ALTER TABLE polizas_vafirma_envios
  ADD COLUMN IF NOT EXISTS doc_origin_id VARCHAR(100) NULL COMMENT 'ID de origen enviado a VaFirma (COBER360-POLIZA-{id})' AFTER doc_uuid,
  ADD INDEX IF NOT EXISTS idx_doc_origin_id (doc_origin_id);
