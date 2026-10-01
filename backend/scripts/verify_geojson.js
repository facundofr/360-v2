require('dotenv').config();
const db = require('../config/db');
const fs = require('fs');

db.query('SELECT TRIM(localidad) as loc, COUNT(*) as cnt FROM prospectos WHERE localidad IS NOT NULL AND localidad <> "" GROUP BY TRIM(localidad) ORDER BY cnt DESC')
  .then(([rows]) => {
    const geoJson = JSON.parse(fs.readFileSync('./frontend/public/data/pba-partidos.geo.json', 'utf8'));
    const geoNames = new Set(geoJson.features.map(f => f.properties?.name?.trim()));
    
    console.log('=== Verificación GeoJSON ===');
    console.log('Total en BD:', rows.length);
    console.log('Total en GeoJSON:', geoNames.size);
    console.log('');
    
    // Buscar faltantes normalizando
    const norm = s => s?.trim().normalize('NFC').toLowerCase();
    const geoNamesNorm = new Map();
    geoJson.features.forEach(f => {
      geoNamesNorm.set(norm(f.properties?.name), f.properties?.name);
    });
    
    const faltantes = [];
    rows.forEach(r => {
      if (!geoNamesNorm.has(norm(r.loc))) {
        faltantes.push(r);
      }
    });
    
    if (faltantes.length > 0) {
      console.log('❌ Faltantes en GeoJSON:');
      faltantes.slice(0, 25).forEach(r => console.log('  -', r.loc, '(' + r.cnt + ' prospectos)'));
      if (faltantes.length > 25) console.log('  ... y ' + (faltantes.length - 25) + ' más');
    } else {
      console.log('✅ Todos los partidos están en el GeoJSON');
    }
    
    console.log('');
    console.log('GeoJSON features (primeros 10):');
    geoJson.features.slice(0, 10).forEach(f => {
      console.log('  -', f.properties?.name, ':', f.geometry?.type);
    });
    
    process.exit(0);
  })
  .catch(e => { console.error(e.message); process.exit(1); });
