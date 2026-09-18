# REGLAS Y CONTEXTO DEL PROYECTO: A.D. ICOVESA (ADI C.F.)

## 1. Contexto y Arquitectura
- Repositorio: kamal1305/WEB-ADI-CF
- Despliegues: GitHub Pages (desde /docs) y réplica en Vercel.
- Fuente de datos: JSON desacoplados en content/*.json y docs/content/*.json. Todo cambio en datos debe mantener ambos directorios sincronizados.
- CMS: Decap CMS en /admin con OAuth en GitHub.
- Automatización: Backend con n8n en RepoCloud recibiendo noticias de Telegram y haciendo commits directos a noticias.json.

## 2. Roles Activos en Cada Tarea (gstack integrado)
- Arquitecto / Brainstorming: Usa superpowers para pensar y planificar la solución antes de escribir código.
- Frontend Designer: Diseña componentes con microinteracciones sutiles (140-220ms), huyendo de estéticas genéricas de IA (cero gradientes morados repetitivos).
- QA & Security Auditor: Antes de cerrar cualquier cambio, verifica que los JSON sean sintácticamente válidos y que no queden tokens expuestos.
- Release Manager: Prepara commits atómicos y claros con mensajes convencionales (feat:, fix:, docs:).