import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import Swal from "@/lib/alerts";
import { ENDPOINTS, API_URL } from "../../config";
import logoCoberWhite from "../../../assets/img/logo-cober-white.svg";
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// 🔐 Importar el contexto de autenticación
import { useAuth } from "../../common/AuthContext";
import Footer from "../../common/Footer";

const ROLES = {
  VENDEDOR: 1,
  SUPERVISOR: 2,
  ADMIN: 3,
  BACK_OFFICE: 4,
};

const Login = () => {
  // 🔐 Usar el contexto de autenticación
  const { login: authLogin } = useAuth();
  
  // 🔐 Hook de reCAPTCHA v3
  const { executeRecaptcha } = useGoogleReCaptcha();
  
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const showAlert = (icon, title, text) => {
    return Swal.fire({
      icon,
      title,
      text,
      confirmButtonColor: "#3085d6",
      timer: 1800,
      showConfirmButton: false,
      timerProgressBar: true
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // � Verificar que reCAPTCHA esté disponible
    if (!executeRecaptcha) {
      showAlert("warning", "Verificación requerida", "reCAPTCHA no está listo. Por favor, recarga la página.");
      return;
    }
    
    setLoading(true);

    try {
      // 🔐 Ejecutar reCAPTCHA v3 antes del login
      const recaptchaToken = await executeRecaptcha('login');
      
      // Incluir el token de reCAPTCHA en la petición
      const response = await axios.post(`${ENDPOINTS.AUTH}/login`, {
        ...formData,
        recaptchaToken
      });
      const { token, role, user } = response.data;
      
      const loginTime = new Date().toISOString();

      // Crear sesión en el backend
      let sessionId = null;
      try {
        const sessionRes = await axios.post(
          `${API_URL}/sessions/start`,
          {
            login_time: loginTime,
            user_agent: navigator.userAgent
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        sessionId = sessionRes.data.sessionId;
      } catch (sessionError) {
        console.error("Error registrando sesión:", sessionError);
      }

      // Preparar datos del usuario para el contexto
      const userData = {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        sessionId: sessionId,
        loginTime: loginTime
      };

      // Usar el método login del contexto
      const loginSuccess = authLogin(userData, token);
      
      if (loginSuccess) {
        await showAlert("success", "¡Bienvenido!", "Has iniciado sesión correctamente");

        // Navegar según el rol
        if (role === ROLES.ADMIN) {
          navigate("/admin-dashboard", { replace: true });
        } else if (role === ROLES.BACK_OFFICE) {
          navigate("/backoffice", { replace: true });
        } else if (role === ROLES.SUPERVISOR) {
          navigate("/supervisor-dashboard", { replace: true });
        } else if (role === ROLES.VENDEDOR) {
          navigate("/prospectos-dashboard", { replace: true });
        }
      } else {
        throw new Error("Error en el proceso de autenticación");
      }

    } catch (error) {
      const errorMessage = error.response?.data?.message || "Error en el inicio de sesión";
      showAlert("error", "Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className=" flex min-h-[calc(100dvh-60px)] items-center justify-center bg-background px-4 pt-4 pb-20 md:min-h-[calc(100dvh-80px)]">
      <main className="w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-lg">
        <header className="flex flex-col items-center gap-4 bg-primary px-6 py-7 text-center">
          <img src={logoCoberWhite} alt="Cober Salud" className="h-12 w-auto" />
          <h1 className="text-xl font-bold tracking-wide text-white">Iniciar sesión</h1>
        </header>
        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">Correo electrónico</Label>
              <Input id="login-email" type="email" name="email" autoComplete="email" onChange={handleChange} placeholder="ejemplo@correo.com" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  onChange={handleChange}
                  placeholder="Ingresá tu contraseña"
                  required
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30"
                >
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" size="lg" className="mt-2 h-12 w-full text-base" disabled={loading}>
              {loading && <Loader2Icon className="animate-spin" />}
              {loading ? "Verificando…" : "Iniciar sesión"}
            </Button>
          </form>

          <div className="flex flex-col gap-2 text-center text-sm text-muted-foreground">
            <p>
              ¿No tenés una cuenta?{" "}
              <Link to="/register" className="font-semibold text-primary hover:underline">
                Registrate
              </Link>
            </p>
            <p>
              ¿Olvidaste tu contraseña?{" "}
              <Link to="/reset" className="font-semibold text-primary hover:underline">
                Recuperala acá
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Login;
