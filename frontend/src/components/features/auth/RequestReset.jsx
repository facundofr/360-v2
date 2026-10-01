import { useState } from "react";
import axios from "axios";
import Swal from "@/lib/alerts";
import { ENDPOINTS } from "../../config";
import logoCoberWhite from "../../../assets/img/logo-cober-white.svg";


const RequestReset = () => {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validación básica de email
        if (!email.includes("@") || !email.includes(".")) {
            Swal.fire({
                icon: "error",
                title: "Email inválido",
                text: "Por favor ingresa un correo electrónico válido",
                confirmButtonColor: "#3085d6"
            });
            return;
        }

        setLoading(true);
        
        try {
            const response = await axios.post(
                `${ENDPOINTS.AUTH}/request-password-reset`,
                { email }
            );
            
            await Swal.fire({
                icon: "success",
                title: "¡Solicitud enviada!",
                html: `
                    <p>${response.data.message || 'Hemos enviado un enlace de recuperación a tu correo electrónico.'}</p>
                    <small class="text-muted">Si no lo ves en tu bandeja principal, revisa la carpeta de spam.</small>
                `,
                confirmButtonColor: "#3085d6"
            });
            
            // Limpiar el formulario después del éxito
            setEmail("");
            
        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: error.response?.data?.message || "Error al solicitar el restablecimiento de contraseña",
                confirmButtonColor: "#3085d6"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex justify-center items-center" style={{ minHeight: "100vh", background: "#f8f9fa" }}>
            <div className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg" style={{ width: "500px", maxWidth: "90%", borderRadius: "20px", overflow: "hidden" }}>
                <div className="border-b px-4 font-semibold bg-primary text-white text-center py-4" 
                     style={{ borderTopLeftRadius: "20px", borderTopRightRadius: "20px" }}>
                    <div className="mb-4">
                        <img 
                            src={logoCoberWhite} 
                            alt="COBER Salud" 
                            style={{ 
                                height: "50px", 
                                width: "auto",
                                filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))"
                            }}
                        />
                    </div>
                    <h4 className="text-[1.5rem] leading-tight font-bold tracking-wide text-white mb-0">Recuperar Contraseña</h4>
                </div>
                <div className="flex-auto p-6">
                    <form onSubmit={handleSubmit}>
                        <div className="mb-6">
                            <label htmlFor="email" className="mb-1.5 inline-block text-sm font-semibold text-corporate">Correo Electrónico</label>
                            <input
                                type="email"
                                className="peer block w-full min-w-0 rounded-md border border-input bg-card px-3 h-11 text-base text-foreground shadow-xs outline-none placeholder:text-muted-foreground md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:bg-muted disabled:opacity-70"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="Ingresa tu correo registrado"
                            />
                        </div>
                        <div className="grid">
                            <button 
                                type="submit" 
                                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 min-h-12 px-6 py-2 text-base"
                                disabled={loading}
                                style={{ borderRadius: "12px" }}
                            >
                                {loading ? (
                                    <>
                                        <span className="inline-block animate-spin rounded-full border-current border-r-transparent align-middle size-4 border-2 me-2" role="status" aria-hidden="true"></span>
                                        Enviando...
                                    </>
                                ) : "Enviar Instrucciones"}
                            </button>
                        </div>
                        <div className="mt-4 text-center">
                            <small className="text-[0.875em] text-muted-foreground">
                                Te enviaremos un enlace para restablecer tu contraseña.
                            </small>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RequestReset;