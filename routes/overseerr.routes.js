const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");

/* ===============================
   🔐 AUTH GUARD
=============================== */

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect(req.basePath + "/");
  next();
}

/* ===============================
   🎬 OVERSEERR CONFIG
=============================== */

function getOverseerrConfig() {
  return {
    url: (process.env.OVERSEERR_URL || "").replace(/\/$/, ""),
    apiKey: process.env.OVERSEERR_API_KEY || ""
  };
}

/* ===============================
   🔑 AUTHENTICATE USER → OVERSEERR
   Appelle POST /api/v1/auth/plex avec le token Plex du user
   Stocke le cookie de session Overseerr dans req.session.overseerrCookie
=============================== */

async function ensureOverseerrSession(req) {
  // Si on a déjà un cookie overseerr en session, on l'utilise
  if (req.session.overseerrCookie) {
    return { ok: true, cookie: req.session.overseerrCookie };
  }

  const plexToken = req.session.plexToken;
  if (!plexToken) {
    return { ok: false, error: "No Plex token in session" };
  }

  const { url, apiKey } = getOverseerrConfig();
  if (!url) {
    return { ok: false, error: "OVERSEERR_URL not configured" };
  }

  try {
    const res = await fetch(`${url}/api/v1/auth/plex`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ authToken: plexToken })
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`[Overseerr] Auth plex failed: ${res.status} ${text.substring(0, 200)}`);
      return { ok: false, error: `Overseerr auth failed: ${res.status}` };
    }

    // Récupérer le cookie de session depuis la réponse
    const setCookie = res.headers.raw()["set-cookie"];
    let sessionCookie = null;

    if (setCookie && setCookie.length > 0) {
      // Prendre uniquement la partie "connect.sid=..." (sans les flags HttpOnly, etc.)
      sessionCookie = setCookie
        .map(c => c.split(";")[0])
        .join("; ");
    }

    const userData = await res.json();

    if (sessionCookie) {
      req.session.overseerrCookie = sessionCookie;
      req.session.overseerrUser = userData;
      console.log(`[Overseerr] ✅ Session créée pour ${userData.email || userData.plexUsername}`);
      return { ok: true, cookie: sessionCookie, user: userData };
    }

    // Fallback: si pas de cookie, utiliser le token d'API en tant que backup
    console.warn("[Overseerr] ⚠️  Pas de cookie de session dans la réponse, fallback API key");
    return { ok: false, error: "No session cookie from Overseerr" };

  } catch (err) {
    console.error("[Overseerr] Erreur auth:", err.message);
    return { ok: false, error: err.message };
  }
}

/* ===============================
   🔄 PROXY HELPER
   Forward une requête vers Overseerr en ajoutant la session user
=============================== */

async function proxyOverseerr(req, res, path, options = {}) {
  const { url, apiKey } = getOverseerrConfig();
  if (!url) {
    return res.status(503).json({ error: "OVERSEERR_URL not configured" });
  }

  // S'assurer qu'on a une session Overseerr
  const authResult = await ensureOverseerrSession(req);

  // Construire les headers
  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json"
  };

  if (authResult.ok && authResult.cookie) {
    // Auth par cookie de session (par user)
    headers["Cookie"] = authResult.cookie;
  } else {
    // Fallback: admin API key (pour les appels qui ne nécessitent pas l'identité user)
    headers["X-Api-Key"] = apiKey;
  }

  // Construire l'URL avec les query params
  const queryStr = Object.keys(req.query).length
    ? "?" + new URLSearchParams(req.query).toString()
    : "";

  const targetUrl = `${url}${path}${queryStr}`;

  try {
    const fetchOptions = {
      method: options.method || req.method,
      headers
    };

    if (options.body || (req.method !== "GET" && req.method !== "HEAD" && req.body)) {
      fetchOptions.body = JSON.stringify(options.body || req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (err) {
    console.error(`[Overseerr Proxy] Erreur pour ${targetUrl}:`, err.message);
    return res.status(500).json({ error: "Proxy error", details: err.message });
  }
}

/* ===============================
   📄 PAGE PRINCIPALE
=============================== */

router.get("/overseerr", requireAuth, async (req, res) => {
  // Tenter l'auth Overseerr au chargement de la page
  await ensureOverseerrSession(req);
  res.render("overseerr/index", {
    user: req.session.user,
    overseerrUser: req.session.overseerrUser || null,
    basePath: req.basePath,
    layout: false   // Page complète, pas de layout plex-portal
  });
});

/* ===============================
   🔄 API: RECONNEXION OVERSEERR
=============================== */

router.post("/api/overseerr/connect", requireAuth, async (req, res) => {
  // Forcer une nouvelle authentification (invalider l'ancienne session)
  delete req.session.overseerrCookie;
  delete req.session.overseerrUser;

  const result = await ensureOverseerrSession(req);
  if (result.ok) {
    res.json({ ok: true, user: req.session.overseerrUser });
  } else {
    res.status(401).json({ ok: false, error: result.error });
  }
});

/* ===============================
   🔄 API PROXY: TOUTES LES ROUTES OVERSEERR
   GET  /api/overseerr/proxy/*  → GET  <OVERSEERR_URL>/api/v1/*
   POST /api/overseerr/proxy/*  → POST <OVERSEERR_URL>/api/v1/*
   DEL  /api/overseerr/proxy/*  → DEL  <OVERSEERR_URL>/api/v1/*
=============================== */

router.get("/api/overseerr/proxy/*", requireAuth, async (req, res) => {
  const subPath = "/api/v1/" + req.params[0];
  await proxyOverseerr(req, res, subPath);
});

router.post("/api/overseerr/proxy/*", requireAuth, async (req, res) => {
  const subPath = "/api/v1/" + req.params[0];
  await proxyOverseerr(req, res, subPath, { method: "POST" });
});

router.put("/api/overseerr/proxy/*", requireAuth, async (req, res) => {
  const subPath = "/api/v1/" + req.params[0];
  await proxyOverseerr(req, res, subPath, { method: "PUT" });
});

router.delete("/api/overseerr/proxy/*", requireAuth, async (req, res) => {
  const subPath = "/api/v1/" + req.params[0];
  await proxyOverseerr(req, res, subPath, { method: "DELETE" });
});

/* ===============================
   🖼️  PROXY IMAGE TMDB (pour éviter CORS)
   GET /api/overseerr/image?url=<tmdb-image-url>
=============================== */

router.get("/api/overseerr/image", requireAuth, async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl || !imageUrl.startsWith("https://image.tmdb.org/")) {
    return res.status(400).send("Invalid image URL");
  }
  try {
    const imgRes = await fetch(imageUrl);
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400");
    imgRes.body.pipe(res);
  } catch (err) {
    res.status(500).send("Image fetch error");
  }
});

module.exports = router;
