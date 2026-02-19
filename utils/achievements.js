// Système d'Achievements/Trophées
const ACHIEVEMENTS = {
  // 🎁 TEMPORELS
  temporels: [
    {
      id: "first-anniversary",
      name: "Premier Anniversaire",
      icon: "🎂",
      description: "Un an d'anniversaire sur Minimax TV !",
      condition: (data) => data.daysSince >= 365,
      unlockedDate: null,
      category: "temporels"
    },
    {
      id: "veteran",
      name: "Vétéran",
      icon: "🛡️",
      description: "Plus de 2 ans d'ancienneté sur Minimax TV",
      condition: (data) => data.daysSince >= 730,
      unlockedDate: null,
      category: "temporels"
    },
    {
      id: "old-timer",
      name: "Vieux de la Veille",
      icon: "👴",
      description: "Plus de 10 ans d'ancienneté sur Minimax TV",
      condition: (data) => data.daysSince >= 3650,
      unlockedDate: null,
      category: "temporels"
    },
    {
      id: "og",
      name: "OG",
      icon: "⭐",
      description: "Premier visionnage en 2023 lors du lancement",
      condition: (data) => false, // À mettre à jour manuellement
      unlockedDate: null,
      category: "temporels"
    }
  ],

  // 🔥 ACTIVITÉ
  activites: [
    {
      id: "first-watch",
      name: "Premier Pas",
      icon: "🎬",
      description: "Regardez votre premier visionnage sur Minimax TV",
      condition: (data) => data.sessionCount >= 1,
      unlockedDate: null,
      category: "activites"
    },
    {
      id: "regular",
      name: "Régulier",
      icon: "🔥",
      description: "Au moins 1 visionnage par jour pendant 7 jours",
      condition: (data) => data.sessionCount >= 7,
      unlockedDate: null,
      category: "activites"
    },
    {
      id: "night-owl",
      name: "Oiseau de Nuit",
      icon: "🦉",
      description: "Plus de 30 visionages entre 22h et 6h",
      condition: (data) => false, // À calculer depuis les logs
      unlockedDate: null,
      category: "activites"
    },
    {
      id: "early-bird",
      name: "Lève-Tôt",
      icon: "🐦",
      description: "Plus de 50 visionages entre 6h et 9h",
      condition: (data) => data.sessionCount >= 50,
      unlockedDate: null,
      category: "activites"
    },
    {
      id: "centurion",
      name: "Centurion",
      icon: "💯",
      description: "Plus de 100 heures de visionnage au total",
      condition: (data) => data.totalHours >= 100,
      unlockedDate: null,
      category: "activites"
    },
    {
      id: "marathoner",
      name: "Marathonien",
      icon: "🏃",
      description: "Plus de 500 heures de visionnage au total",
      condition: (data) => data.totalHours >= 500,
      unlockedDate: null,
      category: "activites"
    }
  ],

  // 🎬 FILMS
  films: [
    {
      id: "cinema-marathon",
      name: "Marathon Cinéma",
      icon: "🍿",
      description: "5 films regardés en 24 heures",
      condition: (data) => data.movieCount >= 5,
      unlockedDate: null,
      category: "films"
    },
    {
      id: "cinephile",
      name: "Cinéphile",
      icon: "🎥",
      description: "50 films regardés au total",
      condition: (data) => data.movieCount >= 50,
      unlockedDate: null,
      category: "films"
    },
    {
      id: "film-critic",
      name: "Critique Ciné",
      icon: "📋",
      description: "100 films regardés au total",
      condition: (data) => data.movieCount >= 100,
      unlockedDate: null,
      category: "films"
    },
    {
      id: "cinema-master",
      name: "Maître du Cinéma",
      icon: "👑",
      description: "250 films regardés au total",
      condition: (data) => data.movieCount >= 250,
      unlockedDate: null,
      category: "films"
    },
    {
      id: "hollywood-legend",
      name: "Légende d'Hollywood",
      icon: "✨",
      description: "500 films regardés au total",
      condition: (data) => data.movieCount >= 500,
      unlockedDate: null,
      category: "films"
    }
  ],

  // 📺 SÉRIES
  series: [
    {
      id: "binge-watcher",
      name: "Binge Watcher",
      icon: "📺",
      description: "10 épisodes d'une série en 24h",
      condition: (data) => data.episodeCount >= 10,
      unlockedDate: null,
      category: "series"
    },
    {
      id: "series-addict",
      name: "Accro aux Séries",
      icon: "🚀",
      description: "100 épisodes regardés au total",
      condition: (data) => data.episodeCount >= 100,
      unlockedDate: null,
      category: "series"
    },
    {
      id: "series-master",
      name: "Maître des Séries",
      icon: "🎭",
      description: "500 épisodes regardés au total",
      condition: (data) => data.episodeCount >= 500,
      unlockedDate: null,
      category: "series"
    },
    {
      id: "serial-killer-legend",
      name: "Légende Serial Killer",
      icon: "👹",
      description: "1000 épisodes regardés au total",
      condition: (data) => data.episodeCount >= 1000,
      unlockedDate: null,
      category: "series"
    }
  ],

  // 📅 MENSUELS
  mensuels: [
    {
      id: "busy-month",
      name: "Mois Chargé",
      icon: "📊",
      description: "50 heures de visionnage en un seul mois",
      condition: (data) => false, // À calculer depuis les logs
      unlockedDate: null,
      category: "mensuels"
    },
    {
      id: "intense-month",
      name: "Mois Intense",
      icon: "⚡",
      description: "100 heures de visionnage en un seul mois",
      condition: (data) => false, // À calculer depuis les logs
      unlockedDate: null,
      category: "mensuels"
    }
  ],

  // 🔒 SECRETS
  secrets: [
    {
      id: "secret-wanderer",
      name: "Aventurier",
      icon: "🗺️",
      description: "🔒 Badge secret",
      condition: (data) => false,
      unlockedDate: null,
      category: "secrets",
      isSecret: true
    },
    {
      id: "secret-bartender",
      name: "Barman",
      icon: "🍸",
      description: "🔒 Badge secret",
      condition: (data) => false,
      unlockedDate: null,
      category: "secrets",
      isSecret: true
    },
    {
      id: "secret-castle",
      name: "Château",
      icon: "🏰",
      description: "🔒 Badge secret",
      condition: (data) => false,
      unlockedDate: null,
      category: "secrets",
      isSecret: true
    },
    {
      id: "secret-spirit",
      name: "Âme spirituelle",
      icon: "👻",
      description: "🔒 Badge secret",
      condition: (data) => false,
      unlockedDate: null,
      category: "secrets",
      isSecret: true
    },
    {
      id: "avenger",
      name: "Avenger",
      icon: "🦸",
      description: "Déblocké le 31/11/2025",
      condition: (data) => false,
      unlockedDate: "31/12/2025",
      category: "secrets",
      isSecret: false
    },
    {
      id: "beta-tester",
      name: "Beta Tester",
      icon: "🧪",
      description: "Déblocké le 31/11/2025",
      condition: (data) => false,
      unlockedDate: "31/12/2025",
      category: "secrets",
      isSecret: false
    },
    {
      id: "dark-knight",
      name: "Chevalier Noir",
      icon: "🗡️",
      description: "Fan de l'univers de Star Wars",
      condition: (data) => false,
      unlockedDate: "31/11/2025",
      category: "secrets",
      isSecret: false
    },
    {
      id: "clever-girl",
      name: "Clever Girl",
      icon: "🧩",
      description: "Fan de l'univers des Jurassic Park",
      condition: (data) => false,
      unlockedDate: null,
      category: "secrets",
      isSecret: true
    },
    {
      id: "potter-head",
      name: "Potterhead",
      icon: "⚡",
      description: "Fan de l'univers d'Harry Potter",
      condition: (data) => false,
      unlockedDate: "31/11/2025",
      category: "secrets",
      isSecret: false
    },
    {
      id: "spell-master",
      name: "Maître des Sorts",
      icon: "🪄",
      description: "Fan de l'univers de Star Wars",
      condition: (data) => false,
      unlockedDate: null,
      category: "secrets",
      isSecret: true
    },
    {
      id: "weekend-warrior",
      name: "Guerrier du Week-end",
      icon: "⚔️",
      description: "Plus de 20 heures de visionnage un week-end",
      condition: (data) => false,
      unlockedDate: "28/12/2025",
      category: "secrets",
      isSecret: false
    },
    {
      id: "black-knight",
      name: "Maître Jedi",
      icon: "🧑‍⚖️",
      description: "Fan de l'univers de Star Wars",
      condition: (data) => false,
      unlockedDate: "31/11/2025",
      category: "secrets",
      isSecret: false
    }
  ],

  // Obtenir tous les achievements
  getAll() {
    return [
      ...this.temporels,
      ...this.activites,
      ...this.films,
      ...this.series,
      ...this.mensuels,
      ...this.secrets
    ];
  },

  // Obtenir les achievements débloqués basé sur les données
  getUnlocked(data) {
    return this.getAll().filter(achievement => {
      // Si l'achievement a une date de déblocage définie, il est débloqué
      if (achievement.unlockedDate) return true;
      // Sinon on vérifie la condition
      return achievement.condition(data);
    });
  },

  // Obtenir les achievements verrouillés
  getLocked(data) {
    return this.getAll().filter(achievement => !this.getUnlocked(data).includes(achievement));
  },

  // Obtenir les stats
  getStats(data) {
    const all = this.getAll();
    const unlocked = this.getUnlocked(data);
    return {
      total: all.length,
      unlocked: unlocked.length,
      locked: all.length - unlocked.length,
      progress: Math.round((unlocked.length / all.length) * 100)
    };
  }
};

module.exports = { ACHIEVEMENTS };
