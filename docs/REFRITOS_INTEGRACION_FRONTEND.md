# 🚀 GUÍA DE INTEGRACIÓN - MÓDULO REFRITOS EN SIDEBAR

## Ubicación del archivo de sidebar

Buscar el archivo del sidebar del admin (probablemente en `/frontend/src/components/admin/` o similar)

## Agregar opción de Refritos en el sidebar

```jsx
// En el componente del sidebar del admin, agregar este item:

{
  icon: '🥚',  // Icono de huevo
  label: 'Refritos',
  path: '/admin/refritos',
  submenu: [
    {
      label: 'Cargar archivo',
      path: '/admin/refritos/cargar'
    },
    {
      label: 'Estadísticas',
      path: '/admin/refritos/estadisticas'
    },
    {
      label: 'Histórico',
      path: '/admin/refritos/historico'
    }
  ]
}
```

## Rutas necesarias en el frontend

Crear los siguientes componentes/páginas:

### 1. `/pages/admin/refritos/CargarRefritos.jsx`

```jsx
import React, { useState } from 'react';
import axios from 'axios';

export default function CargarRefritos() {
  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [errores, setErrores] = useState([]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        alert('Solo se permiten archivos CSV, XLSX o XLS');
        return;
      }
      setArchivo(file);
    }
  };

  const handleCargar = async () => {
    if (!archivo) {
      alert('Selecciona un archivo');
      return;
    }

    setCargando(true);
    const formData = new FormData();
    formData.append('archivo', archivo);

    try {
      const response = await axios.post('/api/admin/refritos/cargar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setResultado(response.data);
      setErrores(response.data.resultados.errores);
    } catch (error) {
      alert('Error al cargar archivo: ' + error.response?.data?.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="container mt-5">
      <h1>🥚 Cargar Refritos</h1>
      
      <div className="card p-4 mb-4">
        <h5>Selecciona un archivo CSV o XLSX</h5>
        <input 
          type="file" 
          onChange={handleFileChange}
          accept=".csv,.xlsx,.xls"
          disabled={cargando}
        />
        <button 
          className="btn btn-primary mt-3"
          onClick={handleCargar}
          disabled={!archivo || cargando}
        >
          {cargando ? 'Cargando...' : 'Cargar archivo'}
        </button>
      </div>

      {resultado && (
        <div className="alert alert-success">
          <h5>{resultado.message}</h5>
          <p>Exitosos: {resultado.resumen.exitosos}</p>
          <p>Errores: {resultado.resumen.errores}</p>
          
          {resultado.resultados.exitosos.length > 0 && (
            <div className="mt-3">
              <h6>Cargados exitosamente:</h6>
              <ul>
                {resultado.resultados.exitosos.map(r => (
                  <li key={r.prospectoId}>
                    {r.nombre} {r.apellido} → {r.vendedorAsignado}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {errores.length > 0 && (
            <div className="mt-3">
              <h6>Errores encontrados:</h6>
              <ul className="text-danger">
                {errores.map((err, idx) => (
                  <li key={idx}>
                    Fila {err.fila}: {err.nombre} - {err.errores?.join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 2. `/pages/admin/refritos/EstadisticasRefritos.jsx`

```jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function EstadisticasRefritos() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    obtenerEstadisticas();
  }, []);

  const obtenerEstadisticas = async () => {
    try {
      const response = await axios.get('/api/admin/refritos/estadisticas');
      setStats(response.data.estadisticas);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (!stats) return <div>Cargando...</div>;

  return (
    <div className="container mt-5">
      <h1>📊 Estadísticas de Refritos</h1>
      
      <div className="row">
        <div className="col-md-4">
          <div className="card text-center p-4">
            <h5>Total de Refritos</h5>
            <h2 className="text-primary">{stats.total_refritos}</h2>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center p-4">
            <h5>Pendientes</h5>
            <h2 className="text-warning">{stats.pendientes}</h2>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center p-4">
            <h5>Contactados</h5>
            <h2 className="text-success">{stats.contactados}</h2>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-md-6">
          <div className="card text-center p-4">
            <h5>Ventas</h5>
            <h2 className="text-info">{stats.ventas}</h2>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card text-center p-4">
            <h5>Sin Contacto</h5>
            <h2 className="text-danger">{stats.sin_contacto}</h2>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Agregar badge "RECICLADO" en la card del prospecto

En el componente que muestra los prospectos (probablemente `ProspectoCard.jsx`):

```jsx
{prospecto.es_reciclado && (
  <span className="badge bg-warning text-dark ms-2">
    ♻️ RECICLADO
  </span>
)}
```

## Agregar botones de acción en panel del vendedor

Cuando un vendedor ve un refrito asignado, agregar botones:

```jsx
<button 
  className="btn btn-sm btn-warning"
  onClick={() => reasignarRefrito(prospecto.id)}
>
  🔄 Reasignar
</button>
```

## Función para reasignar (en el componente del vendedor):

```jsx
const reasignarRefrito = async (prospectoId) => {
  try {
    const response = await axios.post('/api/admin/refritos/reasignar', {
      prospectoId
    });
    alert('Refrito reasignado correctamente');
    // Recargar datos
  } catch (error) {
    alert('Error al reasignar: ' + error.response?.data?.message);
  }
};
```

---

## Variables de ambiente necesarias

No se requieren variables adicionales de ambiente. El sistema usa las conexiones ya configuradas.

## Estructura de carpetas recomendada

```
frontend/src/
├── pages/
│   └── admin/
│       └── refritos/
│           ├── CargarRefritos.jsx
│           ├── EstadisticasRefritos.jsx
│           └── HistoricoRefritos.jsx
├── components/
│   └── admin/
│       └── RefritoCard.jsx
└── services/
    └── refritosService.js (opcional, para abstraer llamadas API)
```

---

## Permisos necesarios

- El usuario debe tener rol `admin` para acceder
- Se valida automáticamente mediante middleware `authenticateAdmin`

---

## Testing manual

1. Descargar ejemplo: `/docs/ejemplo_refritos.csv`
2. Ir a `/admin/refritos/cargar`
3. Seleccionar y cargar el archivo
4. Verificar que aparecen en estadísticas
5. Verificar que se distribuyeron entre vendedores
6. Ver en panel del vendedor con badge "RECICLADO"

---

¡Listo! El módulo de refritos está completamente integrado en el backend.
