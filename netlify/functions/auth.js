export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
    const clientSecret = process.env.OAUTH_GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        error: 'OAuth credentials not configured',
        message: 'Set OAUTH_GITHUB_CLIENT_ID and OAUTH_GITHUB_CLIENT_SECRET env vars',
      });
    }

    const code = req.query.code;
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // Intercambiar código por token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(401).json({
        error: 'OAuth authentication failed',
        details: tokenData.error_description || tokenData.error,
      });
    }

    // Obtener información del usuario
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      return res.status(401).json({ error: 'Failed to fetch user data' });
    }

    const userData = await userResponse.json();

    // Respuesta en formato esperado por Decap CMS
    res.status(200).json({
      token: tokenData.access_token,
      provider: 'github',
      user: {
        login: userData.login,
        name: userData.name || userData.login,
        avatar_url: userData.avatar_url,
      },
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: error.message,
    });
  }
}
