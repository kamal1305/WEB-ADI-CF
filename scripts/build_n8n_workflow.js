const fs = require('fs');
const path = require('path');

// Generador de UUID v4 simple para nodos
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 1. Definición del flujo n8n
const workflow = {
  name: "A.D. Icovesa — Prensa Web y Community Manager Social Media",
  nodes: [
    // ==========================================
    // 1. TRIGGER Y NORMALIZACIÓN
    // ==========================================
    {
      parameters: {
        updates: [
          "message",
          "callback_query"
        ]
      },
      id: "node-trigger-telegram",
      name: "Telegram Trigger",
      type: "n8n-nodes-base.telegramTrigger",
      typeVersion: 1.1,
      position: [120, 380],
      webhookId: "telegram-adi-trigger",
      credentials: {
        telegramApi: {
          id: "adi-telegram-bot",
          name: "Telegram ADI Bot"
        }
      }
    },
    {
      parameters: {
        jsCode: `// 1. Normalizar entrada de Telegram (mensaje de texto, nota de voz transcrita o callback)
const input = $input.first().json;

const message = input.message || {};
const callbackQuery = input.callback_query || null;

let textoPartido = message.text || message.caption || '';
if (!textoPartido && callbackQuery) {
  textoPartido = callbackQuery.data || '';
}

const chatId = message.chat ? message.chat.id : (callbackQuery && callbackQuery.message ? callbackQuery.message.chat.id : '');
const messageId = message.message_id ? message.message_id : (callbackQuery && callbackQuery.message ? callbackQuery.message.message_id : '');
const remitente = message.from ? (message.from.first_name + (message.from.last_name ? ' ' + message.from.last_name : '')) : 'Delegado / Entrenador';

if (!textoPartido.trim()) {
  textoPartido = 'Partido de fútbol base A.D. Icovesa. Pendiente de completar detalles por el entrenador.';
}

return [{
  json: {
    textoPartido: textoPartido.trim(),
    chatId: chatId,
    messageId: messageId,
    remitente: remitente,
    esCallback: !!callbackQuery,
    callbackData: callbackQuery ? callbackQuery.data : null,
    timestamp: new Date().toISOString()
  }
}];`
      },
      id: "node-normalizar-entrada",
      name: "Normalizar Mensaje Partido",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [340, 380]
    },

    // ==========================================
    // 2. RAMA 1: PRENSA WEB (Crónica Oficial)
    // ==========================================
    {
      parameters: {
        modelName: "models/gemini-2.5-flash",
        options: {
          temperature: 0.65
        }
      },
      id: "node-gemini-web",
      name: "Google Gemini Model Web",
      type: "n8n-nodes-langchain.lmChatGoogleGemini",
      typeVersion: 1.2,
      position: [580, 100],
      credentials: {
        googlePalmApi: {
          id: "gemini-api-adi",
          name: "Google Gemini API"
        }
      }
    },
    {
      parameters: {
        promptType: "define",
        prompt: "={{ $('Normalizar Mensaje Partido').first().json.textoPartido }}",
        options: {
          systemMessage: `Eres el redactor oficial de crónicas deportivas de la Asociación Deportiva Icovesa (A.D. Icovesa, Jerez de la Frontera, Cádiz). Tu misión es redactar la crónica oficial del partido para la web del club (sección #noticias).

Recibes un mensaje con los datos del encuentro: categoría, equipos rivales, marcador, goleadores, incidencias y momentos destacados.

Debes responder ÚNICAMENTE con un objeto JSON válido (sin formato Markdown, sin bloques \`\`\`json, sin texto adicional) con esta estructura exacta:
{
  "id": "cronica-YYYYMMDD-categoria",
  "titulo": "Título periodístico y emocionante (máx 80 caracteres)",
  "fecha": "YYYY-MM-DD",
  "categoria": "Prebenjamín | Benjamín | Alevín | Infantil | Cadete | Juvenil",
  "resumen": "Resumen conciso y atractivo de 2-3 líneas para la tarjeta de la noticia",
  "cuerpo": "Crónica estructurada en HTML limpio (usa párrafos <p>, negritas <strong> para goleadores y momentos clave, y <em> para declaraciones o espíritu deportivo. NO incluyas scripts ni etiquetas de encabezado <h1>/<h2>)",
  "imagen": "img/noticias/default.jpg",
  "fuente": "A.D. Icovesa"
}

Reglas obligatorias:
- Tono riguroso, deportivo, entusiasta y centrado en el fútbol formativo y los valores de Icovesa.
- Si hay goleadores y minutos en el texto, menciónalos expresamente en el cuerpo.
- Si no se especifica fecha, usa la fecha actual en formato YYYY-MM-DD.
- El campo 'id' debe ser único en minúsculas: cronica-AAAAMMDD-categoria (ej. cronica-20260919-infantil).
- El campo 'fuente' es siempre 'A.D. Icovesa'.`
        }
      },
      id: "node-ai-agent-web",
      name: "AI Agent - Prensa Web",
      type: "n8n-nodes-langchain.agent",
      typeVersion: 1.6,
      position: [680, 240]
    },
    {
      parameters: {
        jsCode: `// Extraer y validar el JSON devuelto por el agente de prensa
const input = $input.first().json.output || $input.first().json.response || $input.first().json.text || JSON.stringify($input.first().json);

let cronica;
try {
  const match = input.match(/\\{[\\s\\S]*\"id\"[\\s\\S]*\\}/);
  if (match) {
    cronica = JSON.parse(match[0]);
  } else {
    cronica = JSON.parse(input);
  }
} catch (err) {
  throw new Error('La IA no devolvió un JSON válido para la crónica web: ' + input.substring(0, 400));
}

// Validar y sanear campos requeridos
const requeridos = ['id', 'titulo', 'fecha', 'categoria', 'resumen', 'cuerpo', 'imagen', 'fuente'];
for (const campo of requeridos) {
  if (!cronica[campo]) {
    if (campo === 'fuente') cronica[campo] = 'A.D. Icovesa';
    else if (campo === 'imagen') cronica[campo] = 'img/noticias/default.jpg';
    else if (campo === 'fecha') cronica[campo] = new Date().toISOString().split('T')[0];
    else cronica[campo] = 'Pendiente de confirmación';
  }
}

return [{ json: cronica }];`
      },
      id: "node-parsear-cronica",
      name: "Parsear Crónica Web JSON",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [920, 240]
    },
    {
      parameters: {
        resource: "file",
        operation: "get",
        repository: {
          "__rl": true,
          "mode": "name",
          "value": "kamal1305/WEB-ADI-CF"
        },
        filePath: "docs/content/noticias.json",
        asBinaryProperty: false
      },
      id: "node-github-get-noticias",
      name: "Leer docs/content/noticias.json",
      type: "n8n-nodes-base.github",
      typeVersion: 1,
      position: [1160, 240],
      credentials: {
        githubApi: {
          id: "github-adi-token",
          name: "GitHub ADI Account"
        }
      }
    },
    {
      parameters: {
        jsCode: `// Insertar la nueva crónica al principio de la colección
const cronica = $('Parsear Crónica Web JSON').first().json;
const githubFile = $('Leer docs/content/noticias.json').first().json;

let noticias = [];
if (typeof githubFile.content === 'string') {
  try {
    const dec = Buffer.from(githubFile.content, 'base64').toString('utf-8');
    const parsed = JSON.parse(dec);
    noticias = Array.isArray(parsed) ? parsed : (parsed.noticias || parsed.items || []);
  } catch (e) {
    noticias = [];
  }
} else if (githubFile.content && typeof githubFile.content === 'object') {
  noticias = Array.isArray(githubFile.content) ? githubFile.content : (githubFile.content.noticias || []);
}

// Reemplazar si coincide id o insertar arriba
const idx = noticias.findIndex(n => n && n.id === cronica.id);
if (idx >= 0) {
  noticias[idx] = cronica;
} else {
  noticias.unshift(cronica);
}

const contenidoJSON = JSON.stringify({ noticias: noticias }, null, 2);
const contenidoBase64 = Buffer.from(contenidoJSON, 'utf-8').toString('base64');

return [{
  json: {
    sha: githubFile.sha,
    contenidoJSON: contenidoJSON,
    contenidoBase64: contenidoBase64,
    titulo: cronica.titulo,
    categoria: cronica.categoria,
    fecha: cronica.fecha
  }
}];`
      },
      id: "node-insertar-cronica",
      name: "Insertar Crónica en Array",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1400, 240]
    },
    {
      parameters: {
        resource: "file",
        operation: "edit",
        repository: {
          "__rl": true,
          "mode": "name",
          "value": "kamal1305/WEB-ADI-CF"
        },
        filePath: "docs/content/noticias.json",
        fileContent: "={{ $('Insertar Crónica en Array').first().json.contenidoJSON }}",
        commitMessage: "=📰 Crónica web: {{ $('Parsear Crónica Web JSON').first().json.titulo }}",
        additionalParameters: {}
      },
      id: "node-github-commit-web",
      name: "Publicar en GitHub (docs/content/noticias.json)",
      type: "n8n-nodes-base.github",
      typeVersion: 1,
      position: [1640, 240],
      credentials: {
        githubApi: {
          id: "github-adi-token",
          name: "GitHub ADI Account"
        }
      }
    },
    {
      parameters: {
        resource: "message",
        operation: "sendMessage",
        chatId: "={{ $('Normalizar Mensaje Partido').first().json.chatId }}",
        text: "=✅ *Crónica Oficial Publicada en la Web*\n\n📰 *{{ $('Parsear Crónica Web JSON').first().json.titulo }}*\n⚽ *Categoría:* {{ $('Parsear Crónica Web JSON').first().json.categoria }}\n📅 *Fecha:* {{ $('Parsear Crónica Web JSON').first().json.fecha }}\n\n🔗 [Ver en kamal1305.github.io/WEB-ADI-CF](https://kamal1305.github.io/WEB-ADI-CF/#noticias)",
        additionalFields: {
          parse_mode: "Markdown"
        }
      },
      id: "node-telegram-confirm-web",
      name: "Telegram - Confirmar Prensa Web",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [1880, 240],
      credentials: {
        telegramApi: {
          id: "adi-telegram-bot",
          name: "Telegram ADI Bot"
        }
      }
    },

    // ==========================================
    // 3. RAMA 2: COMMUNITY MANAGER Y SOCIAL MEDIA
    // ==========================================
    {
      parameters: {
        modelName: "models/gemini-2.5-flash",
        options: {
          temperature: 0.75
        }
      },
      id: "node-gemini-social",
      name: "Google Gemini Model Social",
      type: "n8n-nodes-langchain.lmChatGoogleGemini",
      typeVersion: 1.2,
      position: [580, 720],
      credentials: {
        googlePalmApi: {
          id: "gemini-api-adi",
          name: "Google Gemini API"
        }
      }
    },
    {
      parameters: {
        promptType: "define",
        prompt: "={{ $('Normalizar Mensaje Partido').first().json.textoPartido }}",
        options: {
          systemMessage: `Eres el Community Manager y estratega de redes sociales de la A.D. Icovesa (Jerez de la Frontera, Cádiz).
Tu misión es transformar el resultado del partido en una publicación deportiva irresistible para Instagram, Facebook y X, junto con los textos estructurados para un carrusel de 4 diapositivas cuadradas (1080x1080 px).

Debes responder ÚNICAMENTE con un objeto JSON válido (sin Markdown, sin bloques \`\`\`json):
{
  "copy_redes": "Copy persuasivo, vibrante y deportivo para Instagram y Facebook. Con tono de barrio jerezano noble, emojis futboleros (⚽🔥💙💖👏), resumen del partido, felicitación a la plantilla y los hashtags oficiales: #ADIcovesa #Jerez #FutbolBase #CanteraIcovesa #OrgulloDeBarrio",
  "copy_x": "Tweet oficial conciso para X (máximo 250 caracteres con titular, resultado, enlace https://kamal1305.github.io/WEB-ADI-CF/#noticias y hashtags #ADIcovesa #Jerez)",
  "copy_telegram": "Mensaje deportivo completo con formato Markdown para el Canal de Telegram de socios y familias con negritas, resultado, hitos y enlace directo a la web",
  "slide1": {
    "categoria": "INFANTIL | BENJAMÍN | ALEVÍN | etc.",
    "competicion": "AMISTOSO PRETEMPORADA | LIGA RFAF",
    "equipo_local": "Nombre Equipo Local",
    "goles_local": "1",
    "equipo_visitante": "Nombre Equipo Visitante",
    "goles_visitante": "2",
    "estado": "FINAL DEL PARTIDO",
    "fecha_campo": "19 Septiembre 2026 · Campo de Fútbol Juan Simón",
    "titular": "¡GRAN ACTUACIÓN Y PARTIDAZO DE NUESTROS CHAVALES!"
  },
  "slide2": {
    "titular": "GOLEADORES Y MINUTOS CLAVE",
    "subtitulo": "Momentos decisivos sobre el terreno de juego",
    "hitos": [
      "⚽ 14' Gol de Hugo con un disparo ajustado al palo",
      "🔥 32' Gran intervención defensiva para mantener la ventaja",
      "⚽ 58' Gol de Daniel en una rápida transición colectiva"
    ]
  },
  "slide3": {
    "titular": "JUGADOR DESTACADO Y VALORES",
    "destacado_nombre": "La Solidaridad y la Entrega Colectiva",
    "destacado_rol": "Espíritu de equipo y generosidad en cada presión",
    "valores_lema": "En la A.D. Icovesa educamos a través del deporte: respeto al rival, compañerismo y superación constante."
  },
  "slide4": {
    "titular": "CRÓNICA COMPLETA EN LA WEB",
    "subtitulo": "Toda la actualidad del fútbol base de Icovesa",
    "web_url": "kamal1305.github.io/WEB-ADI-CF",
    "call_to_action": "Accede a la web oficial para leer la crónica completa y consultar calendarios.",
    "lema_club": "¡ESE ADI OEEEE! 💖⚽💙"
  }
}

Reglas:
- Asegura que el copy enganche desde la primera línea.
- Genera datos plausibles y fieles al mensaje recibido.
- Mantén el JSON 100% estricto y limpio.`
        }
      },
      id: "node-ai-agent-social",
      name: "AI Agent - Community Manager",
      type: "n8n-nodes-langchain.agent",
      typeVersion: 1.6,
      position: [680, 560]
    },
    {
      parameters: {
        jsCode: `// Extraer y validar el JSON de Social Media
const input = $input.first().json.output || $input.first().json.response || $input.first().json.text || JSON.stringify($input.first().json);

let social;
try {
  const match = input.match(/\\{[\\s\\S]*\"copy_redes\"[\\s\\S]*\\}/);
  if (match) {
    social = JSON.parse(match[0]);
  } else {
    social = JSON.parse(input);
  }
} catch (err) {
  throw new Error('La IA no devolvió un JSON válido para Social Media: ' + input.substring(0, 400));
}

// Fallbacks de seguridad
if (!social.copy_redes) {
  social.copy_redes = '¡Gran partido de nuestra cantera de A.D. Icovesa! ⚽🔥 Seguimos sumando aprendizaje, entrega y pasión por nuestros colores. ¡Orgullosos de nuestro equipo! #ADIcovesa #Jerez #FutbolBase';
}
if (!social.copy_x) {
  social.copy_x = '⚽ Gran partido de la cantera de la A.D. Icovesa. ¡Orgullo de equipo y de barrio! Crónica completa en la web: https://kamal1305.github.io/WEB-ADI-CF/#noticias #ADIcovesa #Jerez';
}
if (!social.copy_telegram) {
  social.copy_telegram = '📢 *NOVEDADES A.D. ICOVESA*\\n\\n' + social.copy_redes + '\\n\\n🌐 [Ver crónica en la web oficial](https://kamal1305.github.io/WEB-ADI-CF/#noticias)';
}

social.slide1 = social.slide1 || {
  categoria: 'FÚTBOL BASE',
  competicion: 'AMISTOSO DE PRETEMPORADA',
  equipo_local: 'A.D. Icovesa',
  goles_local: '-',
  equipo_visitante: 'Rival',
  goles_visitante: '-',
  estado: 'FINAL DEL PARTIDO',
  fecha_campo: 'Jerez de la Frontera',
  titular: '¡PARTIDAZO Y ENTREGA TOTAL DE NUESTRO EQUIPO!'
};

social.slide2 = social.slide2 || {
  titular: 'GOLEADORES Y MINUTOS CLAVE',
  subtitulo: 'Momentos destacados del encuentro',
  hitos: ['⚽ Gran esfuerzo coral', '🔥 Entrega máxima en cada jugada', '👏 Afición ejemplar animando']
};

social.slide3 = social.slide3 || {
  titular: 'JUGADOR DESTACADO Y VALORES',
  destacado_nombre: 'El Trabajo en Equipo',
  destacado_rol: 'Liderazgo, compañerismo y respeto',
  valores_lema: 'Valores de barrio, corazón y fútbol formativo.'
};

social.slide4 = social.slide4 || {
  titular: 'CRÓNICA COMPLETA EN LA WEB',
  subtitulo: 'Sigue a todos los equipos del club',
  web_url: 'kamal1305.github.io/WEB-ADI-CF',
  call_to_action: 'Crónica extendida, alineaciones y fotos en la web oficial.',
  lema_club: '¡ESE ADI OEEEE!'
};

return [{ json: social }];`
      },
      id: "node-parsear-social",
      name: "Parsear Social Media JSON",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [920, 560]
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
    copy_x: social.copy_x,
    copy_telegram: social.copy_telegram,
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
      id: "node-generador-carrusel",
      name: "Generador Carrusel 4 Slides (1080x1080)",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1160, 560]
    },
    {
      parameters: {
        resource: "message",
        operation: "sendMessage",
        chatId: "={{ $('Normalizar Mensaje Partido').first().json.chatId }}",
        text: `=📢 *PROPUESTA DE PUBLICACIÓN EN REDES SOCIALES (CASCADA)*

📸 *Instagram / Facebook:*
{{ $('Parsear Social Media JSON').first().json.copy_redes }}

🐦 *X (Twitter):*
{{ $('Parsear Social Media JSON').first().json.copy_x }}

💬 *Canal Oficial Telegram:*
{{ $('Parsear Social Media JSON').first().json.copy_telegram }}

🖼️ *Carrusel Generado (4 Diapositivas 1080x1080 px):*
1️⃣ *Marcador:* {{ $('Parsear Social Media JSON').first().json.slide1.equipo_local }} {{ $('Parsear Social Media JSON').first().json.slide1.goles_local }} - {{ $('Parsear Social Media JSON').first().json.slide1.goles_visitante }} {{ $('Parsear Social Media JSON').first().json.slide1.equipo_visitante }}
2️⃣ *Hitos:* {{ $('Parsear Social Media JSON').first().json.slide2.titular }}
3️⃣ *Valores:* {{ $('Parsear Social Media JSON').first().json.slide3.titular }}
4️⃣ *Web:* {{ $('Parsear Social Media JSON').first().json.slide4.web_url }}

Por favor, revisa la propuesta y pulsa una opción para autorizar la emisión oficial en cascada:`,
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
      id: "node-telegram-preview",
      name: "Telegram - Preview y Filtro de Aprobación",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [1400, 560],
      credentials: {
        telegramApi: {
          id: "adi-telegram-bot",
          name: "Telegram ADI Bot"
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
      id: "node-wait-approval",
      name: "Esperar Aprobación Admin (Wait)",
      type: "n8n-nodes-base.wait",
      typeVersion: 1.1,
      position: [1640, 560],
      webhookId: "esperar-aprobacion-redes"
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "loose"
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
        }
      },
      id: "node-if-approved",
      name: "¿Aprobado para Redes?",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [1880, 560]
    },

    // ==========================================
    // 4. PUBLICACIÓN CONDICIONAL (Aprobado)
    // ==========================================
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
      id: "node-meta-graph-api",
      name: "Meta Graph API (Instagram / Facebook)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [2140, 480]
    },
    {
      parameters: {
        method: "POST",
        url: "https://api.twitter.com/2/tweets",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "Authorization",
              value: "Bearer {{ $env.TWITTER_BEARER_TOKEN || 'TU_TWITTER_BEARER_TOKEN' }}"
            },
            {
              name: "Content-Type",
              value: "application/json"
            }
          ]
        },
        sendBody: true,
        bodyParameters: {
          parameters: [
            {
              name: "text",
              value: "={{ $('Parsear Social Media JSON').first().json.copy_x }}"
            }
          ]
        },
        options: {}
      },
      id: "node-x-twitter-api",
      name: "X API v2 (Twitter)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [2380, 480]
    },
    {
      parameters: {
        resource: "message",
        operation: "sendMessage",
        chatId: "@adicovesa_canal",
        text: "=📢 *NUEVA JORNADA · A.D. ICOVESA*\n\n{{ $('Parsear Social Media JSON').first().json.copy_telegram }}\n\n🌐 [Leer crónica completa](https://kamal1305.github.io/WEB-ADI-CF/#noticias)",
        additionalFields: {
          parse_mode: "Markdown"
        }
      },
      id: "node-telegram-channel",
      name: "Telegram Channel (Canal Oficial)",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [2620, 480],
      credentials: {
        telegramApi: {
          id: "adi-telegram-bot",
          name: "Telegram ADI Bot"
        }
      }
    },
    {
      parameters: {
        resource: "message",
        operation: "sendMessage",
        chatId: "={{ $('Normalizar Mensaje Partido').first().json.chatId }}",
        text: "=🎉 *¡Publicación Autorizada y Emitida en Cascada!*\n\nEl contenido deportivo ya ha sido emitido con éxito hacia:\n✅ *Meta* (Instagram y Facebook)\n✅ *X* (Twitter @adicovesa)\n✅ *Telegram* (Canal Oficial @adicovesa_canal)\n\n🌐 [Ver web oficial](https://kamal1305.github.io/WEB-ADI-CF/#noticias)",
        additionalFields: {
          parse_mode: "Markdown"
        }
      },
      id: "node-telegram-confirm-social",
      name: "Telegram - Confirmar Publicación Redes",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [2860, 480],
      credentials: {
        telegramApi: {
          id: "adi-telegram-bot",
          name: "Telegram ADI Bot"
        }
      }
    },

    // ==========================================
    // 5. PUBLICACIÓN CONDICIONAL (Cancelado)
    // ==========================================
    {
      parameters: {
        resource: "message",
        operation: "sendMessage",
        chatId: "={{ $('Normalizar Mensaje Partido').first().json.chatId }}",
        text: "=🛑 *Publicación en Redes Cancelada*\n\nEl administrador ha descartado el envío del carrusel y el copy a las redes sociales.",
        additionalFields: {
          parse_mode: "Markdown"
        }
      },
      id: "node-telegram-cancel-social",
      name: "Telegram - Cancelación Notificada",
      type: "n8n-nodes-base.telegram",
      typeVersion: 1.2,
      position: [2140, 680],
      credentials: {
        telegramApi: {
          id: "adi-telegram-bot",
          name: "Telegram ADI Bot"
        }
      }
    }
  ],

  // ==========================================
  // CONEXIONES DEL FLUJO
  // ==========================================
  connections: {
    "Telegram Trigger": {
      main: [
        [
          {
            node: "Normalizar Mensaje Partido",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Normalizar Mensaje Partido": {
      main: [
        [
          {
            node: "AI Agent - Prensa Web",
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

    // Conexiones Rama 1: Prensa Web
    "Google Gemini Model Web": {
      ai_languageModel: [
        [
          {
            node: "AI Agent - Prensa Web",
            type: "ai_languageModel",
            index: 0
          }
        ]
      ]
    },
    "AI Agent - Prensa Web": {
      main: [
        [
          {
            node: "Parsear Crónica Web JSON",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Parsear Crónica Web JSON": {
      main: [
        [
          {
            node: "Leer docs/content/noticias.json",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Leer docs/content/noticias.json": {
      main: [
        [
          {
            node: "Insertar Crónica en Array",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Insertar Crónica en Array": {
      main: [
        [
          {
            node: "Publicar en GitHub (docs/content/noticias.json)",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Publicar en GitHub (docs/content/noticias.json)": {
      main: [
        [
          {
            node: "Telegram - Confirmar Prensa Web",
            type: "main",
            index: 0
          }
        ]
      ]
    },

    // Conexiones Rama 2: Community Manager y Social Media
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
        // Salida 0: True (Aprobado)
        [
          {
            node: "Meta Graph API (Instagram / Facebook)",
            type: "main",
            index: 0
          }
        ],
        // Salida 1: False (Cancelado)
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
            node: "X API v2 (Twitter)",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "X API v2 (Twitter)": {
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

// Guardar archivo en la raíz
const targetPath = path.join(__dirname, '..', 'n8n-prensa-y-socialmedia.json');
fs.writeFileSync(targetPath, JSON.stringify(workflow, null, 2), 'utf8');
console.log('Generado exitosamente:', targetPath);
console.log('Total nodos:', workflow.nodes.length);
console.log('Total conexiones:', Object.keys(workflow.connections).length);
