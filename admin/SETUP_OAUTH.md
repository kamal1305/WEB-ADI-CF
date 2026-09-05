# Configuración de GitHub OAuth para el Panel de Administración

Este documento guía la configuración final de la autenticación GitHub OAuth para que el panel de administración funcione correctamente en Vercel.

## Pasos Principales

### 1. Desplegar la Pasarela OAuth en Vercel

La pasarela OAuth es un proyecto separado que actúa como intermediaria entre GitHub y tu panel de administración.

1. Ve a: **https://github.com/ublabs/netlify-cms-oauth**
2. Haz clic en el botón **"Deploy with Vercel"** (en el README)
3. Despliégalo como un **proyecto nuevo y separado** de tu sitio web
4. Anota la URL que te proporciona Vercel, por ejemplo:
   ```
   https://netlify-cms-oauth-tuclub.vercel.app
   ```

### 2. Crear la Aplicación OAuth de GitHub

1. Inicia sesión en GitHub
2. Ve a: **https://github.com/settings/developers → OAuth Apps → New OAuth App**
3. Completa el formulario con:
   - **Application name**: `A.D. Icovesa — panel`
   - **Homepage URL**: Tu URL de Vercel del sitio web (ej: `https://tu-proyecto.vercel.app`)
   - **Authorization callback URL**: URL de la pasarela + `/callback`
     ```
     https://netlify-cms-oauth-tuclub.vercel.app/callback
     ```
4. GitHub generará:
   - **Client ID**: cópialo
   - **Client Secret**: cópialo (solo se muestra una vez)

### 3. Configurar Variables de Entorno en la Pasarela OAuth

1. En Vercel, ve al proyecto de la **pasarela OAuth** (paso 1)
2. Settings → **Environment Variables**
3. Añade estas variables:
   ```
   OAUTH_GITHUB_CLIENT_ID = [tu Client ID del paso 2]
   OAUTH_GITHUB_CLIENT_SECRET = [tu Client Secret del paso 2]
   ```
4. En Vercel, haz clic en **Redeploy** para aplicar los cambios

### 4. Actualizar config.yml

En tu repositorio de GitHub, edita `admin/config.yml`:

```yaml
backend:
  name: github
  repo: tu-usuario/tu-repositorio
  branch: main
  auth_endpoint: https://netlify-cms-oauth-tuclub.vercel.app/auth
```

Reemplaza:
- `tu-usuario/tu-repositorio` con tu usuario y nombre de repo en GitHub
- La URL de `auth_endpoint` con la de tu pasarela OAuth

### 5. Verificar la Configuración de Vercel

Vercel ya tiene configurado automáticamente el `vercel.json` con:
- Reescrituras correctas para `/admin/`
- Cache headers apropiados
- Content-Type correcto para `config.yml`

### 6. Probar el Panel

1. Abre: `https://tu-proyecto.vercel.app/admin/`
2. Deberías ver un botón **"Login with GitHub"**
3. Haz clic y autoriza la aplicación
4. ¡El panel debería cargar correctamente!

## Solución de Problemas

### "Login with GitHub" no funciona o da error 404
- Verifica que la **Authorization callback URL** de GitHub (paso 2) coincide exactamente con `auth_endpoint` + `/auth` en `config.yml`
- Comprueba que la pasarela OAuth está correctamente desplegada en Vercel

### El login funciona pero no puedo guardar cambios
- Verifica que `repo: usuario/nombre-repo` en `config.yml` es correcto
- Asegúrate de que tu usuario de GitHub tiene acceso de **escritura** en ese repositorio

### El panel no se carga
- Comprueba la consola del navegador (F12 → Console) para ver mensajes de error
- Verifica que `/admin/config.yml` se carga correctamente (F12 → Network)

## Variables de Entorno Adicionales (Opcional)

Para mayor seguridad en producción, considera:

```
OAUTH_GITHUB_OAUTH_TOKEN_PATH = /
OAUTH_GITHUB_REDIRECT_URL = https://netlify-cms-oauth-tuclub.vercel.app/callback
```

## Referencias

- Documentación oficial: **https://decapcms.org/docs/add-to-your-site**
- Proyecto OAuth proxy: **https://github.com/ublabs/netlify-cms-oauth**
- Alternativas (si la pasarela no está disponible): **https://decapcms.org/docs/external-oauth-client**

---

**Nota**: Esta configuración requiere dos proyectos Vercel separados:
1. Tu sitio web (este repositorio)
2. La pasarela OAuth (repositorio separado)

No intentes poner ambos en el mismo proyecto de Vercel.
