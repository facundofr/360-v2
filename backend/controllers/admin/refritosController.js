const RefritosModel = require('../../models/admin/refritosModel');
const RefritosVisibilityService = require('../../services/RefritosVisibilityService');
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');

// 📁 CONFIGURACIÓN DE MULTER PARA ARCHIVOS
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/refritos');
    // Crear directorio si no existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `refrito_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error('Solo se permiten archivos CSV, XLSX o XLS'));
    }
    
    cb(null, true);
  }
});

// 🧵 CARGAS EN SEGUNDO PLANO
// La carga se procesa después de responder; el estado se consulta por polling y se
// guarda en disco para que el resultado (y el detalle de errores) sobreviva a un reinicio.
const CARGAS_DIR = path.join(__dirname, '../../uploads/refritos/cargas');
const cargas = new Map();
let cargaEnCursoId = null;

const guardarCarga = (carga) => {
  try {
    fs.mkdirSync(CARGAS_DIR, { recursive: true });
    fs.writeFileSync(path.join(CARGAS_DIR, `${carga.id}.json`), JSON.stringify(carga));
  } catch (err) {
    console.error(`⚠️ No se pudo guardar el estado de la carga de refritos ${carga.id}:`, err.message);
  }
};

const leerCarga = (id) => {
  if (cargas.has(id)) return cargas.get(id);
  if (!/^[\w-]+$/.test(id)) return null;
  try {
    const carga = JSON.parse(fs.readFileSync(path.join(CARGAS_DIR, `${id}.json`), 'utf8'));
    // En disco figura "procesando" pero no está en memoria: el backend se reinició a mitad de la carga
    if (carga.estado === 'procesando') carga.estado = 'interrumpida';
    return carga;
  } catch {
    return null;
  }
};

const RefritosController = {
  /**
   * 📤 CARGAR ARCHIVO DE REFRITOS
   * Responde 202 con un cargaId y procesa en segundo plano (ver obtenerEstadoCarga)
   */
  subirArchivoRefritos: [
    upload.single('archivo'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No se ha cargado ningún archivo" });
        }

        const filePath = req.file.path;
        const ext = path.extname(req.file.originalname).toLowerCase();

        let datosArray = [];

        // Procesar CSV
        if (ext === '.csv') {
          datosArray = await new Promise((resolve, reject) => {
            const results = [];
            fs.createReadStream(filePath)
              .pipe(csv())
              .on('data', (data) => {
                results.push(RefritosController.normalizarFila(data));
              })
              .on('end', () => {
                resolve(results);
              })
              .on('error', reject);
          });
        }
        // Procesar XLSX/XLS
        else if (ext === '.xlsx' || ext === '.xls') {
          const workbook = xlsx.readFile(filePath);
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          datosArray = xlsx.utils.sheet_to_json(worksheet).map(row => 
            RefritosController.normalizarFila(row)
          );
        }

        // Validar columnas requeridas a nivel de archivo
        const requeridas = ['nombre', 'apellido', 'edad', 'numero_contacto', 'correo', 'localidad'];
        const muestra = datosArray[0] || {};
        const faltantes = requeridas.filter(k => !(k in muestra));
        if (faltantes.length > 0) {
          // Eliminar archivo temporal y abortar
          fs.unlink(filePath, () => {});
          return res.status(400).json({
            message: 'Faltan columnas obligatorias en el archivo',
            columnas_faltantes: faltantes
          });
        }

        // Una sola carga a la vez: dos cargas simultáneas del mismo padrón duplican prospectos
        if (cargaEnCursoId) {
          fs.unlink(filePath, () => {});
          return res.status(409).json({
            message: 'Ya hay una carga de refritos en proceso. Esperá a que termine antes de subir otro archivo.',
            cargaId: cargaEnCursoId
          });
        }

        const carga = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          estado: 'procesando',
          archivo: req.file.originalname,
          usuarioId: req.user?.id || null,
          total: datosArray.length,
          procesadas: 0,
          iniciado: new Date().toISOString(),
          finalizado: null,
          resumen: null,
          resultados: null,
          error: null
        };
        // Las cargas terminadas quedan en disco; en memoria solo la que está en curso
        for (const [id, c] of cargas) {
          if (c.estado !== 'procesando') cargas.delete(id);
        }
        cargas.set(carga.id, carga);
        cargaEnCursoId = carga.id;
        guardarCarga(carga);
        console.log(`📥 Carga de refritos ${carga.id} iniciada: ${carga.total} filas (${carga.archivo})`);

        // Responder ya: un padrón grande tarda varios minutos y el proxy corta a los 300s
        res.status(202).json({
          message: 'Archivo recibido. Se está procesando en segundo plano.',
          cargaId: carga.id,
          total: carga.total
        });

        RefritosModel.procesarArchivoRefritos(datosArray, (procesadas) => {
          carga.procesadas = procesadas;
        })
          .then((resultados) => {
            const nuevos = resultados.exitosos.filter(e => !e.esDuplicado).length;
            carga.estado = 'completada';
            carga.resultados = resultados;
            carga.resumen = {
              totalProcesados: resultados.totalProcesados,
              exitosos: resultados.exitosos.length,
              nuevos,
              reasignados: resultados.exitosos.length - nuevos,
              errores: resultados.errores.length
            };
            console.log(`✅ Carga de refritos ${carga.id} completada:`, carga.resumen);
          })
          .catch((error) => {
            carga.estado = 'error';
            carga.error = error.message;
            console.error(`❌ Carga de refritos ${carga.id} falló:`, error);
          })
          .finally(() => {
            carga.finalizado = new Date().toISOString();
            cargaEnCursoId = null;
            guardarCarga(carga);
            fs.unlink(filePath, (err) => {
              if (err) console.error('Error al eliminar archivo temporal:', err);
            });
          });

      } catch (error) {
        console.error("Error al procesar archivo de refritos:", error);
        
        // Eliminar archivo en caso de error
        if (req.file) {
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error al eliminar archivo:', err);
          });
        }

        res.status(500).json({ 
          message: "Error al procesar el archivo de refritos",
          error: error.message 
        });
      }
    }
  ],

  /**
   * 📊 ESTADO DE UNA CARGA EN SEGUNDO PLANO
   * El resultado completo (exitosos/errores por fila) solo se envía cuando terminó
   */
  obtenerEstadoCarga: (req, res) => {
    const carga = leerCarga(req.params.cargaId);
    if (!carga) {
      return res.status(404).json({ message: 'Carga no encontrada' });
    }
    if (carga.estado === 'completada') {
      return res.json(carga);
    }
    const { resultados, ...estado } = carga;
    res.json(estado);
  },

  /**
   * 🔎 CARGA EN CURSO (para retomar el seguimiento al volver a la pantalla)
   */
  obtenerCargaEnCurso: (req, res) => {
    const carga = cargaEnCursoId ? cargas.get(cargaEnCursoId) : null;
    if (!carga) {
      return res.json({ carga: null });
    }
    const { resultados, ...estado } = carga;
    res.json({ carga: estado });
  },

  /**
   * 🔄 REASIGNAR REFRITO NO CONTACTADO
   */
  reasignarRefritoNoContactado: async (req, res) => {
    try {
      const { prospectoId } = req.body;

      if (!prospectoId || isNaN(prospectoId)) {
        return res.status(400).json({ message: "ID de prospecto inválido" });
      }

      const resultado = await RefritosModel.reasignarRefritoNoContactado(prospectoId);

      res.status(200).json({
        message: "Refrito reasignado exitosamente",
        resultado
      });

    } catch (error) {
      console.error("Error al reasignar refrito:", error);
      res.status(500).json({ 
        message: "Error al reasignar el refrito",
        error: error.message 
      });
    }
  },

  /**
   * ❌ ELIMINAR REFRITO DEL FLUJO
   */
  eliminarRefritoDeFlujo: async (req, res) => {
    try {
      const { prospectoId } = req.body;

      if (!prospectoId || isNaN(prospectoId)) {
        return res.status(400).json({ message: "ID de prospecto inválido" });
      }

      await RefritosModel.eliminarRefritoSinContacto(prospectoId);

      res.status(200).json({
        message: "Refrito eliminado del flujo",
        prospectoId
      });

    } catch (error) {
      console.error("Error al eliminar refrito:", error);
      res.status(500).json({ 
        message: "Error al eliminar el refrito",
        error: error.message 
      });
    }
  },

  /**
   * 📋 OBTENER HISTORIAL DE ASIGNACIONES
   */
  obtenerHistorialRefrito: async (req, res) => {
    try {
      const { prospectoId } = req.params;

      if (!prospectoId || isNaN(prospectoId)) {
        return res.status(400).json({ message: "ID de prospecto inválido" });
      }

      const historial = await RefritosModel.obtenerHistorialRefrito(prospectoId);

      res.status(200).json({
        prospectoId,
        historial
      });

    } catch (error) {
      console.error("Error al obtener historial:", error);
      res.status(500).json({ 
        message: "Error al obtener el historial",
        error: error.message 
      });
    }
  },

  /**
   * 📊 OBTENER ESTADÍSTICAS DE REFRITOS
   */
  obtenerEstadisticas: async (req, res) => {
    try {
      const estadisticas = await RefritosModel.obtenerEstadisticasRefritos();

      res.status(200).json({
        message: "Estadísticas de refritos",
        estadisticas
      });

    } catch (error) {
      console.error("Error al obtener estadísticas:", error);
      res.status(500).json({ 
        message: "Error al obtener las estadísticas",
        error: error.message 
      });
    }
  },

  /**
   * 🏆 OBTENER REFRITOS DE UN VENDEDOR
   */
  obtenerRefritosVendedor: async (req, res) => {
    try {
      const { vendedorId } = req.params;

      if (!vendedorId || isNaN(vendedorId)) {
        return res.status(400).json({ message: "ID de vendedor inválido" });
      }

      const refritos = await RefritosModel.obtenerRefritosVendedor(vendedorId);

      res.status(200).json({
        vendedorId,
        totalRefritos: refritos.length,
        refritos
      });

    } catch (error) {
      console.error("Error al obtener refritos del vendedor:", error);
      res.status(500).json({ 
        message: "Error al obtener los refritos",
        error: error.message 
      });
    }
  },

  /**
   * 📋 LISTAR TODOS LOS REFRITOS (ASIGNACIÓN ACTUAL)
   */
  listarTodos: async (req, res) => {
    try {
      const refritos = await RefritosModel.obtenerTodosRefritos();
      res.status(200).json({
        total: refritos.length,
        refritos
      });
    } catch (error) {
      console.error("Error al listar refritos:", error);
      res.status(500).json({
        message: "Error al listar los refritos",
        error: error.message
      });
    }
  },

  /**   * 📊 OBTENER REPORTE DE ASIGNACIONES POR VENDEDOR
   */
  obtenerReportePorVendedor: async (req, res) => {
    try {
      const reporte = await RefritosModel.obtenerReportePorVendedor();
      res.status(200).json({
        message: "Reporte de asignaciones por vendedor",
        reporte
      });
    } catch (error) {
      console.error("Error al obtener reporte:", error);
      res.status(500).json({
        message: "Error al obtener el reporte",
        error: error.message
      });
    }
  },

  /**   * �️ OBTENER REFRITO VISIBLE ACTUAL PARA UN VENDEDOR
   */
  obtenerRefritoVisible: async (req, res) => {
    try {
      const { vendedorId } = req.params;
      
      if (!vendedorId || isNaN(vendedorId)) {
        return res.status(400).json({ message: "ID de vendedor inválido" });
      }

      const refrito = await RefritosVisibilityService.obtenerRefritoVisible(parseInt(vendedorId));
      
      res.status(200).json({
        vendedorId: parseInt(vendedorId),
        tieneVisible: !!refrito,
        refrito: refrito
      });
    } catch (error) {
      console.error("Error al obtener refrito visible:", error);
      res.status(500).json({
        message: "Error al obtener el refrito visible",
        error: error.message
      });
    }
  },

  /**
   * 📊 OBTENER CANTIDAD DE REFRITOS EN COLA PARA UN VENDEDOR
   */
  obtenerRefritosEnCola: async (req, res) => {
    try {
      const { vendedorId } = req.params;
      
      if (!vendedorId || isNaN(vendedorId)) {
        return res.status(400).json({ message: "ID de vendedor inválido" });
      }

      const cantidad = await RefritosVisibilityService.contarRefritosEnCola(parseInt(vendedorId));
      
      res.status(200).json({
        vendedorId: parseInt(vendedorId),
        enCola: cantidad
      });
    } catch (error) {
      console.error("Error al contar refritos en cola:", error);
      res.status(500).json({
        message: "Error al contar refritos en cola",
        error: error.message
      });
    }
  },

  /**
   * �🔧 NORMALIZAR FILA DEL ARCHIVO
   * Convierte datos del CSV/XLSX a estructura esperada
   */
  normalizarFila: (fila) => {
    return {
      nombre: fila.nombre?.trim() || '',
      apellido: fila.apellido?.trim() || '',
      edad: fila.edad ? parseInt(fila.edad) : null,
      numero_contacto: fila.numero_contacto?.trim() || '',
      correo: fila.correo?.trim() || null,
      localidad: fila.localidad?.trim() || '',
      comentario: fila.comentario?.trim() || null,
      // Por defecto: Particular/Autónomo = 1 si no viene en archivo
      tipo_afiliacion_id: fila.tipo_afiliacion_id ? parseInt(fila.tipo_afiliacion_id) : 1,
      sueldo_bruto: fila.sueldo_bruto ? parseFloat(fila.sueldo_bruto) : null,
      categoria_monotributo: fila.categoria_monotributo?.trim() || null,
      familiares: [] // Los familiares se procesarían de forma adicional si aplica
    };
  }
};

module.exports = RefritosController;
module.exports.upload = upload;
