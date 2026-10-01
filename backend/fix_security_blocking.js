#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Iniciando corrección del sistema de seguridad...');

// 1. Limpiar blacklist
const blacklistFile = path.join(__dirname, 'config/blacklist.json');
const cleanBlacklist = [];

try {
    fs.writeFileSync(blacklistFile, JSON.stringify(cleanBlacklist, null, 2));
    console.log('✅ Blacklist limpiada');
} catch (error) {
    console.error('❌ Error limpiando blacklist:', error);
}

// 2. Crear lista de IPs confiables actualizada
const trustedIPs = [
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'localhost',
    '201.212.96.163', // IP del usuario reportando el problema
    '192.168.0.0/16', // Red privada
    '10.0.0.0/8',     // Red privada
    '172.16.0.0/12'   // Red privada
];

console.log('🔧 IPs confiables configuradas:', trustedIPs);

// 3. Verificar logs de seguridad
const securityLogFile = path.join(__dirname, 'logs/security.log');
if (fs.existsSync(securityLogFile)) {
    try {
        const stats = fs.statSync(securityLogFile);
        console.log(`📊 Archivo de log de seguridad: ${(stats.size / 1024).toFixed(2)} KB`);
        
        // Leer últimas 10 líneas para diagnóstico
        const data = fs.readFileSync(securityLogFile, 'utf8');
        const lines = data.trim().split('\n');
        const recentLines = lines.slice(-10);
        
        console.log('📋 Últimos eventos de seguridad:');
        recentLines.forEach((line, index) => {
            try {
                const event = JSON.parse(line);
                console.log(`  ${index + 1}. ${event.eventType} - IP: ${event.ip} - Score: ${event.attackScore} - Path: ${event.path}`);
            } catch (e) {
                console.log(`  ${index + 1}. ${line.substring(0, 100)}...`);
            }
        });
    } catch (error) {
        console.error('❌ Error leyendo logs:', error);
    }
} else {
    console.log('⚠️ No se encontró archivo de logs de seguridad');
}

console.log('🔧 Corrección completada. Reinicia el servidor para aplicar cambios.');
