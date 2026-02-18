document.addEventListener("DOMContentLoaded", async () => {

  const basePath = window.APP_BASE_PATH || "";
  const SUBSCRIPTION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const STATS_CACHE_DURATION = 30000; // 30 secondes

  // Récupérer l'ID utilisateur depuis le attribut data du body (à ajouter dans le template si absent)
  const userId = document.body.getAttribute("data-user-id") || "guest";

  /* ===============================
     🕒 DATE UTILITIES
  =============================== */

  function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    if (diffYear > 0) return `il y a ${diffYear} an${diffYear > 1 ? 's' : ''}`;
    if (diffMonth > 0) return `il y a ${diffMonth} mois`;
    if (diffWeek > 0) return `il y a ${diffWeek} semaine${diffWeek > 1 ? 's' : ''}`;
    if (diffDay > 0) return `il y a ${diffDay} jour${diffDay > 1 ? 's' : ''}`;
    if (diffHour > 0) return `il y a ${diffHour}h`;
    if (diffMin > 0) return `il y a ${diffMin}min`;
    return 'À l\'instant';
  }

  window.formatRelativeTime = formatRelativeTime;

  /* ===============================
     💾 CACHE UTILITIES
  =============================== */

  const cacheManager = {
    get(key, duration = STATS_CACHE_DURATION) {
      const cacheKey = `${key}:${userId}`;
      const cached = sessionStorage.getItem(cacheKey);
      const time = sessionStorage.getItem(`${cacheKey}:time`);
      const now = Date.now();

      if (cached && time && now - parseInt(time) < duration) {
        return JSON.parse(cached);
      }
      
      sessionStorage.removeItem(cacheKey);
      sessionStorage.removeItem(`${cacheKey}:time`);
      return null;
    },

    set(key, data) {
      const cacheKey = `${key}:${userId}`;
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
      sessionStorage.setItem(`${cacheKey}:time`, Date.now());
    },

    invalidate(key) {
      const cacheKey = `${key}:${userId}`;
      sessionStorage.removeItem(cacheKey);
      sessionStorage.removeItem(`${cacheKey}:time`);
    },

    invalidateAll() {
      ["subscriptionCache", "statsCache", "overseerrCache"].forEach(key => this.invalidate(key));
    }
  };

  // Expose pour utilisation depuis le HTML si besoin
  window.cacheManager = cacheManager;

  /* ===============================
     📅 SUBSCRIPTION
  =============================== */

  async function loadSubscription() {
    const statusEl = document.getElementById("subscriptionStatus");
    const contentEl = document.getElementById("subscriptionContent");

    try {
      // Vérifier cache local (5 minutes - moins fréquent que stats)
      let sub = cacheManager.get("subscriptionCache", SUBSCRIPTION_CACHE_DURATION);

      if (!sub) {
        const res = await fetch(basePath + "/api/subscription");
        if (!res.ok) throw new Error("API error");
        sub = await res.json();
        cacheManager.set("subscriptionCache", sub);
      }

      statusEl.className = "status-mini " + sub.status;
      statusEl.textContent = sub.status || "Indispo";
      
      // Afficher "X jours restants" ou "Accès illimité"
      const displayText = sub.daysLeft ? `${sub.daysLeft} jours restants` : "Accès illimité";
      contentEl.innerHTML = `<p>${displayText}</p>`;

    } catch (err) {
      console.error("Subscription load error:", err);
      statusEl.textContent = "Erreur";
    }
  }

  /* =====================================
     📊 STATS (Tracearr + Overseerr)
  ===================================== */

  async function loadStats() {
    const statusEl = document.getElementById("statsStatus");
    const contentEl = document.getElementById("statsContent");

    try {
      // Charger Tracearr stats
      let tracearrData = cacheManager.get("statsCache", STATS_CACHE_DURATION);
      if (!tracearrData) {
        const res = await fetch(basePath + "/api/stats", {
          headers: { "Accept": "application/json" }
        });
        if (!res.ok) throw new Error("stats_api_error");
        tracearrData = await res.json();
        cacheManager.set("statsCache", tracearrData);
      }

      // Charger Overseerr stats
      let overseerrData = cacheManager.get("overseerrCache", STATS_CACHE_DURATION);
      if (!overseerrData) {
        const res = await fetch(basePath + "/api/overseerr", {
          headers: { "Accept": "application/json" }
        });
        if (!res.ok) throw new Error("overseerr_api_error");
        overseerrData = await res.json();
        cacheManager.set("overseerrCache", overseerrData);
      }

      // Vérifier si on a au moins une donnée
      const hasTracearrData = tracearrData && (tracearrData.joinedAt || tracearrData.lastActivity);
      const hasOverseerrData = overseerrData && overseerrData.total > 0;

      if (!hasTracearrData && !hasOverseerrData) {
        statusEl.className = "status-mini loading";
        statusEl.textContent = "Indispo";
        contentEl.innerHTML = `<p class="subscription-loading">Données indisponibles.</p>`;
        return;
      }

      statusEl.className = "status-mini active";
      statusEl.textContent = "OK";

      let html = "";

      // Afficher derniere activité Tracearr en format relatif
      if (hasTracearrData && tracearrData.lastActivity) {
        const last = formatRelativeTime(tracearrData.lastActivity);
        html += `<p style="font-size:14px; margin-bottom:6px;">🕒 Dernière activité : <strong>${last}</strong></p>`;
      }

      // Afficher nombre de demandes Overseerr
      if (hasOverseerrData) {
        html += `<p style="color:#bbb; font-size:13px;">🎬 Demandes : ${overseerrData.total}</p>`;
      }

      contentEl.innerHTML = html;

    } catch (err) {
      console.error("Stats load error:", err);
      statusEl.className = "status-mini expired";
      statusEl.textContent = "Erreur";
      contentEl.innerHTML = `<p class="subscription-expired">Impossible de charger</p>`;
    }
  }

  /* ===============================
     🚀 LOAD ALL DATA
  =============================== */

  await Promise.all([
    loadSubscription(),
    loadStats()
  ]);

});