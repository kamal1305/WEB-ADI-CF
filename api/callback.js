export default async function handler(req, res) {
  const code = req.query.code;
  const clientId = process.env.OAUTH_CLIENT_ID;
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
        code: code,
      }),
    });

    const data = await response.json();
    const content = {
      token: data.access_token,
      provider: "github",
    };

    const html = `
      <script>
        const receiveMessage = (message) => {
          window.opener.postMessage(
            'authorization:github:success:${JSON.stringify(content)}',
            message.origin
          );
          window.removeEventListener("message", receiveMessage, false);
        };
        window.addEventListener("message", receiveMessage, false);
        window.opener.postMessage("authorizing:github", "*");
      </script>
    `;

    res.setHeader("Content-Type", "text/html");
    res.status(200).send(html);
  } catch (error) {
    res.status(500).send(error.message);
  }
}
