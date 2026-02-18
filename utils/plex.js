const fetch = require("node-fetch");

/**
 * Récupère la liste des utilisateurs autorisés du serveur Plex
 * @param {string} PLEX_URL - URL du serveur Plex
 * @param {string} PLEX_TOKEN - Token d'authentification Plex
 * @returns {Promise<Array>} Liste des utilisateurs avec leurs infos
 */
async function getPlexUsers(PLEX_URL, PLEX_TOKEN) {
  try {
    if (!PLEX_URL || !PLEX_TOKEN) {
      console.warn("[Plex] Config missing:", { hasUrl: !!PLEX_URL, hasToken: !!PLEX_TOKEN });
      return [];
    }

    console.debug(`[Plex] Fetching users from: ${PLEX_URL}`);

    const url = `${PLEX_URL}/api/v2/accounts`;
    
    const res = await fetch(url, {
      headers: {
        "X-Plex-Token": PLEX_TOKEN,
        "Accept": "application/json"
      }
    });

    console.debug(`[Plex] Response status: ${res.status}`);

    if (!res.ok) {
      console.error(`[Plex] Failed to get users: ${res.status} ${res.statusText}`);
      const errorText = await res.text();
      console.error(`[Plex] Error body: ${errorText}`);
      return [];
    }

    const json = await res.json();
    
    if (!Array.isArray(json?.data)) {
      console.warn("[Plex] Unexpected response format for users", json);
      return [];
    }

    console.info(`[Plex] ✅ Found ${json.data.length} users on server:`);
    json.data.forEach(u => {
      console.info(`  - ID: ${u.id}, Email: ${u.email}, Username: ${u.username}`);
    });
    
    return json.data;

  } catch (err) {
    console.error("[Plex] Error fetching users:", err.message);
    return [];
  }
}

/**
 * Récupère les infos détaillées d'un utilisateur Plex
 * @param {string|number} plexUserId - ID de l'utilisateur Plex
 * @param {string} PLEX_URL - URL du serveur Plex
 * @param {string} PLEX_TOKEN - Token d'authentification Plex
 * @returns {Promise<Object|null>} Infos utilisateur (ID, email, joinedAt, etc)
 */
async function getPlexUserInfo(plexUserId, PLEX_URL, PLEX_TOKEN) {
  try {
    if (!PLEX_URL || !PLEX_TOKEN || !plexUserId) {
      console.debug("[Plex] Missing config for user info lookup");
      return null;
    }

    console.debug(`[Plex] Looking for user ID ${plexUserId} in server's user list...`);

    // Récupérer tous les users et chercher celui-ci
    const users = await getPlexUsers(PLEX_URL, PLEX_TOKEN);
    
    const userIdNum = parseInt(plexUserId);
    console.debug(`[Plex] Searching through ${users.length} users for ID: ${userIdNum}`);

    const user = users.find(u => u.id === userIdNum);

    if (user) {
      console.debug(`[Plex] ✅ Found user: ID=${user.id}, Email=${user.email}`);
    } else {
      console.warn(`[Plex] ❌ User ID ${userIdNum} not found in list`);
      console.warn(`[Plex] Available user IDs: ${users.map(u => u.id).join(', ')}`);
    }

    return user || null;

  } catch (err) {
    console.error("[Plex] Error fetching user info:", err.message);
    return null;
  }
}

/**
 * Vérifie si un utilisateur Plex est autorisé (dans la whitelist du serveur)
 * @param {string|number} plexUserId - ID de l'utilisateur Plex
 * @param {string} PLEX_URL - URL du serveur Plex
 * @param {string} PLEX_TOKEN - Token d'authentification Plex
 * @returns {Promise<boolean>} True si l'utilisateur est autorisé
 */
async function isUserAuthorized(plexUserId, PLEX_URL, PLEX_TOKEN) {
  try {
    console.info(`\n[Plex Auth] Checking authorization for Plex user ID: ${plexUserId}`);
    console.info(`[Plex Auth] Config - URL: ${PLEX_URL ? '✅ Set' : '❌ Missing'}, Token: ${PLEX_TOKEN ? '✅ Set' : '❌ Missing'}`);

    const user = await getPlexUserInfo(plexUserId, PLEX_URL, PLEX_TOKEN);
    
    if (!user) {
      console.error(`❌ [Plex Auth] User ID ${plexUserId} NOT FOUND on server - UNAUTHORIZED`);
      console.error(`[Plex Auth] This user is not in the Plex server's user list`);
      return false;
    }

    console.info(`✅ [Plex Auth] User ID ${plexUserId} (${user.email}) is authorized`);
    return true;

  } catch (err) {
    console.error("[Plex Auth] Error checking authorization:", err.message);
    return false;
  }
}

/**
 * Récupère la date d'adhésion d'un utilisateur depuis le serveur Plex
 * Récupère les infos au format XML depuis la bibliothèque de l'utilisateur
 * @param {string|number} plexUserId - ID de l'utilisateur Plex
 * @param {string} PLEX_URL - URL du serveur Plex
 * @param {string} PLEX_TOKEN - Token d'authentification Plex
 * @returns {Promise<Date|null>} Date d'adhésion ou null
 */
async function getPlexJoinDate(plexUserId, PLEX_URL, PLEX_TOKEN) {
  try {
    if (!PLEX_URL || !PLEX_TOKEN || !plexUserId) {
      return null;
    }

    // Essayer de récupérer depuis les données de la bibliothèque
    // La seule façon fiable est via l'API /accounts
    const users = await getPlexUsers(PLEX_URL, PLEX_TOKEN);
    const user = users.find(u => u.id === parseInt(plexUserId));

    if (user?.createdAt) {
      const joinDate = new Date(user.createdAt * 1000);
      console.debug(`[Plex] User ${plexUserId} joined on ${joinDate.toISOString()}`);
      return joinDate;
    }

    return null;

  } catch (err) {
    console.error("[Plex] Error fetching join date:", err.message);
    return null;
  }
}

module.exports = {
  getPlexUsers,
  getPlexUserInfo,
  isUserAuthorized,
  getPlexJoinDate
};
