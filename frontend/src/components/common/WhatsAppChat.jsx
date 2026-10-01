import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Dropdown } from '@/components/compat/bootstrap';
import { FaEllipsisV, FaPlay, FaPause, FaTimes, FaClock, FaCheck, FaCheckDouble, FaWhatsapp, FaSync } from '@/lib/icons';
import { ArrowLeftIcon, Loader2Icon, PaperclipIcon, SendIcon } from 'lucide-react';
import { ToneBadge } from '@/components/app/tone-badge';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { API_URL } from '../config';

// 🔔 Importar el hook de notificaciones
import { useNotifications } from '../../contexts/NotificationContext';

const WhatsAppChat = ({ show, onHide, conversacionId = null, telefono = null, prospecto = null, tipo = null }) => {
  // 🔔 Usar el contexto de notificaciones
  const { refreshNotifications } = useNotifications();

  // ✅ NUEVA: Función para enmascarar números de teléfono
  const maskPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, ''); // Remover caracteres no numéricos
    if (cleaned.length < 4) return phone; // Si es muy corto, devolver tal como está
    
    // Mostrar solo los últimos 4 dígitos
    const masked = '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
    
    // Mantener formato original si tiene caracteres especiales
    if (phone.includes('+')) {
      return `+${masked}`;
    } else if (phone.includes('-') || phone.includes(' ') || phone.includes('(')) {
      // Para formatos como (011) 1234-5678 o 011 1234-5678
      return `******${cleaned.slice(-4)}`;
    }
    
    return masked;
  };

  const [conversaciones, setConversaciones] = useState([]);
  const [conversacionActual, setConversacionActual] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [plantillas, setPlantillas] = useState({});
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [vista, setVista] = useState('lista'); // 'lista' | 'chat'
  const [estadisticas, setEstadisticas] = useState({});
  const [hayNuevosMensajes, setHayNuevosMensajes] = useState(false); // ✅ NUEVO: Estado para nuevos mensajes
  const [ultimoConteoMensajes, setUltimoConteoMensajes] = useState(0); // ✅ NUEVO: Para detectar cambios
  
  const mensajesRef = useRef(null);
  const intervalRef = useRef(null);

  // 🔄 Cargar datos iniciales
  useEffect(() => {
    if (show) {
      cargarConversaciones();
      cargarPlantillas();
      cargarEstadisticas();
      
      // Auto-refresh cada 5 segundos para tiempo real (optimizado para evitar rate limiting)
      intervalRef.current = setInterval(() => {
        cargarConversaciones();
        if (conversacionActual) {
          cargarMensajes(conversacionActual.id);
        }
      }, 5000); // ✅ OPTIMIZADO: De 2 a 5 segundos para reducir rate limiting
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [show, conversacionActual]); // ✅ AGREGAR: conversacionActual como dependencia

  // ✅ NUEVO: Actualizar cuando la ventana recibe foco
  useEffect(() => {
    const handleFocus = () => {
      if (show && conversacionActual) {
        cargarMensajes(conversacionActual.id);
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && show && conversacionActual) {
        cargarMensajes(conversacionActual.id);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [show, conversacionActual]);

  // ✅ NUEVO: Polling intensivo para mensajes cuando hay conversación activa
  useEffect(() => {
    let mensajesInterval = null;
    
    if (show && conversacionActual && vista === 'chat') {
      // Polling cada 3 segundos solo para mensajes cuando estamos en el chat (optimizado)
      mensajesInterval = setInterval(() => {
        cargarMensajes(conversacionActual.id); // Llamada silenciosa para tiempo real
      }, 3000); // ✅ OPTIMIZADO: De 1 a 3 segundos para reducir rate limiting
      
      console.log('🔄 Polling de mensajes iniciado cada 3 segundos');

      // 🔔 NUEVO: Marcar como leídos cuando el usuario abre el chat
      marcarComoLeidos(conversacionActual.id);
    }

    return () => {
      if (mensajesInterval) {
        clearInterval(mensajesInterval);
        console.log('🛑 Polling de mensajes detenido');
      }
    };
  }, [show, conversacionActual, vista]);

  // 📱 Abrir conversación específica
  useEffect(() => {
    if (conversacionId && conversaciones.length > 0) {
      const conv = conversaciones.find(c => c.id === conversacionId);
      if (conv) {
        abrirConversacion(conv);
      }
    }
  }, [conversacionId, conversaciones]);

  // ✅ NUEVO: Buscar conversación por prospecto
  useEffect(() => {
    if (prospecto && conversaciones.length > 0 && !conversacionActual) {
      // Buscar conversación activa del prospecto
      const conv = conversaciones.find(c => 
        c.prospecto_id === prospecto.id && 
        (c.estado === 'activa' || c.estado === 'pendiente')
      );
      
      if (conv) {
        console.log('🔍 Conversación encontrada para prospecto:', conv.numero_conversacion);
        abrirConversacion(conv);
      } else {
        console.log('⚠️ No se encontró conversación activa para el prospecto:', prospecto.id);
        // Mantener la vista de lista para mostrar todas las conversaciones
        setVista('lista');
      }
    }
  }, [prospecto, conversaciones, conversacionActual]);

  // 📜 Auto-scroll al final de mensajes y detectar nuevos mensajes
  useEffect(() => {
    if (mensajesRef.current) {
      // ✅ Auto-scroll suave al final
      const scrollElement = mensajesRef.current;
      const isNearBottom = scrollElement.scrollTop >= scrollElement.scrollHeight - scrollElement.clientHeight - 50;
      
      // Solo hacer scroll automático si el usuario está cerca del final
      if (isNearBottom || mensajes.length > ultimoConteoMensajes) {
        setTimeout(() => {
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        }, 100);
      }
      
      // ✅ Detectar nuevos mensajes
      if (mensajes.length > ultimoConteoMensajes && ultimoConteoMensajes > 0) {
        setHayNuevosMensajes(true);
        setTimeout(() => setHayNuevosMensajes(false), 3000); // Ocultar después de 3 segundos
      }
      
      setUltimoConteoMensajes(mensajes.length);
    }
  }, [mensajes, ultimoConteoMensajes]);

  // 📋 Cargar conversaciones
  const cargarConversaciones = async () => {
    try {
      console.log('🔄 Cargando conversaciones...');
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/chat/conversaciones`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 50 }
      });

      if (response.data.success) {
        const nuevasConversaciones = response.data.data;
        
        // ✅ OPTIMIZACIÓN: Solo actualizar si hay cambios reales
        if (JSON.stringify(nuevasConversaciones) !== JSON.stringify(conversaciones)) {
          console.log('✅ Conversaciones actualizadas:', nuevasConversaciones.length);
          setConversaciones(nuevasConversaciones);

          // 🔔 Actualizar notificaciones en el contexto global
          refreshNotifications();
        }
      } else {
        console.warn('⚠️ Error en respuesta de conversaciones:', response.data);
      }
    } catch (error) {
      console.error('❌ Error cargando conversaciones:', error);
    }
  };

  // 📝 Cargar plantillas
  const cargarPlantillas = async () => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/chat/plantillas`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setPlantillas(response.data.data);
      }
    } catch (error) {
      console.error('Error cargando plantillas:', error);
    }
  };

  // 📊 Cargar estadísticas
  const cargarEstadisticas = async () => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/chat/estadisticas`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setEstadisticas(response.data.data);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  // 💬 Cargar mensajes (optimizada para tiempo real)
  const cargarMensajes = async (conversacionId) => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/chat/conversaciones/${conversacionId}/mensajes`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const nuevosMensajes = response.data.data;
        
        // ✅ OPTIMIZACIÓN: Solo actualizar si hay cambios
        if (JSON.stringify(nuevosMensajes) !== JSON.stringify(mensajes)) {
          console.log('� Actualizando mensajes:', nuevosMensajes.length, 'mensajes');
          setMensajes(nuevosMensajes);
          
          // ✅ Marcar mensajes como leídos si hay nuevos mensajes del cliente
          const mensajesNoLeidos = nuevosMensajes.filter(m => 
            m.origen === 'cliente' && 
            m.tipo === 'recibido' && 
            new Date(m.created_at) > new Date(Date.now() - 10000) // Últimos 10 segundos
          );
          
          if (mensajesNoLeidos.length > 0) {
            console.log('📬 Nuevos mensajes detectados:', mensajesNoLeidos.length);
            
            // ✅ DESHABILITADO: Sonido de notificación (causaba estática)
            // TODO: Implementar sonido de notificación más limpio
            console.log('🔇 Sonido de notificación deshabilitado temporalmente');
            /* 
            try {
              // Usar un tono simple y limpio en lugar del archivo base64 corrupto
              const audioContext = new (window.AudioContext || window.webkitAudioContext)();
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();
              
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              
              oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Tono de 800Hz
              gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Volumen bajo
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
              
              oscillator.start(audioContext.currentTime);
              oscillator.stop(audioContext.currentTime + 0.3);
            } catch (e) {
              console.log('🔇 Audio no disponible');
            }
            */
            
            marcarComoLeidos(conversacionId);
          }
        }
      } else {
        console.warn('⚠️ Error en respuesta de mensajes:', response.data);
      }
    } catch (error) {
      // ✅ Silenciar errores de red para evitar spam en consola durante polling
      if (!error.response || error.response.status !== 401) {
        console.error('❌ Error cargando mensajes:', error);
      }
    }
  };

  // ✅ NUEVA FUNCIÓN: Marcar mensajes como leídos
  const marcarComoLeidos = async (conversacionId) => {
    try {
      const token = localStorage.getItem('cober_token');
      await axios.patch(
        `${API_URL}/chat/conversaciones/${conversacionId}/marcar-leidos`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('✅ Mensajes marcados como leídos');
      
      // 🔔 Actualizar notificaciones después de marcar como leídos
      refreshNotifications();
    } catch (error) {
      console.error('❌ Error marcando mensajes como leídos:', error);
    }
  };

  // 🗨️ Abrir conversación
  const abrirConversacion = async (conversacion) => {
    setLoading(true);
    setConversacionActual(conversacion);
    setVista('chat');

    await cargarMensajes(conversacion.id);
    
    // 🔔 NUEVO: Marcar mensajes como leídos cuando se abre la conversación
    await marcarComoLeidos(conversacion.id);
    
    setLoading(false);
  };

  // 📎 Enviar archivo adjunto
  const enviarArchivo = async () => {
    if (!archivoSeleccionado || !conversacionActual) return;

    setEnviando(true);
    try {
      const token = localStorage.getItem('cober_token');
      const formData = new FormData();
      formData.append('archivo', archivoSeleccionado);
      if (nuevoMensaje && nuevoMensaje.trim()) {
        formData.append('mensaje', nuevoMensaje.trim());
      }

      // Optimistic bubble para archivo
      const optimista = {
        id: `temp-file-${Date.now()}`,
        mensaje: nuevoMensaje?.trim() || 'Archivo enviado',
        tipo: 'enviado',
        origen: 'vendedor',
        estado_entrega: 'enviando',
        created_at: new Date().toISOString(),
        archivo_url: URL.createObjectURL(archivoSeleccionado),
        archivo_tipo: archivoSeleccionado.type,
        archivo_nombre: archivoSeleccionado.name,
        archivo_tamaño: archivoSeleccionado.size
      };
      setMensajes(prev => [...prev, optimista]);
      setNuevoMensaje('');

      await axios.post(
        `${API_URL}/chat/conversaciones/${conversacionActual.id}/mensajes/archivo`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      // Refrescar desde el servidor para obtener URL definitiva y SID
      setTimeout(() => cargarMensajes(conversacionActual.id), 600);
    } catch (error) {
      console.error('❌ Error enviando archivo:', error);
      alert('Error enviando archivo: ' + (error.response?.data?.message || error.message));
    } finally {
      setEnviando(false);
      setArchivoSeleccionado(null);
    }
  };

  const handleSeleccionArchivo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivoSeleccionado(file);
    // Enviar inmediatamente al seleccionar
    enviarArchivo();
  };

  // 🖼️ Renderizar preview/descarga de adjuntos
  const renderAdjunto = (msg) => {
    if (!msg.archivo_url) return null;
    const tipo = (msg.archivo_tipo || '').toLowerCase();
    const url = msg.archivo_url;

    if (tipo.startsWith('image/')) {
      return (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={msg.archivo_nombre || 'imagen'} style={{ maxWidth: '100%', borderRadius: 8, marginTop: 6 }} />
        </a>
      );
    }
    if (tipo.startsWith('video/')) {
      return (
        <video src={url} controls style={{ maxWidth: '100%', borderRadius: 8, marginTop: 6 }} />
      );
    }
    if (tipo.startsWith('audio/')) {
      return (
        <audio src={url} controls style={{ width: '100%', marginTop: 6 }} />
      );
    }
    // PDF u otros documentos
    return (
      <a href={url} target="_blank" rel="noreferrer" className="inline-block mt-2">
        📎 {msg.archivo_nombre || 'Archivo adjunto'}
      </a>
    );
  };

  // 📤 Enviar mensaje (optimizada para tiempo real)
  const enviarMensaje = async (mensaje = null, plantillaId = null) => {
    if (!mensaje && !nuevoMensaje.trim() && !plantillaId) return;

    const textoMensaje = mensaje || nuevoMensaje;
    setEnviando(true);

    // ✅ OPTIMIZACIÓN: Agregar mensaje inmediatamente (optimistic update)
    const mensajeOptimista = {
      id: `temp-${Date.now()}`,
      mensaje: textoMensaje,
      tipo: 'enviado',
      origen: 'vendedor',
      estado_entrega: 'enviando',
      created_at: new Date().toISOString()
    };

    setMensajes(prev => [...prev, mensajeOptimista]);
    setNuevoMensaje('');

    try {
      const token = localStorage.getItem('cober_token');
      const payload = {};
      
      if (plantillaId) {
        payload.plantilla_id = plantillaId;
      } else {
        payload.mensaje = textoMensaje;
      }

      const response = await axios.post(
        `${API_URL}/chat/conversaciones/${conversacionActual.id}/mensajes`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        console.log('✅ Mensaje enviado exitosamente');
        
        // ✅ Actualizar estado del mensaje optimista
        setMensajes(prev => prev.map(m => 
          m.id === mensajeOptimista.id 
            ? { ...m, estado_entrega: 'enviado', id: response.data.mensaje_id || m.id }
            : m
        ));

        // ✅ Recargar mensajes para obtener la versión real del servidor
        setTimeout(() => {
          cargarMensajes(conversacionActual.id);
        }, 500);
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      
      // ✅ Remover mensaje optimista si falló
      setMensajes(prev => prev.filter(m => m.id !== mensajeOptimista.id));
      
      // ✅ Restaurar texto en el input
      setNuevoMensaje(textoMensaje);
      
      alert('Error enviando mensaje: ' + (error.response?.data?.message || error.message));
    } finally {
      setEnviando(false);
    }
  };

  // 🔄 Cambiar estado de conversación
  const cambiarEstado = async (estado, motivo = '') => {
    try {
      const token = localStorage.getItem('cober_token');
      await axios.patch(
        `${API_URL}/chat/conversaciones/${conversacionActual.id}/estado`,
        { estado, motivo },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Actualizar estado local
      setConversacionActual(prev => ({ ...prev, estado }));
      cargarConversaciones();
    } catch (error) {
      console.error('Error cambiando estado:', error);
    }
  };

  // 🎨 Obtener color del estado
  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'activa': return 'success';
      case 'pausada': return 'warning';
      case 'cerrada': return 'secondary';
      default: return 'primary';
    }
  };

  // ⏰ Formatear fecha
  const formatearFecha = (fecha) => {
    const ahora = new Date();
    const fechaMsg = new Date(fecha);
    const diffHoras = (ahora - fechaMsg) / (1000 * 60 * 60);

    if (diffHoras < 1) {
      return 'Hace unos minutos';
    } else if (diffHoras < 24) {
      return `Hace ${Math.floor(diffHoras)} hora${Math.floor(diffHoras) > 1 ? 's' : ''}`;
    } else {
      return fechaMsg.toLocaleDateString('es-AR');
    }
  };

  // 📱 Renderizar lista de conversaciones
  const ESTADO_TONO = { activa: "success", pausada: "pending", cerrada: "neutral" };

  const Entrega = ({ estado }) => {
    const base = "inline-flex items-center gap-1 text-[0.65rem]";
    if (estado === "pendiente" || estado === "enviando")
      return <span className={cn(base, "text-white/60 italic")}><FaClock />Enviando…</span>;
    if (estado === "enviado") return <span className={cn(base, "text-white/70")}><FaCheck />Enviado</span>;
    if (estado === "entregado") return <span className={cn(base, "text-white/70")}><FaCheckDouble />Entregado</span>;
    if (estado === "leido") return <span className={cn(base, "font-semibold text-sky-200")}><FaCheckDouble />Leído</span>;
    if (estado === "fallido") return <span className={cn(base, "text-red-200")}><FaTimes />Falló</span>;
    return null;
  };

  // 📋 Renderizar lista de conversaciones
  const renderListaConversaciones = () => (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold text-corporate">
          <FaWhatsapp className="text-teal" />
          Conversaciones
        </h3>
        <Button variant="outline-secondary" size="sm" onClick={cargarConversaciones}>
          <FaSync />
          Actualizar
        </Button>
      </div>

      {estadisticas && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-semibold text-muted-foreground">Activas</p>
            <p className={cn("text-2xl font-bold tabular-nums", estadisticas.conversaciones_activas > 0 ? "text-success" : "text-corporate")}>
              {estadisticas.conversaciones_activas || 0}
            </p>
          </div>
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-semibold text-muted-foreground">Sin leer</p>
            <p className={cn("text-2xl font-bold tabular-nums", estadisticas.mensajes_no_leidos > 0 ? "text-destructive" : "text-corporate")}>
              {estadisticas.mensajes_no_leidos || 0}
            </p>
          </div>
        </div>
      )}

      {conversaciones.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <FaWhatsapp size={40} className="opacity-50" />
          <p className="font-semibold text-corporate">No tenés conversaciones activas</p>
          <p className="max-w-xs text-sm">Se crean automáticamente cuando enviás cotizaciones o pólizas por WhatsApp.</p>
        </div>
      ) : (
        <ul className="-mx-4 divide-y border-y">
          {conversaciones.map((conv) => (
            <li key={conv.id}>
              <button
                type="button"
                onClick={() => abrirConversacion(conv)}
                className="flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">
                    {conv.prospecto_nombre ? `${conv.prospecto_nombre} ${conv.prospecto_apellido}`.trim() : maskPhoneNumber(conv.telefono)}
                  </span>
                  <ToneBadge tone={ESTADO_TONO[conv.estado] || "contact"} className="capitalize">
                    {conv.estado}
                  </ToneBadge>
                </span>
                <span className="line-clamp-1 text-sm text-muted-foreground">
                  {conv.ultimo_mensaje?.substring(0, 60)}
                  {conv.ultimo_mensaje?.length > 60 ? "…" : ""}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <ToneBadge tone={conv.tipo_origen === "cotizacion" ? "contact" : "pending"}>
                      {conv.tipo_origen === "cotizacion" ? "Cotización" : "Póliza"}
                    </ToneBadge>
                    {conv.mensajes_no_leidos > 0 && (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs leading-5 font-bold text-white tabular-nums">
                        {conv.mensajes_no_leidos}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatearFecha(conv.ultima_actividad)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // 💬 Renderizar chat
  const renderChat = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b bg-card px-3 py-2.5">
        <button
          type="button"
          onClick={() => setVista("lista")}
          aria-label="Volver a las conversaciones"
          className="inline-flex size-10 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          <ArrowLeftIcon className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-corporate">
            {conversacionActual?.prospecto_nombre
              ? `${conversacionActual.prospecto_nombre} ${conversacionActual.prospecto_apellido}`.trim()
              : conversacionActual?.telefono}
          </p>
          <p className="text-xs text-muted-foreground">{maskPhoneNumber(conversacionActual?.telefono)}</p>
        </div>
        {hayNuevosMensajes && <ToneBadge tone="pending">Nuevo mensaje</ToneBadge>}
        <ToneBadge tone={ESTADO_TONO[conversacionActual?.estado] || "contact"} className="capitalize">
          {conversacionActual?.estado}
        </ToneBadge>
        <Dropdown align="end">
          <Dropdown.Toggle as="button" className="inline-flex size-10 items-center justify-center rounded-md outline-none hover:bg-muted" aria-label="Opciones de la conversación">
            <FaEllipsisV />
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => cargarMensajes(conversacionActual.id)}>
              <FaSync />
              Actualizar mensajes
            </Dropdown.Item>
            <Dropdown.Divider />
            {conversacionActual?.estado === "activa" && (
              <Dropdown.Item onClick={() => cambiarEstado("pausada")}>
                <FaPause />
                Pausar conversación
              </Dropdown.Item>
            )}
            {conversacionActual?.estado === "pausada" && (
              <Dropdown.Item onClick={() => cambiarEstado("activa")}>
                <FaPlay />
                Reactivar conversación
              </Dropdown.Item>
            )}
            <Dropdown.Divider />
            <Dropdown.Item onClick={() => cambiarEstado("cerrada")} className="text-destructive">
              <FaTimes />
              Cerrar conversación
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>

      <div ref={mensajesRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-muted/60 p-4" aria-live="polite">
        {loading ? (
          <div role="status" className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin text-teal" />
            Cargando mensajes…
          </div>
        ) : mensajes.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center text-muted-foreground">
            <FaWhatsapp size={32} className="opacity-50" />
            <p className="font-semibold text-corporate">No hay mensajes aún</p>
            <p className="text-sm">Iniciá la conversación con el cliente.</p>
          </div>
        ) : (
          mensajes.map((mensaje) => {
            const propio = mensaje.origen === "vendedor";
            return (
              <div key={mensaje.id} className={cn("flex", propio ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 shadow-xs",
                    propio ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card text-foreground"
                  )}
                >
                  <div className="text-sm leading-relaxed whitespace-pre-wrap [&_img]:mt-1.5 [&_img]:rounded-md [&_video]:mt-1.5 [&_video]:rounded-md">
                    {mensaje.mensaje}
                    {renderAdjunto(mensaje)}
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <span className={cn("text-[0.65rem] tabular-nums", propio ? "text-white/70" : "text-muted-foreground")}>
                      {new Date(mensaje.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {propio && <Entrega estado={mensaje.estado_entrega} />}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {conversacionActual?.estado !== "cerrada" && (
        <div className="flex flex-col gap-2 border-t bg-card p-3">
          {Object.keys(plantillas).length > 0 && (
            <Dropdown>
              <Dropdown.Toggle variant="outline-secondary" size="sm">
                Respuestas rápidas
              </Dropdown.Toggle>
              <Dropdown.Menu className="max-h-64 w-80 overflow-y-auto">
                {Object.entries(plantillas).map(([categoria, plantillasCategoria]) => (
                  <div key={categoria}>
                    <Dropdown.Header className="uppercase">{categoria}</Dropdown.Header>
                    {plantillasCategoria.map((plantilla) => (
                      <Dropdown.Item key={plantilla.id} onClick={() => enviarMensaje(null, plantilla.id)} className="flex-col items-start gap-0.5 whitespace-normal">
                        <strong>{plantilla.nombre}</strong>
                        <small className="text-muted-foreground">{plantilla.contenido.substring(0, 50)}…</small>
                      </Dropdown.Item>
                    ))}
                    <Dropdown.Divider />
                  </div>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          )}

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              enviarMensaje();
            }}
          >
            <input
              type="file"
              accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,video/*,audio/*"
              onChange={handleSeleccionArchivo}
              className="hidden"
              id="whatsapp-file-input"
            />
            <button
              type="button"
              onClick={() => document.getElementById("whatsapp-file-input").click()}
              disabled={enviando}
              aria-label="Adjuntar archivo"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50"
            >
              <PaperclipIcon className="size-5" />
            </button>
            <input
              type="text"
              aria-label="Mensaje"
              placeholder="Escribí un mensaje…"
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              disabled={enviando}
              className="h-11 min-w-0 flex-1 rounded-full border border-input bg-card px-4 text-base outline-none md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
            />
            <button
              type="submit"
              disabled={enviando || !nuevoMensaje.trim()}
              aria-label="Enviar mensaje"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-teal text-teal-foreground transition-colors hover:bg-teal/90 disabled:opacity-50"
            >
              {enviando ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
            </button>
          </form>
        </div>
      )}
    </div>
  );

  return (
    <Modal show={show} onHide={onHide} size="lg" fullscreen="sm-down">
      <Modal.Header closeButton className="bg-teal text-teal-foreground [&_button]:text-white">
        <Modal.Title className="flex items-center gap-2 text-white">
          <FaWhatsapp />
          WhatsApp Business
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="h-[70dvh] p-0 sm:px-0 sm:py-0">
        {vista === "lista" ? renderListaConversaciones() : renderChat()}
      </Modal.Body>
    </Modal>
  );
};

export default WhatsAppChat;
