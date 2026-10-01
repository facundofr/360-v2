-- Crear tabla para historial de cambios en documentos de pólizas
CREATE TABLE IF NOT EXISTS poliza_documentos_historial (
  id INT AUTO_INCREMENT PRIMARY KEY,
  documento_id INT NOT NULL,
  accion ENUM('creado', 'actualizado', 'eliminado') NOT NULL,
  motivo TEXT,
  usuario_id INT NOT NULL,
  archivo_anterior VARCHAR(255),
  archivo_nuevo VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_documento_id (documento_id),
  INDEX idx_usuario_id (usuario_id),
  INDEX idx_created_at (created_at),
  
  FOREIGN KEY (documento_id) REFERENCES poliza_documentos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE
);
