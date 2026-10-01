const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SCOPES = ['https://www.googleapis.com/auth/drive'];

const UPLOADS_DIR = path.resolve(__dirname, '../uploads');
const BACKUPS_DIR = path.resolve(__dirname, '../../backups');

// Carpetas de uploads a sincronizar con Drive
const SYNC_FOLDERS = ['polizas', 'refritos', 'whatsapp'];

let driveClient = null;

/**
 * Inicializa el cliente de Google Drive usando OAuth2 con refresh token
 */
async function initDrive() {
  if (driveClient) return driveClient;

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Faltan variables de entorno para Google Drive: ' +
      'GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN'
    );
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost');
  oAuth2Client.setCredentials({ refresh_token: refreshToken });

  driveClient = google.drive({ version: 'v3', auth: oAuth2Client });
  return driveClient;
}

/**
 * Busca una carpeta por nombre dentro de un parent. Si no existe, la crea.
 */
async function findOrCreateFolder(drive, name, parentId) {
  const safeName = name.replace(/'/g, "\\'");
  const query = `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  const fileMetadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
  };
  const folder = await drive.files.create({
    resource: fileMetadata,
    fields: 'id',
    supportsAllDrives: true,
  });
  console.log(`  📁 Carpeta creada en Drive: ${name}`);
  return folder.data.id;
}

/**
 * Busca la carpeta "backups" en Drive (root propio o compartida).
 * Retorna el ID de "Cober-Caba" dentro de ella.
 */
async function getTargetFolderId(drive) {
  // Buscar en root propio y en carpetas compartidas
  const backupsRes = await drive.files.list({
    q: "name='Backups360' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: 'files(id, name)',
    spaces: 'drive',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  if (backupsRes.data.files.length === 0) {
    throw new Error(
      'No se encontró la carpeta "Backups360" en Google Drive. ' +
      'Asegurate de que exista y esté compartida con: backups@cober360-cec7f.iam.gserviceaccount.com'
    );
  }

  const backupsFolderId = backupsRes.data.files[0].id;
  const coberCabaId = await findOrCreateFolder(drive, 'Cober-Caba', backupsFolderId);
  return coberCabaId;
}

/**
 * Lista todos los archivos existentes en una carpeta de Drive (con paginación)
 */
async function listDriveFiles(drive, folderId) {
  const files = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, size)',
      spaces: 'drive',
      pageSize: 1000,
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });
    files.push(...res.data.files);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return files;
}

/**
 * Sube o actualiza un archivo en Drive.
 * Si ya existe con el mismo tamaño, lo omite (no re-sube).
 */
async function uploadOrUpdateFile(drive, localFilePath, folderId, existingFiles) {
  const fileName = path.basename(localFilePath);
  const fileStat = fs.statSync(localFilePath);
  const existing = existingFiles.find(f => f.name === fileName);

  const media = {
    body: fs.createReadStream(localFilePath),
  };

  if (existing) {
    // Si el tamaño es idéntico, saltar
    if (existing.size && parseInt(existing.size) === fileStat.size) {
      return { action: 'skipped', name: fileName };
    }
    // Actualizar contenido del archivo existente
    await drive.files.update({
      fileId: existing.id,
      media,
      supportsAllDrives: true,
    });
    return { action: 'updated', name: fileName };
  }

  // Crear archivo nuevo
  await drive.files.create({
    resource: {
      name: fileName,
      parents: [folderId],
    },
    media,
    fields: 'id',
    supportsAllDrives: true,
  });
  return { action: 'created', name: fileName };
}

/**
 * Sincroniza recursivamente una carpeta local con una carpeta en Drive
 */
async function syncFolder(drive, localDir, driveFolderId) {
  if (!fs.existsSync(localDir)) {
    console.warn(`  ⚠️ Carpeta local no encontrada: ${localDir}`);
    return { synced: 0, skipped: 0, errors: 0 };
  }

  const existingDriveFiles = await listDriveFiles(drive, driveFolderId);
  const localEntries = fs.readdirSync(localDir);
  let synced = 0, skipped = 0, errors = 0;

  for (const entry of localEntries) {
    const fullPath = path.join(localDir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Buscar/crear subcarpeta en Drive y sincronizar recursivamente
      const subFolderId = await findOrCreateFolder(drive, entry, driveFolderId);
      const subResult = await syncFolder(drive, fullPath, subFolderId);
      synced += subResult.synced;
      skipped += subResult.skipped;
      errors += subResult.errors;
      continue;
    }

    try {
      const result = await uploadOrUpdateFile(drive, fullPath, driveFolderId, existingDriveFiles);
      if (result.action === 'skipped') {
        skipped++;
      } else {
        synced++;
        console.log(`    ✅ ${result.action}: ${result.name}`);
      }
    } catch (err) {
      errors++;
      console.error(`    ❌ Error subiendo ${entry}:`, err.message);
    }
  }

  return { synced, skipped, errors };
}

/**
 * Retorna el archivo .sql.gz más reciente de la carpeta de backups
 */
function getLatestDbBackup() {
  if (!fs.existsSync(BACKUPS_DIR)) return null;

  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.endsWith('.sql.gz'))
    .map(f => {
      const filePath = path.join(BACKUPS_DIR, f);
      return {
        name: f,
        path: filePath,
        mtime: fs.statSync(filePath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0] : null;
}

/**
 * Ejecuta el backup completo:
 * 1. Sincroniza uploads/polizas, uploads/refritos, uploads/whatsapp
 * 2. Sube el .sql.gz más reciente de la carpeta backups/
 */
async function ejecutarBackup() {
  const inicio = Date.now();
  console.log('☁️ ====== INICIANDO BACKUP A GOOGLE DRIVE ======');
  console.log(`   Hora: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`);

  try {
    const drive = await initDrive();
    const rootFolderId = await getTargetFolderId(drive);
    const totalStats = { synced: 0, skipped: 0, errors: 0 };

    // 1. Sincronizar carpetas de uploads
    for (const folder of SYNC_FOLDERS) {
      const localPath = path.join(UPLOADS_DIR, folder);
      console.log(`\n📂 Sincronizando uploads/${folder}...`);
      const driveFolderId = await findOrCreateFolder(drive, folder, rootFolderId);
      const result = await syncFolder(drive, localPath, driveFolderId);
      console.log(`   → ${result.synced} subidos, ${result.skipped} sin cambios, ${result.errors} errores`);
      totalStats.synced += result.synced;
      totalStats.skipped += result.skipped;
      totalStats.errors += result.errors;
    }

    // 2. Subir último backup de DB
    console.log('\n💾 Subiendo último backup de base de datos...');
    const dbBackup = getLatestDbBackup();
    if (dbBackup) {
      const dbFolderId = await findOrCreateFolder(drive, 'database', rootFolderId);
      const existingDbFiles = await listDriveFiles(drive, dbFolderId);
      const result = await uploadOrUpdateFile(drive, dbBackup.path, dbFolderId, existingDbFiles);
      console.log(`   ✅ DB Backup ${result.action}: ${dbBackup.name}`);
    } else {
      console.warn('   ⚠️ No se encontró ningún backup de base de datos');
    }

    const duracion = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`\n☁️ ====== BACKUP COMPLETADO EN ${duracion}s ======`);
    console.log(`   Total: ${totalStats.synced} subidos, ${totalStats.skipped} sin cambios, ${totalStats.errors} errores\n`);

    return { success: true, duracion, stats: totalStats };
  } catch (error) {
    console.error('❌ Error en backup a Google Drive:', error.message);
    console.error('   Stack:', error.stack);
    return { success: false, error: error.message };
  }
}

module.exports = {
  ejecutarBackup,
  initDrive,
};
