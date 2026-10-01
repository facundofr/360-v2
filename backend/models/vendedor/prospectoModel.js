const db = require('../../config/db');
const validator = require('validator');
const RefritosVisibilityService = require('../../services/RefritosVisibilityService');
const { scoreLead } = require('../../services/leadScoringService');

// Función de validación para datos de prospecto
function validarDatosProspecto(data) {
    const errores = [];
    if (!data.nombre || typeof data.nombre !== 'string' || data.nombre.length < 2 || data.nombre.length > 100 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(data.nombre)) {
        errores.push("El nombre debe tener entre 2 y 100 caracteres y contener solo letras.");
    }
    if (!data.apellido || typeof data.apellido !== 'string' || data.apellido.length < 2 || data.apellido.length > 100 || !/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(data.apellido)) {
        errores.push("El apellido debe tener entre 2 y 100 caracteres y contener solo letras.");
    }
    if (data.edad !== undefined && data.edad !== null && data.edad !== '') {
        if (!validator.isInt(data.edad.toString(), { min: 0, max: 120 })) {
            errores.push("La edad debe ser un número entero entre 0 y 120.");
        }
    }
    if (data.tipo_afiliacion_id !== undefined && data.tipo_afiliacion_id !== null && data.tipo_afiliacion_id !== '') {
        if (!validator.isInt(data.tipo_afiliacion_id.toString(), { min: 1, max: 10 })) {
            errores.push("El tipo de afiliación seleccionado no es válido.");
        }
    }
    if (data.numero_contacto && !/^[\d\s\(\)\+\-]{8,20}$/.test(data.numero_contacto)) {
        errores.push("El formato del número de contacto es inválido. Debe contener entre 8 y 20 caracteres numéricos.");
    }
    if (data.correo && !validator.isEmail(data.correo)) {
        errores.push("El formato del correo electrónico es inválido.");
    }
    if (data.localidad && (data.localidad.length < 2 || data.localidad.length > 100)) {
        errores.push("La localidad debe tener entre 2 y 100 caracteres.");
    }
    if (data.sueldo_bruto !== undefined && data.sueldo_bruto !== null && data.sueldo_bruto !== '') {
        if (!validator.isFloat(data.sueldo_bruto.toString(), { min: 0, max: 10000000 })) {
            errores.push("El sueldo bruto debe ser un número positivo menor a 10,000,000.");
        }
    }
    if (data.categoria_monotributo) {
        const categoriasValidas = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "A exento", "B exento"];
        if (!categoriasValidas.includes(data.categoria_monotributo)) {
            errores.push("La categoría de monotributo seleccionada no es válida.");
        }
    }
    return errores;
}

const Prospecto = {
    async create(data) {
        // Validar antes de insertar
        const errores = validarDatosProspecto(data);
        if (errores.length > 0) {
            const err = new Error("Error de validación");
            err.errores = errores;
            throw err;
        }

        const query = `
            INSERT INTO prospectos (
                nombre, apellido, dni, edad, tipo_afiliacion_id, grupo_familiar, 
                numero_contacto, correo, localidad, sueldo_bruto, categoria_monotributo, origen
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await db.query(query, [
            validator.escape(data.nombre || ""),
            validator.escape(data.apellido || ""),
            data.dni ? validator.escape(data.dni.trim()) : null,
            (data.edad !== null && data.edad !== undefined && data.edad !== '') ? data.edad : null,
            data.tipo_afiliacion_id || null,
            data.grupo_familiar || null,
            validator.escape(data.numero_contacto || ""),
            data.correo ? validator.normalizeEmail(data.correo) : "",
            validator.escape(data.localidad || ""),
            data.sueldo_bruto || null,
            data.categoria_monotributo || null,
            data.origen || 'Formulario Web' // ✅ Agregar origen
        ]);
        return result;
    },

    async findAll(vendedor_id) {
        // Si el vendedor quedó sin refrito visible en Lead (cola trabada), promover el siguiente
        await RefritosVisibilityService.asegurarRefritoVisible(vendedor_id);

        const query = `
            SELECT p.*, MAX(a.id) as id_asignacion, a.estado, a.comentario, a.visible_refrito, a.fecha_estado, pec.canal as preferencia_contacto,
                   p.gecros_estado, p.gecros_consultado_at, p.estado AS estado_prospecto
            FROM prospectos p
            LEFT JOIN asignaciones a ON a.id_prospecto = p.id AND a.id_vendedor = ?
            LEFT JOIN preferencias_entrega_cotizacion pec ON pec.prospecto_id = p.id
            WHERE a.id_vendedor = ?
            AND (
                (p.es_reciclado = 0) OR 
                (p.es_reciclado = 1 AND (
                    (a.visible_refrito = 1 AND a.estado = 'Lead') OR 
                    a.estado NOT IN ('Lead', 'No contesta')
                ))
            )
            GROUP BY p.id
            ORDER BY COALESCE(p.fecha_hora_registro, p.fecha_registro) DESC, p.id DESC
        `;
        const [rows] = await db.query(query, [vendedor_id, vendedor_id]);

        // Para cada prospecto, traer sus familiares y calcular calidad
        for (const prospecto of rows) {
            const [familiares] = await db.query(
                'SELECT * FROM familiares WHERE prospecto_id = ?',
                [prospecto.id]
            );
            prospecto.familiares = familiares;

            // Calcular scoring de calidad del prospecto
            const scoring = scoreLead(prospecto);
            prospecto.calidad_prospecto = scoring.calidad_prospecto;
            prospecto.calidad_categoria = scoring.calidad_categoria;
            prospecto.calidad_detalle = scoring.calidad_detalle;
            prospecto.calidad_override = scoring.calidad_override || null;
        }

        return rows;
    },

    async findById(id, vendedor_id) {
        const query = `
            SELECT p.*, a.estado, a.comentario, pec.canal as preferencia_contacto, p.estado AS estado_prospecto
            FROM prospectos p
            LEFT JOIN asignaciones a ON a.id_prospecto = p.id AND a.id_vendedor = ?
            LEFT JOIN preferencias_entrega_cotizacion pec ON pec.prospecto_id = p.id
            WHERE p.id = ? AND (a.id_vendedor = ? OR a.id_vendedor IS NULL)
        `;
        const [rows] = await db.query(query, [vendedor_id, id, vendedor_id]);
        const prospecto = rows[0];
        if (prospecto) {
            const [familiares] = await db.query(
                'SELECT * FROM familiares WHERE prospecto_id = ?',
                [prospecto.id]
            );
            prospecto.familiares = familiares;

            // Calcular scoring de calidad del prospecto
            const scoring = scoreLead(prospecto);
            prospecto.calidad_prospecto = scoring.calidad_prospecto;
            prospecto.calidad_categoria = scoring.calidad_categoria;
            prospecto.calidad_detalle = scoring.calidad_detalle;
            prospecto.calidad_override = scoring.calidad_override || null;
        }
        return prospecto;
    },

    async update(id, vendedor_id, data) {
        // Validar antes de actualizar
        const errores = validarDatosProspecto(data);
        if (errores.length > 0) {
            const err = new Error("Error de validación");
            err.errores = errores;
            throw err;
        }

        await db.query('START TRANSACTION');
        try {
            // Bloquear el prospecto para la actualización
            const [checkProspecto] = await db.query(`
                SELECT id FROM prospectos 
                WHERE id = ? AND id IN (
                    SELECT id_prospecto FROM asignaciones WHERE id_vendedor = ?
                )
                FOR UPDATE
            `, [id, vendedor_id]);
            
            if (checkProspecto.length === 0) {
                await db.query('ROLLBACK');
                // 🔁 Distinguible de un 404 real: el prospecto puede existir pero haber sido
                // reasignado a otro vendedor (ej. ReasignacionAutomaticaJob) entre que el
                // usuario abrió el lead y guardó. El controller usa este code para avisar
                // explícitamente en vez de fallar en silencio (ver auditoría 2026-08-20).
                const err = new Error("Prospecto no encontrado o no autorizado.");
                err.code = "PROSPECTO_NOT_OWNED";
                throw err;
            }

            const query = `
                UPDATE prospectos
                SET nombre = ?, apellido = ?, dni = ?, edad = ?, tipo_afiliacion_id = ?, grupo_familiar = ?,
                    numero_contacto = ?, correo = ?, localidad = ?, sueldo_bruto = ?, categoria_monotributo = ?
                WHERE id = ?
            `;
            
            await db.query(query, [
                validator.escape(data.nombre || ""),
                validator.escape(data.apellido || ""),
                data.dni ? validator.escape(data.dni.trim()) : null,
                (data.edad !== null && data.edad !== undefined && data.edad !== '') ? data.edad : null,
                data.tipo_afiliacion_id || null,
                data.grupo_familiar || null,
                validator.escape(data.numero_contacto || ""),
                data.correo ? validator.normalizeEmail(data.correo) : "",
                validator.escape(data.localidad || ""),
                data.sueldo_bruto || null,
                data.categoria_monotributo || null,
                id
            ]);
            
            // 👨‍👩‍👧‍👦 ACTUALIZAR FAMILIARES si se envía la array
            if (Array.isArray(data.familiares)) {
                // 1. Eliminar todos los familiares existentes
                await db.query('DELETE FROM familiares WHERE prospecto_id = ?', [id]);
                
                // 2. Insertar los nuevos familiares
                for (const familiar of data.familiares) {
                    // Solo procesar si tiene datos válidos
                    if (familiar.nombre && familiar.nombre.trim()) {
                        // ✅ Asignar tipo_afiliacion_id = 1 (Particular/autónomo) por defecto para hijo/a y familiar_a_cargo
                        let tipoAfiliacion = familiar.tipo_afiliacion_id || null;
                        if ((familiar.vinculo === "hijo/a" || familiar.vinculo === "familiar a cargo") && !tipoAfiliacion) {
                            tipoAfiliacion = 1; // Particular/autónomo por defecto
                        }
                        
                        await db.query(
                            `INSERT INTO familiares 
                                (prospecto_id, vinculo, nombre, edad, tipo_afiliacion_id, sueldo_bruto, categoria_monotributo)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [
                                id,
                                familiar.vinculo || null,
                                validator.escape(familiar.nombre.trim()),
                                (familiar.edad !== null && familiar.edad !== undefined && familiar.edad !== '') ? familiar.edad : null,
                                tipoAfiliacion,
                                familiar.sueldo_bruto || null,
                                familiar.categoria_monotributo || null
                            ]
                        );
                    }
                }
            }
            
            await db.query('COMMIT');
            return { affectedRows: 1 };
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }
    },

    // Nuevo método: actualiza estado y comentario en asignaciones
    async updateAsignacion(id, vendedor_id, estado, comentario) {
        await db.query('START TRANSACTION');
        
        try {
            // Bloquear la asignación para la actualización
            const [checkAsignacion] = await db.query(`
                SELECT id FROM asignaciones
                WHERE id_prospecto = ? AND id_vendedor = ?
                FOR UPDATE
            `, [id, vendedor_id]);
            
            if (checkAsignacion.length === 0) {
                await db.query('ROLLBACK');
                const err = new Error("Asignación no encontrada");
                err.code = "PROSPECTO_NOT_OWNED";
                throw err;
            }
            
            const query = `
                UPDATE asignaciones
                SET estado = ?, comentario = ?, fecha_estado = NOW()
                WHERE id_prospecto = ? AND id_vendedor = ?
            `;
            
            await db.query(query, [
                estado,
                comentario,
                id,
                vendedor_id
            ]);
            
            await db.query('COMMIT');

            // 🔄 HOOK: Ejecutar lógica de refritos si aplica
            try {
                await RefritosVisibilityService.onCambioEstadoProspecto(id, estado, vendedor_id);
            } catch (error) {
                console.error('Error en hook de refritos:', error);
                // No lanzar error para no bloquear el flujo
            }
            
            return { affectedRows: 1 };
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }
    },

    // async delete(id, vendedor_id) {
    //     const query = `
    //         DELETE FROM prospectos 
    //         WHERE id = ? AND id IN (
    //             SELECT id_prospecto FROM asignaciones WHERE id_vendedor = ?
    //         )
    //     `;
    //     const [result] = await db.query(query, [id, vendedor_id]);
    //     return result;
    // },

    async createFamiliares(prospectoId, familiares) {
        for (const familiar of familiares) {
            // Regla de negocio: hijo/a se cubre como HIJO hasta los 25 años inclusive (25 años y 11 meses)
            if (familiar.vinculo === "hijo/a" && familiar.edad !== null && familiar.edad !== undefined && familiar.edad !== '' && Number(familiar.edad) > 25) {
                throw new Error('Un hijo/a puede tener hasta 25 años inclusive. Para mayores de 25 años, use el vínculo "familiar a cargo".');
            }
            // Determinar tipo_afiliacion_id: usar el provisto o defaultear a 1 (Particular) para hijo/a y familiar a cargo
            let tipoAfiliacion = familiar.tipo_afiliacion_id || null;
            if ((familiar.vinculo === "hijo/a" || familiar.vinculo === "familiar a cargo") && !tipoAfiliacion) {
                tipoAfiliacion = 1; // Particular/autónomo por defecto
            }

            await db.query(
                `INSERT INTO familiares 
                    (prospecto_id, vinculo, nombre, edad, tipo_afiliacion_id, sueldo_bruto, categoria_monotributo)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    prospectoId,
                    familiar.vinculo,
                    familiar.nombre,
                    (familiar.edad !== null && familiar.edad !== undefined && familiar.edad !== '') ? familiar.edad : null,
                    tipoAfiliacion,
                    familiar.vinculo === "pareja/conyuge" ? familiar.sueldo_bruto || null : null,
                    familiar.vinculo === "pareja/conyuge" ? familiar.categoria_monotributo || null : null
                ]
            );
        }
    }
};

module.exports = Prospecto;