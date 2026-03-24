const { AppSettingQueries } = require("./database");

const SETTING_KEY = "dashboard_layout_order";

function toLayoutId(type, value) {
  return `${type}:${value}`;
}

function getDashboardLayoutOrder() {
  const raw = AppSettingQueries.get(SETTING_KEY, "");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(item => String(item || "").trim()).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

function saveDashboardLayoutOrder(ids = []) {
  const normalized = ids.map(id => String(id || "").trim()).filter(Boolean);
  AppSettingQueries.set(SETTING_KEY, JSON.stringify(normalized));
  return normalized;
}

function buildDefaultLayoutIds({ builtinItems = [], sectionItems = [], customCards = [], htmlBlocks = [] }) {
  const htmlAbove = htmlBlocks
    .filter(block => block && block.position === "above")
    .map(block => toLayoutId("html", block.id));
  const htmlBelow = htmlBlocks
    .filter(block => !block || block.position !== "above")
    .map(block => toLayoutId("html", block.id));
  const sectionsAbove = sectionItems
    .filter(item => item && item.position !== "below")
    .map(item => toLayoutId("section", item.key));
  const sectionsBelow = sectionItems
    .filter(item => item && item.position === "below")
    .map(item => toLayoutId("section", item.key));
  const builtins = builtinItems.map(item => toLayoutId("builtin", item.key));
  const customs = customCards.map(card => toLayoutId("custom", card.id));

  return [
    ...htmlAbove,
    ...sectionsAbove,
    ...builtins,
    ...customs,
    ...sectionsBelow,
    ...htmlBelow
  ];
}

function buildDashboardLayoutItems({
  builtinItems = [],
  sectionItems = [],
  customCards = [],
  htmlBlocks = [],
  t = null
}) {
  const translate = typeof t === "function" ? t : (key => key);
  const items = [];

  builtinItems.forEach(item => {
    items.push({
      id: toLayoutId("builtin", item.key),
      type: "builtin",
      refKey: item.key,
      label: item.label,
      description: item.description,
      enabled: item.enabled !== false,
      category: translate("settings.dashboardLayout.category.builtin")
    });
  });

  sectionItems.forEach(item => {
    items.push({
      id: toLayoutId("section", item.key),
      type: "section",
      refKey: item.key,
      label: item.label,
      description: item.description,
      enabled: item.enabled !== false,
      category: translate("settings.dashboardLayout.category.section")
    });
  });

  customCards.forEach(card => {
    items.push({
      id: toLayoutId("custom", card.id),
      type: "custom",
      refKey: String(card.id),
      label: card.title || card.label || `Carte ${card.id}`,
      description: card.description || card.label || "",
      enabled: true,
      category: translate("settings.dashboardLayout.category.custom")
    });
  });

  htmlBlocks.forEach((block, index) => {
    const preview = String(block?.html || block?.raw || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
    items.push({
      id: toLayoutId("html", block.id || `block-${index + 1}`),
      type: "html",
      refKey: block.id || `block-${index + 1}`,
      label: translate("settings.dashboardLayout.htmlBlockLabel", { index: index + 1 }),
      description: preview || translate("settings.dashboardLayout.htmlBlockEmpty"),
      enabled: true,
      category: translate("settings.dashboardLayout.category.html")
    });
  });

  const byId = new Map(items.map(item => [item.id, item]));
  const savedOrder = getDashboardLayoutOrder();
  const defaultOrder = buildDefaultLayoutIds({ builtinItems, sectionItems, customCards, htmlBlocks });
  const combined = [...savedOrder, ...defaultOrder];
  const seen = new Set();
  const ordered = [];

  combined.forEach(id => {
    if (seen.has(id) || !byId.has(id)) return;
    seen.add(id);
    ordered.push(byId.get(id));
  });

  return ordered;
}

module.exports = {
  buildDashboardLayoutItems,
  getDashboardLayoutOrder,
  saveDashboardLayoutOrder
};
