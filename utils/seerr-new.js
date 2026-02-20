const fetch = require("node-fetch");

/**
 * Cherche un utilisateur Seerr par email
 * @param {string} email - Email à chercher
 * @param {string} SEERR_URL - URL de base d'Seerr
 * @param {string} SEERR_API_KEY - Clé API Seerr
 * @returns {Promise<Object|null>} Utilisateur trouvé ou null
 */
async function findSeerrUserByEmail(email, SEERR_URL, SEERR_API_KEY) {
  try {
    if (!email || !SEERR_URL || !SEERR_API_KEY) {
      return null;
    }

    console.debug(`[Seerr] Searching for user with email: ${email}`);

    // Récupérer tous les utilisateurs Seerr
    const url = `${SEERR_URL}/api/v1/user`;
    console.debug(`[Seerr] Fetching users from: ${url}`);

    const res = await fetch(url, {
      headers: {
        "X-API-Key": SEERR_API_KEY,
        "Accept": "application/json"
      }
    });

    console.debug(`[Seerr] Response status: ${res.status}`);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Seerr] API error ${res.status}: ${errorText.substring(0, 200)}`);
      return null;
    }

    const json = await res.json();

    // La réponse peut être un array ou un object avec .results ou .data
    let allUsers = [];
    
    if (Array.isArray(json)) {
      allUsers = json;
    } else if (json.results && Array.isArray(json.results)) {
      allUsers = json.results;
    } else if (json.data && Array.isArray(json.data)) {
      allUsers = json.data;
    } else {
      console.warn(`[Seerr] Unexpected response format. Keys: ${Object.keys(json).join(", ")}`);
      return null;
    }

    console.debug(`[Seerr] Found ${allUsers.length} users total`);

    // Chercher l'utilisateur avec cet email
    const found = allUsers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());

    if (found) {
      console.log(`[Seerr] ✅ Found user ID ${found.id} for email: ${email}`);
      return found;
    }

    console.warn(`[Seerr] ❌ No user found with email: ${email}`);
    console.warn(`[Seerr] Available users: ${allUsers.map(u => `${u.id}:${u.email}`).join(", ")}`);
    return null;

  } catch (err) {
    console.error("[Seerr] Error searching for user by email:", err.message);
    return null;
  }
}

/**
 * Récupère l'utilisateur courant Seerr via la clé API
 * @param {string} SEERR_URL - URL de base d'Seerr
 * @param {string} SEERR_API_KEY - Clé API Seerr
 * @returns {Promise<Object|null>} Utilisateur courant avec son ID
 */
async function getCurrentSeerrUser(SEERR_URL, SEERR_API_KEY) {
  try {
    if (!SEERR_URL || !SEERR_API_KEY) {
      return null;
    }

    const url = `${SEERR_URL}/api/v1/auth/me`;

    const res = await fetch(url, {
      headers: {
        "X-API-Key": SEERR_API_KEY,
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      console.warn(`[Seerr] Could not get current user: ${res.status}`);
      return null;
    }

    const user = await res.json();
    console.debug(`[Seerr] Current user ID: ${user.id}`);
    return user;

  } catch (err) {
    console.error("[Seerr] Error getting current user:", err.message);
    return null;
  }
}

/**
 * Récupère les statistiques Seerr pour un utilisateur spécifique
 * @param {string} userEmail - Email de l'utilisateur Plex (utilisé pour trouver l'utilisateur Seerr)
 * @param {string} SEERR_URL - URL de base d'Seerr
 * @param {string} SEERR_API_KEY - Clé API Seerr
 * @returns {Promise<Object|null>} Stats avec pending, approved, available, unavailable
 */
async function getSeerrStats(userEmail, SEERR_URL, SEERR_API_KEY) {
  try {
    if (!SEERR_URL || !SEERR_API_KEY) {
      console.warn("Seerr config missing:", { hasUrl: !!SEERR_URL, hasKey: !!SEERR_API_KEY });
      return null;
    }

    if (!userEmail) {
      console.warn("[Seerr] No user email provided");
      return null;
    }

    // Chercher l'utilisateur Seerr par son email Plex
    const seerrUser = await findSeerrUserByEmail(userEmail, SEERR_URL, SEERR_API_KEY);
    
    if (!seerrUser || !seerrUser.id) {
      console.warn(`[Seerr] Could not find Seerr user for email: ${userEmail}`);
      return null;
    }

    const userIdNum = seerrUser.id;
    console.debug(`[Seerr] Fetching requests for Seerr user ID: ${userIdNum}`);

    // Récupérer TOUTES les demandes en paginant
    let allRequests = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${SEERR_URL}/api/v1/user/${userIdNum}/requests?page=${page}&perPage=50`;

      const res = await fetch(url, {
        headers: {
          "X-API-Key": SEERR_API_KEY,
          "Accept": "application/json"
        }
      });

      if (!res.ok) {
        console.error(`[Seerr] API error: ${res.status} for user ID ${userIdNum}`);
        break;
      }

      const json = await res.json();

      if (!json?.results || !Array.isArray(json.results)) {
        console.warn(`[Seerr] No results on page ${page}`);
        break;
      }

      allRequests = allRequests.concat(json.results);
      console.debug(`[Seerr] Page ${page}: ${json.results.length} results (total so far: ${allRequests.length})`);

      // Vérifier s'il y a d'autres pages
      if (!json.pageInfo || page >= json.pageInfo.pages) {
        hasMore = false;
      } else {
        page++;
      }
    }

    console.debug(`[Seerr] Retrieved ${allRequests.length} total requests for user ID ${userIdNum}`);

    // Compter par statut
    let pending = 0;
    let approved = 0;
    let available = 0;
    let unavailable = 0;

    allRequests.forEach(req => {
      // Status: 1=PENDING, 2=APPROVED, 3=DECLINED
      // mediaStatus: 1=UNKNOWN, 2=PENDING, 3=PROCESSING, 4=PARTIALLY_AVAILABLE, 5=AVAILABLE
      if (req.status === 1) {
        pending++;
      } else if (req.status === 2) {
        approved++;
      } else if (req.status === 3) {
        unavailable++;
      }

      // Vérifier si le contenu est disponible
      if (req.media?.status === 5) {
        available++;
      }
    });

    const result = {
      pending,
      approved: approved - available,
      available,
      unavailable,
      total: allRequests.length
    };

    console.debug(`[Seerr] Stats for user ID ${userIdNum}:`, result);

    return result;

  } catch (err) {
    console.error("[Seerr] Error:", err.message);
    return null;
  }
}

/**
 * Récupère les statistiques globales d'Seerr
 * @param {string} SEERR_URL - URL de base d'Seerr
 * @param {string} SEERR_API_KEY - Clé API Seerr
 * @returns {Promise<Object|null>} Stats globales
 */
async function getSeerrGlobalStats(SEERR_URL, SEERR_API_KEY) {
  try {
    if (!SEERR_URL || !SEERR_API_KEY) return null;

    const url = new URL(`${SEERR_URL}/api/v1/request`);
    url.searchParams.set("sort", "updated");
    url.searchParams.set("page", "1");
    url.searchParams.set("perPage", "1");

    const res = await fetch(url.toString(), {
      headers: {
        "X-API-Key": SEERR_API_KEY,
        "Accept": "application/json"
      }
    });

    if (!res.ok) return null;

    const json = await res.json();
    const totalRequests = json.pageInfo?.totalResults || 0;

    return {
      totalRequests,
      pending: 0,
      approved: 0,
      available: 0
    };

  } catch (err) {
    console.error("Seerr global stats error:", err.message);
    return null;
  }
}

module.exports = { getSeerrStats, getSeerrGlobalStats, getCurrentSeerrUser, findSeerrUserByEmail };
