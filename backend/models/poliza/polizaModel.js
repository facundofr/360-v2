const db = require('../../config/db');
const crypto = require('crypto');

// ✅ ESTADOS VÁLIDOS DE PÓLIZA
const ESTADOS_POLIZA = {
    ASESOR: 'asesor',              // Estado inicial (antes: pendiente_revision)
    SUPERVISOR: 'supervisor',       // Revisión por supervisor
    BACK_OFFICE: 'back_office',     // Procesamiento administrativo
    VENTA_CERRADA: 'venta_cerrada', // Venta finalizada (antes: cerrada)
    VENTA_RECHAZADA: 'venta_rechazada' // Ingreso rechazado por Back Office
};

const PolizaModel = {
    // Exponer estados como constante
    ESTADOS: ESTADOS_POLIZA,

    // Crear nueva póliza con datos del formulario
    async crear(datosPoliza) {
        const {
            prospecto_id,
            cotizacion_id,
            form,
            created_by,
            estado = ESTADOS_POLIZA.ASESOR, // ✅ CAMBIADO: Estado por defecto ahora es 'asesor'
            motivo_cambio_estado = 'Póliza completada por vendedor'
        } = datosPoliza;

        // ✅ VALIDAR: Verificar si ya existe una póliza para esta cotización
        const polizaExistente = await this.verificarPolizaExistente(prospecto_id, cotizacion_id);
        if (polizaExistente) {
            throw new Error(`Ya existe una póliza generada para esta cotización. Número de póliza: ${polizaExistente.numero_poliza}`);
        }

        // Generar número de póliza único para seguimiento interno
        const numero_poliza = await this.generarNumeroPoliza();
        
        // Obtener número de póliza oficial del vendedor (para documentos)
        const numero_poliza_oficial = form.datos_personales?.numero_poliza_vendedor || null;

        // ✅ NUEVO: Verificar si ya existe una póliza con el mismo número oficial EN OTRO PROSPECTO
        if (numero_poliza_oficial) {
            const polizaConMismoNumeroOficial = await this.verificarNumeroPolizaOficialExistente(numero_poliza_oficial, prospecto_id);
            if (polizaConMismoNumeroOficial) {
                throw new Error(`Ya existe una póliza con el número oficial "${numero_poliza_oficial}" para otro prospecto. Póliza existente: ${polizaConMismoNumeroOficial.numero_poliza} (Prospecto ID: ${polizaConMismoNumeroOficial.prospecto_id})`);
            }
        }

        // Generar hash único para el PDF
        const pdf_hash = crypto.randomBytes(16).toString('hex');

        // ✅ NUEVO: Verificar si requiere auditoría médica basado en IMC
        const requiereAuditoriaMedica = form.declaracion_jurada?.requiere_auditoria_medica ? 1 : 0;
        console.log('🏥 Flag requiere_auditoria_medica:', requiereAuditoriaMedica);

        const query = `
            INSERT INTO polizas (
                prospecto_id, cotizacion_id, numero_poliza, numero_poliza_oficial, pdf_hash,
                estado, requiere_auditoria_medica, estado_anterior, motivo_cambio_estado, fecha_cambio_estado,
                datos_personales, integrantes, documentos_titular, documentos_integrantes,
                referencias, declaracion_salud, cobertura_anterior,
                datos_adicionales, terminos_aceptados, fecha_aceptacion_terminos,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
        `;

        // ✅ AGREGAR: Debug de saludTerminos recibido
        console.log('🔍 DEBUG MODEL - saludTerminos recibido:', JSON.stringify(form.saludTerminos, null, 2));
        console.log('🔍 DEBUG MODEL - respuestas específicas:', form.saludTerminos?.respuestas);

        try {
            // ✅ MAPEAR saludTerminos a declaracion_salud correctamente
            const declaracionSaludCompleta = {
                // ✅ RESPUESTAS DE SALUD (LO MÁS IMPORTANTE)
                respuestas: form.saludTerminos?.respuestas || {},

                // ✅ CORREGIDO: Medicación por integrante (guardamos el objeto completo)
                medicacion: form.saludTerminos?.medicacion || {},

                // ✅ CORREGIDO: Cobertura médica anterior por integrante (guardamos el objeto completo)
                coberturaAnterior: form.saludTerminos?.coberturaAnterior || {},
                
                // ✅ MANTENER COMPATIBILIDAD: También guardar en formato antiguo
                cobertura_anterior: form.saludTerminos?.coberturaAnterior || {},

                // ✅ AGREGAR: Datos adicionales por integrante
                datos_adicionales: form.saludTerminos?.datosAdicionales || {},

                // Datos físicos (existente)
                datos_fisicos: form.declaracion_jurada?.datos_fisicos || {},

                // Otros datos de declaración jurada
                ...(form.declaracion_jurada || {})
            };
            
            console.log('💾 DEBUG - medicacion guardada:', JSON.stringify(declaracionSaludCompleta.medicacion, null, 2));
            console.log('💾 DEBUG - coberturaAnterior guardada:', JSON.stringify(declaracionSaludCompleta.coberturaAnterior, null, 2));

            console.log('💾 Guardando declaracion_salud completa:', JSON.stringify(declaracionSaludCompleta, null, 2));

            // ✅ VALIDAR QUE LAS RESPUESTAS NO ESTÉN VACÍAS
            const respuestasCount = Object.keys(declaracionSaludCompleta.respuestas).length;
            console.log(`📊 Total de integrantes con respuestas: ${respuestasCount}`);
            
            Object.keys(declaracionSaludCompleta.respuestas).forEach(integranteIndex => {
                const respuestasIntegrante = declaracionSaludCompleta.respuestas[integranteIndex];
                const preguntasRespondidas = Object.keys(respuestasIntegrante).length;
                console.log(`👤 Integrante ${integranteIndex}: ${preguntasRespondidas} preguntas respondidas`);
                
                // Mostrar respuestas "sí" para debug
                Object.keys(respuestasIntegrante).forEach(preguntaId => {
                    const respuesta = respuestasIntegrante[preguntaId];
                    if (respuesta.respuesta === 'si') {
                        console.log(`✅ RESPUESTA SÍ - Integrante ${integranteIndex}, Pregunta ${preguntaId}: ${respuesta.detalle}`);
                    }
                });
            });            

            console.log('📝 Ejecutando INSERT con parámetros:', {
                prospecto_id,
                cotizacion_id,
                numero_poliza,
                numero_poliza_oficial,
                pdf_hash,
                requiereAuditoriaMedica
            });

            const [result] = await db.query(query, [
                prospecto_id,
                cotizacion_id,
                numero_poliza,
                numero_poliza_oficial,
                pdf_hash,
                estado,
                requiereAuditoriaMedica, // ✅ NUEVO: Parámetro para auditoría médica
                'borrador',
                motivo_cambio_estado,
                JSON.stringify(form.datos_personales || {}),
                JSON.stringify(form.integrantes || []),
                JSON.stringify(form.documentos_titular || {}),
                JSON.stringify(form.documentos_integrantes || {}),
                JSON.stringify(form.referencias || []),
                JSON.stringify(declaracionSaludCompleta), // ✅ Incluye medicacion y cobertura
                JSON.stringify(form.saludTerminos?.coberturaAnterior || {}),
                JSON.stringify(form.saludTerminos?.datosAdicionales || {}),
                true,
                created_by
            ]);

            console.log('✅ Resultado de inserción:', { insertId: result.insertId, affectedRows: result.affectedRows });

            if (!result.insertId) {
                throw new Error('No se pudo obtener el ID de la póliza insertada. Resultado:', JSON.stringify(result));
            }

            return {
                id: result.insertId,
                numero_poliza,
                pdf_hash,
                success: true,
                estado: estado
            };
        } catch (error) {
            console.error("❌ Error al crear la póliza:", error);
            throw error;
        }
    },

    // Validar formulario completo
    validarFormularioCompleto(form) {
        const errores = [];

        console.log('🔍 Validando formulario completo:', JSON.stringify(form, null, 2));

        // Validar datos personales
        if (!form.datos_personales?.nombre) errores.push('Nombre requerido');
        if (!form.datos_personales?.apellido) errores.push('Apellido requerido');
        if (!form.datos_personales?.dni) errores.push('DNI requerido');
        if (!form.datos_personales?.cuil) errores.push('CUIL requerido');
        if (!form.datos_personales?.numero_poliza_vendedor) errores.push('Número de póliza oficial requerido');

        // Validar documentos del titular
        if (!form.documentos_titular?.dni_frente) errores.push('DNI frente del titular requerido');
        if (!form.documentos_titular?.dni_dorso) errores.push('DNI dorso del titular requerido');

        // Validar declaración de salud
        if (!form.saludTerminos) {
            errores.push('Sección de salud faltante');
        } else {
            console.log('🏥 saludTerminos encontrado:', form.saludTerminos);

            if (!form.saludTerminos.respuestas || Object.keys(form.saludTerminos.respuestas).length === 0) {
                errores.push('Declaración de salud incompleta - sin respuestas');
            }

            // ✅ CORREGIDO: Cobertura anterior y medicación SON OPCIONALES
            // No se valida su presencia, son campos opcionales que el usuario puede dejar vacíos
            console.log('🏥 Cobertura anterior (opcional):', form.saludTerminos.coberturaAnterior);
            console.log('🏥 Medicación (opcional):', form.saludTerminos.medicacion);
        }

        // Validar referencias
        if (!form.referencias || form.referencias.length === 0) {
            errores.push('Al menos una referencia personal requerida');
        }

        console.log('❌ Errores encontrados:', errores);

        return {
            valido: errores.length === 0,
            errores
        };
    },

    // Generar número de póliza único
    async generarNumeroPoliza() {
        const año = new Date().getFullYear();
        const mes = String(new Date().getMonth() + 1).padStart(2, '0');

        // Obtener el último número de póliza del mes
        const [rows] = await db.query(
            'SELECT numero_poliza FROM polizas WHERE numero_poliza LIKE ? ORDER BY id DESC LIMIT 1',
            [`COB-${año}${mes}-%`]
        );

        let numeroConsecutivo = 1;
        if (rows.length > 0) {
            const ultimoNumero = rows[0].numero_poliza.split('-').pop();
            numeroConsecutivo = parseInt(ultimoNumero) + 1;
        }

        return `COB-${año}${mes}-${String(numeroConsecutivo).padStart(4, '0')}`;
    },

    // Obtener póliza completa con todos los datos
    async obtenerCompleta(id) {
        console.log('🔍 Buscando póliza con ID:', id);

        const query = `
            SELECT 
                p.*,
                pr.nombre as prospecto_nombre,
                pr.apellido as prospecto_apellido,
                pr.correo as prospecto_email,
                pr.edad as prospecto_edad,
                pr.numero_contacto as prospecto_telefono,
                pr.localidad as prospecto_localidad,
                pr.tipo_afiliacion_id,
                ta.etiqueta as tipo_afiliacion_nombre,
                c.total_final,
                c.total_bruto,
                c.total_descuento_aporte,
                c.total_descuento_promocion,
                pl.nombre as plan_nombre
            FROM polizas p
            LEFT JOIN prospectos pr ON p.prospecto_id = pr.id
            LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
            LEFT JOIN planes pl ON c.plan_id = pl.id
            LEFT JOIN tipos_afiliacion ta ON pr.tipo_afiliacion_id = ta.id
            WHERE p.id = ?
        `;

        try {
            console.log('🔍 Ejecutando consulta SQL para póliza ID:', id);

            const [rows] = await db.query(query, [id]);

            console.log(`📊 Consulta ejecutada. Resultados: ${rows.length}`);

            if (rows.length === 0) {
                console.log('❌ No se encontró póliza con ID:', id);

                // Debug: verificar si la póliza existe sin JOINs
                const [polizaBasica] = await db.query('SELECT id, numero_poliza FROM polizas WHERE id = ?', [id]);
                console.log('🔍 Póliza básica encontrada:', polizaBasica);

                throw new Error('Póliza no encontrada');
            }

            const poliza = rows[0];
            console.log('✅ Póliza encontrada:', poliza.numero_poliza);

            // Parsear campos JSON
            try {
                if (typeof poliza.datos_personales === 'string') {
                    poliza.datos_personales = JSON.parse(poliza.datos_personales);
                }
                if (typeof poliza.integrantes === 'string') {
                    poliza.integrantes = JSON.parse(poliza.integrantes);
                }
                if (typeof poliza.referencias === 'string') {
                    poliza.referencias = JSON.parse(poliza.referencias);
                }
                if (typeof poliza.declaracion_salud === 'string') {
                    poliza.declaracion_salud = JSON.parse(poliza.declaracion_salud);
                    console.log('🔍 DEBUG - declaracion_salud parseada:', JSON.stringify(poliza.declaracion_salud, null, 2));
                    
                    // Debug específico de respuestas
                    if (poliza.declaracion_salud.respuestas) {
                        console.log('📋 Respuestas encontradas en BD:', Object.keys(poliza.declaracion_salud.respuestas));
                        Object.keys(poliza.declaracion_salud.respuestas).forEach(integranteIndex => {
                            const respuestasIntegrante = poliza.declaracion_salud.respuestas[integranteIndex];
                            const respuestasSi = Object.keys(respuestasIntegrante).filter(
                                preguntaId => respuestasIntegrante[preguntaId].respuesta === 'si'
                            );
                            if (respuestasSi.length > 0) {
                                console.log(`✅ Integrante ${integranteIndex} - Respuestas SÍ:`, respuestasSi);
                            }
                        });
                    }
                }
                if (typeof poliza.documentos_titular === 'string') {
                    poliza.documentos_titular = JSON.parse(poliza.documentos_titular);
                }
                if (typeof poliza.documentos_integrantes === 'string') {
                    poliza.documentos_integrantes = JSON.parse(poliza.documentos_integrantes);
                }
                if (typeof poliza.cobertura_anterior === 'string') {
                    poliza.cobertura_anterior = JSON.parse(poliza.cobertura_anterior);
                }
                if (typeof poliza.datos_adicionales === 'string') {
                    poliza.datos_adicionales = JSON.parse(poliza.datos_adicionales);
                }
                if (typeof poliza.informacion_afiliado === 'string') {
                    poliza.informacion_afiliado = JSON.parse(poliza.informacion_afiliado);
                }
                if (typeof poliza.informacion_facturacion === 'string') {
                    poliza.informacion_facturacion = JSON.parse(poliza.informacion_facturacion);
                }
                if (typeof poliza.solicitud_afiliacion === 'string') {
                    poliza.solicitud_afiliacion = JSON.parse(poliza.solicitud_afiliacion);
                }
                if (typeof poliza.datos_comerciales === 'string') {
                    poliza.datos_comerciales = JSON.parse(poliza.datos_comerciales);
                }
            } catch (parseError) {
                console.error('Error parseando JSON:', parseError);
            }

            return poliza;

        } catch (error) {
            console.error("❌ Error en obtenerCompleta:", error);
            throw error;
        }
    },

    // Obtener póliza por hash del PDF
    async obtenerPorHash(hash) {
        console.log('🔍 Buscando póliza con hash:', hash);

        const query = `
            SELECT 
                p.*,
                pr.nombre as prospecto_nombre,
                pr.apellido as prospecto_apellido,
                pr.correo as prospecto_email,
                pr.edad as prospecto_edad,
                pr.numero_contacto as prospecto_telefono,
                pr.localidad as prospecto_localidad,
                pr.tipo_afiliacion_id,
                ta.etiqueta as tipo_afiliacion_nombre,
                c.total_final,
                c.total_bruto,
                c.total_descuento_aporte,
                c.total_descuento_promocion,
                pl.nombre as plan_nombre
            FROM polizas p
            LEFT JOIN prospectos pr ON p.prospecto_id = pr.id
            LEFT JOIN cotizaciones c ON p.cotizacion_id = c.id
            LEFT JOIN planes pl ON c.plan_id = pl.id
            LEFT JOIN tipos_afiliacion ta ON pr.tipo_afiliacion_id = ta.id
            WHERE p.pdf_hash = ?
        `;

        try {
            const [rows] = await db.query(query, [hash]);

            if (rows.length === 0) {
                console.log('❌ No se encontró póliza con hash:', hash);
                return null;
            }

            const poliza = rows[0];
            console.log('✅ Póliza encontrada por hash:', poliza.numero_poliza);

            // Parsear campos JSON (mismo código que obtenerCompleta)
            try {
                if (typeof poliza.datos_personales === 'string') {
                    poliza.datos_personales = JSON.parse(poliza.datos_personales);
                }
                if (typeof poliza.integrantes === 'string') {
                    poliza.integrantes = JSON.parse(poliza.integrantes);
                }
                if (typeof poliza.referencias === 'string') {
                    poliza.referencias = JSON.parse(poliza.referencias);
                }
                if (typeof poliza.declaracion_salud === 'string') {
                    poliza.declaracion_salud = JSON.parse(poliza.declaracion_salud);
                }
                if (typeof poliza.documentos_titular === 'string') {
                    poliza.documentos_titular = JSON.parse(poliza.documentos_titular);
                }
                if (typeof poliza.documentos_integrantes === 'string') {
                    poliza.documentos_integrantes = JSON.parse(poliza.documentos_integrantes);
                }
                if (typeof poliza.cobertura_anterior === 'string') {
                    poliza.cobertura_anterior = JSON.parse(poliza.cobertura_anterior);
                }
                if (typeof poliza.datos_adicionales === 'string') {
                    poliza.datos_adicionales = JSON.parse(poliza.datos_adicionales);
                }
                if (typeof poliza.informacion_afiliado === 'string') {
                    poliza.informacion_afiliado = JSON.parse(poliza.informacion_afiliado);
                }
                if (typeof poliza.informacion_facturacion === 'string') {
                    poliza.informacion_facturacion = JSON.parse(poliza.informacion_facturacion);
                }
                if (typeof poliza.solicitud_afiliacion === 'string') {
                    poliza.solicitud_afiliacion = JSON.parse(poliza.solicitud_afiliacion);
                }
                if (typeof poliza.datos_comerciales === 'string') {
                    poliza.datos_comerciales = JSON.parse(poliza.datos_comerciales);
                }
            } catch (parseError) {
                console.error('Error parseando JSON:', parseError);
            }

            return poliza;

        } catch (error) {
            console.error("❌ Error en obtenerPorHash:", error);
            throw error;
        }
    },

    // Obtener detalles de cotización
    async obtenerDetallesCotizacion(cotizacion_id) {
        const query = `
            SELECT 
                cd.*,
                ta.nombre as tipo_afiliacion_nombre,
                (
                    SELECT f.categoria_monotributo
                    FROM familiares f
                    WHERE f.nombre = cd.persona
                      AND f.prospecto_id = (SELECT prospecto_id FROM cotizaciones WHERE id = ?)
                    LIMIT 1
                ) as categoria_monotributo
            FROM cotizaciones_detalles cd
            LEFT JOIN tipos_afiliacion ta ON cd.tipo_afiliacion_id = ta.id
            WHERE cd.cotizacion_id = ?
            ORDER BY cd.vinculo = 'Titular' DESC, cd.vinculo
        `;

        try {
            const [rows] = await db.query(query, [cotizacion_id, cotizacion_id]);
            return rows;
        } catch (error) {
            console.error("Error al obtener detalles de la cotización:", error);
            throw error;
        }
    },

    // ✅ NUEVO MÉTODO PARA ACTUALIZAR ESTADO
    async actualizarEstado(polizaId, estadoData) {
        try {
            const query = `
                UPDATE polizas 
                SET 
                  estado = ?,
                  estado_anterior = ?,
                  motivo_cambio_estado = ?,
                  fecha_cambio_estado = NOW(),
                  revisado_por = ?,
                  fecha_revision = ?
                WHERE id = ?
            `;

            const valores = [
                estadoData.estado,
                estadoData.estado_anterior,
                estadoData.motivo_cambio_estado,
                estadoData.revisado_por || null,
                estadoData.fecha_revision || new Date(),
                polizaId
            ];

            const [result] = await db.execute(query, valores);
            return result.affectedRows > 0;

        } catch (error) {
            console.error('❌ Error actualizando estado:', error);
            throw error;
        }
    },

    // ✅ MÉTODO PARA REGISTRAR HISTORIAL DE CAMBIOS DE ESTADO
    async registrarCambioEstado(polizaId, cambioData) {
        try {
            const query = `
                INSERT INTO poliza_estados_historial 
                (poliza_id, estado_anterior, estado_nuevo, motivo, changed_by, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            `;

            await db.execute(query, [
                polizaId,
                cambioData.estado_anterior,
                cambioData.estado_nuevo,
                cambioData.motivo,
                cambioData.user_id
            ]);

        } catch (error) {
            console.error('Error registrando historial de estado:', error);
            // No lanzar error para no interrumpir el flujo principal
        }
    },

    // ✅ NUEVO: Verificar si ya existe una póliza para una cotización específica
    async verificarPolizaExistente(prospecto_id, cotizacion_id) {
        try {
            const query = `
                SELECT id, numero_poliza, estado, created_at
                FROM polizas 
                WHERE prospecto_id = ? AND cotizacion_id = ?
                AND deleted_at IS NULL
                LIMIT 1
            `;

            const [rows] = await db.execute(query, [prospecto_id, cotizacion_id]);
            
            console.log(`🔍 Verificando póliza existente - Prospecto: ${prospecto_id}, Cotización: ${cotizacion_id}`);
            console.log(`📊 Resultado: ${rows.length > 0 ? 'EXISTE' : 'NO EXISTE'}`);
            
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error verificando póliza existente:', error);
            return null;
        }
    },

    // ✅ NUEVO: Verificar si ya existe el número de póliza oficial EN OTRO PROSPECTO
    async verificarNumeroPolizaOficialExistente(numero_poliza_oficial, prospecto_id_actual) {
        try {
            const query = `
                SELECT id, numero_poliza, prospecto_id, estado, created_at
                FROM polizas 
                WHERE numero_poliza_oficial = ? 
                AND prospecto_id != ?
                AND estado != 'eliminada'
                LIMIT 1
            `;

            const [rows] = await db.execute(query, [numero_poliza_oficial, prospecto_id_actual]);
            
            console.log(`🔍 Verificando número de póliza oficial "${numero_poliza_oficial}" - Excluyendo prospecto: ${prospecto_id_actual}`);
            console.log(`📊 Resultado: ${rows.length > 0 ? 'EXISTE EN OTRO PROSPECTO' : 'NO EXISTE EN OTROS PROSPECTOS'}`);
            
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Error verificando número de póliza oficial:', error);
            return null;
        }
    },
};

module.exports = PolizaModel;