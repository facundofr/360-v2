// ✅ GESTOR GLOBAL DE SESIÓN EXPIRADA
// Este módulo previene múltiples modales de sesión expirada desde diferentes fuentes

class SessionExpiredManager {
  constructor() {
    this.modalShown = false;
    this.callbacks = new Map(); // Cambiar de Set a Map para asociar source con callback
  }

  // Registrar callback para cuando la sesión expire
  registerCallback(source, callback) {
    console.log(`📝 Registrando callback para ${source}`);
    this.callbacks.set(source, callback);
  }

  // Desregistrar callback
  unregisterCallback(source) {
    console.log(`🗑️ Desregistrando callback para ${source}`);
    this.callbacks.delete(source);
  }

  // Manejar sesión expirada (solo permite una ejecución)
  handleExpired(source = 'unknown') {
    if (this.modalShown) {
      console.log(`🚫 Modal de sesión expirada ya mostrado - evitando duplicado desde: ${source}`);
      return false;
    }

    console.log(`✅ Mostrando modal de sesión expirada desde: ${source}`);
    this.modalShown = true;

    // Notificar a todos los callbacks registrados
    this.callbacks.forEach((callback, source) => {
      try {
        console.log(`📞 Ejecutando callback para ${source}`);
        callback(source);
      } catch (error) {
        console.error(`Error en callback de sesión expirada para ${source}:`, error);
      }
    });

    return true;
  }

  // Reset para futuras sesiones (usado cuando se inicia nueva sesión)
  reset() {
    console.log('🔄 Reset del gestor de sesión expirada');
    this.modalShown = false;
  }

  // Verificar si ya se mostró el modal
  isModalShown() {
    return this.modalShown;
  }
}

// Instancia singleton
const sessionExpiredManager = new SessionExpiredManager();

export default sessionExpiredManager;