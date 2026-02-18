const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

const { isUserAuthorized } = require("../utils/plex");

router.get("/login", async (req, res) => {

  const response = await fetch("https://plex.tv/api/v2/pins?strong=true", {
    method: "POST",
    headers: {
      "X-Plex-Client-Identifier": "plex-portal-app",
      "X-Plex-Product": "Plex Portal",
      "Accept": "application/json"
    }
  });

  const data = await response.json();

  req.session.pinId = data.id;

  // Construire l'URL de callback automatiquement
  const forwardUrl = req.appUrl + "/auth-complete";

  res.redirect(
    `https://app.plex.tv/auth#?clientID=plex-portal-app&code=${data.code}&forwardUrl=${encodeURIComponent(forwardUrl)}`
  );
});

router.get("/auth-complete", async (req, res) => {

  if (!req.session.pinId) return res.redirect(req.basePath + "/");

  let authToken = null;

  for (let i = 0; i < 10; i++) {
    const response = await fetch(
      `https://plex.tv/api/v2/pins/${req.session.pinId}`,
      {
        headers: {
          "X-Plex-Client-Identifier": "plex-portal-app",
          "Accept": "application/json"
        }
      }
    );

    const data = await response.json();

    if (data.authToken) {
      authToken = data.authToken;
      break;
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  if (!authToken) return res.redirect(req.basePath + "/");

  const account = await fetch("https://plex.tv/api/v2/user", {
    headers: {
      "X-Plex-Token": authToken,
      "Accept": "application/json"
    }
  });

  const user = await account.json();

  // ✅ VÉRIFICATION DE SÉCURITÉ: Whitelist des utilisateurs Plex
  if (process.env.PLEX_URL && process.env.PLEX_TOKEN) {
    const isAuthorized = await isUserAuthorized(
      user.id,
      process.env.PLEX_URL,
      process.env.PLEX_TOKEN
    );

    if (!isAuthorized) {
      console.warn(`[Auth] Unauthorized login attempt from Plex user ${user.id} (${user.email})`);
      delete req.session.pinId;
      return res.status(403).send(`
        <html>
          <head>
            <title>Accès refusé</title>
            <style>
              body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #1a1a1a; color: #fff; }
              .container { text-align: center; }
              h1 { color: #ff6b6b; }
              p { font-size: 16px; margin: 20px 0; }
              a { color: #4dabf7; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Accès refusé</h1>
              <p>Votre compte Plex n'est pas autorisé sur ce serveur.</p>
              <p><a href="${req.basePath}/">Retour à l'accueil</a></p>
            </div>
          </body>
        </html>
      `);
    }

    console.info(`[Auth] Authorized login for Plex user ${user.id} (${user.email})`);
  }

  req.session.user = user;
  delete req.session.pinId;

  res.redirect(req.basePath + "/dashboard");
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect(req.basePath + "/");
  });
});

module.exports = router;
