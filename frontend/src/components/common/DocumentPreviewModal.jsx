import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, Spinner } from '@/components/compat/bootstrap';
import { FaDownload, FaExternalLinkAlt, FaMobileAlt, FaDesktop } from '@/lib/icons';
import useDeviceDetection from '../../hooks/useDeviceDetection';

const DocumentPreviewModal = ({ 
  show, 
  onHide, 
  previewUrl, 
  previewMime, 
  documentName = 'Documento',
  onDownload,
  documentId = null // Agregar ID del documento para mejor manejo
}) => {
  const [loadingPDF, setLoadingPDF] = useState(false);
  const { isMobile, isTablet, isIOS, isAndroid, orientation } = useDeviceDetection();

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else if (previewUrl) {
      // Fallback download
      const link = document.createElement('a');
      link.href = previewUrl;
      
      // Generar nombre de archivo basado en el tipo y fecha
      const extension = previewMime === 'application/pdf' ? '.pdf' : 
                       previewMime.startsWith('image/') ? `.${previewMime.split('/')[1]}` : '';
      const fileName = documentName ? 
                      `${documentName.replace(/[^a-zA-Z0-9]/g, '_')}${extension}` :
                      `documento_${Date.now()}${extension}`;
      
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOpenInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  const renderPreviewContent = () => {
    if (!previewUrl || !previewMime) {
      return (
        <div className="text-center py-6">
          <Alert variant="warning">
            No se pudo cargar el documento para previsualización.
          </Alert>
        </div>
      );
    }

    // Para imágenes
    if (previewMime.startsWith("image/")) {
      return (
        <div className="text-center">
          <img 
            src={previewUrl} 
            alt={documentName}
            style={{ 
              width: "100%", 
              height: "auto",
              maxHeight: isMobile ? "60vh" : "70vh",
              objectFit: "contain"
            }} 
          />
        </div>
      );
    }

    // Para PDFs
    if (previewMime === "application/pdf") {
      // En móviles, mostrar opciones alternativas
      if (isMobile) {
        return (
          <div className="text-center py-6">
            <div className="mb-6">
              <FaMobileAlt size={48} className="text-primary mb-4" />
              <h5 className="mb-4 text-[1.25rem] font-bold leading-tight tracking-tight text-corporate">Vista de Documento PDF</h5>
              <p className="text-muted-foreground mb-6">
                En dispositivos móviles, recomendamos descargar o abrir el PDF en una nueva pestaña para una mejor experiencia.
              </p>
            </div>

            <div className="grid gap-4">
              <Button 
                variant="primary" 
                size="lg"
                onClick={handleDownload}
                className="flex items-center justify-center gap-2"
              >
                <FaDownload />
                Descargar PDF
              </Button>
              
              <Button 
                variant="outline-primary" 
                size="lg"
                onClick={handleOpenInNewTab}
                className="flex items-center justify-center gap-2"
              >
                <FaExternalLinkAlt />
                Abrir en Nueva Pestaña
              </Button>
            </div>

            <div className="mt-6">
              <Alert variant="info" className="text-[0.875em]">
                <FaMobileAlt className="me-2" />
                <strong>Consejo para {isIOS ? 'iOS' : isAndroid ? 'Android' : 'móvil'}:</strong> 
                {isIOS ? ' Toca "Descargar" y el PDF se abrirá en Safari, desde donde podrás guardarlo o compartirlo.' :
                 isAndroid ? ' Toca "Descargar" para abrir con tu app de PDF favorita.' :
                 ' Si descargas el PDF, podrás abrirlo con tu aplicación de PDF favorita.'}
              </Alert>
            </div>

            {/* Vista previa reducida en móvil (opcional) */}
            <div className="mt-6">
              <details>
                <summary className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 min-h-9 px-3 py-1 text-sm border-input bg-card text-foreground hover:bg-muted">
                  <FaDesktop className="me-2" />
                  Ver vista previa (puede ser lenta)
                </summary>
                <div className="mt-4" style={{ height: "40vh", border: "1px solid #ddd", borderRadius: "4px" }}>
                  {loadingPDF && (
                    <div className="flex justify-center items-center h-full">
                      <Spinner animation="border" />
                    </div>
                  )}
                  <iframe 
                    src={previewUrl} 
                    title="PDF"
                    style={{ 
                      width: "100%", 
                      height: "100%",
                      border: "none",
                      display: loadingPDF ? "none" : "block"
                    }}
                    onLoad={() => setLoadingPDF(false)}
                    onLoadStart={() => setLoadingPDF(true)}
                  />
                </div>
              </details>
            </div>
          </div>
        );
      }

      // En desktop, mostrar iframe normal
      return (
        <div style={{ position: "relative" }}>
          {loadingPDF && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <Spinner animation="border" />
              <div className="mt-2 text-[0.875em] text-muted-foreground">Cargando PDF...</div>
            </div>
          )}
          <iframe 
            src={previewUrl} 
            title="PDF"
            style={{ 
              width: "100%", 
              height: "70vh",
              border: "1px solid #ddd",
              borderRadius: "4px",
              display: loadingPDF ? "none" : "block"
            }}
            onLoad={() => setLoadingPDF(false)}
            onLoadStart={() => setLoadingPDF(true)}
          />
          
          {/* Botones de acción para desktop */}
          <div className="flex gap-2 mt-4 justify-center">
            <Button 
              variant="primary" 
              size="sm"
              onClick={handleDownload}
              className="flex items-center gap-2"
            >
              <FaDownload />
              Descargar
            </Button>
            <Button 
              variant="outline-primary" 
              size="sm"
              onClick={handleOpenInNewTab}
              className="flex items-center gap-2"
            >
              <FaExternalLinkAlt />
              Nueva Pestaña
            </Button>
          </div>
        </div>
      );
    }

    // Para otros tipos de archivo
    return (
      <div className="text-center py-6">
        <Alert variant="warning">
          <strong>Tipo de archivo no soportado para previsualización.</strong>
          <br />
          <small className="text-[0.875em]">Tipo MIME: {previewMime}</small>
        </Alert>
        <Button 
          variant="primary"
          onClick={handleDownload}
          className="flex items-center gap-2 mx-auto"
        >
          <FaDownload />
          Descargar Archivo
        </Button>
      </div>
    );
  };

  return (
    <Modal 
      show={show} 
      onHide={onHide} 
      size="xl" 
      centered
      fullscreen="md-down"
    >
      <Modal.Header closeButton>
        <Modal.Title className="flex items-center gap-2">
          {isMobile ? <FaMobileAlt /> : <FaDesktop />}
          Previsualización: {documentName}
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body 
        style={{ 
          minHeight: isMobile ? "50vh" : "70vh",
          maxHeight: isMobile ? "80vh" : "85vh",
          overflowY: "auto"
        }}
      >
        {renderPreviewContent()}
      </Modal.Body>
      
      <Modal.Footer className="flex justify-between">
        <div className="text-[0.875em] text-muted-foreground">
          {isMobile ? `📱 ${isIOS ? 'iOS' : isAndroid ? 'Android' : 'Móvil'}${isTablet ? ' Tablet' : ''}` : "🖥️ Escritorio"} 
          {orientation && isMobile ? ` • ${orientation === 'landscape' ? '🔄 Horizontal' : '📱 Vertical'}` : ''}
          {previewMime && ` • ${previewMime}`}
        </div>
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DocumentPreviewModal;
