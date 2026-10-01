const path = require("path");

// Carga el config de reglas
const config = require(path.join(__dirname, "..", "config", "scoring_config_rules.json"));

const TIPO_AF_ID_TO_TEXT = {
  1: "particular",
  2: "recibo",
  3: "monotributo"
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normSpaces(s) {
  return s.replace(/\s+/g, " ").trim();
}

function normalizeLocalidad(localidad) {
  let s = String(localidad ?? "");
  if (config.rules.localidad.normalize.strip) s = s.trim();
  if (config.rules.localidad.normalize.uppercase) s = s.toUpperCase();
  if (config.rules.localidad.normalize.remove_dots) s = s.replaceAll(".", "");
  s = normSpaces(s);

  const aliases = config.rules.localidad.normalize.aliases || {};
  if (aliases[s]) s = aliases[s];

  if (!s || s === "NAN" || s === "NONE") s = "OTRAS";
  return s;
}

function findLocalidadBucket(localidadNorm) {
  for (const g of config.rules.localidad.groups) {
    if (Array.isArray(g.localidades) && g.localidades.includes(localidadNorm)) {
      return { points: g.score, bucket: g.name };
    }
  }
  return { points: config.rules.localidad.default_score ?? 0, bucket: "default" };
}

/**
 * Extrae la hora (0-23) desde:
 * - input.hora (string "21", "21:49", etc.)
 * - input.created_at / input.fecha_registro (ISO/Date parseable)
 */
function parseHour(input) {
  const horaRaw = input.hora ?? input.Hora;

  if (horaRaw != null) {
    const s = String(horaRaw).trim();
    const m = s.match(/^(\d{1,2})(?::|h|$)/);
    if (m) {
      const h = Number(m[1]);
      if (Number.isFinite(h) && h >= 0 && h <= 23) return h;
    }
  }

  const fechaRaw =
    input.created_at ??
    input.fecha_registro ??
    input.fechaRegistro ??
    input["Fecha Registro"];

  if (fechaRaw) {
    const dt = new Date(fechaRaw);
    if (!Number.isNaN(dt.getTime())) {
      const h = dt.getHours();
      if (Number.isFinite(h) && h >= 0 && h <= 23) return h;
    }
  }

  return null;
}

function findHoraBucket(hour) {
  if (hour == null) return { points: config.rules.hora_registro.default_score ?? 0, bucket: "NA" };

  for (const b of config.rules.hora_registro.bins) {
    if (hour >= b.start && hour <= b.end) {
      return { points: b.score, bucket: b.name };
    }
  }
  return { points: config.rules.hora_registro.default_score ?? 0, bucket: "default" };
}

function findEdadBucket(edad) {
  const e = Number(edad);
  if (!Number.isFinite(e)) return { points: config.rules.edad.default_score ?? 0, bucket: "NA" };

  for (const b of config.rules.edad.bins) {
    if (e >= b.min && e <= b.max) {
      return { points: b.score, bucket: b.name };
    }
  }
  return { points: config.rules.edad.default_score ?? 0, bucket: "default" };
}

/**
 * Tipo de afiliación: puede venir como texto o como ID numérico
 */
function getTipoAfText(input) {
  const txt =
    input.tipo_afiliacion ??
    input.tipoAfiliacion;

  if (txt) return String(txt);

  const id = input.tipo_afiliacion_id ?? input.tipoAfiliacionId;
  if (id != null && TIPO_AF_ID_TO_TEXT[Number(id)]) return TIPO_AF_ID_TO_TEXT[Number(id)];

  return "";
}

function findTipoAfBucket(tipoAfText) {
  let s = String(tipoAfText ?? "");
  if (config.rules.tipo_afiliacion.normalize.strip) s = s.trim();
  if (config.rules.tipo_afiliacion.normalize.lowercase) s = s.toLowerCase();

  for (const m of config.rules.tipo_afiliacion.mapping) {
    if (m.contains_any?.some((k) => s.includes(k))) {
      return { points: m.score, bucket: m.name, normalized: s };
    }
  }
  return { points: config.rules.tipo_afiliacion.default_score ?? 0, bucket: "default", normalized: s };
}

function findEstadoBucket(estado) {
  const s = String(estado ?? "").trim();
  for (const m of config.rules.estado.mapping) {
    if (m.values.includes(s)) {
      return { points: m.score, bucket: m.name, descartado: m.name === "descartado" };
    }
  }
  return { points: config.rules.estado.default_score ?? 0, bucket: "default", descartado: false };
}

function classify(score) {
  const cls = config.classification.find((c) => score >= c.min && score <= c.max);
  return cls ? cls.label : "N/A";
}

/**
 * Calcula el score de calidad de un prospecto.
 * Acepta un objeto con campos de la tabla prospectos de cober360.
 *
 * @param {Object} input - Datos del prospecto
 * @returns {{ calidad_prospecto: number, calidad_categoria: string, calidad_detalle: Array }}
 */
function scoreLead(input) {
  const base = config.score.base;
  const clipMin = config.score.clip.min;
  const clipMax = config.score.clip.max;

  const locNorm = normalizeLocalidad(input.localidad ?? input.Localidad);
  const loc = findLocalidadBucket(locNorm);

  const hour = parseHour(input);
  const hr = findHoraBucket(hour);

  const ed = findEdadBucket(input.edad ?? input.Edad);

  const tipoAfText = getTipoAfText(input);
  const ta = findTipoAfBucket(tipoAfText);

  const est = findEstadoBucket(input.estado ?? input.Estado);

  const detalle = [
    {
      factor: "Localidad",
      valor: locNorm || "—",
      puntos: loc.points
    },
    {
      factor: "Hora de registro",
      valor: hour != null ? `${hour}:00 hs` : "—",
      puntos: hr.points
    },
    {
      factor: "Edad",
      valor: (input.edad ?? input.Edad) != null ? `${input.edad ?? input.Edad} años` : "—",
      puntos: ed.points
    },
    {
      factor: "Tipo de afiliación",
      valor: tipoAfText || "—",
      puntos: ta.points
    },
    {
      factor: "Estado",
      valor: (input.estado ?? input.Estado) || "—",
      puntos: est.points
    }
  ];

  // Si el estado es descartado, la calidad cae a Baja sin importar otros factores
  if (est.descartado) {
    return {
      calidad_prospecto: 0,
      calidad_categoria: "Baja",
      calidad_detalle: detalle,
      calidad_override: "Estado descartado — puntaje forzado a 0"
    };
  }

  const raw = base + loc.points + hr.points + ed.points + ta.points + est.points;
  const score = clamp(raw, clipMin, clipMax);

  return {
    calidad_prospecto: score,
    calidad_categoria: classify(score),
    calidad_detalle: detalle
  };
}

module.exports = { scoreLead };
