/**
 * 🗄️ TAUTULLI DIRECT DATABASE READER
 * Lit directement la DB Tautulli (lecture seule) pour éviter l'API
 * Path de la DB fourni via variable d'environnement
 */

const Database = require('better-sqlite3');
const path = require('path');

let tautulliDb = null;

/**
 * Initialiser la connexion à la DB Tautulli
 * En lecture seule pour éviter tout risque de corruption
 */
function initTautulliDatabase() {
  const TAUTULLI_DB_PATH = process.env.TAUTULLI_DB_PATH;
  
  console.log("[TAUTULLI-DB] 🔍 Vérification TAUTULLI_DB_PATH:", TAUTULLI_DB_PATH || "NON CONFIGURÉ");
  
  if (!TAUTULLI_DB_PATH) {
    console.warn("[TAUTULLI-DB] ⚠️  TAUTULLI_DB_PATH non configuré - fonctionnalités Tautulli désactivées");
    return false;
  }
  
  try {
    // Ouvrir en lecture seule
    tautulliDb = new Database(TAUTULLI_DB_PATH, { readonly: true });
    console.log("[TAUTULLI-DB] ✅ Connecté à la DB Tautulli:", TAUTULLI_DB_PATH);
    return true;
  } catch (err) {
    console.error("[TAUTULLI-DB] ❌ Erreur connexion Tautulli DB:", err.message);
    console.error("[TAUTULLI-DB] ❌ Vérifiez que le chemin existe et est accessible");
    return false;
  }
}

/**
 * Vérifier que la connexion est active
 */
function isTautulliReady() {
  return tautulliDb !== null;
}

/**
 * 📊 Récupérer les stats de visionnage pour UN utilisateur
 * Agrégation optimisée directement en SQL
 */
function getUserStatsFromTautulli(username) {
  if (!tautulliDb) {
    return null;
  }
  
  try {
    const normalizedUsername = username.toLowerCase();
    
    // 🎯 Requête SQL optimisée - agrégation directe
    // Tautulli stocke les historiques dans la table `session_history`
    // Durée = (stopped - started) en secondes
    const stmt = tautulliDb.prepare(`
      SELECT 
        u.user_id,
        u.username,
        COUNT(*) as session_count,
        SUM(CAST((sh.stopped - sh.started) AS INTEGER)) as total_duration_seconds,
        MAX(sh.stopped) as last_session_timestamp,
        SUM(CASE WHEN sh.media_type = 'movie' THEN 1 ELSE 0 END) as movie_count,
        SUM(CASE WHEN sh.media_type = 'movie' THEN CAST((sh.stopped - sh.started) AS INTEGER) ELSE 0 END) as movie_duration_seconds,
        SUM(CASE WHEN sh.media_type = 'episode' THEN 1 ELSE 0 END) as episode_count,
        SUM(CASE WHEN sh.media_type = 'episode' THEN CAST((sh.stopped - sh.started) AS INTEGER) ELSE 0 END) as episode_duration_seconds
      FROM users u
      LEFT JOIN session_history sh ON u.user_id = sh.user_id
      WHERE LOWER(u.username) = ?
      GROUP BY u.user_id, u.username
    `);
    
    const stats = stmt.get(normalizedUsername);
    
    if (!stats || !stats.session_count) {
      console.log("[TAUTULLI-DIRECT] ℹ️  Pas de sessions pour:", normalizedUsername);
      return null;
    }
    
    // Convertir en heures
    const totalHours = stats.total_duration_seconds ? Math.round(stats.total_duration_seconds / 3600 * 10) / 10 : 0;
    const movieHours = stats.movie_duration_seconds ? Math.round(stats.movie_duration_seconds / 3600 * 10) / 10 : 0;
    const episodeHours = stats.episode_duration_seconds ? Math.round(stats.episode_duration_seconds / 3600 * 10) / 10 : 0;
    
    console.log("[TAUTULLI-DIRECT] ✅ Stats pour" , normalizedUsername, "- sessions:", stats.session_count);
    
    return {
      userId: stats.user_id,
      username: stats.username,
      sessionCount: stats.session_count || 0,
      totalHours: totalHours,
      movieCount: stats.movie_count || 0,
      movieHours: movieHours,
      episodeCount: stats.episode_count || 0,
      episodeHours: episodeHours,
      lastSessionTimestamp: stats.last_session_timestamp,
      lastSessionDate: stats.last_session_timestamp ? new Date(stats.last_session_timestamp * 1000).toISOString() : null
    };
  } catch (err) {
    console.error("[TAUTULLI-DIRECT] ❌ Erreur requête utilisateur:", err.message);
    return null;
  }
}

/**
 * 👥 Récupérer les stats pour TOUS les utilisateurs (à la fois)
 * Rapide: une seule requête SQL pour tous les users
 */
function getAllUserStatsFromTautulli() {
  if (!tautulliDb) {
    return [];
  }
  
  try {
    console.log("[TAUTULLI-DIRECT] 🚀 Récupération des stats pour TOUS les utilisateurs...");
    
    const stmt = tautulliDb.prepare(`
      SELECT 
        u.user_id,
        u.username,
        COUNT(*) as session_count,
        SUM(CAST((sh.stopped - sh.started) AS INTEGER)) as total_duration_seconds,
        MAX(sh.stopped) as last_session_timestamp,
        SUM(CASE WHEN sh.media_type = 'movie' THEN 1 ELSE 0 END) as movie_count,
        SUM(CASE WHEN sh.media_type = 'movie' THEN CAST((sh.stopped - sh.started) AS INTEGER) ELSE 0 END) as movie_duration_seconds,
        SUM(CASE WHEN sh.media_type = 'episode' THEN 1 ELSE 0 END) as episode_count,
        SUM(CASE WHEN sh.media_type = 'episode' THEN CAST((sh.stopped - sh.started) AS INTEGER) ELSE 0 END) as episode_duration_seconds
      FROM users u
      LEFT JOIN session_history sh ON u.user_id = sh.user_id
      GROUP BY u.user_id, u.username
      ORDER BY u.username
    `);
    
    const allStats = stmt.all();
    
    const results = allStats.map(stats => {
      const totalHours = stats.total_duration_seconds ? Math.round(stats.total_duration_seconds / 3600 * 10) / 10 : 0;
      const movieHours = stats.movie_duration_seconds ? Math.round(stats.movie_duration_seconds / 3600 * 10) / 10 : 0;
      const episodeHours = stats.episode_duration_seconds ? Math.round(stats.episode_duration_seconds / 3600 * 10) / 10 : 0;
      
      return {
        userId: stats.user_id,
        username: stats.username,
        sessionCount: stats.session_count || 0,
        totalHours: totalHours,
        movieCount: stats.movie_count || 0,
        movieHours: movieHours,
        episodeCount: stats.episode_count || 0,
        episodeHours: episodeHours,
        lastSessionTimestamp: stats.last_session_timestamp,
        lastSessionDate: stats.last_session_timestamp ? new Date(stats.last_session_timestamp * 1000).toISOString() : null
      };
    });
    
    console.log("[TAUTULLI-DIRECT] ✅ " + results.length + " utilisateurs traités en 1 requête");
    return results;
    
  } catch (err) {
    console.error("[TAUTULLI-DIRECT] ❌ Erreur requête tous users:", err.message);
    return [];
  }
}

/**
 * � Récupérer les heures de visionnage du mois en cours pour un utilisateur
 */
function getMonthlyHoursFromTautulli(username) {
  if (!tautulliDb) return 0;

  try {
    const normalizedUsername = username.toLowerCase();
    // Début du mois courant en timestamp Unix
    const stmt = tautulliDb.prepare(`
      SELECT SUM(CAST((sh.stopped - sh.started) AS INTEGER)) as monthly_seconds
      FROM users u
      JOIN session_history sh ON u.user_id = sh.user_id
      WHERE LOWER(u.username) = ?
        AND sh.started >= CAST(strftime('%s', date('now', 'start of month')) AS INTEGER)
        AND sh.stopped > sh.started
    `);

    const row = stmt.get(normalizedUsername);
    if (!row || !row.monthly_seconds) return 0;
    return Math.round(row.monthly_seconds / 3600 * 10) / 10;
  } catch (err) {
    console.error("[TAUTULLI-DIRECT] ❌ Erreur heures mensuelles:", err.message);
    return 0;
  }
}

/** * ⏰ Compter les sessions par tranche horaire (Oiseau de Nuit / Lève-Tôt)
 */
function getTimeBasedSessionCounts(username) {
  if (!tautulliDb) return { nightCount: 0, morningCount: 0 };

  try {
    const norm = username.toLowerCase();
    // Nuit : 22h-6h (heure locale)
    const nightStmt = tautulliDb.prepare(`
      SELECT COUNT(*) as cnt
      FROM session_history sh
      JOIN users u ON sh.user_id = u.user_id
      WHERE LOWER(u.username) = ?
        AND sh.stopped > sh.started
        AND (
          CAST(strftime('%H', sh.started, 'unixepoch', 'localtime') AS INTEGER) >= 22
          OR CAST(strftime('%H', sh.started, 'unixepoch', 'localtime') AS INTEGER) < 6
        )
    `);
    // Matin : 6h-9h (heure locale)
    const morningStmt = tautulliDb.prepare(`
      SELECT COUNT(*) as cnt
      FROM session_history sh
      JOIN users u ON sh.user_id = u.user_id
      WHERE LOWER(u.username) = ?
        AND sh.stopped > sh.started
        AND CAST(strftime('%H', sh.started, 'unixepoch', 'localtime') AS INTEGER) BETWEEN 6 AND 8
    `);

    const nightRow = nightStmt.get(norm);
    const morningRow = morningStmt.get(norm);
    return {
      nightCount: nightRow?.cnt || 0,
      morningCount: morningRow?.cnt || 0
    };
  } catch (err) {
    console.error("[TAUTULLI-DIRECT] ❌ Erreur horaires:", err.message);
    return { nightCount: 0, morningCount: 0 };
  }
}

/**
 * 📅 Calculer les dates de déblocage de chaque achievement depuis l'historique Tautulli
 */
function getAchievementUnlockDates(username, joinedAtTimestamp) {
  const dates = {};
  const fmt = (ts) => ts ? new Date(ts * 1000).toLocaleDateString('fr-FR') : null;
  const fmtMs = (ms) => ms ? new Date(ms).toLocaleDateString('fr-FR') : null;

  // --- Temporels (calculés depuis joinedAt) ---
  if (joinedAtTimestamp) {
    const joinMs = joinedAtTimestamp * 1000;
    const now = Date.now();
    const d365 = joinMs + 365 * 86400000;
    const d730 = joinMs + 730 * 86400000;
    const d1825 = joinMs + 1825 * 86400000;
    if (now >= d365)  dates['first-anniversary'] = fmtMs(d365);
    if (now >= d730)  dates['veteran']           = fmtMs(d730);
    if (now >= d1825) dates['old-timer']          = fmtMs(d1825);
  }

  if (!tautulliDb) return dates;

  try {
    const norm = username.toLowerCase();

    // Helper : date de la Nème session (tous types)
    const nthSession = (n, mediaType = null) => {
      try {
        const typeCond = mediaType ? `AND sh.media_type = '${mediaType}'` : '';
        const stmt = tautulliDb.prepare(`
          SELECT sh.started
          FROM session_history sh
          JOIN users u ON sh.user_id = u.user_id
          WHERE LOWER(u.username) = ? AND sh.stopped > sh.started ${typeCond}
          ORDER BY sh.started ASC
          LIMIT 1 OFFSET ?
        `);
        const row = stmt.get(norm, n - 1);
        return row?.started ? fmt(row.started) : null;
      } catch(e) { return null; }
    };

    // Helper : date où les heures cumulées ont dépassé le seuil
    const hoursThreshold = (targetHours) => {
      try {
        const stmt = tautulliDb.prepare(`
          SELECT stopped FROM (
            SELECT stopped, SUM(CAST((stopped - started) AS REAL) / 3600)
              OVER (ORDER BY started ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as cum_hours
            FROM session_history sh
            JOIN users u ON sh.user_id = u.user_id
            WHERE LOWER(u.username) = ? AND sh.stopped > sh.started
            ORDER BY started
          ) WHERE cum_hours >= ?
          LIMIT 1
        `);
        const row = stmt.get(norm, targetHours);
        return row?.stopped ? fmt(row.stopped) : null;
      } catch(e) { return null; }
    };

    // Helper : date de la Nème session nocturne (22h-6h) ou matinale (6h-9h)
    const nthTimeSession = (n, hourStart, hourEnd) => {
      try {
        let whereCond;
        if (hourStart < hourEnd) {
          whereCond = `strftime('%H', sh.started, 'unixepoch', 'localtime') BETWEEN '${String(hourStart).padStart(2,'0')}' AND '${String(hourEnd - 1).padStart(2,'0')}'`;
        } else {
          // Wrap autour de minuit (ex: 22h-6h : heure >= 22 OU heure < 6)
          whereCond = `(CAST(strftime('%H', sh.started, 'unixepoch', 'localtime') AS INTEGER) >= ${hourStart} OR CAST(strftime('%H', sh.started, 'unixepoch', 'localtime') AS INTEGER) < ${hourEnd})`;
        }
        const stmt = tautulliDb.prepare(`
          SELECT sh.started
          FROM session_history sh
          JOIN users u ON sh.user_id = u.user_id
          WHERE LOWER(u.username) = ? AND sh.stopped > sh.started AND ${whereCond}
          ORDER BY sh.started ASC
          LIMIT 1 OFFSET ?
        `);
        const row = stmt.get(norm, n - 1);
        return row?.started ? fmt(row.started) : null;
      } catch(e) { return null; }
    };

    // Activités
    dates['first-watch'] = nthSession(1);
    dates['regular']     = nthSession(7);
    dates['night-owl']   = nthTimeSession(30, 22, 6);   // 30ème session nocturne (22h-6h)
    dates['early-bird']  = nthTimeSession(50, 6,  9);   // 50ème session matinale (6h-9h)
    dates['centurion']   = hoursThreshold(100);
    dates['marathoner']  = hoursThreshold(500);

    // Helper : premier mois où les heures mensuelles ont dépassé un seuil
    const firstMonthOver = (targetHours) => {
      try {
        const stmt = tautulliDb.prepare(`
          SELECT strftime('%d/%m/%Y', MAX(sh.stopped), 'unixepoch') as unlock_date
          FROM session_history sh
          JOIN users u ON sh.user_id = u.user_id
          WHERE LOWER(u.username) = ? AND sh.stopped > sh.started
          GROUP BY strftime('%Y-%m', sh.started, 'unixepoch')
          HAVING SUM(CAST((sh.stopped - sh.started) AS REAL) / 3600) >= ?
          ORDER BY strftime('%Y-%m', sh.started, 'unixepoch') ASC
          LIMIT 1
        `);
        const row = stmt.get(norm, targetHours);
        return row?.unlock_date || null;
      } catch(e) { return null; }
    };

    // Mensuels
    dates['busy-month']    = firstMonthOver(50);
    dates['intense-month'] = firstMonthOver(100);

    // Films
    dates['cinema-marathon']   = nthSession(5,   'movie');
    dates['cinephile']         = nthSession(50,  'movie');
    dates['film-critic']       = nthSession(100, 'movie');
    dates['cinema-master']     = nthSession(250, 'movie');
    dates['hollywood-legend']  = nthSession(500, 'movie');

    // Séries
    dates['binge-watcher']        = nthSession(10,   'episode');
    dates['series-addict']        = nthSession(100,  'episode');
    dates['series-master']        = nthSession(500,  'episode');
    dates['serial-killer-legend'] = nthSession(1000, 'episode');

  } catch (err) {
    console.error("[TAUTULLI-DIRECT] ❌ Erreur unlock dates:", err.message);
  }

  return dates;
}

/**
 * 🔍 Évaluer les succès secrets auto-détectables depuis l'historique Tautulli
 */
function evaluateSecretAchievements(username, joinedAtTimestamp, toCheckIds = []) {
  const results = {};
  if (!tautulliDb || toCheckIds.length === 0) return results;

  const norm = username.toLowerCase();
  const fmt  = (ts) => ts ? new Date(ts * 1000).toLocaleDateString('fr-FR') : null;
  const today = new Date().toLocaleDateString('fr-FR');

  /**
   * Compte les films distincts regardés par l'utilisateur dont le titre matche un pattern LIKE.
   * Stratégie : session_history_metadata sert de lookup (rating_key par titre),
   * puis on compte les sessions dans session_history via sh.rating_key (pas de JOIN id=id).
   */
  const countMoviesByLike = (patterns) => {
    try {
      const orClauses = patterns.map(() => 'LOWER(shm.title) LIKE ?').join(' OR ');

      // Étape 1 : obtenir les rating_keys correspondant aux titres (tous utilisateurs)
      const keysSql = `
        SELECT DISTINCT rating_key FROM session_history_metadata shm
        WHERE ${orClauses}
      `;
      const keys = tautulliDb.prepare(keysSql).all(...patterns.map(p => p.toLowerCase()));

      if (!keys.length) return { cnt: 0, last_stopped: null };

      const ratingKeys = keys.map(k => k.rating_key);
      const placeholders = ratingKeys.map(() => '?').join(', ');

      // Étape 2 : compter les rating_keys DISTINCTS regardés par cet utilisateur
      const sql = `
        SELECT COUNT(DISTINCT sh.rating_key) as cnt, MAX(sh.stopped) as last_stopped
        FROM session_history sh
        JOIN users u ON sh.user_id = u.user_id
        WHERE LOWER(u.username) = ?
          AND sh.stopped > sh.started
          AND sh.media_type = 'movie'
          AND sh.rating_key IN (${placeholders})
      `;
      const row = tautulliDb.prepare(sql).get(norm, ...ratingKeys);
      return row || { cnt: 0, last_stopped: null };
    } catch(e) {
      console.error('[TAUTULLI-DIRECT] ❌ countMoviesByLike error:', e.message);
      return { cnt: 0, last_stopped: null };
    }
  };

  /**
   * Compte les films dont le titre exact (EN ou FR) est dans la liste fournie.
   * Même stratégie : lookup rating_key via metadata, puis count dans session_history.
   */
  const countMoviesByExactTitles = (titles) => {
    try {
      const placeholdersTitles = titles.map(() => '?').join(', ');

      // Étape 1 : rating_keys correspondant aux titres exacts
      const keysSql = `
        SELECT DISTINCT rating_key FROM session_history_metadata
        WHERE LOWER(title) IN (${placeholdersTitles})
      `;
      const keys = tautulliDb.prepare(keysSql).all(...titles.map(t => t.toLowerCase()));

      if (!keys.length) return { cnt: 0, last_stopped: null };

      const ratingKeys = keys.map(k => k.rating_key);
      const placeholders = ratingKeys.map(() => '?').join(', ');

      // Étape 2 : compter les rating_keys DISTINCTS regardés par cet utilisateur
      const sql = `
        SELECT COUNT(DISTINCT sh.rating_key) as cnt, MAX(sh.stopped) as last_stopped
        FROM session_history sh
        JOIN users u ON sh.user_id = u.user_id
        WHERE LOWER(u.username) = ?
          AND sh.stopped > sh.started
          AND sh.media_type = 'movie'
          AND sh.rating_key IN (${placeholders})
      `;
      const row = tautulliDb.prepare(sql).get(norm, ...ratingKeys);
      return row || { cnt: 0, last_stopped: null };
    } catch(e) {
      console.error('[TAUTULLI-DIRECT] ❌ countMoviesByExactTitles error:', e.message);
      return { cnt: 0, last_stopped: null };
    }
  };

  console.log(`[TAUTULLI-DIRECT] 🔍 Évaluation secrets pour ${norm}: [${toCheckIds.join(', ')}]`);

  try {
    for (const id of toCheckIds) {
      let row;
      switch (id) {

        // 🦕 Survivant du Parc — Les 6 films Jurassic (Park + World)
        case 'clever-girl': {
          row = countMoviesByLike(['%jurassic%']);
          console.log(`[TAUTULLI-DIRECT] clever-girl: ${row.cnt}/6 films Jurassic`);
          if (row.cnt >= 6) results[id] = fmt(row.last_stopped) || today;
          break;
        }

        // ⚡ Potterhead — 8 films Harry Potter (EN: "Harry Potter...", FR: "Harry Potter...")
        case 'potter-head': {
          // Même préfixe EN et FR
          row = countMoviesByLike(['harry potter%']);
          console.log(`[TAUTULLI-DIRECT] potter-head: ${row.cnt}/8 films HP`);
          if (row.cnt >= 8) results[id] = fmt(row.last_stopped) || today;
          break;
        }

        // 🦸 Avenger — Les 4 films Avengers (EN & FR variants)
        case 'avenger': {
          row = countMoviesByLike(['%avengers%']);
          // On cherche les 4 films principaux dans les résultats
          const avengersEN = ['the avengers', 'avengers: age of ultron', 'avengers: infinity war', 'avengers: endgame'];
          const avengersAlt = ['avengers', "avengers : l'ère d'ultron", 'avengers : infinity war', 'avengers : endgame',
                               'avengers: l\'ère d\'ultron'];
          const rowExact = countMoviesByExactTitles([...avengersEN, ...avengersAlt]);
          console.log(`[TAUTULLI-DIRECT] avenger: ${rowExact.cnt}/4 films Avengers`);
          if (rowExact.cnt >= 4) results[id] = fmt(rowExact.last_stopped) || today;
          // Fallback LIKE si exact échoue (titres légèrement différents)
          else if (row.cnt >= 4) results[id] = fmt(row.last_stopped) || today;
          break;
        }

        // 🗡️ Chevalier Noir — 4 films Star Wars
        case 'dark-knight': {
          row = countMoviesByLike(['%star wars%']);
          console.log(`[TAUTULLI-DIRECT] dark-knight: ${row.cnt}/4 films Star Wars`);
          if (row.cnt >= 4) results[id] = fmt(row.last_stopped) || today;
          break;
        }

        // 🧑‍⚖️ Maître Jedi — 7 films Star Wars
        case 'black-knight': {
          row = countMoviesByLike(['%star wars%']);
          console.log(`[TAUTULLI-DIRECT] black-knight: ${row.cnt}/7 films Star Wars`);
          if (row.cnt >= 7) results[id] = fmt(row.last_stopped) || today;
          break;
        }

        // 👑 Tolkiendil — Trilogie Seigneur des Anneaux (EN & FR)
        case 'tolkiendil': {
          row = countMoviesByLike(['%lord of the rings%', '%seigneur des anneaux%']);
          console.log(`[TAUTULLI-DIRECT] tolkiendil: ${row.cnt}/3 films LOTR`);
          if (row.cnt >= 3) results[id] = fmt(row.last_stopped) || today;
          break;
        }

        // 🐵 Évolutionniste — Trilogie Planète des Singes (EN & FR)
        case 'evolutionist': {
          row = countMoviesByLike(['%planet of the apes%', '%planète des singes%', '%planet des singes%']);
          console.log(`[TAUTULLI-DIRECT] evolutionist: ${row.cnt}/3 films Apes`);
          if (row.cnt >= 3) results[id] = fmt(row.last_stopped) || today;
          break;
        }

        // 🌙 Spectateur de Minuit — Session commencée entre 00h et 01h
        case 'midnight-watcher': {
          try {
            const r = tautulliDb.prepare(`
              SELECT sh.started FROM session_history sh
              JOIN users u ON sh.user_id = u.user_id
              WHERE LOWER(u.username) = ? AND sh.stopped > sh.started
                AND CAST(strftime('%H', datetime(sh.started, 'unixepoch', 'localtime')) AS INTEGER) = 0
              ORDER BY sh.started ASC LIMIT 1
            `).get(norm);
            if (r) results[id] = fmt(r.started) || today;
          } catch(e) { console.error('[TAUTULLI-DIRECT] midnight-watcher error:', e.message); }
          break;
        }

        // ⚔️ Guerrier du Week-end — 20h+ regardées un seul week-end (Sam+Dim)
        case 'weekend-warrior': {
          try {
            const r = tautulliDb.prepare(`
              SELECT
                strftime('%Y-%W', datetime(sh.started, 'unixepoch', 'localtime')) as week,
                SUM(CAST(sh.stopped - sh.started AS REAL) / 3600) as hours,
                MAX(sh.stopped) as last_stopped
              FROM session_history sh
              JOIN users u ON sh.user_id = u.user_id
              WHERE LOWER(u.username) = ? AND sh.stopped > sh.started
                AND CAST(strftime('%w', datetime(sh.started, 'unixepoch', 'localtime')) AS INTEGER) IN (0, 6)
              GROUP BY week HAVING hours >= 20
              ORDER BY week ASC LIMIT 1
            `).get(norm);
            if (r) results[id] = fmt(r.last_stopped) || today;
          } catch(e) { console.error('[TAUTULLI-DIRECT] weekend-warrior error:', e.message); }
          break;
        }

        // 🛌 Countdown en Pyjama — Regarder quelque chose le 31 décembre
        case 'countdown-pajama': {
          try {
            const r = tautulliDb.prepare(`
              SELECT sh.started FROM session_history sh
              JOIN users u ON sh.user_id = u.user_id
              WHERE LOWER(u.username) = ? AND sh.stopped > sh.started
                AND strftime('%m-%d', datetime(sh.started, 'unixepoch', 'localtime')) = '12-31'
              ORDER BY sh.started ASC LIMIT 1
            `).get(norm);
            if (r) results[id] = fmt(r.started) || today;
          } catch(e) { console.error('[TAUTULLI-DIRECT] countdown-pajama error:', e.message); }
          break;
        }

        default:
          break;
      }
    }
  } catch (err) {
    console.error('[TAUTULLI-DIRECT] ❌ Erreur évaluation secrets:', err.message);
  }

  if (Object.keys(results).length > 0) {
    console.log('[TAUTULLI-DIRECT] 🔓 Nouveaux secrets débloqués pour', norm + ':', Object.keys(results).join(', '));
  } else {
    console.log('[TAUTULLI-DIRECT] ℹ️  Aucun nouveau secret débloqué pour', norm);
  }
  return results;
}

/** * 🔍 Récupérer les utilisateurs actuellement en lecture (live sessions)
 */
function getLiveUsers() {
  if (!tautulliDb) {
    return [];
  }
  
  try {
    const stmt = tautulliDb.prepare(`
      SELECT DISTINCT
        u.user_id,
        u.username,
        s.started AS session_started,
        CAST((s.stopped - s.started) AS INTEGER) as watch_duration,
        m.title,
        m.media_type
      FROM users u
      JOIN session_history s ON u.user_id = s.user_id
      LEFT JOIN media_info m ON s.rating_key = m.rating_key
      WHERE s.stopped = 0 OR s.stopped IS NULL
      ORDER BY u.username
    `);
    
    const liveUsers = stmt.all();
    console.log("[TAUTULLI-DIRECT] 🔴 " + liveUsers.length + " utilisateurs en lecture");
    return liveUsers;
    
  } catch (err) {
    console.warn("[TAUTULLI-DIRECT] ⚠️  Erreur requête live users:", err.message);
    return [];
  }
}

/**
 * Fermer la connexion (au shutdown)
 */
function closeTautulliDatabase() {
  if (tautulliDb) {
    tautulliDb.close();
    tautulliDb = null;
    console.log("[TAUTULLI-DB] 🔌 Connexion fermée");
  }
}

module.exports = {
  initTautulliDatabase,
  isTautulliReady,
  getUserStatsFromTautulli,
  getAllUserStatsFromTautulli,
  getMonthlyHoursFromTautulli,
  getTimeBasedSessionCounts,
  getAchievementUnlockDates,
  evaluateSecretAchievements,
  getLiveUsers,
  closeTautulliDatabase
};
