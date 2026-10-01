import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "@/lib/alerts";
import { ENDPOINTS } from "../../config";


const VerifyEmail = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [verificationStatus, setVerificationStatus] = useState("pending"); // "pending", "loading", "success", "error"
  const [message, setMessage] = useState("");

  const handleVerification = async () => {
    setVerificationStatus("loading");
    
    try {
      // Hacer la petición al backend para verificar el token
      const response = await axios.get(`${ENDPOINTS.AUTH}/verify/${token}`);
      
      setVerificationStatus("success");
      setMessage(response.data.message || "Tu cuenta ha sido verificada correctamente.");
      
      // Mostrar alerta de éxito
      Swal.fire({
        icon: "success",
        title: "¡Verificación exitosa!",
        text: response.data.message || "Tu cuenta ha sido verificada correctamente.",
        confirmButtonColor: "#3085d6",
      });

      // Esperar 2 segundos y redirigir respetando basename (/afiliaciones)
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 2000);
      
    } catch (error) {
      setVerificationStatus("error");
      setMessage(error.response?.data?.message || "No se pudo verificar tu cuenta. El enlace podría haber expirado.");
      
      // Mostrar alerta de error
      Swal.fire({
        icon: "error",
        title: "Error de verificación",
        text: error.response?.data?.message || "No se pudo verificar tu cuenta. El enlace podría haber expirado.",
        confirmButtonColor: "#3085d6",
      });
    }
  };

  return (
    <div className="flex justify-center items-center" style={{ minHeight: "100vh", background: "#f8f9fa" }}>
      <div className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg" style={{ width: "500px", maxWidth: "90%", borderRadius: "20px", overflow: "hidden" }}>
        <div 
          className={`border-b bg-muted/40 px-4 py-3 font-semibold text-white text-center py-4 ${
            verificationStatus === 'success' ? 'bg-success' : 
            verificationStatus === 'error' ? 'bg-destructive' : 
            'bg-primary'
          }`}
          style={{ borderTopLeftRadius: "20px", borderTopRightRadius: "20px" }}
        >
          <h4 className="text-[1.5rem] font-bold leading-tight tracking-tight text-corporate mb-0">
            {verificationStatus === "pending" && "Verificación de cuenta"}
            {verificationStatus === "loading" && "Verificando cuenta..."}
            {verificationStatus === "success" && "¡Cuenta verificada!"}
            {verificationStatus === "error" && "Error de verificación"}
          </h4>
        </div>
        <div className="flex-auto p-6 text-center">
          {verificationStatus === "pending" && (
            <div className="my-6">
              <div className="mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="currentColor" className="text-primary" viewBox="0 0 16 16">
                  <path d="M2 2a2 2 0 0 0-2 2v8.01A2 2 0 0 0 2 14h5.5a.5.5 0 0 0 0-1H2a1 1 0 0 1-.966-.741l5.64-3.471L8 9.583l7-4.2V8.5a.5.5 0 0 0 1 0V4a2 2 0 0 0-2-2H2Zm3.708 6.208L1 11.105V5.383l4.708 2.825ZM1 4.217V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v.217l-7 4.2-7-4.2Z"/>
                  <path d="M16 12.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm-1.993-1.679a.5.5 0 0 0-.686.172l-1.17 1.95-.547-.547a.5.5 0 0 0-.708.708l.774.773a.75.75 0 0 0 1.174-.144l1.335-2.226a.5.5 0 0 0-.172-.686Z"/>
                </svg>
              </div>
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-4">¡Estás a un paso de completar tu registro!</h5>
              <p className="mb-4">Para verificar tu cuenta, por favor haz clic en el botón de abajo.</p>
              <div className="mt-6">
                <button 
                  onClick={handleVerification} 
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 min-h-12 px-6 py-2 text-base" 
                  style={{ borderRadius: "12px" }}
                >
                  Verificar mi cuenta
                </button>
              </div>
            </div>
          )}
          
          {verificationStatus === "loading" && (
            <div className="my-6">
              <div className="inline-block size-8 animate-spin rounded-full border-4 border-current border-r-transparent align-middle text-primary" role="status">
                <span className="sr-only">Cargando...</span>
              </div>
              <p className="mb-4 mt-4">Estamos verificando tu cuenta, por favor espera...</p>
            </div>
          )}
          
          {verificationStatus === "success" && (
            <div className="my-6">
              <div className="mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="currentColor" className="text-success" viewBox="0 0 16 16">
                  <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                </svg>
              </div>
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-4">¡Tu cuenta ha sido verificada con éxito!</h5>
              <p className="mb-4">{message}</p>
              <div className="mt-6">
                <Link to="/login" className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 bg-success text-success-foreground hover:bg-success/90 min-h-12 px-6 py-2 text-base" style={{ borderRadius: "12px" }}>
                  Iniciar sesión
                </Link>
              </div>
            </div>
          )}
          
          {verificationStatus === "error" && (
            <div className="my-6">
              <div className="mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="currentColor" className="text-destructive" viewBox="0 0 16 16">
                  <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/>
                </svg>
              </div>
              <h5 className="text-[1.25rem] font-bold leading-tight tracking-tight text-corporate mb-4">No pudimos verificar tu cuenta</h5>
              <p className="mb-4">{message}</p>
              <div className="mt-6">
                <Link to="/login" className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 min-h-10 px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 me-2" style={{ borderRadius: "12px" }}>
                  Ir al inicio de sesión
                </Link>
                <Link to="/resend-verification" className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 min-h-10 px-4 py-2 text-sm border-primary bg-card text-primary hover:bg-primary hover:text-primary-foreground" style={{ borderRadius: "12px" }}>
                  Solicitar nuevo enlace
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;