const fetch = require("node-fetch");
const { getPlexJoinDate } = require("./plex");

async function getTracearrStats(username, TRACEARR_URL, TRACEARR_API_KEY, plexUserId, PLEX_URL, PLEX_TOKEN, joinedAtTimestamp = null) {
  try {
    if (!TRACEARR_URL || !TRACEARR_API_KEY) return null;

    let page = 1;
    let totalPages = 1;
    let foundUser = null;

    while (page <= totalPages) {
      const res = await fetch(
        `${TRACEARR_URL}/api/v1/public/users?page=${page}&pageSize=50`,
        {
          headers: {
            Authorization: `Bearer ${TRACEARR_API_KEY}`,
            Accept: "application/json"
          }
        }
      );

      if (!res.ok) return null;

      const json = await res.json();
      if (!json?.data) return null;

      totalPages = Math.ceil(json.meta.total / json.meta.pageSize);

      foundUser = json.data.find(
        u => u.username?.toLowerCase() === username.toLowerCase()
      );

      if (foundUser) break;

      page++;
    }

    if (!foundUser) return null;

    // Prioriser Plex pour une date plus fiable
    let joinedAt = null;
    
    if (plexUserId && PLEX_URL && PLEX_TOKEN) {
      const plexJoinDate = await getPlexJoinDate(plexUserId, PLEX_URL, PLEX_TOKEN, joinedAtTimestamp);
      joinedAt = plexJoinDate ? plexJoinDate.toISOString() : null;
    }
    
    // Fallback sur Tracearr si Plex ne fourni pas de date
    if (!joinedAt) {
      joinedAt = foundUser.createdAt || null;
    }

    return {
      joinedAt,
      lastActivity: foundUser.lastActivityAt || null
    };

  } catch (err) {
    return null;
  }
}

async function getTracearrActivity(username, TRACEARR_URL, TRACEARR_API_KEY) {
  try {
    if (!TRACEARR_URL || !TRACEARR_API_KEY) {
      console.log("[Tracearr] Missing URL or API key");
      return null;
    }

    console.log(`[Tracearr] Searching for user: ${username}`);
    let page = 1;
    let totalPages = 1;
    let foundUser = null;

    // Trouver l'utilisateur
    while (page <= totalPages) {
      console.log(`[Tracearr] Fetching users page ${page}/${totalPages}`);
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
        console.log(`[Tracearr] Failed to fetch users: ${res.status} ${res.statusText}`);
        return null;
      }

      const json = await res.json();
      if (!json?.data) {
        console.log("[Tracearr] No data in response");
        return null;
      }

      console.log(`[Tracearr] Got ${json.data.length} users on page ${page}`);
      totalPages = Math.ceil(json.meta.total / json.meta.pageSize);

      foundUser = json.data.find(
        u => u.username?.toLowerCase() === username.toLowerCase()
      );

      if (foundUser) {
        console.log(`[Tracearr] Found user with ID: ${foundUser.id}`);
        break;
      }

      page++;
    }

    if (!foundUser) {
      console.log(`[Tracearr] User ${username} not found`);
      return null;
    }

    // Essayer différents endpoints pour récupérer l'historique d'activité
    const endpoints = [
      `${TRACEARR_URL}/api/v1/public/users/${foundUser.id}`,
      `${TRACEARR_URL}/api/v1/users/${foundUser.id}`,
      `${TRACEARR_URL}/api/v1/public/users/${foundUser.id}/activity?pageSize=100`,
      `${TRACEARR_URL}/api/v1/users/${foundUser.id}/activity?pageSize=100`,
      `${TRACEARR_URL}/api/v1/public/users/${foundUser.id}/history?pageSize=100`,
      `${TRACEARR_URL}/api/v1/activity?userId=${foundUser.id}&pageSize=100`,
      `${TRACEARR_URL}/api/v1/activity?user=${foundUser.id}&pageSize=100`,
      `${TRACEARR_URL}/api/v1/public/activity?user=${foundUser.id}&pageSize=100`
    ];

    let activities = [];
    let foundEndpoint = null;
    let userDetails = null;

    for (const endpoint of endpoints) {
      console.log(`[Tracearr] Trying: ${endpoint.replace(TRACEARR_URL, '')}`);
      try {
        const activityRes = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${TRACEARR_API_KEY}`,
            Accept: "application/json"
          }
        });

        console.log(`[Tracearr] → ${activityRes.status} ${activityRes.statusText}`);

        if (activityRes.ok) {
          const activityData = await activityRes.json();
          
          // Si c'est un appel user/{id}, vérifier si activité est dedans
          if (endpoint.includes('/users/') && !endpoint.includes('/activity')) {
            userDetails = activityData;
            console.log(`[Tracearr] User data keys: ${Object.keys(activityData || {}).join(', ')}`);
            // Chercher la propriété activité
            if (activityData?.activity) {
              activities = Array.isArray(activityData.activity) ? activityData.activity : [activityData.activity];
              foundEndpoint = endpoint;
              console.log(`[Tracearr] ✓ Found activities in user.activity: ${activities.length}`);
              break;
            } else if (activityData?.activities) {
              activities = Array.isArray(activityData.activities) ? activityData.activities : [];
              foundEndpoint = endpoint;
              console.log(`[Tracearr] ✓ Found activities in user.activities: ${activities.length}`);
              break;
            } else if (activityData?.watched) {
              activities = Array.isArray(activityData.watched) ? activityData.watched : [];
              foundEndpoint = endpoint;
              console.log(`[Tracearr] ✓ Found activities in user.watched: ${activities.length}`);
              break;
            }
          } else {
            activities = Array.isArray(activityData) ? activityData : (activityData.data || activityData.activities || []);
            foundEndpoint = endpoint;
            console.log(`[Tracearr] ✓ Found working endpoint! Got ${activities.length} activities`);
            break;
          }
        }
      } catch (err) {
        console.log(`[Tracearr] → Error: ${err.message}`);
      }
    }

    if (!foundEndpoint) {
      console.log(`[Tracearr] ⚠ No activity endpoint found. Returning user info without activities.`);
      console.log(`[Tracearr] 💡 Tip: Check Tracearr API documentation or check /api/v1/public/endpoints`);
      return {
        user: {
          id: foundUser.id,
          username: foundUser.username,
          avatar: foundUser.avatar || null,
          createdAt: foundUser.createdAt,
          lastActivityAt: foundUser.lastActivityAt
        },
        activities: []
      };
    }

    return {
      user: {
        id: foundUser.id,
        username: foundUser.username,
        avatar: foundUser.avatar || null,
        createdAt: foundUser.createdAt,
        lastActivityAt: foundUser.lastActivityAt
      },
      activities: activities || []
    };

  } catch (err) {
    console.log(`[Tracearr] Error: ${err.message}`);
    return null;
  }
}

module.exports = { getTracearrStats, getTracearrActivity };
