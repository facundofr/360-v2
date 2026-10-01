import { useState, useEffect } from "react";
import { Container, Row, Col, Button, ListGroup, Offcanvas, Spinner, Card, Badge } from "@/components/compat/bootstrap";
import { useNavigate } from "react-router-dom";
import { 
  FaUsers, 
  FaMoneyBillWave, 
  FaSignOutAlt, 
  FaBars, 
  FaChevronLeft,
  FaTachometerAlt,
  FaChartLine,
  FaCog,
  FaClipboardList,
  FaHospital,
  FaTimes,
  FaUserShield,
  FaFileContract, // ✅ NUEVO ICONO PARA PÓLIZAS
  FaAddressBook, // ✅ NUEVO ICONO PARA PROSPECTOS
  FaUserTie, // ✅ NUEVO ICONO PARA VENDEDORES
  FaChalkboardTeacher, // ✅ NUEVO ICONO PARA SUPERVISORES
  FaCircle,
  FaCashRegister,
  FaExchangeAlt,
  FaWhatsapp,
  FaBalanceScale
} from "@/lib/icons";
import axios from "axios";
import Swal from "@/lib/alerts";
import { API_URL } from "../../config.js";
import UsuariosAdmin from "./UsuariosAdmin";
import ListaPreciosAdmin from "./ListaPreciosAdmin";
import PrestadoresAdmin from "./PrestadoresAdmin";
import PolizasAdmin from "./PolizasAdmin"; // ✅ IMPORTAR COMPONENTE DE PÓLIZAS
import ProspectosAdmin from "./ProspectosAdmin"; // ✅ IMPORTAR COMPONENTE DE PROSPECTOS
import VendedoresAdmin from "./VendedoresAdmin"; // ✅ NUEVO: Gestión de vendedores
import SupervisoresAdmin from "./SupervisoresAdmin"; // ✅ NUEVO: Gestión de supervisores
import PromocionesAdmin from "./promocionesAdmin"; // ✅ NUEVO: Gestión de promociones
import RefritosAdmin from "./RefritosAdmin"; // ✅ NUEVO: Refritos
import ReasignacionAutomaticaAdmin from "./ReasignacionAutomaticaAdmin"; // ✅ NUEVO: Dashboard de Reasignación Automática
import ValidacionWhatsappAdmin from "./ValidacionWhatsappAdmin"; // ✅ NUEVO: Validador de leads por WhatsApp
import CompensadorAdmin from "./CompensadorAdmin"; // ✅ NUEVO: Compensador de leads (balanceador Producción/Bariloche)
import MonotributoAdmin from "./MonotributoAdmin"; // ✅ NUEVO: Gestión de Monotributo
import DashboardMetricasProspectos from "./DashboardMetricasProspectos"; // ✅ NUEVO: Dashboard de Métricas

const AdminDashboard = () => {
  const [vista, setVista] = useState("usuarios");
  const [openDrawer, setOpenDrawer] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 992) {
        setOpenDrawer(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("cober_token");
      const sessionId = localStorage.getItem("cober_sessionId");
      const loginTime = localStorage.getItem("cober_loginTime");
      
      if (token && sessionId) {
        const sessionTime = Math.floor((new Date() - new Date(loginTime)) / 1000);
        
        await axios.post(
          `${API_URL}/sessions/end`,
          {
            session_id: sessionId,
            logout_time: new Date().toISOString(),
            session_time: sessionTime
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    } finally {
      localStorage.removeItem("cober_token");
      localStorage.removeItem("cober_loginTime");
      localStorage.removeItem("cober_sessionId");
      localStorage.removeItem("cober_user_id");
      localStorage.removeItem("cober_first_name");
      localStorage.removeItem("cober_last_name");
      localStorage.removeItem("cober_user_role");
      localStorage.removeItem("cober_user_email");
      
      Swal.fire({
        icon: 'success',
        title: 'Sesión cerrada',
        text: 'Has cerrado sesión correctamente',
        confirmButtonColor: '#3085d6'
      }).then(() => {
        navigate('/');
      });
    }
  };

  // ✅ OPCIONES DEL MENÚ ACTUALIZADAS (agregamos pólizas y prospectos)
  const menuItems = [
    { id: "dashboard-metricas", label: "Dashboard Métricas", icon: FaChartLine, color: "primary" }, // ✅ NUEVO: Dashboard de Métricas
    { id: "usuarios", label: "Usuarios", icon: FaUsers, color: "primary" },
    { id: "vendedores", label: "Vendedores", icon: FaUserTie, color: "info" }, // ✅ NUEVO
    { id: "supervisores", label: "Supervisores", icon: FaChalkboardTeacher, color: "secondary" }, // ✅ NUEVO
    { id: "prospectos", label: "Prospectos", icon: FaAddressBook, color: "warning" }, // ✅ NUEVO
    { id: "polizas", label: "Pólizas", icon: FaFileContract, color: "success" }, // ✅ NUEVO
    { id: "promociones", label: "Promociones", icon: FaCashRegister, color: "danger" }, // ✅ NUEVO
    { id: "refritos", label: "Refritos", icon: FaClipboardList, color: "dark" }, // ✅ NUEVO: Refritos en el menú
    { id: "reasignaciones", label: "Reasignación automática", icon: FaExchangeAlt, color: "primary" }, // ✅ NUEVO: Reasignación automática
    { id: "validacion-whatsapp", label: "Validador WhatsApp", icon: FaWhatsapp, color: "success" }, // ✅ NUEVO: Validador de leads por WhatsApp
    { id: "compensador", label: "Compensador de leads", icon: FaBalanceScale, color: "primary" }, // ✅ NUEVO: Balanceador de leads Producción/Bariloche
    { id: "prestadores", label: "Prestadores", icon: FaHospital, color: "info" },
    { id: "precios", label: "Lista de Precios", icon: FaMoneyBillWave, color: "warning" },
    { id: "monotributo", label: "Monotributo", icon: FaMoneyBillWave, color: "success" } // ✅ NUEVO: Gestión de Monotributo
  ];

  // Sidebar content mejorado
  const drawerContent = (
    <div className="flex flex-col bg-sidebar h-full">
      <div className="border-b border-sidebar-border px-5 py-4">
        <div className="flex items-center justify-between">
          <h5 className="tracking-tight flex items-center gap-2 text-lg font-bold text-corporate mb-0">
            <FaUserShield className="text-primary" />
            Admin <span className="font-light">Panel</span>
          </h5>
          <Button 
            variant="light" 
            size="sm" 
            className="size-10 p-0 lg:hidden"
            onClick={() => setOpenDrawer(false)}
          >
            <FaTimes />
          </Button>
        </div>
      </div>
      
      <div className="flex flex-1 flex-col gap-1 p-3">
        {menuItems.map((item) => (
          <div key={item.id} className="">
              <button
                className={`relative flex min-h-12 w-full items-center gap-3 rounded-md px-4 text-left font-medium text-sidebar-foreground transition-colors outline-none hover:bg-primary/5 hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/30 w-full text-left ${vista === item.id ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : ""}`}
                onClick={() => {
                  setVista(item.id);
                  setOpenDrawer(false);
                }}
              >
                <item.icon className="size-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            </div>
          ))}
        
        {/* Logout section */}
        <div className="border-t border-sidebar-border p-3">
          {/* <button
            className="logout-btn"
            onClick={handleLogout}
          >
            <FaSignOutAlt />
            <span>Cerrar Sesión</span>
          </button> */}
        </div>
      </div>
    </div>
  );

  const getVistaTitle = () => {
    const item = menuItems.find(item => item.id === vista);
    return item ? item.label : "Dashboard";
  };

  const getVistaIcon = () => {
    const item = menuItems.find(item => item.id === vista);
    return item ? item.icon : FaTachometerAlt;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-dvh">
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <div className="mt-2">Cargando...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Layout para Desktop */}
      <div className="hidden min-h-[calc(100dvh-80px)] bg-background lg:flex">
        {/* Sidebar fijo */}
        <div className="fixed top-20 bottom-0 left-0 z-[1020] w-[280px] overflow-y-auto border-r border-sidebar-border bg-sidebar">
          {drawerContent}
        </div>
        
        {/* Contenido principal */}
        <div className="ml-[280px] min-w-0 flex-1">
          {/* Contenido */}
          <Container fluid className="p-6">
            {vista === "dashboard-metricas" && <DashboardMetricasProspectos />} {/* ✅ NUEVA VISTA */}
            {vista === "usuarios" && <UsuariosAdmin />}
            {vista === "vendedores" && <VendedoresAdmin />} {/* ✅ NUEVO */}
            {vista === "supervisores" && <SupervisoresAdmin />} {/* ✅ NUEVO */}
            {vista === "prospectos" && <ProspectosAdmin />} {/* ✅ NUEVA VISTA */}
            {vista === "polizas" && <PolizasAdmin />} {/* ✅ NUEVA VISTA */}
            {vista === "promociones" && <PromocionesAdmin />} {/* ✅ NUEVA VISTA */}
            {vista === "prestadores" && <PrestadoresAdmin />}
            {vista === "precios" && <ListaPreciosAdmin />}
            {vista === "monotributo" && <MonotributoAdmin />} {/* ✅ NUEVA VISTA */}
            {vista === "refritos" && <RefritosAdmin />} {/* ✅ NUEVA VISTA */}
            {vista === "reasignaciones" && <ReasignacionAutomaticaAdmin />} {/* ✅ NUEVA VISTA */}
            {vista === "validacion-whatsapp" && <ValidacionWhatsappAdmin />} {/* ✅ NUEVA VISTA */}
            {vista === "compensador" && <CompensadorAdmin />} {/* ✅ NUEVA VISTA */}
          </Container>
        </div>
      </div>

      {/* Layout para Mobile/Tablet */}
      <div className="min-h-[calc(100dvh-60px)] bg-background lg:hidden">
        {/* Offcanvas Sidebar mejorado */}
        <Offcanvas
          show={openDrawer}
          onHide={() => setOpenDrawer(false)}
          placement="start"
          className="w-72 max-w-[85vw]"
        >
          <Offcanvas.Header closeButton>
            <Offcanvas.Title>Panel de Administración</Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body className="p-0">
            {drawerContent}
          </Offcanvas.Body>
        </Offcanvas>

        {/* Botón menú móvil */}
        <div className="flex justify-start p-4 lg:hidden">
          <Button 
            variant="outline-primary" 
            size="sm" 
            onClick={() => setOpenDrawer(true)}
          >
            <FaBars className="me-2" />
            Menú
          </Button>
        </div>

        {/* Contenido móvil */}
        <Container fluid className="p-4">
          {/* Dashboard principal - Cards de navegación mejoradas */}
          {vista === "dashboard" && (
            <Row className="[--gx:1rem] [--gy:1rem]">
              {menuItems.map((item) => (
                <Col key={item.id} xs={6} sm={4}>
                  <Card 
                    className={`transition-shadow hover:shadow-md shadow-xs h-full`} 
                    style={{ cursor: "pointer" }}
                    onClick={() => setVista(item.id)}
                  >
                    <Card.Body>
                      <item.icon className="mb-2 size-6 opacity-80" />
                      <h6 className="tracking-tight mb-2 text-lg leading-snug font-bold text-corporate">{item.label}</h6>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          {/* Vistas específicas con botón de regreso mejorado */}
          {vista === "usuarios" && (
            <div>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="mb-4 flex items-center"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <UsuariosAdmin />
            </div>
          )}

          {/* ✅ NUEVA VISTA DE VENDEDORES PARA MÓVIL */}
          {vista === "vendedores" && (
            <div>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="mb-4 flex items-center"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <VendedoresAdmin />
            </div>
          )}

          {/* ✅ NUEVA VISTA DE SUPERVISORES PARA MÓVIL */}
          {vista === "supervisores" && (
            <div>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="mb-4 flex items-center"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <SupervisoresAdmin />
            </div>
          )}

          {/* ✅ NUEVA VISTA DE PROSPECTOS PARA MÓVIL */}
          {vista === "dashboard-metricas" && (
            <div>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="mb-4 flex items-center"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <DashboardMetricasProspectos />
            </div>
          )}

          {/* ✅ NUEVA VISTA DE PROSPECTOS PARA MÓVIL */}
          {vista === "prospectos" && (
            <div>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="mb-4 flex items-center"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <ProspectosAdmin />
            </div>
          )}

          {/* ✅ NUEVA VISTA DE PÓLIZAS PARA MÓVIL */}
          {vista === "polizas" && (
            <div>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="mb-4 flex items-center"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <PolizasAdmin />
            </div>
          )}

          {/* ✅ NUEVA VISTA DE PROMOCIONES PARA MÓVIL */}
          {vista === "promociones" && (
            <div>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="mb-4 flex items-center"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <PromocionesAdmin />
            </div>
          )}

          {vista === "prestadores" && (
            <div>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="mb-4 flex items-center"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <PrestadoresAdmin />
            </div>
          )}

          {vista === "precios" && (
            <div>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="mb-4 flex items-center"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <ListaPreciosAdmin />
            </div>
          )}

          {/* ✅ NUEVA VISTA DE MONOTRIBUTO PARA MÓVIL */}
          {vista === "monotributo" && (
            <div>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="mb-4 flex items-center"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <MonotributoAdmin />
            </div>
          )}

          {/* ✅ NUEVA VISTA DE MONOTRIBUTO PARA MÓVIL */}
          {vista === "monotributo" && (
            <div>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="mb-4 flex items-center"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <MonotributoAdmin />
            </div>
          )}

          {/* ✅ NUEVA VISTA DE REFRITOS PARA MÓVIL */}
          {vista === "refritos" && (
            <div>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="mb-4 flex items-center"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <RefritosAdmin />
            </div>
          )}

          {/* ✅ NUEVA VISTA DE REASIGNACIÓN AUTOMÁTICA PARA MÓVIL */}
          {vista === "reasignaciones" && (
            <div>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                className="mb-4 flex items-center"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <ReasignacionAutomaticaAdmin />
            </div>
          )}

          {/* ✅ NUEVA VISTA DE VALIDADOR WHATSAPP PARA MÓVIL */}
          {vista === "validacion-whatsapp" && (
            <div>
              <Button
                variant="outline-secondary"
                size="sm"
                className="mb-4 flex items-center"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <ValidacionWhatsappAdmin />
            </div>
          )}

          {/* ✅ NUEVA VISTA DE COMPENSADOR DE LEADS PARA MÓVIL */}
          {vista === "compensador" && (
            <div>
              <Button
                variant="outline-secondary"
                size="sm"
                className="mb-4 flex items-center"
                onClick={() => setVista("dashboard")}
              >
                <FaChevronLeft className="me-1" /> Dashboard
              </Button>
              <CompensadorAdmin />
            </div>
          )}

          {/* Se removieron vistas de Estadísticas y Configuración en mobile */}
        </Container>
      </div>
    </>
  );
};

export default AdminDashboard;