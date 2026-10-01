#!/usr/bin/env node

/**
 * 🔍 Script para consultar y gestionar la blacklist de IPs
 * Uso: node scripts/check_blacklist.js [accion] [ip]
 * 
 * Acciones disponibles:
 * - list (por defecto): Mostrar todas las IPs en blacklist
 * - add [ip]: Agregar IP a blacklist
 * - remove [ip]: Remover IP de blacklist
 * - check [ip]: Verificar si una IP está en blacklist
 */

const fs = require('fs');
const path = require('path');

const BLACKLIST_FILE = path.join(__dirname, '../config/blacklist.json');

// 📂 Cargar blacklist actual
function loadBlacklist() {
    try {
        if (fs.existsSync(BLACKLIST_FILE)) {
            const data = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8'));
            return Array.isArray(data) ? data : [];
        }
        return [];
    } catch (error) {
        console.error('❌ Error cargando blacklist:', error);
        return [];
    }
}

// 💾 Guardar blacklist
function saveBlacklist(blacklist) {
    try {
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(blacklist, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Error guardando blacklist:', error);
        return false;
    }
}

// 📋 Mostrar blacklist
function listBlacklist() {
    const blacklist = loadBlacklist();
    
    console.log('\n🚫 === BLACKLIST DE IPs ===');
    console.log(`📊 Total: ${blacklist.length} IPs bloqueadas\n`);
    
    if (blacklist.length === 0) {
        console.log('✅ No hay IPs en blacklist');
    } else {
        blacklist.forEach((ip, index) => {
            console.log(`${index + 1}. ${ip}`);
        });
    }
    console.log('\n' + '='.repeat(30));
}

// ➕ Agregar IP a blacklist
function addToBlacklist(ip) {
    if (!ip) {
        console.error('❌ Error: Debes especificar una IP');
        return;
    }
    
    const blacklist = loadBlacklist();
    
    if (blacklist.includes(ip)) {
        console.log(`⚠️  La IP ${ip} ya está en blacklist`);
        return;
    }
    
    blacklist.push(ip);
    
    if (saveBlacklist(blacklist)) {
        console.log(`✅ IP ${ip} agregada a blacklist`);
        console.log(`📊 Total IPs en blacklist: ${blacklist.length}`);
    }
}

// ➖ Remover IP de blacklist
function removeFromBlacklist(ip) {
    if (!ip) {
        console.error('❌ Error: Debes especificar una IP');
        return;
    }
    
    const blacklist = loadBlacklist();
    const index = blacklist.indexOf(ip);
    
    if (index === -1) {
        console.log(`⚠️  La IP ${ip} no está en blacklist`);
        return;
    }
    
    blacklist.splice(index, 1);
    
    if (saveBlacklist(blacklist)) {
        console.log(`✅ IP ${ip} removida de blacklist`);
        console.log(`📊 Total IPs en blacklist: ${blacklist.length}`);
    }
}

// 🔍 Verificar si IP está en blacklist
function checkBlacklist(ip) {
    if (!ip) {
        console.error('❌ Error: Debes especificar una IP');
        return;
    }
    
    const blacklist = loadBlacklist();
    const isBlacklisted = blacklist.includes(ip);
    
    console.log(`\n🔍 Verificación de IP: ${ip}`);
    console.log(`Estado: ${isBlacklisted ? '🚫 BLOQUEADA' : '✅ PERMITIDA'}`);
    
    if (isBlacklisted) {
        const index = blacklist.indexOf(ip);
        console.log(`Posición en blacklist: #${index + 1}`);
    }
}

// 📋 Mostrar ayuda
function showHelp() {
    console.log('\n🔍 === GESTOR DE BLACKLIST DE IPs ===');
    console.log('\nUso: node scripts/check_blacklist.js [accion] [ip]\n');
    console.log('Acciones disponibles:');
    console.log('  list              Mostrar todas las IPs en blacklist (por defecto)');
    console.log('  add [ip]          Agregar IP a blacklist');
    console.log('  remove [ip]       Remover IP de blacklist');
    console.log('  check [ip]        Verificar si una IP está en blacklist');
    console.log('  help              Mostrar esta ayuda');
    console.log('\nEjemplos:');
    console.log('  node scripts/check_blacklist.js');
    console.log('  node scripts/check_blacklist.js list');
    console.log('  node scripts/check_blacklist.js add 192.168.1.100');
    console.log('  node scripts/check_blacklist.js remove 192.168.1.100');
    console.log('  node scripts/check_blacklist.js check 192.168.1.100');
    console.log('\n' + '='.repeat(50));
}

// 🚀 Función principal
function main() {
    const args = process.argv.slice(2);
    const action = args[0] || 'list';
    const ip = args[1];
    
    switch (action.toLowerCase()) {
        case 'list':
        case 'ls':
            listBlacklist();
            break;
            
        case 'add':
            addToBlacklist(ip);
            break;
            
        case 'remove':
        case 'rm':
            removeFromBlacklist(ip);
            break;
            
        case 'check':
            checkBlacklist(ip);
            break;
            
        case 'help':
        case '-h':
        case '--help':
            showHelp();
            break;
            
        default:
            console.error(`❌ Acción desconocida: ${action}`);
            showHelp();
    }
}

// Ejecutar script
if (require.main === module) {
    main();
}

module.exports = {
    loadBlacklist,
    saveBlacklist,
    listBlacklist,
    addToBlacklist,
    removeFromBlacklist,
    checkBlacklist
};
