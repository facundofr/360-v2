# VaFirma Service - Documentación Estandarizada

## Resumen
Servicio Node.js para integración con VaFirma (API v1.5.0). Soporta firma electrónica simple, avanzada y con validación biométrica (reconocimiento facial).

## Configuración

Requiere variables de entorno en `.env`:

```env
VAFIRMA_AUTH_MODE=basic          # o 'bearer' o 'jwt'
VAFIRMA_API_URL=https://api.vafirma.com/api

# Para autenticación Basic
VAFIRMA_USERNAME=tu_usuario
VAFIRMA_PASSWORD=tu_contraseña

# O para Bearer Token
VAFIRMA_BEARER_TOKEN=tu_token

# O para JWT
VAFIRMA_API_KEY=tu_api_key
VAFIRMA_ISSUER=tu_issuer
VAFIRMA_JWT_SECRET=tu_secret
```

## Funciones Disponibles

### 1. solicitarFirma(options)
Envía un documento para ser firmado electrónicamente.

**Parámetros requeridos:**
- `pdfBase64` - Contenido PDF en base64
- `fileName` - Nombre del archivo
- `signerName` - Nombre del firmante
- `signerEmail` - Email del firmante
- `emailSubject` - Asunto del email de notificación

**Parámetros opcionales:**
- `requireBiometric` (boolean) - Si `true`, pide validación facial antes de firmar
- `dni` - DNI del firmante
- `whatsapp` - Teléfono WhatsApp del firmante
- `emailMessage` - Mensaje adicional en email
- `signaturePageIndex` - Página de firma (default: 0)
- `signaturePageX`, `signaturePageY` - Posición (default: 50, 50)

**Retorna:**
```javascript
{
  success: boolean,
  data: Array, // Array con objetos {docUUID, link, signerEmail}
  status: number
}
```

**Ejemplo básico (firma simple sin biometría):**
```javascript
const vaFirmaService = require('./services/vaFirmaSerice');

const resultado = await vaFirmaService.solicitarFirma({
  pdfBase64: pdfEnBase64,
  fileName: 'contrato.pdf',
  signerName: 'Juan Pérez',
  signerEmail: 'juan@example.com',
  emailSubject: 'Contrato para firmar',
  emailMessage: 'Por favor, revisa y firma este contrato.'
});

if (resultado.success) {
  console.log('Documento enviado. DocUUID:', resultado.data[0].docUUID);
}
```

**Ejemplo con validación facial:**
```javascript
const resultado = await vaFirmaService.solicitarFirma({
  pdfBase64: pdfEnBase64,
  fileName: 'contrato.pdf',
  signerName: 'Juan Pérez',
  signerEmail: 'juan@example.com',
  emailSubject: 'Contrato + Validación Facial',
  requireBiometric: true,  // ← Pide foto del rostro
  dni: '12345678',
  whatsapp: '+34600000000'
});

// El usuario recibirá email con:
// 1. Solicitud de validación facial (FACE)
// 2. Luego podrá firmar con firma Simple
```

### 2. consultarEstado(docUUID)
Consulta el estado de un documento enviado para firma.

**Parámetros:**
- `docUUID` - UUID del documento (retornado por `solicitarFirma`)

**Retorna:**
```javascript
{
  success: boolean,
  data: Object, // Información del estado
  status: number
}
```

**Ejemplo:**
```javascript
const estado = await vaFirmaService.consultarEstado('bca4ca97-bba2-4ad6-91cf-91b624815840');
// Estados posibles: 'pending', 'signed', 'rejected', 'expired'
```

### 3. descargarDocumento(docUUID)
Descarga el documento ya firmado en base64.

**Parámetros:**
- `docUUID` - UUID del documento

**Retorna:**
```javascript
{
  success: boolean,
  data: Object, // {document: base64String, ...}
  status: number
}
```

**Ejemplo:**
```javascript
const resultado = await vaFirmaService.descargarDocumento('bca4ca97-bba2-4ad6-91cf-91b624815840');
if (resultado.success) {
  const pdfFirmado = Buffer.from(resultado.data.document, 'base64');
  // Guardar o procesar el PDF firmado
}
```

### 4. crearValidacionBiometrica(options)
Crea una validación biométrica independiente (sin documento).

**Parámetros requeridos:**
- `personName` - Nombre de la persona
- `personEmail` - Email
- `personPhoneNumber` - Teléfono WhatsApp

**Parámetros opcionales:**
- `validationType` - 'FACE' (default) o 'LIVENESS'
- `useGestures` - true/false para gestos adicionales
- `emailSubject`, `emailMessage`
- `ttlToken` - Vigencia en segundos (default: 3600)
- `retries` - Máximo intentos (default: 3)

**Retorna:**
```javascript
{
  success: boolean,
  data: Object, // {bioUUID, link, ...}
  status: number
}
```

**Ejemplo:**
```javascript
const res = await vaFirmaService.crearValidacionBiometrica({
  personName: 'Juan Pérez',
  personEmail: 'juan@example.com',
  personPhoneNumber: '+34600000000',
  validationType: 'FACE',
  useGestures: true,
  emailSubject: 'Valida tu identidad con tu cara'
});

if (res.success) {
  console.log('BioUUID:', res.data.bioUUID);
  console.log('Link:', res.data.link);
}
```

### 5. consultarBiometria(bioUUID)
Consulta el estado de una validación biométrica.

**Parámetros:**
- `bioUUID` - UUID de la validación

**Retorna:**
```javascript
{
  success: boolean,
  data: Object, // Estado y datos
  status: number
}
```

**Ejemplo:**
```javascript
const estado = await vaFirmaService.consultarBiometria('c6d4e538-10d7-42bb-8008-a6c1382d7cb6');
```

## Tipos de Firma Soportados

| Tipo | Subtipo | Descripción |
|------|---------|-------------|
| Simple | Simple | Firma simple sin requisitos adicionales |
| Simple | Biometric | Firma simple + validación facial (foto del rostro) |
| Advanced | Advanced | Firma avanzada con certificado |

**Configuración automática:**
- Si `requireBiometric: true` → automáticamente usa `signatureSubType: 'Biometric'`
- Si `requireBiometric: false` → usa `signatureSubType: 'Simple'`

## Mejores Prácticas

1. **Manejo de errores:**
```javascript
const resultado = await vaFirmaService.solicitarFirma({...});
if (!resultado.success) {
  console.error('Error:', resultado.error);
  console.error('Status:', resultado.status);
}
```

2. **Almacenar docUUID:**
Guarda el `docUUID` en base de datos para poder consultar el estado después:
```javascript
const docUUID = resultado.data[0].docUUID;
await db.documentos.save({
  pdfHashId: generatedId,
  vaFirmaDocUUID: docUUID,
  solicitadoEn: new Date(),
  estado: 'pending'
});
```

3. **Polling de estado:**
```javascript
const verificarEstado = async (docUUID) => {
  let intento = 0;
  const maxIntentos = 30; // 5 minutos con intervalo de 10s
  
  while (intento < maxIntentos) {
    const estado = await vaFirmaService.consultarEstado(docUUID);
    
    if (estado.success && estado.data.status === 'signed') {
      return true; // Firmado
    }
    
    intento++;
    await new Promise(r => setTimeout(r, 10000)); // Esperar 10s
  }
  
  return false; // Timeout
};
```

4. **Webhooks (callback):**
```javascript
const resultado = await vaFirmaService.solicitarFirma({
  ...opciones,
  callbackUrl: 'https://tudominio.com/api/vafirma-callback'
});

// En tu endpoint /api/vafirma-callback recibiras notificaciones
app.post('/api/vafirma-callback', (req, res) => {
  const { docUUID, status } = req.body;
  // Procesar cambio de estado
  res.json({ received: true });
});
```

## Notas Importantes

- **Timeouts:** Las llamadas tienen timeouts de 10-30 segundos
- **Base64:** El PDF debe estar en base64
- **Email:** VaFirma se encarga de enviar los emails de notificación
- **Biometría:** Solo disponible si tu plan incluye validación facial
- **Estado:** Los documentos expiran después de cierto tiempo en VaFirma

## Archivo de Prueba

Para probar el servicio, ejecuta:
```bash
node backend/test_vafirma_simple_plus_face.js
```

## Versión
v1.0 - Estandarizado y listo para producción

## Última actualización
7 de enero de 2026
