const fetch = require("node-fetch");
const { getPlexJoinDate } = require("./plex");

async function getTracearrStats(username, TRACEARR_URL, TRACEARR_API_KEY, plexUserId, PLEX_URL, PLEX_TOKEN, joinedAtTimestamp = null) {
  try {
    if (!TRACEARR_URL || !TRACEARR_API_KEY) {
      console.log("[TRACEARR] Config manquante");
      return null;
    }

    console.log("[TRACEARR] Recherche utilisateur:", username);

    let page = 1;
    let totalPages = 1;
    let allUserInstances = []; // Tous les instances de l'utilisateur sur tous les serveurs

    while (page <= totalPages) {
      console.log("[TRACEARR] Fetch page", page, "/", totalPages);
      const res = await fetch(
        `${TRACEARR_URL}/api/v1/public/users?page=${page}&pageSize=50`,
        {
          headers: {
            Authorization: `Bearer ${TRACEARR_API_KEY}`,
            Accept: "application/json"
          }
        }
      );

      if (!res.ok) {
        console.log("[TRACEARR] API error status:", res.status);
        return null;
      }

      const json = await res.json();
      if (!json?.data) {
        console.log("[TRACEARR] Pas de data dans réponse");
        return null;
      }

      totalPages = Math.ceil(json.meta.total / json.meta.pageSize);
      console.log("[TRACEARR] Meta - total:", json.meta.total, "pageSize:", json.meta.pageSize, "totalPages:", totalPages);
      console.log("[TRACEARR] Cherchant utilisateur:", username, "parmi", json.data.length, "users");

      // Chercher TOUTES les instances de l'utilisateur (peut-être sur plusieurs serveurs)
      const pageMatches = json.data.filter(
        u => u.username?.toLowerCase() === username.toLowerCase()
      );
      
      console.log("[TRACEARR] Trouvé", pageMatches.length, "instance(s) de", username, "cette page");
      allUserInstances = allUserInstances.concat(pageMatches);

      page++;
    }

    if (allUserInstances.length === 0) {
      console.log("[TRACEARR] Utilisateur non trouvé apres", page - 1, "pages");
      return null;
    }

    console.log("[TRACEARR] Total instances trouvees:", allUserInstances.length);
    console.log("[TRACEARR] FULL USER OBJECTS:", JSON.stringify(allUserInstances, null, 2));

    // Sommer les sessions de tous les serveurs
    const totalSessionCount = allUserInstances.reduce((sum, u) => sum + (u.sessionCount || 0), 0);
    
    // Prendre l'activité la plus récente
    let latestActivity = null;
    for (const u of allUserInstances) {
      if (u.lastActivityAt) {
        if (!latestActivity || new Date(u.lastActivityAt) > new Date(latestActivity)) {
          latestActivity = u.lastActivityAt;
        }
      }
    }

    console.log("[TRACEARR] Total sessionCount (tous serveurs):", totalSessionCount);
    console.log("[TRACEARR] Latest activity:", latestActivity);

    // Prioriser Plex pour une date plus fiable
    let joinedAt = null;
    
    if (plexUserId && PLEX_URL && PLEX_TOKEN) {
      const plexJoinDate = await getPlexJoinDate(plexUserId, PLEX_URL, PLEX_TOKEN, joinedAtTimestamp);
      joinedAt = plexJoinDate ? plexJoinDate.toISOString() : null;
    }
    
    // Fallback sur Tracearr si Plex ne fourni pas de date
    if (!joinedAt) {
      joinedAt = allUserInstances[0].createdAt || null;
    }

    const result = {
      joinedAt,
      lastActivity: latestActivity || null,
      sessionCount: totalSessionCount
    };
    console.log("[TRACEARR] Resultat final:", result);
    return result;

  } catch (err) {
    console.error("[TRACEARR] Erreur:", err.message);
    return null;
  }
}

module.exports = { getTracearrStats };
