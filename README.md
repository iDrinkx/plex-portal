# 📺 Plex Portal

Application web pour gérer votre accès Plex, afficher les abonnements et les statistiques de visionnage.

## ✨ Fonctionnalités

- 🔐 **Authentification Plex** - Connectez-vous avec votre compte Plex
- 📊 **Dashboard** - Affichage des informations d'accès
- 💳 **Gestion des abonnements** - Affichage des abonnements Wizarr (optionnel)
- 📈 **Statistiques** - Historique de visionnage via Tracearr (optionnel)
- 🌐 **Support Reverse Proxy Automatique** - Détection auto via headers X-Forwarded-*
- 🚀 **Configuration Minimale** - Juste` SESSION_SECRET` en env var!

---

## 🚀 Démarrage ultra-rapide

### Requirements

- Docker & Docker Compose
- Compte Plex
- _(Optionnel)_ Wizarr ou Tracearr

### Démarrer en local (30 secondes!)

```bash
# 1. Cloner le projet
git clone https://github.com/theopoleme/plex-portal.git
cd plex-portal

# 2. Modifier SESSION_SECRET dans docker-compose.yml
# SESSION_SECRET: "change-me-to-a-secure-key"

# 3. Lancer!
docker-compose up -d

# 4. Ouvrir http://localhost:3000
```

**C'est tout!** ✨

### Déploiement Production (Unraid + ngx proxy manager)

```bash
# Même commande, l'app détecte automatiquement le reverse proxy!
docker-compose up -d

# Accès: https://example.com/plex-portal
```

---

## 📚 Documentation

- **[SETUP.md](./SETUP.md)** - Guide pas à pas (recommandé pour débuter)
- **[DOCKER.md](./DOCKER.md)** - Guide complet Docker et reverse proxy
- **[UNRAID.md](./UNRAID.md)** - Configuration spécifique Unraid
- **[.env.example](./.env.example)** - Variables d'environnement

---

## 📋 Structure du projet

```
plex-portal/
├── Dockerfile                          # Image Docker
├── docker-compose.yml                  # Un seul fichier config!
├── server.js                           # Serveur Express
├── package.json                        # Dépendances Node
│
├── middleware/
│   ├── auth.middleware.js
│   └── reverseproxy.middleware.js      # Auto-détection reverse proxy
│
├── routes/
│   ├── auth.routes.js
│   └── dashboard.routes.js
│
├── views/
│   ├── layout.ejs
│   ├── login.ejs
│   ├── dashboard/
│   ├── abonnement/
│   └── statistiques/
│
├── public/
│   ├── css/style.css
│   └── js/
│
├── utils/
│   ├── wizarr.js
│   └── tracearr.js
│
├── config/
│   └── logo.png
│
├── SETUP.md
├── DOCKER.md
├── UNRAID.md
└── README.md
```

---

## 🎯 Comment fonctionne la détection automatique

L'app détecte automatiquement si elle est:

### En local
```
Aucun header X-Forwarded-*
↓
App: http://localhost:3000
basePath: "" (vide)
```

### Derrière un reverse proxy
```
Headers de ngx proxy manager:
  X-Forwarded-Proto: https
  X-Forwarded-Host: example.com
  X-Forwarded-Prefix: /plex-portal
↓
App détecte automatiquement: https://example.com/plex-portal
basePath: "/plex-portal"
```

**Aucune configuration manuelle requise!** ✨

---

## 🔧 Configuration

### Minimale (obligatoire)

```yaml
environment:
  SESSION_SECRET: "change-me-to-a-secure-key"
```

### Optionnelle (override auto-détection)

```yaml
environment:
  SESSION_SECRET: "your-key"
  APP_URL: "https://example.com"        # Auto si omis
  BASE_PATH: "/plex-portal"             # Auto si omis
  DEBUG: "true"                         # Affiche logs
  WIZARR_URL: "http://wizarr.local"
  WIZARR_API_KEY: "key"
  TRACEARR_URL: "http://tracearr.local"
  TRACEARR_API_KEY: "key"
```

---

## 📚 Exemples d'usage

### Local (développement)

```bash
docker-compose up -d
# http://localhost:3000
```

### Unraid + ngx proxy manager

```bash
# Aucune modification du docker-compose.yml!
docker-compose up -d

# https://example.com/plex-portal (auto-détecté)
```

### Traefik

Labels Traefik auto-détection, aucune config de l'app requise.

---

## 🔒 Sécurité

- ✅ Authentification via Plex (aucun stockage de password)
- ✅ Sessions sécurisées (HttpOnly cookies)
- ✅ Support HTTPS (via reverse proxy)
- ⚠️ Changez `SESSION_SECRET` en production

---

## 🛠 Development

### Stack technique

- **Backend**: Node.js + Express.js
- **Frontend**: EJS + Vanilla JS
- **Auth**: Plex OAuth
- **Container**: Docker

### Installation locale (sans Docker)

```bash
npm install
# Modifier docker-compose.yml → .env
SESSION_SECRET=dev-secret
npm start
# http://localhost:3000
```

---

## 📝 APIs disponibles

```
GET  /                        # Login ou redirect dashboard
GET  /dashboard               # Dashboard (auth requis)
GET  /abonnement              # Abonnements
GET  /statistiques            # Statistiques

POST /login                   # Initiate Plex auth
GET  /auth-complete           # Plex callback
GET  /logout                  # Logout

GET  /api/subscription        # JSON stats
GET  /api/stats               # JSON stats
```

---

## 🤝 Contribution

Les contributions sont bienvenues! Veuillez:

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

---

## 📄 Licence

Ce projet est sous [MIT License](LICENSE)

---

## 🆘 Support & FAQ

**Q: Vous devriez modifier quoi pour passer du local à la production?**
R: Rien! L'app détecte automatiquement. Juste configurer ngx proxy manager.

**Q: SESSION_SECRET doit être gardé secret?**
R: Oui! Générez une clé avec: `openssl rand -hex 32`

**Q: Puis-je changer le port 3000?**
R: Oui, dans docker-compose.yml: `ports: ["3001:3000"]`

**Plus de questions?**
- 📖 Consulter [SETUP.md](./SETUP.md)
- 📖 Consulter [DOCKER.md](./DOCKER.md)
- 💬 Ouvrir une issue sur GitHub

---

## 🔧 Configuration

### Variables d'environnement (obligatoires)

```bash
APP_URL=http://localhost:3000              # URL publique de l'app
SESSION_SECRET=your-secret-key             # Clé secrète sessions
```

### Variables optionnelles

```bash
BASE_PATH=/plex-portal                     # Si derrière reverse proxy
WIZARR_URL=http://wizarr.local             # Instance Wizarr
WIZARR_API_KEY=your-key                    # Clé API Wizarr
TRACEARR_URL=http://tracearr.local         # Instance Tracearr
TRACEARR_API_KEY=your-key                  # Clé API Tracearr
```

---

## 🎯 Cas d'usage

### ✅ Local Development
```bash
docker-compose up -d
# http://localhost:3000
```

### ✅ Unraid + ngx proxy manager
```bash
# .env configuration
APP_URL=https://example.com
BASE_PATH=/plex-portal

# Launch
docker-compose -f docker-compose.yml -f docker-compose.reverse-proxy.yml up -d
# https://example.com/plex-portal
```

### ✅ Production self-hosted
```bash
# Configuration complète avec tous les services
APP_URL=https://plex.myserver.com
SESSION_SECRET=your-secure-key
WIZARR_URL=http://internal-wizarr
WIZARR_API_KEY=key
```

---

## 🔐 Sécurité

- ✅ Authentification via Plex (aucun stockage de password)
- ✅ Sessions sécurisées (HttpOnly cookies)
- ✅ Support HTTPS (via reverse proxy)
- ⚠️ Changez `SESSION_SECRET` en production
- ⚠️ Gardez les clés API secrètes

---

## 🛠 Development

### Stack technique

- **Backend**: Node.js + Express.js
- **Frontend**: EJS + Vanilla JS
- **Auth**: Plex OAuth
- **Container**: Docker

### Installation locale (sans Docker)

```bash
npm install
cp .env.example .env
# Modifier .env
npm start
# http://localhost:3000
```

---

## 📝 APIs disponibles

```
GET  /                        # Page login ou redirect dashboard
GET  /dashboard               # Dashboard (requiert auth)
GET  /abonnement              # Info abonnements
GET  /statistiques            # Statistiques visionnage

POST /login                   # Initiate Plex auth
GET  /auth-complete           # Plex callback
GET  /logout                  # Logout

GET  /api/subscription        # Subscription info (JSON)
GET  /api/stats               # Stats (JSON)
```

---

## 🤝 Contribution

Les contributions sont bienvenues! Veuillez:

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

---

## 📄 Licence

Ce projet est sous [MIT License](LICENSE)

---

## 🆘 Support

- 📖 Consultez [DOCKER.md](./DOCKER.md) pour les problèmes de déploiement
- 🔧 Vérifiez les logs: `docker-compose logs -f plex-portal`
- 💬 Ouvrez une issue sur GitHub

---

## 🙏 Remerciements

- [Plex](https://plex.tv/) - Pour leur API
- [Wizarr](https://github.com/wizarr-io/wizarr) - Gestion des invitations
- [Tracearr](https://github.com/Fladro/Tracearr) - Statistiques de visionnage
