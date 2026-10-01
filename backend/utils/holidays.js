const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CACHE_DIR = path.join(__dirname, '..', 'cache');
const TIMEZONE = 'America/Argentina/Buenos_Aires';

// Memoria simple por proceso
const memoryCache = new Map(); // key: year -> { ts:number, data:Array }

function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch (e) {
    // si falla el fs, continuamos con cache en memoria
  }
}

function cacheFile(year) {
  return path.join(CACHE_DIR, `holidays-${year}.json`);
}

async function fetchFromRemote(year) {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/AR`;
  const resp = await axios.get(url, { timeout: 10000 });
  if (!Array.isArray(resp.data)) throw new Error('Respuesta inválida de API de feriados');
  return resp.data;
}

async function readFromDisk(year) {
  try {
    const file = cacheFile(year);
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      const json = JSON.parse(raw);
      return json;
    }
  } catch (e) {
    // ignorar errores de lectura
  }
  return null;
}

async function writeToDisk(year, data) {
  try {
    ensureCacheDir();
    fs.writeFileSync(cacheFile(year), JSON.stringify({ year, fetchedAt: Date.now(), holidays: data }, null, 2));
  } catch (e) {
    // ignorar errores de escritura
  }
}

function getLocalISODateBA(date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  // en-CA -> YYYY-MM-DD
  return fmt.format(date);
}

async function getHolidays(year, options = {}) {
  const { forceRefresh = false } = options;

  const now = Date.now();
  const maxAgeMs = 1000 * 60 * 60 * 24 * 7; // 7 días

  // 1) memoria
  const mem = memoryCache.get(year);
  if (mem && !forceRefresh && now - mem.ts < maxAgeMs) {
    return { source: 'memory', year, holidays: mem.data };
  }

  // 2) archivo en disco
  if (!forceRefresh) {
    const disk = await readFromDisk(year);
    if (disk && Array.isArray(disk.holidays)) {
      memoryCache.set(year, { ts: disk.fetchedAt || now, data: disk.holidays });
      return { source: 'file', year, holidays: disk.holidays };
    }
  }

  // 3) remoto
  const data = await fetchFromRemote(year);
  memoryCache.set(year, { ts: now, data });
  await writeToDisk(year, data);
  return { source: 'remote', year, holidays: data };
}

async function isHoliday(date) {
  const y = new Intl.DateTimeFormat('en', { timeZone: TIMEZONE, year: 'numeric' }).format(date);
  const year = parseInt(y, 10);
  const { holidays } = await getHolidays(year);
  const d = getLocalISODateBA(date);
  return holidays.find(h => h.date === d) || null;
}

module.exports = {
  getHolidays,
  isHoliday,
  TIMEZONE
};
