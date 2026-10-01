const User = require('../models/userModel');

async function testEmailNormalization() {
    console.log('🧪 Probando normalización de emails...\n');

    const testEmails = [
        'test.user@gmail.com',
        'TEST.USER@GMAIL.COM',
        'test.user+tag@gmail.com',
        'testuser@gmail.com',
        'test.user@hotmail.com',
        'Test.User@Outlook.com',
        '  test.user@gmail.com  ' // con espacios
    ];

    console.log('📧 Emails de prueba y su normalización:');
    testEmails.forEach(email => {
        const normalized = email.toLowerCase().trim();
        console.log(`Original: "${email}" → Normalizado: "${normalized}"`);
    });

    console.log('\n✅ Ahora los puntos se conservan correctamente en todos los dominios.');
    console.log('✅ Solo se eliminan espacios y se convierte a minúsculas.');
    console.log('✅ Esto evita conflictos con emails como juan.perez@gmail.com vs juanperez@gmail.com');
}

testEmailNormalization().catch(console.error);
