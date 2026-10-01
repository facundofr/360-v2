#!/bin/bash

# Script para probar la funcionalidad de Back Office
# Archivo: test_backoffice_functionality.sh

echo "🏢 PROBANDO FUNCIONALIDAD DE BACK OFFICE"
echo "========================================"

# Configuración
API_URL="https://wspflows.cober.online/api"
TOKEN=""  # Se necesita token de un usuario con rol Back Office (4)

echo ""
echo "🔐 IMPORTANTE: Este script requiere un token de un usuario con rol Back Office"
echo "Para obtener el token:"
echo "1. Crea un usuario con role = 4 en la base de datos"
echo "2. Haz login y copia el token"
echo "3. Reemplaza la variable TOKEN en este script"
echo ""

if [ -z "$TOKEN" ]; then
    echo "❌ ERROR: No se ha configurado el token"
    echo "Por favor edita este script y agrega un token válido"
    exit 1
fi

echo "🧪 INICIANDO PRUEBAS..."
echo ""

# Test 1: Dashboard de Back Office
echo "📊 Test 1: Dashboard de Back Office"
response=$(curl -s -X GET "${API_URL}/backoffice/dashboard" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

if echo "$response" | grep -q '"success":true'; then
    echo "✅ Dashboard - OK"
    echo "$response" | jq '.data.generales'
else
    echo "❌ Dashboard - FAILED"
    echo "$response"
fi

echo ""

# Test 2: Lista de supervisores
echo "👥 Test 2: Lista de supervisores"
response=$(curl -s -X GET "${API_URL}/backoffice/supervisores" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

if echo "$response" | grep -q '"success":true'; then
    echo "✅ Lista de supervisores - OK"
    supervisores_count=$(echo "$response" | jq '.data | length')
    echo "📈 Total de supervisores: $supervisores_count"
else
    echo "❌ Lista de supervisores - FAILED"
    echo "$response"
fi

echo ""

# Test 3: Vendedores sin supervisor
echo "🆔 Test 3: Vendedores sin supervisor"
response=$(curl -s -X GET "${API_URL}/backoffice/vendedores-sin-supervisor" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

if echo "$response" | grep -q '"success":true'; then
    echo "✅ Vendedores sin supervisor - OK"
    vendedores_sin_super=$(echo "$response" | jq '.data | length')
    echo "📈 Vendedores sin supervisor: $vendedores_sin_super"
else
    echo "❌ Vendedores sin supervisor - FAILED"
    echo "$response"
fi

echo ""

# Test 4: Métricas de rendimiento
echo "📈 Test 4: Métricas de rendimiento"
response=$(curl -s -X GET "${API_URL}/backoffice/metricas?fechaInicio=2025-01-01&fechaFin=2025-12-31" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

if echo "$response" | grep -q '"success":true'; then
    echo "✅ Métricas de rendimiento - OK"
    echo "$response" | jq '.data.periodo'
else
    echo "❌ Métricas de rendimiento - FAILED"
    echo "$response"
fi

echo ""

# Test 5: Test de autorización (debería fallar con token de otro rol)
echo "🚫 Test 5: Verificación de autorización"
echo "Probando acceso con token inválido..."

invalid_response=$(curl -s -X GET "${API_URL}/backoffice/dashboard" \
    -H "Authorization: Bearer invalid_token" \
    -H "Content-Type: application/json")

if echo "$invalid_response" | grep -q '"success":false\|401\|403'; then
    echo "✅ Autorización - OK (correctamente rechazado)"
else
    echo "❌ Autorización - FAILED (debería rechazar token inválido)"
fi

echo ""
echo "🏁 PRUEBAS COMPLETADAS"
echo ""
echo "📋 SIGUIENTE PASOS:"
echo "1. Ejecutar la migración SQL en la base de datos"
echo "2. Crear un usuario de prueba con role = 4"
echo "3. Compilar el frontend: npm run build"
echo "4. Probar la interfaz en el navegador"
echo ""
echo "💡 Para crear un usuario Back Office:"
echo "INSERT INTO users (first_name, last_name, email, password, role, is_enabled, verified) VALUES"
echo "('Back', 'Office', 'backoffice@test.com', '\$2b\$10\$hashedpassword', 4, 1, 1);"
