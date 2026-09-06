exports.handler = async (event, context) => {
  try {
    const clientId = process.env.OAUTH_GITHUB_CLIENT_ID;
    const clientSecret = process.env.OAUTH_GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'OAuth credentials not configured',
          message: 'Set OAUTH_GITHUB_CLIENT_ID and OAUTH_GITHUB_CLIENT_SECRET env vars',
        }),
      };
    }

    const code = event.queryStringParameters?.code;
    if (!code) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing authorization code' }),
      };
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
      return {
        statusCode: 401,
        body: JSON.stringify({
          error: 'OAuth authentication failed',
          details: tokenData.error_description || tokenData.error,
        }),
      };
    }

    // Obtener información del usuario
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Failed to fetch user data' }),
      };
    }

    const userData = await userResponse.json();

    // Respuesta en formato esperado por Decap CMS
    return {
      statusCode: 200,
      body: JSON.stringify({
        token: tokenData.access_token,
        provider: 'github',
        user: {
          login: userData.login,
          name: userData.name || userData.login,
          avatar_url: userData.avatar_url,
        },
      }),
    };
  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Authentication failed',
        message: error.message,
      }),
    };
  }
};
