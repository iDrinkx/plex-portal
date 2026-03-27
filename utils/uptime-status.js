const { getPublicStatusPageSummary: getKumaStatus } = require("./uptime-kuma");
const { getPublicStatusPageSummary: getRobotStatus, DEFAULT_API_BASE_URL } = require("./uptime-robot");

function normalizeProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  if (provider === "robot" || provider === "uptimerobot") return "robot";
  return "kuma";
}

async function withSoftTimeout(promise, timeoutMs = 1500) {
  let timer = null;
  const timeoutPromise = new Promise(resolve => {
    timer = setTimeout(() => resolve(null), Math.max(100, Number(timeoutMs || 0)));
    if (typeof timer?.unref === "function") timer.unref();
  });

  try {
    return await Promise.race([
      Promise.resolve(promise).catch(() => null),
      timeoutPromise
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getConfiguredStatusSummary({
  provider = "kuma",
  kumaUrl = "",
  kumaUsername = "",
  kumaPassword = "",
  robotApiUrl = "",
  robotApiKey = "",
  softTimeoutMs = 0
} = {}) {
  const normalizedProvider = normalizeProvider(provider);
  const request = normalizedProvider === "robot"
    ? getRobotStatus({
      apiBaseUrl: robotApiUrl || DEFAULT_API_BASE_URL,
      apiKey: robotApiKey
    })
    : getKumaStatus({
      baseUrl: kumaUrl,
      username: kumaUsername,
      password: kumaPassword
    });

  if (Number(softTimeoutMs) > 0) {
    return withSoftTimeout(request, softTimeoutMs);
  }

  return request;
}

module.exports = {
  DEFAULT_API_BASE_URL,
  normalizeProvider,
  getConfiguredStatusSummary
};
