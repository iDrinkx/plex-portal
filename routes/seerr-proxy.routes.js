const express = require("express");
const fetch = require("node-fetch");
const { createProxyMiddleware, responseInterceptor } = require("http-proxy-middleware");
const log = require("../utils/logger");
const { getConfigValue } = require("../utils/config");

const router = express.Router();
const logSeerr = log.create("[Seerr Proxy]");

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect((req.basePath || "") + "/");
  }
  next();
}

function getSeerrUrl() {
  return String(getConfigValue("SEERR_URL", "") || "").trim().replace(/\/$/, "");
}

function getSeerrCookieDomain() {
  const publicUrl = String(getConfigValue("SEERR_PUBLIC_URL", "") || "").trim();
  if (!publicUrl) return null;
  try {
    const hostname = new URL(publicUrl).hostname;
    const parts = hostname.split(".");
    if (parts.length >= 2) return "." + parts.slice(-2).join(".");
  } catch (_) {}
  return null;
}

function getSeerrCookieOptions() {
  const cookieOpts = {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true"
  };
  const cookieDomain = getSeerrCookieDomain();
  if (cookieDomain) cookieOpts.domain = cookieDomain;
  return cookieOpts;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasCookie(req, name) {
  const cookieHeader = String(req.headers?.cookie || "");
  return new RegExp(`(?:^|;\\s*)${escapeRegExp(name)}=`).test(cookieHeader);
}

function appendCookieHeader(existingCookieHeader, name, value) {
  const pair = `${name}=${value}`;
  return existingCookieHeader ? `${existingCookieHeader}; ${pair}` : pair;
}

async function fetchSeerrSessionCookie(authToken, username) {
  const seerrUrl = getSeerrUrl();
  if (!seerrUrl) {
    logSeerr.warn("SEERR_URL non configure");
    return null;
  }
  if (!authToken) {
    logSeerr.warn(`Token Plex absent pour ${username}`);
    return null;
  }

  try {
    const response = await fetch(`${seerrUrl}/api/v1/auth/plex`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ authToken })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logSeerr.warn(`SSO Seerr HTTP ${response.status} pour ${username} - ${body.slice(0, 120)}`);
      return null;
    }

    const setCookies = response.headers.raw()["set-cookie"] || [];
    const sidCookie = setCookies.find(cookie => cookie.startsWith("connect.sid="));
    if (!sidCookie) {
      logSeerr.warn(`connect.sid absent pour ${username}`);
      return null;
    }

    const rawValue = sidCookie.split(";")[0].replace("connect.sid=", "");
    return rawValue || null;
  } catch (error) {
    logSeerr.warn(`Erreur SSO Seerr pour ${username}: ${error.message}`);
    return null;
  }
}

async function ensureSeerrSession(req, res, next) {
  if (hasCookie(req, "connect.sid")) return next();

  const authToken = req.session?.plexToken;
  const username = req.session?.user?.username || req.session?.user?.email || "inconnu";
  const rawCookieValue = await fetchSeerrSessionCookie(authToken, username);

  if (!rawCookieValue) return next();

  req.headers.cookie = appendCookieHeader(req.headers.cookie, "connect.sid", rawCookieValue);

  try {
    res.cookie("connect.sid", decodeURIComponent(rawCookieValue), getSeerrCookieOptions());
  } catch (_) {
    res.cookie("connect.sid", rawCookieValue, getSeerrCookieOptions());
  }

  return next();
}

function buildProxyPrefix(req) {
  return `${req.basePath || ""}/seerr`;
}

function rewriteHtmlForProxy(htmlBuffer, req) {
  const html = htmlBuffer.toString("utf8");
  const proxyPrefix = buildProxyPrefix(req);
  const proxyPrefixEscaped = proxyPrefix.replace(/"/g, "&quot;");
  const baseHref = `${proxyPrefix}/`;
  const clientPatch = `
<base href="${baseHref}">
<script>
(() => {
  const prefix = ${JSON.stringify(proxyPrefix)};
  const normalize = (url) => {
    if (typeof url !== "string") return url;
    if (!url.startsWith("/") || url.startsWith("//") || url.startsWith(prefix + "/")) return url;
    return prefix + url;
  };

  const wrapHistory = (method) => {
    const original = history[method];
    history[method] = function(state, title, url) {
      return original.call(this, state, title, normalize(url));
    };
  };

  wrapHistory("pushState");
  wrapHistory("replaceState");

  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === "string") {
      return originalFetch.call(this, normalize(input), init);
    }
    if (input instanceof Request) {
      return originalFetch.call(this, new Request(normalize(input.url), input), init);
    }
    return originalFetch.call(this, input, init);
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    return originalOpen.call(this, method, normalize(url), ...rest);
  };

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest && event.target.closest("a[href^='/']");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith(prefix + "/")) return;
    anchor.setAttribute("href", normalize(href));
  }, true);
})();
</script>`;

  const withHeadPatch = html.includes("</head>")
    ? html.replace("</head>", `${clientPatch}</head>`)
    : `${clientPatch}${html}`;

  return withHeadPatch
    .replace(/(href|src|action)=("|')\/(?!\/)/gi, `$1=$2${proxyPrefixEscaped}/`)
    .replace(/(["'])\/_next\//g, `$1${proxyPrefix}/_next/`)
    .replace(/(["'])\/images\//g, `$1${proxyPrefix}/images/`)
    .replace(/(["'])\/api\/v1\//g, `$1${proxyPrefix}/api/v1/`);
}

const seerrProxy = createProxyMiddleware({
  target: "http://127.0.0.1",
  changeOrigin: true,
  ws: true,
  selfHandleResponse: true,
  router() {
    return getSeerrUrl();
  },
  pathRewrite(path) {
    return path.replace(/^\/seerr/, "") || "/";
  },
  cookieDomainRewrite: { "*": "" },
  onProxyReq(proxyReq, req) {
    proxyReq.setHeader("X-Forwarded-Prefix", buildProxyPrefix(req));
    proxyReq.setHeader("X-Forwarded-Host", req.get("host") || "");
    proxyReq.setHeader("X-Forwarded-Proto", req.protocol || "http");
    proxyReq.setHeader("X-Forwarded-Uri", req.originalUrl || req.url || "/");
  },
  onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
    const proxyPrefix = buildProxyPrefix(req);
    const location = proxyRes.headers.location;
    if (location) {
      const seerrUrl = getSeerrUrl();
      if (location.startsWith("/")) {
        res.setHeader("location", `${proxyPrefix}${location}`);
      } else if (seerrUrl && location.startsWith(seerrUrl)) {
        res.setHeader("location", `${proxyPrefix}${location.slice(seerrUrl.length)}`);
      }
    }

    const contentType = String(proxyRes.headers["content-type"] || "");
    if (contentType.includes("text/html")) {
      return rewriteHtmlForProxy(responseBuffer, req);
    }

    return responseBuffer;
  })
});

router.get("/seerr", requireAuth, ensureSeerrSession, (req, res) => {
  const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  return res.redirect(302, `${req.basePath || ""}/seerr/${query}`);
});

router.use("/seerr", requireAuth, (req, res, next) => {
  if (!getSeerrUrl()) {
    return res.status(503).send("Seerr non configure cote serveur");
  }
  return next();
});

router.use("/seerr", requireAuth, ensureSeerrSession, seerrProxy);

module.exports = router;
