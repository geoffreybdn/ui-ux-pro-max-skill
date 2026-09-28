# 🍕 Pizzeria — Programme de fidélité

Application web (PWA) de carte de fidélité pour pizzeria, prête pour **Vercel + Neon**.

## Fonctionnalités

| Côté client | Côté admin / équipe |
|---|---|
| Inscription e-mail + mot de passe, **code d'inscription** facultatif (points offerts) | **Scanner** le QR code de la carte avec la caméra (ou recherche nom / e-mail / tél.) |
| Carte de fidélité avec **QR code**, solde, progression vers la prochaine récompense | Crédit des points selon le montant (1 pt / € configurable) + bonus |
| **Notifications push** (Android, ordinateur, iPhone une fois l'app ajoutée à l'écran d'accueil) | **Promotions double / triple points** appliquées automatiquement et notifiées |
| Historique des points | **Codes d'inscription** (bonus, nombre max d'utilisations, expiration, lien à partager) |
| Récupération automatique des **points de l'ancienne carte** | **Import CSV** des anciens clients et de leurs points |
| | Récompenses, gestion des rôles (client / équipe / admin), message push manuel |

### Notifications automatiques
- `+X points` après chaque passage en caisse (avec mention de la promo en cours)
- Récompense débloquée
- Démarrage d'une promotion (immédiat si elle commence tout de suite, sinon au démarrage)
- Anciens points récupérés (quand l'import concerne un client déjà inscrit)
- Relance des clients inactifs depuis `INACTIVITY_REMINDER_DAYS` jours (cron quotidien)

### Import CSV des anciens clients
Colonnes obligatoires `email` et `points`, facultatives `nom` et `telephone` (séparateur `;` ou `,`, UTF-8 ou export Excel).

- Client **déjà inscrit** avec cet e-mail → points crédités immédiatement.
- Client **pas encore inscrit** → points mis en attente, puis ajoutés **automatiquement dès qu'il s'inscrit avec la même adresse e-mail**.
- Réimporter le même fichier ne crédite jamais deux fois.

## Déploiement (Vercel + Neon)

1. **Vercel** → *Add New Project* → importer ce dépôt, **Root Directory : `projects/pizzeria-loyalty`**.
2. **Storage → Create → Neon** et le lier au projet (crée `DATABASE_URL`).
3. Créer les tables (une seule fois, depuis votre poste) :
   ```bash
   cd projects/pizzeria-loyalty
   npm install
   DATABASE_URL="postgres://..." npm run db:migrate
   ```
   (ou coller `db/schema.sql` dans l'éditeur SQL de la console Neon)
4. Générer les clés push : `npm run vapid`
5. Variables d'environnement Vercel (voir `.env.example`) :

   | Variable | Exemple |
   |---|---|
   | `DATABASE_URL` | fourni par Neon |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `ADMIN_EMAILS` | `patron@mapizzeria.fr` |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | sortie de `npm run vapid` |
   | `VAPID_SUBJECT` | `mailto:patron@mapizzeria.fr` |
   | `CRON_SECRET` | chaîne aléatoire |
   | `NEXT_PUBLIC_PIZZERIA_NAME` | `La Bella Pizza` |
   | `POINTS_PER_EURO` | `1` |

6. Redéployer, puis **inscrivez-vous avec l'e-mail de `ADMIN_EMAILS`** : ce compte devient administrateur.
   Dans *Admin → Clients*, passez vos employés en rôle **Équipe** : ils n'ont accès qu'au scanner.

Le cron (`vercel.json`) tourne une fois par jour (compatible plan Hobby). Les promos programmées
sont aussi annoncées dès qu'un admin ouvre le tableau de bord.

## Développement local

```bash
cp .env.example .env.local   # remplir les valeurs
npm install
npm run db:migrate
npm run dev
```

Le scanner et les notifications nécessitent HTTPS (ou `localhost`).

## Stack
Next.js (App Router) · Neon serverless Postgres · Web Push (VAPID) · html5-qrcode · jose (sessions JWT) · bcryptjs
