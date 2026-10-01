#!/bin/bash

# =====================================================
# Script de prueba para el webhook de WhatsApp mejorado
# =====================================================

echo "🔍 Iniciando pruebas del webhook de WhatsApp..."

# URL del webhook (ajusta según tu configuración)
WEBHOOK_URL="http://localhost:3000/api/webhooks/whatsapp"

# Función para simular mensaje de WhatsApp
test_webhook() {
    local from_number="$1"
    local message="$2"
    local description="$3"
    
    echo ""
    echo "📱 Probando: $description"
    echo "   Número: $from_number"
    echo "   Mensaje: $message"
    
    response=$(curl -s -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "MessageSid=TEST_$(date +%s)" \
        -d "From=whatsapp:+$from_number" \
        -d "To=whatsapp:+16162071267" \
        -d "Body=$message" \
        -d "MessageStatus=received")
    
    echo "   Respuesta: $response"
}

echo ""
echo "🧪 Casos de prueba:"

# Caso 1: Número registrado como prospecto
test_webhook "16162071268" "Hola, tengo una consulta sobre mi cotización" "Número registrado como prospecto"

# Caso 2: Número NO registrado como prospecto
test_webhook "15551234567" "Hola, me interesa un seguro" "Número NO registrado (debe ser ignorado)"

# Caso 3: Segundo mensaje del mismo prospecto
test_webhook "16162071268" "¿Podrían enviarme más información?" "Segundo mensaje del mismo prospecto"

# Caso 4: Número con formato diferente pero del mismo prospecto
test_webhook "1-616-207-1268" "Mensaje con formato diferente" "Mismo prospecto con formato diferente"

echo ""
echo "✅ Pruebas completadas."
echo ""
echo "📊 Para verificar los resultados:"
echo "   1. Revisa los logs del servidor para ver qué mensajes fueron procesados"
echo "   2. Consulta la base de datos para verificar que solo se creó una conversación por prospecto"
echo "   3. Verifica que los mensajes de números no registrados fueron ignorados"
echo ""
echo "🔍 Consultas SQL útiles:"
echo ""
echo "-- Ver conversaciones creadas:"
echo "SELECT c.id, c.numero_conversacion, c.telefono, p.nombre, p.apellido, c.estado"
echo "FROM chat_conversaciones_whatsapp c"
echo "LEFT JOIN prospectos p ON c.prospecto_id = p.id"
echo "ORDER BY c.created_at DESC;"
echo ""
echo "-- Ver mensajes recibidos:"
echo "SELECT m.id, m.conversacion_id, m.mensaje, m.origen, m.created_at"
echo "FROM chat_mensajes m"
echo "JOIN chat_conversaciones_whatsapp c ON m.conversacion_id = c.id"
echo "ORDER BY m.created_at DESC;"
