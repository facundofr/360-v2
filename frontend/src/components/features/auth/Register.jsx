import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import Swal from "@/lib/alerts";
import { ENDPOINTS } from "../../config";
import logoCoberWhite from "../../../assets/img/logo-cober-white.svg";
// 👇 Importa los íconos
import { FaEye, FaEyeSlash, FaCheck, FaTimes } from "@/lib/icons";

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    password: "",
    password_confirmation: ""
  });
  const [errors, setErrors] = useState({});
  // 👇 Estados para mostrar/ocultar contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConf, setShowPasswordConf] = useState(false);
  // 👇 Estado para mostrar indicadores de contraseña
  const [showPasswordIndicators, setShowPasswordIndicators] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    
    // Limpiar error cuando el usuario está escribiendo
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: null
      });
    }
    
    // Mostrar indicadores cuando el usuario comienza a escribir la contraseña
    if (e.target.name === "password") {
      setShowPasswordIndicators(e.target.value.length > 0);
    }
    
    // Validar confirmación de contraseña en tiempo real
    if (e.target.name === "password_confirmation" || 
        (e.target.name === "password" && formData.password_confirmation)) {
      const password = e.target.name === "password" ? e.target.value : formData.password;
      const confirmation = e.target.name === "password_confirmation" ? e.target.value : formData.password_confirmation;
      
      if (password && confirmation && password !== confirmation) {
        setErrors({
          ...errors,
          password_confirmation: "Las contraseñas no coinciden"
        });
      } else {
        setErrors({
          ...errors,
          password_confirmation: null
        });
      }
    }
  };

  const showAlert = (icon, title, text) => {
    return Swal.fire({
      icon,
      title,
      text,
      confirmButtonColor: '#3085d6',
    });
  };

  // ⚠️ Manejo centralizado de errores del backend
  const handleServerErrors = (error) => {
    const data = error?.response?.data || {};
    // Incluir posibles claves que puede enviar el backend (incluye 'errores')
    const possibleArrays = [
      data.errors,
      data.details,
      data.validationErrors,
      data.errorFields,
      data.fieldErrors,
      data.errores,
      Array.isArray(data.error) ? data.error : null
    ].filter(Boolean);

    const array = Array.isArray(possibleArrays[0]) ? possibleArrays[0] : null;

    if (array && array.length) {
      const fieldErrors = {};
      const items = array.map((e, idx) => {
        const field = e.field || e.param || e.path || e.name || e.campo || `campo_${idx+1}`;
        const message = e.message || e.msg || e.error || e.mensaje || 'Dato inválido';
        const value = e.value !== undefined ? e.value : e.valor;
        if (field) fieldErrors[field] = message;
        return `<li><code>${field || `campo_${idx+1}`}</code>: ${message}${value !== undefined ? ` (valor: <em>${String(value)}</em>)` : ''}</li>`;
      });

      setErrors(prev => ({ ...prev, ...fieldErrors }));

      // Enfocar primer campo con error si existe
      const first = array[0];
      const firstField = first.field || first.param || first.path || first.name || first.campo;
      if (firstField) {
        setTimeout(() => {
          const el = document.querySelector(`[name="${firstField}"]`);
          el?.focus?.();
          el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        }, 0);
      }

      // Mostrar en SweetAlert
      Swal.fire({
        icon: 'error',
        title: 'Errores de validación',
        html: `<div style="text-align:left"><p>Revisá los siguientes campos:</p><ul>${items.join('')}</ul></div>`,
        confirmButtonText: 'Entendido',
      });
      return;
    }

    // Si no es array, mostrar mensaje directo del backend
    const message = data.message || data.error || 'Error al procesar la solicitud';
    Swal.fire({ icon: 'error', title: 'Error', text: message, confirmButtonColor: '#3085d6' });
  };

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
    if (formData.password !== formData.password_confirmation) {
      newErrors.password_confirmation = "Las contraseñas no coinciden";
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
    
    // Crear un objeto con todos los datos incluyendo password_confirmation para el backend
    const dataToSend = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone_number: formData.phone_number,
      password: formData.password,
      password_confirmation: formData.password_confirmation
    };
    
    try {
      const response = await axios.post(`${ENDPOINTS.AUTH}/register`, dataToSend);
      await showAlert("success", "¡Registro exitoso!", response.data.message || "Tu cuenta ha sido creada correctamente");
      navigate("/");
    } catch (error) {
      // Mapear errores del backend a los campos e informar claramente
      handleServerErrors(error);
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
          <h4 className="text-[1.5rem] leading-tight font-bold tracking-wide text-white mb-0">Registro de Usuario</h4>
        </div>
        <div className="flex-auto p-6">
          <form onSubmit={handleSubmit}>
            <div className="flex flex-wrap -mx-[calc(var(--gx)/2)] -mt-[var(--gy)] [--gx:1rem] [--gy:1rem]">
              <div className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] md:flex-none md:w-6/12">
                <label className="mb-1.5 inline-block text-sm font-semibold text-corporate">Nombre</label>
                <input 
                  type="text" 
                  name="first_name" 
                  className={`peer block w-full min-w-0 rounded-md border border-input bg-card px-3 h-11 text-base text-foreground shadow-xs outline-none placeholder:text-muted-foreground md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:bg-muted disabled:opacity-70 ${errors.first_name ? 'is-invalid border-destructive' : ''}`} 
                  onChange={handleChange} 
                  value={formData.first_name}
                  placeholder="Tu nombre"
                  required 
                />
                {errors.first_name && (
                  <div className="mt-1 hidden text-xs font-medium text-destructive peer-[.is-invalid]:block peer-aria-invalid:block">
                    {errors.first_name}
                  </div>
                )}
              </div>
              <div className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] md:flex-none md:w-6/12">
                <label className="mb-1.5 inline-block text-sm font-semibold text-corporate">Apellido</label>
                <input 
                  type="text" 
                  name="last_name" 
                  className={`peer block w-full min-w-0 rounded-md border border-input bg-card px-3 h-11 text-base text-foreground shadow-xs outline-none placeholder:text-muted-foreground md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:bg-muted disabled:opacity-70 ${errors.last_name ? 'is-invalid border-destructive' : ''}`} 
                  onChange={handleChange} 
                  value={formData.last_name}
                  placeholder="Tu apellido"
                  required 
                />
                {errors.last_name && (
                  <div className="mt-1 hidden text-xs font-medium text-destructive peer-[.is-invalid]:block peer-aria-invalid:block">
                    {errors.last_name}
                  </div>
                )}
              </div>
              <div className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] md:flex-none md:w-6/12">
                <label className="mb-1.5 inline-block text-sm font-semibold text-corporate">Correo</label>
                <input 
                  type="email" 
                  name="email" 
                  className={`peer block w-full min-w-0 rounded-md border border-input bg-card px-3 h-11 text-base text-foreground shadow-xs outline-none placeholder:text-muted-foreground md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:bg-muted disabled:opacity-70 ${errors.email ? 'is-invalid border-destructive' : ''}`} 
                  onChange={handleChange} 
                  value={formData.email}
                  placeholder="ejemplo@correo.com"
                  required 
                />
                {errors.email && (
                  <div className="mt-1 hidden text-xs font-medium text-destructive peer-[.is-invalid]:block peer-aria-invalid:block">
                    {errors.email}
                  </div>
                )}
              </div>
              <div className="relative w-full max-w-full shrink-0 px-[calc(var(--gx)/2)] mt-[var(--gy)] md:flex-none md:w-6/12">
                <label className="mb-1.5 inline-block text-sm font-semibold text-corporate">Teléfono</label>
                <input 
                  type="text" 
                  name="phone_number" 
                  className={`peer block w-full min-w-0 rounded-md border border-input bg-card px-3 h-11 text-base text-foreground shadow-xs outline-none placeholder:text-muted-foreground md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:bg-muted disabled:opacity-70 ${errors.phone_number ? 'is-invalid border-destructive' : ''}`} 
                  onChange={handleChange} 
                  value={formData.phone_number}
                  placeholder="Número de teléfono"
                />
                {errors.phone_number && (
                  <div className="mt-1 hidden text-xs font-medium text-destructive peer-[.is-invalid]:block peer-aria-invalid:block">
                    {errors.phone_number}
                  </div>
                )}
              </div>
              <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-full">
                <label className="mb-1.5 inline-block text-sm font-semibold text-corporate">Contraseña</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    className={`peer block w-full min-w-0 rounded-md border border-input bg-card px-3 h-11 text-base text-foreground shadow-xs outline-none placeholder:text-muted-foreground md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:bg-muted disabled:opacity-70 ${errors.password ? 'is-invalid border-destructive' : ''}`}
                    onChange={handleChange}
                    value={formData.password}
                    placeholder="Contraseña segura"
                    required
                    style={{ paddingRight: "40px" }} // espacio para el icono
                  />
                  {errors.password && (
                    <div className="mt-1 hidden text-xs font-medium text-destructive peer-[.is-invalid]:block peer-aria-invalid:block">
                      {errors.password}
                    </div>
                  )}
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
              <div className="relative max-w-full px-[calc(var(--gx)/2)] mt-[var(--gy)] flex-none w-full">
                <label className="mb-1.5 inline-block text-sm font-semibold text-corporate">Confirmar Contraseña</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPasswordConf ? "text" : "password"}
                    name="password_confirmation"
                    className={`peer block w-full min-w-0 rounded-md border border-input bg-card px-3 h-11 text-base text-foreground shadow-xs outline-none placeholder:text-muted-foreground md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:bg-muted disabled:opacity-70 ${errors.password_confirmation ? 'is-invalid border-destructive' : ''}`}
                    onChange={handleChange}
                    value={formData.password_confirmation}
                    placeholder="Repite tu contraseña"
                    required
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
                  {errors.password_confirmation && (
                    <div className="mt-1 hidden text-xs font-medium text-destructive peer-[.is-invalid]:block peer-aria-invalid:block">
                      {errors.password_confirmation}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid gap-2 mt-6">
              <button type="submit" className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 min-h-12 px-6 py-2 text-base" style={{ borderRadius: "12px" }}>
                Registrarse
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="mb-4">¿Ya tienes una cuenta? <Link to="/" className="no-underline">Inicia sesión aquí</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;