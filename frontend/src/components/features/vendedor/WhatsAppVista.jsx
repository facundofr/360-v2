import React, { useState, useEffect, useRef } from 'react';
import { Dropdown } from '@/components/compat/bootstrap';
import { Loader2Icon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  FaWhatsapp, 
  FaPaperPlane, 
  FaArrowLeft,
  FaSearch,
  FaUser,
  FaBars,
  FaSync,
  FaEnvelope,
  FaCheck,
  FaCheckDouble,
  FaClock,
  FaPaperclip,
  FaFile,
  FaTimes,
  FaImage,
  FaFilePdf,
  FaDownload
} from '@/lib/icons';
import axios from 'axios';
import { API_URL } from '../../config.js';
import { useNotifications } from '../../../contexts/NotificationContext';

const WhatsAppVista = ({ onOpenSidebar }) => {
  const [conversaciones, setConversaciones] = useState([]);
  const [conversacionActual, setConversacionActual] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [plantillas, setPlantillas] = useState({});
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [vista, setVista] = useState('lista'); // 'lista' | 'chat'
  const [estadisticas, setEstadisticas] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [hayNuevosMensajes, setHayNuevosMensajes] = useState(false);
  const [ultimoConteoMensajes, setUltimoConteoMensajes] = useState(0);
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  
  const mensajesRef = useRef(null);
  const intervalRef = useRef(null);
  const fileInputRef = useRef(null);

  // 🔔 Usar el contexto de notificaciones para actualizar navbar en tiempo real
  const { refreshNotifications, updateWhatsappUnread } = useNotifications();

  // 🔍 LOG: Verificar que onOpenSidebar se recibe correctamente
  useEffect(() => {
    console.log('📱 WhatsAppVista montado');
    console.log('📊 onOpenSidebar recibido:', typeof onOpenSidebar, onOpenSidebar);
  }, [onOpenSidebar]);

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

  // 🔄 Cargar datos iniciales con sincronización de notificaciones
  useEffect(() => {
    cargarConversaciones();
    cargarPlantillas();
    cargarEstadisticas();
    
    // Auto-refresh cada 5 segundos
    intervalRef.current = setInterval(() => {
      cargarConversaciones(); // Esto actualizará automáticamente las notificaciones
      if (conversacionActual) {
        cargarMensajes(conversacionActual.id);
      }
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [conversacionActual]);

  // 📜 Auto-scroll al final de mensajes
  useEffect(() => {
    if (mensajesRef.current) {
      const scrollElement = mensajesRef.current;
      const isNearBottom = scrollElement.scrollTop >= scrollElement.scrollHeight - scrollElement.clientHeight - 50;
      
      if (isNearBottom || mensajes.length > ultimoConteoMensajes) {
        setTimeout(() => {
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        }, 100);
      }
      
      if (mensajes.length > ultimoConteoMensajes && ultimoConteoMensajes > 0) {
        setHayNuevosMensajes(true);
        setTimeout(() => setHayNuevosMensajes(false), 3000);
      }
      
      setUltimoConteoMensajes(mensajes.length);
    }
  }, [mensajes, ultimoConteoMensajes]);

  // 📋 Cargar conversaciones con actualización de notificaciones
  const cargarConversaciones = async () => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/chat/conversaciones`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 50, busqueda }
      });

      if (response.data.success) {
        const nuevasConversaciones = response.data.data;
        if (JSON.stringify(nuevasConversaciones) !== JSON.stringify(conversaciones)) {
          setConversaciones(nuevasConversaciones);
          
          // 🔔 ACTUALIZAR NOTIFICACIONES EN NAVBAR EN TIEMPO REAL
          const totalNoLeidos = nuevasConversaciones.reduce((sum, conv) => sum + (conv.mensajes_no_leidos || 0), 0);
          updateWhatsappUnread(totalNoLeidos);
          console.log('🔔 Notificaciones WhatsApp actualizadas:', totalNoLeidos);
        }
      }
    } catch (error) {
      console.error('❌ Error cargando conversaciones:', error);
    }
  };

    // 📝 Cargar plantillas
  const cargarPlantillas = async () => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/api/whatsapp/plantillas`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.plantillas) {
        setPlantillas(response.data.plantillas);
      } else {
        // Si no hay plantillas en la respuesta, usar fallback solo con plantillas habilitadas
        console.log('No se encontraron plantillas en la respuesta, usando fallback');
        // Fallback con plantillas predeterminadas
      setPlantillas({
        saludo_inicial: {
          id: 'saludo_inicial',
          nombre: 'Recontactar',
          descripcion: 'Hola {{cliente}}, soy {{vendedor}} de Cober. Te escribo para retomar contacto: ¿seguís interesado/a en avanzar con tu plan de salud? Cualquier duda, estoy para ayudarte.'
        },
        seguimiento_cotizacion: {
          id: 'seguimiento_cotizacion',
          nombre: 'Seguimiento Cotización',
          descripcion: '👋 Hola {{1}}, ¿Pudiste revisar la cotización que te envié 📄? Si tenés alguna duda o consulta, estoy acá para ayudarte 😊✨'
        },
        seguimiento_poliza: {
          id: 'seguimiento_poliza',
          nombre: 'Seguimiento Póliza',
          descripcion: '👋 Hola {{1}}, ¿Recibiste correctamente tu póliza 📄✅? Si necesitás ayuda con algo, estoy disponible para acompañarte 🤝✨'
        },
        informacion_adicional: {
          id: 'informacion_adicional',
          nombre: 'Información Adicional',
          descripcion: '💙 Si necesitás más información sobre tu plan de salud 🩺, no dudes en consultarme. Estoy acá para ayudarte 🙌✨'
        },
        cierre_conversacion: {
          id: 'cierre_conversacion',
          nombre: 'Cierre Conversación',
          descripcion: '✅ Perfecto, cualquier otra consulta no dudes en escribirme 📩. ✨ ¡Que tengas un excelente día! 🌞'
        }
      });
      }
    } catch (error) {
      console.error('Error cargando plantillas:', error);
      // Fallback: usar solo plantillas habilitadas para chat manual
      setPlantillas({
        saludo_inicial: {
          id: 'saludo_inicial',
          nombre: 'Recontactar',
          descripcion: 'Retomar contacto con el prospecto',
          variables: ['cliente', 'vendedor']
        },
        seguimiento_cotizacion: {
          id: 'seguimiento_cotizacion',
          nombre: 'Seguimiento Cotización',
          descripcion: 'Seguimiento post-cotización',
          variables: ['cliente']
        },
        seguimiento_poliza: {
          id: 'seguimiento_poliza',
          nombre: 'Seguimiento Póliza',
          descripcion: 'Verificar recepción póliza',
          variables: ['cliente']
        },
        informacion_adicional: {
          id: 'informacion_adicional',
          nombre: 'Información Adicional',
          descripcion: 'Info sobre plan de salud',
          variables: []
        },
        cierre_conversacion: {
          id: 'cierre_conversacion',
          nombre: 'Cierre Conversación',
          descripcion: 'Despedida cortés',
          variables: []
        }
      });
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

  // 💬 Cargar mensajes
  const cargarMensajes = async (conversacionId) => {
    try {
      const token = localStorage.getItem('cober_token');
      const response = await axios.get(`${API_URL}/chat/conversaciones/${conversacionId}/mensajes`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const nuevosMensajes = response.data.data;
        if (JSON.stringify(nuevosMensajes) !== JSON.stringify(mensajes)) {
          setMensajes(nuevosMensajes);
        }
      }
    } catch (error) {
      if (!error.response || error.response.status !== 401) {
        console.error('❌ Error cargando mensajes:', error);
      }
    }
  };

  // 🗨️ Abrir conversación
  const abrirConversacion = async (conversacion) => {
    setLoading(true);
    setConversacionActual(conversacion);
    setVista('chat');
    await cargarMensajes(conversacion.id);
    await marcarComoLeidos(conversacion.id);
    setLoading(false);
  };

  // 📤 Enviar mensaje con actualización automática de notificaciones
  const enviarMensaje = async (mensaje = null, plantillaId = null) => {
    if (!mensaje && !nuevoMensaje.trim() && !plantillaId) return;

    const textoMensaje = mensaje || nuevoMensaje;
    setEnviando(true);

    // Optimistic update
    const mensajeOptimista = {
      id: `temp-${Date.now()}`,
      mensaje: plantillaId ? `Enviando plantilla: ${plantillas?.[plantillaId]?.nombre || plantillaId}` : textoMensaje,
      tipo: 'enviado',
      origen: 'vendedor',
      estado_entrega: 'enviando',
      created_at: new Date().toISOString()
    };

    setMensajes(prev => [...prev, mensajeOptimista]);
    setNuevoMensaje('');

    try {
      const token = localStorage.getItem('cober_token');
      let response;

      if (plantillaId) {
        // Enviar plantilla usando la nueva API de WhatsApp
        const userData = JSON.parse(localStorage.getItem('user'));
        const nombreVendedor = userData?.nombre || 'tu asesor';
        const nombreCliente = conversacionActual?.prospecto_nombre || 'estimado cliente';

        switch (plantillaId) {
          case 'saludo_inicial':
            response = await axios.post(
              `${API_URL}/api/whatsapp/saludo-inicial`,
              {
                telefono: conversacionActual.telefono,
                nombreVendedor: nombreVendedor,
                nombreCliente: nombreCliente
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            break;
          
          case 'seguimiento_cotizacion':
            response = await axios.post(
              `${API_URL}/api/whatsapp/seguimiento-cotizacion`,
              { 
                telefono: conversacionActual.telefono,
                nombreCliente: nombreCliente
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            break;
          
          case 'seguimiento_poliza':
            response = await axios.post(
              `${API_URL}/api/whatsapp/seguimiento-poliza`,
              { 
                telefono: conversacionActual.telefono,
                nombreCliente: nombreCliente
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            break;
          
          case 'informacion_adicional':
            response = await axios.post(
              `${API_URL}/api/whatsapp/informacion-adicional`,
              { 
                telefono: conversacionActual.telefono
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            break;
          
          case 'cierre_conversacion':
            response = await axios.post(
              `${API_URL}/api/whatsapp/cierre-conversacion`,
              { 
                telefono: conversacionActual.telefono
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            break;
          
          default:
            throw new Error('Plantilla no reconocida');
        }
      } else {
        // Enviar mensaje de texto normal
        response = await axios.post(
          `${API_URL}/chat/conversaciones/${conversacionActual.id}/mensajes`,
          { mensaje: textoMensaje },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      if (response.data.success) {
        // Recargar mensajes para obtener el estado real
        await cargarMensajes(conversacionActual.id);
        
        // 🔔 ACTUALIZAR NOTIFICACIONES DESPUÉS DE ENVIAR MENSAJE
        setTimeout(() => {
          cargarConversaciones(); // Actualizar contador en navbar
        }, 1000);
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      
      setMensajes(prev => prev.map(m => 
        m.id === mensajeOptimista.id 
          ? { ...m, estado_entrega: 'fallido' }
          : m
      ));
      
      alert('Error enviando mensaje: ' + (error.response?.data?.message || error.message));
    } finally {
      setEnviando(false);
    }
  };

  // 🔄 Enviar plantilla de recontacto
  const enviarPlantillaRecontacto = async (tipoPlantilla) => {
    if (!conversacionActual) {
      alert('No hay una conversación activa');
      return;
    }

    setEnviando(true);

    try {
      const token = localStorage.getItem('cober_token');
      const userData = JSON.parse(localStorage.getItem('user'));
      const nombreVendedor = userData?.nombre || 'tu asesor';
      const nombreCliente = conversacionActual?.prospecto_nombre || 'estimado cliente';

      console.log('📱 Enviando plantilla:', tipoPlantilla);
      console.log('📞 Teléfono:', conversacionActual.telefono);
      console.log('👤 Vendedor:', nombreVendedor);

      let response;

      switch (tipoPlantilla) {
        case 'saludo_inicial':
          response = await axios.post(
            `${API_URL}/api/whatsapp/saludo-inicial`,
            {
              telefono: conversacionActual.telefono,
              nombreVendedor: nombreVendedor,
              nombreCliente: nombreCliente
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          break;
        
        case 'seguimiento_cotizacion':
          response = await axios.post(
            `${API_URL}/api/whatsapp/seguimiento-cotizacion`,
            { 
              telefono: conversacionActual.telefono,
              nombreCliente: nombreCliente
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          break;
        
        case 'seguimiento_poliza':
          response = await axios.post(
            `${API_URL}/api/whatsapp/seguimiento-poliza`,
            { 
              telefono: conversacionActual.telefono,
              nombreCliente: nombreCliente
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          break;
        
        case 'informacion_adicional':
          response = await axios.post(
            `${API_URL}/api/whatsapp/informacion-adicional`,
            { 
              telefono: conversacionActual.telefono
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          break;
        
        case 'cierre_conversacion':
          response = await axios.post(
            `${API_URL}/api/whatsapp/cierre-conversacion`,
            { 
              telefono: conversacionActual.telefono
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          break;
        
        default:
          throw new Error('Tipo de plantilla no reconocido');
      }

      if (response.data.success) {
        console.log('✅ Plantilla enviada exitosamente');
        
        // Recargar mensajes para ver el nuevo mensaje
        setTimeout(() => {
          cargarMensajes(conversacionActual.id);
          cargarConversaciones();
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Error enviando plantilla:', error);
      alert('Error al enviar plantilla: ' + (error.response?.data?.message || error.message));
    } finally {
      setEnviando(false);
    }
  };

  // ✅ Marcar mensajes como leídos con actualización de notificaciones
  const marcarComoLeidos = async (conversacionId) => {
    try {
      const token = localStorage.getItem('cober_token');
      await axios.patch(
        `${API_URL}/chat/conversaciones/${conversacionId}/marcar-leidos`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // 🔔 ACTUALIZAR CONVERSACIONES Y NOTIFICACIONES DESPUÉS DE MARCAR COMO LEÍDOS
      setTimeout(() => {
        cargarConversaciones(); // Esto actualizará las notificaciones automáticamente
      }, 500);
      
    } catch (error) {
      console.error('❌ Error marcando mensajes como leídos:', error);
    }
  };

  // 📎 Manejar selección de archivo
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tamaño (100 MB máximo)
      if (file.size > 100 * 1024 * 1024) {
        alert('El archivo es demasiado grande. Tamaño máximo: 100MB');
        return;
      }
      
      // Validar tipo de archivo
      const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'video/mp4', 'video/3gpp',
        'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/amr'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        alert('Tipo de archivo no permitido');
        return;
      }
      
      setArchivoSeleccionado(file);
    }
  };

  // 📎 Enviar mensaje con archivo
  const enviarMensajeConArchivo = async () => {
    if (!archivoSeleccionado && !nuevoMensaje.trim()) {
      return;
    }

    // Si no hay archivo, enviar mensaje normal
    if (!archivoSeleccionado) {
      return enviarMensaje();
    }

    setEnviando(true);

    try {
      const formData = new FormData();
      formData.append('archivo', archivoSeleccionado);
      formData.append('mensaje', nuevoMensaje || 'Archivo adjunto');

      const token = localStorage.getItem('cober_token');
      const response = await axios.post(
        `${API_URL}/chat/conversaciones/${conversacionActual.id}/mensajes/archivo`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        setNuevoMensaje('');
        setArchivoSeleccionado(null);
        await cargarMensajes(conversacionActual.id);
        await cargarConversaciones();
        
        // Limpiar input de archivo
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      console.error('❌ Error enviando archivo:', error);
      alert('Error al enviar el archivo: ' + (error.response?.data?.message || error.message));
    } finally {
      setEnviando(false);
    }
  };

  // 📎 Obtener icono según tipo de archivo
  const getFileIcon = (fileName) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return <FaImage className="text-info" />;
    } else if (ext === 'pdf') {
      return <FaFilePdf className="text-destructive" />;
    } else {
      return <FaFile className="text-teal" />;
    }
  };

  // 📥 Descargar archivo directamente
  const descargarArchivo = async (url, nombreArchivo) => {
    try {
      // Fetch el archivo
      const response = await fetch(url);
      const blob = await response.blob();
      
      // Crear un enlace temporal y hacer clic en él
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = nombreArchivo || 'archivo_whatsapp';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpiar el objeto URL
      window.URL.revokeObjectURL(link.href);
      
      console.log('✅ Archivo descargado:', nombreArchivo);
    } catch (error) {
      console.error('❌ Error descargando archivo:', error);
      // Fallback: abrir en nueva pestaña si falla la descarga
      window.open(url, '_blank');
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

  // Filtrar conversaciones por búsqueda
  const conversacionesFiltradas = conversaciones.filter(conv => 
    conv.prospecto_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    conv.telefono?.includes(busqueda) ||
    conv.ultimo_mensaje?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const Entrega = ({ estado }) => {
    const base = "inline-flex items-center gap-1 text-[0.65rem]";
    if (!estado || estado === "pendiente" || estado === "enviando")
      return <span className={cn(base, "text-white/60 italic")}><FaClock />Enviando…</span>;
    if (estado === "enviado") return <span className={cn(base, "text-white/70")}><FaCheck />Enviado</span>;
    if (estado === "entregado") return <span className={cn(base, "text-white/70")}><FaCheckDouble />Entregado</span>;
    if (estado === "leido") return <span className={cn(base, "font-semibold text-sky-200")}><FaCheckDouble />Leído</span>;
    if (estado === "fallido") return <span className={cn(base, "text-red-200")}><FaTimes />Falló</span>;
    return null;
  };

  const iconButton =
    "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50";

  // 📱 Renderizar lista de conversaciones
  const renderListaConversaciones = () => (
    <>
      <header className="flex min-h-16 items-center gap-3 border-b px-4 py-3 md:px-6">
        <button type="button" className={cn(iconButton, "border border-input md:hidden")} onClick={() => onOpenSidebar?.()} aria-label="Abrir menú">
          <FaBars />
        </button>
        <h1 className="flex flex-1 items-center gap-2 text-xl font-bold text-corporate md:text-2xl">
          WhatsApp
          {estadisticas?.mensajes_no_leidos > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white tabular-nums">
              <FaEnvelope size={12} />
              {estadisticas.mensajes_no_leidos}
            </span>
          )}
        </h1>
        <button type="button" className={iconButton} onClick={cargarConversaciones} aria-label="Actualizar conversaciones">
          <FaSync />
        </button>
      </header>

      <div className="border-b px-4 py-3 md:px-6">
        <label className="relative block">
          <span className="sr-only">Buscar conversaciones</span>
          <FaSearch className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar por nombre, teléfono o mensaje…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-muted/50 pr-3 pl-9 text-base outline-none md:text-sm focus-visible:border-ring focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/20"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversacionesFiltradas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-muted-foreground">
            <FaWhatsapp size={40} className="opacity-50" />
            <p className="font-semibold text-corporate">{busqueda ? "Ninguna conversación coincide" : "No hay conversaciones"}</p>
            {busqueda && <p className="text-sm">Probá con otro término de búsqueda.</p>}
          </div>
        ) : (
          <ul className="divide-y">
            {conversacionesFiltradas.map((conv) => (
              <li key={conv.id}>
                <button
                  type="button"
                  onClick={() => abrirConversacion(conv)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted md:px-6"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                    <FaUser size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate", conv.mensajes_no_leidos > 0 ? "font-bold" : "font-semibold")}>
                        {conv.prospecto_nombre ? `${conv.prospecto_nombre} ${conv.prospecto_apellido}`.trim() : maskPhoneNumber(conv.telefono)}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatearFecha(conv.ultima_actividad)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-muted-foreground">{conv.ultimo_mensaje || "Sin mensajes"}</span>
                      {conv.mensajes_no_leidos > 0 && (
                        <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-teal px-1.5 text-xs leading-5 font-bold text-white tabular-nums">
                          {conv.mensajes_no_leidos}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );

  // 💬 Renderizar chat
  const renderChat = () => (
    <>
      <header className="flex min-h-16 items-center gap-2 border-b px-2 py-2 md:px-4">
        <button type="button" className={iconButton} onClick={() => setVista("lista")} aria-label="Volver a las conversaciones">
          <FaArrowLeft />
        </button>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          <FaUser size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-corporate">
            {conversacionActual?.prospecto_nombre
              ? `${conversacionActual.prospecto_nombre} ${conversacionActual.prospecto_apellido}`.trim()
              : maskPhoneNumber(conversacionActual?.telefono)}
          </p>
          <p className="text-xs text-muted-foreground">{maskPhoneNumber(conversacionActual?.telefono)}</p>
        </div>
        <button type="button" className={iconButton} onClick={() => cargarMensajes(conversacionActual.id)} aria-label="Actualizar mensajes">
          <FaSync />
        </button>
      </header>

      <div ref={mensajesRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-muted/60 p-4" aria-live="polite">
        {loading ? (
          <div role="status" className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin text-primary" />
            Cargando mensajes…
          </div>
        ) : mensajes.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center text-muted-foreground">
            <FaWhatsapp size={40} className="opacity-50" />
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
                    "max-w-[85%] rounded-2xl px-3.5 py-2 shadow-xs md:max-w-[70%]",
                    propio ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card text-foreground"
                  )}
                >
                  {mensaje.archivo_url &&
                    (mensaje.archivo_tipo?.startsWith("image/") ? (
                      <button
                        type="button"
                        onClick={() => descargarArchivo(mensaje.archivo_url, mensaje.archivo_nombre)}
                        className="mb-2 block text-left"
                        title="Descargar imagen"
                      >
                        <img
                          src={mensaje.archivo_url}
                          alt={mensaje.archivo_nombre}
                          className="max-h-52 max-w-52 rounded-md transition-opacity hover:opacity-85"
                        />
                        <span className={cn("mt-1 flex items-center gap-1 text-[0.7rem]", propio ? "text-white/70" : "text-muted-foreground")}>
                          <FaDownload size={10} />
                          Tocá para descargar
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => descargarArchivo(mensaje.archivo_url, mensaje.archivo_nombre)}
                        title="Descargar archivo"
                        className="mb-2 flex w-full max-w-64 items-center gap-2 rounded-md bg-card p-2 text-left text-foreground transition-colors hover:bg-muted"
                      >
                        {getFileIcon(mensaje.archivo_nombre)}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{mensaje.archivo_nombre}</span>
                          {mensaje.archivo_tamaño && (
                            <span className="block text-[0.7rem] text-muted-foreground tabular-nums">
                              {(mensaje.archivo_tamaño / 1024 / 1024).toFixed(2)} MB
                            </span>
                          )}
                        </span>
                        <FaDownload size={14} className="text-primary" />
                      </button>
                    ))}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{mensaje.mensaje}</div>
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
        <div className="flex flex-col gap-2 border-t bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {archivoSeleccionado && (
            <div className="flex items-center justify-between gap-2 rounded-md bg-muted p-2">
              <div className="flex min-w-0 items-center gap-2">
                {getFileIcon(archivoSeleccionado.name)}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{archivoSeleccionado.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{(archivoSeleccionado.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button
                type="button"
                className={cn(iconButton, "text-destructive hover:bg-destructive/10")}
                aria-label="Quitar archivo"
                onClick={() => {
                  setArchivoSeleccionado(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <FaTimes />
              </button>
            </div>
          )}

          <Dropdown>
            <Dropdown.Toggle variant="outline-success" size="sm">
              Recontactar
            </Dropdown.Toggle>
            <Dropdown.Menu className="max-h-72 w-72 overflow-y-auto">
              <Dropdown.Item onClick={() => enviarPlantillaRecontacto("saludo_inicial")} disabled={enviando} className="flex-col items-start gap-0.5">
                <span className="font-bold">Recontactar</span>
                <span className="text-xs whitespace-normal text-muted-foreground">
                  Hola [cliente], soy [vendedor] de Cober. Te escribo para retomar contacto…
                </span>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              archivoSeleccionado ? enviarMensajeConArchivo() : enviarMensaje();
            }}
          >
            <button type="button" className={cn(iconButton, "rounded-full text-muted-foreground")} onClick={() => fileInputRef.current?.click()} disabled={enviando} aria-label="Adjuntar archivo">
              <FaPaperclip size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.mp4,.3gpp,.mp3,.ogg,.aac,.amr"
              onChange={handleFileSelect}
            />
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
              disabled={enviando || (!nuevoMensaje.trim() && !archivoSeleccionado)}
              aria-label="Enviar"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {enviando ? <Loader2Icon className="size-4 animate-spin" /> : <FaPaperPlane size={16} />}
            </button>
          </form>
        </div>
      )}
    </>
  );

  return (
    <div className=" flex h-[calc(100dvh-60px)] flex-col bg-card md:h-[calc(100dvh-80px)]">
      {vista === "lista" ? renderListaConversaciones() : renderChat()}
    </div>
  );
};

export default WhatsAppVista;
