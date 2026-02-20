/**
 * SEERR IFRAME ROUTE
 * ==================
 * Affiche Seerr dans une iframe full-page.
 *
 * Auth SSO (Organizr style) :
 *   Au login, auth.routes.js  grabSeerrCookie() r�cup�re le connect.sid de Seerr
 *   et le pose dans le browser avec domain=.idrinktv.ovh (parent commun entre
 *   plex-portal.idrinktv.ovh et overseerr.idrinktv.ovh).
 *   Le browser l'envoie automatiquement quand l'iframe charge overseerr.idrinktv.ovh  SSO.
 *
 * Config requise :
 *   SEERR_URL        = URL interne (pour l'API auth au login)
 *   SEERR_PUBLIC_URL = URL publique HTTPS (src de l'iframe)
 */

const express = require("express");
const fetch   = require("node-fetch");
const router  = express.Router();

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect((req.basePath || "") + "/");
  }
  next();
}

function getSeerrCookieDomain() {
  const publicUrl = process.env.SEERR_PUBLIC_URL || "";
  if (!publicUrl) return null;
  try {
    const hostname = new URL(publicUrl).hostname;
    const parts = hostname.split(".");
    if (parts.length >= 2) return "." + parts.slice(-2).join(".");
  } catch (e) {}
  return null;
}

async function grabSeerrCookie(authToken, res, username) {
  const seerrUrl = (process.env.SEERR_URL || "").replace(/\/$/, "");
  if (!seerrUrl) { console.warn("[Seerr SSO] SEERR_URL non configuré"); return false; }
  if (!authToken) { console.warn(`[Seerr SSO] ⚠️ plexToken absent de la session pour ${username} — l'utilisateur doit se reconnecter`); return false; }
  try {
    const r = await fetch(`${seerrUrl}/api/v1/auth/plex`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ authToken })
    });
    console.info(`[Seerr SSO] POST /api/v1/auth/plex pour ${username} → HTTP ${r.status}`);
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.warn(`[Seerr SSO] Échec HTTP ${r.status} pour ${username} — réponse: ${body.slice(0, 200)}`);
      return false;
    }
    const setCookies = r.headers.raw()["set-cookie"] || [];
    const sidCookie = setCookies.find(c => c.startsWith("connect.sid="));
    if (sidCookie) {
      const value = sidCookie.split(";")[0].replace("connect.sid=", "");
      const cookieDomain = getSeerrCookieDomain();
      const cookieOpts = { path: "/", httpOnly: true, sameSite: "lax", secure: true };
      if (cookieDomain) cookieOpts.domain = cookieDomain;
      res.cookie("connect.sid", decodeURIComponent(value), cookieOpts);
      console.info(`[Seerr SSO] ✅ Cookie rafraîchi pour ${username} (domain=${cookieDomain || "courant"})`);
      return true;
    }
    console.warn(`[Seerr SSO] ⚠️ Seerr n'a pas retourné de connect.sid pour ${username}`);
    return false;
  } catch (e) {
    console.warn(`[Seerr SSO] Erreur pour ${username}:`, e.message);
    return false;
  }
}

const seerrPublicUrl = (process.env.SEERR_PUBLIC_URL || "").replace(/\/$/, "");

router.get("/seerr", requireAuth, async (req, res) => {
  if (!seerrPublicUrl) {
    return res.status(503).send(`
      <html><body style="background:#0f1117;color:#e2e8f0;font-family:sans-serif;
        display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
          <div style="font-size:3rem"></div>
          <h2>SEERR_PUBLIC_URL non configuré</h2>
          <p style="color:#94a3b8">Ajoutez cette variable d'env dans votre docker-compose.yml</p>
          <code style="color:#64748b">SEERR_PUBLIC_URL: "https://seerr.votredomaine.com"</code>
        </div>
      </body></html>
    `);
  }

  // Rafraîchir le cookie Seerr à chaque visite — gère les cas :
  //  - premier passage après un redémarrage serveur
  //  - session Seerr expirée sans que la session portail soit expirée
  const plexToken = req.session.plexToken;
  const username  = req.session.user?.username || req.session.user?.email || "inconnu";
  await grabSeerrCookie(plexToken, res, username);

  // Rendu sans layout (page standalone full-screen)
  res.render("seerr/index", { layout: false, seerrPublicUrl });
});

module.exports = router;
