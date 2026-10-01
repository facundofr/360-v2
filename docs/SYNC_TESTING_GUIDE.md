# 🔄 Guía para Sincronizar Cambios: Producción → Testing

## 📋 Resumen de Cambios Implementados en Producción

### ✨ Nuevas Funcionalidades
1. **reCAPTCHA v3** integrado en el Login
2. **Validadores actualizados** para excluir token de reCAPTCHA
3. **Servicio de reCAPTCHA** configurado
4. **Provider de reCAPTCHA** en la aplicación React

### 📁 Archivos Modificados (Compartibles)
- `backend/services/recaptchaService.js`
- `backend/middlewares/validators.js`
- `frontend/src/components/features/auth/Login.jsx`
- `frontend/src/main.jsx`
- `package.json`
- `.gitignore`

### 🔐 Archivos NO Modificados (Específicos de Producción)
Estos archivos permanecen diferentes entre entornos:
- `backend/.env` (Puerto 4001, BD: cober360-produccion)
- `backend/server.js` (Configuración producción)
- `frontend/src/components/config.js` (URLs producción)
- `frontend/vite.config.js` (base: '/afiliaciones/')
- `frontend/src/App.jsx` (basename: '/afiliaciones')
- `start.js` (Variables de entorno)

---

## 🚀 Pasos para Aplicar Cambios en Testing

### 1️⃣ Ir al directorio de Testing
```bash
cd /var/www/cober360
```

### 2️⃣ Verificar rama actual
```bash
git branch
# Deberías estar en 'main'
```

### 3️⃣ Actualizar referencias remotas
```bash
git fetch origin
```

### 4️⃣ Hacer merge de los cambios de producción
```bash
git merge origin/produccion --no-commit --no-ff
```

### 5️⃣ Verificar qué archivos se van a modificar
```bash
git status
```

### 6️⃣ IMPORTANTE: Restaurar archivos específicos de testing
Si algunos archivos específicos de testing se modificaron, restaurarlos:

```bash
# Solo si es necesario, restaurar archivos específicos de testing
git checkout HEAD -- backend/.env
git checkout HEAD -- backend/server.js
git checkout HEAD -- frontend/src/components/config.js
git checkout HEAD -- frontend/vite.config.js
git checkout HEAD -- frontend/src/App.jsx
git checkout HEAD -- start.js
```

### 7️⃣ Verificar cambios antes de commitear
```bash
git diff --cached
```

### 8️⃣ Completar el merge
```bash
git commit -m "merge: Integrar reCAPTCHA v3 desde producción

- Implementar reCAPTCHA v3 en Login
- Actualizar validadores para excluir recaptchaToken
- Configurar GoogleReCaptchaProvider
- Actualizar .gitignore"
```

### 9️⃣ Instalar nuevas dependencias
```bash
# Frontend
cd /var/www/cober360/frontend
npm install

# Backend (si es necesario)
cd /var/www/cober360/backend
npm install
```

### 🔟 Actualizar variables de entorno en Testing
Editar `/var/www/cober360/backend/.env` y agregar:

```env
# 🔐 reCAPTCHA v3 Configuration
RECAPTCHA_SECRET=6LewluErAAAAAOtNJi3ZJZLqMoLdRFRy3KC4EZEr
RECAPTCHA_SITE_KEY=6LewluErAAAAAD1lny938pNyTuR7QxIR3UaJG5S3
RECAPTCHA_THRESHOLD=0.5
```

### 1️⃣1️⃣ Compilar Frontend de Testing
```bash
cd /var/www/cober360/frontend
npm run build
```

### 1️⃣2️⃣ Reiniciar servicios de Testing
```bash
pm2 restart cober360
```

### 1️⃣3️⃣ Verificar que todo funcione
```bash
# Verificar logs
pm2 logs cober360 --lines 20

# Probar el health check
curl https://wspflows.cober.online/api/health
```

---

## 🔍 Verificación Post-Merge

### ✅ Checklist
- [ ] reCAPTCHA v3 funciona en login
- [ ] No hay errores en consola del navegador
- [ ] El backend valida correctamente el token
- [ ] Las configuraciones específicas de testing no se modificaron
- [ ] Los servicios PM2 están corriendo sin errores

### 🚨 Solución de Problemas

**Si el login no funciona:**
```bash
# Verificar que las claves de reCAPTCHA estén en .env
grep RECAPTCHA /var/www/cober360/backend/.env

# Verificar logs del backend
pm2 logs cober360 --lines 50 | grep -i recaptcha
```

**Si hay conflictos en archivos específicos:**
```bash
# Restaurar configuración de testing
cd /var/www/cober360
git checkout main -- frontend/src/components/config.js
git checkout main -- frontend/vite.config.js
```

---

## 📊 Diferencias entre Entornos

### Testing (wspflows.cober.online)
- Puerto: **4000**
- Base de datos: **cober360**
- Frontend URL: `https://wspflows.cober.online`
- Vite base: `/` (raíz)
- Router basename: sin basename

### Producción (360.cober.online/afiliaciones)
- Puerto: **4001**
- Base de datos: **cober360-produccion**
- Frontend URL: `https://360.cober.online/afiliaciones`
- Vite base: `/afiliaciones/`
- Router basename: `/afiliaciones`

---

## 📝 Notas Finales

1. **Siempre hacer backup antes del merge**
2. **Verificar que las configuraciones específicas no se sobrescriban**
3. **Probar en testing antes de aplicar a producción**
4. **Documentar cualquier cambio adicional necesario**

---

## 🔗 Enlaces Útiles

- Repositorio: https://github.com/GC-PMKT-Dev/cober360
- Rama producción: https://github.com/GC-PMKT-Dev/cober360/tree/produccion
- Pull Request: https://github.com/GC-PMKT-Dev/cober360/pull/new/produccion

---

**Última actualización:** 7 de Octubre 2025
**Autor:** Sistema Automatizado
