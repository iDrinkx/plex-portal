const crypto = require("crypto");

function hasValidSetupToken(req) {
  const expected = String(process.env.SETUP_TOKEN || "");
  const provided = String(req.get("X-Setup-Token") || "");

  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function requireSetupToken(req, res, next) {
  if (hasValidSetupToken(req)) return next();
  return res.status(403).json({ error: "Setup access denied" });
}

module.exports = { hasValidSetupToken, requireSetupToken };
