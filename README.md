# Web A.D. Icovesa — guía de puesta en marcha

## Qué hay en esta carpeta

```
index.html              → la web (una sola página con secciones)
img/escudo.png           → el escudo del club
content/*.json           → los datos editables: calendario, equipos, cuerpo técnico, galería, patrocinadores
admin/index.html          → el panel de administración (Decap CMS)
admin/config.yml          → configuración del panel (hay que editarlo, ver paso 4)
uploads/                  → aquí se guardan las fotos que subáis desde el panel
```

La web no tiene servidor ni base de datos: es un sitio estático que **lee los archivos `content/*.json` cada vez que alguien la visita**. El panel de administración edita esos mismos archivos directamente en GitHub. Cuando guardáis un cambio en el panel, Vercel vuelve a publicar la web sola en 1-2 minutos.

---

## Paso 1 — Subir el proyecto a GitHub

1. Crea un repositorio nuevo en tu cuenta de GitHub (puede ser privado o público).
2. Sube todos los archivos de esta carpeta a ese repositorio (arrastrándolos en la web de GitHub, o con `git push` si usas la terminal).

## Paso 2 — Publicar la web en Vercel

1. En Vercel, **Add New → Project** y elige el repositorio que acabas de crear.
2. No hace falta configurar nada especial (es HTML puro): dale a **Deploy**.
3. Cuando termine, Vercel te da una URL como `https://tu-proyecto.vercel.app`. Esa ya es vuestra web.

## Paso 3 — Publicar la "pasarela" de acceso (solo una vez)

GitHub exige un pequeño servidor intermedio para que el panel pueda identificaros de forma segura. Ya existe uno gratuito, listo para usar en Vercel, así que no hay que programarlo:

1. Ve a este repositorio: **github.com/ublabs/netlify-cms-oauth**
2. Pulsa su botón **"Deploy with Vercel"** (está en el README) y despliégalo como un **proyecto nuevo y separado** de vuestra web (no lo mezcles con el repo del club).
3. Cuando termine, apunta la URL que te da, por ejemplo `https://netlify-cms-oauth-tuclub.vercel.app`. La necesitarás en el paso 5.

## Paso 4 — Crear la app de GitHub para el login

1. Ve a **github.com/settings/developers → OAuth Apps → New OAuth App**.
2. Rellena:
   - **Application name**: A.D. Icovesa — panel
   - **Homepage URL**: la URL de vuestra web (paso 2)
   - **Authorization callback URL**: la URL de la pasarela del paso 3 + `/callback`, ej: `https://netlify-cms-oauth-tuclub.vercel.app/callback`
3. Al crearla, GitHub te da un **Client ID** y un **Client Secret** (el secreto solo se ve una vez, cópialo).

## Paso 5 — Conectar las tres piezas

1. En el proyecto de la **pasarela** (paso 3), en Vercel → Settings → Environment Variables, añade:
   - `OAUTH_GITHUB_CLIENT_ID` = el Client ID del paso 4
   - `OAUTH_GITHUB_CLIENT_SECRET` = el Client Secret del paso 4
   - Vuelve a desplegar el proyecto (Redeploy) para que tome los valores nuevos.
2. En vuestro repo, edita **`admin/config.yml`** y sustituye:
   - `repo: TODO-usuario/TODO-nombre-del-repositorio` → por ejemplo `repo: adicovesa/web-club`
   - `base_url: https://TODO-tu-pasarela-oauth.vercel.app` → por la URL de la pasarela del paso 3
3. Guarda, sube el cambio a GitHub (Vercel republicará la web sola).

## Paso 6 — Entrar al panel

1. Abre `https://tu-proyecto.vercel.app/admin/`
2. Pulsa **"Login with GitHub"** y autoriza la app la primera vez.
3. Ya puedes editar calendario, resultados, equipos, jugadores, cuerpo técnico, galería y patrocinadores. Cada foto que subas se guarda en `uploads/` de vuestro repositorio.

Cualquier persona con quien compartas el acceso necesita tener permiso de escritura sobre el repositorio de GitHub (o ser colaboradora del mismo) para poder publicar cambios.

---

## Nota sobre fotos y datos de menores

Como el club trabaja con niños y niñas, antes de publicar nombres completos o fotos de jugadores, es buena práctica:
- Usar nombre y primera letra del apellido en vez del nombre completo, si preferís más discreción.
- Contar con el visto bueno de las familias para publicar fotos de sus hijos/as.

---

## Si algo no funciona

- **"Login with GitHub" no hace nada o da error 404**: revisa que la `Authorization callback URL` de la app de GitHub (paso 4) coincide exactamente con `base_url` + `/callback` en `admin/config.yml`.
- **El login se completa pero no puede guardar cambios**: comprueba que `repo:` en `config.yml` tiene el formato correcto `usuario/nombre-repo` y que la persona conectada tiene acceso de escritura a ese repositorio.
- Documentación oficial del panel: **decapcms.org/docs/add-to-your-site**

Esta configuración se basa en un proyecto puente ya existente y mantenido por la comunidad (no está operado por Anthropic ni por Vercel); si en el futuro deja de estar disponible, decapcms.org mantiene una lista de alternativas equivalentes ("OAuth proxy for Decap CMS on Vercel").
