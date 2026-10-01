import axios from "axios";
import { API_URL } from "../config";

const refritosService = {
  // Cargar archivo de refritos
  cargarArchivo: async (archivo) => {
    const formData = new FormData();
    formData.append("archivo", archivo);
    const token = localStorage.getItem("cober_token");

    const response = await axios.post(`${API_URL}/admin/refritos/cargar`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${token}`
      }
    });

    return response.data;
  },

  // Obtener estadísticas generales
  obtenerEstadisticas: async () => {
    const token = localStorage.getItem("cober_token");
    const response = await axios.get(`${API_URL}/admin/refritos/estadisticas`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // Obtener refritos de un vendedor
  obtenerRefritosVendedor: async (vendedorId) => {
    const token = localStorage.getItem("cober_token");
    const response = await axios.get(
      `${API_URL}/admin/refritos/vendedor/${vendedorId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  },

  // Obtener historial de un refrito
  obtenerHistorial: async (prospectoId) => {
    const token = localStorage.getItem("cober_token");
    const response = await axios.get(
      `${API_URL}/admin/refritos/historial/${prospectoId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  },

  // Reasignar refrito a otro vendedor
  reasignarRefrito: async (prospectoId) => {
    const token = localStorage.getItem("cober_token");
    const response = await axios.post(
      `${API_URL}/admin/refritos/reasignar`,
      { prospectoId },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  },

  // Eliminar refrito del flujo
  eliminarDelFlujo: async (prospectoId) => {
    const token = localStorage.getItem("cober_token");
    const response = await axios.post(
      `${API_URL}/admin/refritos/eliminar-flujo`,
      { prospectoId },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response.data;
  }
};

export default refritosService;
