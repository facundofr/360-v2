require('dotenv').config();
const db = require('../config/db');
const { isValidLocalidadBA } = require('../config/partidosBuenosAires');

const EXCLUIR = ['C.A.B.A','C.A.B.A.','CABA','Capital Federal','Otra',
  'Bs. As. Zona Sur','Bs. As. Zona Norte','Bs. As. Zona Oeste',
  'Ciudad Autónoma de Buenos Aires','Ciudad Autonoma de Buenos Aires'];

db.query('SELECT TRIM(localidad) as loc, COUNT(*) as c FROM prospectos WHERE localidad IS NOT NULL AND localidad <> "" GROUP BY TRIM(localidad) ORDER BY c DESC')
  .then(([rows]) => {
    console.log('=== Localidades NO reconocidas en mapa PBA ===');
    rows.forEach(r => {
      if (!isValidLocalidadBA(r.loc) && !EXCLUIR.includes(r.loc)) {
        console.log(r.loc + ' => ' + r.c + ' prospectos');
      }
    });
    process.exit(0);
  })
  .catch(e => { console.error(e.message); process.exit(1); });
