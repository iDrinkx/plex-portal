const cron = require('node-cron');
const fetch = require('node-fetch');
const log = require('./logger');
const { UserAchievementQueries, UserQueries } = require('./database');
const { ACHIEVEMENTS } = require('./achievements');
const { XP_SYSTEM } = require('./xp-system');
const { getAllUserStatsFromTautulli, isTautulliReady } = require('./tautulli-direct');

const logCR = log.create('[Classement-Refresh]');

let classementCache = {
  data: { byHours: [], byLevel: [] },
  timestamp: null,
  lastRefresh: null
};

let lastValidCache = null; // Cache de secours en cas de corruption
let corruptionCount = 0;    // Compteur de corruptions détectées

/**
 * 🔍 Valide les données calculées pour détecter les corruptions
 */
function validateCacheData(users, stats) {
  const issues = [];

  // ⚠️ NOTE: joinedAt manquant est OK grâce au fallback intelligent (30/60/120 jours)
  // Donc on ne le compte PAS comme un problème
  // On ne vérifie que si les données CALCULÉES sont cohérentes

  // Vérifier 2: Trop d'utilisateurs sans photos Plex
  const noPhotoCount = users.filter(u => !u.thumb).length;
  if (noPhotoCount > users.length * 0.5) {
    issues.push(`⚠️ ${noPhotoCount}/${users.length} users sans photo (${Math.round(noPhotoCount/users.length*100)}%)`);
  }

  // Vérifier 3: Vérifier la cohérence level/XP pour top users
  const topUsers = users.slice(0, 3);
  topUsers.forEach(user => {
    const expectedLevel = XP_SYSTEM.getLevel(user.totalXp);
    if (expectedLevel !== user.level) {
      issues.push(`⚠️ ${user.username}: level incohérent (level=${user.level}, XP=${user.totalXp} → level ${expectedLevel})`);
    }
  });

  // Vérifier 4: Comparaison avec cache précédent
  if (lastValidCache && lastValidCache.data.byLevel.length > 0) {
    const topUserPrev = lastValidCache.data.byLevel[0];
    const topUserNow = users.find(u => u.username === topUserPrev.username);

    if (topUserNow && topUserNow.level < topUserPrev.level - 5) {
      issues.push(`⚠️ Niveau du top user a baissé drastiquement (${topUserPrev.level} → ${topUserNow.level})`);
    }
  }

  // Vérifier 5: Au moins 1 user avec photo (si Plex est configuré)
  const hasPlexToken = process.env.PLEX_TOKEN && process.env.PLEX_TOKEN.length > 0;
  if (hasPlexToken && noPhotoCount === users.length) {
    issues.push(`⚠️ Aucune photo Plex trouvée (Plex API probablement inaccessible)`);
  }

  return issues;
}

/**
 * Pré-calcule et cache les données du classement
 */
async function refreshClassementCache() {
  try {
    logCR.debug('🔄 Refresh classement en cours...');
    const startTime = Date.now();

    if (!isTautulliReady()) {
      logCR.warn('Tautulli pas prêt, skip refresh');
      return;
    }

    const tautulliStats = getAllUserStatsFromTautulli();
    if (!tautulliStats || tautulliStats.length === 0) {
      logCR.warn('Aucune stats Tautulli trouvées');
      return;
    }

    // 🔑 FILTRE IMPORTANT: Uniquement les users Wizarr
    // Récupérer les users autorisés depuis la DB locale (Wizarr)
    const wizarrUsers = UserQueries.getAll() || [];
    const wizarrUsernames = new Set(wizarrUsers.map(u => u.username));

    // Filtrer les stats Tautulli pour ne garder que les users Wizarr
    const filteredStats = tautulliStats.filter(stat => wizarrUsernames.has(stat.username));

    if (filteredStats.length === 0) {
      logCR.warn('⚠️ Aucun user Tautulli trouvé dans Wizarr');
      return;
    }

    logCR.debug(`✅ Filtrage: ${tautulliStats.length} users Tautulli → ${filteredStats.length} users Wizarr`);
    const statsToUse = filteredStats;

    // 📸 Récupérer les thumbs Plex (photos de profil)
    const plexToken = process.env.PLEX_TOKEN || '';
    const thumbMap = {};
    let thumbsFetched = 0;

    // Stratégie 1: API v2 (pour le owner uniquement)
    try {
      const ownerResp = await fetch('https://plex.tv/api/v2/user', {
        headers: { 'X-Plex-Token': plexToken, 'Accept': 'application/json' },
        timeout: 8000
      });
      if (ownerResp.ok) {
        const od = await ownerResp.json();
        if (od.username && od.thumb) {
          thumbMap[od.username.toLowerCase()] = od.thumb;
          thumbsFetched++;
        }
      }
    } catch (err) {
      logCR.debug(`⚠️  Plex API v2 failed: ${err.message}`);
    }

    // Stratégie 2: API XML (pour tous les users partagés)
    try {
      const xmlResp = await fetch('https://plex.tv/api/users', {
        headers: { 'X-Plex-Token': plexToken, 'Accept': 'application/xml' },
        timeout: 10000  // Augmenté pour éviter timeout
      });
      if (xmlResp.ok) {
        const xml = await xmlResp.text();
        // Parser amélioré pour les éléments User du XML Plex
        const userMatches = xml.match(/<User[^>]*>/g) || [];

        userMatches.forEach(tag => {
          // Extraire username et thumb
          const usernameMatch = tag.match(/username="([^"]*)"/i) || tag.match(/title="([^"]*)"/i);
          const thumbMatch = tag.match(/thumb="([^"]*)"/i) || tag.match(/avatar="([^"]*)"/i);

          if (usernameMatch && usernameMatch[1]) {
            const name = usernameMatch[1].toLowerCase();
            if (thumbMatch && thumbMatch[1]) {
              thumbMap[name] = thumbMatch[1];
              thumbsFetched++;
            }
          }
        });
      }
    } catch (err) {
      logCR.debug(`⚠️  Plex API XML failed: ${err.message}`);
    }

    logCR.debug(`📸 Fetched ${thumbsFetched} avatars from Plex`);

    // Pré-calculer les données XP pour tous les utilisateurs
    const XP_M = { HOURS: 10, ANCIENNETE: 1.5 };
    const now = Date.now();
    const allAchievements = ACHIEVEMENTS.getAll();
    const achievementXpMap = Object.fromEntries(allAchievements.map(a => [a.id, a.xp || 0]));

    const users = statsToUse.map(stats => {
      const key = (stats.username || '').toLowerCase();
      const dbUser = UserQueries.getByUsername(stats.username) || null;

      let badgeCount = 0;
      let achievementsXp = 0;
      if (dbUser) {
        try {
          const unlockedMap = UserAchievementQueries.getForUser(dbUser.id);
          badgeCount = Object.keys(unlockedMap).length;
          achievementsXp = Object.keys(unlockedMap).reduce((sum, id) => sum + (achievementXpMap[id] || 0), 0);
        } catch (err) {
          logCR.error(`Error getting achievements for ${key}: ${err.message}`);
        }
      }

      // 🔍 Calcul COHÉRENT de daysJoined (identique au profil pour consistance)
      let daysJoined = 0;

      // Essayer d'abord joinedAt de la DB (format timestamp ou date)
      if (dbUser && dbUser.joinedAt) {
        try {
          const ts = Number(dbUser.joinedAt);
          // Si c'est un timestamp Unix en secondes (< 1e13) ou millisecondes (> 1e13)
          const ms = !isNaN(ts) && ts > 1e8 ? (ts < 1e13 ? ts * 1000 : ts) : new Date(dbUser.joinedAt).getTime();
          if (!isNaN(ms)) {
            daysJoined = Math.max(0, Math.floor((now - ms) / 86400000));
          }
        } catch (_) {}
      }

      // ⚠️ Fallback intelligent si daysJoined est toujours 0 (joinedAt manquant ou invalide)
      if (daysJoined === 0) {
        // Assumer que l'utilisateur a rejoint récemment, basé sur son activité
        // Cette formule est une approximation conservative
        daysJoined = 30; // Minimum: 30 jours
        if (stats.totalHours > 100) daysJoined = 60;   // Si actif, probable qu'il est plus ancien
        if (stats.totalHours > 500) daysJoined = 120;  // Si très actif, bien plus ancien
      }

      const totalHours = stats.totalHours || 0;
      const totalXp = Math.round(totalHours * XP_M.HOURS) + achievementsXp + Math.round(daysJoined * XP_M.ANCIENNETE);
      const level = XP_SYSTEM.getLevel(totalXp);
      const rank = XP_SYSTEM.getRankByLevel(level);
      const thumb = thumbMap[key] || null;

      return {
        username: stats.username,
        thumb,
        totalHours,
        totalXp,
        level,
        rank: { name: rank.name, icon: rank.icon, color: rank.color, bgColor: rank.bgColor, borderColor: rank.borderColor },
        badgeCount
      };
    });

    const byHours = [...users].sort((a, b) => b.totalHours - a.totalHours);
    const byLevel = [...users].sort((a, b) => b.level - a.level || b.totalXp - a.totalXp);

    // 🔍 Valider les données avant de les mettre en cache
    const issues = validateCacheData(users, statsToUse);

    if (issues.length > 0) {
      logCR.warn('⚠️ Problèmes détectés dans les données calculées:');
      issues.forEach(issue => logCR.warn('   ' + issue));
      corruptionCount++;

      // ⚠️ Stratégie agressive: si problèmes critiques, rejeter les données
      // NOTE: 'sans joinedAt' n'est PAS critique grâce au fallback intelligent
      const hasCriticalIssue = issues.some(i =>
        i.includes('incohérent') ||
        i.includes('inaccessible')
      );

      if (hasCriticalIssue) {
        logCR.warn('🚨 Problème CRITIQUE détecté - rejet des données');
        if (lastValidCache && lastValidCache.data.byLevel.length > 0) {
          logCR.warn('   🔄 Utilisation du cache précédent valide');
          classementCache = {
            ...lastValidCache,
            timestamp: Date.now(),
            lastRefresh: new Date().toISOString()
          };
          const duration = Date.now() - startTime;
          logCR.info(`✅ Cache restauré en ${duration}ms`);
          return;
        } else {
          logCR.warn('   ⚠️  Pas de cache précédent - attente prochain calcul');
          return;
        }
      }

      // Si corruption répétée même pour petits problèmes (2+ fois), utiliser cache précédent
      if (corruptionCount >= 2 && lastValidCache) {
        logCR.warn(`🔄 Corruption répétée (${corruptionCount}x), utilisation du cache précédent`);
        classementCache = {
          ...lastValidCache,
          timestamp: Date.now(),
          lastRefresh: new Date().toISOString()
        };
        const duration = Date.now() - startTime;
        logCR.info(`✅ Cache restauré en ${duration}ms`);
        return;
      }
    } else {
      corruptionCount = 0; // Réinitialiser si OK
    }

    // Mettre en cache avec timestamp
    const newCache = {
      data: { byHours, byLevel },
      timestamp: Date.now(),
      lastRefresh: new Date().toISOString()
    };

    classementCache = newCache;
    lastValidCache = { data: { byHours: [...byHours], byLevel: [...byLevel] } }; // Sauvegarder comme backup

    const duration = Date.now() - startTime;
    logCR.debug(`✅ Classement refreshé en ${duration}ms (${users.length} users)`);
  } catch (err) {
    logCR.error(`Error refreshing classement: ${err.message}`);
  }
}

/**
 * 🔄 Force une réinitialisation complète du cache
 * Utile pour debug ou réparation manuelle
 */
async function resetClassementCache() {
  logCR.warn('🔄 Réinitialisation forcée du cache classement...');
  classementCache = {
    data: { byHours: [], byLevel: [] },
    timestamp: null,
    lastRefresh: null
  };
  lastValidCache = null;
  corruptionCount = 0;

  // Forcer un recalcul immédiat
  await refreshClassementCache();
  logCR.info('✅ Cache réinitialisé et recalculé');
}

/**
 * Retourne le cache du classement
 */
function getClassementCache() {
  return classementCache;
}

/**
 * 🔧 Vérifie et répare le cache au démarrage si nécessaire
 * Auto-réparation complète sans intervention manuelle
 */
function healthCheckAndRepair() {
  try {
    logCR.debug('🔧 Vérification intégrité au démarrage...');

    const allUsers = UserQueries.getAll();
    if (!allUsers || allUsers.length === 0) {
      logCR.debug('✅ Aucun utilisateur en DB, vérification OK');
      return;
    }

    const usersWithoutJoinedAt = allUsers.filter(u => !u.joinedAt).length;
    const percentMissing = (usersWithoutJoinedAt / allUsers.length) * 100;

    // ✅ Si > 30% sans joinedAt → RESET CACHE pour recalcul avec fallback
    // Le fallback dans le cron va utiliser des valeurs intelligentes (30/60/120 jours)
    if (percentMissing > 30) {
      logCR.warn(`⚠️  ${percentMissing.toFixed(1)}% des users sans joinedAt`);
      logCR.warn('   🔧 Réinitialisation du cache pour recalcul automatique');
      logCR.warn('   💡 Fallback intelligent sera utilisé (30/60/120 jours selon heures)');

      // Réinitialiser complètement le cache
      classementCache = {
        data: { byHours: [], byLevel: [] },
        timestamp: null,
        lastRefresh: null
      };
      lastValidCache = null;
      corruptionCount = 0;

      logCR.info('✅ Cache réinitialisé - recalcul immédiat au prochain refresh');
      return;
    }

    logCR.info('✅ Vérification intégrité OK - données cohérentes');
  } catch (err) {
    logCR.warn('⚠️  Erreur lors de la vérification:', err.message);
  }
}

/**
 * Démarre le cron job de refresh (toutes les 5 minutes)
 */
async function startClassementRefreshJob() {
  // Vérifier intégrité au démarrage
  healthCheckAndRepair();

  // Refresh immédiat au démarrage (SYNCHRONE pour éviter une réponse vide)
  await refreshClassementCache();

  // Cron: toutes les 5 minutes
  cron.schedule('*/5 * * * *', () => {
    refreshClassementCache();
  });

  // Nettoyage mensuel de maintenance: réinitialiser le compteur de corruption
  cron.schedule('0 0 1 * *', () => {
    logCR.debug('🧹 Réinitialisation mensuelle du compteur de corruption');
    corruptionCount = 0;
  });

  logCR.info('✅ Cron job classement démarré (toutes les 5 minutes)');
}

module.exports = {
  startClassementRefreshJob,
  getClassementCache,
  refreshClassementCache,
  resetClassementCache,
  healthCheckAndRepair
};
