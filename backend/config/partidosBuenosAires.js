/**
 * Mapeo de localidades/municipios a partidos de la Provincia de Buenos Aires
 * Basado en la división administrativa oficial (2024)
 */

const MUNICIPIOS_BA = {
  // Partidos del Gran Buenos Aires (conurbano + zona sur)
  'Almirante Brown': { partido: 'Almirante Brown', region: 'Sur' },
  'Avellaneda': { partido: 'Avellaneda', region: 'Sur' },
  'Berazategui': { partido: 'Berazategui', region: 'Sur' },
  'Brandsen': { partido: 'Brandsen', region: 'Sur' },
  'Cañuelas': { partido: 'Cañuelas', region: 'Sudoeste' },
  'Esteban Echeverría': { partido: 'Esteban Echeverría', region: 'Sur' },
  'Exaltación de la Cruz': { partido: 'Exaltación de la Cruz', region: 'Noroeste' },
  'Florencio Varela': { partido: 'Florencio Varela', region: 'Sur' },
  'Gral. Las Heras': { partido: 'Gral. Las Heras', region: 'Sur' },
  'Gral. Pueyrredón': { partido: 'Gral. Pueyrredón', region: 'Sudeste' },
  'Gral. Rodríguez': { partido: 'Gral. Rodríguez', region: 'Sudoeste' },
  'Gral. San Martín': { partido: 'Gral. San Martín', region: 'Norte' },
  'Gral. Villegas': { partido: 'Gral. Villegas', region: 'Noroeste' },
  'Gonzalez Catán': { partido: 'González Catán', region: 'Sur' },
  'Hipólito Yrigoyen': { partido: 'Hipólito Yrigoyen', region: 'Centro' },
  'Ituzaingó': { partido: 'Ituzaingó', region: 'Oeste' },
  'José C. Paz': { partido: 'José C. Paz', region: 'Noroeste' },
  'La Matanza': { partido: 'La Matanza', region: 'Oeste' },
  'Lanús': { partido: 'Lanús', region: 'Sur' },
  'La Plata': { partido: 'La Plata', region: 'Sudeste' },
  'Lomas de Zamora': { partido: 'Lomas de Zamora', region: 'Sur' },
  'Luján': { partido: 'Luján', region: 'Noroeste' },
  'Magdalena': { partido: 'Magdalena', region: 'Sudeste' },
  'Malvinas Argentinas': { partido: 'Malvinas Argentinas', region: 'Noroeste' },
  'Marcos Paz': { partido: 'Marcos Paz', region: 'Sudoeste' },
  'Matanza': { partido: 'La Matanza', region: 'Oeste' },
  'Merlo': { partido: 'Merlo', region: 'Oeste' },
  'Moreno': { partido: 'Moreno', region: 'Sudoeste' },
  'Moron': { partido: 'Morón', region: 'Oeste' },
  'Morón': { partido: 'Morón', region: 'Oeste' },
  'Navarro': { partido: 'Navarro', region: 'Sur' },
  'Olavarría': { partido: 'Olavarría', region: 'Centro' },
  'Pila': { partido: 'Pila', region: 'Sudeste' },
  'Pilar': { partido: 'Pilar', region: 'Noroeste' },
  'Presidente Perón': { partido: 'Presidente Perón', region: 'Sur' },
  'Quilmes': { partido: 'Quilmes', region: 'Sur' },
  'Ramallo': { partido: 'Ramallo', region: 'Noroeste' },
  'Ranchos': { partido: 'Ranchos', region: 'Sudoeste' },
  'Reconstrucción': { partido: 'Reconstrucción', region: 'Sudoeste' },
  'Rivadavia': { partido: 'Rivadavia', region: 'Centro' },
  'Rojas': { partido: 'Rojas', region: 'Noroeste' },
  'Roque Pérez': { partido: 'Roque Pérez', region: 'Sudoeste' },
  'Salto': { partido: 'Salto', region: 'Centro' },
  'Saladillo': { partido: 'Saladillo', region: 'Centro' },
  'San Andrés de Giles': { partido: 'San Andrés de Giles', region: 'Centro' },
  'San Antonio de Areco': { partido: 'San Antonio de Areco', region: 'Noroeste' },
  'San Cayetano': { partido: 'San Cayetano', region: 'Sudeste' },
  'San Fernando': { partido: 'San Fernando', region: 'Norte' },
  'San Isidro': { partido: 'San Isidro', region: 'Norte' },
  'San Martín': { partido: 'Gral. San Martín', region: 'Norte' },
  'San Miguel': { partido: 'San Miguel', region: 'Noroeste' },
  'San Vicente': { partido: 'San Vicente', region: 'Sur' },
  'Suipacha': { partido: 'Suipacha', region: 'Sudoeste' },
  'Tandil': { partido: 'Tandil', region: 'Sudeste' },
  'Tapalqué': { partido: 'Tapalqué', region: 'Centro' },
  'Tigre': { partido: 'Tigre', region: 'Noroeste' },
  'Tordillo': { partido: 'Tordillo', region: 'Sudeste' },
  'Tornquist': { partido: 'Tornquist', region: 'Sudeste' },
  'Trenque Lauquen': { partido: 'Trenque Lauquen', region: 'Noroeste' },
  'Tres Arroyos': { partido: 'Tres Arroyos', region: 'Sudeste' },
  'Tres Lomas': { partido: 'Tres Lomas', region: 'Centro' },
  'Udaondo': { partido: 'Udaondo', region: 'Sudoeste' },
  'Vergara': { partido: 'Vergara', region: 'Sudoeste' },
  'Vicente López': { partido: 'Vicente López', region: 'Norte' },
  'Villarino': { partido: 'Villarino', region: 'Sudeste' },
  'Villisca': { partido: 'Villisca', region: 'Centro' },
  'Zárate': { partido: 'Zárate', region: 'Noroeste' },

  // Partidos adicionales de PBA presentes en la base de datos
  'Tres de Febrero': { partido: 'Tres de Febrero', region: 'Oeste' },
  'Ezeiza': { partido: 'Ezeiza', region: 'Sur' },
  'Campana': { partido: 'Campana', region: 'Noroeste' },
  'Hurlingham': { partido: 'Hurlingham', region: 'Oeste' },
  'General San Martín': { partido: 'Gral. San Martín', region: 'Norte' },
  'Escobar': { partido: 'Escobar', region: 'Noroeste' },
  'San Nicolás': { partido: 'San Nicolás', region: 'Noroeste' },
  'Mar del Plata': { partido: 'Gral. Pueyrredón', region: 'Sudeste' },
  'Bahía Blanca': { partido: 'Bahía Blanca', region: 'Sudoeste' },
  'Azul': { partido: 'Azul', region: 'Centro' },
  'Pergamino': { partido: 'Pergamino', region: 'Noroeste' },
  'General Rodríguez': { partido: 'Gral. Rodríguez', region: 'Sudoeste' },
  'Necochea': { partido: 'Necochea', region: 'Sudeste' },
  'Junín': { partido: 'Junín', region: 'Noroeste' },
  'Chivilcoy': { partido: 'Chivilcoy', region: 'Centro' },

  // CABA — Ciudad Autónoma de Buenos Aires (variantes frecuentes en la BD)
  'CABA': { partido: 'CABA', region: 'CABA' },
  'C.A.B.A.': { partido: 'CABA', region: 'CABA' },
  'C.A.B.A': { partido: 'CABA', region: 'CABA' },
  'Capital Federal': { partido: 'CABA', region: 'CABA' },
  'Ciudad de Buenos Aires': { partido: 'CABA', region: 'CABA' },
  'Ciudad Autónoma de Buenos Aires': { partido: 'CABA', region: 'CABA' },
  'Ciudad Autonoma de Buenos Aires': { partido: 'CABA', region: 'CABA' },
};

/**
 * Lista blanca de partidos/municipios válidos de PBA (en minúsculas para búsqueda)
 */
const PARTIDOS_VALIDOS = Object.keys(MUNICIPIOS_BA).map(m => m.toLowerCase());

/**
 * Mapear una localidad a su partido correspondiente
 */
function mapLocalidadToPartido(localidad) {
  if (!localidad) return null;
  const normalized = localidad.trim();
  const key = Object.keys(MUNICIPIOS_BA).find(
    k => k.toLowerCase() === normalized.toLowerCase()
  );
  return key ? MUNICIPIOS_BA[key].partido : null;
}

/**
 * Validar si una localidad está en PBA
 */
function isValidLocalidadBA(localidad) {
  if (!localidad) return false;
  const normalized = localidad.trim().toLowerCase();
  return PARTIDOS_VALIDOS.includes(normalized);
}

module.exports = {
  MUNICIPIOS_BA,
  PARTIDOS_VALIDOS,
  mapLocalidadToPartido,
  isValidLocalidadBA
};
