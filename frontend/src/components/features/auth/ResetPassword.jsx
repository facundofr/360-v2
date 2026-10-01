import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "@/lib/alerts";
import { ENDPOINTS } from "../../config";
import logoCoberWhite from "../../../assets/img/logo-cober-white.svg";
// 👇 Importa los íconos
import { FaEye, FaEyeSlash, FaCheck, FaTimes } from "@/lib/icons";


const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        password: "",
        confirmPassword: ""
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    // 👇 Estados para mostrar/ocultar contraseñas
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConf, setShowPasswordConf] = useState(false);
    // 👇 Estado para mostrar indicadores de contraseña
    const [showPasswordIndicators, setShowPasswordIndicators] = useState(false);

    // 📋 Función para validar requisitos de contraseña
    const getPasswordRequirements = (password) => {
        return {
            length: password.length >= 8 && password.length <= 128,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
        };
    };

    // 💪 Función para calcular fortaleza de contraseña
    const getPasswordStrength = (password) => {
        const requirements = getPasswordRequirements(password);
        const metRequirements = Object.values(requirements).filter(Boolean).length;
        
        if (metRequirements === 0) return { level: 0, text: "", color: "" };
        if (metRequirements <= 2) return { level: 1, text: "Débil", color: "#dc3545" };
        if (metRequirements <= 3) return { level: 2, text: "Regular", color: "#ffc107" };
        if (metRequirements <= 4) return { level: 3, text: "Buena", color: "#fd7e14" };
        return { level: 4, text: "Muy fuerte", color: "#198754" };
    };

    // 🎨 Componente indicador de requisito
    const PasswordRequirement = ({ met, text }) => (
        <div className="flex items-center mb-1" style={{ fontSize: "0.875rem" }}>
            {met ? (
                <FaCheck className="text-success me-2" />
            ) : (
                <FaTimes className="text-destructive me-2" />
            )}
            <span className={met ? "text-success" : "text-muted-foreground"}>{text}</span>
        </div>
    );

    // 📊 Componente barra de fortaleza
    const PasswordStrengthBar = ({ strength }) => (
        <div className="mt-2">
            <div className="flex justify-between items-center mb-1">
                <span style={{ fontSize: "0.875rem", fontWeight: "600" }}>Fortaleza:</span>
                <span style={{ 
                    fontSize: "0.875rem", 
                    fontWeight: "600", 
                    color: strength.color 
                }}>
                    {strength.text}
                </span>
            </div>
            <div style={{ 
                height: "6px", 
                backgroundColor: "#e9ecef", 
                borderRadius: "3px",
                overflow: "hidden"
            }}>
                <div style={{
                    height: "100%",
                    width: `${(strength.level / 4) * 100}%`,
                    backgroundColor: strength.color,
                    transition: "all 0.3s ease"
                }}></div>
            </div>
        </div>
    );

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Limpiar error cuando el usuario está escribiendo
        if (errors[name]) {
            setErrors({
                ...errors,
                [name]: null
            });
        }

        // Mostrar indicadores cuando el usuario comienza a escribir la contraseña
        if (name === "password") {
            setShowPasswordIndicators(value.length > 0);
        }

        // Validar confirmación de contraseña en tiempo real
        if (name === "confirmPassword" || 
            (name === "password" && formData.confirmPassword)) {
            const password = name === "password" ? value : formData.password;
            const confirmation = name === "confirmPassword" ? value : formData.confirmPassword;
            
            if (password && confirmation && password !== confirmation) {
                setErrors({
                    ...errors,
                    confirmPassword: "Las contraseñas no coinciden"
                });
            } else {
                setErrors({
                    ...errors,
                    confirmPassword: null
                });
            }
        }
    };

    const validateForm = () => {
        const newErrors = {};
        
        // Validar requisitos de contraseña
        const requirements = getPasswordRequirements(formData.password);
        if (!requirements.length) {
            newErrors.password = "La contraseña debe tener entre 8 y 128 caracteres";
        } else if (!requirements.lowercase) {
            newErrors.password = "La contraseña debe contener al menos una letra minúscula";
        } else if (!requirements.uppercase) {
            newErrors.password = "La contraseña debe contener al menos una letra mayúscula";
        } else if (!requirements.number) {
            newErrors.password = "La contraseña debe contener al menos un número";
        } else if (!requirements.special) {
            newErrors.password = "La contraseña debe contener al menos un símbolo especial";
        }
        
        // Validar que las contraseñas coincidan
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Las contraseñas no coinciden";
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validar el formulario antes de enviar
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        
        try {
            const response = await axios.post(
                `${ENDPOINTS.AUTH}/reset-password/${token}`,
                { password: formData.password } // Corregido: usar 'password' en lugar de 'newPassword'
            );
            
            await Swal.fire({
                icon: "success",
                title: "¡Contraseña actualizada!",
                text: response.data.message || "Tu contraseña ha sido restablecida correctamente.",
                confirmButtonColor: "#3085d6"
            });
            
            // Redirigir después de éxito (respetando basename /afiliaciones)
            navigate("/", { replace: true });
            
        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: error.response?.data?.message || "Error al restablecer la contraseña",
                confirmButtonColor: "#3085d6"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex justify-center items-center" style={{ minHeight: "100vh", background: "#f8f9fa" }}>
            <div className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg" style={{ width: "600px", maxWidth: "90%", borderRadius: "20px", overflow: "hidden" }}>
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
                    <h4 className="text-[1.5rem] leading-tight font-bold tracking-wide text-white mb-0">Restablecer Contraseña</h4>
                </div>
                <div className="flex-auto p-6">
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label htmlFor="password" className="mb-1.5 inline-block text-sm font-semibold text-corporate">Nueva Contraseña</label>
                            <div style={{ position: "relative" }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className={`peer block w-full min-w-0 rounded-md border border-input bg-card px-3 h-11 text-base text-foreground shadow-xs outline-none placeholder:text-muted-foreground md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:bg-muted disabled:opacity-70 ${errors.password ? 'is-invalid border-destructive' : ''}`}
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    placeholder="Contraseña segura"
                                    style={{ paddingRight: "40px" }}
                                />
                                <span
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    style={{
                                        position: "absolute",
                                        right: "10px",
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        cursor: "pointer",
                                        color: "#888",
                                        zIndex: 2
                                    }}
                                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                    tabIndex={0}
                                    role="button"
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </span>
                                {errors.password && (
                                    <div className="mt-1 hidden text-xs font-medium text-destructive peer-[.is-invalid]:block peer-aria-invalid:block">
                                        {errors.password}
                                    </div>
                                )}
                            </div>

                            {/* 📋 Indicadores de requisitos de contraseña */}
                            {showPasswordIndicators && (
                                <div className="mt-2 p-4" style={{ 
                                    backgroundColor: "#f8f9fa", 
                                    borderRadius: "8px", 
                                    border: "1px solid #e9ecef" 
                                }}>
                                    {/* Barra de fortaleza */}
                                    <PasswordStrengthBar strength={getPasswordStrength(formData.password)} />
                                    
                                    <div className="mb-2 mt-4" style={{ fontSize: "0.875rem", fontWeight: "600", color: "#495057" }}>
                                        Requisitos de contraseña:
                                    </div>
                                    {(() => {
                                        const requirements = getPasswordRequirements(formData.password);
                                        return (
                                            <>
                                                <PasswordRequirement 
                                                    met={requirements.length} 
                                                    text="Entre 8 y 128 caracteres" 
                                                />
                                                <PasswordRequirement 
                                                    met={requirements.lowercase} 
                                                    text="Al menos una letra minúscula (a-z)" 
                                                />
                                                <PasswordRequirement 
                                                    met={requirements.uppercase} 
                                                    text="Al menos una letra mayúscula (A-Z)" 
                                                />
                                                <PasswordRequirement 
                                                    met={requirements.number} 
                                                    text="Al menos un número (0-9)" 
                                                />
                                                <PasswordRequirement 
                                                    met={requirements.special} 
                                                    text="Al menos un símbolo especial (!@#$%^&*)" 
                                                />
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                        
                        <div className="mb-6">
                            <label htmlFor="confirmPassword" className="mb-1.5 inline-block text-sm font-semibold text-corporate">Confirmar Nueva Contraseña</label>
                            <div style={{ position: "relative" }}>
                                <input
                                    type={showPasswordConf ? "text" : "password"}
                                    className={`peer block w-full min-w-0 rounded-md border border-input bg-card px-3 h-11 text-base text-foreground shadow-xs outline-none placeholder:text-muted-foreground md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:bg-muted disabled:opacity-70 ${errors.confirmPassword ? 'is-invalid border-destructive' : ''}`}
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                    placeholder="Repite tu nueva contraseña"
                                    style={{ paddingRight: "40px" }}
                                />
                                <span
                                    onClick={() => setShowPasswordConf((prev) => !prev)}
                                    style={{
                                        position: "absolute",
                                        right: "10px",
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        cursor: "pointer",
                                        color: "#888",
                                        zIndex: 2
                                    }}
                                    aria-label={showPasswordConf ? "Ocultar contraseña" : "Mostrar contraseña"}
                                    tabIndex={0}
                                    role="button"
                                >
                                    {showPasswordConf ? <FaEyeSlash /> : <FaEye />}
                                </span>
                                {errors.confirmPassword && (
                                    <div className="mt-1 hidden text-xs font-medium text-destructive peer-[.is-invalid]:block peer-aria-invalid:block">
                                        {errors.confirmPassword}
                                    </div>
                                )}
                            </div>
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
                                        Procesando...
                                    </>
                                ) : "Restablecer Contraseña"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;