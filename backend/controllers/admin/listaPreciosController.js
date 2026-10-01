const ListaPrecios = require('../../models/admin/listaPreciosModel');
const validator = require('validator');

exports.getAll = async (req, res) => {
  try {
    const anio = req.query.anio || new Date().getFullYear();
    if (!validator.isInt(anio.toString(), { min: 2000, max: 2100 })) {
      return res.status(400).json({ message: "Año inválido." });
    }
    const precios = await ListaPrecios.getAll(anio);
    res.json(precios);
  } catch (error) {
    console.error('Error obteniendo precios:', error);
    res.status(500).json({ message: "Error al obtener la lista de precios." });
  }
};

exports.create = async (req, res) => {
  try {
    const { categoria_id, plan_id, tipo_familia_id, precio, anio } = req.body;
    const errores = [];

    // Validaciones
    if (!categoria_id || !validator.isInt(categoria_id.toString(), { min: 1 })) {
      errores.push("ID de categoría inválido.");
    }
    if (!plan_id || !validator.isInt(plan_id.toString(), { min: 1 })) {
      errores.push("ID de plan inválido.");
    }
    if (!tipo_familia_id || !validator.isInt(tipo_familia_id.toString(), { min: 1 })) {
      errores.push("ID de tipo de familia inválido.");
    }
    if (precio === undefined || precio === null || isNaN(precio) || Number(precio) <= 0) {
      errores.push("El precio debe ser un número positivo.");
    }
    const anioFinal = anio || new Date().getFullYear();
    if (!validator.isInt(anioFinal.toString(), { min: 2000, max: 2100 })) {
      errores.push("Año inválido.");
    }

    if (errores.length > 0) {
      return res.status(400).json({ message: "Error de validación", errores });
    }

    await ListaPrecios.create({
      categoria_id,
      plan_id,
      tipo_familia_id,
      precio,
      anio: anioFinal
    });

    res.status(201).json({ message: "Precio agregado correctamente." });
  } catch (error) {
    console.error("Error al agregar el precio:", error);
    if (error.errores && Array.isArray(error.errores)) {
      return res.status(400).json({ message: "Error de validación", errores: error.errores });
    }
    res.status(500).json({ message: "Error al agregar el precio." });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { precio } = req.body;
    const errores = [];

    if (!id || !validator.isInt(id.toString(), { min: 1 })) {
      errores.push("ID de lista de precios inválido.");
    }
    if (precio === undefined || precio === null || isNaN(precio) || Number(precio) <= 0) {
      errores.push("El precio debe ser un número positivo.");
    }

    if (errores.length > 0) {
      return res.status(400).json({ message: "Error de validación", errores });
    }

    await ListaPrecios.update(id, precio);
    res.json({ message: "Precio actualizado correctamente." });
  } catch (error) {
    console.error("Error al actualizar precio:", error);
    if (error.errores && Array.isArray(error.errores)) {
      return res.status(400).json({ message: "Error de validación", errores: error.errores });
    }
    res.status(500).json({ message: "Error al actualizar el precio." });
  }
};

// ✅ MANTENER: Función para aumentar (retrocompatibilidad)
exports.updateAllByPercentage = async (req, res) => {
  try {
    const { porcentaje, anio } = req.body;
    const errores = [];

    if (!anio || !validator.isInt(anio.toString(), { min: 2000, max: 2100 })) {
      errores.push("Año inválido.");
    }
    if (porcentaje === undefined || porcentaje === null || isNaN(porcentaje) || Number(porcentaje) <= 0) {
      errores.push("El porcentaje debe ser un número positivo.");
    }

    if (errores.length > 0) {
      return res.status(400).json({ message: "Error de validación", errores });
    }

    await ListaPrecios.updateAllByPercentageIncrease(anio, porcentaje);
    res.json({ message: "Precios aumentados correctamente." });
  } catch (error) {
    console.error("Error al aumentar precios:", error);
    if (error.errores && Array.isArray(error.errores)) {
      return res.status(400).json({ message: "Error de validación", errores: error.errores });
    }
    res.status(500).json({ message: "Error al aumentar los precios." });
  }
};

// ✅ AGREGAR: Nueva función para disminuir porcentaje
exports.decreaseAllByPercentage = async (req, res) => {
  try {
    const { porcentaje, anio } = req.body;
    const errores = [];

    if (!anio || !validator.isInt(anio.toString(), { min: 2000, max: 2100 })) {
      errores.push("Año inválido.");
    }
    if (porcentaje === undefined || porcentaje === null || isNaN(porcentaje) || Number(porcentaje) <= 0) {
      errores.push("El porcentaje debe ser un número positivo.");
    }
    if (Number(porcentaje) >= 100) {
      errores.push("El porcentaje de descuento no puede ser mayor o igual a 100%.");
    }

    if (errores.length > 0) {
      return res.status(400).json({ message: "Error de validación", errores });
    }

    await ListaPrecios.updateAllByPercentageDecrease(anio, porcentaje);
    res.json({ message: "Precios disminuidos correctamente." });
  } catch (error) {
    console.error("Error al disminuir precios:", error);
    if (error.errores && Array.isArray(error.errores)) {
      return res.status(400).json({ message: "Error de validación", errores: error.errores });
    }
    res.status(500).json({ message: "Error al disminuir los precios." });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !validator.isInt(id.toString(), { min: 1 })) {
      return res.status(400).json({ message: "ID de lista de precios inválido." });
    }
    await ListaPrecios.delete(id);
    res.json({ message: "Precio eliminado correctamente." });
  } catch (error) {
    console.error("Error al eliminar precio:", error);
    res.status(500).json({ message: "Error al eliminar el precio." });
  }
};

// ✅ CORREGIR: Exportar lista de precios a CSV
exports.exportarCSV = async (req, res) => {
  try {
    const anio = req.query.anio || new Date().getFullYear();
    
    // Validar año
    if (!validator.isInt(anio.toString(), { min: 2000, max: 2100 })) {
      return res.status(400).json({ message: "Año inválido." });
    }

    console.log('📊 Exportando precios a CSV para año:', anio);

    // Obtener datos para exportar
    const precios = await ListaPrecios.getAllForExport(anio);
    
    if (precios.length === 0) {
      return res.status(404).json({ 
        message: `No hay precios disponibles para exportar en el año ${anio}` 
      });
    }

    // ✅ GENERAR CSV
    const csvContent = generateCSV(precios);
    
    // ✅ CONFIGURAR HEADERS PARA DESCARGA
    const filename = `lista_precios_${anio}_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');
    
    // ✅ BOM para Excel (UTF-8)
    res.write('\uFEFF');
    res.end(csvContent);

    console.log('✅ CSV exportado exitosamente:', filename);

  } catch (error) {
    console.error('❌ Error exportando CSV:', error);
    res.status(500).json({ 
      message: "Error al exportar lista de precios", 
      error: error.message 
    });
  }
};

// ✅ CORREGIR: Función auxiliar para generar CSV simplificada
function generateCSV(data) {
  // Definir encabezados del CSV
  const headers = [
    'ID',
    'Plan',
    'Plan ID',
    'Categoría Edad',
    'Categoría ID', 
    'Tipo Familia',
    'Tipo Familia ID',
    'Precio',
    'Año',
    'Fecha Exportación'
  ];

  // Crear filas CSV
  const rows = data.map(row => [
    row.id,
    `"${row.plan}"`, // Entrecomillar para evitar problemas con comas
    row.plan_id,
    `"${row.categoria_edad}"`,
    row.categoria_id,
    `"${row.tipo_familia}"`,
    row.tipo_familia_id,
    parseFloat(row.precio).toFixed(2), // Formato decimal
    row.anio,
    new Date().toISOString().split('T')[0] // Fecha actual
  ]);

  // Combinar encabezados y filas
  const csvLines = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ];

  return csvLines.join('\n');
}

// ✅ MANTENER: Template CSV
exports.descargarTemplateCSV = async (req, res) => {
  try {
    console.log('📋 Generando template CSV');

    const csvContent = generateTemplateCSV();
    const filename = `template_lista_precios.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.write('\uFEFF');
    res.end(csvContent);

    console.log('✅ Template CSV generado exitosamente');

  } catch (error) {
    console.error('❌ Error generando template CSV:', error);
    res.status(500).json({ 
      message: "Error al generar template CSV", 
      error: error.message 
    });
  }
};

// ✅ CORREGIR: Función auxiliar para generar template CSV
function generateTemplateCSV() {
  const headers = [
    'plan_id',
    'categoria_id', 
    'tipo_familia_id',
    'precio',
    'anio'
  ];

  const exampleRow = [
    '1', // plan_id (reemplazar con ID real)
    '1', // categoria_id (reemplazar con ID real)
    '1', // tipo_familia_id (reemplazar con ID real)
    '1000.00', // precio
    new Date().getFullYear() // anio actual
  ];

  const csvLines = [
    '# Template para importar lista de precios',
    '# Reemplaza los valores de ejemplo con datos reales',
    '# Los IDs deben corresponder a registros existentes en la base de datos',
    headers.join(','),
    exampleRow.join(',')
  ];

  return csvLines.join('\n');
}