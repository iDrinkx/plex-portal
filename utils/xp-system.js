// Système de badges et XP
const XP_SYSTEM = {
  badges: [
    {
      level: 1,
      name: "Bronze",
      icon: "🔵",
      minXp: 0,
      maxXp: 100,
      color: "#5B9BD5",
      bgColor: "rgba(91, 155, 213, 0.1)",
      borderColor: "#5B9BD5"
    },
    {
      level: 2,
      name: "Argent",
      icon: "⚪",
      minXp: 100,
      maxXp: 300,
      color: "#C0C0C0",
      bgColor: "rgba(192, 192, 192, 0.1)",
      borderColor: "#C0C0C0"
    },
    {
      level: 3,
      name: "Or",
      icon: "🟡",
      minXp: 300,
      maxXp: 700,
      color: "#E5A00D",
      bgColor: "rgba(229, 160, 13, 0.1)",
      borderColor: "#E5A00D"
    },
    {
      level: 4,
      name: "Platine",
      icon: "💎",
      minXp: 700,
      maxXp: 1500,
      color: "#00D9FF",
      bgColor: "rgba(0, 217, 255, 0.1)",
      borderColor: "#00D9FF"
    },
    {
      level: 5,
      name: "Diamant",
      icon: "💎",
      minXp: 1500,
      maxXp: Infinity,
      color: "#FF1493",
      bgColor: "rgba(255, 20, 147, 0.1)",
      borderColor: "#FF1493"
    }
  ],

  // Calculer l'XP total de l'utilisateur
  calculateTotalXp(sessionCount, totalRequests) {
    const xpFromSessions = (sessionCount || 0) * 2;
    const xpFromRequests = (totalRequests || 0) * 15;
    return xpFromSessions + xpFromRequests;
  },

  // Obtenir le badge actuel
  getBadgeByXp(totalXp) {
    return this.badges.find(b => totalXp >= b.minXp && totalXp < b.maxXp) || this.badges[this.badges.length - 1];
  },

  // Obtenir la progression vers le badge suivant
  getProgressToNextBadge(totalXp) {
    const currentBadge = this.getBadgeByXp(totalXp);
    const nextBadge = this.badges.find(b => b.level === currentBadge.level + 1);
    
    if (!nextBadge) {
      return {
        current: currentBadge,
        next: null,
        currentXp: totalXp,
        nextXpThreshold: null,
        progressPercent: 100,
        xpNeeded: 0
      };
    }

    const xpInCurrentBadge = totalXp - currentBadge.minXp;
    const xpNeededForNextBadge = nextBadge.minXp - currentBadge.minXp;
    const progressPercent = Math.floor((xpInCurrentBadge / xpNeededForNextBadge) * 100);

    return {
      current: currentBadge,
      next: nextBadge,
      currentXp: totalXp,
      nextXpThreshold: nextBadge.minXp,
      progressPercent: Math.min(progressPercent, 100),
      xpNeeded: Math.max(nextBadge.minXp - totalXp, 0)
    };
  },

  // Obtenir les statistiques détaillées
  getDetailedStats(sessionCount, totalRequests) {
    const totalXp = this.calculateTotalXp(sessionCount, totalRequests);
    const badge = this.getBadgeByXp(totalXp);
    const progress = this.getProgressToNextBadge(totalXp);

    return {
      totalXp,
      badge,
      progress,
      breakdown: {
        sessionXp: sessionCount * 2,
        requestXp: totalRequests * 15,
        sessionCount,
        totalRequests
      }
    };
  }
};

module.exports = { XP_SYSTEM };
