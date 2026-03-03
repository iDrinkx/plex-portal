const { AppSettingQueries } = require("./database");

const HTML_KEY = "dashboard_custom_html";

function sanitizeDashboardCustomHtml(input) {
  let html = String(input == null ? "" : input).trim();
  if (!html) return "";

  html = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<(object|embed|applet|meta|base|form)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(object|embed|applet|meta|base|form)\b[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(["'])[\s\S]*?\1/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*([^\s>]+)/gi, "")
    .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, " $1=\"#\"")
    .replace(/\s+srcdoc\s*=\s*(["'])[\s\S]*?\1/gi, "");

  return html;
}

function getDashboardCustomHtmlRaw() {
  return AppSettingQueries.get(HTML_KEY, "") || "";
}

function getDashboardCustomHtml() {
  return sanitizeDashboardCustomHtml(getDashboardCustomHtmlRaw());
}

function saveDashboardCustomHtml(rawHtml) {
  const raw = String(rawHtml == null ? "" : rawHtml);
  if (!raw.trim()) {
    AppSettingQueries.remove(HTML_KEY);
    return { raw: "", sanitized: "" };
  }

  AppSettingQueries.set(HTML_KEY, raw);
  return {
    raw,
    sanitized: sanitizeDashboardCustomHtml(raw)
  };
}

module.exports = {
  sanitizeDashboardCustomHtml,
  getDashboardCustomHtmlRaw,
  getDashboardCustomHtml,
  saveDashboardCustomHtml
};
