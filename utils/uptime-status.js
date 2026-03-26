const { getPublicStatusPageSummary: getKumaStatus } = require("./uptime-kuma");
const { getPublicStatusPageSummary: getRobotStatus, DEFAULT_API_BASE_URL } = require("./uptime-robot");

function normalizeProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  if (provider === "robot" || provider === "uptimerobot") return "robot";
  return "kuma";
}

async function getConfiguredStatusSummary({
  provider = "kuma",
  kumaUrl = "",
  kumaUsername = "",
  kumaPassword = "",
  robotApiUrl = "",
  robotApiKey = ""
} = {}) {
  const normalizedProvider = normalizeProvider(provider);

  if (normalizedProvider === "robot") {
    return getRobotStatus({
      apiBaseUrl: robotApiUrl || DEFAULT_API_BASE_URL,
      apiKey: robotApiKey
    });
  }

  return getKumaStatus({
    baseUrl: kumaUrl,
    username: kumaUsername,
    password: kumaPassword
  });
}

module.exports = {
  DEFAULT_API_BASE_URL,
  normalizeProvider,
  getConfiguredStatusSummary
};
