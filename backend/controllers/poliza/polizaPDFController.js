const PolizaModel = require('../../models/poliza/polizaModel');
const fs = require('fs');
const path = require('path');

// ─── Escape de HTML para el PDF ──────────────────────────────────────────────
// El PDF se arma interpolando valores en un template de HTML que luego renderiza
// puppeteer con --no-sandbox y --disable-web-security, así que un valor con markup
// no es un problema estético: ejecuta en el servidor.
//
// No todas las fuentes validan formato antes de guardar. El formulario web exige
// /^[a-zA-Z áéíóúüñ]+$/ en nombre y apellido, pero el alta en frío por WhatsApp
// guarda el ProfileName tal como lo puso el usuario en su teléfono, y la carga
// manual del vendedor tampoco lo restringe. Por eso se escapa en el render, que
// es el único punto por el que pasan todas las fuentes.
const MAPA_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escaparHTML(valor) {
  return String(valor).replace(/[&<>"']/g, (c) => MAPA_ESCAPE[c]);
}

// Escapa en profundidad conservando el tipo de todo lo que no sea string:
// las fechas se siguen formateando con getDate()/toLocaleDateString() aguas abajo
// y los números entran en cálculos, así que solo se tocan los strings.
function escaparProfundo(valor) {
  if (typeof valor === 'string') return escaparHTML(valor);
  if (valor === null || typeof valor !== 'object') return valor;
  if (valor instanceof Date || Buffer.isBuffer(valor)) return valor;
  if (Array.isArray(valor)) return valor.map(escaparProfundo);
  const salida = {};
  for (const [k, v] of Object.entries(valor)) salida[k] = escaparProfundo(v);
  return salida;
}

// Cache para imagen base64 - lazy loading para evitar memory leak
let imageBase64Cache = null;

// Función para convertir imagen a base64 con cache
function getImageBase64() {
  if (imageBase64Cache !== null) {
    return imageBase64Cache;
  }
  
  try {
    const imagePath = path.join(__dirname, '../../utils/img/logocoberpyme.png');
    const imageData = fs.readFileSync(imagePath);
    imageBase64Cache = `data:image/png;base64,${imageData.toString('base64')}`;
    console.log('🖼️ Imagen logo cargada en cache (tamaño:', imageData.length, 'bytes)');
    return imageBase64Cache;
  } catch (error) {
    console.log('❌ Error cargando imagen:', error.message);
    imageBase64Cache = ''; // Cache el error también
    return '';
  }
}

const PolizaPDFController = {
  async descargar(req, res) {
    try {
      const { id } = req.params;

      console.log('📄 Iniciando generación de PDF para póliza ID:', id);

      const poliza = await PolizaModel.obtenerCompleta(id);

      if (!poliza) {
        console.log('❌ Póliza no encontrada');
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }

      // ←––– AGREGAR ESTAS LÍNEAS ↓↓↓
      // Obtener los detalles de la cotización y agregarlos al objeto 'póliza'
      if (poliza.cotizacion_id) {
        const detallesCotizacion = await PolizaModel.obtenerDetallesCotizacion(poliza.cotizacion_id);
        poliza.detalles = detallesCotizacion || [];
      } else {
        poliza.detalles = [];
      }
      // ←––– FIN DE LA ADICIÓN

      console.log('✅ Póliza encontrada:', poliza.numero_poliza_oficial || poliza.numero_poliza);

      // ✅ VERIFICAR SI PUPPETEER ESTÁ DISPONIBLE
      let puppeteer;
      try {
        puppeteer = require('puppeteer');
        console.log('✅ Puppeteer disponible');
      } catch (puppeteerError) {
        console.error('❌ Puppeteer no disponible:', puppeteerError.message);
        return await PolizaPDFController.generarPDFAlternativo(req, res, poliza);
      }

      // ✅ PARSEAR DATOS
      const datosParseados = PolizaPDFController.parsearDatosPoliza(poliza);
      console.log('✅ Datos parseados correctamente:', {
        datos_personales: !!datosParseados.datosPersonales,
        integrantes_count: datosParseados.integrantes?.length || 0,
        referencias_count: datosParseados.referencias?.length || 0,
        declaracion_salud: !!datosParseados.declaracionSalud
      });

      // ✅ GENERAR HTML PROFESIONAL PARA PDF
      const htmlContent = PolizaPDFController.generarHTMLProfesionalParaPDF(poliza, datosParseados);
      console.log('✅ HTML profesional generado, longitud:', htmlContent.length);

      console.log('🚀 Iniciando Puppeteer...');

      // ✅ CONFIGURACIÓN PUPPETEER OPTIMIZADA
      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images'
        ],
        timeout: 30000
      });

      console.log('✅ Browser iniciado');

      const page = await browser.newPage();

      // ✅ CONFIGURAR PÁGINA PARA PDF
      await page.setViewport({ width: 1200, height: 1600 });
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      console.log('✅ Contenido HTML cargado');

      // ✅ GENERAR PDF CON CONFIGURACIÓN CORRECTA
      console.log('📄 Generando PDF binario...');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        margin: {
          top: '15mm',
          right: '10mm',
          bottom: '15mm', // Más espacio para el número de página
          left: '10mm'
        },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
            <div style="font-size: 8px; width: 100%; text-align: right; padding-right: 10mm; color: #666;">
                <span class="pageNumber"></span> / <span class="totalPages"></span>
            </div>
        `
      });

      await browser.close();
      console.log('✅ Browser cerrado');

      // ✅ VERIFICAR QUE EL PDF NO ESTÉ VACÍO
      if (!pdfBuffer || pdfBuffer.length === 0) {
        console.error('❌ PDF buffer está vacío');
        throw new Error('PDF generado está vacío');
      }

      console.log('✅ PDF generado exitosamente. Tamaño:', pdfBuffer.length, 'bytes');

      // ✅ ENVIAR PDF CON HEADERS CORRECTOS
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Poliza-${poliza.numero_poliza_oficial || poliza.numero_poliza || id}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.end(pdfBuffer);
      console.log('✅ PDF profesional enviado al cliente exitosamente');

    } catch (error) {
      console.error('❌ Error completo generando PDF:', {
        message: error.message,
        stack: error.stack,
        poliza_id: req.params.id
      });

      return await PolizaPDFController.generarPDFAlternativo(req, res);
    }
  },

  // ✅ MÉTODO ALTERNATIVO (sin cambios)
  async generarPDFAlternativo(req, res, poliza = null) {
    try {
      console.log('🔄 Generando PDF con método alternativo...');

      if (!poliza) {
        const { id } = req.params;
        poliza = await PolizaModel.obtenerCompleta(id);
      }

      if (!poliza) {
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }

      let htmlPdf;
      try {
        htmlPdf = require('html-pdf-node');
        console.log('✅ html-pdf-node disponible');
      } catch (error) {
        return res.status(500).json({
          error: 'PDF no disponible',
          message: 'El servicio de generación de PDF está temporalmente fuera de servicio'
        });
      }

      const datosParseados = PolizaPDFController.parsearDatosPoliza(poliza);
      const htmlContent = PolizaPDFController.generarHTMLProfesionalParaPDF(poliza, datosParseados);

      const options = {
        format: 'A4',
        border: {
          top: "10mm",
          right: "10mm",
          bottom: "10mm",
          left: "10mm"
        }
      };

      const file = { content: htmlContent };
      const pdfBuffer = await htmlPdf.generatePdf(file, options);

      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('PDF alternativo generado está vacío');
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Poliza-${poliza.numero_poliza_oficial || poliza.numero_poliza || 'temp'}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.end(pdfBuffer);
      console.log('✅ PDF alternativo profesional enviado exitosamente');

    } catch (error) {
      console.error('❌ Error en PDF alternativo:', error);
      res.status(500).json({
        error: 'Error generando PDF alternativo',
        message: error.message
      });
    }
  },

  // ✅ NUEVO MÉTODO: Descargar PDF por hash
  async descargarPorHash(req, res) {
    try {
      const { hash } = req.params;

      console.log('📄 Iniciando generación de PDF para póliza hash:', hash);

      const poliza = await PolizaModel.obtenerPorHash(hash);

      if (!poliza) {
        console.log('❌ Póliza no encontrada con hash:', hash);
        return res.status(404).json({ error: 'Póliza no encontrada' });
      }

      // Obtener los detalles de la cotización y agregarlos al objeto 'poliza'
      if (poliza.cotizacion_id) {
        const detallesCotizacion = await PolizaModel.obtenerDetallesCotizacion(poliza.cotizacion_id);
        poliza.detalles = detallesCotizacion || [];
      } else {
        poliza.detalles = [];
      }

      console.log('✅ Póliza encontrada por hash:', poliza.numero_poliza_oficial || poliza.numero_poliza);

      // ✅ VERIFICAR SI PUPPETEER ESTÁ DISPONIBLE
      let puppeteer;
      try {
        puppeteer = require('puppeteer');
        console.log('✅ Puppeteer disponible');
      } catch (puppeteerError) {
        console.error('❌ Puppeteer no disponible:', puppeteerError.message);
        return await PolizaPDFController.generarPDFAlternativo(req, res, poliza);
      }

      // ✅ PARSEAR DATOS
      const datosParseados = PolizaPDFController.parsearDatosPoliza(poliza);
      console.log('✅ Datos parseados correctamente:', {
        datos_personales: !!datosParseados.datosPersonales,
        integrantes_count: datosParseados.integrantes?.length || 0,
        referencias_count: datosParseados.referencias?.length || 0,
        declaracion_salud: !!datosParseados.declaracionSalud
      });

      // ✅ GENERAR HTML PROFESIONAL PARA PDF
      const htmlContent = PolizaPDFController.generarHTMLProfesionalParaPDF(poliza, datosParseados);
      console.log('✅ HTML profesional generado, longitud:', htmlContent.length);

      console.log('🚀 Iniciando Puppeteer...');

      // ✅ CONFIGURACIÓN PUPPETEER OPTIMIZADA
      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images'
        ],
        timeout: 30000
      });

      console.log('✅ Browser iniciado');

      const page = await browser.newPage();

      // ✅ CONFIGURAR PÁGINA PARA PDF
      await page.setViewport({ width: 1200, height: 1600 });
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      console.log('✅ Contenido HTML cargado');

      // ✅ GENERAR PDF CON CONFIGURACIÓN CORRECTA
      console.log('📄 Generando PDF binario...');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        margin: {
          top: '15mm',
          right: '10mm',
          bottom: '15mm', // Más espacio para el número de página
          left: '10mm'
        },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
            <div style="font-size: 8px; width: 100%; text-align: right; padding-right: 10mm; color: #666;">
                <span class="pageNumber"></span> / <span class="totalPages"></span>
            </div>
        `
      });

      await browser.close();
      console.log('✅ Browser cerrado');

      // ✅ VERIFICAR QUE EL PDF NO ESTÉ VACÍO
      if (!pdfBuffer || pdfBuffer.length === 0) {
        console.error('❌ PDF buffer está vacío');
        throw new Error('PDF generado está vacío');
      }

      console.log('✅ PDF generado exitosamente. Tamaño:', pdfBuffer.length, 'bytes');

      // ✅ ENVIAR PDF CON HEADERS CORRECTOS
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Poliza-${poliza.numero_poliza_oficial || poliza.numero_poliza || hash}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.end(pdfBuffer);
      console.log('✅ PDF profesional enviado al cliente exitosamente');

    } catch (error) {
      console.error('❌ Error completo generando PDF por hash:', {
        message: error.message,
        stack: error.stack,
        hash: req.params.hash
      });

      return await PolizaPDFController.generarPDFAlternativo(req, res);
    }
  },

  // ✅ NUEVO: HTML PROFESIONAL CON DISEÑO CORPORATIVO COMPLETO
  generarHTMLProfesionalParaPDF(polizaCruda, datosCrudos) {
    // Único punto por el que pasan las tres entradas de PDF (generarPDF,
    // generarPDFAlternativo y generarPDFParaFirma): se escapa acá, una sola vez,
    // antes de que cualquier valor toque el template. Ver escaparProfundo arriba.
    const poliza = escaparProfundo(polizaCruda);
    const { datosPersonales, referencias, declaracionSalud, integrantes, detalles } = escaparProfundo(datosCrudos);

    // Generar imagen en base64 para embedirla directamente
    const logoBase64 = getImageBase64();
    
    const mostrarDato = (valor, fallback = 'No especificado') => {
      return valor && valor.toString().trim() ? valor : fallback;
    };

    // ✅ FUNCIÓN PARA INVERTIR FORMATO DE MES (2025-11 → 11-2025)
    const formatearMesIngreso = (mesIngreso) => {
      if (!mesIngreso) return '';
      const trimmed = mesIngreso.toString().trim();
      // Si está en formato YYYY-MM, invertir a MM-YYYY
      if (trimmed.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = trimmed.split('-');
        return `${month}-${year}`;
      }
      // Si ya está en otro formato, retornar como está
      return trimmed;
    };

    // ✅ FUNCIÓN PARA FORMATEAR FECHAS A FORMATO dd/mm/yyyy (sin problemas de zona horaria)
    const formatearFecha = (fecha) => {
      if (!fecha) return '—';
      try {
        const str = fecha.toString().trim();
        // Formato ISO YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss
        const matchISO = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (matchISO) {
          return `${matchISO[3]}/${matchISO[2]}/${matchISO[1]}`;
        }
        // Fallback: usar Date
        const fechaObj = new Date(str);
        if (isNaN(fechaObj.getTime())) return '—';
        const dia = String(fechaObj.getDate()).padStart(2, '0');
        const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
        const anio = fechaObj.getFullYear();
        return `${dia}/${mes}/${anio}`;
      } catch (error) {
        return '—';
      }
    };

    const obtenerFechaSolicitudGuardada = () => {
      const fechaDirecta = datosPersonales?.fecha_solicitud || poliza?.solicitud_afiliacion?.fecha_solicitud;
      if (fechaDirecta) {
        return formatearFecha(fechaDirecta);
      }

      const dia = poliza?.solicitud_afiliacion?.fecha_solicitud_dia;
      const mes = poliza?.solicitud_afiliacion?.fecha_solicitud_mes;
      const anio = poliza?.solicitud_afiliacion?.fecha_solicitud_anio;

      if (dia && mes && anio) {
        const fechaArmada = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        return formatearFecha(fechaArmada);
      }

      return 'No especificada';
    };

    const fechaSolicitudMostrada = obtenerFechaSolicitudGuardada();

    // ✅ FUNCIÓN PARA LIMPIAR PROMOCIÓN (remover "Ley 19032" y dejar solo promo + porcentaje)
    const limpiarPromocion = (promocion) => {
      if (!promocion) return '—';
      
      // Remover todo lo que contenga "Ley 19032" y sus valores
      let limpia = promocion.replace(/\s*\+\s*Ley\s*19032:?\s*\$?[\d,.\s]+/gi, '').trim();
      
      // Si el resultado está vacío, retornar el original limpiado
      if (!limpia || limpia === '') {
        return '—';
      }
      
      return limpia;
    };

    // ✅ NUEVA FUNCIÓN: Construir texto de promoción con porcentaje y aditivos
    const construirPromocionCompleta = (detalle, porcentajePromocion) => {
      let resultado = [];
      
      // Agregar promoción aplicada con porcentaje si existe
      if (detalle.promocion_aplicada) {
        let promo = limpiarPromocion(detalle.promocion_aplicada);
        if (promo !== '—' && promo !== '') {
          // Si hay porcentaje de promoción, agregarlo
          if (porcentajePromocion) {
            resultado.push(`${promo} (${porcentajePromocion})`);
          } else {
            resultado.push(promo);
          }
        }
      } else if (porcentajePromocion) {
        // Si no hay promoción_aplicada pero sí porcentaje, mostrar solo el porcentaje
        resultado.push(`Promo (${porcentajePromocion})`);
      }
      
      // Agregar +Ley19032 si tipo_afiliacion_id === 2
      if (detalle.tipo_afiliacion_id === 2) {
        resultado.push('+Ley19032');
      }
      
      // Agregar +Monotributo CAT si tipo_afiliacion_id === 3
      if (detalle.tipo_afiliacion_id === 3 && detalle.categoria_monotributo) {
        resultado.push(`+Monotributo CAT ${detalle.categoria_monotributo}`);
      }
      
      // Unir todos los resultados con espacios
      return resultado.length > 0 ? resultado.join(' ') : '—';
    };

    const preguntasSalud = [
      { id: 'internacion', pregunta: '¿Tuviste que ser internado en alguna oportunidad?' },
      { id: 'internacion_colegiales', pregunta: '¿Fuiste internado en el Sanatorio Colegiales?' },
      { id: 'cirugia', pregunta: '¿Tuviste que ser intervenido quirúrgicamente alguna vez?' },
      { id: 'secuelas', pregunta: '¿Tenés secuelas o algún tipo de enfermedad?' },
      { id: 'accidentes', pregunta: '¿Padeciste accidentes, fracturas o traumatismos?' },
      { id: 'transfusiones', pregunta: '¿Te realizaron transfusiones de sangre?' },
      { id: 'estudios_anuales', pregunta: '¿Realizaste tus análisis y estudios en el último año?' },
      { id: 'indicacion_medica', pregunta: '¿Tenés alguna indicación médica para los próximos meses?' },
      { id: 'psicologico', pregunta: '¿Estás o estuviste en un tratamiento psicológico?' },
      { id: 'psiquiatrico', pregunta: '¿Estás o estuviste en un tratamiento psiquiátrico?' },
      { id: 'internacion_mental', pregunta: '¿Estuviste internado en alguna institución de Salud Mental?' },
      { id: 'diabetes', pregunta: '¿Tenés diabetes?' },
      { id: 'auditivas', pregunta: '¿Tenés dificultades auditivas?' },
      { id: 'vista', pregunta: '¿Tenés problemas de vista? ¿De qué tipo?' },
      { id: 'lentes', pregunta: '¿Usás lentes de contacto o anteojos?' },
      { id: 'glaucoma', pregunta: '¿Tenés glaucoma (presión alta en el ojo) o cataratas?' },
      { id: 'alergias', pregunta: '¿Tenés alergias?' },
      { id: 'infarto', pregunta: '¿Tuviste ataques cardíacos o infartos?' },
      { id: 'presion_arterial', pregunta: '¿Cuál es tu presión arterial actual?' },
      { id: 'test_embarazo', pregunta: '¿Te realizaste algún test de embarazo en las últimas semanas?' },
      { id: 'sintomas_embarazo', pregunta: '¿Presentaste náuseas o vómitos recientemente / mareos o dolores de cabeza?' },
      { id: 'embarazo_actual', pregunta: '¿Te encontrás cursando un embarazo ahora?' },
      { id: 'aborto', pregunta: '¿Tuviste algún aborto espontáneo?' },
      { id: 'partos', pregunta: '¿Tuviste partos normales?' },
      { id: 'columna', pregunta: '¿Tenés problemas de columna?' },
      { id: 'protesis', pregunta: '¿Tenés colocada alguna prótesis?' },
      { id: 'deporte', pregunta: '¿Practicás algún deporte?' },
      { id: 'deporte_riesgo', pregunta: '¿Practicás algún deporte de riesgo?' },
      { id: 'indicacion_protesis', pregunta: '¿Tenés indicación para la colocación de alguna prótesis?' },
      { id: 'neurologicas', pregunta: '¿Tenés o tuviste trastornos neurológicos o circulatorios cerebrales?' },
      { id: 'epilepsia', pregunta: '¿Tenés o tuviste epilepsia?' },
      { id: 'respiratorias', pregunta: '¿Tenés o tuviste asma, bronquitis crónica, enfisema pulmonar?' },
      { id: 'tuberculosis', pregunta: '¿Tenés o tuviste tuberculosis?' },
      { id: 'fiebre_reumatica', pregunta: '¿Tenés o tuviste fiebre reumática o enfermedades de los huesos?' },
      { id: 'hepatitis', pregunta: '¿Tenés o tuviste ictericia, hepatitis (de cualquier tipo), cirrosis?' },
      { id: 'colicos', pregunta: '¿Tenés o tuviste cólicos renales o vesiculares?' },
      { id: 'infecciones_urinarias', pregunta: '¿Tenés o tuviste infecciones urinarias repetidas?' },
      { id: 'anemia', pregunta: '¿Tenés o tuviste pérdida de sangre o anemia?' },
      { id: 'transmision_sexual', pregunta: '¿Tenés enfermedades de transmisión sexual? (Sida, Hepatitis B u otras)' },
      { id: 'infecciosas', pregunta: '¿Tenés o tuviste otras enfermedades infecciosas?' },
      { id: 'tumores', pregunta: '¿Tenés o tuviste tumores?' },
      { id: 'tiroides', pregunta: '¿Tenés o tuviste enfermedades de las glándulas tiroides?' },
      { id: 'gastritis', pregunta: '¿Tenés o tuviste úlceras, gastritis y/o alguna otra enfermedad del estómago?' },
      { id: 'tabaquismo', pregunta: '¿Fumás o fumaste?' },
      { id: 'alcoholismo', pregunta: '¿Bebés alcohol habitualmente?' },
      { id: 'drogas', pregunta: '¿Consumís drogas?' },
      { id: 'perdida_peso', pregunta: '¿Perdiste peso en los últimos 6 meses sin hacer dieta?' },
      { id: 'diagnostico_reciente', pregunta: '¿Se te diagnosticó recientemente alguna enfermedad?' },
      { id: 'discapacidad', pregunta: '¿Tenés, tuviste o estás tramitando un certificado de discapacidad?' }
    ];

    // ✅ PARSEAR CUESTIONARIO DE SALUD MEJORADO - CORREGIDO
    let cuestionarioSalud = [];
    let respuestasSalud = {};
    let datosAdicionales = {};
    let datosAdicionalesPorIntegrante = {};

    try {
      console.log('🔍 DEBUG: Estructura completa de declaracionSalud:', JSON.stringify(declaracionSalud, null, 2));
      
      // ✅ PROCESAR RESPUESTAS CORRECTAMENTE SEGÚN LA ESTRUCTURA REAL
      if (declaracionSalud.respuestas && typeof declaracionSalud.respuestas === 'object') {
        respuestasSalud = declaracionSalud.respuestas;
        console.log('✅ Respuestas encontradas:', Object.keys(respuestasSalud));
        
        // ✅ DEBUG ESPECÍFICO: Mostrar respuestas "sí" encontradas
        Object.keys(respuestasSalud).forEach(integranteIndex => {
          const respuestasIntegrante = respuestasSalud[integranteIndex];
          console.log(`👤 Integrante ${integranteIndex} - Total respuestas:`, Object.keys(respuestasIntegrante).length);
          
          // Buscar respuestas "sí"
          const respuestasSi = Object.keys(respuestasIntegrante).filter(preguntaId => {
            const resp = respuestasIntegrante[preguntaId];
            return resp?.respuesta === 'si';
          });
          
          if (respuestasSi.length > 0) {
            console.log(`🟢 Integrante ${integranteIndex} - Respuestas SÍ encontradas:`, respuestasSi);
            respuestasSi.forEach(preguntaId => {
              const respuesta = respuestasIntegrante[preguntaId];
              console.log(`   - ${preguntaId}: "${respuesta.detalle}"`);
            });
          } else {
            console.log(`⭕ Integrante ${integranteIndex} - No hay respuestas SÍ`);
          }
        });
      } else {
        console.log('❌ No se encontraron respuestas en declaracionSalud.respuestas');
      }

      // Buscar datos físicos (peso y altura)
      datosAdicionales = declaracionSalud.datos_adicionales ||
        declaracionSalud.datosAdicionales ||
        declaracionSalud.datos_fisicos ||
        {};

      // ✅ Conservar la info adicional declarada por integrante (declaración, médico tratante,
      // instituciones anteriores) antes de que "datosAdicionales" se sobreescriba abajo con peso/altura/edad
      datosAdicionalesPorIntegrante = declaracionSalud.datos_adicionales ||
        declaracionSalud.datosAdicionales ||
        {};

      // ✅ SOLUCIÓN: Buscar primero en datosPersonales
      if (datosPersonales.peso || datosPersonales.altura || datosPersonales.edad) {
        datosAdicionales = {
          peso: datosPersonales.peso,
          altura: datosPersonales.altura,
          edad: datosPersonales.edad,
          titular_peso: datosPersonales.peso,
          titular_altura: datosPersonales.altura,
          titular_edad: datosPersonales.edad
        };
      }

      console.log('📋 Cuestionario parseado:', {
        respuestas_disponibles: Object.keys(respuestasSalud),
        datos_adicionales: Object.keys(datosAdicionales),
        total_integrantes_con_respuestas: Object.keys(respuestasSalud).length
      });

    } catch (error) {
      console.log('Error parseando cuestionario de salud:', error);
    }

    const nombreTitular = mostrarDato(
      `${datosPersonales.nombre} ${datosPersonales.apellido}`.trim() ||
      `${poliza.prospecto_nombre} ${poliza.prospecto_apellido}`.trim(),
      'Sin nombre'
    );

    // ✅ CALCULAR TOTALES DEL PLAN CON PROMOCIONES
    const cuotaMensual = poliza.total_bruto ? parseFloat(poliza.total_bruto) :
      (poliza.total_final ? parseFloat(poliza.total_final) : 0);
    const aporte = 0; // Puedes ajustar según tu lógica

    // ✅ OBTENER BONIFICACIÓN/DESCUENTO DE LA PROMOCIÓN
    let bonificacion = 0;
    let promocionAplicada = 'Sin promoción';
    let porcentajePromocion = '';

    try {
      // 🔥 PRIORIDAD 1: Usar porcentaje manual ingresado por el vendedor
      if (datosPersonales.porcentaje_promocion) {
        porcentajePromocion = datosPersonales.porcentaje_promocion + '%';
        console.log('✅ Usando porcentaje MANUAL ingresado por vendedor:', porcentajePromocion);
      } 
      // PRIORIDAD 2: Extraer automáticamente si no hay porcentaje manual
      else if (poliza.promocion_aplicada) {
        promocionAplicada = poliza.promocion_aplicada;
        
        // Extraer SOLO el porcentaje de la promoción (buscar patrón como "55.00%", "55%", "50%", etc)
        // Puede venir en formato: 'Promoción "Promo Débito Automático" (55.00%) + Ley 19032: $112,200.00'
        const match = promocionAplicada.match(/\((\d+(?:\.\d{1,2})?)\s*%\)/);
        if (match) {
          porcentajePromocion = match[1] + '%';
          console.log('✅ Porcentaje extraído automáticamente (paréntesis):', porcentajePromocion);
        } else {
          // Intento alternativo si no está entre paréntesis
          const matchAlt = promocionAplicada.match(/(\d+(?:\.\d{1,2})?)\s*%/);
          if (matchAlt) {
            porcentajePromocion = matchAlt[1] + '%';
            console.log('✅ Porcentaje extraído automáticamente (alternativo):', porcentajePromocion);
          }
        }
      }

      if (poliza.descuento_promocion) {
        bonificacion = parseFloat(poliza.descuento_promocion);
      } else if (poliza.total_descuento_promocion) {
        bonificacion = parseFloat(poliza.total_descuento_promocion);
      }

      console.log('💰 Promoción detectada:', { 
        promocionAplicada, 
        porcentajePromocion, 
        bonificacion,
        origen: datosPersonales.porcentaje_promocion ? 'MANUAL' : 'AUTOMÁTICO',
        mostrarEnPDF: porcentajePromocion || 'Bonificación aplicada'
      });
    } catch (error) {
      console.log('Error parseando promoción:', error);
    }

    const totalAbonar = poliza.total_final ? parseFloat(poliza.total_final) : (cuotaMensual - bonificacion);

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Póliza ${poliza.numero_poliza_oficial || poliza.numero_poliza}</title>
          <style>
              @page {
                  size: A4;
                  margin: 0;
              }
              
              * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
              }
              
              body { 
                  font-family: 'Arial', sans-serif; 
                  font-size: 9px; 
                  line-height: 1.2;
                  color: #333;
                  background: white;
                  padding: 10mm;
              }
              
              /* ✅ HEADER CORPORATIVO */
              .header-corporativo {
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                  margin-bottom: 15px;
                  padding-bottom: 10px;
                  border-bottom: 2px solid #8B7EC8;
              }
              
            //   .logo-empresa {
            //       width: 120px;
            //       height: 60px;
            //       background: linear-gradient(135deg, #8B7EC8 0%, #2D3047 100%);
            //       border-radius: 8px;
            //       display: flex;
            //       align-items: center;
            //       justify-content: center;
            //       color: white;
            //       font-weight: bold;
            //       font-size: 14px;
            //       text-align: center;
            //   }
              
              .info-poliza {
                  text-align: right;
                  font-size: 10px;
              }
              
              .numero-poliza {
                  font-size: 14px;
                  font-weight: bold;
                  color: #8B7EC8;
                  margin-bottom: 5px;
              }
              
              /* ✅ SECCIONES ORGANIZADAS */
              .seccion {
                  margin-bottom: 12px;
                  border: 1px solid #ddd;
                  border-radius: 4px;
                  overflow: hidden;
                  page-break-inside: avoid;
              }
              
              .seccion-titulo {
                  background: #f8f9fa;
                  padding: 6px 10px;
                  font-weight: bold;
                  color: #495057;
                  font-size: 9px;
                  border-bottom: 1px solid #ddd;
              }
              
              .seccion-contenido {
                  padding: 10px;
              }
              
              /* ✅ GRIDS PARA DATOS */
              .datos-grid {
                  display: grid;
                  grid-template-columns: repeat(3, 1fr);
                  gap: 6px;
                  margin-bottom: 6px;
              }
              
              .datos-grid-2 {
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 6px;
                  margin-bottom: 6px;
              }
              
              .campo {
                  margin-bottom: 4px;
              }
              
              .campo-label {
                  font-weight: bold;
                  color: #6c757d;
                  font-size: 7px;
                  text-transform: uppercase;
                  margin-bottom: 1px;
              }
              
              .campo-valor {
                  color: #212529;
                  font-size: 8px;
                  border-bottom: 1px dotted #ccc;
                  padding-bottom: 1px;
              }
              
              /* ✅ TABLAS PROFESIONALES */
              .tabla-profesional {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 4px 0;
                  font-size: 6px;
              }
              
              .tabla-profesional th {
                  background: #f8f9fa;
                  border: 1px solid #dee2e6;
                  padding: 2px 1px;
                  text-align: center;
                  font-weight: bold;
                  color: #495057;
                  font-size: 6px;
                  text-transform: uppercase;
              }
              
              .tabla-profesional td {
                  border: 1px solid #dee2e6;
                  padding: 2px 1px;
                  text-align: center;
                  vertical-align: middle;
                  font-size: 6px;
              }
              
              /* ✅ CUESTIONARIO DE SALUD CON CHECKBOXES */
              .pregunta-col { width: 40%; text-align: left; padding-left: 6px !important; }
              .si-col { width: 15%; }
              .no-col { width: 15%; }
              .obs-col { width: 30%; text-align: left; }
              
              .checkbox-visual {
                  display: inline-block;
                  width: 8px;
                  height: 8px;
                  border: 1px solid #666;
                  border-radius: 1px;
                  position: relative;
                  background: white;
              }
              
              .checkbox-visual.marcado {
                  background: #28a745;
                  border-color: #28a745;
              }
              
              .checkbox-visual.marcado::after {
                  content: "✓";
                  color: white;
                  font-size: 6px;
                  font-weight: bold;
                  position: absolute;
                  top: -1px;
                  left: 1px;
              }
              
              /* ✅ DETALLE DEL PLAN */
              .plan-detalle {
                  background: #f8f9fa;
                  border: 2px solid #8B7EC8;
                  border-radius: 6px;
                  padding: 10px;
                  margin: 8px 0;
              }
              
              .plan-titulo {
                  color: #8B7EC8;
                  font-weight: bold;
                  font-size: 10px;
                  margin-bottom: 6px;
                  text-align: center;
              }
              
              .plan-grid {
                  display: grid;
                  grid-template-columns: auto auto;
                  gap: 6px;
                  align-items: center;
              }
              
              .plan-item {
                  display: flex;
                  justify-content: space-between;
                  padding: 2px 0;
                  border-bottom: 1px dotted #ccc;
              }
              
              .plan-label {
                  font-weight: bold;
                  color: #495057;
                  font-size: 8px;
              }
              
              .plan-valor {
                  color: #212529;
                  font-weight: bold;
                  font-size: 8px;
              }
              
              .total-destacado {
                  background: #28a745;
                  color: white;
                  padding: 4px;
                  border-radius: 4px;
                  text-align: center;
                  font-weight: bold;
                  margin-top: 6px;
                  font-size: 9px;
              }
              
              /*  FIRMA Y DNI */
              .firma-section {
                  margin-top: 15px;
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 15px;
                  page-break-inside: avoid;
                  break-inside: avoid;
              }
              
              .firma-box {
                  border: 2px solid #8B7EC8;
                  border-radius: 6px;
                  padding: 10px;
                  text-align: center;
                  min-height: 60px;
                  background: #fafafa;
              }
              
              .firma-titulo {
                  font-weight: bold;
                  color: #8B7EC8;
                  margin-bottom: 6px;
                  font-size: 8px;
              }
              
              .firma-linea {
                  border-bottom: 1px solid #666;
                  margin: 10px 0 4px 0;
                  height: 20px;
              }
              
              .firma-texto {
                  font-size: 6px;
                  color: #666;
              }
              
              /*  NÚMERO DE PÁGINA EN PIE DE PÁGINA */
          
              
              .page-break {
                  page-break-before: always;
              }

              /*  NO ROMPER PÁGINA */
              .no-romper {
                  page-break-inside: avoid;
                  break-inside: avoid;
              }
                  /* ...dentro del <style>... */
.seccion-interna {
  border: 1px solid #b39ddb;
  border-radius: 4px;
  margin-bottom: 12px;
  background: #f8f9fa;
  padding: 6px 8px 2px 8px;
  font-size: 8px;
}
.info-titulo {
  font-size: 9px;
  font-weight: bold;
  color: #333;
  margin-bottom: 2px;
  border-bottom: 2px solid #b39ddb;
  padding-bottom: 1px;
}
.info-sub {
  font-size: 8px;
  color: #666;
  font-style: normal;
}
.info-factura-label {
  margin-bottom: 2px;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 2px 6px;
  margin-bottom: 2px;
}
.info-label {
  font-size: 7px;
  color: #333;
  font-weight: normal;
  display: block;
  margin-bottom: 1px;
}
.info-campo {
  min-height: 14px;
  background: #e9eaf6;
  border: 1px solid #b39ddb;
  border-radius: 2px;
  margin-bottom: 2px;
  padding: 1px 3px;
  font-size: 8px;
  color: #333;
}

.seccion-solicitud {
  border: 1.5px solid #b39ddb;
  border-radius: 4px;
  margin-bottom: 10px;
  background: #f8f9fa;
  padding: 8px 10px 6px 10px;
  font-size: 8.5px;
}
.solicitud-grid {
  display: grid;
  grid-template-columns: 2fr 2fr 2fr 2fr 2fr 2fr;
  gap: 2px 8px;
  align-items: center;
  margin-bottom: 4px;
}
.solicitud-label {
  grid-column: 1 / span 2;
  font-weight: bold;
  font-size: 10px;
  color: #333;
  border-bottom: 2px solid #b39ddb;
  margin-bottom: 2px;
}
.solicitud-asesor, .solicitud-afiliado, .solicitud-vigencia, .solicitud-fecha {
  font-size: 8px;
}
.solicitud-valor {
  color: #3b5998;
  font-weight: bold;
  font-size: 9px;
  margin-left: 2px;
}
.solicitud-checks label {
  margin-right: 8px;
  font-size: 8px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.solicitud-checks .checkbox-visual {
  width: 11px;
  height: 11px;
  border: 1.5px solid #666;
  border-radius: 2px;
  margin-right: 2px;
  display: inline-block;
  vertical-align: middle;
  background: #fff;
  position: relative;
}
.solicitud-checks .checkbox-visual.marcado {
  background: #b39ddb;
  border-color: #b39ddb;
}
.solicitud-checks .checkbox-visual.marcado::after {
  content: "✓";
  color: #fff;
  font-size: 9px;
  font-weight: bold;
  position: absolute;
  top: -2px;
  left: 1px;
}
.comercial-titulo {
  font-weight: bold;
  font-size: 9px;
  color: #333;
  margin-top: 6px;
  border-bottom: 2px solid #b39ddb;
}
.comercial-sub {
  font-size: 7.5px;
  color: #666;
  margin-bottom: 3px;
  margin-top: 1px;
}
.comercial-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 2px 8px;
  margin-bottom: 2px;
}
.com-label {
  font-size: 7px;
  color: #333;
  font-weight: normal;
  display: block;
  margin-bottom: 1px;
}
.com-campo {
  min-height: 14px;
  background: #e9eaf6;
  border: 1px solid #b39ddb;
  border-radius: 2px;
  margin-bottom: 2px;
  padding: 1px 3px;
  font-size: 8px;
  color: #333;
}
          </style>
      </head>
      <body>
          <!--  NÚMERO DE PÁGINA -->
          
          <!--  HEADER CORPORATIVO -->
          <div class="header-corporativo">
          <div class="logo-empresa">
    <img src="${logoBase64}" alt="COBER Medicina Privada" style="width: 120px; height: auto; display: block;" />
</div>
              <div class="info-poliza">
                  <div class="numero-poliza">Póliza N° ${poliza.numero_poliza_oficial || poliza.numero_poliza || 'Temporal'}</div>
                  <div>Fecha Solicitud: ${fechaSolicitudMostrada}</div>
                  <div>Hora: ${new Date().toLocaleTimeString('es-AR')}</div>
                  ${poliza.es_temporal ? '<div style="color: #ff6b35; font-weight: bold;">⚠️ TEMPORAL</div>' : ''}
              </div>
          </div>


<!-- INFORMACIÓN DEL AFILIADO Y FACTURACIÓN - ACTUALIZADA CON DATOS DINÁMICOS -->
<div class="seccion-interna">
  <div class="info-afiliado">
    <div class="info-titulo">
      <i>Información del Afiliado</i> – <span class="info-sub">A completar por personal interno de la ADMINISTRACIÓN CENTRAL.</span>
    </div>
    <div class="info-grid">
      <div>
        <span class="info-label">Nº de Afiliado asignado</span>
        <div class="info-campo">${mostrarDato(poliza.informacion_afiliado?.numero_afiliado_asignado, '')}</div>
      </div>
      <div>
        <span class="info-label">Nº de Historia Clínica</span>
        <div class="info-campo">${mostrarDato(poliza.informacion_afiliado?.numero_historia_clinica, '')}</div>
      </div>
      <div>
        <span class="info-label">Firma Responsable</span>
        <div class="info-campo">${mostrarDato(poliza.informacion_afiliado?.firma_responsable, '')}</div>
      </div>
    </div>
    <div class="info-grid">
      <div>
        <span class="info-label">Credenciales Realizadas?</span>
        <div class="info-campo">${mostrarDato(poliza.informacion_afiliado?.credenciales_realizadas, '')}</div>
      </div>
      <div>
        <span class="info-label">Presenta Certificado O.S?</span>
        <div class="info-campo">${mostrarDato(poliza.informacion_afiliado?.presenta_certificado_os, '')}</div>
      </div>
      <div>
        <span class="info-label">Antigüedad en otra prepaga</span>
        <div class="info-campo">${mostrarDato(poliza.informacion_afiliado?.antiguedad_otra_prepaga, '')}</div>
      </div>
      <div>
        <span class="info-label">Fecha</span>
        <div class="info-campo">${mostrarDato(poliza.informacion_afiliado?.fecha_proceso ? formatearFecha(poliza.informacion_afiliado.fecha_proceso) : '')}</div>
      </div>
    </div>
  </div>
  <div class="info-facturacion">
    <div class="info-titulo">
      <i>Información de Facturación</i> – <span class="info-sub">A completar por personal interno</span>
    </div>
    <div class="info-factura-label">
      <span style="font-size:7px; color:#666; font-style:italic;">
        Factura AFILIACIÓN - AL INGRESO DE LA SOLICITUD DE AFILIACIÓN
      </span>
    </div>
    <div class="info-grid">
      <div>
        <span class="info-label">Nº Factura</span>
        <div class="info-campo">${mostrarDato(poliza.informacion_facturacion?.numero_factura, '')}</div>
      </div>
      <div>
        <span class="info-label">$</span>
        <div class="info-campo">${mostrarDato(poliza.informacion_facturacion?.monto_factura, '')}</div>
      </div>
      <div>
        <span class="info-label">Fecha de Emisión:</span>
        <div class="info-campo">${mostrarDato(poliza.informacion_facturacion?.fecha_emision ? formatearFecha(poliza.informacion_facturacion.fecha_emision) : '')}</div>
      </div>
      <div>
        <span class="info-label">Período de Facturación:</span>
        <div class="info-campo">${mostrarDato(poliza.informacion_facturacion?.periodo_facturacion, '')}</div>
      </div>
      <div>
        <span class="info-label">Firma Responsable</span>
        <div class="info-campo">${mostrarDato(poliza.informacion_facturacion?.firma_responsable_facturacion, '')}</div>
      </div>
    </div>
    <div class="info-grid">
      <div>
        <span class="info-label">Bonificaciones cargadas?</span>
        <div class="info-campo">${mostrarDato(poliza.informacion_facturacion?.bonificaciones_cargadas, '')}</div>
      </div>
      <div>
        <span class="info-label">CUIL</span>
        <div class="info-campo" style="color:#3b5998; font-weight:bold;">${mostrarDato(poliza.informacion_facturacion?.cuil_facturacion || datosPersonales.cuil || datosPersonales.dni_cuil)}</div>
      </div>
      <div>
        <span class="info-label">Antigüedad en otra prepaga</span>
        <div class="info-campo">${mostrarDato(poliza.informacion_afiliado?.antiguedad_otra_prepaga, '')}</div>
      </div>
      <div>
        <span class="info-label">Fecha</span>
        <div class="info-campo">${mostrarDato(poliza.informacion_facturacion?.fecha_emision ? formatearFecha(poliza.informacion_facturacion.fecha_emision) : '')}</div>
      </div>
    </div>
  </div>
</div>

<!-- SOLICITUD DE AFILIACIÓN Y COMERCIAL - ACTUALIZADA CON DATOS DINÁMICOS -->
<div class="seccion-solicitud">
  <div class="solicitud-grid">
    <div class="solicitud-label">Solicitud de Afiliación</div>
    <div class="solicitud-asesor">
      <span>Asesor:</span>
      <span class="solicitud-valor">${mostrarDato(datosPersonales.asesor || poliza.solicitud_afiliacion?.asesor_nombre || poliza.asesor_nombre || poliza.vendedor_nombre || poliza.creado_por || '', '—')}</span>
    </div>
    <div class="solicitud-checks">
      <label><span class="checkbox-visual marcado"></span> Alta.</label>
      <label><span class="checkbox-visual ${poliza.solicitud_afiliacion?.tipo_solicitud === 'modificacion' ? 'marcado' : ''}"></span> Modif.</label>
      <label><span class="checkbox-visual ${poliza.solicitud_afiliacion?.tipo_solicitud === 'cambio_plan' ? 'marcado' : ''}"></span> Cambio de plan</label>
    </div>
    <div class="solicitud-fecha">
      <span>Fecha solicitud</span>
      <span class="solicitud-valor">
        ${(() => {
          // ✅ Priorizar fecha_solicitud de datosPersonales (sin problemas de zona horaria)
          const fechaSolicitud = datosPersonales.fecha_solicitud || 
                                 poliza.solicitud_afiliacion?.fecha_solicitud || 
                                 poliza.created_at || 
                                 new Date().toISOString().split('T')[0];
          return formatearFecha(fechaSolicitud);
        })()}
      </span>
    </div>
    <div class="solicitud-afiliado">
      <span>Afiliado N°:</span>
      <span class="solicitud-valor">${mostrarDato(poliza.solicitud_afiliacion?.numero_afiliado || poliza.numero_afiliado || '', '—')}</span>
    </div>
    <div class="solicitud-vigencia">
      <span>Vigencia para</span>
      <span>
        mes <span class="solicitud-valor">${(() => {
          // ✅ LÓGICA CORRECTA DE VIGENCIA:
          // - Día 1-13: vigencia en el MISMO mes
          // - Día 14-31: vigencia en el MES SIGUIENTE
          
          // Si mes_ingreso está disponible en datosPersonales, usarlo directamente
          if (datosPersonales.mes_ingreso) {
            const [anio, mes] = datosPersonales.mes_ingreso.split('-');
            const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                           'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            return meses[parseInt(mes) - 1];
          }
          
          // Fallback: calcular desde fecha_solicitud (sin problemas de zona horaria)
          const fechaSolicitud = datosPersonales.fecha_solicitud || 
                                 poliza.solicitud_afiliacion?.fecha_solicitud || 
                                 poliza.created_at || 
                                 new Date().toISOString().split('T')[0];
          const partes = fechaSolicitud.toString().match(/^(\d{4})-(\d{2})-(\d{2})/);
          let mesNum, anioNum;
          if (partes) {
            anioNum = parseInt(partes[1]);
            mesNum = parseInt(partes[2]); // 1-12
            const diaNum = parseInt(partes[3]);
            if (diaNum >= 14) {
              mesNum += 1;
              if (mesNum > 12) { mesNum = 1; anioNum += 1; }
            }
          } else {
            const now = new Date();
            mesNum = now.getMonth() + 1;
            anioNum = now.getFullYear();
          }
          const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                         'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
          return meses[mesNum - 1];
        })()}</span>
        año <span class="solicitud-valor">${(() => {
          // ✅ LÓGICA CORRECTA DE VIGENCIA:
          // - Día 1-13: vigencia en el MISMO mes
          // - Día 14-31: vigencia en el MES SIGUIENTE
          
          // Si mes_ingreso está disponible en datosPersonales, usarlo directamente
          if (datosPersonales.mes_ingreso) {
            const [anio, mes] = datosPersonales.mes_ingreso.split('-');
            return anio;
          }
          
          // Fallback: calcular desde fecha_solicitud (sin problemas de zona horaria)
          const fechaSolicitud = datosPersonales.fecha_solicitud || 
                                 poliza.solicitud_afiliacion?.fecha_solicitud || 
                                 poliza.created_at || 
                                 new Date().toISOString().split('T')[0];
          const partes = fechaSolicitud.toString().match(/^(\d{4})-(\d{2})-(\d{2})/);
          let mesNum, anioNum;
          if (partes) {
            anioNum = parseInt(partes[1]);
            mesNum = parseInt(partes[2]);
            const diaNum = parseInt(partes[3]);
            if (diaNum >= 14) {
              mesNum += 1;
              if (mesNum > 12) { mesNum = 1; anioNum += 1; }
            }
          } else {
            const now = new Date();
            anioNum = now.getFullYear();
          }
          return anioNum;
        })()}</span>
      </span>
    </div>
    <div class="solicitud-asesor">
      <span>Obra Social:</span>
      <span class="solicitud-valor">${mostrarDato(datosPersonales.obra_social === "Otra" ? (datosPersonales.obra_social_otra || '') : datosPersonales.obra_social || '', '—')}</span>
    </div>
  </div>
  <div class="comercial-titulo">Comercial</div>
  <div class="comercial-sub">
    Indique, en caso de corresponder, si se ha realizado alguna promoción o descuento sobre el grupo familiar detallado. En caso negativo, NO COMPLETAR.
  </div>
  <div class="comercial-grid">
    <div>
      <span class="com-label">Mes de ingreso</span>
      <div class="com-campo">${mostrarDato(formatearMesIngreso(datosPersonales.mes_ingreso || poliza.datos_comerciales?.mes_ingreso || ''), '')}</div>
    </div>
    <div>
      <span class="com-label">Plan</span>
      <div class="com-campo">${mostrarDato(poliza.datos_comerciales?.plan_contratado || poliza.plan_nombre, '')}</div>
    </div>
    <div>
      <span class="com-label">Valor de cuota de ingreso $</span>
      <div class="com-campo">${poliza.datos_comerciales?.valor_cuota_ingreso ? parseFloat(poliza.datos_comerciales.valor_cuota_ingreso).toLocaleString('es-AR', { minimumFractionDigits: 2 }) : totalAbonar.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
    </div>
    <div>
      <span class="com-label">Código de Promoción:</span>
      <div class="com-campo">${porcentajePromocion || '—'}</div>
    </div>
    <div>
      <span class="com-label">Mes de Vigencia de Promoción:</span>
      <div class="com-campo">${poliza.datos_comerciales?.mes_vigencia_promocion || ''}</div>
    </div>
  </div>
  <div class="comercial-grid">
    <div style="grid-column: span 1;">
      <span class="com-label">Descuento Presuntivo.<br><span style="font-size:7px;">COMPLETAR (sólo en caso de desregulación de Obra Social)</span></span>
      <div class="com-campo">$ ${(() => {
        // ✅ CALCULAR SUMATORIA DE APORTES PRESUNTIVOS
        let totalAportePresuntivo = 0;
        
        if (detalles && detalles.length > 0) {
          totalAportePresuntivo = detalles.reduce((sum, detalle) => {
            const aporte = parseFloat(detalle.descuento_aporte || 0);
            return sum + aporte;
          }, 0);
        }
        
        // Si hay descuento presuntivo guardado, usar ese, sino usar la sumatoria calculada
        const montoFinal = poliza.datos_comerciales?.descuento_presuntivo 
          ? parseFloat(poliza.datos_comerciales.descuento_presuntivo)
          : totalAportePresuntivo;
        
        console.log('💰 Aporte Presuntivo - Total calculado:', totalAportePresuntivo, 'Guardado:', poliza.datos_comerciales?.descuento_presuntivo);
        
        return montoFinal > 0 
          ? montoFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })
          : '';
      })()}</div>
    </div>
    <div>
      <span class="com-label">Forma de Pago</span>
      <div class="com-campo">${datosPersonales.forma_pago || 'No especificada'}</div>
    </div>
    <div>
      <span class="com-label">Hasta:</span>
      <div class="com-campo">${poliza.datos_comerciales?.descuento_hasta || ''}</div>
    </div>
    <div>
      <span class="com-label">Próximo período a ABONAR por Afiliado</span>
      <div class="com-campo">
        ${(() => {
          const periodo = datosPersonales.proximo_periodo_abonar || poliza.datos_comerciales?.proximo_periodo_mes || '';
          if (!periodo) return '';
          
          // Si viene en formato yyyy-mm-dd o yyyy-mm, convertir a dd/mm/yyyy o mm/yyyy
          if (periodo.includes('-')) {
            const partes = periodo.split('-');
            if (partes.length === 3) {
              // Formato yyyy-mm-dd → dd/mm/yyyy
              return `${partes[2]}/${partes[1]}/${partes[0]}`;
            } else if (partes.length === 2) {
              // Formato yyyy-mm → mm/yyyy
              return `${partes[1]}/${partes[0]}`;
            }
          }
          return periodo;
        })()}
      </div>
    </div>
    <div>
      <span class="com-label">Mes de Finalización de Promoción:</span>
      <div class="com-campo">${poliza.datos_comerciales?.mes_fin_promocion || ''}</div>
    </div>
  </div>

  <div class="comercial-titulo" style="margin-top: 8px;">DATOS DE LA EMPRESA</div>
  <div class="comercial-grid" style="grid-template-columns: 1fr 1fr;">
    <div>
      <span class="com-label">Razón Social</span>
      <div class="com-campo">${mostrarDato(datosPersonales.empresa_razon_social, '')}</div>
    </div>
    <div>
      <span class="com-label">CUIT</span>
      <div class="com-campo">${mostrarDato(datosPersonales.empresa_cuit, '')}</div>
    </div>
  </div>
  <div class="comercial-grid" style="grid-template-columns: 1fr 1fr 1fr;">
    <div>
      <span class="com-label">Dirección</span>
      <div class="com-campo">${mostrarDato(datosPersonales.empresa_direccion, '')}</div>
    </div>
    <div>
      <span class="com-label">Código Postal</span>
      <div class="com-campo">${mostrarDato(datosPersonales.empresa_codigo_postal, '')}</div>
    </div>
    <div>
      <span class="com-label">Localidad</span>
      <div class="com-campo">${mostrarDato(datosPersonales.empresa_localidad, '')}</div>
    </div>
  </div>
  <div class="comercial-grid" style="grid-template-columns: 1fr 1fr 1fr;">
    <div>
      <span class="com-label">Teléfono</span>
      <div class="com-campo">${mostrarDato(datosPersonales.empresa_telefono, '')}</div>
    </div>
  </div>
</div>

<!-- DETALLE DEL PLAN SELECCIONADO - DESPUÉS DE SOLICITUD -->
<div class="plan-detalle no-romper" style="margin: 8px 0; padding: 8px;">
  <div class="plan-titulo">DETALLE DEL PLAN SELECCIONADO</div>
  <div class="plan-grid">
      <div class="plan-item">
          <span class="plan-label">Plan:</span>
          <span class="plan-valor">${mostrarDato(poliza.plan_nombre, 'CLASSIC X')}</span>
      </div>
      <div class="plan-item">
          <span class="plan-label">Grupo familiar:</span>
          <span class="plan-valor">${integrantes.length > 0 ? 'Familiar' : 'Individual'}</span>
      </div>
      <div class="plan-item">
          <span class="plan-label">Tipo de afiliación:</span>
          <span class="plan-valor">${(() => {
            // Obtener todos los tipos de afiliación únicos del grupo desde detalles
            let tiposAfiliacion = new Set();
            
            // Agregar los tipos de todos los integrantes desde detalles
            if (detalles && detalles.length > 0) {
              detalles.forEach(detalle => {
                if (detalle.tipo_afiliacion_nombre) {
                  tiposAfiliacion.add(detalle.tipo_afiliacion_nombre);
                }
              });
            }
            
            // Convertir a array y unir con +
            const tiposArray = Array.from(tiposAfiliacion).filter(t => t && t.trim() !== '');
            return tiposArray.length > 0 ? tiposArray.join('+') : 'Particular/autónomo';
          })()}</span>
      </div>
      <div class="plan-item">
          <span class="plan-label">Cuota mensual:</span>
          <span class="plan-valor">$ ${cuotaMensual.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="plan-item">
          <span class="plan-label">Aporte estimado:</span>
          <span class="plan-valor">$ ${(() => {
            // ✅ CALCULAR SUMATORIA DE APORTES ESTIMADOS
            let totalAporte = 0;
            
            if (detalles && detalles.length > 0) {
              totalAporte = detalles.reduce((sum, detalle) => {
                const aporte = parseFloat(detalle.descuento_aporte || 0);
                return sum + aporte;
              }, 0);
            }
            
            console.log('💰 Aporte Estimado Total:', totalAporte);
            
            return totalAporte.toLocaleString('es-AR', { minimumFractionDigits: 2 });
          })()}</span>
      </div>
      ${bonificacion > 0 ? `
      <div class="plan-item">
          <span class="plan-label">Bonificación${porcentajePromocion ? ` (${porcentajePromocion})` : ''}:</span>
          <span class="plan-valor" style="color: #28a745;">-$ ${bonificacion.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
      </div>
      ` : `
      <div class="plan-item">
          <span class="plan-label">Bonificación:</span>
          <span class="plan-valor">$ 0,00</span>
      </div>
      `}
  </div>
  <div class="total-destacado">
      TOTAL A ABONAR: $ ${totalAbonar.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
  </div>
  
  ${detalles && detalles.length > 0 ? `
  <div style="margin-top:15px;">
      <div style="font-weight:bold;color:#8B7EC8;font-size:9px;margin-bottom:8px;">
          DETALLE DE LA COTIZACIÓN POR INTEGRANTE
      </div>
      <table class="tabla-profesional">
          <thead>
              <tr>
                  <th>Persona</th><th>Vínculo</th><th>Edad</th><th>Tipo Afiliación</th><th>Base</th>
                  <th>Desc. Aporte</th><th>Desc. Promoción</th><th>Promoción</th><th>Final</th>
              </tr>
          </thead>
          <tbody>
              ${(() => {
                // Ordenar: Titular primero, luego Cónyuge, después los demás
                const detallesOrdenados = [...detalles].sort((a, b) => {
                  const vinculoA = (a.vinculo || '').toLowerCase();
                  const vinculoB = (b.vinculo || '').toLowerCase();
                  
                  if (vinculoA === 'titular') return -1;
                  if (vinculoB === 'titular') return 1;
                  if (vinculoA === 'matrimonio' || vinculoA === 'cónyuge' || vinculoA === 'conyuge') return -1;
                  if (vinculoB === 'matrimonio' || vinculoB === 'cónyuge' || vinculoB === 'conyuge') return 1;
                  return 0;
                });
                
                return detallesOrdenados.map(d => {
                  // ✅ CONSTRUIR NOMBRE COMPLETO
                  let nombreCompleto;
                  
                  // Si es el TITULAR, usar siempre datosPersonales
                  if ((d.vinculo || '').toLowerCase() === 'titular') {
                    nombreCompleto = `${datosPersonales.nombre || ''} ${datosPersonales.apellido || ''}`.trim();
                    // Si no hay datos personales, usar el nombre del prospecto
                    if (!nombreCompleto || nombreCompleto === '') {
                      nombreCompleto = nombreTitular;
                    }
                  } else {
                    // Para otros integrantes, usar su nombre+apellido si existe
                    if (d.nombre || d.apellido) {
                      nombreCompleto = `${d.nombre || ''} ${d.apellido || ''}`.trim();
                    } else {
                      nombreCompleto = d.persona;
                    }
                  }
                  
                  return `
              <tr>
                  <td style="text-align:left;">${mostrarDato(nombreCompleto)}</td>
                  <td>${mostrarDato((d.vinculo || '').toLowerCase() === 'matrimonio' ? 'Cónyuge' : d.vinculo)}</td>
                  <td>${mostrarDato(d.edad)}</td>
                  <td style="text-align:left; font-size:8px;">${mostrarDato(d.tipo_afiliacion_nombre || '—')}</td>
                  <td>$ ${parseFloat(d.precio_base||0).toLocaleString('es-AR',{minimumFractionDigits:2})}</td>
                  <td>$ ${parseFloat(d.descuento_aporte||0).toLocaleString('es-AR',{minimumFractionDigits:2})}</td>
                  <td>$ ${parseFloat(d.descuento_promocion||0).toLocaleString('es-AR',{minimumFractionDigits:2})}</td>
                  <td>${construirPromocionCompleta(d, porcentajePromocion)}</td>
                  <td style="color:#28a745;font-weight:bold;">
                    $ ${parseFloat(d.precio_final||0).toLocaleString('es-AR',{minimumFractionDigits:2})}
                  </td>
              </tr>
              `}).join('');
              })()}
          </tbody>
      </table>
  </div>
  ` : ''}
</div>

<!-- DATOS DEL TITULAR - VERSIÓN COMPACTA DESPUÉS DEL PLAN -->
<div class="seccion" style="margin: 6px 0; padding: 4px;">
  <div class="seccion-titulo"> DATOS DEL TITULAR</div>
  <div class="seccion-contenido" style="padding: 4px;">
    <div class="datos-grid" style="grid-template-columns: repeat(6, 1fr); gap: 2px;">
      <div class="campo" style="margin-bottom: 0px;">
        <div class="campo-label" style="font-size: 7.5px;">Nombre</div>
        <div class="campo-valor" style="font-size: 7.5px;">${nombreTitular}</div>
      </div>
      <div class="campo" style="margin-bottom: 0px;">
        <div class="campo-label" style="font-size: 7.5px;">DNI</div>
        <div class="campo-valor" style="font-size: 7.5px;">${mostrarDato(datosPersonales.dni || datosPersonales.dni_cuil?.split('/')[0] || '')}</div>
      </div>
      <div class="campo" style="margin-bottom: 0px;">
        <div class="campo-label" style="font-size: 7.5px;">CUIL</div>
        <div class="campo-valor" style="font-size: 7.5px;">${mostrarDato(datosPersonales.cuil || datosPersonales.dni_cuil?.split('/')[1] || '')}</div>
      </div>
      <div class="campo" style="margin-bottom: 0px;">
        <div class="campo-label" style="font-size: 7.5px;">Edad</div>
        <div class="campo-valor" style="font-size: 7.5px;">${mostrarDato(datosPersonales.edad)} años</div>
      </div>
      <div class="campo" style="margin-bottom: 0px;">
        <div class="campo-label" style="font-size: 7.5px;">Fecha Nac.</div>
        <div class="campo-valor" style="font-size: 7.5px;">${formatearFecha(datosPersonales.fecha_nacimiento)}</div>
      </div>
      <div class="campo" style="margin-bottom: 0px;">
        <div class="campo-label" style="font-size: 7.5px;">Sexo</div>
        <div class="campo-valor" style="font-size: 7.5px;">${mostrarDato(datosPersonales.sexo)}</div>
      </div>
      <div class="campo" style="margin-bottom: 0px;">
        <div class="campo-label" style="font-size: 7.5px;">Est. Civil</div>
        <div class="campo-valor" style="font-size: 7.5px;">${mostrarDato(datosPersonales.estado_civil)}</div>
      </div>
      <div class="campo" style="margin-bottom: 0px;">
        <div class="campo-label" style="font-size: 7.5px;">Cond. IVA</div>
        <div class="campo-valor" style="font-size: 7.5px;">${mostrarDato(datosPersonales.condicion_iva)}</div>
      </div>
      <div class="campo" style="margin-bottom: 0px; grid-column: span 2;">
        <div class="campo-label" style="font-size: 7.5px;">Email</div>
        <div class="campo-valor" style="font-size: 7.5px;">${mostrarDato(datosPersonales.email || poliza.prospecto_email)}</div>
      </div>
      <div class="campo" style="margin-bottom: 0px; grid-column: span 2;">
        <div class="campo-label" style="font-size: 7.5px;">Teléfono</div>
        <div class="campo-valor" style="font-size: 7.5px;">${mostrarDato(datosPersonales.telefono || poliza.prospecto_telefono)}</div>
      </div>
      <div class="campo" style="margin-bottom: 0px; grid-column: span 2;">
        <div class="campo-label" style="font-size: 7.5px;">Dirección</div>
        <div class="campo-valor" style="font-size: 7.5px;">${mostrarDato(datosPersonales.direccion)} ${mostrarDato(datosPersonales.numero, '')}</div>
      </div>
      <div class="campo" style="margin-bottom: 0px; grid-column: span 2;">
        <div class="campo-label" style="font-size: 7.5px;">Localidad</div>
        <div class="campo-valor" style="font-size: 7.5px;">${mostrarDato(datosPersonales.localidad || poliza.prospecto_localidad)}</div>
      </div>
      <div class="campo" style="margin-bottom: 0px;">
        <div class="campo-label" style="font-size: 7.5px;">Cod. Postal</div>
        <div class="campo-valor" style="font-size: 7.5px;">${mostrarDato(datosPersonales.cod_postal)}</div>
      </div>
      <div class="campo" style="margin-bottom: 1px;">
        <div class="campo-label" style="font-size: 7.5px;">Nacionalidad</div>
        <div class="campo-valor" style="font-size: 7.5px;">${mostrarDato(datosPersonales.nacionalidad)}</div>
      </div>
    </div>
  </div>
</div>

<!-- DATOS PERSONALES DE INTEGRANTES - TABLA PROFESIONAL DESPUÉS DE TITULAR -->
${integrantes.length > 0 ? `
<div class="seccion" style="margin: 8px 0;">
  <div class="seccion-titulo"> DATOS PERSONALES DE INTEGRANTES</div>
  <div class="seccion-contenido">
    <table class="tabla-profesional">
      <thead>
        <tr>
          <th>Categoría</th>
          <th>Nombre y Apellido</th>
          <th>DNI</th>
          <th>CUIL</th>
          <th>Fecha Nac.</th>
          <th>Edad</th>
          <th>Sexo</th>
          <th>Email</th>
          <th>Teléfono</th>
        </tr>
      </thead>
      <tbody>
        ${(() => {
          // Ordenar integrantes igual que en la tabla anterior
          const integrantesOrdenados = [...integrantes].sort((a, b) => {
            const vinculoA = (a.vinculo || a.relacion || '').toLowerCase();
            const vinculoB = (b.vinculo || b.relacion || '').toLowerCase();
            
            if (vinculoA === 'matrimonio' || vinculoA === 'cónyuge' || vinculoA === 'conyuge') return -1;
            if (vinculoB === 'matrimonio' || vinculoB === 'cónyuge' || vinculoB === 'conyuge') return 1;
            return 0;
          });

          return integrantesOrdenados.map((integrante, idx) => `
          <tr>
            <td style="text-align: left;">${mostrarDato(
              (integrante.vinculo || integrante.relacion || 'Integrante').toLowerCase() === 'matrimonio' 
                ? 'Cónyuge' 
                : (integrante.vinculo || integrante.relacion || 'Integrante')
            )}</td>
            <td style="text-align: left;">${mostrarDato((integrante.nombre || '') + ' ' + (integrante.apellido || '').trim())}</td>
            <td>${mostrarDato(integrante.dni || integrante.dni_cuil?.split('/')[0] || '')}</td>
            <td>${mostrarDato(integrante.cuil || integrante.dni_cuil?.split('/')[1] || '')}</td>
            <td>${formatearFecha(integrante.fecha_nacimiento)}</td>
            <td>${mostrarDato(integrante.edad)} años</td>
            <td>${mostrarDato(integrante.sexo)}</td>
            <td style="text-align: left; font-size: 8px;">${mostrarDato(integrante.email || '—')}</td>
            <td style="text-align: left; font-size: 8px;">${mostrarDato(integrante.telefono || integrante.numero_contacto || '—')}</td>
          </tr>
          `).join('');
        })()}
      </tbody>
    </table>
  </div>
</div>
` : ''}



          <!-- CONDICIONES GENERALES DE AFILIACIÓN - PÁGINA COMPLETA -->
          <div class="page-break">
              
              <!-- HEADER CORPORATIVO IGUAL A HOJA 1 -->
              <div class="header-corporativo">
                 <div class="logo-empresa">
    <img src="${logoBase64}" alt="COBER Medicina Privada" style="width: 120px; height: auto; display: block;" />
</div>
                  <div class="info-poliza">
                      <div class="numero-poliza">Condiciones Generales de Afiliación</div>
                      <div>Póliza N° ${poliza.numero_poliza_oficial || poliza.numero_poliza || 'Temporal'}</div>
                      <div>Fecha Solicitud: ${fechaSolicitudMostrada}</div>
                  </div>
              </div>
              
              <!-- CONDICIONES GENERALES DE AFILIACIÓN -->
              <div class="seccion" style="margin-bottom: 10px;">
                  <div class="seccion-titulo"> CONDICIONES GENERALES DE AFILIACIÓN</div>
                  <div class="seccion-contenido">
                      <div style="font-size: 8px; line-height: 1.4; text-align: justify; margin-bottom: 6px;">
                          <p style="margin-bottom: 8px;"><strong>Las condiciones generales de afiliación que aquí se detallan son las más importantes del Contrato General de Afiliación</strong> a efectos que el afiliado pueda tener un resumen disponible y transparente de las condiciones centrales que rigen su cobertura. Esto es sin perjuicio del contenido completo del Contrato General de Afiliación (o reglamento general de afiliación) que ha sido entregado al afiliado y complementa este resumen.</p>
                          
                          <p style="margin-bottom: 8px;">Estas normas son comunes a todos los planes de LA PREPAGA y se complementan y/o modifican con las condiciones particulares de cada plan en su respectiva "Tabla de Beneficios y Anexos". LA PREPAGA ofrece planes de cobertura médico asistencial para brindar un servicio eficiente. El asociado recibe una credencial personal e intransferible para acceder a los servicios contratados de su plan, ya sea a través de los profesionales y centros de la cartilla o por reintegro de gastos, dependiendo del plan.</p>
                          
                          <p style="margin-bottom: 8px;">Durante el periodo de afiliación, las prestaciones solicitadas deben ajustarse a lo establecido en el Reglamento General, la Tabla de Beneficios, las normativas de cada plan y la Cartilla de Prestadores. Las prestaciones no incluidas en la Tabla de Beneficios que excedan el Programa Médico Obligatorio (PMO) serán a cargo del asociado. En caso de ser cubiertas por LA PREPAGA, requerirán autorización y derivación exclusiva de esta, asegurando la prestación en los prestadores contratados.</p>
                          
                          <h3 style="color: #8B7EC8; font-weight: bold; font-size: 9px; margin: 10px 0 5px 0;">Coberturas del Sistema Cerrado</h3>
                          <p style="margin-bottom: 8px;">Es un sistema en el que el afiliado es atendido integralmente por los prestadores de la Cartilla Médica y boletines informativos. Las recetas para medicamentos deben ser de médicos de la Cartilla de Prestadores. Este sistema no admite reintegros, salvo autorización previa de la auditoría médica. Las prestaciones se brindan a través de un Sistema Cerrado mediante la contratación de Planes Superadores.</p>
                          
                          <h3 style="color: #8B7EC8; font-weight: bold; font-size: 9px; margin: 10px 0 5px 0;">Sistema de Atención Directa</h3>
                          <p style="margin-bottom: 8px;">Este sistema se aplica cuando la naturaleza de la enfermedad requiere tratamientos, diagnósticos y medicaciones con normas especiales. Para enfermedades oncológicas, diabetes, VIH, discapacidad, alto costo, o trasplantes que requieran insumos y prótesis de gran impacto, el afiliado debe contactar a LA PREPAGA para recibir asesoramiento.</p>
                          
                          <h3 style="color: #8B7EC8; font-weight: bold; font-size: 9px; margin: 10px 0 5px 0;">Segunda opinión médica e interconsulta multidisciplinaria</h3>
                          <p style="margin-bottom: 8px;">LA PREPAGA se reserva el derecho de organizar una segunda opinión médica con profesionales de su selección cuando la auditoría médica lo considere necesario. Si el afiliado no asiste o rechaza la segunda opinión, se considerará que decidió atenderse fuera del sistema de cobertura a su cargo.</p>
                          
                          <h3 style="color: #8B7EC8; font-weight: bold; font-size: 9px; margin: 10px 0 5px 0;">Internaciones</h3>
                          <p style="margin-bottom: 8px;">Toda internación programada debe ser solicitada por un médico o institución de cartilla y autorizada por LA PREPAGA antes de la fecha prevista. LA PREPAGA puede solicitar documentación adicional y la asignación del centro de internación y el tipo de habitación (individual o compartida) dependerá de la disponibilidad.</p>
                          
                          <h3 style="color: #8B7EC8; font-weight: bold; font-size: 9px; margin: 10px 0 5px 0;">Cambios de plan</h3>
                          <p style="margin-bottom: 8px;">El asociado puede solicitar un cambio de plan, el cual está sujeto a la aprobación de LA PREPAGA. Los cambios solo se aceptarán si no existen saldos pendientes. Quienes modifiquen sus planes estarán sujetos a los tiempos de espera, exclusiones y limitaciones del nuevo plan.</p>
                          
                          <h3 style="color: #8B7EC8; font-weight: bold; font-size: 9px; margin: 10px 0 5px 0;">Enfermedades Preexistentes</h3>
                          <p style="margin-bottom: 8px;">LA PREPAGA solo cubre enfermedades preexistentes si fueron declaradas y aceptadas por la prepaga. En este caso, se determinará una cuota diferencial. Es obligación del interesado declarar si algún miembro del grupo familiar tiene una enfermedad que pueda requerir estudios o tratamientos.</p>
                          
                          <h3 style="color: #8B7EC8; font-weight: bold; font-size: 9px; margin: 10px 0 5px 0;">Precio y pago de los servicios</h3>
                          <p style="margin-bottom: 8px;"><strong>Las cuotas se abonan de forma adelantada del 1 al 10 de cada mes.</strong> La falta de pago de una cuota implica morosidad y autoriza a LA PREPAGA a limitar las prestaciones al Sistema de Cobertura Cerrado y de Atención Directa, según el PMO, sin previa intimación.</p>
                          
                          <h3 style="color: #8B7EC8; font-weight: bold; font-size: 9px; margin: 10px 0 5px 0;">Categorías y cambios de categoría</h3>
                          <p style="margin-bottom: 8px;">LA PREPAGA puede modificar el valor de las cuotas con previa autorización de la Superintendencia de Servicios de Salud. La modificación se informará con al menos 30 días de anticipación, y el afiliado puede rescindir el contrato sin cargo si no la acepta. Los valores de las cuotas también pueden modificarse según la cantidad y la edad de los integrantes del grupo, con cambios de categoría a los 21, 31, 41, 51 y 61 años.</p>
                          
                          <h3 style="color: #8B7EC8; font-weight: bold; font-size: 9px; margin: 10px 0 5px 0;">Renuncia o cancelación del servicio</h3>
                          <p style="margin-bottom: 8px;">El asociado puede renunciar en cualquier momento y por cualquier motivo, lo que implica la desvinculación de todo el grupo familiar. La renuncia suspende todos los beneficios y coberturas y requiere la devolución de las credenciales. Para renunciar, se deben haber abonado las cuotas del mes en curso, los meses anteriores y no tener deudas.</p>
                          
                          <p style="margin-bottom: 5px;"><strong>LA PREPAGA puede cancelar la afiliación con causa justificada, como:</strong></p>
                          <ul style="margin: 0 0 8px 14px; font-size: 8px; line-height: 1.3;">
                              <li>Trato ofensivo al personal o profesionales.</li>
                              <li>Uso de la credencial en mora.</li>
                              <li>Permitir a terceros usar la credencial o requerir servicios para no asociados.</li>
                              <li>Falsedad o fraude en la Declaración Jurada de Salud.</li>
                              <li>Falta de pago por tres meses consecutivos.</li>
                          </ul>
                          
                          <h3 style="color: #8B7EC8; font-weight: bold; font-size: 9px; margin: 10px 0 5px 0;">Afiliaciones corporativas y Cartilla Médica</h3>
                          <p style="margin-bottom: 8px;">Cualquier modificación en las condiciones de trabajo del afiliado titular obligatorio debe ser informada a LA PREPAGA. El afiliado puede solicitar la continuidad de la afiliación dentro de los 60 días corridos de finalizado el contrato corporativo. LA PREPAGA puede modificar el listado de prestadores siempre que el contenido de la cobertura no se altere y el menú prestacional se mantenga disponible.</p>
                      </div>
                  </div>
              </div>
          </div>

          ${cuestionarioSalud.length > 0 || Object.keys(respuestasSalud).length > 0 ? `
          <!-- DECLARACIÓN JURADA DE SALUD - HOJA 3 CON DISEÑO CONSISTENTE -->
          <div class="page-break">
              
              <!-- HEADER CORPORATIVO IGUAL A HOJA 1 -->
              <div class="header-corporativo">
                 <div class="logo-empresa">
    <img src="${logoBase64}" alt="COBER Medicina Privada" style="width: 120px; height: auto; display: block;" />
</div>
                  <div class="info-poliza">
                      <div class="numero-poliza">Declaración Jurada de Salud</div>
                      <div>Póliza N° ${poliza.numero_poliza_oficial || poliza.numero_poliza || 'Temporal'}</div>
                      <div>Fecha Solicitud: ${fechaSolicitudMostrada}</div>
                  </div>
              </div>
              
              <!-- SUBTÍTULO PROFESIONAL -->
              <div class="seccion">
                  <div class="seccion-titulo"> DECLARACIÓN JURADA DE SALUD</div>
                  <div class="seccion-contenido">
                      <div style="font-size: 8px; line-height: 1.3; text-align: justify; margin-bottom: 10px;">
                          <strong>Su salud es muy importante para nosotros</strong> y le agradecemos habernos elegido para cuidar de ella. 
                          A continuación, hallará un listado de preguntas que nos brindará una síntesis de sus antecedentes en este tema. 
                          Por favor, respóndalas con absoluta responsabilidad, marcando la opción que corresponda con un <strong>Sí</strong> o un <strong>No</strong>, 
                          y efectuando las observaciones que correspondan y sean relevantes a los efectos de esta Declaración Jurada de Salud.
                          <br><br>
                          <strong style="color: #8B7EC8;">Muchas gracias por su aporte personal</strong>
                      </div>
                  </div>
              </div>
              
              <!-- DETALLE GRUPO FAMILIAR - ESTILO CONSISTENTE -->
              <div class="seccion">
                  <div class="seccion-titulo"> DETALLE DEL GRUPO FAMILIAR</div>
                  <div class="seccion-contenido">
                      <table class="tabla-profesional">
                          <thead>
                              <tr>
                                  <th>Categoría</th>
                                  <th>Nombre y Apellido</th>
                                  <th>Edad</th>
                                  <th>Peso (kg)</th>
                                  <th>Altura (cm)</th>
                                  <th>IMC</th>
                              </tr>
                          </thead>
                          <tbody>
                              <tr>
                                  <td style="font-weight: bold; text-align: left;">Titular</td>
                                  <td style="text-align: left; font-weight: bold;">${nombreTitular}</td>
                                  <td>${mostrarDato(datosAdicionales.edad || '', 'No especificado')}</td>
                                  <td>${mostrarDato(datosAdicionales.peso || datosAdicionales.titular_peso, 'No especificado')}</td>
                                  <td>${mostrarDato(datosAdicionales.altura || datosAdicionales.titular_altura, 'No especificado')}</td>
                                  <td>${(() => {
                                    const peso = parseFloat(datosAdicionales.peso || datosAdicionales.titular_peso);
                                    const altura = parseFloat(datosAdicionales.altura || datosAdicionales.titular_altura);
                                    if (peso && altura && !isNaN(peso) && !isNaN(altura)) {
                                      // Si altura >= 3 está en cm, si < 3 ya está en metros
                                      const alturaMetros = altura >= 3 ? altura / 100 : altura;
                                      const imc = (peso / (alturaMetros ** 2)).toFixed(1);
                                      return imc;
                                    }
                                    return 'No especificado';
                                  })()}</td>
                              </tr>
                              ${(() => {
                                // Ordenar integrantes: Cónyuge primero, después los demás
                                const integrantesOrdenados = [...integrantes].sort((a, b) => {
                                  const vinculoA = (a.vinculo || a.relacion || '').toLowerCase();
                                  const vinculoB = (b.vinculo || b.relacion || '').toLowerCase();
                                  
                                  if (vinculoA === 'matrimonio' || vinculoA === 'cónyuge' || vinculoA === 'conyuge') return -1;
                                  if (vinculoB === 'matrimonio' || vinculoB === 'cónyuge' || vinculoB === 'conyuge') return 1;
                                  return 0;
                                });
                                
                                return integrantesOrdenados.map(integrante => `
                              <tr>
                                  <td style="text-align: left;">${mostrarDato(
                                    (integrante.vinculo || integrante.relacion || 'Integrante').toLowerCase() === 'matrimonio' 
                                      ? 'Cónyuge' 
                                      : (integrante.vinculo || integrante.relacion || 'Integrante')
                                  )}</td>
                                  <td style="text-align: left;">${mostrarDato((integrante.nombre || '') + ' ' + (integrante.apellido || '').trim())}</td>
                                  <td>${mostrarDato(integrante.edad || '', 'No especificado')}</td>
                                  <td>${mostrarDato(integrante.peso, 'No especificado')}</td>
                                  <td>${mostrarDato(integrante.altura, 'No especificado')}</td>
                                  <td>${(() => {
                                    const peso = parseFloat(integrante.peso);
                                    const altura = parseFloat(integrante.altura);
                                    if (peso && altura && !isNaN(peso) && !isNaN(altura)) {
                                      // Si altura >= 3 está en cm, si < 3 ya está en metros
                                      const alturaMetros = altura >= 3 ? altura / 100 : altura;
                                      const imc = (peso / (alturaMetros ** 2)).toFixed(1);
                                      return imc;
                                    }
                                    return 'No especificado';
                                  })()}</td>
                              </tr>
                              `).join('');
                              })()}
                              ${[...Array(Math.max(0, 3 - integrantes.length))].map(() => `
                              <tr>
                                  <td style="height: 20px; color: #ccc; font-style: italic; text-align: left;">Espacio disponible</td>
                                  <td></td>
                                  <td></td>
                                  <td></td>
                                  <td></td>
                                  <td></td>
                              </tr>
                              `).join('')}
                          </tbody>
                      </table>
                  </div>
              </div>

              <!-- REFERENCIAS - ESTILO CONSISTENTE -->
              <div class="seccion">
                  <div class="seccion-titulo">📞 REFERENCIAS DE CONTACTO</div>
                  <div class="seccion-contenido">
                      <div style="font-size: 7px; margin-bottom: 8px; font-style: italic; color: #6c757d;">
                          Deberá consignar datos de 3 (tres) referencias de contacto para comunicar en caso de ser necesario
                      </div>
                      
                      <table class="tabla-profesional">
                          <thead>
                              <tr>
                                  <th>Nombre y Apellido</th>
                                  <th>Relación</th>
                                  <th>Tel de contacto</th>
                              </tr>
                          </thead>
                          <tbody>
                              ${referencias.slice(0, 3).map(referencia => `
                              <tr>
                                  <td style="text-align: left;">${mostrarDato(`${referencia.nombre} ${referencia.apellido || ''}`.trim())}</td>
                                  <td style="text-align: left;">${mostrarDato(referencia.relacion || referencia.vinculo)}</td>
                                  <td>${mostrarDato(referencia.telefono || referencia.numero_contacto)}</td>
                              </tr>
                              `).join('')}
                              ${[...Array(Math.max(0, 3 - referencias.length))].map(() => `
                              <tr>
                                  <td style="height: 20px; color: #ccc; font-style: italic; text-align: left;">Espacio para completar</td>
                                  <td></td>
                                  <td></td>
                              </tr>
                              `).join('')}
                          </tbody>
                      </table>
                  </div>
              </div>
              
              <!-- INSTRUCCIONES - ESTILO CONSISTENTE -->
              <div class="seccion">
                  <div class="seccion-titulo"> INSTRUCCIONES</div>
                  <div class="seccion-contenido">
                      <div style="font-size: 7px; line-height: 1.3; text-align: justify, margin-bottom: 8px;">
                          Indique <strong>Sí</strong> o <strong>No</strong> en el siguiente detalle, indicando en el caso que corresponda el N° del o de los integrantes 
                          declarados precedentemente sobre los cuales esté efectuando la aclaración. Consigne en la columna <strong>DECLARACIÓN / OBSERVACIONES</strong> 
                          todo el detalle relevante respecto de la declaración efectuada, en los casos que corresponda.
                      </div>
                      
                      <div style="font-size: 7px; line-height: 1.3; text-align: justify; padding: 6px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #8B7EC8;">
                          <strong> IMPORTANTE:</strong> Recuerde que la información volcada corresponde al titular del grupo familiar y sus miembros, 
                          en el caso que la respuesta sea <strong>NO</strong> la misma se entenderá como extensiva a todos los miembros del grupo declarado. 
                          En el caso que sea <strong>Sí</strong>, la misma deberá extenderse consignando el número del integrante del grupo, 
                          identificando las aclaraciones del caso.
                      </div>
                  </div>
              </div>

          </div>  <!-- Fin de la página 2 -->

          <!-- CUESTIONARIO DETALLADO POR INTEGRANTE - NUEVA PÁGINA CON FORMATO DE 4 COLUMNAS -->
          ${(() => {
          // ✅ CORRECCIÓN: Asignar índice original (basado en posición en BD) ANTES de ordenar.
          // respuestasSalud usa estos índices originales; si los reasignamos post-sort, la lectura
          // de respuestas queda desfasada (ej: cónyuge con datos de hijo1, pablo con datos de cónyuge).
          const integrantesConIndiceOriginal = (integrantes || []).map((int, idx) => ({
            nombre: int.nombre || 'Sin nombre',
            apellido: int.apellido || '',
            vinculo: int.vinculo || 'Familiar',
            peso: int.peso,
            altura: int.altura,
            index: idx + 1  // índice original 1-based (coincide con respuestasSalud keys)
          }));

          // Ordenar integrantes para visualización: Cónyuge primero, después los demás
          const integrantesOrdenados = [...integrantesConIndiceOriginal].sort((a, b) => {
            const vinculoA = (a.vinculo || '').toLowerCase();
            const vinculoB = (b.vinculo || '').toLowerCase();
            
            if (vinculoA === 'matrimonio' || vinculoA === 'cónyuge' || vinculoA === 'conyuge') return -1;
            if (vinculoB === 'matrimonio' || vinculoB === 'cónyuge' || vinculoB === 'conyuge') return 1;
            return 0;
          });
          
          const todosIntegrantes = [
            {
              nombre: datosPersonales?.nombre || 'Titular',
              apellido: datosPersonales?.apellido || '',
              vinculo: 'Titular',
              index: 0
            },
            ...integrantesOrdenados  // índice ya asignado antes del sort, NO se reasigna
          ];

          const esUltimoIntegrante = (idx) => idx === todosIntegrantes.length - 1;
          
          return todosIntegrantes.map((integrante, integranteIdx) => `
              ${integranteIdx > 0 ? '<div class="page-break"></div>' : '<div class="page-break"></div>'}
              
              
              <!-- HEADER CORPORATIVO CONSISTENTE -->
              <div class="header-corporativo">
                <div class="logo-empresa">
                  <img src="${logoBase64}" alt="COBER Medicina Privada" style="width: 120px; height: auto; display: block;" />
                </div>
                <div class="info-poliza">
                  <div class="numero-poliza">Póliza N° ${poliza.numero_poliza_oficial || poliza.numero_poliza || 'Temporal'}</div>
                  <div>Fecha Solicitud: ${fechaSolicitudMostrada}</div>
                </div>
              </div>
              
              <!-- CUESTIONARIO INDIVIDUAL CON FORMATO DE 4 COLUMNAS -->
              <div class="seccion">
                <div class="seccion-titulo"> CUESTIONARIO DE SALUD - ${integrante.nombre.toUpperCase()} ${integrante.apellido.toUpperCase()} (${(() => {
                  const vinculo = integrante.vinculo || 'Familiar';
                  return vinculo.toLowerCase() === 'matrimonio' ? 'CÓNYUGE' : vinculo.toUpperCase();
                })()})</div>
                <div class="seccion-contenido">
                  <div style="font-size: 7px; margin-bottom: 8px; font-style: italic; color: #6c757d;">
                    Responda con absoluta veracidad cada pregunta marcando SÍ o NO. En caso afirmativo, detalle la información en la columna de observaciones.
                  </div>
                  
                  <table class="tabla-profesional">
                    <thead>
                      <tr>
                        <th class="pregunta-col">PREGUNTA</th>
                        <th class="si-col">SÍ</th>
                        <th class="no-col">NO</th>
                        <th class="obs-col">DECLARACIÓN / OBSERVACIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${preguntasSalud.map(pregunta => {
            // ✅ BUSCAR RESPUESTA CORRECTAMENTE SEGÚN LA ESTRUCTURA REAL
            const integranteIndex = String(integrante.index);
            console.log(`🔍 Buscando respuesta para integrante ${integranteIndex}, pregunta ${pregunta.id}`);
            
            // Obtener respuestas del integrante específico
            const respuestasIntegrante = respuestasSalud[integranteIndex] || {};
            const resp = respuestasIntegrante[pregunta.id];
            
            console.log(`📝 Respuesta encontrada para ${pregunta.id}:`, resp);
            
            // ✅ VERIFICAR SI ES "SÍ" - CORREGIDO
            const esSi = resp?.respuesta === 'si' ||
              resp?.respuesta === 'sí' ||
              resp?.respuesta === 'Si' ||
              resp?.respuesta === 'SI' ||
              resp?.respuesta === true ||
              resp?.respuesta === 'true' ||
              resp?.respuesta === 1;

            // ✅ VERIFICAR SI ES "NO"
            const esNo = resp?.respuesta === 'no' ||
              resp?.respuesta === 'No' ||
              resp?.respuesta === 'NO' ||
              resp?.respuesta === false ||
              resp?.respuesta === 'false' ||
              resp?.respuesta === 0 ||
              (!resp || !resp.respuesta);

            // ✅ DEBUGGING ESPECÍFICO PARA RESPUESTAS "SÍ"
            if (esSi) {
              console.log(`🟢 RESPUESTA SÍ ENCONTRADA - Pregunta: ${pregunta.id}, Detalle: ${resp?.detalle}`);
            }

            console.log(`✅ Pregunta: ${pregunta.pregunta}, Es Sí: ${esSi}, Es No: ${esNo}, Detalle: ${resp?.detalle || ''}`);

            // ✅ La observación solo aplica a respuestas "SÍ". Si el vendedor marcó SÍ, cargó
            // el detalle y luego volvió a NO, el texto queda guardado y confunde en el PDF.
            const detalleObservacion = esSi ? (resp?.detalle || '') : '';

            return `
                          <tr>
                            <td class="pregunta-col">${pregunta.pregunta}</td>
                            <td class="si-col">
                              <div class="checkbox-visual ${esSi ? 'marcado' : ''}"></div>
                            </td>
                            <td class="no-col">
                              <div class="checkbox-visual ${esNo ? 'marcado' : ''}"></div>
                            </td>
                            <td class="obs-col">${mostrarDato(detalleObservacion, '')}</td>
                          </tr>
                        `;
          }).join('')}
                      
                      <!-- ÚLTIMA FECHA DE MENSTRUACIÓN (solo para mujeres) -->
                      ${(
              (integrante.vinculo === "Titular" && datosPersonales?.sexo === "femenino") ||
              (integrante.vinculo !== "Titular" && integrantes?.[integrante.index - 1]?.sexo === "femenino")
            ) ? `
                      <tr style="background: #fff3cd;">
                        <td class="pregunta-col" style="font-weight: bold;">ÚLTIMA FECHA DE MENSTRUACIÓN</td>
                        <td class="si-col">-</td>
                        <td class="no-col">-</td>
                        <td class="obs-col">${(() => {
                          const integranteIndex = String(integrante.index);
                          const datos = respuestasSalud[integranteIndex]?.ultima_menstruacion || {};
                          const corresponde = datos.corresponde ?? 'si';
                          
                          // Si NO corresponde, mostrar el detalle (ej: "Menopausia")
                          if (corresponde === 'no') {
                            return datos.detalle ? `No corresponde - ${datos.detalle}` : 'No corresponde';
                          }
                          
                          // Si corresponde, mostrar la fecha
                          const ultimaMenstruacion = typeof datos === 'string' ? datos : (datos.respuesta || '');
                          if (ultimaMenstruacion && ultimaMenstruacion !== '') {
                            const matchISO = String(ultimaMenstruacion).match(/^(\d{4})-(\d{2})-(\d{2})/);
                            if (matchISO) {
                              return `${matchISO[3]}/${matchISO[2]}/${matchISO[1]}`;
                            }
                            return ultimaMenstruacion;
                          }
                          return 'No especificada';
                        })()}</td>
                      </tr>
                      ` : ''}
                      
                      <!-- INFORMACIÓN ADICIONAL -->
                      <tr style="background: #f8f9fa;">
                        <td class="pregunta-col" style="font-weight: bold;">MEDICACIÓN ACTUAL</td>
                        <td class="si-col">-</td>
                        <td class="no-col">-</td>
                        <td class="obs-col">${(() => {
                          // ✅ CORREGIDO: Acceder a medicación por integrante específico
                          const integranteIndex = String(integrante.index);
                          const medicacionIntegrante = declaracionSalud.medicacion?.[integranteIndex] ||
                            declaracionSalud.medicacion ||
                            {};
                          
                          // Buscar medicación en varios formatos posibles
                          let medicacionDetalle = '';
                          
                          if (typeof medicacionIntegrante === 'object' && medicacionIntegrante?.detalle) {
                            medicacionDetalle = medicacionIntegrante.detalle;
                          } else if (typeof medicacionIntegrante === 'string') {
                            medicacionDetalle = medicacionIntegrante;
                          } else if (declaracionSalud.medicacion_detalle) {
                            medicacionDetalle = declaracionSalud.medicacion_detalle;
                          }
                          
                          const resultado = medicacionDetalle || 'Ninguna';
                          console.log('💊 Medicación para integrante', integranteIndex, ':', { medicacionIntegrante, resultado });
                          return resultado;
                        })()}</td>
                      </tr>
                      
                      <tr style="background: #f8f9fa;">
                        <td class="pregunta-col" style="font-weight: bold;">COBERTURA MÉDICA ANTERIOR</td>
                        <td class="si-col">-</td>
                        <td class="no-col">-</td>
                        <td class="obs-col">${(() => {
              // ✅ CORREGIDO: Acceder a cobertura por integrante específico
              const integranteIndex = String(integrante.index);
              const coberturaInfo = declaracionSalud.coberturaAnterior?.[integranteIndex] ||
                declaracionSalud.coberturaAnterior ||
                declaracionSalud.cobertura_anterior ||
                {};

              // Buscar en el orden correcto: nombre → cobertura → detalle → mensaje por defecto
              const coberturaTexto = coberturaInfo.nombre ||
                coberturaInfo.cobertura ||
                coberturaInfo.detalle ||
                'Sin cobertura anterior';

              const fechaDesde = coberturaInfo.fecha_desde || '';
              const fechaHasta = coberturaInfo.fecha_hasta || '';
              
              console.log('🏥 Cobertura anterior para integrante', integranteIndex, ':', { coberturaInfo, coberturaTexto, fechaDesde, fechaHasta });

              return `${coberturaTexto} ${fechaDesde ? `(${fechaDesde} - ${fechaHasta})` : ''}`;
            })()}</td>
                      </tr>
                    </tbody>
                  </table>

                  ${(() => {
            const integranteIndex = String(integrante.index);
            const extra = datosAdicionalesPorIntegrante[integranteIndex] || {};
            const declaracionAdicional = (extra.declaracion_adicional || '').trim();
            const medicoTratante = (extra.medico_tratante || '').trim();
            const institucionesAnteriores = (extra.instituciones_anteriores || '').trim();

            if (!declaracionAdicional && !medicoTratante && !institucionesAnteriores) {
              return '';
            }

            return `
                  <div class="seccion-interna" style="margin-top: 8px;">
                    <div class="info-titulo">INFORMACIÓN ADICIONAL</div>
                    <div class="campo" style="margin-bottom: 6px;">
                      <div class="campo-label">¿Deseás declarar algún dato adicional que consideres relevante?</div>
                      <div class="campo-valor" style="white-space: pre-wrap; word-break: break-word;">${mostrarDato(declaracionAdicional, 'No especificado')}</div>
                    </div>
                    <div class="campo" style="margin-bottom: 6px;">
                      <div class="campo-label">¿Contás con un médico de familia o médico tratante?</div>
                      <div class="campo-valor" style="white-space: pre-wrap; word-break: break-word;">${mostrarDato(medicoTratante, 'No especificado')}</div>
                    </div>
                    <div class="campo">
                      <div class="campo-label">Instituciones dónde se ha atendido con anterioridad</div>
                      <div class="campo-valor" style="white-space: pre-wrap; word-break: break-word;">${mostrarDato(institucionesAnteriores, 'No especificado')}</div>
                    </div>
                  </div>
                  `;
          })()}
                </div>
              </div>

          </div>
            `).join('');
        })()}
        
        <!-- DECLARACIÓN JURADA FINAL - UNA SOLA VEZ AL FINAL -->
        <div class="page-break">
            <!-- NÚMERO DE PÁGINA -->
          
            <!-- HEADER CORPORATIVO -->
            <div class="header-corporativo">
                <div class="logo-empresa">
                    <img src="${logoBase64}" alt="COBER Medicina Privada" style="width: 120px; height: auto; display: block;" />
                </div>
                <div class="info-poliza">
                    <div class="numero-poliza">Declaración Jurada Final</div>
                    <div>Póliza N° ${poliza.numero_poliza_oficial || poliza.numero_poliza || 'Temporal'}</div>
                    <div>Fecha Solicitud: ${fechaSolicitudMostrada}</div>
                </div>
            </div>

            <!-- SECCIÓN DECLARACIÓN JURADA -->
            <div class="seccion">
                <div class="seccion-titulo"> DECLARACIÓN JURADA</div>
                <div class="seccion-contenido">
                    <div style="font-size: 9px; line-height: 1.4; text-align: justify; margin-bottom: 15px;">
                        <strong>Declaro bajo juramento que:</strong>
                    </div>
                    
                    <ul style="font-size: 8px; line-height: 1.5; margin-left: 15px; margin-bottom: 20px;">
                        <li style="margin-bottom: 8px;">
                            Entendí cada una de las preguntas y contesté con absoluta verdad.
                        </li>
                        <li style="margin-bottom: 8px;">
                            No omití información ni falseé su contenido.
                        </li>
                        <li style="margin-bottom: 8px;">
                            Entiendo y Acepto que de resultar falsa, omitir o responder con inexactitud, deliberadamente o no sobre mis antecedentes de salud, se invalidará mi condición de afiliado, como las de mi grupo familiar, por lo que respondo con absoluta responsabilidad y titularidad.
                        </li>
                        <li style="margin-bottom: 8px;">
                            Asumo mi responsabilidad por el contenido de las respuestas brindadas, tanto por mí como las de mi grupo de integrantes.
                        </li>
                        <li style="margin-bottom: 8px;">
                            Declaro haberme explicado que la presente acompaña la solicitud de afiliación y que la aprobación de esta última queda sujeta al análisis y dictamen de la Auditoría Médica.
                        </li>
                        <li style="margin-bottom: 8px;">
                            De dejarse espacios en blanco o casilleros sin completar, estos se tomarán como que fueron respondidos negativamente.
                        </li>
                        <li style="margin-bottom: 8px;">
                            Que la presente Declaración Jurada se compone de 3 páginas.
                        </li>
                    </ul>
                </div>
            </div>


            <!-- SECCIÓN DE FIRMAS FINAL -->
            <div style="margin-top: 30px;">
                <!-- Ciudad y Fecha en la misma línea -->
                <div style="display: flex; align-items: center; gap: 15mm; margin-bottom: 20px; font-size: 8px;">
                    <span>Ciudad de</span>
                    <span style="border-bottom: 1px solid #333; width: 60mm; display: inline-block; margin: 0 5mm; text-align: center; padding-top: 2px;">CABA</span>
                    <span>,</span>
                    <span style="border-bottom: 1px solid #333; width: 120mm; display: inline-block; margin: 0 5mm; text-align: center; padding-top: 2px;">${(() => {
                      // Obtener fecha actual
                      const hoy = new Date();
                      const dia = String(hoy.getDate()).padStart(2, '0');
                      const nombreMeses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                      const nombreMes = nombreMeses[hoy.getMonth()];
                      const anio = hoy.getFullYear();
                      return `${dia} del ${nombreMes} del ${anio}`;
                    })()}</span>
                </div>
                
                <!-- Recuadro unificado: Firma y aclaración a la izquierda, Leyenda legal a la derecha -->
                <div style="border: 2px solid #8B7EC8; border-radius: 8px; padding: 22px 25px; background: #fafafa; margin-bottom: 15px; min-height: 155px;">
                    <div style="display: grid; grid-template-columns: 37% 63%; gap: 22px; align-items: center;">
                        <!-- Columna izquierda: Firma y aclaración del titular -->
                        <div>
                            <div style="font-weight: bold; color: #8B7EC8; text-align: center; margin-bottom: 12px; font-size: 9px;">
                                Firma y aclaración del Titular
                            </div>
                            
                            <!-- Fila 1: Firma titular y Tipo de documento -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">
                                <div>
                                    <div style="font-size: 7px; color: #666; margin-bottom: 3px;">Firma titular</div>
                                    <div style="border-bottom: 1px solid #666; height: 20px;"></div>
                                </div>
                                <div>
                                    <div style="font-size: 7px; color: #666; margin-bottom: 3px;">Tipo Documento</div>
                                    <div style="border-bottom: 1px solid #666; height: 20px; text-align: center; padding-top: 2px; font-size: 8px;">DNI</div>
                                </div>
                            </div>
                            
                            <!-- Fila 2: Aclaración y Número de documento -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                <div>
                                    <div style="font-size: 7px; color: #666; margin-bottom: 3px;">Aclaración</div>
                                    <div style="border-bottom: 1px solid #666; height: 20px; text-align: center; padding-top: 2px; font-size: 8px;">${datosPersonales.nombre || ''} ${datosPersonales.apellido || ''}</div>
                                </div>
                                <div>
                                    <div style="font-size: 7px; color: #666; margin-bottom: 3px;">Número documento</div>
                                    <div style="border-bottom: 1px solid #666; height: 20px; text-align: center; padding-top: 2px; font-size: 8px;">${datosPersonales.dni || datosPersonales.dni_cuil?.split('/')[0] || datosPersonales.dni_cuil || ''}</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Columna derecha: Leyenda legal completa -->
                        <div style="padding: 0 10px 0 12px; border-left: 2px solid #d0d0d0; display: flex; flex-direction: column; justify-content: center;">
                            <p style="font-size: 6.8px; line-height: 1.5; text-align: justify; margin: 0 0 10px 0; color: #222;">
                                La firma electrónica que el Socio/usuario otorgue en el presente documento digital implica autenticidad, consentimiento y conformidad con la integridad del contenido afiliatorio por su parte; siendo parte integrante de la Solicitud de ingreso digital pertinente la información que el Socio/usuario brinde respecto de los antecedentes de salud propios y de sus familiares a cargo, al completar la correspondiente declaración jurada.
                            </p>
                            <p style="font-size: 6.8px; line-height: 1.5; text-align: justify; margin: 0; color: #222;">
                                Al realizar el socio/usuario dicha firma digital toma conocimiento que la misma se presume como perteneciente al titular que la emite: el socio/usuario firmante, reconociendo en consecuencia su absoluta veracidad implicando ello voluntad respecto a lo establecido en el documento firmado. Ello, de acuerdo a la Ley 25.506 vigente, y normativa complementaria.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

        </div>

          ` : ''}

        
      </body>
      </html>
    `;
  },

  // ✅ CORREGIR LA FUNCIÓN parsearDatosPoliza
  parsearDatosPoliza(poliza) {
    let datosPersonales = {};
    let referencias = [];
    let declaracionSalud = {};
    let integrantes = [];
    let detalles = [];

    try {
      datosPersonales = typeof poliza.datos_personales === 'string'
        ? JSON.parse(poliza.datos_personales)
        : (poliza.datos_personales || {});

      referencias = typeof poliza.referencias === 'string'
        ? JSON.parse(poliza.referencias)
        : (poliza.referencias || []);

      declaracionSalud = typeof poliza.declaracion_salud === 'string'
        ? JSON.parse(poliza.declaracion_salud)
        : (poliza.declaracion_salud || {});

      // 🔍 DEBUG: Verificar coberturaAnterior y medicacion
      console.log('🏥 DEBUG - Cobertura y Medicación parseadas:', {
        coberturaAnterior: declaracionSalud.coberturaAnterior,
        medicacion: declaracionSalud.medicacion,
        cobertura_anterior: declaracionSalud.cobertura_anterior,
        keys_disponibles: Object.keys(declaracionSalud)
      });

      integrantes = typeof poliza.integrantes === 'string'
        ? JSON.parse(poliza.integrantes)
        : (poliza.integrantes || []);

      // ✅ ENRIQUECER integrantes con peso/altura desde datos_fisicos (mismos índices, ANTES del sort del HTML)
      const datosFisicosIntegrantes = declaracionSalud?.datos_fisicos?.integrantes;
      if (Array.isArray(datosFisicosIntegrantes) && datosFisicosIntegrantes.length > 0) {
        integrantes = integrantes.map((integrante, idx) => {
          const fisico = datosFisicosIntegrantes[idx];
          if (!fisico) return integrante;
          // Solo sobreescribir si los campos no están ya en el objeto integrante
          return {
            ...integrante,
            peso: integrante.peso ?? fisico.peso ?? '',
            altura: integrante.altura ?? fisico.altura ?? ''
          };
        });
        console.log('✅ Integrantes enriquecidos con datos_fisicos:', integrantes.map(i => ({ nombre: i.nombre, peso: i.peso, altura: i.altura })));
      }

      detalles = typeof poliza.detalles === 'string'
        ? JSON.parse(poliza.detalles)
        : (poliza.detalles || []);

      // ✅ ENRIQUECER DETALLES CON DATOS DE INTEGRANTES
      // Mapear nombre y apellido de integrantes a detalles
      if (detalles.length > 0 && integrantes.length > 0) {
        // Rastrear integrantes ya asignados para evitar mapeos duplicados
        // cuando varios detalles tienen el mismo campo "persona" (ej: todos "HIJO")
        const integrantesUsados = new Set();
        detalles = detalles.map((detalle) => {
          // El Titular no se enriquece: el PDF ya usa datosPersonales directamente para él
          const esTitular = (detalle.vinculo || '').toLowerCase() === 'titular';
          if (esTitular) return detalle;

          // Buscar primer integrante no usado que coincida:
          // 1) por persona exacta, 2) por nombre+apellido, 3) por vínculo como último recurso
          let integranteIdx = -1;
          integranteIdx = integrantes.findIndex((int, idx) =>
            !integrantesUsados.has(idx) && int.persona === detalle.persona
          );
          if (integranteIdx === -1) {
            integranteIdx = integrantes.findIndex((int, idx) =>
              !integrantesUsados.has(idx) &&
              `${int.nombre || ''} ${int.apellido || ''}`.trim().toUpperCase() === (detalle.persona || '').toUpperCase()
            );
          }
          if (integranteIdx === -1) {
            integranteIdx = integrantes.findIndex((int, idx) =>
              !integrantesUsados.has(idx) && int.vinculo?.toLowerCase() === detalle.vinculo?.toLowerCase()
            );
          }

          if (integranteIdx !== -1) {
            integrantesUsados.add(integranteIdx);
            const integranteCorrespondiente = integrantes[integranteIdx];
            return {
              ...detalle,
              nombre: integranteCorrespondiente.nombre || detalle.nombre,
              apellido: integranteCorrespondiente.apellido || detalle.apellido,
              persona: `${integranteCorrespondiente.nombre || ''} ${integranteCorrespondiente.apellido || ''}`.trim() || detalle.persona
            };
          }
          return detalle;
        });
        console.log('✅ Detalles enriquecidos con datos de integrantes:', detalles.map(d => ({ persona: d.persona, nombre: d.nombre, apellido: d.apellido })));
      }

           // 🆕 AGREGAR EL PARSING DE LOS 4 NUEVOS CAMPOS QUE FALTAN
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

    // ✅ DEBUG: Verificar datos físicos parseados
    console.log('🔍 DEBUG - Datos físicos encontrados en PDF:', {
      peso_datos_personales: datosPersonales.peso,
      altura_datos_personales: datosPersonales.altura,
      declaracion_datos_fisicos: declaracionSalud.datos_fisicos,
      datos_personales_completos: datosPersonales,
      poliza_raw_preview: {
        datos_personales_length: poliza.datos_personales?.length || 'N/A'
      }
    });

    } catch (parseError) {
      console.error('❌ Error parseando datos JSON:', parseError);
    }

    return { datosPersonales, referencias, declaracionSalud, integrantes, detalles };
  },

  /**
   * Obtiene las coordenadas estándar para la firma en el PDF
   * @param {Object} poliza - Objeto de póliza con integrantes
   * @returns {Object} Coordenadas de firma { pageIndex, x, y }
   */
  obtenerCoordenadasFirma(poliza = null) {
    // Cálculo de páginas del PDF:
    // ESTRUCTURA REAL DEL PDF:
    // Página 0: Datos principales
    // Página 1: Condiciones generales
    // Página 2: Intro declaración jurada + detalle grupo familiar + referencias
    // Página 3+: Cuestionario detallado por integrante (una página por cada integrante)
    // Última página: Declaración final con firmas (página separada)
    
    let totalPaginas = 2; // Páginas 0 y 1 siempre existen
    
    if (poliza) {
      // Verificar si hay cuestionario de salud
      const tieneDeclaracionSalud = poliza.declaracion_salud && 
        (typeof poliza.declaracion_salud === 'string' ? poliza.declaracion_salud !== '{}' : Object.keys(poliza.declaracion_salud).length > 0);
      
      if (tieneDeclaracionSalud) {
        // Parsear integrantes si vienen como string
        let integrantes = [];
        try {
          integrantes = typeof poliza.integrantes === 'string' 
            ? JSON.parse(poliza.integrantes) 
            : (poliza.integrantes || []);
        } catch (e) {
          console.error('❌ Error parseando integrantes:', e);
        }
        
        // +1 página de intro de declaración jurada
        totalPaginas += 1;
        
        // +1 página por cada integrante (titular + familiares)
        const cantidadIntegrantes = 1 + (integrantes.length || 0);
        totalPaginas += cantidadIntegrantes;
        
        // +1 página de declaración final con firmas
        totalPaginas += 1;
        
        console.log(`📄 Páginas de cuestionario: ${cantidadIntegrantes} (1 titular + ${integrantes.length} familiares)`);
        console.log(`📄 Total páginas: ${totalPaginas} (2 base + 1 intro DJ + ${cantidadIntegrantes} cuestionarios + 1 final)`);
      }
    }
    
    // La última página es totalPaginas - 1 (porque el índice empieza en 0)
    const pageIndex = totalPaginas - 1;
    
    console.log(`📍 CÁLCULO FINAL: Total páginas=${totalPaginas}, Índice última página=${pageIndex}`);
    
    // 📐 CÁLCULO DE COORDENADAS EXACTAS PARA EL RECUADRO DE FIRMA
    // Página A4: 595 x 842 puntos (ancho x alto)
    // 
    // Estructura de la última página:
    // - Header corporativo: ~80 puntos
    // - Sección DECLARACIÓN JURADA (título + texto + lista): ~200 puntos
    // - Ciudad y fecha: ~40 puntos
    // - Recuadro de firma comienza: ~340 puntos desde arriba
    // - Padding del recuadro: 22px (~31 puntos)
    // - Título "Firma y aclaración del Titular": ~15 puntos
    // - Campo "Firma titular" comienza: ~386 puntos desde arriba
    //
    // El recuadro tiene 2 columnas: 37% (firma) y 63% (leyenda legal)
    // Columna izquierda tiene ~220 puntos de ancho (595 * 0.37)
    // El campo "Firma titular" está en un grid 50/50 con "Tipo Documento"
    // Por lo tanto, el campo "Firma titular" tiene ~110 puntos de ancho
    //
    // Coordenadas para centrar en el campo "Firma titular":
    // X: Ajustado para centrar en el campo de firma (más a la izquierda)
    // Y: Ajustado para aparecer dentro del campo de firma (más arriba)
    
    const coordenadas = {
      pageIndex: pageIndex,  // Última página calculada dinámicamente
      x: 45,                 // Centro del campo "Firma titular" (ajustado a la izquierda)
      y: 330                 // Centro vertical del campo de firma (ajustado hacia arriba)
    };
    
    console.log(`📍 Coordenadas de firma calculadas: Página ${coordenadas.pageIndex}, X=${coordenadas.x}, Y=${coordenadas.y}`);
    console.log(`📍 La firma aparecerá centrada en el campo "Firma titular" de la columna izquierda`);
    
    return coordenadas;
  }
};

module.exports = PolizaPDFController;
