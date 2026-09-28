# 🍕 Pizzeria — Programme de fidélité

Application web (PWA) de carte de fidélité pour pizzeria, prête pour **Vercel + Neon**.

## Fonctionnalités

Tout le programme se règle depuis **Admin → Programme** (sans redéployer) :

| Mécanique | Réglages |
|---|---|
| **Points** | points par euro, récompenses échangeables (Admin → Récompenses), alerte « récompense proche » |
| **Carte à tampons** | nombre de tampons, commande minimum, récompense (1 tampon/commande, 2 pendant une promo x2) |
| **Cashback** | % reversé dans une cagnotte en €, montant minimum pour l'utiliser en caisse |
| **Niveaux VIP** | jusqu'à 5 niveaux (Bronze → Argent → Or…) selon les points cumulés, avec multiplicateur de gains |
| **Bonus** | bienvenue à l'inscription, anniversaire (une fois par an), parrainage parrain / filleul |
| **Promotions** | double / triple gains sur une période (points, tampons, cashback), annoncées par notification |
| **Codes d'inscription** | points offerts avec un code boutique (limite d'utilisations, expiration) |

Côté client : carte avec QR code, solde de points, grille de tampons, cagnotte cashback, niveau et progression,
lien de parrainage, historique, profil (date de naissance), installation sur l'écran d'accueil, accès hors connexion.

Côté équipe : scanner caméra, enregistrement du passage (aperçu du gain avant validation), carte tampons,
cashback, récompenses, plusieurs admins / employés, tableau de bord.

### Notifications automatiques (activables et modifiables une par une)
Bienvenue · passage en caisse · récompense proche · récompense débloquée · dernier tampon · carte tampons complète ·
nouveau niveau · anniversaire · parrainage réussi · relance d'inactivité · démarrage d'une promotion.
Les messages acceptent des variables : `{prenom}`, `{solde}`, `{gain}`, `{recompense}`, `{reste}`, `{bonus}`, `{niveau}`, `{filleul}`.

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
   | `NEXT_PUBLIC_PIZZERIA_NAME` | `La Bella Pizza` (valeur initiale, modifiable ensuite dans Admin → Programme) |

6. Redéployer, puis **inscrivez-vous avec l'e-mail de `ADMIN_EMAILS`** : ce compte devient administrateur
   (`ADMIN_EMAILS` accepte plusieurs e-mails séparés par des virgules).

### Plusieurs admins / employés
*Admin → Équipe* : saisissez un e-mail et choisissez **Administrateur** (accès complet) ou **Employé** (scanner
uniquement). Si la personne n'a pas de compte, il est créé avec le mot de passe choisi. Chaque passage en caisse
enregistre qui a scanné (visible au tableau de bord et dans *Équipe*). Les admins peuvent aussi ajouter l'app sur
leur téléphone et ouvrir directement le scanner (Android : appui long sur l'icône → *Scanner*).

### Carte sur l'écran d'accueil
L'app est une PWA : sur Android/Chrome un bouton **Ajouter à l'écran d'accueil** apparaît sur la carte ; sur
iPhone, les étapes Safari (Partager → *Sur l'écran d'accueil*) sont affichées. Une fois installée, la carte
s'ouvre en plein écran, fonctionne hors connexion et peut recevoir les notifications (obligatoire sur iPhone).

Le cron (`vercel.json`) tourne une fois par jour (anniversaires, relances, promos programmées) (compatible plan Hobby). Les promos programmées
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
