# 🍕 Pizzeria — Programme de fidélité

Application web (PWA) de carte de fidélité pour pizzeria, prête pour **Vercel + Neon**.

## Fonctionnalités

Programme **100 % carte à tampons**, entièrement paramétrable dans **Admin → Carte à tampons** (sans redéployer) :

| Réglage | Options |
|---|---|
| **La carte** | nombre de tampons (2 à 50), récompense (ex. « Pizza offerte ») |
| **Règle de gain** | **1 tampon par pizza** (par défaut : l'équipe indique le nombre de pizzas) · ou 1 tampon par passage |
| **Plafond** | maximum de tampons par passage (optionnel) |
| **Tampons offerts** | à l'inscription, le jour de l'anniversaire (une fois par an), parrainage parrain / filleul, codes boutique |
| **Promotions** | tampons doublés / triplés sur une période, annoncés par notification |
| **Notifications** | chacune activable et modifiable, seuil « récompense proche », délai de relance |

Côté client : carte avec QR code et grille de tampons, cadeau disponible, parrainage, historique, profil (anniversaire),
installation sur l'écran d'accueil, accès hors connexion.

Côté équipe : scanner caméra, **ajouter ou retirer** des tampons (boutons rapides +1 à +5, sélecteur − / +,
saisie manuelle ; promo et plafond appliqués automatiquement, chaque retrait tracé avec son auteur et un motif),
bouton « Offrir la récompense », plusieurs admins / employés, tableau de bord (tampons distribués, cadeaux offerts,
où en sont les cartes, origine des inscriptions…).

### Notifications automatiques (activables et modifiables une par une)
Bienvenue · tampon ajouté · récompense proche · carte complète · anniversaire · parrainage réussi ·
relance d'inactivité · démarrage d'une promotion.
Variables : `{prenom}`, `{tampons}`, `{total}`, `{reste}`, `{gain}`, `{recompense}`, `{bonus}`, `{filleul}`.

### Import CSV des anciens clients
Colonnes obligatoires `email` et `tampons` (ou `points`), facultatives `nom` et `telephone` (séparateur `;` ou `,`, UTF-8 ou export Excel).

- Client **déjà inscrit** avec cet e-mail → tampons crédités immédiatement.
- Client **pas encore inscrit** → tampons mis en attente, puis ajoutés **automatiquement dès qu'il s'inscrit avec la même adresse e-mail**.
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
   | `NEXT_PUBLIC_PIZZERIA_NAME` | `La Bella Pizza` (valeur initiale, modifiable ensuite dans Admin → Carte à tampons) |

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
