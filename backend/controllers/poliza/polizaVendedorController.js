const PolizaModel = require('../../models/poliza/polizaModel');
const Historial = require('../../models/vendedor/historialModel');
const db = require('../../config/db');

const PolizaVendedorController = {
  // Obtener pólizas del vendedor logueado
  async obtenerPolizas(req, res) {
    try {
      const vendedor_id = req.user.id;
      const { 
        page = 1, 
        limit = 20, 
        estado, 
        desde, 
        hasta, 
        buscar
      } = req.query;

      console.log('📋 Obteniendo pólizas del vendedor:', vendedor_id);

      let whereConditions = ['p.created_by = ?', 'p.deleted_at IS NULL'];
      let queryParams = [vendedor_id];

      // Filtrar por estado
      if (estado && estado !== 'todos') {
        whereConditions.push('p.estado = ?');
        queryParams.push(estado);
      }

      // Filtrar por fechas
      if (desde) {
        whereConditions.push('DATE(p.created_at) >= ?');
        queryParams.push(desde);
      }

      if (hasta) {
        whereConditions.push('DATE(p.created_at) <= ?');
        queryParams.push(hasta);
      }

      // Búsqueda por texto
      if (buscar) {
        whereConditions.push(`(
          p.numero_poliza LIKE ? OR 
          pr.nombre LIKE ? OR 
          pr.apellido LIKE ? OR 
          pr.telefono LIKE ? OR
          pr.email LIKE ?
        )`);
        const buscarParam = `%${buscar}%`;
        queryParams.push(buscarParam, buscarParam, buscarParam, buscarParam, buscarParam);
      }

      const whereClause = whereConditions.join(' AND ');
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Query principal con joins
      const query = `
        SELECT 
          p.id,
          p.numero_poliza,
          p.numero_poliza_oficial,
          p.pdf_hash,
          p.estado,
          p.requiere_auditoria_medica,
          p.created_at,
          p.updated_at,
          p.fecha_finalizacion,
          -- Datos del prospecto
          pr.nombre as prospecto_nombre,
          pr.apellido as prospecto_apellido,
          pr.numero_contacto as prospecto_telefono,
          pr.correo as prospecto_email,
          pr.edad as prospecto_edad,
          pr.localidad as prospecto_localidad,
          -- Datos de la cotización
          pl.nombre as plan_nombre,
          c.total_bruto,
          c.total_descuento_aporte,
          c.total_descuento_promocion,
          c.total_final as cotizacion_total,
          -- Datos del tipo de afiliación
          ta.nombre as tipo_afiliacion_nombre,
          -- Datos del vendedor
          v.first_name as vendedor_nombre,
          v.last_name as vendedor_apellido,
          -- Datos de firma electrónica
          pve.estado_firma,
          pve.doc_uuid as referencia_vafirma,
          pve.enviado_en as fecha_envio_firma,
          pve.firmado_en as fecha_firma
        FROM polizas p
        LEFT JOIN prospectos pr ON p.prospecto_id = pr.id
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        LEFT JOIN tipos_afiliacion ta ON pr.tipo_afiliacion_id = ta.id
        LEFT JOIN users v ON p.created_by = v.id
        LEFT JOIN (
          SELECT poliza_id, estado_firma, doc_uuid, enviado_en, firmado_en
          FROM polizas_vafirma_envios
          WHERE id IN (
            SELECT MAX(id) FROM polizas_vafirma_envios GROUP BY poliza_id
          )
        ) pve ON p.id = pve.poliza_id
        WHERE ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `;

      queryParams.push(parseInt(limit), offset);

      // Query para contar total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM polizas p
        LEFT JOIN prospectos pr ON p.prospecto_id = pr.id
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        LEFT JOIN planes pl ON c.plan_id = pl.id
        WHERE ${whereClause}
      `;

      const countParams = queryParams.slice(0, -2); // Quitar limit y offset

      // Ejecutar queries
      const [polizas] = await db.execute(query, queryParams);
      const [countResult] = await db.execute(countQuery, countParams);

      console.log('✅ Pólizas raw desde DB:', JSON.stringify(polizas[0], null, 2)); // Solo la primera

      const total = countResult[0].total;
      const totalPages = Math.ceil(total / parseInt(limit));

      // Formatear respuesta
      const polizasFormateadas = polizas.map(poliza => {
        console.log('🔍 Formateando póliza:', poliza.id, {
          prospecto_nombre: poliza.prospecto_nombre,
          prospecto_apellido: poliza.prospecto_apellido,
          plan_nombre: poliza.plan_nombre,
          total_final: poliza.cotizacion_total
        });

        return {
          id: poliza.id,
          numero_poliza_oficial: poliza.numero_poliza_oficial || poliza.numero_poliza,
          numero_poliza: poliza.numero_poliza,
          pdf_hash: poliza.pdf_hash,
          estado: poliza.estado,
          requiere_auditoria_medica: poliza.requiere_auditoria_medica,
          created_at: poliza.created_at,
          updated_at: poliza.updated_at,
          fecha_finalizacion: poliza.fecha_finalizacion,
          // ✅ DATOS DEL PROSPECTO
          prospecto_nombre: poliza.prospecto_nombre,
          prospecto_apellido: poliza.prospecto_apellido,
          prospecto_telefono: poliza.prospecto_telefono,
          prospecto_email: poliza.prospecto_email,
          prospecto_edad: poliza.prospecto_edad,
          prospecto_localidad: poliza.prospecto_localidad,
          // ✅ DATOS DEL PLAN
          plan_nombre: poliza.plan_nombre,
          total_bruto: poliza.total_bruto,
          total_descuento_aporte: poliza.total_descuento_aporte,
          total_descuento_promocion: poliza.total_descuento_promocion,
          total_final: poliza.cotizacion_total,
          // ✅ DATOS ADICIONALES
          tipo_afiliacion: poliza.tipo_afiliacion_nombre,
          estado_firma: poliza.estado_firma || null,
          referencia_vafirma: poliza.referencia_vafirma || null,
          fecha_envio_firma: poliza.fecha_envio_firma || null,
          fecha_firma: poliza.fecha_firma || null,
          vendedor: {
            nombre: poliza.vendedor_nombre,
            apellido: poliza.vendedor_apellido
          },
          urls: {
            pdf: `${process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online')}/api/polizas/${poliza.id}/pdf`,
            detalle: `${process.env.BASE_URL || (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'https://wspflows.cober.online')}/api/polizas/${poliza.id}`
          }
        };
      });

      console.log('📋 Primera póliza formateada:', JSON.stringify(polizasFormateadas[0], null, 2));

      res.json({
        success: true,
        data: polizasFormateadas,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: total,
          total_pages: totalPages,
          has_more: parseInt(page) < totalPages
        },
        filters_applied: {
          vendedor_id,
          estado: estado || 'todos',
          desde,
          hasta,
          buscar
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo pólizas del vendedor:', error);
      res.status(500).json({ 
        error: 'Error obteniendo pólizas',
        message: error.message 
      });
    }
  },

  // Obtener estadísticas del vendedor
  async obtenerEstadisticas(req, res) {
    try {
      const vendedor_id = req.user.id;
      const { periodo = 'mes' } = req.query; // 'dia', 'semana', 'mes', 'año'

      console.log('📊 Obteniendo estadísticas del vendedor:', vendedor_id);

      // Determinar filtro de fecha
      let fechaFiltro = '';
      switch (periodo) {
        case 'dia':
          fechaFiltro = 'DATE(created_at) = CURDATE()';
          break;
        case 'semana':
          fechaFiltro = 'YEARWEEK(created_at) = YEARWEEK(NOW())';
          break;
        case 'mes':
          fechaFiltro = 'YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())';
          break;
        case 'año':
          fechaFiltro = 'YEAR(created_at) = YEAR(NOW())';
          break;
        default:
          fechaFiltro = 'YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())';
      }

      // Query para estadísticas generales
      const statsQuery = `
        SELECT 
          COUNT(*) as total_polizas,
          COUNT(CASE WHEN p.estado = 'activa' THEN 1 END) as polizas_activas,
          COUNT(CASE WHEN p.estado = 'en_proceso' THEN 1 END) as polizas_en_proceso,
          COUNT(CASE WHEN p.estado = 'cancelada' THEN 1 END) as polizas_canceladas,
          COALESCE(SUM(c.total_final), 0) as facturacion_total,
          COALESCE(AVG(c.total_final), 0) as ticket_promedio
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        WHERE p.created_by = ? AND ${fechaFiltro}
      `;

      // Query para evolución diaria (últimos 30 días)
      const evolucionQuery = `
        SELECT 
          DATE(p.created_at) as fecha,
          COUNT(*) as polizas_creadas,
          COUNT(CASE WHEN p.estado != 'borrador' THEN 1 END) as polizas_definitivas,
          COALESCE(SUM(CASE WHEN p.estado != 'borrador' THEN c.total_final END), 0) as facturacion_dia
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        WHERE p.created_by = ? AND p.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(p.created_at)
        ORDER BY fecha DESC
        LIMIT 30
      `;

      // Query para top planes vendidos
      const planesQuery = `
        SELECT 
          c.plan_nombre,
          COUNT(*) as cantidad,
          COALESCE(SUM(c.total_final), 0) as facturacion
        FROM polizas p
        LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
        WHERE p.created_by = ? AND ${fechaFiltro}
        GROUP BY c.plan_nombre
        ORDER BY cantidad DESC
        LIMIT 5
      `;

      // Ejecutar queries
      const [stats] = await db.execute(statsQuery, [vendedor_id]);
      const [evolucion] = await db.execute(evolucionQuery, [vendedor_id]);
      const [planes] = await db.execute(planesQuery, [vendedor_id]);

      res.json({
        success: true,
        periodo: periodo,
        data: {
          resumen: stats[0],
          evolucion_diaria: evolucion,
          top_planes: planes,
          metricas_calculadas: {
            conversion_rate: stats[0].total_polizas > 0 
              ? ((stats[0].polizas_definitivas / stats[0].total_polizas) * 100).toFixed(2) + '%'
              : '0%',
            polizas_por_dia: evolucion.length > 0 
              ? (evolucion.reduce((sum, dia) => sum + dia.polizas_creadas, 0) / evolucion.length).toFixed(1)
              : '0'
          }
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      res.status(500).json({ 
        error: 'Error obteniendo estadísticas',
        message: error.message 
      });
    }
  },

  // Obtener póliza específica del vendedor
  async obtenerPoliza(req, res) {
    try {
      const { id } = req.params;
      const vendedor_id = req.user.id;

      // Verificar que la póliza pertenece al vendedor
      const poliza = await PolizaModel.obtenerCompleta(id);
      
      if (!poliza) {
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }

      if (poliza.created_by !== vendedor_id) {
        return res.status(403).json({ 
          error: 'Acceso denegado',
          message: 'No tienes permisos para ver esta póliza'
        });
      }

      res.json({
        success: true,
        data: poliza
      });

    } catch (error) {
      console.error('❌ Error obteniendo póliza del vendedor:', error);
      res.status(500).json({ 
        error: 'Error obteniendo póliza',
        message: error.message 
      });
    }
  },

  // Cambiar estado de póliza (solo del vendedor)
  async cambiarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado, observaciones } = req.body;
      const vendedor_id = req.user.id;

      // Verificar que la póliza pertenece al vendedor
      const verificarQuery = `
        SELECT created_by FROM polizas WHERE id = ?
      `;
      const [verificar] = await db.execute(verificarQuery, [id]);

      if (verificar.length === 0) {
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }

      if (verificar[0].created_by !== vendedor_id) {
        return res.status(403).json({ 
          error: 'Acceso denegado',
          message: 'No tienes permisos para modificar esta póliza'
        });
      }

      // Validar estados permitidos para vendedores
      const estadosPermitidos = ['en_proceso', 'activa', 'cancelada'];
      if (!estadosPermitidos.includes(estado)) {
        return res.status(400).json({
          error: 'Estado inválido',
          message: 'Estados permitidos: ' + estadosPermitidos.join(', ')
        });
      }

      // Actualizar estado
      const resultado = await PolizaModel.actualizarEstado(id, estado, observaciones);

      res.json({
        success: true,
        message: 'Estado actualizado correctamente',
        data: resultado
      });

    } catch (error) {
      console.error('❌ Error cambiando estado de póliza:', error);
      res.status(500).json({ 
        error: 'Error cambiando estado',
        message: error.message 
      });
    }
  },

  // ✅ Obtener póliza para editar (solo datos permitidos)
  async obtenerParaEditar(req, res) {
    try {
      const { id } = req.params;
      const vendedor_id = req.user.id;

      // Verificar que la póliza pertenece al vendedor
      const poliza = await PolizaModel.obtenerCompleta(id);
      
      if (!poliza) {
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }

      if (poliza.created_by !== vendedor_id) {
        return res.status(403).json({ 
          error: 'Acceso denegado',
          message: 'No tienes permisos para editar esta póliza'
        });
      }

      // ✅ Adjuntar detalles de la cotización para que EditarPolizaModal
      // pueda armar el mismo objeto cotizacion que usa PolizaForm
      if (poliza.cotizacion_id) {
        try {
          const [detalles] = await db.execute(`
            SELECT 
              cd.id,
              cd.persona,
              cd.vinculo,
              cd.edad,
              cd.tipo_afiliacion_id,
              cd.precio_base,
              cd.descuento_aporte,
              cd.descuento_promocion,
              cd.promocion_aplicada,
              cd.precio_final
            FROM cotizaciones_detalles cd
            WHERE cd.cotizacion_id = ?
            ORDER BY cd.id
          `, [poliza.cotizacion_id]);
          poliza.cotizacion_detalles = detalles;
        } catch (e) {
          console.warn('⚠️ No se pudieron cargar detalles de cotización:', e.message);
          poliza.cotizacion_detalles = [];
        }
      }

      res.json({
        success: true,
        data: poliza
      });

    } catch (error) {
      console.error('❌ Error obteniendo póliza para editar:', error);
      res.status(500).json({ 
        error: 'Error obteniendo póliza',
        message: error.message 
      });
    }
  },

    // ✅ ACTUALIZADO: Actualizar póliza (replicado desde supervisor - actualización directa)
  async actualizarPoliza(req, res) {
    try {
      const { id } = req.params;
      const datosActualizacion = req.body;
      const vendedor_id = req.user.id;

      console.log('🔄 Actualizando póliza:', id);
      console.log('📊 Datos recibidos:', {
        tiene_declaracion_jurada: !!datosActualizacion.declaracion_jurada,
        tiene_integrantes: !!datosActualizacion.integrantes,
        tiene_referencias: !!datosActualizacion.referencias
      });

      // Verificar que la póliza pertenece al vendedor
      const [polizaActual] = await db.execute(
        'SELECT * FROM polizas WHERE id = ? AND created_by = ? AND deleted_at IS NULL',
        [id, vendedor_id]
      );

      if (polizaActual.length === 0) {
        return res.status(404).json({ error: 'Póliza no encontrada o no tienes permisos para editarla' });
      }

      // Cargar datos actuales para mantener lo que no se actualiza
      let datosPersonalesActuales = {};
      let declaracionSaludActual = {};
      let integrantesActuales = [];
      let documentosTitularActuales = {};
      let referenciasActuales = [];
      let datosComercialesActuales = {};

      try {
        datosPersonalesActuales = JSON.parse(polizaActual[0].datos_personales || '{}');
        declaracionSaludActual = JSON.parse(polizaActual[0].declaracion_salud || '{}');
        integrantesActuales = JSON.parse(polizaActual[0].integrantes || '[]');
        documentosTitularActuales = JSON.parse(polizaActual[0].documentos_titular || '{}');
        referenciasActuales = JSON.parse(polizaActual[0].referencias || '[]');
        datosComercialesActuales = JSON.parse(polizaActual[0].datos_comerciales || '{}');
      } catch (e) {
        console.warn('⚠️ Error parseando datos de póliza:', e);
      }

      // ✅ CAMPOS PERMITIDOS PARA EDITAR (SOLO DE datos_personales, sin cotización)
      const camposPermitidos = {
        nombre: true, apellido: true, dni: true, cuil: true, dni_cuil: true, email: true, correo: true, telefono: true, celular: true,
        direccion: true, numero: true, piso: true, dpto: true, localidad: true, cod_postal: true,
        fecha_nacimiento: true, edad: true, sexo: true, estado_civil: true, nacionalidad: true,
        condicion_iva: true, tipo_domicilio: true, tipo_afiliacion: true, forma_pago: true,
        porcentaje_promocion: true,
        asesor: true, fecha_solicitud: true, mes_ingreso: true, proximo_periodo_abonar: true, 
        obra_social: true, obra_social_otra: true, numero_poliza_vendedor: true,
        empresa_razon_social: true, empresa_cuit: true, empresa_direccion: true,
        empresa_codigo_postal: true, empresa_localidad: true, empresa_telefono: true,
        peso: true, altura: true, observaciones: true
      };

      // Actualizar datos personales solo con campos permitidos
      const datosPersonalesActualizados = { ...datosPersonalesActuales };
      for (const [campo, valor] of Object.entries(datosActualizacion)) {
        if (camposPermitidos[campo]) {
          datosPersonalesActualizados[campo] = valor;
        }
      }

      // ✅ Extraer peso y altura del titular desde datos_fisicos de la declaración de salud
      // El frontend los guarda en declaracion_jurada.datos_fisicos.titular_peso/titular_altura
      // pero el PDF los lee desde datos_personales.peso/altura
      const datosFisicos = datosActualizacion.declaracion_jurada?.datos_fisicos;
      if (datosFisicos) {
        if (datosFisicos.titular_peso !== undefined && datosFisicos.titular_peso !== '') {
          datosPersonalesActualizados.peso = datosFisicos.titular_peso;
        }
        if (datosFisicos.titular_altura !== undefined && datosFisicos.titular_altura !== '') {
          datosPersonalesActualizados.altura = datosFisicos.titular_altura;
        }
      }

      // ✅ REPLICADO DEL SUPERVISOR: Preparar datos para actualizar usando los datos enviados
      // o mantener los actuales si no se envió nada
      let declaracion_salud = datosActualizacion.declaracion_jurada || datosActualizacion.declaracion_salud || declaracionSaludActual;
      
      console.log('📋 Declaración salud recibida del frontend:', {
        tiene_declaracion_jurada: !!datosActualizacion.declaracion_jurada,
        tiene_declaracion_salud: !!datosActualizacion.declaracion_salud,
        estructura: declaracion_salud ? Object.keys(declaracion_salud) : []
      });
      console.log('📋 Medicación recibida:', {
        medicacion: declaracion_salud?.medicacion,
        coberturaAnterior: declaracion_salud?.coberturaAnterior
      });
      console.log('📋 Declaración salud COMPLETA a guardar:', JSON.stringify(declaracion_salud, null, 2));
      
      let integrantes = datosActualizacion.integrantes !== undefined
        ? datosActualizacion.integrantes 
        : integrantesActuales;
      
      let documentos_titular = datosActualizacion.documentos_titular !== undefined
        ? datosActualizacion.documentos_titular 
        : documentosTitularActuales;
      
      let referencias = datosActualizacion.referencias !== undefined
        ? datosActualizacion.referencias 
        : referenciasActuales;
      
      let datos_comerciales = datosActualizacion.saludTerminos !== undefined
        ? datosActualizacion.saludTerminos 
        : datosComercialesActuales;

      // ✅ Si se envió saludTerminos, también actualizar declaracion_salud con las respuestas de salud
      // (el PDF lee de declaracion_salud.respuestas, no de datos_comerciales)
      if (datosActualizacion.saludTerminos) {
        const saludTerminos = datosActualizacion.saludTerminos;
        // Merge sobre la declaración de salud existente (mantener datos_fisicos, preguntas, etc.)
        if (saludTerminos.respuestas) {
          declaracion_salud.respuestas = saludTerminos.respuestas;
        }
        if (saludTerminos.medicacion !== undefined) {
          declaracion_salud.medicacion = saludTerminos.medicacion;
        }
        if (saludTerminos.coberturaAnterior !== undefined) {
          declaracion_salud.coberturaAnterior = saludTerminos.coberturaAnterior;
          declaracion_salud.cobertura_anterior = saludTerminos.coberturaAnterior;
        }
        if (saludTerminos.datosAdicionales !== undefined) {
          declaracion_salud.datos_adicionales = saludTerminos.datosAdicionales;
        }
      }

      // ✅ Sincronizar peso/altura de datos_fisicos.integrantes → integrantes[idx] (para que el PDF los lea)
      const datosFisicosInts = declaracion_salud?.datos_fisicos?.integrantes;
      if (Array.isArray(datosFisicosInts) && Array.isArray(integrantes)) {
        integrantes = integrantes.map((integrante, idx) => {
          const fisico = datosFisicosInts[idx];
          if (!fisico) return integrante;
          return {
            ...integrante,
            peso: fisico.peso !== undefined && fisico.peso !== '' ? fisico.peso : integrante.peso,
            altura: fisico.altura !== undefined && fisico.altura !== '' ? fisico.altura : integrante.altura
          };
        });
      }

      // ✅ ACTUALIZACIÓN DIRECTA COMO EN EL SUPERVISOR (sin query dinámica)
      const updateQuery = `
        UPDATE polizas 
        SET 
          datos_personales = ?,
          integrantes = ?,
          documentos_titular = ?,
          referencias = ?,
          declaracion_salud = ?,
          datos_comerciales = ?,
          numero_poliza_oficial = COALESCE(?, numero_poliza_oficial),
          updated_at = NOW()
        WHERE id = ? AND created_by = ? AND deleted_at IS NULL
      `;

      const updateParams = [
        JSON.stringify(datosPersonalesActualizados),
        JSON.stringify(integrantes),
        JSON.stringify(documentos_titular),
        JSON.stringify(referencias),
        JSON.stringify(declaracion_salud),
        JSON.stringify(datos_comerciales),
        datosPersonalesActualizados.numero_poliza_vendedor || null,
        id,
        vendedor_id
      ];

      console.log('📝 Ejecutando UPDATE directo con todos los campos');
      console.log('📝 declaracion_salud tiene:', Object.keys(declaracion_salud || {}).length, 'propiedades');

      const [result] = await db.execute(updateQuery, updateParams);

      if (result.affectedRows === 0) {
        return res.status(500).json({ error: 'No se pudo actualizar la póliza' });
      }

      console.log('✅ Póliza actualizada correctamente en la base de datos');
      console.log('✅ Campos actualizados: datos_personales, declaracion_salud, integrantes, referencias, datos_comerciales');

      // ✅ Actualizar correo en tabla prospectos si se envió
      const correoNuevo = datosActualizacion.correo || datosActualizacion.email;
      if (correoNuevo && polizaActual[0].prospecto_id) {
        await db.execute(
          'UPDATE prospectos SET correo = ? WHERE id = ?',
          [correoNuevo, polizaActual[0].prospecto_id]
        );
        console.log('✅ Correo actualizado en tabla prospectos:', correoNuevo);
      }

      // ✅ NUEVO: Actualizar cotización si hay cambios
      const camposActualizados = [
        'datos_personales',
        'declaracion_salud',
        'integrantes',
        'referencias',
        'datos_comerciales'
      ];

      res.json({
        success: true,
        message: 'Póliza actualizada correctamente',
        data: {
          id: id,
          numero_poliza: polizaActual[0].numero_poliza_oficial || polizaActual[0].numero_poliza,
          updated_at: new Date(),
          campos_actualizados: [
            'datos_personales',
            'integrantes',
            'documentos_titular',
            'referencias',
            'declaracion_salud',
            'datos_comerciales'
          ]
        }
      });

    } catch (error) {
      console.error('❌ Error actualizando póliza:', error);
      res.status(500).json({ 
        error: 'Error actualizando póliza',
        message: error.message,
        details: error.sqlMessage || 'Error en base de datos'
      });
    }
  },

  // ✅ Verificar si un número de póliza ya está en uso
  async verificarNumeroPoliza(req, res) {
    try {
      const { numero } = req.query;
      const { excluir_id } = req.query; // ID de la póliza actual (para edición)

      if (!numero || !numero.trim()) {
        return res.json({ success: true, disponible: true });
      }

      let query = `
        SELECT id, numero_poliza, numero_poliza_oficial
        FROM polizas
        WHERE numero_poliza_oficial = ?
        AND deleted_at IS NULL
        AND estado != 'eliminada'
      `;
      const params = [numero.trim()];

      if (excluir_id) {
        query += ' AND id != ?';
        params.push(excluir_id);
      }

      query += ' LIMIT 1';

      const [rows] = await db.execute(query, params);

      res.json({
        success: true,
        disponible: rows.length === 0,
        en_uso_por: rows.length > 0 ? rows[0].numero_poliza : null
      });
    } catch (error) {
      console.error('❌ Error verificando número de póliza:', error);
      res.status(500).json({ success: false, disponible: true });
    }
  },

  // ✅ NUEVA FUNCIÓN: Enviar póliza a supervisor (solo desde vendedor)
  async enviarASupervisor(req, res) {
    try {
      const { id } = req.params;
      const { motivo_cambio_estado } = req.body;
      const vendedor_id = req.user.id;

      console.log(`📤 Vendedor ${vendedor_id} intenta enviar póliza ${id} a supervisor`);

      // Verificar que la póliza pertenece al vendedor
      const [polizas] = await db.query(
        'SELECT id, numero_poliza, estado, created_by, prospecto_id FROM polizas WHERE id = ?',
        [id]
      );

      if (polizas.length === 0) {
        return res.status(404).json({ 
          success: false,
          error: 'Póliza no encontrada' 
        });
      }

      const poliza = polizas[0];

      if (poliza.created_by !== vendedor_id) {
        return res.status(403).json({ 
          success: false,
          error: 'Acceso denegado',
          message: 'No tienes permisos para modificar esta póliza'
        });
      }

      // Cambiar estado a 'supervisor'
      const [result] = await db.query(
        `UPDATE polizas 
         SET estado = 'supervisor', 
             fecha_cambio_estado = NOW(),
             observaciones = CONCAT(COALESCE(observaciones, ''), '\n[Enviado a supervisor] ', ?)
         WHERE id = ?`,
        [motivo_cambio_estado || 'Sin motivo especificado', id]
      );

      if (result.affectedRows === 0) {
        return res.status(500).json({
          success: false,
          error: 'No se pudo actualizar la póliza'
        });
      }

      console.log(`✅ Póliza ${poliza.numero_poliza} enviada a supervisor exitosamente`);

      // 🔄 Actualizar estado en asignaciones a 'Póliza enviada a supervisor'
      try {
        const fechaHoraTextoEnvio = new Date().toLocaleString('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        await db.query(
          `UPDATE asignaciones SET estado = 'Póliza enviada a supervisor', comentario = ?, fecha_estado = NOW() WHERE id_prospecto = ? AND id_vendedor = ?`,
          [`Póliza ${poliza.numero_poliza} enviada a supervisor el ${fechaHoraTextoEnvio}`, poliza.prospecto_id, vendedor_id]
        );
        await Historial.registrarAccion(
          poliza.prospecto_id,
          vendedor_id,
          'poliza_enviada_supervisor',
          `Póliza ${poliza.numero_poliza} enviada a supervisor`
        );
        // Sincronizar estado en Google Sheets
        try {
          const GoogleSheetsService = require('../../services/googleSheetsService');
          await GoogleSheetsService.actualizarAsignacionEnSheet(poliza.prospecto_id);
          console.log(`📊 Estado 'Póliza enviada a supervisor' sincronizado en Google Sheets para prospecto ${poliza.prospecto_id}`);
        } catch (errSheet) {
          console.error('⚠️ Error sincronizando estado en Google Sheets:', errSheet.message);
        }
      } catch (errEstado) {
        console.error('⚠️ Error actualizando estado a Póliza enviada a supervisor:', errEstado.message);
      }

      res.json({
        success: true,
        mensaje: 'Póliza enviada a supervisor exitosamente',
        numero_poliza: poliza.numero_poliza,
        nuevo_estado: 'supervisor'
      });

    } catch (error) {
      console.error('❌ Error enviando póliza a supervisor:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error enviando póliza a supervisor',
        message: error.message 
      });
    }
  }
};

module.exports = PolizaVendedorController;