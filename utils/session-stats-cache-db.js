const db = require('./database');
const log = require('./logger').create('[Cache DB]');

// Tautulli returns lifetime watch stats. Values above 1000h are common for
// long-term users, so only reject invalid or implausibly huge totals.
const MAX_REASONABLE_LIFETIME_HOURS = 100000;

function sanitizeLifetimeHours(value, fieldName, username) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    log.warn(`${fieldName} invalide (${value}) pour ${username} — réinitialisée`);
    return 0;
  }

  if (numericValue > MAX_REASONABLE_LIFETIME_HOURS) {
    log.warn(`${fieldName} aberrante (${numericValue}) pour ${username} — réinitialisée`);
    return 0;
  }

  return Math.round(numericValue * 10) / 10;
}

function normalizeWatchStats(rawWatchStats = {}, username = 'unknown') {
  const normalizedStats = {
    totalHours: sanitizeLifetimeHours(rawWatchStats.totalHours, 'totalHours', username),
    movieHours: sanitizeLifetimeHours(rawWatchStats.movieHours, 'movieHours', username),
    movieCount: Number(rawWatchStats.movieCount || 0),
    episodeHours: sanitizeLifetimeHours(rawWatchStats.episodeHours, 'episodeHours', username),
    episodeCount: Number(rawWatchStats.episodeCount || 0)
  };

  const inferredTotal = Math.round((normalizedStats.movieHours + normalizedStats.episodeHours) * 10) / 10;
  if (normalizedStats.totalHours < inferredTotal) {
    if (normalizedStats.totalHours === 0 && inferredTotal > 0) {
      log.warn(`totalHours reconstruite (${inferredTotal}) pour ${username} depuis movieHours + episodeHours`);
    }
    normalizedStats.totalHours = inferredTotal;
  }

  return normalizedStats;
}

/**
 * Module de cache des stats de session utilisant SQLite
 * Remplace le systeme JSON pour plus de performance et d'historique
 */
class SessionStatsCacheDB {
  /**
   * Reparer les lignes incoherentes de watch_history deja presentes en base.
   */
  static repairInconsistentWatchHistory() {
    try {
      const result = db.WatchHistoryQueries.repairInconsistentTotals();
      if (result?.changes > 0) {
        log.warn(`watch_history repare: ${result.changes} ligne(s) avec totalHours incoherent(s)`);
      }
      return result?.changes || 0;
    } catch (err) {
      log.error('repairInconsistentWatchHistory:', err.message);
      return 0;
    }
  }

  /**
   * Obtenir les stats en cache pour un utilisateur
   */
  static get(username) {
    try {
      const user = db.UserQueries.getByUsername(username);
      if (!user) return null;

      const latest = db.WatchHistoryQueries.getLatestForUser(user.id);
      if (!latest) return null;

      const watchStats = normalizeWatchStats({
        totalHours: latest.totalHours,
        movieHours: latest.movieHours,
        movieCount: latest.movieCount,
        episodeHours: latest.episodeHours,
        episodeCount: latest.episodeCount
      }, username);

      return {
        sessionCount: latest.sessionCount,
        lastSessionTimestamp: latest.lastSessionTimestamp,
        joinedAt: user.joinedAt,
        lastActivity: latest.scannedAt,
        watchStats
      };
    } catch (err) {
      log.error('get:', err.message);
      return null;
    }
  }

  /**
   * Sauvegarder les stats pour un utilisateur
   */
  static set(username, stats) {
    try {
      if (!stats.watchStats) stats.watchStats = {};

      const watchStats = normalizeWatchStats(stats.watchStats, username);

      const user = db.UserQueries.upsert(
        username,
        stats.plexId || null,
        stats.email || null,
        stats.joinedAt || null
      );

      db.WatchHistoryQueries.insert(user.id, new Date().toISOString(), {
        movieCount: stats.watchStats?.movieCount || 0,
        movieHours: watchStats.movieHours,
        episodeCount: stats.watchStats?.episodeCount || 0,
        episodeHours: watchStats.episodeHours,
        totalHours: watchStats.totalHours,
        sessionCount: stats.sessionCount || 0,
        lastSessionTimestamp: stats.lastSessionTimestamp || null
      });

      log.debug('Stats sauvegardees pour', username);
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        // Scan deja insere, on ignore silencieusement.
      } else {
        log.error('set:', err.message);
      }
    }
  }

  /**
   * Obtenir toutes les entrees du cache (utilisateurs connus)
   */
  static getAll() {
    try {
      const users = db.UserQueries.getAll();
      const result = {};

      for (const user of users) {
        const latest = db.WatchHistoryQueries.getLatestForUser(user.id);
        if (latest) {
          result[user.username] = {
            sessionCount: latest.sessionCount,
            lastSessionTimestamp: latest.lastSessionTimestamp,
            watchStats: normalizeWatchStats({
              totalHours: latest.totalHours,
              movieHours: latest.movieHours,
              movieCount: latest.movieCount,
              episodeHours: latest.episodeHours,
              episodeCount: latest.episodeCount
            }, user.username)
          };
        }
      }

      return result;
    } catch (err) {
      log.error('getAll:', err.message);
      return {};
    }
  }

  /**
   * Obtenir les cles (usernames) en cache
   */
  static getKeys() {
    try {
      return db.UserQueries.getAll().map((u) => u.username);
    } catch (err) {
      log.error('getKeys:', err.message);
      return [];
    }
  }

  /**
   * Obtenir l'historique d'un utilisateur (30 jours par defaut)
   */
  static getHistory(username, days = 30) {
    try {
      const user = db.UserQueries.getByUsername(username);
      if (!user) return [];

      return db.WatchHistoryQueries.getHistoryForUser(user.id, days);
    } catch (err) {
      log.error('getHistory:', err.message);
      return [];
    }
  }

  /**
   * Obtenir l'historique complet d'un utilisateur
   */
  static getFullHistory(username) {
    try {
      const user = db.UserQueries.getByUsername(username);
      if (!user) return [];

      return db.WatchHistoryQueries.getAllForUser(user.id);
    } catch (err) {
      log.error('getFullHistory:', err.message);
      return [];
    }
  }

  /**
   * Obtenir les stats avec le temps depuis la derniere mise a jour
   */
  static getWithTimestamp(username) {
    try {
      const cache = this.get(username);
      if (!cache) return null;

      const lastUpdated = cache.lastActivity;
      if (!lastUpdated) return cache;

      const lastUpdateDate = new Date(lastUpdated);
      const now = new Date();
      const diffMs = now - lastUpdateDate;

      let timeSince = 'jamais';
      if (diffMs < 1000) {
        timeSince = "a l'instant";
      } else if (diffMs < 60 * 1000) {
        timeSince = `il y a ${Math.floor(diffMs / 1000)}s`;
      } else if (diffMs < 60 * 60 * 1000) {
        timeSince = `il y a ${Math.floor(diffMs / (60 * 1000))}m`;
      } else if (diffMs < 24 * 60 * 60 * 1000) {
        timeSince = `il y a ${Math.floor(diffMs / (60 * 60 * 1000))}h`;
      } else {
        timeSince = `il y a ${Math.floor(diffMs / (24 * 60 * 60 * 1000))}j`;
      }

      return {
        ...cache,
        cachedAt: lastUpdated,
        timeSince
      };
    } catch (err) {
      log.error('getWithTimestamp:', err.message);
      return null;
    }
  }

  /**
   * Supprimer les stats en cache pour un utilisateur
   */
  static delete(username) {
    try {
      const user = db.UserQueries.getByUsername(username);
      if (user) {
        log.debug('Utilisateur supprime:', username);
      }
    } catch (err) {
      log.error('delete:', err.message);
    }
  }

  /**
   * Verifier si le cache est expire (> X heures)
   */
  static isExpired(username, hours = 24) {
    try {
      const cache = this.get(username);
      if (!cache || !cache.lastActivity) return true;

      const lastUpdate = new Date(cache.lastActivity);
      const now = new Date();
      const diffHours = (now - lastUpdate) / (1000 * 60 * 60);

      return diffHours > hours;
    } catch (err) {
      log.error('isExpired:', err.message);
      return true;
    }
  }

  /**
   * Nettoyer les donnees aberrantes du cache
   */
  static _sanitizeCache() {
    // La validation est faite a l'insertion.
  }

  /**
   * Acceder directement a la base de donnees SQLite
   */
  static getDb() {
    return db;
  }
}

module.exports = SessionStatsCacheDB;
