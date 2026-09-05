export default async function handler(req, res) {
  const { code } = req.query;
  const clientId = process.env.OAUTH_CLIENT_ID || "Ov23li63sCBWs3RAKxEV";
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;

  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const data = await response.json();

    if (data.error || !data.access_token) {
      return res.status(401).send(`Error de GitHub: ${data.error_description || data.error || 'Token no recibido'}`);
    }

    const postMsgContent = JSON.stringify({
      token: data.access_token,
      provider: "github",
    });

    const html = `
      <!doctype html>
      <html>
      <body>
        <script>
          (function() {
            function receiveMessage(e) {
              console.log("Recibido handshake:", e.data);
              window.opener.postMessage(
                'authorization:github:success:${postMsgContent}',
                e.origin
              );
            }
            window.addEventListener("message", receiveMessage, false);
            window.opener.postMessage("authorizing:github", "*");
          })();
        </script>
        <p>Autenticado correctamente. Puedes cerrar esta ventana si no se cierra sola.</p>
      </body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  } catch (error) {
    res.status(500).send(`Error interno: ${error.message}`);
  }
}
