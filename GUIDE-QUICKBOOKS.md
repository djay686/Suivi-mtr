# Suivi Garage → QuickBooks en ligne — guide de branchement (v119, facture v158-v160)

## v158 — Facturer un bon de travail terminé

Sur un bon dans **« Prêt à facturer »**, l'administration voit le bouton **🧾 Facturer** :

1. La fenêtre compare la **soumission** à ce qui s'est passé au **bon de travail** : heures
   punchées (arrondies au ¼ h) contre heures soumises, pièces cochées « utilisées », pièces
   retirées du bon, pièces ajoutées en atelier.
2. Trois points de départ : **✨ Suggestion** (la soumission + les ajouts cochés « utilisés »),
   **📋 Soumission seulement**, **🔧 Réel du BT**. Ensuite, chaque ligne se coche / décoche et
   la quantité, le prix et la description se corrigent à la main. On peut ajouter une pièce, de la
   main-d'œuvre ou une ligne de texte.
3. **💾 Enregistrer** garde la facturation sur le bon (elle revient telle quelle à la réouverture).
4. **📗 Facturer avec QuickBooks** crée la **facture** et l'ouvre :
   - pièce dont le numéro existe dans QuickBooks (nom ou SKU du produit) → ce produit-là ;
   - pièce inconnue de QuickBooks → article **« Pièce »**, description = `numéro description` ;
   - main-d'œuvre → article **« Atelier »** ; main-d'œuvre d'une **hivernisation** → service
     **« Hivernisation »** avec **sa description** de QuickBooks (v160) ;
   - **1re ligne** : la machine, son n° de série et ses heures / km (texte seulement, v160) ;
   - aucun n° de bon de travail ni de soumission sur la facture (v160) : le message au client est
     seulement ce que l'admin écrit dans la fenêtre ;
   - client retrouvé (id retenu au carnet, nom, courriel) ou **créé** avec téléphone, courriel et adresse du carnet ;
   - le devis QuickBooks de la soumission, s'il existe, est lié à la facture (il se ferme) ;
   - numéro de facture = la suite normale de QuickBooks ;
   - le bon passe dans **« Facturé »**. Un second envoi met à jour la même facture, sauf si
     un paiement y est déjà appliqué (la correction se fait alors dans QuickBooks).
5. **📄 CSV** : fichier « Importer des données → Factures » pour les jours où l'API n'est pas branchée.

### v160 — Ce que le client voit sur la facture

- **1re ligne** : `2022 Sea-Doo RXP-X 300 · n° de série … · 123,4 h` (relevé km / heures fait à l'entrée).
  Pas de produit, pas de montant.
- **Hivernisation** : la ligne de main-d'œuvre part sur le service **« Hivernisation »** du dossier et prend
  **sa description** (la liste des travaux). Pour changer ce texte : QuickBooks › Ventes › Produits et services ›
  Hivernisation › Description. Quantité et prix restent ceux de la facturation (heures × taux).
  Si la ligne dit autre chose en plus (« Hivernisation + shrink wrap »), c'est ajouté à la fin de la description.
  Service désactivé ou supprimé → la ligne repart sur « Atelier » (l'app ne crée jamais ce service).
- **Rien sur le BT ni la soumission** : ni dans le message au client, ni dans le mémo de relevé
  (qui s'imprime sur les relevés de compte). Le lien bon ↔ facture reste dans l'app (badge
  « 📗 Facture n° … » et journal `qbo_envois`).

### v159 — Entreprise de test (sandbox) et vraie entreprise

- Chaque facture, devis et client retenu par l'app est lié à **l'entreprise QuickBooks** où il a été créé.
  Un numéro venu de l'entreprise de test n'est **jamais** réutilisé dans le vrai dossier (la facture 182
  du test n'est pas la facture 182 du vrai QuickBooks).
- Une facture faite dans l'**entreprise de test** laisse le bon dans **« Prêt à facturer »** (badge « 🧪 test ») :
  le client n'a pas été facturé pour vrai.
- Le lien d'une facture de test s'ouvre correctement seulement si l'entreprise de test est ouverte
  (developer.intuit.com › Sandbox companies › clique l'entreprise). Si le navigateur est connecté au vrai
  QuickBooks, le lien affiche la facture du **vrai** dossier qui porte le même numéro interne : n'y touche pas.
- Le bouton **🧾 Facturer** est seulement dans « Prêt à facturer ». Dans « Facturé », le badge
  « 📗 Facture n° … » ouvre la facture. Pour corriger une facture : ramène le bon dans « Prêt à facturer »
  et refacture (la même facture est mise à jour).

## Ce que ça fait

Sur chaque soumission, un bouton **📗 Envoyer dans QuickBooks** crée un **devis** (Estimate)
dans ton dossier QuickBooks en ligne :

- chaque article de la soumission → son produit QuickBooks s'il existe, sinon une ligne sur
  l'article **« Pièce »**, description = `numéro description` (ex. `295100522 Filtre à huile`) ;
- chaque ligne de main-d'œuvre → une ligne sur l'article **« Atelier »** (hivernisation : service **« Hivernisation »** et sa description, v160) ;
- les lignes « Sous-total — option » → une ligne de texte (sans montant) ;
- le client est retrouvé dans QuickBooks par son nom, ou créé (téléphone, courriel, adresse) ;
- taxes : code **TPS/TVQ QC** choisi automatiquement (modifiable dans les réglages), QuickBooks
  calcule lui-même les montants ;
- n° du devis = n° de la soumission (`S-2026-0042`) si ta numérotation personnalisée est
  active dans QuickBooks, sinon QuickBooks attribue le sien ;
- la machine et la note au client vont dans le message du devis ;
- **un second envoi met à jour le même devis** (pas de doublon), même depuis un autre appareil.

Les articles « Pièce » et « Atelier » sont créés dans QuickBooks s'ils n'existent pas
(compte de revenus « Ventes ») ; « Pièces », « Piece » ou « PIECE » déjà présents sont repris tels quels.
Tu peux les renommer dans les réglages si tu utilises d'autres noms.

Option : case **« Envoyer automatiquement quand le client accepte en ligne »** dans les réglages.

## Sans attendre Intuit : le CSV (bouton « 📄 CSV QuickBooks »)

Sur la soumission, **📄 CSV QuickBooks** télécharge un fichier au format d'import natif de
QuickBooks en ligne. Dans QuickBooks : **Paramètres ⚙ → Importer des données → Factures**,
choisis le fichier, format de date **AAAA-MM-JJ**, taxe **exclusive**, coche « créer les
nouveaux clients / produits », associe la colonne `ItemTaxCode` à ton code TPS/TVQ QC.
Limite QuickBooks : ce sont des **factures** (l'import CSV ne fait pas de devis) ; 100 factures
et 1 000 lignes par fichier. Mêmes règles que l'API : « Pièce » + `numéro description`,
« Atelier », machine et note dans le mémo.

## Ce qui est déjà en place côté serveur

- Fonction Supabase `quickbooks` (déployée, v2) — OAuth Intuit, création/mise à jour des devis.
- Tables `qbo_connexion` (jetons, invisibles depuis l'app) et `qbo_envois` (journal des envois).
- Aucun jeton QuickBooks ne passe par le navigateur.

## À faire une seule fois : créer l'app Intuit (≈ 10 min)

1. Va sur **https://developer.intuit.com** et connecte-toi avec le compte Intuit de la shop
   (celui qui ouvre QuickBooks).
2. **Dashboard → Create an app → QuickBooks Online and Payments.**
   Nom : `Suivi Garage MTR`. Portée (scope) : **Accounting** seulement.
3. Onglet **Keys & credentials**. Tu y verras deux jeux de clés :
   - **Development** → fonctionne tout de suite, mais seulement sur un dossier *sandbox*
     (dossier d'essai que tu crées dans le même portail, menu Sandbox).
   - **Production** → ton vrai dossier. Intuit exige d'abord de remplir la section
     **App details / questionnaire d'évaluation** (voir plus bas).
4. Dans **Redirect URIs**, ajoute exactement :

   ```
   https://riwamsdpynpbjfadajlz.supabase.co/functions/v1/quickbooks/callback
   ```

   (le bouton « Copier » des réglages de l'app te la donne aussi). Enregistre.
5. Copie le **Client ID** et le **Client Secret** du jeu de clés choisi.

## Dans l'app Suivi Garage

1. Connecte-toi avec ton **compte d'employé (mot de passe)** — le NIP seul ne donne pas accès
   à QuickBooks. Seul un administrateur peut configurer la connexion ; tous les employés
   peuvent ensuite envoyer des soumissions.
2. **Soumissions → ⚙️ Réglages → QuickBooks en ligne.**
3. Colle le Client ID et le Client Secret, choisis **Production** (ou **Sandbox** pour tester),
   clique **Enregistrer les clés**.
4. Clique **Connecter à QuickBooks** → page Intuit → choisis le dossier → **Connect**.
   Tu reviens dans l'app avec un message « QuickBooks connecté — Groupe MTR Performance inc. ».
5. Vérifie le **code de taxe** proposé (TPS/TVQ QC) et, si tu veux, les noms d'articles.
6. Ouvre une soumission → **📗 Envoyer dans QuickBooks**. Le devis apparaît dans
   QuickBooks → Ventes → Devis ; un lien « Ouvrir dans QuickBooks » s'affiche sur la fiche.

La connexion se renouvelle d'elle-même à chaque envoi. Si aucun envoi n'est fait pendant
100 jours, Intuit la fait expirer : l'app te demandera alors de cliquer « Reconnecter ».

## Questionnaire Intuit pour les clés de production

Intuit l'exige pour tout accès à un vrai dossier, même pour une app privée. Dans **App details** :

- Type d'app : **privée / usage interne** (« We're building a private app »).
- Host domain : `atelier.mtrperformance.ca`
- Launch URL : `https://atelier.mtrperformance.ca/`
- Disconnect URL : `https://atelier.mtrperformance.ca/`
- Liens **politique de confidentialité** et **conditions d'utilisation** : deux pages sur le
  site Wix de la shop suffisent (une phrase indiquant que l'outil est interne à MTR Performance).
- Catégorie : « Field service / Repair » ou similaire ; hébergement : Canada (Supabase ca-central-1).

Une fois la section complétée, les clés de production s'activent (généralement le jour même).
En attendant, tout se teste avec les clés **Development** + un dossier **Sandbox**.

## Si ça bloque

- « Connecte-toi avec ton compte d'employé » → l'appareil est en mode NIP ; ouvre une session
  avec mot de passe.
- « redirect_uri is invalid » sur la page Intuit → l'URL de redirection n'est pas inscrite
  **exactement** dans l'app Intuit (vérifie le jeu de clés : Development vs Production).
- « Duplicate Name Exists » → un fournisseur/employé QuickBooks porte déjà le nom du client :
  l'app crée le client avec le suffixe « (client) ».
- Le journal des envois (succès et erreurs) est dans Supabase → Table Editor → `qbo_envois`.

## Fichiers livrés

- `index.html` — l'app (à déployer sur Netlify comme d'habitude, puis fermer/rouvrir
  l'app sur tous les appareils).
- `mtr-ajouter-brp.user.js` — inchangé.
- `edge/quickbooks/index.ts` — source de la fonction Supabase (déjà déployée).
- `edge/qbo_connexion.sql` — migration (déjà appliquée).
