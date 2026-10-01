import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Alert } from '@/components/compat/bootstrap';
import { FaShieldAlt, FaHome, FaSignOutAlt } from '@/lib/icons';

const AccessDenied = ({ userRole, attemptedRoute, message }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Obtener datos del localStorage si no se pasan como props
  const currentUserRole = userRole || parseInt(localStorage.getItem('cober_user_role'));
  const currentAttemptedRoute = attemptedRoute || location.pathname;

  const roleNames = {
    1: 'Vendedor',
    2: 'Supervisor', 
    3: 'Administrador'
  };

  const roleDashboards = {
    1: '/vendedor',
    2: '/supervisor',
    3: '/admin'
  };

  const handleGoToDashboard = () => {
    const dashboard = roleDashboards[currentUserRole] || '/unknown-role';
    navigate(dashboard, { replace: true });
  };

  const handleLogout = () => {
    // Limpiar localStorage
    localStorage.removeItem('cober_token');
    localStorage.removeItem('cober_loginTime');
    localStorage.removeItem('cober_sessionId');
    localStorage.removeItem('cober_user_id');
    localStorage.removeItem('cober_first_name');
    localStorage.removeItem('cober_last_name');
    localStorage.removeItem('cober_user_role');
    localStorage.removeItem('cober_user_email');
    
    // Redirigir al login
    navigate('/', { replace: true });
    window.location.reload();
  };

  useEffect(() => {
    // Prevenir navegación hacia atrás
    const preventBack = () => {
      window.history.pushState(null, '', window.location.pathname);
    };
    
    preventBack();
    window.addEventListener('popstate', preventBack);
    
    return () => {
      window.removeEventListener('popstate', preventBack);
    };
  }, []);

  return (
    <Container className="mt-12">
      <Row className="justify-center">
        <Col md={8} lg={6}>
          <Card className="shadow-sm">
            <Card.Header className="bg-warning text-foreground text-center">
              <FaShieldAlt size={40} className="mb-2" />
              <h4 className="text-[1.5rem] font-bold leading-tight tracking-tight text-corporate mb-0">Acceso Denegado</h4>
            </Card.Header>
            
            <Card.Body className="text-center">
              <Alert variant="warning" className="mb-6">
                <strong>
                  {message || "No tienes permisos para acceder a esta sección"}
                </strong>
              </Alert>
              
              <div className="mb-6">
                <p className="text-muted-foreground mb-2">
                  <strong>Tu rol actual:</strong> {roleNames[currentUserRole] || 'Desconocido'}
                </p>
                {currentAttemptedRoute && (
                  <p className="mb-4 text-muted-foreground">
                    <strong>Ruta solicitada:</strong> <code className="font-mono text-[0.875em] text-destructive">{currentAttemptedRoute}</code>
                  </p>
                )}
                
                <div className="mt-4 p-4 bg-muted rounded-md">
                  <h6 className="text-base font-bold leading-tight tracking-tight text-muted-foreground mb-2">🎯 Rutas disponibles para tu rol:</h6>
                  <div className="text-left">
                    {currentUserRole === 1 && (
                      <ul className="list-none pl-0 mb-0">
                        <li>• Dashboard de Vendedor</li>
                        <li>• Gestión de Prospectos</li>
                        <li>• Detalle de Prospectos</li>
                      </ul>
                    )}
                    {currentUserRole === 2 && (
                      <ul className="list-none pl-0 mb-0">
                        <li>• Dashboard de Supervisor</li>
                        <li>• Resumen de Supervisor</li>
                        <li>• Gestión de Vendedores</li>
                        <li>• Dashboard de Vendedor</li>
                        <li>• Gestión de Prospectos</li>
                      </ul>
                    )}
                    {currentUserRole === 3 && (
                      <ul className="list-none pl-0 mb-0">
                        <li>• Dashboard de Administrador</li>
                        <li>• Dashboard de Supervisor</li>
                        <li>• Dashboard de Vendedor</li>
                        <li>• Todas las funcionalidades</li>
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <Button 
                  variant="primary" 
                  onClick={handleGoToDashboard}
                  className="flex items-center"
                >
                  <FaHome className="me-2" />
                  Ir a mi Dashboard
                </Button>
                
                <Button 
                  variant="outline-secondary" 
                  onClick={handleLogout}
                  className="flex items-center"
                >
                  <FaSignOutAlt className="me-2" />
                  Cerrar Sesión
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default AccessDenied;
