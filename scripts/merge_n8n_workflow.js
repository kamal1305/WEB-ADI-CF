const fs = require('fs');
const path = require('path');

const mergedWorkflow = {
  name: "A.D. Icovesa — Prensa Web y Community Manager Social Media",
  nodes: [
    // ============================================================
    // DISPARADOR CENTRAL ÚNICO
    // ============================================================
    {
      parameters: {
        updates: [
          {
            value: "message",
            name: "message"
          },
          {
            value: "callback_query",
            name: "callback_query"
          }
        ],
        additionalFields: {}
      },
      id: "c0c5b133-8d13-4e8c-b91c-8ce5ddd42e88",
      name: "Telegram Trigger",
      type: "n8n-nodes-base.telegramTrigger",
      typeVersion: 1.1,
      position: [200, 480],
      webhookId: "telegram-cronica-trigger",
      credentials: {
        telegramApi: {
          id: "cJNu7YhwJ6hpdZOZ",
          name: "Telegram account 5"
        }
      }
    },

    // ============================================================
    // RAMA 1: REDACTOR DE PRENSA WEB (Noticias Oficiales)
    // ============================================================
    {
      parameters: {
        modelName: "models/gemini-2.5-flash",
        options: {
          temperature: 0.7
        }
      },
      id: "40dcccef-5570-4ce8-b2d7-6114a1a86662",
      name: "Google Gemini Chat Model",
      type: "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
      typeVersion: 1,
      position: [480, 80],
      credentials: {
        googlePalmApi: {
          id: "gH2VKTpxULyr103L",
          name: "Google Gemini(PaLM) Api account 3"
        }
      }
    },
    {
      parameters: {
        promptType: "define",
        text: "={{ $json.message ? $json.message.text : $json.text }}",
        options: {
          systemMessage: "Eres el redactor de crónicas deportivas oficiales de A.D. Icovesa (Jerez de la Frontera, Cádiz). Tu tarea es generar crónicas de partidos de fútbol base del club.\n\nRecibes un mensaje con datos del partido: categoría, rivales, resultado, fecha, jugadores destacados y cualquier otro dato relevante.\n\nDebes responder ÚNICAMENTE con un objeto JSON válido (sin markdown, sin bloques ```json, sin texto adicional) con esta estructura exacta:\n{\n  \"id\": \"cronica-YYYYMMDD-categoria\",\n  \"titulo\": \"Título conciso y atractivo de la crónica (máx. 80 caracteres)\",\n  \"fecha\": \"AAAA-MM-DD\",\n  \"categoria\": \"Categoría del equipo (Bebés, Prebenjamín, Benjamín, Alevín, Infantil, Cadete, Juvenil)\",\n  \"resumen\": \"Resumen de 2-3 líneas del partido\",\n  \"cuerpo\": \"Crónica completa del partido en HTML (párrafos <p>, negritas <strong>, sin <script>)\",\n  \"imagen\": \"https://placehold.co/800x450/1a1a2e/ffffff?text=AD+Icovesa\",\n  \"fuente\": \"A.D. Icovesa\"\n}\n\nReglas:\n- Sé entusiasta pero profesional.\n- Menciona el esfuerzo de los jugadores y el trabajo del cuerpo técnico.\n- Si hay goleadores, menciónalos por nombre.\n- El campo 'imagen' debe ser la URL del placeholder por defecto.\n- El campo 'fuente' siempre es 'A.D. Icovesa'.\n- El campo 'id' debe seguir el formato 'cronica-AAAAMMDD-categoria-minusculas'."
        }
      },
      id: "b9309490-7658-4d5d-893f-17928c42130d",
      name: "AI Agent",
      type: "@n8n/n8n-nodes-langchain.agent",
      typeVersion: 1.7,
      position: [520, 240]
    },
    {
      parameters: {
        jsCode: "const rawOutput = $input.first().json.output || $input.first().json.text || JSON.stringify($input.first().json);\n\nlet cronica;\ntry {\n  const cleanJson = rawOutput.replace(/```json/gi, '').replace(/```/gi, '').trim();\n  const match = cleanJson.match(/\\{[\\s\\S]*\"id\"[\\s\\S]*\\}/);\n  if (match) {\n    cronica = JSON.parse(match[0]);\n  } else {\n    cronica = JSON.parse(cleanJson);\n  }\n} catch (e) {\n  throw new Error('La IA no devolvió un JSON válido. Respuesta: ' + rawOutput.substring(0, 500));\n}\n\nconst camposRequeridos = ['id', 'titulo', 'fecha', 'categoria', 'resumen', 'cuerpo', 'imagen', 'fuente'];\nfor (const campo of camposRequeridos) {\n  if (!cronica[campo]) {\n    throw new Error('Falta el campo obligatorio: ' + campo);\n  }\n}\n\nreturn [{ json: cronica }];"
      },
      id: "1f0e874d-a5ee-4d25-ab0a-9ded547b5139",
      name: "Parsear Crónica JSON",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [800, 240]
    },
    {
      parameters: {
        resource: "file",
        operation: "get",
        owner: {
          "__rl": true,
          "value": "kamal1305",
          "mode": "name"
        },
        "repository": {
          "__rl": true,
          "value": "WEB-ADI-CF",
          "mode": "name"
        },
        filePath: "docs/content/noticias.json",
        asBinaryProperty: false,
        additionalParameters: {}
      },
      id: "110b2a4a-7c8b-432c-b8ad-e45a8343af67",
      name: "Leer noticias.json",
      type: "n8n-nodes-base.github",
      typeVersion: 1,
      position: [1080, 240],
      webhookId: "9971fc4c-a5ef-430b-b1de-1ee0931b7c6e",
      credentials: {
        githubApi: {
          id: "ILHOj1NFhMKND71J",
          name: "GitHub account"
        }
      }
    },
    {
      parameters: {
        jsCode: "const cronica = $('Parsear Crónica JSON').first().json;\nconst githubResponse = $('Leer noticias.json').first().json;\n\nlet noticias = [];\ntry {\n  if (typeof githubResponse.content === 'string') {\n    noticias = JSON.parse(Buffer.from(githubResponse.content, 'base64').toString('utf-8'));\n  } else if (Array.isArray(githubResponse.content)) {\n    noticias = githubResponse.content;\n  }\n} catch (e) {\n  noticias = [];\n}\n\nif (!Array.isArray(noticias)) {\n  noticias = noticias.noticias || noticias.items || [];\n}\n\nnoticias.unshift(cronica);\n\nconst contenidoFinal = JSON.stringify({ noticias: noticias }, null, 2);\n\nreturn [{\n  json: {\n    sha: githubResponse.sha,\n    contenidoJSON: contenidoFinal,\n    titulo: cronica.titulo,\n    categoria: cronica.categoria,\n    fecha: cronica.fecha\n  }\n}];"
      },
      id: "15028c30-ac57-493d-849f-a81c05e12c45",
      name: "Insertar Crónica",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1360, 240]
    },
    {
      parameters: {
        resource: "file",
        operation: "edit",
        owner: {
          "__rl": true,
          "value": "kamal1305",
          "mode": "name"
        },
        repository: {
          "__rl": true,
          "value": "WEB-ADI-CF",
          "mode": "name"
        },
        filePath: "docs/content/noticias.json",
        fileContent: "={{ $('Insertar Crónica').first().json.contenidoJSON }}",
        commitMessage: "=📰 Crónica automática: {{ $('Insertar Crónica').first().json.titulo }}"
      },
      id: "d6a3f863-1b03-4e74-acc8-2177c582361b",
      name: "Publicar en GitHub",
      type: "n8n-nodes-base.github",
      typeVersion: 1,
      position: [1640, 240],
      webhookId: "7e2b0b91-9ea1-40cf-9381-950aacf9a9ca",
      credentials: {
        githubApi: {
          id: "ILHOj1NFhMKND71J",
          name: "GitHub account"
        }
      }
    },
    {
      parameters: {
        chatId: "={{ $('Telegram Trigger').first().json.message.chat.id }}",
        text: "=✅ *Crónica publicada en la Web*\n\n📰 *{{ $('Insertar Crónica').first().json.titulo }}*\n📋 *Categoría:* {{ $('Insertar Crónica').first().json.categoria }} · {{ $('Insertar Crónica').first().json.fecha }}\n\n🔗 [Ver en la web](https://kamal1305.github.io/WEB-ADI-CF/#noticias)",
        additionalFields: {
          parse_mode: "Markdown"
        }
      },
      id: "8c7e6853-77a7-4f8e-a865-77357d17b511",
      name: "Confirmar Publicación",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [1920, 240],
      webhookId: "f1c2eb41-acd2-4a94-9bf0-47890728d906",
      credentials: {
        telegramApi: {
          id: "cJNu7YhwJ6hpdZOZ",
          name: "Telegram account 5"
        }
      }
    },

    // ============================================================
    // RAMA 2: COMMUNITY MANAGER Y SOCIAL MEDIA (Carrusel 4 Slides)
    // ============================================================
    {
      parameters: {
        modelName: "models/gemini-2.5-flash",
        options: {
          temperature: 0.75
        }
      },
      id: "9a0afcff-b87f-4725-aa09-43e57f0b0a35",
      name: "Google Gemini Model Social",
      type: "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
      typeVersion: 1,
      position: [480, 880],
      credentials: {
        googlePalmApi: {
          id: "gH2VKTpxULyr103L",
          name: "Google Gemini(PaLM) Api account 3"
        }
      }
    },
    {
      parameters: {
        promptType: "define",
        text: "={{ $json.message ? $json.message.text : $json.text }}",
        options: {
          systemMessage: "Eres el Community Manager y estratega de redes sociales de la A.D. Icovesa (Jerez de la Frontera, Cádiz).\nTu misión es transformar el resultado del partido en una publicación deportiva irresistible para Instagram, Facebook y X, junto con los textos estructurados para un carrusel de 4 diapositivas cuadradas (1080x1080 px).\n\nDebes responder ÚNICAMENTE con un objeto JSON válido (sin Markdown, sin bloques ```json):\n{\n  \"copy_redes\": \"Copy persuasivo, vibrante y deportivo. Con tono de barrio jerezano noble, emojis futboleros (⚽🔥💙💖👏), resumen del partido, felicitación a la plantilla y los hashtags oficiales: #ADIcovesa #Jerez #FutbolBase #CanteraIcovesa #OrgulloDeBarrio\",\n  \"slide1\": {\n    \"categoria\": \"INFANTIL | BENJAMÍN | ALEVÍN | etc.\",\n    \"competicion\": \"AMISTOSO PRETEMPORADA | LIGA RFAF\",\n    \"equipo_local\": \"Nombre Equipo Local\",\n    \"goles_local\": \"1\",\n    \"equipo_visitante\": \"Nombre Equipo Visitante\",\n    \"goles_visitante\": \"2\",\n    \"estado\": \"FINAL DEL PARTIDO\",\n    \"fecha_campo\": \"19 Septiembre 2026 · Campo de Fútbol Juan Simón\",\n    \"titular\": \"¡GRAN ACTUACIÓN Y PARTIDAZO DE NUESTROS CHAVALES!\"\n  },\n  \"slide2\": {\n    \"titular\": \"GOLEADORES Y MINUTOS CLAVE\",\n    \"subtitulo\": \"Momentos decisivos sobre el terreno de juego\",\n    \"hitos\": [\n      \"⚽ 14' Gol de Hugo con un disparo ajustado al palo\",\n      \"🔥 32' Gran intervención defensiva para mantener la ventaja\",\n      \"⚽ 58' Gol de Daniel en una rápida transición colectiva\"\n    ]\n  },\n  \"slide3\": {\n    \"titular\": \"JUGADOR DESTACADO Y VALORES\",\n    \"destacado_nombre\": \"La Solidaridad y la Entrega Colectiva\",\n    \"destacado_rol\": \"Espíritu de equipo y generosidad en cada presión\",\n    \"valores_lema\": \"En la A.D. Icovesa educamos a través del deporte: respeto al rival, compañerismo y superación constante.\"\n  },\n  \"slide4\": {\n    \"titular\": \"CRÓNICA COMPLETA EN LA WEB\",\n    \"subtitulo\": \"Toda la actualidad del fútbol base de Icovesa\",\n    \"web_url\": \"kamal1305.github.io/WEB-ADI-CF\",\n    \"call_to_action\": \"Accede a la web oficial para leer la crónica completa y consultar calendarios.\",\n    \"lema_club\": \"¡ESE ADI OEEEE! 💖⚽💙\"\n  }\n}\n\nReglas:\n- Asegura que el copy enganche desde la primera línea.\n- Genera datos plausibles y fieles al mensaje recibido.\n- Mantén el JSON 100% estricto y limpio."
        }
      },
      id: "20f8189b-5793-4f90-aeb3-a4ef6fdff98d",
      name: "AI Agent - Community Manager",
      type: "@n8n/n8n-nodes-langchain.agent",
      typeVersion: 1.7,
      position: [520, 720]
    },
    {
      parameters: {
        jsCode: "// Extraer y validar el JSON de Social Media\nconst input = $input.first().json.output || $input.first().json.response || $input.first().json.text || JSON.stringify($input.first().json);\n\nlet social;\ntry {\n  const cleanJson = input.replace(/```json/gi, '').replace(/```/gi, '').trim();\n  const match = cleanJson.match(/\\{[\\s\\S]*\"copy_redes\"[\\s\\S]*\\}/);\n  if (match) {\n    social = JSON.parse(match[0]);\n  } else {\n    social = JSON.parse(cleanJson);\n  }\n} catch (err) {\n  throw new Error('La IA no devolvió un JSON válido para Social Media: ' + input.substring(0, 400));\n}\n\n// Fallbacks de seguridad\nif (!social.copy_redes) {\n  social.copy_redes = '¡Gran partido de nuestra cantera de A.D. Icovesa! ⚽🔥 Seguimos sumando aprendizaje, entrega y pasión por nuestros colores. ¡Orgullosos de nuestro equipo! #ADIcovesa #Jerez #FutbolBase';\n}\n\nsocial.slide1 = social.slide1 || {\n  categoria: 'FÚTBOL BASE',\n  competicion: 'AMISTOSO DE PRETEMPORADA',\n  equipo_local: 'A.D. Icovesa',\n  goles_local: '-',\n  equipo_visitante: 'Rival',\n  goles_visitante: '-',\n  estado: 'FINAL DEL PARTIDO',\n  fecha_campo: 'Jerez de la Frontera',\n  titular: '¡PARTIDAZO Y ENTREGA TOTAL DE NUESTRO EQUIPO!'\n};\n\nsocial.slide2 = social.slide2 || {\n  titular: 'GOLEADORES Y MINUTOS CLAVE',\n  subtitulo: 'Momentos destacados del encuentro',\n  hitos: ['⚽ Gran esfuerzo coral', '🔥 Entrega máxima en cada jugada', '👏 Afición ejemplar animando']\n};\n\nsocial.slide3 = social.slide3 || {\n  titular: 'JUGADOR DESTACADO Y VALORES',\n  destacado_nombre: 'El Trabajo en Equipo',\n  destacado_rol: 'Liderazgo, compañerismo y respeto',\n  valores_lema: 'Valores de barrio, corazón y fútbol formativo.'\n};\n\nsocial.slide4 = social.slide4 || {\n  titular: 'CRÓNICA COMPLETA EN LA WEB',\n  subtitulo: 'Sigue a todos los equipos del club',\n  web_url: 'kamal1305.github.io/WEB-ADI-CF',\n  call_to_action: 'Crónica extendida, alineaciones y fotos en la web oficial.',\n  lema_club: '¡ESE ADI OEEEE!'\n};\n\nreturn [{ json: social }];"
      },
      id: "e48f1d99-2a0c-40c8-91d0-3242a0024bf8",
      name: "Parsear Social Media JSON",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [800, 720]
    },
    {
      parameters: {
        jsCode: `// Generador de 4 SVGs de alta fidelidad (1080x1080 px) con la identidad corporativa ADI C.F.
// Fondo oscuro (#0d0d12), acentos magenta (#E6007E), tipografía bold, escudos y layout profesional.
const social = $('Parsear Social Media JSON').first().json;
const s1 = social.slide1;
const s2 = social.slide2;
const s3 = social.slide3;
const s4 = social.slide4;

function escaparXML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const defsComunes = \`
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="35%" r="75%">
      <stop offset="0%" stop-color="#E6007E" stop-opacity="0.22"/>
      <stop offset="50%" stop-color="#151824" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#0d0d12" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#191c2b" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#10121a" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="magentaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#E6007E"/>
      <stop offset="100%" stop-color="#ff2a9d"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>
\`;

function headerBar(categoria, competicion, slideIndex) {
  return \`
    <!-- Barra Superior -->
    <rect x="60" y="60" width="960" height="90" rx="16" fill="url(#cardGrad)" stroke="rgba(230,0,126,0.35)" stroke-width="2"/>
    <rect x="80" y="78" width="220" height="54" rx="12" fill="url(#magentaGrad)" filter="url(#glow)"/>
    <text x="190" y="113" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="22" font-weight="900" letter-spacing="1.5" text-anchor="middle">\${escaparXML(categoria).toUpperCase()}</text>
    <text x="320" y="113" fill="#cbd5e1" font-family="Montserrat, Inter, sans-serif" font-size="22" font-weight="600">\${escaparXML(competicion).toUpperCase()}</text>
    <text x="980" y="113" fill="#E6007E" font-family="Montserrat, Inter, sans-serif" font-size="24" font-weight="800" text-anchor="end">\${slideIndex} / 4</text>
  \`;
}

function footerBar() {
  return \`
    <!-- Footer Marca Oficial -->
    <line x1="60" y1="990" x2="1020" y2="990" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
    <text x="60" y="1024" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="20" font-weight="800">A.D. ICOVESA</text>
    <text x="210" y="1024" fill="#E6007E" font-family="Montserrat, Inter, sans-serif" font-size="20" font-weight="700">· JEREZ DE LA FRONTERA</text>
    <text x="1020" y="1024" fill="#94a3b8" font-family="Montserrat, Inter, sans-serif" font-size="18" font-weight="600" text-anchor="end">kamal1305.github.io/WEB-ADI-CF</text>
  \`;
}

// SLIDE 1: Marcador Final, Escudos y Categoría
const svg1 = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  \${defsComunes}
  <rect width="1080" height="1080" fill="#0d0d12"/>
  <rect width="1080" height="1080" fill="url(#bgGlow)"/>
  
  \${headerBar(s1.categoria || 'FÚTBOL BASE', s1.competicion || 'PARTIDO OFICIAL', 1)}

  <!-- Tarjeta Central de Enfrentamiento -->
  <rect x="60" y="190" width="960" height="630" rx="24" fill="url(#cardGrad)" stroke="rgba(230,0,126,0.4)" stroke-width="2.5" filter="url(#dropShadow)"/>

  <!-- Estado del Partido -->
  <rect x="390" y="225" width="300" height="46" rx="23" fill="rgba(13,13,18,0.8)" stroke="#E6007E" stroke-width="1.5"/>
  <text x="540" y="255" fill="#ff80c0" font-family="Montserrat, Inter, sans-serif" font-size="20" font-weight="800" letter-spacing="2" text-anchor="middle">\${escaparXML(s1.estado || 'FINAL DEL PARTIDO')}</text>

  <!-- Equipo Local -->
  <rect x="100" y="310" width="380" height="340" rx="20" fill="rgba(21,24,36,0.7)" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
  <text x="290" y="380" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="28" font-weight="800" text-anchor="middle">\${escaparXML(s1.equipo_local)}</text>
  <text x="290" y="530" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="110" font-weight="900" text-anchor="middle" filter="url(#dropShadow)">\${escaparXML(s1.goles_local || '0')}</text>

  <!-- Badge Central VS -->
  <circle cx="540" cy="480" r="54" fill="url(#magentaGrad)" filter="url(#glow)"/>
  <text x="540" y="493" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="34" font-weight="900" font-style="italic" text-anchor="middle">VS</text>

  <!-- Equipo Visitante -->
  <rect x="600" y="310" width="380" height="340" rx="20" fill="rgba(21,24,36,0.7)" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
  <text x="790" y="380" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="28" font-weight="800" text-anchor="middle">\${escaparXML(s1.equipo_visitante)}</text>
  <text x="790" y="530" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="110" font-weight="900" text-anchor="middle" filter="url(#dropShadow)">\${escaparXML(s1.goles_visitante || '0')}</text>

  <!-- Fecha y Campo -->
  <rect x="100" y="680" width="880" height="100" rx="16" fill="rgba(13,13,18,0.75)" stroke="rgba(230,0,126,0.25)" stroke-width="1.5"/>
  <text x="540" y="722" fill="#f1f5f9" font-family="Montserrat, Inter, sans-serif" font-size="22" font-weight="700" text-anchor="middle">📍 \${escaparXML(s1.fecha_campo)}</text>
  <text x="540" y="756" fill="#cbd5e1" font-family="Montserrat, Inter, sans-serif" font-size="20" font-weight="600" text-anchor="middle">Temporada 2026/2027 · Fútbol Base Jerezano</text>

  <!-- Titular Inferior -->
  <rect x="60" y="850" width="960" height="110" rx="20" fill="url(#cardGrad)" stroke="rgba(230,0,126,0.35)" stroke-width="2"/>
  <text x="540" y="915" fill="#ff2a9d" font-family="Montserrat, Inter, sans-serif" font-size="26" font-weight="900" letter-spacing="0.5" text-anchor="middle">\${escaparXML(s1.titular || '¡ORGULLO DE EQUIPO Y DE BARRIO!')}</text>

  \${footerBar()}
</svg>\`;

// SLIDE 2: Goleadores y Minutos Clave
let hitosCards = '';
const listaHitos = Array.isArray(s2.hitos) ? s2.hitos : [];
listaHitos.slice(0, 4).forEach((hito, i) => {
  const yPos = 350 + (i * 125);
  hitosCards += \`
    <g transform="translate(0, 0)">
      <rect x="80" y="\${yPos}" width="920" height="105" rx="18" fill="rgba(21,24,36,0.85)" stroke="rgba(230,0,126,0.3)" stroke-width="2"/>
      <rect x="80" y="\${yPos}" width="14" height="105" rx="7" fill="url(#magentaGrad)"/>
      <text x="120" y="\${yPos + 62}" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="26" font-weight="700">\${escaparXML(hito)}</text>
    </g>
  \`;
});

const svg2 = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  \${defsComunes}
  <rect width="1080" height="1080" fill="#0d0d12"/>
  <rect width="1080" height="1080" fill="url(#bgGlow)"/>
  
  \${headerBar(s1.categoria || 'FÚTBOL BASE', 'RESUMEN DEL ENCUENTRO', 2)}

  <!-- Cabecera de Slide -->
  <rect x="60" y="190" width="960" height="120" rx="20" fill="url(#cardGrad)" stroke="rgba(230,0,126,0.35)" stroke-width="2"/>
  <text x="100" y="246" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="34" font-weight="900">\${escaparXML(s2.titular || 'GOLEADORES Y MINUTOS CLAVE')}</text>
  <text x="100" y="284" fill="#cbd5e1" font-family="Montserrat, Inter, sans-serif" font-size="20" font-weight="500">\${escaparXML(s2.subtitulo || 'Momentos determinantes sobre el césped')}</text>

  <!-- Lista de Hitos y Goles -->
  \${hitosCards}

  <!-- Banner de entrega -->
  <rect x="60" y="870" width="960" height="90" rx="18" fill="rgba(13,13,18,0.8)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
  <text x="540" y="925" fill="#ff80c0" font-family="Montserrat, Inter, sans-serif" font-size="22" font-weight="800" text-anchor="middle">🔥 ¡TRABAJO COLECTIVO Y COMPROMISO INQUEBRANTABLE!</text>

  \${footerBar()}
</svg>\`;

// SLIDE 3: Jugador Destacado y Valores de Equipo
const svg3 = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  \${defsComunes}
  <rect width="1080" height="1080" fill="#0d0d12"/>
  <rect width="1080" height="1080" fill="url(#bgGlow)"/>
  
  \${headerBar(s1.categoria || 'FÚTBOL BASE', 'ADN ICOVESA', 3)}

  <!-- Cabecera -->
  <rect x="60" y="190" width="960" height="110" rx="20" fill="url(#cardGrad)" stroke="rgba(230,0,126,0.35)" stroke-width="2"/>
  <text x="540" y="258" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="34" font-weight="900" text-anchor="middle">\${escaparXML(s3.titular || 'JUGADOR DESTACADO Y VALORES')}</text>

  <!-- Tarjeta Estrella Destacado -->
  <rect x="60" y="330" width="960" height="280" rx="24" fill="url(#cardGrad)" stroke="#E6007E" stroke-width="2.5" filter="url(#dropShadow)"/>
  <circle cx="160" cy="470" r="65" fill="url(#magentaGrad)" filter="url(#glow)"/>
  <text x="160" y="488" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="44" font-weight="900" text-anchor="middle">⭐</text>

  <text x="260" y="440" fill="#ff2a9d" font-family="Montserrat, Inter, sans-serif" font-size="22" font-weight="800" letter-spacing="1">MENCIÓN ESPECIAL</text>
  <text x="260" y="490" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="36" font-weight="900">\${escaparXML(s3.destacado_nombre || 'El Grupo y la Piña del Equipo')}</text>
  <text x="260" y="535" fill="#cbd5e1" font-family="Montserrat, Inter, sans-serif" font-size="22" font-weight="600">\${escaparXML(s3.destacado_rol || 'Solidaridad, entrega sin descanso y compañerismo')}</text>

  <!-- Tarjeta Valores de Cantera -->
  <rect x="60" y="640" width="960" height="310" rx="24" fill="rgba(21,24,36,0.85)" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
  <text x="100" y="705" fill="#ff80c0" font-family="Montserrat, Inter, sans-serif" font-size="26" font-weight="800">FILOSOFÍA DE CLUB</text>
  <foreignObject x="100" y="730" width="880" height="190">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Montserrat, Inter, sans-serif; font-size: 24px; font-weight: 600; color: #f1f5f9; line-height: 1.55;">
      "\${escaparXML(s3.valores_lema || 'El fútbol base no es solo ganar partidos, sino forjar personas con respeto, humildad y trabajo en equipo. Orgullo de nuestros chavales.')}"
    </div>
  </foreignObject>

  \${footerBar()}
</svg>\`;

// SLIDE 4: Cierre y Crónica Completa en la Web Oficial
const svg4 = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  \${defsComunes}
  <rect width="1080" height="1080" fill="#0d0d12"/>
  <rect width="1080" height="1080" fill="url(#bgGlow)"/>
  
  \${headerBar(s1.categoria || 'FÚTBOL BASE', 'WEB OFICIAL DEL CLUB', 4)}

  <!-- Tarjeta Central Principal -->
  <rect x="60" y="190" width="960" height="630" rx="24" fill="url(#cardGrad)" stroke="rgba(230,0,126,0.45)" stroke-width="2.5" filter="url(#dropShadow)"/>

  <!-- Logo Badge Central -->
  <circle cx="540" cy="310" r="75" fill="rgba(13,13,18,0.9)" stroke="#E6007E" stroke-width="3" filter="url(#glow)"/>
  <text x="540" y="325" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="42" font-weight="900" text-anchor="middle">ADI</text>

  <!-- Titular Principal -->
  <text x="540" y="440" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="38" font-weight="900" text-anchor="middle">\${escaparXML(s4.titular || 'CRÓNICA COMPLETA EN LA WEB')}</text>
  <text x="540" y="485" fill="#cbd5e1" font-family="Montserrat, Inter, sans-serif" font-size="22" font-weight="500" text-anchor="middle">\${escaparXML(s4.subtitulo || 'Fotografías, declaraciones y actas federativas')}</text>

  <!-- Caja Enlace Web -->
  <rect x="120" y="530" width="840" height="95" rx="20" fill="url(#magentaGrad)" filter="url(#glow)"/>
  <text x="540" y="590" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="32" font-weight="900" letter-spacing="1" text-anchor="middle">\${escaparXML(s4.web_url || 'kamal1305.github.io/WEB-ADI-CF')}</text>

  <!-- Call to action explicativo -->
  <text x="540" y="685" fill="#f1f5f9" font-family="Montserrat, Inter, sans-serif" font-size="22" font-weight="600" text-anchor="middle">\${escaparXML(s4.call_to_action)}</text>
  <text x="540" y="740" fill="#ff80c0" font-family="Montserrat, Inter, sans-serif" font-size="26" font-weight="800" text-anchor="middle">📱 Síguenos en Instagram, Facebook y Telegram</text>

  <!-- Banner Lema -->
  <rect x="60" y="850" width="960" height="110" rx="20" fill="url(#cardGrad)" stroke="rgba(230,0,126,0.35)" stroke-width="2"/>
  <text x="540" y="915" fill="#ffffff" font-family="Montserrat, Inter, sans-serif" font-size="36" font-weight="900" letter-spacing="2" text-anchor="middle">\${escaparXML(s4.lema_club || '¡ESE ADI OEEEE!')}</text>

  \${footerBar()}
</svg>\`;

// Retornar tanto las cadenas SVG como las versiones codificadas en Data URI
return [{
  json: {
    copy_redes: social.copy_redes,
    slide1_svg: svg1,
    slide2_svg: svg2,
    slide3_svg: svg3,
    slide4_svg: svg4,
    slide1_dataUri: 'data:image/svg+xml;base64,' + Buffer.from(svg1).toString('base64'),
    slide2_dataUri: 'data:image/svg+xml;base64,' + Buffer.from(svg2).toString('base64'),
    slide3_dataUri: 'data:image/svg+xml;base64,' + Buffer.from(svg3).toString('base64'),
    slide4_dataUri: 'data:image/svg+xml;base64,' + Buffer.from(svg4).toString('base64')
  }
}];`
      },
      id: "9163aad1-01f3-4450-921e-79e80b464e21",
      name: "Generador Carrusel 4 Slides (1080x1080)",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1080, 720]
    },
    {
      parameters: {
        chatId: "={{ $('Telegram Trigger').first().json.message.chat.id }}",
        text: `=📢 *PROPUESTA DE PUBLICACIÓN EN REDES SOCIALES*

📝 *Copy para Instagram / Facebook / X:*
{{ $('Parsear Social Media JSON').first().json.copy_redes }}

🖼️ *Carrusel Generado (4 Diapositivas 1080x1080 px):*
1️⃣ *Marcador:* {{ $('Parsear Social Media JSON').first().json.slide1.equipo_local }} {{ $('Parsear Social Media JSON').first().json.slide1.goles_local }} - {{ $('Parsear Social Media JSON').first().json.slide1.goles_visitante }} {{ $('Parsear Social Media JSON').first().json.slide1.equipo_visitante }}
2️⃣ *Hitos:* {{ $('Parsear Social Media JSON').first().json.slide2.titular }}
3️⃣ *Valores:* {{ $('Parsear Social Media JSON').first().json.slide3.titular }}
4️⃣ *Web:* {{ $('Parsear Social Media JSON').first().json.slide4.web_url }}

Por favor, revisa la propuesta y pulsa una opción para autorizar la publicación oficial:`,
        replyMarkup: "inlineKeyboard",
        inlineKeyboard: {
          rows: [
            {
              row: [
                {
                  text: "✅ Publicar en Redes",
                  callback_data: "publish_social"
                },
                {
                  text: "❌ Cancelar",
                  callback_data: "cancel_social"
                }
              ]
            }
          ]
        },
        additionalFields: {
          parse_mode: "Markdown"
        }
      },
      id: "3a7a44df-12d7-40df-a694-eb8f602ead29",
      name: "Telegram - Preview y Filtro de Aprobación",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [1360, 720],
      webhookId: "baf5e84c-8775-4ea6-8d4e-00bf4b32f9ae",
      credentials: {
        telegramApi: {
          id: "cJNu7YhwJ6hpdZOZ",
          name: "Telegram account 5"
        }
      }
    },
    {
      parameters: {
        resume: "webhook",
        httpMethod: "POST",
        responseMode: "lastNode",
        options: {}
      },
      id: "332ad5a4-009e-492d-a9cb-d2270f880337",
      name: "Esperar Aprobación Admin (Wait)",
      type: "n8n-nodes-base.wait",
      typeVersion: 1.1,
      position: [1640, 720],
      webhookId: "esperar-aprobacion-redes"
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "loose",
            version: 1
          },
          conditions: [
            {
              id: "cond-aprobado",
              leftValue: "={{ $json.action || $json.query?.action || $json.body?.action || 'publish_social' }}",
              rightValue: "cancel_social",
              operator: {
                type: "string",
                operation: "notEquals"
              }
            }
          ],
          combinator: "and"
        },
        options: {}
      },
      id: "734af433-e5db-4ffc-80dd-4a67abfe97a3",
      name: "¿Aprobado para Redes?",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [1920, 720]
    },
    {
      parameters: {
        method: "POST",
        url: "https://graph.facebook.com/v19.0/me/feed",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "Authorization",
              value: "Bearer {{ $env.META_GRAPH_ACCESS_TOKEN || 'TU_META_TOKEN' }}"
            }
          ]
        },
        sendBody: true,
        bodyParameters: {
          parameters: [
            {
              name: "message",
              value: "={{ $('Parsear Social Media JSON').first().json.copy_redes }}"
            },
            {
              name: "link",
              value: "https://kamal1305.github.io/WEB-ADI-CF/"
            }
          ]
        },
        options: {}
      },
      id: "5713d158-aa9d-446d-a14f-ae59a2263330",
      name: "Meta Graph API (Instagram / Facebook)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [2200, 640]
    },
    {
      parameters: {
        chatId: "@adicovesa_canal",
        text: "=📢 *NUEVA JORNADA · A.D. ICOVESA*\n\n{{ $('Parsear Social Media JSON').first().json.copy_redes }}\n\n🌐 [Leer crónica completa](https://kamal1305.github.io/WEB-ADI-CF/#noticias)",
        additionalFields: {
          parse_mode: "Markdown"
        }
      },
      id: "26acb019-3508-44f1-920d-4358a2cf250f",
      name: "Telegram Channel (Canal Oficial)",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [2480, 640],
      webhookId: "33c622b0-32d9-43f6-b287-6ecfd3b97c51",
      credentials: {
        telegramApi: {
          id: "cJNu7YhwJ6hpdZOZ",
          name: "Telegram account 5"
        }
      }
    },
    {
      parameters: {
        chatId: "={{ $('Telegram Trigger').first().json.message.chat.id }}",
        text: "=🎉 *¡Publicación Autorizada y Completada!*\n\nEl contenido ya ha sido emitido con éxito hacia Meta (Instagram / Facebook) y el Canal Oficial de Telegram de la A.D. Icovesa.",
        additionalFields: {
          parse_mode: "Markdown"
        }
      },
      id: "773f2975-7a1b-409b-8d6d-a9eaa30dae2d",
      name: "Telegram - Confirmar Publicación Redes",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [2760, 640],
      webhookId: "6731cf3a-caf1-4d53-80ab-0868cd5f52c0",
      credentials: {
        telegramApi: {
          id: "cJNu7YhwJ6hpdZOZ",
          name: "Telegram account 5"
        }
      }
    },
    {
      parameters: {
        chatId: "={{ $('Telegram Trigger').first().json.message.chat.id }}",
        text: "=🛑 *Publicación en Redes Cancelada*\n\nEl administrador ha descartado el envío del carrusel y el copy a las redes sociales.",
        additionalFields: {
          parse_mode: "Markdown"
        }
      },
      id: "0695ddc8-a7ef-498c-8ffc-2df2e5b9069b",
      name: "Telegram - Cancelación Notificada",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [2200, 820],
      webhookId: "706fadd5-457b-479c-904b-ac1509d19c75",
      credentials: {
        telegramApi: {
          id: "cJNu7YhwJ6hpdZOZ",
          name: "Telegram account 5"
        }
      }
    }
  ],

  // ============================================================
  // CONEXIONES UNIFICADAS Y EN PARALELO DESDE TELEGRAM TRIGGER
  // ============================================================
  connections: {
    "Telegram Trigger": {
      main: [
        [
          {
            node: "AI Agent",
            type: "main",
            index: 0
          },
          {
            node: "AI Agent - Community Manager",
            type: "main",
            index: 0
          }
        ]
      ]
    },

    // Rama 1: Prensa Web
    "Google Gemini Chat Model": {
      ai_languageModel: [
        [
          {
            node: "AI Agent",
            type: "ai_languageModel",
            index: 0
          }
        ]
      ]
    },
    "AI Agent": {
      main: [
        [
          {
            node: "Parsear Crónica JSON",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Parsear Crónica JSON": {
      main: [
        [
          {
            node: "Leer noticias.json",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Leer noticias.json": {
      main: [
        [
          {
            node: "Insertar Crónica",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Insertar Crónica": {
      main: [
        [
          {
            node: "Publicar en GitHub",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Publicar en GitHub": {
      main: [
        [
          {
            node: "Confirmar Publicación",
            type: "main",
            index: 0
          }
        ]
      ]
    },

    // Rama 2: Community Manager y Redes Sociales
    "Google Gemini Model Social": {
      ai_languageModel: [
        [
          {
            node: "AI Agent - Community Manager",
            type: "ai_languageModel",
            index: 0
          }
        ]
      ]
    },
    "AI Agent - Community Manager": {
      main: [
        [
          {
            node: "Parsear Social Media JSON",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Parsear Social Media JSON": {
      main: [
        [
          {
            node: "Generador Carrusel 4 Slides (1080x1080)",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Generador Carrusel 4 Slides (1080x1080)": {
      main: [
        [
          {
            node: "Telegram - Preview y Filtro de Aprobación",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Telegram - Preview y Filtro de Aprobación": {
      main: [
        [
          {
            node: "Esperar Aprobación Admin (Wait)",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Esperar Aprobación Admin (Wait)": {
      main: [
        [
          {
            node: "¿Aprobado para Redes?",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "¿Aprobado para Redes?": {
      main: [
        // Salida 0: Aprobado (True)
        [
          {
            node: "Meta Graph API (Instagram / Facebook)",
            type: "main",
            index: 0
          }
        ],
        // Salida 1: Cancelado (False)
        [
          {
            node: "Telegram - Cancelación Notificada",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Meta Graph API (Instagram / Facebook)": {
      main: [
        [
          {
            node: "Telegram Channel (Canal Oficial)",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Telegram Channel (Canal Oficial)": {
      main: [
        [
          {
            node: "Telegram - Confirmar Publicación Redes",
            type: "main",
            index: 0
          }
        ]
      ]
    }
  },
  settings: {
    executionOrder: "v1"
  },
  active: false,
  pinData: {},
  versionId: "1"
};

const targetPath = path.join(__dirname, '..', 'n8n-prensa-y-socialmedia.json');
fs.writeFileSync(targetPath, JSON.stringify(mergedWorkflow, null, 2), 'utf8');
console.log('Sobrescrito exitosamente con flujo unificado:', targetPath);
console.log('Total nodos:', mergedWorkflow.nodes.length);
console.log('Total conexiones:', Object.keys(mergedWorkflow.connections).length);
