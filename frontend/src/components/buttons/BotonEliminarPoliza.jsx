/**
 * Botón reutilizable para eliminar una póliza generada (soft delete).
 * Solo disponible cuando la póliza NO está en estado 'venta_cerrada'.
 * Si la póliza tiene una solicitud de firma electrónica asociada (pendiente
 * o ya firmada), se advierte al usuario que ese registro también se eliminará.
 *
 * Uso:
 *   <BotonEliminarPoliza poliza={poliza} onEliminada={fetchPolizas} size="sm" showLabel={false} />
 */

import { useState } from 'react';
import { Button } from '@/components/compat/bootstrap';
import { FaTrash } from '@/lib/icons';
import Swal from '@/lib/alerts';
import axios from 'axios';
import { API_URL } from '../config';

const BotonEliminarPoliza = ({
  poliza,
  onEliminada,
  size = 'sm',
  showLabel = true,
  disabled = false,
  endpointBase = null   // Permite sobrescribir el endpoint (ej: supervisor usa su propia ruta)
}) => {
  const endpoint = endpointBase
    ? `${endpointBase}/${poliza?.id}`
    : `${API_URL}/backoffice/polizas/${poliza?.id}`;
  const [loading, setLoading] = useState(false);

  // ── Condiciones que bloquean la eliminación ──────────────────────────────
  const esVentaCerrada = poliza?.estado === 'venta_cerrada';

  const fueEnviadaFirma =
    poliza?.fecha_envio_firma ||
    poliza?.estado_firma === 'pending' ||
    poliza?.estado_firma === 'signed';
  const firmaYaCompletada = poliza?.estado_firma === 'signed';

  const puedeEliminar = !esVentaCerrada && !disabled;

  // ── Tooltip descriptivo ──────────────────────────────────────────────────
  const obtenerTooltip = () => {
    if (esVentaCerrada)  return 'No se puede eliminar: la venta ya fue cerrada';
    if (fueEnviadaFirma) return 'Eliminar póliza (también eliminará su solicitud de firma)';
    return 'Eliminar póliza';
  };

  // ── Handler principal ─────────────────────────────────────────────────────
  const handleEliminar = async () => {
    const numero = poliza?.numero_poliza_oficial || poliza?.numero_poliza || `#${poliza?.id}`;

    // Paso 1 – confirmación con motivo
    const avisoFirma = fueEnviadaFirma
      ? `<p class="text-warning mb-3">
           <small>
             ⚠️ Esta póliza ${firmaYaCompletada ? 'tiene una firma electrónica completada' : 'tiene una solicitud de firma electrónica pendiente'}.
             Al eliminarla, también se eliminará ese registro de solicitud de firma.
           </small>
         </p>`
      : '';

    const { value: motivo, isConfirmed } = await Swal.fire({
      title: '¿Eliminar póliza?',
      html: `
        <p class="mb-3">Vas a eliminar la póliza <strong>${numero}</strong>.</p>
        ${avisoFirma}
        <p class="text-danger mb-3"><small>Esta acción no se puede deshacer automáticamente.</small></p>
        <textarea
          id="swal-motivo"
          class="swal2-textarea"
          placeholder="Ingresá el motivo de la eliminación (obligatorio)..."
          rows="3"
          style="width:100%;margin-top:0"
        ></textarea>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const val = document.getElementById('swal-motivo')?.value?.trim();
        if (!val) {
          Swal.showValidationMessage('El motivo es obligatorio');
          return false;
        }
        return val;
      }
    });

    if (!isConfirmed || !motivo) return;

    // Paso 2 – segunda confirmación
    const confirmacion = await Swal.fire({
      title: '¿Confirmar eliminación?',
      text: fueEnviadaFirma
        ? `Póliza ${numero} y su solicitud de firma electrónica serán eliminadas del sistema.`
        : `Póliza ${numero} será eliminada del sistema.`,
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Confirmar eliminación',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    // Paso 3 – llamar al endpoint
    try {
      setLoading(true);
      const token = localStorage.getItem('cober_token');

      await axios.delete(
        endpoint,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: { motivo_eliminacion: motivo }
        }
      );

      await Swal.fire({
        title: 'Póliza eliminada',
        text: `La póliza ${numero} fue eliminada correctamente.`,
        icon: 'success',
        timer: 2500,
        showConfirmButton: false
      });

      if (onEliminada) onEliminada();
    } catch (error) {
      const mensaje =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Error al eliminar la póliza';

      Swal.fire({
        title: 'No se pudo eliminar',
        text: mensaje,
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
    } finally {
      setLoading(false);
    }
  };

  // No renderizar si la póliza no puede eliminarse (estado final / firma enviada)
  // Solo deshabilitar visualmente con tooltip explicativo
  return (
    <Button
      variant={puedeEliminar ? 'outline-danger' : 'outline-secondary'}
      size={size}
      title={obtenerTooltip()}
      disabled={!puedeEliminar || loading}
      onClick={puedeEliminar ? handleEliminar : undefined}
      className="flex items-center gap-1"
      style={!puedeEliminar ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
    >
      {loading ? (
        <span
          className="inline-block animate-spin rounded-full border-current border-r-transparent align-middle size-4 border-2"
          role="status"
          aria-hidden="true"
        />
      ) : (
        <FaTrash />
      )}
      {showLabel && (loading ? ' Eliminando...' : ' Eliminar')}
    </Button>
  );
};

export default BotonEliminarPoliza;
