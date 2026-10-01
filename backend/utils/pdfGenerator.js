const PDFGenerator = {
  async generarPolizaPDF(poliza, detallesCotizacion) {
    // Por ahora devuelve un placeholder
    // Implementaremos el PDF real después
    return {
      path: `/tmp/poliza-${poliza.numero_poliza}.pdf`,
      buffer: Buffer.from('PDF placeholder content')
    };
  }
};

module.exports = PDFGenerator;