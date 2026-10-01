// const PolizaModel = require('../../models/poliza/polizaModel');
// const db = require('../../config/db');

// const PolizaTemporalController = {
//   // Crear póliza temporal
//   async crear(req, res) {
//     try {
//       const { prospecto_id, cotizacion_id, estado, form } = req.body;
//       const vendedor_id = req.user.id;

//       console.log('🔧 Creando póliza temporal:', { 
//         prospecto_id, 
//         cotizacion_id, 
//         vendedor_id,
//         form_recibido: !!form
//       });

//       // Validar datos mínimos
//       if (!prospecto_id || !cotizacion_id) {
//         return res.status(400).json({
//           error: 'Datos incompletos',
//           message: 'Se requieren prospecto_id y cotizacion_id'
//         });
//       }

//       // Generar número de póliza temporal
//       const numeroPoliza = await PolizaModel.generarNumeroPoliza();

//       // Crear fecha en formato MySQL DATETIME
//       const now = new Date();
//       const fechaCreacion = now.toISOString().slice(0, 19).replace('T', ' ');

//       // Estructura para guardar
//       const datosParaInsertar = {
//         numero_poliza: numeroPoliza,
//         prospecto_id,
//         cotizacion_id,
//         estado: estado || 'en_proceso',
//         es_temporal: true,
//         created_by: vendedor_id,
//         created_at: fechaCreacion,
//         datos_personales: JSON.stringify(form?.datos_personales || {}),
//         integrantes: JSON.stringify(form?.integrantes || {}),
//         referencias: JSON.stringify(form?.referencias || {}),
//         declaracion_salud: JSON.stringify(form?.declaracion_salud || {}),
//         cobertura_anterior: JSON.stringify(form?.cobertura_anterior || {}),
//         datos_adicionales: JSON.stringify(form?.datos_adicionales || {}),
//         documentos_titular: JSON.stringify(form?.documentos_titular || {}),
//         documentos_integrantes: JSON.stringify(form?.documentos_integrantes || {})
//       };

//       // Insertar en base de datos
//       const query = `
//         INSERT INTO polizas 
//         (numero_poliza, prospecto_id, cotizacion_id, estado, es_temporal, created_by, created_at,
//          datos_personales, integrantes, referencias, declaracion_salud, 
//          cobertura_anterior, datos_adicionales, documentos_titular, documentos_integrantes) 
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//       `;

//       const [result] = await db.execute(query, [
//         datosParaInsertar.numero_poliza,
//         datosParaInsertar.prospecto_id,
//         datosParaInsertar.cotizacion_id,
//         datosParaInsertar.estado,
//         datosParaInsertar.es_temporal,
//         datosParaInsertar.created_by,
//         datosParaInsertar.created_at,
//         datosParaInsertar.datos_personales,
//         datosParaInsertar.integrantes,
//         datosParaInsertar.referencias,
//         datosParaInsertar.declaracion_salud,
//         datosParaInsertar.cobertura_anterior,
//         datosParaInsertar.datos_adicionales,
//         datosParaInsertar.documentos_titular,
//         datosParaInsertar.documentos_integrantes
//       ]);

//       console.log('✅ Póliza temporal creada con ID:', result.insertId);

//       res.json({
//         success: true,
//         poliza_id: result.insertId,
//         numero_poliza: numeroPoliza,
//         estado: 'temporal'
//       });

//     } catch (error) {
//       console.error('❌ Error creando póliza temporal:', error);
//       res.status(500).json({ 
//         error: 'Error al crear póliza temporal',
//         message: error.message 
//       });
//     }
//   },

//   // Actualizar póliza temporal
//   async actualizar(req, res) {
//     try {
//       const { id } = req.params;
//       const { form } = req.body;

//       console.log('🔄 Actualizando póliza temporal ID:', id);

//       if (!form) {
//         return res.status(400).json({
//           error: 'Datos incompletos',
//           message: 'Se requieren los datos del formulario'
//         });
//       }

//       const updateQuery = `
//         UPDATE polizas 
//         SET 
//           datos_personales = ?,
//           integrantes = ?,
//           referencias = ?,
//           declaracion_salud = ?,
//           cobertura_anterior = ?,
//           datos_adicionales = ?,
//           updated_at = NOW()
//         WHERE id = ? AND es_temporal = true
//       `;

//       const [result] = await db.execute(updateQuery, [
//         JSON.stringify(form.datos_personales || {}),
//         JSON.stringify(form.integrantes || []),
//         JSON.stringify(form.referencias || []),
//         JSON.stringify(form.declaracion_salud || {}),
//         JSON.stringify(form.cobertura_anterior || {}),
//         JSON.stringify(form.datos_adicionales || {}),
//         id
//       ]);

//       if (result.affectedRows === 0) {
//         return res.status(404).json({
//           error: 'Póliza temporal no encontrada'
//         });
//       }

//       res.json({
//         success: true,
//         message: 'Póliza temporal actualizada exitosamente'
//       });

//     } catch (error) {
//       console.error('❌ Error actualizando póliza temporal:', error);
//       res.status(500).json({ 
//         error: 'Error al actualizar póliza temporal',
//         message: error.message 
//       });
//     }
//   },

//   // Finalizar póliza temporal (convertir a definitiva)
//   async finalizar(req, res) {
//     try {
//       const { id } = req.params;
//       const { form } = req.body;

//       console.log('🏁 Finalizando póliza temporal ID:', id);

//       // ✅ VALIDACIONES ANTES DE FINALIZAR
//       if (!form.datos_personales?.nombre || !form.datos_personales?.apellido) {
//         return res.status(400).json({
//           error: 'Datos incompletos',
//           message: 'Faltan datos personales básicos'
//         });
//       }

//       if (!form.referencias || form.referencias.length === 0) {
//         return res.status(400).json({
//           error: 'Referencias requeridas',
//           message: 'Debe proporcionar al menos una referencia'
//         });
//       }

//       if (!form.declaracion_salud?.respuestas || Object.keys(form.declaracion_salud.respuestas).length === 0) {
//         return res.status(400).json({
//           error: 'Declaración de salud incompleta',
//           message: 'Debe completar la declaración de salud'
//         });
//       }

//       // Estructura de datos finales
//       const datosFinales = {
//         datos_personales: JSON.stringify(form.datos_personales || {}),
//         integrantes: JSON.stringify(form.integrantes || []),
//         referencias: JSON.stringify(form.referencias || []),
//         declaracion_salud: JSON.stringify(form.declaracion_salud || {}),
//         cobertura_anterior: JSON.stringify(form.declaracion_salud?.cobertura_anterior || {}),
//         datos_adicionales: JSON.stringify(form.declaracion_salud?.datos_adicionales || {}),
//         es_temporal: false,
//         estado: 'activa',
//         fecha_finalizacion: new Date().toISOString().slice(0, 19).replace('T', ' ')
//       };

//       const updateQuery = `
//         UPDATE polizas 
//         SET 
//           datos_personales = ?,
//           integrantes = ?,
//           referencias = ?,
//           declaracion_salud = ?,
//           cobertura_anterior = ?,
//           datos_adicionales = ?,
//           es_temporal = ?,
//           estado = ?,
//           fecha_finalizacion = ?
//         WHERE id = ? AND es_temporal = true
//       `;

//       const [result] = await db.execute(updateQuery, [
//         datosFinales.datos_personales,
//         datosFinales.integrantes,
//         datosFinales.referencias,
//         datosFinales.declaracion_salud,
//         datosFinales.cobertura_anterior,
//         datosFinales.datos_adicionales,
//         datosFinales.es_temporal,
//         datosFinales.estado,
//         datosFinales.fecha_finalizacion,
//         id
//       ]);

//       if (result.affectedRows === 0) {
//         return res.status(404).json({
//           error: 'Póliza temporal no encontrada'
//         });
//       }

//       const polizaCompleta = await PolizaModel.obtenerCompleta(id);

//       res.json({
//         success: true,
//         id: id,
//         numero_poliza: polizaCompleta.numero_poliza,
//         poliza: polizaCompleta
//       });

//     } catch (error) {
//       console.error('❌ Error finalizando póliza temporal:', error);
//       res.status(500).json({ 
//         error: 'Error al finalizar póliza temporal',
//         message: error.message 
//       });
//     }
//   },

//   // Eliminar póliza temporal
//   async eliminar(req, res) {
//     try {
//       const { id } = req.params;

//       console.log('🗑️ Eliminando póliza temporal ID:', id);

//       await db.execute(
//         'DELETE FROM polizas WHERE id = ? AND es_temporal = true',
//         [id]
//       );

//       res.json({ 
//         success: true, 
//         message: 'Póliza temporal eliminada' 
//       });

//     } catch (error) {
//       console.error('❌ Error eliminando póliza temporal:', error);
//       res.status(500).json({ 
//         error: 'Error al eliminar póliza temporal',
//         message: error.message 
//       });
//     }
//   }
// };

// module.exports = PolizaTemporalController;