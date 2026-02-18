/**
 * Cache Manager - Utilitaire centralisé pour gérer les caches
 * Améliore les performances et maintainabilité
 */

class CacheManager {
  constructor(defaultDuration = 60000) {
    this.cache = new Map();
    this.defaultDuration = defaultDuration;
  }

  /**
   * Obtient une valeur du cache
   * @param {string} key - Clé du cache
   * @returns {any|null} Valeur en cache ou null si expiré/absent
   */
  get(key) {
    if (!this.cache.has(key)) return null;

    const entry = this.cache.get(key);
    const now = Date.now();

    // Vérifier si le cache a expiré
    if (now - entry.timestamp > entry.duration) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Stocke une valeur en cache
   * @param {string} key - Clé du cache
   * @param {any} data - Données à cacher
   * @param {number} duration - Durée de vie en ms (optionnel)
   */
  set(key, data, duration = this.defaultDuration) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      duration
    });
  }

  /**
   * Obtient ou calcule une valeur (lazy evaluation)
   * @param {string} key - Clé du cache
   * @param {Function} fn - Fonction à exécuter si pas en cache
   * @param {number} duration - Durée de vie en ms (optionnel)
   * @returns {Promise<any>}
   */
  async getOrSet(key, fn, duration = this.defaultDuration) {
    // Retourner la valeur en cache si présente
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Sinon, exécuter la fonction et mettre en cache
    const data = await fn();
    this.set(key, data, duration);
    return data;
  }

  /**
   * Invalide une entrée de cache
   * @param {string} key - Clé à invalider
   */
  invalidate(key) {
    this.cache.delete(key);
  }

  /**
   * Invalide tout le cache
   */
  invalidateAll() {
    this.cache.clear();
  }

  /**
   * Obtient des infos sur le cache (pour debug)
   */
  stats() {
    const stats = {
      size: this.cache.size,
      entries: []
    };

    for (const [key, entry] of this.cache.entries()) {
      const age = Date.now() - entry.timestamp;
      const ttl = entry.duration - age;
      stats.entries.push({
        key,
        age: Math.round(age / 1000) + 's',
        ttl: Math.round(ttl / 1000) + 's',
        expired: ttl <= 0
      });
    }

    return stats;
  }
}

module.exports = CacheManager;
