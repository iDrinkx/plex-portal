# 🐳 Guide Docker - Plex Portal

## 🆕 Détection automatique du reverse proxy

À partir de cette version, Plex Portal **détecte automatiquement** si elle est:
- En **local** (http://localhost:3000)
- Derrière un **reverse proxy** (https://example.com/plex-portal)

Aucune configuration manuelle du `BASE_PATH` ou `APP_URL` n'est nécessaire dans la plupart des cas!

L'app utilise les en-têtes standard du reverse proxy (`X-Forwarded-*`) pour déterminer sa configuration.

---

## ⚡ Démarrage ultra-rapide

### Local
```bash
docker-compose up -d
# http://localhost:3000
```

### Production (Unraid + ngx proxy manager)
```bash
# Juste changer SESSION_SECRET dans docker-compose.yml
docker-compose up -d
# https://example.com/plex-portal (automatiquement détecté!)
```

---

## 📝 Configuration

### Fichier unique: `docker-compose.yml`

```yaml
version: '3.8'

services:
  plex-portal:
    build: .
    ports:
      - "3000:3000"
    environment:
      SESSION_SECRET: "change-me"  # ⚠️ Obligatoire
      # C'est tout! Le reste se configure automatiquement
    volumes:
      - ./config:/config
    restart: unless-stopped
```

### Variables d'environnement

| Variable | Obligatoire | Détaillé |
|----------|-------------|----------|
| `SESSION_SECRET` | ✅ | Clé secrète des sessions |
| `APP_URL` | ❌ | Auto-détecté via headers |
| `BASE_PATH` | ❌ | Auto-détecté via headers |
| `WIZARR_URL` | ❌ | URL Wizarr (optionnel) |
| `WIZARR_API_KEY` | ❌ | Clé API Wizarr |
| `TAUTULLI_URL` | ❌ | URL Tautulli (optionnel) |
| `TAUTULLI_API_KEY` | ❌ | Clé API Tautulli |
| `DEBUG` | ❌ | Affiche logs de détection |

---

## 🔍 Comment fonctionne la détection

L'application check les en-têtes HTTP envoyés par le reverse proxy:

```
X-Forwarded-Proto  → https ou http
X-Forwarded-Host   → example.com
X-Forwarded-Prefix → /plex-portal
```

**Exemple:**

Si ngx proxy manager redit une requête vers `/plex-portal`, il envoie:
```
X-Forwarded-Proto: https
X-Forwarded-Host: example.com
X-Forwarded-Prefix: /plex-portal
```

L'app reconstruit automatiquement: `https://example.com/plex-portal`

---

## 🚀 Cas d'usage

### Local (développement)

```bash
docker-compose up -d
```

- App: `http://localhost:3000`
- Pas de reverse proxy
- Auto-détection: aucun header reçu

### Unraid + ngx proxy manager

```bash
docker-compose up -d
```

- **Route ngx:**
  - Domain: `example.com`
  - Path: `/plex-portal`
  - Forward: `192.168.10.104:3000`
  - Strip Path: ✅ ON

- **Résultat:**
  - Public: `https://example.com/plex-portal`
  - Local: `http://192.168.10.104:3000`
  - Auto-détection: headers envoyés par ngx

### Traefik

```yaml
traefik:
  - "traefik.http.routers.plex.entrypoints=websecure"
  - "traefik.http.routers.plex.rule=Host(`example.com`) && PathPrefix(`/plex-portal`)"
  - "traefik.http.middlewares.strip.stripprefix.prefixes=/plex-portal"
```

Auto-détection: headers envoyés par Traefik

---

## 🎯 Override manuel (avancé)

Si vous voulez forcer une configuration:

```yaml
environment:
  SESSION_SECRET: "your-key"
  APP_URL: "https://example.com"        # Override auto-détection
  BASE_PATH: "/plex-portal"             # Override auto-détection
  DEBUG: "true"                         # Affiche logs
```

---

## 🔒 Sécurité

### Production

1. **Générez une SESSION_SECRET sécurisée:**
   ```bash
   openssl rand -hex 32
   ```

2. **Utilisez HTTPS** (via reverse proxy avec SSL)

3. **Vérifiez les logs si DEBUG=true:**
   ```bash
   docker-compose logs -f plex-portal
   ```

---

## 🛠 Troubleshooting

### "Cannot find API route"

**Cause:** BASE_PATH mal détecté

**Solution:**
```bash
# Activez DEBUG
environment:
  DEBUG: "true"

# Vérifiez les logs
docker-compose logs -f plex-portal

# Si nécessaire, override manuellement
BASE_PATH: "/plex-portal"
```

### "Plex login redirect error"

**Cause:** APP_URL mal détecté

**Solution:**
1. Vérifiez que votre reverse proxy envoie `X-Forwarded-Host`
2. Vérifiez que le domaine est publiquement accessible
3. Override si nécessaire: `APP_URL: "https://example.com"`

### "Logo not found"

**Solution:**
1. Assurez-vous que `logo.png` est dans `config/`
2. Redémarrez: `docker-compose restart`

---

## 📊 Intégrations

### Wizarr

```yaml
environment:
  WIZARR_URL: "http://192.168.10.100:5290"
  WIZARR_API_KEY: "your-key"
```

### Tautulli

```yaml
environment:
  TAUTULLI_URL: "http://192.168.10.100:8181"
  TAUTULLI_API_KEY: "your-key"
```

---


## 📚 Documentation complète

- [SETUP.md](./SETUP.md) - Guide pas à pas
- [UNRAID.md](./UNRAID.md) - Configuration Unraid spécifique
- [README.md](./README.md) - Vue d'ensemble

---

## Code source

Le code source de Plex Portal n'est pas public. Seule l'image Docker officielle et la documentation sont disponibles.
Pour toute suggestion ou bug, ouvrez une issue ou contactez l'auteur.
