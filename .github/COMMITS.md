# 📝 Convention de commits — plex-portal

Ce projet utilise les **Conventional Commits** pour générer automatiquement les versions et le changelog.

## Format

```
<type>(<scope optionnel>): <description courte>

<corps optionnel>

<footer optionnel>
```

## Types et leur effet sur la version

| Type       | Effet sur la version | Apparaît dans le changelog |
|------------|----------------------|---------------------------|
| `feat`     | **minor** `1.0.0 → 1.1.0` | ✅ ✨ Nouvelles fonctionnalités |
| `fix`      | **patch** `1.0.0 → 1.0.1` | ✅ 🐛 Corrections de bugs |
| `perf`     | **patch** | ✅ ⚡ Performances |
| `refactor` | —         | ✅ ♻️ Refactorisation |
| `style`    | —         | ✅ 💄 Interface & style |
| `docs`     | —         | ✅ 📚 Documentation |
| `chore`    | —         | 🙈 Masqué (maintenance) |
| `ci`       | —         | 🙈 Masqué (CI/CD) |

> **BREAKING CHANGE** dans le footer ou `feat!:` → **major** `1.0.0 → 2.0.0`

## Exemples

```bash
# Nouvelle fonctionnalité → v1.1.0
git commit -m "feat(classement): ajouter podium top 3"

# Correction de bug → v1.0.1
git commit -m "fix(xp): correction calcul ancienneté dans le classement"

# Interface → patch (sans bump si pas de fix/feat)
git commit -m "style(succes): cartes icon-only avec modal au clic"

# Breaking change → v2.0.0
git commit -m "feat!: refonte complète du système d'authentification"
```

## Processus de release

1. Tu push sur `main` avec des commits conventionnels
2. **Release Please** analyse les commits et ouvre automatiquement une PR intitulée `chore(main): release X.Y.Z`
3. La PR contient le bump de version dans `package.json` + le `CHANGELOG.md` mis à jour
4. Tu **merges la PR** → Release Please crée la GitHub Release + le tag `vX.Y.Z`
5. Le workflow Docker rebuilde et pousse `ghcr.io/idrinkx/plex-portal:vX.Y.Z` + `latest`
