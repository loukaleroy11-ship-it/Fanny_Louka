# Mettre Lingua en ligne (Vercel + Neon, gratuit)

Résultat : un lien `https://….vercel.app` accessible de partout (PC, téléphone), en HTTPS (indispensable pour le micro).
Non testé sur un vrai compte Vercel/Neon par l'auteur : suis les étapes et signale toute erreur.

## 1. Base de données (Neon)
1. Compte gratuit sur https://neon.tech → nouveau projet (région Europe).
2. Dans « Connection details », copie deux adresses :
   - **directe** (décocher « Pooled connection ») → pour créer les tables depuis ton PC ;
   - **pooled** (cocher) → pour Vercel. Ajoute à la fin : `&pgbouncer=true&connect_timeout=15`.

## 2. Remplir la base depuis ton PC
Dans `lingua/.env`, mets `DATABASE_URL` = adresse **directe**. Puis, dans PowerShell, dossier `lingua` :

    npx.cmd prisma migrate deploy
    npm.cmd run db:seed
    npm.cmd run user:create -- ton@email.com TonMotDePasse TonPrenom

(Remets ensuite ton ancienne `DATABASE_URL` locale si tu veux continuer à développer en local.)

## 3. Site (Vercel)
1. https://vercel.com → connexion avec GitHub → Add New → Project → dépôt `Fanny_Louka`.
2. **Root Directory** = `lingua` (Framework : Next.js détecté ; le build lance déjà `prisma generate`).
3. Variables d'environnement :
   - `DATABASE_URL` = adresse **pooled** de Neon
   - `AUTH_SECRET` = 32+ caractères au hasard (PowerShell : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `APP_URL` = ton lien Vercel (après le 1er déploiement, puis redéployer)
   - `ANTHROPIC_API_KEY` = facultatif (sinon l'IA reste en mode démo, signalé dans l'interface)
   - ne PAS définir `ALLOW_REGISTRATION` (inscription fermée)
4. Deploy → ton lien s'affiche. Connecte-toi avec le compte créé à l'étape 2.

## Limites
- Limiteur de requêtes en mémoire (par instance serverless) : suffisant pour un seul utilisateur.
- Les appels IA sont limités à 60 s par requête (`maxDuration`).
