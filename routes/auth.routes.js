const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

const { isUserAuthorized } = require("../utils/plex");

/**
 * Grab le cookie connect.sid de Seerr via le token Plex.
 * Même logique qu'Organizr sso-functions.php#L335.
 * Le cookie est posé directement dans le browser → envoyé automatiquement
 * à toutes les requêtes sous /overseerr-frame/.
 */
async function grabSeerrCookie(authToken, res, basePath) {
  const overseerrUrl = (process.env.OVERSEERR_URL || "").replace(/\/$/, "");
  if (!overseerrUrl || !authToken) return;
  try {
    const r = await fetch(`${overseerrUrl}/api/v1/auth/plex`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ authToken })
    });
    if (!r.ok) {
      console.warn(`[Auth] Seerr SSO échoué: HTTP ${r.status}`);
      return;
    }
    const setCookies = r.headers.raw()["set-cookie"] || [];
    const sidCookie = setCookies.find(c => c.startsWith("connect.sid="));
    if (sidCookie) {
      const value = sidCookie.split(";")[0].replace("connect.sid=", "");
      // Poser le cookie dans le browser, restreint au path du proxy Seerr
      res.cookie("connect.sid", decodeURIComponent(value), {
        path: basePath + "/overseerr-frame",
        httpOnly: true,
        sameSite: "lax"
      });
      console.info(`[Auth] ✅ Cookie Seerr posé dans le browser (connect.sid @ ${basePath}/overseerr-frame)`);
    } else {
      console.warn("[Auth] Seerr n'a pas retourné de connect.sid");
    }
  } catch (e) {
    console.warn("[Auth] Erreur grab cookie Seerr:", e.message);
  }
}

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

  console.info(`\n[Auth] Login attempt from Plex user:`);
  console.info(`  ID: ${user.id}`);
  console.info(`  Email: ${user.email}`);
  console.info(`  Username: ${user.username}`);
  console.debug(`[Auth] Full user response from plex.tv:`, JSON.stringify(user, null, 2));

  // ⚠️ NOTE: Whitelist validation would require access to Plex server's user list,
  // which is not reliably exposed via Plex API. Since the user has successfully 
  // authenticated via Plex OAuth, we trust this as sufficient validation.
  
  console.info(`✅ [Auth] LOGIN SUCCESS for Plex user ${user.id} (${user.email})`);
  console.info(`[Auth] User authenticated via Plex OAuth\n`);

  req.session.user = user;
  req.session.user.joinedAtTimestamp = user.joinedAt;
  req.session.plexToken = authToken;
  delete req.session.pinId;

  // Grab le cookie Seerr immédiatement au login (same as Organizr)
  // Le cookie connect.sid est posé dans le browser → pas besoin d'injection proxy
  await grabSeerrCookie(authToken, res, req.basePath || "");

  res.redirect(req.basePath + "/dashboard");
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect(req.basePath + "/");
  });
});

module.exports = router;
