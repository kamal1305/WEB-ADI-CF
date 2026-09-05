# Configuración de GitHub OAuth para el Panel de Administración

Este documento guía la configuración final de la autenticación GitHub OAuth. **La pasarela OAuth ya está incluida en este proyecto** (`/api/auth.js` y `/api/callback.js`).

## Pasos Principales

### 1. Crear la Aplicación OAuth de GitHub

1. Inicia sesión en GitHub
2. Ve a: **https://github.com/settings/developers → OAuth Apps → New OAuth App**
3. Completa el formulario con:
   - **Application name**: `A.D. Icovesa — panel`
   - **Homepage URL**: Tu URL de Vercel del sitio web
     ```
     https://web-adi-cf.vercel.app
     ```
   - **Authorization callback URL**: Tu URL Vercel + `/api/callback`
     ```
     https://web-adi-cf.vercel.app/api/callback
     ```
4. GitHub generará:
   - **Client ID**: cópialo
   - **Client Secret**: cópialo (solo se muestra una vez)

### 2. Configurar Variables de Entorno en Vercel

1. En **Vercel**, ve a tu proyecto web (el de este repositorio)
2. Settings → **Environment Variables**
3. Añade estas dos variables:
   ```
   OAUTH_GITHUB_CLIENT_ID = [tu Client ID del paso 1]
   OAUTH_GITHUB_CLIENT_SECRET = [tu Client Secret del paso 1]
   ```
4. En Vercel, haz clic en **Redeploy** para aplicar los cambios

### 3. Verificar la Configuración de config.yml

El archivo `admin/config.yml` ya está configurado correctamente:

```yaml
backend:
  name: github
  repo: kamal1305/WEB-ADI-CF
  branch: main
  auth_endpoint: /api/auth
  base_url: https://web-adi-cf.vercel.app
```

Si cambias tu URL de Vercel, actualiza `base_url` aquí.

### 4. Probar el Panel

1. Abre: `https://web-adi-cf.vercel.app/admin/`
2. Deberías ver un botón **"Login with GitHub"**
3. Haz clic y autoriza la aplicación
4. ¡El panel debería cargar correctamente!

## Solución de Problemas

### "Login with GitHub" no funciona o da error 404
- Verifica que la **Authorization callback URL** de GitHub coincida exactamente con tu dominio Vercel + `/api/callback`
- Comprueba que las variables de entorno `OAUTH_GITHUB_CLIENT_ID` y `OAUTH_GITHUB_CLIENT_SECRET` están configuradas en Vercel
- En la consola del navegador (F12), busca errores de red en la tab **Network**

### El login funciona pero no puedo guardar cambios
- Verifica que `repo: kamal1305/WEB-ADI-CF` en `config.yml` es correcto
- Asegúrate de que tu usuario de GitHub tiene acceso de **escritura** en ese repositorio
- El token debe tener permiso `repo` (escritura en repositorio privado o público)

### El panel no se carga o parece roto
- Comprueba la consola del navegador (F12 → Console) para ver mensajes de error
- Verifica que `/admin/config.yml` se carga correctamente (F12 → Network)
- Verifica que `/api/auth` responde (debería dar error 400 si no hay `code` query param)

### Error "OAUTH_GITHUB_CLIENT_ID not configured"
- Las variables de entorno no se han configurado en Vercel
- Verifica que agregaste las variables en **Settings → Environment Variables** de tu proyecto Vercel
- Después de agregar las variables, debes hacer **Redeploy** en Vercel
- Espera 1-2 minutos para que los cambios se propaguen

## Archivos Incluidos

- **`/api/auth.js`** - Endpoint para autenticación OAuth (GET)
- **`/api/callback.js`** - Endpoint para procesar callback de OAuth (POST)
- **`admin/config.yml`** - Configuración de Decap CMS (ya apunta a `/api/auth`)
- **`admin/index.html`** - Panel de administración con interfaz pulida

## Seguridad

- ✅ Client Secret nunca se expone al navegador (solo en servidor Vercel)
- ✅ Token de acceso se almacena localmente en el navegador (control del usuario)
- ✅ Las solicitudes a GitHub API se hacen desde Vercel (server-side)

## Referencias

- Documentación oficial: **https://decapcms.org/docs/add-to-your-site**
- GitHub OAuth: **https://docs.github.com/en/apps/oauth-apps**
- Decap CMS Backend: **https://decapcms.org/docs/backends-overview**

---

**¡Eso es todo!** No necesitas proyectos Vercel adicionales. Todo está en un solo proyecto.
