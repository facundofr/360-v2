import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/compat/bootstrap';
import { API_URL } from '../config';
import axios from 'axios';

/**
 * Componente que muestra el estado de firma de una póliza
 * - Consulta automáticamente al montar (recargar página)
 * - Muestra badge con el estado: "Póliza Firmada", "Pendiente", etc.
 */
const BotonConsultarFirma = ({ polizaId, onEstadoActualizado }) => {
  const [estado, setEstado] = useState(null);

  // Cargar estado automáticamente al montar el componente
  useEffect(() => {
    cargarEstadoInicial();
  }, [polizaId]);

  const cargarEstadoInicial = async () => {
    try {
      const token = localStorage.getItem('cober_token');
      
      const response = await axios.get(
        `${API_URL}/api/vafirma/estado/${polizaId}`,
        {
          params: {
            _t: new Date().getTime()
          },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );

      if (response.data.success) {
        const estadoLocal = response.data.data.estadoLocal;
        setEstado(estadoLocal);
        if (onEstadoActualizado) {
          onEstadoActualizado(estadoLocal);
        }
      }
    } catch (err) {
      console.log('ℹ️ No hay estado de firma registrado aún');
      setEstado(null);
    }
  };

  return (
    <div className="flex gap-1 items-center">
      {/* Badge de estado de firma */}
      {(estado === 'signed') && (
        <Badge bg="success">Póliza Firmada</Badge>
      )}
      {(estado === 'pending') && (
        <Badge bg="warning">Pendiente Firma</Badge>
      )}
      {(estado === 'rejected') && (
        <Badge bg="danger">Firma Rechazada</Badge>
      )}
      {(estado === 'expired') && (
        <Badge bg="secondary">Firma Expirada</Badge>
      )}
    </div>
  );
};

export default BotonConsultarFirma;
