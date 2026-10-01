import React, { useState, useEffect } from 'react';
import { BellIcon, ChevronDownIcon, CircleHelpIcon, CircleUserIcon, LogOutIcon, MessageCircleIcon, SearchIcon, SettingsIcon, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToneBadge } from "@/components/app/tone-badge";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Swal from '@/lib/alerts';
import logoImg from '../../assets/img/logo.png';
import { API_URL } from "../config";

// 🔔 Importar el hook de notificaciones
import { useNotifications } from '../../contexts/NotificationContext';

// 🔐 Importar el contexto de autenticación
import { useAuth } from './AuthContext';


const NavBar = () => {
  // 🔔 Usar el contexto de notificaciones
  const { totalUnread, whatsappUnread } = useNotifications();

  // 🔐 Usar el contexto de autenticación
  const { user, isAuthenticated, logout: authLogout } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileNotificationsOpen, setMobileNotificationsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Definir páginas de autenticación
  const authPages = ['/', '/register', '/reset', '/verify-email', '/formulario-lead'];
  const isAuthPage = authPages.some(page => 
    location.pathname === page || 
    location.pathname.startsWith('/reset-password') ||
    location.pathname.startsWith('/verify-email')
  );

  // Gestionar clase CSS del body para navbar fijo
  useEffect(() => {
    if (!isAuthenticated || isAuthPage) {
      document.body.classList.remove('has-navbar');
    } else {
      document.body.classList.add('has-navbar');
    }
    
    // Cleanup al desmontar
    return () => {
      document.body.classList.remove('has-navbar');
    };
  }, [isAuthenticated, isAuthPage]);

  // 🚪 Interceptar navegación hacia atrás para cerrar sesión
  useEffect(() => {
    // Solo aplicar si el usuario está autenticado y no está en páginas de auth
    if (!isAuthenticated || isAuthPage) return;

    const handlePopState = async (event) => {
      // 🔧 CAMBIO: Verificar si realmente es navegación hacia atrás no deseada
      const currentPath = window.location.pathname;
      const isNavigatingToAuth = authPages.some(page => 
        currentPath === page || 
        currentPath.startsWith('/reset-password') ||
        currentPath.startsWith('/verify-email')
      );

      // Solo intervenir si está navegando a páginas de auth
      if (!isNavigatingToAuth) {
        return; // Permitir navegación normal dentro de la app
      }
      
      // Prevenir la navegación automática
      event.preventDefault();
      
      console.log('🔙 Navegación a página de auth detectada - Iniciando proceso de cierre de sesión');
      
      // Mostrar el diálogo de confirmación de cierre de sesión
      const result = await Swal.fire({
        title: '🚪 ¿Cerrar sesión?',
        html: `
          <div style="text-align: left; margin: 20px 0;">
            <p><strong>Para navegar fuera del sistema, debes cerrar sesión.</strong></p>
            <p>Esto es por seguridad para proteger tu información.</p>
            <br>
            <p>¿Deseas cerrar sesión ahora?</p>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: '✅ Sí, cerrar sesión',
        cancelButtonText: '❌ Permanecer aquí',
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: {
          popup: 'logout-confirmation-popup'
        }
      });

      if (result.isConfirmed) {
        console.log('✅ Usuario confirmó cierre de sesión');
        await handleLogout(false);
      } else {
        console.log('❌ Usuario canceló cierre de sesión');
        // Restaurar el estado del historial
        window.history.pushState(null, '', window.location.pathname);
      }
    };

    // 🔧 CAMBIO: Solo agregar entrada si no existe
    const currentState = window.history.state;
    if (!currentState?.navigationProtected) {
      window.history.pushState({ navigationProtected: true }, '', window.location.pathname);
    }
    
    window.addEventListener('popstate', handlePopState);

    console.log('🛡️ Protección de navegación hacia atrás activada');

    return () => {
      window.removeEventListener('popstate', handlePopState);
      console.log('🛡️ Protección de navegación hacia atrás desactivada');
    };
  }, [isAuthenticated, isAuthPage, location.pathname]);

  // Cerrar sesión
  const handleLogout = async (showConfirmation = true) => {
    let shouldProceed = true;

    // Solo mostrar confirmación si se solicita explícitamente
    if (showConfirmation) {
      const result = await Swal.fire({
        title: '¿Cerrar sesión?',
        text: '¿Estás seguro de que quieres cerrar sesión?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: '✅ Sí, cerrar sesión',
        cancelButtonText: '❌ Cancelar'
      });
      
      shouldProceed = result.isConfirmed;
    }

    if (shouldProceed) {
      try {
        // 🔹 NUEVO: Marcar usuario como inactivo antes de cerrar sesión
        try {
          const token = localStorage.getItem('cober_token');
          if (token) {
            await axios.post(`${API_URL}/admin/users/logout-activity`, {
              action: 'logout',
              timestamp: new Date().toISOString()
            }, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              timeout: 5000
            });
            console.log('✅ Usuario marcado como inactivo exitosamente');
          }
        } catch (activityError) {
          console.warn('⚠️ Error marcando usuario como inactivo:', activityError.message);
          // No impedir el logout por este error
        }

        // Usar el método logout del contexto de autenticación
        await authLogout(false); // false para no mostrar el mensaje del contexto ya que lo mostramos aquí
        
        // Mostrar mensaje de confirmación
        Swal.fire({
          icon: 'success',
          title: 'Sesión cerrada',
          text: 'Has cerrado sesión exitosamente',
          timer: 1500,
          showConfirmButton: false
        });
        
      } catch (error) {
        console.error('Error al cerrar sesión:', error);
        // En caso de error, usar el método del contexto como fallback
        await authLogout(false);
      }
    }
    
    return shouldProceed;
  };

  // Obtener información del rol
  const getRoleInfo = (roleId) => {
    const roles = {
      1: { label: 'Vendedor', color: 'info' },
      2: { label: 'Supervisor', color: 'warning' },
      3: { label: 'Administrador', color: 'danger' },
      4: { label: 'Back Office', color: 'success' }
    };
    return roles[roleId] || { label: 'Desconocido', color: 'secondary' };
  };

  // Obtener título de la página actual
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('admin')) return 'Panel de Administración';
    if (path.includes('supervisor')) return 'Panel de Supervisión';
    if (path.includes('backoffice')) return 'Panel de Back Office';
    if (path.includes('vendedor') || path.includes('prospectos')) return 'Panel de Ventas';
    return 'COBER 360';
  };

  // Función para cerrar el menú mobile
  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  // No mostrar el navbar en páginas de autenticación
  if (isAuthPage || !isAuthenticated || !user) {
    console.log('🚫 NavBar oculto - isAuthPage:', isAuthPage, 'isAuthenticated:', isAuthenticated, 'user:', !!user, 'path:', location.pathname);
    return null;
  }

  console.log('✅ NavBar visible - user:', user?.firstName, 'role:', user?.role, 'path:', location.pathname);


  const roleInfo = getRoleInfo(user?.role || 0);
  const roleTone = { info: "contact", warning: "pending", danger: "lost", success: "success" }[roleInfo.color] || "neutral";
  const esVendedor = user?.role !== 3 && user?.role !== 2 && user?.role !== 4;
  const muestraNotificaciones = user?.role !== 2 && user?.role !== 4;
  const version = `v${typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev"}`;
  const nombre = `${user?.firstName || ""} ${user?.lastName || ""}`.trim();

  const notificaciones = (
    <>
      {whatsappUnread > 0 && (
        <li className="flex items-start gap-3 rounded-md bg-success-soft p-3">
          <MessageCircleIcon className="mt-0.5 size-4 shrink-0 text-success" />
          <div>
            <p className="text-sm font-semibold">{whatsappUnread} mensaje(s) de WhatsApp sin leer</p>
            <p className="text-xs text-muted-foreground">Ahora</p>
          </div>
        </li>
      )}
      <li className="flex items-start gap-3 rounded-md bg-muted p-3">
        <BellIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold">Nuevo prospecto asignado</p>
          <p className="text-xs text-muted-foreground">Hace 5 minutos</p>
        </div>
      </li>
    </>
  );

  return (
    <header className=" fixed inset-x-0 top-0 z-[1050] flex h-[60px] items-center gap-3 border-b bg-card px-3 shadow-xs md:h-20 md:gap-6 md:px-5">
      {/* Marca */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-card md:size-12">
          <img src={logoImg} alt="Cober 360" className="size-8 object-contain md:size-9" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base leading-tight font-bold text-corporate md:text-lg">{getPageTitle()}</p>
            <ToneBadge
              tone="pending"
              className="shrink-0 px-2 text-[0.65rem]"
              title={typeof __BUILD_TIME__ !== "undefined" ? `Build: ${__BUILD_TIME__}` : ""}
            >
              {version}
            </ToneBadge>
          </div>
          <p className="truncate text-xs text-muted-foreground">Sistema de Gestión</p>
        </div>
      </div>

      {/* Búsqueda (escritorio) */}
      <div className="hidden flex-1 justify-center md:flex">
        <label className="relative w-full max-w-md">
          <span className="sr-only">Buscar</span>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" placeholder="Buscar prospectos, usuarios…" className="bg-muted/60 pl-9" />
        </label>
      </div>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        {/* Acciones de escritorio */}
        <div className="hidden items-center gap-1 md:flex">
          {muestraNotificaciones && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
                  <BellIcon />
                  {totalUnread > 0 && (
                    <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] leading-4 font-bold text-white tabular-nums">
                      {totalUnread}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-2">
                <DropdownMenuLabel className="flex items-center justify-between">
                  Notificaciones
                  {totalUnread > 0 && <ToneBadge tone="progress">{totalUnread}</ToneBadge>}
                </DropdownMenuLabel>
                <ul className="flex flex-col gap-2 py-1">{notificaciones}</ul>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="justify-center font-semibold text-primary">Ver todas las notificaciones</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="icon" aria-label="Ayuda">
            <CircleHelpIcon />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Configuración">
            <SettingsIcon />
          </Button>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-1 flex items-center gap-3 rounded-md py-1 pr-2 pl-1 text-left outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/30"
              >
                <CircleUserIcon className="size-8 text-muted-foreground" />
                <span className="hidden lg:block">
                  <span className="block text-sm font-semibold">{nombre}</span>
                  <ToneBadge tone={roleTone} className="mt-0.5">
                    {roleInfo.label}
                  </ToneBadge>
                </span>
                <ChevronDownIcon className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <div className="flex items-center gap-3 px-2 py-2">
                <CircleUserIcon className="size-10 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  <ToneBadge tone={roleTone} className="mt-1">
                    {roleInfo.label}
                  </ToneBadge>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <UserIcon />
                Mi perfil
              </DropdownMenuItem>
              <DropdownMenuItem>
                <SettingsIcon />
                Configuración
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => handleLogout(true)}>
                <LogOutIcon />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Acciones del celular */}
        <div className="flex items-center gap-1 md:hidden">
          {esVendedor && (
            <Button
              variant="ghost"
              size="icon-lg"
              className="relative"
              onClick={() => setMobileNotificationsOpen(true)}
              aria-label="Ver notificaciones"
            >
              <BellIcon className="size-5" />
              {totalUnread > 0 && <span className="absolute top-2 right-2 size-2.5 rounded-full bg-destructive ring-2 ring-card" />}
            </Button>
          )}
          <Button variant="ghost" size="icon-lg" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir menú de usuario">
            <CircleUserIcon className="size-7 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Menú de usuario (celular) */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="right" className="w-80 max-w-[85vw] gap-0 p-0">
          <SheetTitle className="sr-only">Menú de usuario</SheetTitle>
          <SheetDescription className="sr-only">Perfil, notificaciones y cierre de sesión</SheetDescription>
          <div className="flex items-center gap-3 border-b p-5">
            <CircleUserIcon className="size-12 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate font-bold text-corporate">{nombre}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              <ToneBadge tone={roleTone} className="mt-1">
                {roleInfo.label}
              </ToneBadge>
            </div>
          </div>
          <nav className="flex flex-col gap-1 p-3">
            {esVendedor && (
              <MenuAction
                icon={BellIcon}
                onClick={() => {
                  setMobileNotificationsOpen(true);
                  closeMobileMenu();
                }}
              >
                Notificaciones
                {totalUnread > 0 && (
                  <ToneBadge tone="lost" className="ml-auto">
                    {totalUnread}
                  </ToneBadge>
                )}
              </MenuAction>
            )}
            <MenuAction icon={CircleHelpIcon} onClick={closeMobileMenu}>
              Ayuda
            </MenuAction>
            <MenuAction icon={SettingsIcon} onClick={closeMobileMenu}>
              Configuración
            </MenuAction>
            <MenuAction icon={UserIcon} onClick={closeMobileMenu}>
              Mi perfil
            </MenuAction>
          </nav>
          <div className="mt-auto border-t p-3">
            <MenuAction
              icon={LogOutIcon}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                closeMobileMenu();
                handleLogout(true);
              }}
            >
              Cerrar sesión
            </MenuAction>
          </div>
        </SheetContent>
      </Sheet>

      {/* Notificaciones (celular) */}
      <Dialog open={mobileNotificationsOpen} onOpenChange={setMobileNotificationsOpen}>
        <DialogContent className="rounded-xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-corporate">
              Notificaciones
              {totalUnread > 0 && <ToneBadge tone="progress">{totalUnread}</ToneBadge>}
            </DialogTitle>
            <DialogDescription className="sr-only">Tus notificaciones recientes</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2">{notificaciones}</ul>
          {totalUnread === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No tenés notificaciones nuevas.</p>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" className="w-full" onClick={() => setMobileNotificationsOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
};

function MenuAction({ icon: Icon, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/30",
        className
      )}
      {...props}
    >
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      {children}
    </button>
  );
}

export default NavBar;
