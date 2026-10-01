const validator = require('validator');

console.log('🔍 DIAGNÓSTICO ESPECÍFICO - EMAILS CON PUNTOS');
console.log('===============================================\n');

// Test con emails reales que podrían tener problemas
const problematicEmails = [
    'juan.perez@gmail.com',
    'maria.jose.lopez@outlook.com', 
    'carlos.rodriguez@hotmail.com',
    'ana.maria.gonzalez@yahoo.com',
    'jose.antonio.martin@empresa.com.ar',
    'user.name.lastname@domain.co.uk'
];

console.log('📧 TESTING CONFIGURACIÓN ACTUAL DEL SISTEMA:');
console.log('=============================================');

problematicEmails.forEach(email => {
    // Esta es la configuración que se usa en validators.js
    const systemConfig = validator.normalizeEmail(email, {
        gmail_remove_dots: false,
        outlookdotcom_remove_subaddress: false
    });
    
    // Esto es lo que hace el modelo userModel.js
    const modelProcessing = email.toLowerCase().trim();
    
    // Verificar si son iguales
    const areEqual = systemConfig === modelProcessing;
    
    console.log(`Original:         ${email}`);
    console.log(`Sistema (validators): ${systemConfig}`);
    console.log(`Modelo (userModel):   ${modelProcessing}`);
    console.log(`¿Iguales?         ${areEqual ? '✅ SÍ' : '❌ NO - AQUÍ ESTÁ EL PROBLEMA'}`);
    
    if (!areEqual) {
        console.log(`🚨 DIFERENCIA DETECTADA:`);
        console.log(`   Validators produce: "${systemConfig}"`);
        console.log(`   UserModel produce:  "${modelProcessing}"`);
    }
    console.log('');
});

console.log('🔍 VERIFICANDO OTRAS CONFIGURACIONES DE normalizeEmail:');
console.log('=======================================================');

const testEmail = 'test.user@gmail.com';

// Probar diferentes configuraciones
const configs = {
    'Sistema actual': {
        gmail_remove_dots: false,
        outlookdotcom_remove_subaddress: false
    },
    'Conservar todo': {
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        outlookdotcom_remove_subaddress: false,
        yahoo_remove_subaddress: false,
        all_lowercase: true
    },
    'Sin normalización': null
};

Object.entries(configs).forEach(([name, config]) => {
    let result;
    if (config === null) {
        result = testEmail.toLowerCase().trim();
    } else {
        result = validator.normalizeEmail(testEmail, config);
    }
    console.log(`${name}: ${result}`);
});

console.log('\n🎯 RECOMENDACIÓN:');
console.log('================');
console.log('Para conservar TODOS los puntos y caracteres del email:');
console.log('1. Usar solo .toLowerCase().trim() en lugar de normalizeEmail()'); 
console.log('2. O configurar normalizeEmail() para conservar todo');
console.log('3. Asegurar consistencia entre validators.js y userModel.js');
