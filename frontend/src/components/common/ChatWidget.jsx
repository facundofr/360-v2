import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MessageCircleIcon, SendIcon, XIcon } from 'lucide-react';
import { API_URL } from "../config";
import { cn } from "@/lib/utils";

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Cargar conversación existente o iniciar una nueva
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Inicializamos los mensajes con un saludo
      setMessages([
        { id: 1, role: 'assistant', content: '¡Hola! Soy tu asistente virtual de cotizaciones de salud. ¿En qué puedo ayudarte hoy?' }
      ]);
    }
  }, [isOpen, messages.length]);
  
  // Auto-scroll al último mensaje
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  const toggleChat = () => {
    setIsOpen(!isOpen);
  };
  
  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
  };
  
  const handleSendMessage = async () => {
    if (inputMessage.trim() === '') return;
    
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputMessage
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);
    
    try {
      // Obtener el token del localStorage
      const token = localStorage.getItem('cober_token');
      
      // Enviar mensaje al backend
      const response = await axios.post(
        `${API_URL}/chatbot/mensaje`,
        {
          mensaje: inputMessage,
          conversacionId: conversationId,
          usuarioId: 1 // Deberías obtener el ID del usuario actual
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Añadir respuesta del asistente
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.data.mensaje
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Guardar ID de conversación
      if (response.data.conversacionId && !conversationId) {
        setConversationId(response.data.conversacionId);
      }
      
      // Si hay cotización, mostrarla
      if (response.data.cotizacion) {
        // Crear un mensaje más informativo sobre la cotización
        let cotizacionInfo = "";
        if (response.data.cotizacion && response.data.cotizacion.length > 0) {
          const planEconomico = response.data.cotizacion.reduce((prev, current) => 
            prev.total_final < current.total_final ? prev : current, response.data.cotizacion[0]);
          
          cotizacionInfo = `
            📋 Cotización generada con éxito!
            
            Plan más económico: ${planEconomico.plan_nombre}
            Precio final: $${planEconomico.total_final.toFixed(2)}
            
            También puedes consultar otros planes disponibles.
            Un asesor se pondrá en contacto contigo pronto.
          `;
        } else {
          cotizacionInfo = "¡Cotización generada con éxito! Un asesor se pondrá en contacto contigo.";
        }

        const cotizacionMessage = {
          id: Date.now() + 2,
          role: 'assistant',
          content: cotizacionInfo
        };
        
        setMessages(prev => [...prev, cotizacionMessage]);
      }
      
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      
      // Mensaje de error
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Lo siento, ha ocurrido un error. Por favor, intenta nuevamente más tarde.'
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className=" fixed right-4 bottom-4 z-[1030]">
      {isOpen && (
        <section
          aria-label="Asistente de cotizaciones"
          className="fixed inset-x-3 bottom-20 flex h-[min(500px,70dvh)] flex-col overflow-hidden rounded-xl border bg-card shadow-lg sm:inset-x-auto sm:right-4 sm:w-[360px]"
        >
          <header className="flex items-center justify-between gap-2 bg-teal px-4 py-3 text-teal-foreground">
            <p className="font-bold">Asistente de cotizaciones</p>
            <button
              type="button"
              onClick={toggleChat}
              aria-label="Cerrar asistente"
              className="inline-flex size-9 items-center justify-center rounded-md outline-none hover:bg-white/15 focus-visible:ring-[3px] focus-visible:ring-white/40"
            >
              <XIcon className="size-4" />
            </button>
          </header>

          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4" aria-live="polite">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-line",
                  msg.role === "user"
                    ? "self-end rounded-br-md bg-success-soft text-foreground"
                    : "self-start rounded-bl-md bg-muted text-foreground"
                )}
              >
                {msg.content}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form
            className="flex items-center gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <input
              type="text"
              aria-label="Tu mensaje"
              placeholder={loading ? "Esperá un momento…" : "Escribí tu mensaje…"}
              value={inputMessage}
              onChange={handleInputChange}
              disabled={loading}
              className="h-11 min-w-0 flex-1 rounded-full border border-input bg-card px-4 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
            />
            <button
              type="submit"
              aria-label="Enviar mensaje"
              disabled={loading || inputMessage.trim() === ""}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-teal text-teal-foreground transition-colors hover:bg-teal/90 disabled:opacity-50"
            >
              <SendIcon className="size-4" />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={toggleChat}
        aria-label={isOpen ? "Cerrar asistente" : "Abrir asistente de cotizaciones"}
        aria-expanded={isOpen}
        className="inline-flex size-12 items-center justify-center rounded-full bg-teal text-teal-foreground shadow-lg transition-colors outline-none hover:bg-teal/90 focus-visible:ring-[3px] focus-visible:ring-ring/40"
      >
        {isOpen ? <XIcon className="size-5" /> : <MessageCircleIcon className="size-6" />}
      </button>
    </div>
  );
};

export default ChatWidget;
