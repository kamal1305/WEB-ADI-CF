export default function handler(req, res) {
  const clientId = process.env.OAUTH_CLIENT_ID || "Ov23li63sCBWs3RAKxEV";
  const redirectUri = "https://web-adi-cf-d6ap.vercel.app/api/callback";
  const scope = "repo,user,public_repo";
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
  res.redirect(302, url);
}
