document.addEventListener("DOMContentLoaded", async () => {

  const basePath = window.APP_BASE_PATH || "";
  const CACHE_DURATION = 30000; // 30 secondes

  /* ===============================
     💾 CACHE UTILITIES
  =============================== */

  const cacheManager = {
    get(key) {
      const cached = sessionStorage.getItem(key);
      const time = sessionStorage.getItem(`${key}:time`);
      const now = Date.now();

      if (cached && time && now - parseInt(time) < CACHE_DURATION) {
        return JSON.parse(cached);
      }
      
      sessionStorage.removeItem(key);
      sessionStorage.removeItem(`${key}:time`);
      return null;
    },

    set(key, data) {
      sessionStorage.setItem(key, JSON.stringify(data));
      sessionStorage.setItem(`${key}:time`, Date.now());
    },

    invalidate(key) {
      sessionStorage.removeItem(key);
      sessionStorage.removeItem(`${key}:time`);
    },

    invalidateAll() {
      ["subscriptionCache", "statsCache"].forEach(key => this.invalidate(key));
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
      // Vérifier cache local (30s)
      let sub = cacheManager.get("subscriptionCache");

      if (!sub) {
        const res = await fetch(basePath + "/api/subscription");
        if (!res.ok) throw new Error("API error");
        sub = await res.json();
        cacheManager.set("subscriptionCache", sub);
      }

      statusEl.className = "status-mini " + sub.status;
      statusEl.textContent = sub.status || "Indispo";
      contentEl.innerHTML = `<p>${sub.daysLeft || "Accès illimité"}</p>`;

    } catch (err) {
      console.error("Subscription load error:", err);
      statusEl.textContent = "Erreur";
    }
  }

  /* =====================================
     📊 STATS (Tracearr)
  ===================================== */

  async function loadStats() {
    const statusEl = document.getElementById("statsStatus");
    const contentEl = document.getElementById("statsContent");

    try {
      // Vérifier cache local (30s)
      let data = cacheManager.get("statsCache");

      if (!data) {
        const res = await fetch(basePath + "/api/stats", {
          headers: { "Accept": "application/json" }
        });

        if (!res.ok) throw new Error("stats_api_error");
        data = await res.json();
        cacheManager.set("statsCache", data);
      }

      if (!data || (!data.joinedAt && !data.lastActivity)) {
        statusEl.className = "status-mini loading";
        statusEl.textContent = "Indispo";
        contentEl.innerHTML = `<p class="subscription-loading">Données indisponibles.</p>`;
        return;
      }

      const joined = data.joinedAt
        ? new Date(data.joinedAt).toLocaleDateString("fr-FR")
        : "Inconnu";

      const last = data.lastActivity
        ? new Date(data.lastActivity).toLocaleString("fr-FR")
        : "Aucune";

      statusEl.className = "status-mini active";
      statusEl.textContent = "OK";

      contentEl.innerHTML = `
        <p style="font-size:14px; margin-bottom:6px;">
          📅 Membre depuis : <strong>${joined}</strong>
        </p>
        <p style="color:#bbb; font-size:13px;">
          🕒 Dernière activité : ${last}
        </p>
      `;

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