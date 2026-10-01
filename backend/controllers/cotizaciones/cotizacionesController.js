const db = require("../../config/db");

// Puedes mapear los tipos de afiliación aquí si lo deseas
const TIPO_AFILIACION = {
  1: "Sin descuento",
  2: "Recibo de sueldo",
  3: "Monotributo"
};

const listarCotizaciones = async (req, res) => {
  try {
    // Si no hay parámetro prospectoId, obtener todas las cotizaciones
    if (!req.params.prospectoId) {
      return await listarTodasLasCotizaciones(req, res);
    }

    // Trae la última cotización del prospecto
    const [cotizaciones] = await db.query(`
      SELECT 
        c.prospecto_id,
        CONCAT(p.nombre, ' ', p.apellido) AS prospecto_nombre,
        pl.nombre AS plan_nombre,
        c.total_bruto,
        c.total_descuento,
        c.total_final,
        c.fecha
      FROM cotizaciones c
      JOIN prospectos p ON c.prospecto_id = p.id
      JOIN planes pl ON c.plan_id = pl.id
      WHERE c.prospecto_id = ?
      ORDER BY c.fecha DESC
      LIMIT 1
    `, [req.params.prospectoId]);

    res.json(cotizaciones);
  } catch (error) {
    console.error("Error al listar cotizaciones:", error);
    res.status(500).json({ message: "Error al obtener cotizaciones" });
  }
};

const listarTodasLasCotizaciones = async (req, res) => {
  try {
    // Obtener todas las cotizaciones con sus detalles
    const [cotizaciones] = await db.query(`
      SELECT 
        c.id,
        c.prospecto_id,
        CONCAT(p.nombre, ' ', p.apellido) AS prospecto_nombre,
        pl.nombre AS plan_nombre,
        c.total_bruto,
        c.total_descuento,
        c.total_descuento_aporte,
        c.total_descuento_promocion,
        c.total_final,
        c.anio,
        c.fecha
      FROM cotizaciones c
      JOIN prospectos p ON c.prospecto_id = p.id
      JOIN planes pl ON c.plan_id = pl.id
      ORDER BY c.fecha DESC
    `);

    // Para cada cotización, obtener sus detalles
    for (let cotizacion of cotizaciones) {
      const [detalles] = await db.query(`
        SELECT 
          cd.id,
          cd.persona,
          cd.vinculo,
          cd.edad,
          CASE 
            WHEN cd.tipo_afiliacion_id = 1 THEN 'Sin descuento'
            WHEN cd.tipo_afiliacion_id = 2 THEN 'Recibo de sueldo'
            WHEN cd.tipo_afiliacion_id = 3 THEN 'Monotributo'
            ELSE 'Otro'
          END as tipo_afiliacion,
          cd.precio_base,
          cd.descuento_aporte,
          cd.descuento_promocion,
          cd.promocion_aplicada,
          cd.precio_final
        FROM cotizaciones_detalles cd
        WHERE cd.cotizacion_id = ?
        ORDER BY cd.id
      `, [cotizacion.id]);

      cotizacion.detalles = detalles;
    }

    res.json(cotizaciones);
  } catch (error) {
    console.error("Error al listar todas las cotizaciones:", error);
    res.status(500).json({ message: "Error al obtener cotizaciones" });
  }
};

const aplicarLey19032 = async (req, res) => {
  try {
    const { cotizacionId } = req.params;
    const { integrantesConAporte } = req.body;

    console.log("🔍 aplicarLey19032 - Cotización:", cotizacionId);
    console.log("🔍 Body recibido:", JSON.stringify(req.body, null, 2));
    console.log("🔍 integrantesConAporte:", integrantesConAporte);

    // Validar datos de entrada
    if (!integrantesConAporte || !Array.isArray(integrantesConAporte) || integrantesConAporte.length === 0) {
      console.error("❌ Error: integrantesConAporte inválido", integrantesConAporte);
      return res.status(400).json({
        success: false,
        message: "integrantesConAporte es requerido y debe ser un array"
      });
    }

    // Validar estructura de cada integrante
    for (const integrante of integrantesConAporte) {
      console.log(`📋 Validando integrante:`, JSON.stringify(integrante));
      if (!integrante.nombre || integrante.aporte_presuntivo === undefined || integrante.aporte_presuntivo === null) {
        console.error("❌ Integrante inválido:", integrante);
        return res.status(400).json({
          success: false,
          message: "Cada integrante debe tener nombre y aporte_presuntivo"
        });
      }
    }

    // Verificar que la cotización existe
    const [cotizacionCheck] = await db.query(`
      SELECT c.id
      FROM cotizaciones c
      WHERE c.id = ?
    `, [cotizacionId]);

    if (cotizacionCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cotización no encontrada"
      });
    }

    // Iniciar transacción
    await db.query('START TRANSACTION');

    try {
      // Aplicar Ley 19032 a cada integrante en esta cotización
      for (const integrante of integrantesConAporte) {
        const { nombre, vinculo, aporte_presuntivo } = integrante;

        // Encontrar el detalle correspondiente a este integrante en esta cotización
        // cd.persona contiene el nombre de la persona en cotizaciones_detalles
        console.log(`🔍 Buscando detalle: Cotización ${cotizacionId}, Persona "${nombre}", Vinculo "${vinculo}"`);
        
        const [detalle] = await db.query(`
          SELECT cd.id, cd.precio_base, cd.descuento_promocion
          FROM cotizaciones_detalles cd
          WHERE cd.cotizacion_id = ? 
            AND cd.tipo_afiliacion_id = 2
            AND cd.persona = ?
            AND (? IS NULL OR cd.vinculo = ?)
          LIMIT 1
        `, [cotizacionId, nombre, vinculo, vinculo]);

        if (detalle.length > 0) {
          console.log(`✅ Detalle encontrado: ${JSON.stringify(detalle[0])}`);
        } else {
          console.log(`⚠️ Detalle NO encontrado para persona "${nombre}"`);
        }

        if (detalle.length > 0) {
          const detalleId = detalle[0].id;
          const precioBase = detalle[0].precio_base;
          const descuentoPromocion = detalle[0].descuento_promocion || 0;

          // Actualizar este detalle específico
          await db.query(`
            UPDATE cotizaciones_detalles 
            SET descuento_aporte = ?, 
                precio_final = ? - ? - ?,
                promocion_aplicada = CONCAT(
                  CASE WHEN promocion_aplicada IS NOT NULL AND promocion_aplicada != '' 
                       THEN CONCAT(promocion_aplicada, ' + ') 
                       ELSE '' 
                  END, 
                  'Ley 19032: $', FORMAT(?, 2)
                )
            WHERE id = ?
          `, [aporte_presuntivo, precioBase, aporte_presuntivo, descuentoPromocion, aporte_presuntivo, detalleId]);
        }
      }

      // Recalcular totales de la cotización
      const [totales] = await db.query(`
        SELECT 
          SUM(precio_base) as total_bruto,
          SUM(COALESCE(descuento_aporte, 0)) as total_descuento_aporte,
          SUM(COALESCE(descuento_promocion, 0)) as total_descuento_promocion,
          SUM(precio_final) as total_final
        FROM cotizaciones_detalles 
        WHERE cotizacion_id = ?
      `, [cotizacionId]);

      const nuevostotales = totales[0];

      // Actualizar la cotización principal
      await db.query(`
        UPDATE cotizaciones 
        SET total_bruto = ?, 
            total_descuento_aporte = ?,
            total_descuento_promocion = ?,
            total_final = ?
        WHERE id = ?
      `, [
        nuevostotales.total_bruto || 0,
        nuevostotales.total_descuento_aporte || 0,
        nuevostotales.total_descuento_promocion || 0,
        nuevostotales.total_final || 0,
        cotizacionId
      ]);

      // Confirmar transacción
      await db.query('COMMIT');

      res.json({
        success: true,
        message: "Ley 19032 aplicada correctamente a los integrantes especificados",
        data: {
          cotizacion_id: cotizacionId,
          integrantes_actualizados: integrantesConAporte.length,
          nuevos_totales: nuevostotales
        }
      });

    } catch (error) {
      // Rollback en caso de error
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error("Error al aplicar Ley 19032:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  }
};

// ✅ NUEVA: Recalcular cotización con precios actuales
const recalcularCotizacion = async (req, res) => {
  try {
    const { cotizacionId } = req.params;

    // Verificar que la cotización existe
    const [cotizacionData] = await db.query(`
      SELECT c.id, c.prospecto_id, c.plan_id
      FROM cotizaciones c
      WHERE c.id = ?
    `, [cotizacionId]);

    if (cotizacionData.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cotización no encontrada"
      });
    }

    const { prospecto_id, plan_id } = cotizacionData[0];

    // Obtener detalles de la cotización actual
    const [detallesActuales] = await db.query(`
      SELECT cd.id, cd.persona, cd.vinculo, cd.edad, cd.tipo_afiliacion_id
      FROM cotizaciones_detalles cd
      WHERE cd.cotizacion_id = ?
      ORDER BY cd.id
    `, [cotizacionId]);

    if (detallesActuales.length === 0) {
      return res.status(400).json({
        success: false,
        message: "La cotización no tiene detalles para recalcular"
      });
    }

    // Iniciar transacción
    await db.query('START TRANSACTION');

    try {
      let totalBruto = 0;
      let totalDescuentoAporte = 0;
      let totalDescuentoPromocion = 0;
      let totalFinal = 0;

      // Obtener datos del prospecto para aporte del titular
      const [prospectoData] = await db.query(`
        SELECT tipo_afiliacion_id, sueldo_bruto, categoria_monotributo
        FROM prospectos 
        WHERE id = ?
      `, [prospecto_id]);

      // Obtener promociones del prospecto
      const [promocionesData] = await db.query(`
        SELECT pp.promocion_id
        FROM prospectos_promociones pp
        WHERE pp.prospecto_id = ?
        LIMIT 1
      `, [prospecto_id]);

      const promocionId = promocionesData.length > 0 ? promocionesData[0].promocion_id : null;

      // ✅ DETECTAR SI HAY CÓNYUGE PARA ASIGNAR PRECIO DE MATRIMONIO AL TITULAR
      const tieneConyuge = detallesActuales.some(d => 
        d.vinculo === "cónyuge" || d.vinculo === "pareja/conyuge"
      );

      // Recalcular cada detalle con precios actuales
      for (const detalle of detallesActuales) {
        // 1. Obtener categoria de edad
        const [categoriaEdad] = await db.query(`
          SELECT id FROM categorias_edad 
          WHERE ? BETWEEN edad_min AND edad_max 
          LIMIT 1
        `, [detalle.edad]);

        if (categoriaEdad.length === 0) {
          console.warn(`⚠️ No se encontró categoría de edad para edad ${detalle.edad}`);
          continue;
        }

        const categoriaId = categoriaEdad[0].id;

        // 2. Determinar tipo_familia_id basado en vinculo
        let tipoFamiliaId;
        if (detalle.vinculo === "Titular") {
          // ✅ Si hay cónyuge, usar precio de matrimonio, sino individual
          tipoFamiliaId = tieneConyuge ? 2 : 1;
        } else if (detalle.vinculo === "cónyuge" || detalle.vinculo === "pareja/conyuge") {
          tipoFamiliaId = 2; // MATRIMONIO
        } else if (detalle.vinculo === "hijo/a") {
          tipoFamiliaId = 3; // HIJO
        } else if (detalle.vinculo === "familiar a cargo") {
          tipoFamiliaId = 4; // FAMILIAR A CARGO
        } else {
          tipoFamiliaId = 1; // Default
        }

        // 3. Obtener precio actual
        const [precioActual] = await db.query(`
          SELECT precio FROM listas_precios 
          WHERE plan_id = ? 
            AND categoria_id = ? 
            AND tipo_familia_id = ?
            AND anio = YEAR(NOW())
          LIMIT 1
        `, [plan_id, categoriaId, tipoFamiliaId]);

        // Fallback: Si no hay precio para el año actual, obtener el más reciente
        let precioBase = 0;
        if (precioActual.length > 0) {
          precioBase = parseFloat(precioActual[0].precio);
        } else {
          const [precioFallback] = await db.query(`
            SELECT precio FROM listas_precios 
            WHERE plan_id = ? 
              AND categoria_id = ? 
              AND tipo_familia_id = ?
            ORDER BY anio DESC 
            LIMIT 1
          `, [plan_id, categoriaId, tipoFamiliaId]);

          if (precioFallback.length > 0) {
            precioBase = parseFloat(precioFallback[0].precio);
            console.log(`⚠️ Usando precio fallback del año anterior para detalle ${detalle.id}`);
          }
        }

        // 4. Calcular descuento por aporte antes de aplicar promoción
        let descuentoAporte = 0;
        
        // Obtener datos de familiar si no es titular
        let tipoAfiliacionId = detalle.tipo_afiliacion_id;
        let sueldoBruto = null;
        let categoriaMonotributo = null;

        if (detalle.vinculo === "Titular" && prospectoData.length > 0) {
          tipoAfiliacionId = prospectoData[0].tipo_afiliacion_id;
          sueldoBruto = prospectoData[0].sueldo_bruto;
          categoriaMonotributo = prospectoData[0].categoria_monotributo;
        } else {
          // Buscar datos del familiar
          const [familiarData] = await db.query(`
            SELECT tipo_afiliacion_id, sueldo_bruto, categoria_monotributo
            FROM familiares 
            WHERE prospecto_id = ? AND nombre = ?
            LIMIT 1
          `, [prospecto_id, detalle.persona]);

          if (familiarData.length > 0) {
            tipoAfiliacionId = familiarData[0].tipo_afiliacion_id || tipoAfiliacionId;
            sueldoBruto = familiarData[0].sueldo_bruto;
            categoriaMonotributo = familiarData[0].categoria_monotributo;
          }
        }

        // Calcular aporte según tipo de afiliación
        if (tipoAfiliacionId === 2 && sueldoBruto) {
          // Con recibo de sueldo: 6.732% del sueldo bruto
          descuentoAporte = Math.round((parseFloat(sueldoBruto) * 0.06732) * 100) / 100;
        } else if (tipoAfiliacionId === 3 && categoriaMonotributo) {
          // Monotributista: buscar aporte presuntivo
          const [aporteMonotributo] = await db.query(`
            SELECT aporte_presuntivo 
            FROM categorias_monotributo 
            WHERE letra = ?
          `, [categoriaMonotributo]);

          if (aporteMonotributo.length > 0) {
            descuentoAporte = parseFloat(aporteMonotributo[0].aporte_presuntivo) || 0;
          }
        }

        // 5. Calcular precio con aporte antes de aplicar promoción
        const precioConAporte = precioBase - descuentoAporte;

        // 6. Obtener porcentaje de descuento si hay promoción (aplicar sobre precio con aporte)
        let descuentoPromocion = 0;
        let promocionAplicada = null;

        if (promocionId) {
          const [promocionInfo] = await db.query(`
            SELECT p.nombre, p.descuento_porcentaje, p.tipo
            FROM promociones p
            WHERE p.id = ? AND p.activa = 1
          `, [promocionId]);

          if (promocionInfo.length > 0) {
            const porcentaje = parseFloat(promocionInfo[0].descuento_porcentaje) || 0;
            const esIncremento = promocionInfo[0].tipo === 'incremento';
            // ✅ CORRECCIÓN: Aplicar promoción sobre precio CON aporte
            // Positivo = descuento (resta del precio), negativo = incremento (suma al precio)
            descuentoPromocion = Math.round((precioConAporte * (porcentaje / 100) * (esIncremento ? -1 : 1)) * 100) / 100;
            promocionAplicada = `${promocionInfo[0].nombre} (${esIncremento ? '+' : '-'}${porcentaje}%)`;
          }
        }

        const precioFinal = Math.max(precioConAporte - descuentoPromocion, 0);

        // 7. Actualizar el detalle con todos los cálculos correctos
        await db.query(`
          UPDATE cotizaciones_detalles 
          SET precio_base = ?, 
              descuento_aporte = ?,
              descuento_promocion = ?,
              precio_final = ?,
              promocion_aplicada = ?
          WHERE id = ?
        `, [precioBase, descuentoAporte, descuentoPromocion, precioFinal, promocionAplicada, detalle.id]);

        totalBruto += precioBase;
        totalDescuentoAporte += descuentoAporte;
        totalDescuentoPromocion += descuentoPromocion;
        totalFinal += precioFinal;
      }

      // 8. Calcular total de descuentos correctamente
      const totalDescuento = totalDescuentoAporte + totalDescuentoPromocion;

      // 9. Actualizar la cotización principal con todos los valores
      await db.query(`
        UPDATE cotizaciones 
        SET total_bruto = ?, 
            total_descuento_aporte = ?,
            total_descuento_promocion = ?,
            total_descuento = ?,
            total_final = ?
        WHERE id = ?
      `, [totalBruto, totalDescuentoAporte, totalDescuentoPromocion, totalDescuento, totalFinal, cotizacionId]);

      // Confirmar transacción
      await db.query('COMMIT');

      res.json({
        success: true,
        message: "Cotización recalculada exitosamente con precios actuales",
        data: {
          cotizacion_id: cotizacionId,
          integrantes_actualizados: detallesActuales.length,
          nuevos_totales: {
            total_bruto: parseFloat(totalBruto.toFixed(2)),
            total_descuento_aporte: parseFloat(totalDescuentoAporte.toFixed(2)),
            total_descuento_promocion: parseFloat(totalDescuentoPromocion.toFixed(2)),
            total_descuento: parseFloat(totalDescuento.toFixed(2)),
            total_final: parseFloat(totalFinal.toFixed(2))
          }
        }
      });

    } catch (error) {
      // Rollback en caso de error
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error("Error al recalcular cotización:", error);
    res.status(500).json({
      success: false,
      message: "Error interno al recalcular cotización"
    });
  }
};

module.exports = { listarCotizaciones, listarTodasLasCotizaciones, aplicarLey19032, recalcularCotizacion };