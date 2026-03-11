/**
 * Middleware pour détecter et configurer automatiquement
 * le comportement de l'app si elle est derrière un reverse proxy
 */

function reverseProxyMiddleware(req, res, next) {
  // ============================================
  // Détecter les headers du reverse proxy
  // ============================================
  
  // En-têtes envoyés automatiquement par les reverse proxies
  const forwarded = {
    proto: req.headers['x-forwarded-proto'] || req.protocol,
    host: req.headers['x-forwarded-host'] || req.get('host'),
    prefix: req.headers['x-forwarded-prefix'] || '',
    originalUri: req.headers['x-original-uri'] || ''
  };

  // ============================================
  // Déterminer le BASE_PATH
  // ============================================
  
  let basePath = '';

  // 1. D'abord, vérifié env var (override manuel)
  if (process.env.BASE_PATH) {
    basePath = process.env.BASE_PATH;
  }
  // 2. Sinon, utiliser X-Forwarded-Prefix (envoyé par ngx proxy manager, etc)
  else if (forwarded.prefix) {
    basePath = forwarded.prefix;
  }

  // ============================================
  // Construire l'URL publique pour Plex callback
  // ============================================
  
  let appUrl = process.env.APP_URL;

  if (!appUrl) {
    // Reconstruire depuis les headers du reverse proxy
    appUrl = `${forwarded.proto}://${forwarded.host}${basePath}`;
    
    // Exemple result: https://example.com/portall
  }

  // ============================================
  // Stocker dans les locales et le contexte requis
  // ============================================

  // Pour les vues (EJS)
  res.locals.basePath = basePath;
  res.locals.appUrl = appUrl;

  // Pour le code backend (accessible via req)
  req.basePath = basePath;
  req.appUrl = appUrl;
  req.isReverseProxy = !!forwarded.prefix || forwarded.proto !== req.protocol;

  // Debug
  if (process.env.DEBUG) {
    console.log('🔍 Reverse Proxy Detection:');
    console.log(`   basePath: "${basePath}"`);
    console.log(`   appUrl: "${appUrl}"`);
    console.log(`   isReverseProxy: ${req.isReverseProxy}`);
  }

  next();
}

module.exports = reverseProxyMiddleware;
