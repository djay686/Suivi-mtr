# 📋 Procédures de travail par Claude — installation (v167, import en v171)

Le bouton **📋 Procédure** du bon de travail live demande à Claude une procédure interactive (comme celle du BT-089) :
étapes à cocher, matériel, specs, mesures avec limites, pages du manuel d'atelier. Il faut préparer le serveur **une fois**.

## 1. Les tables et l'espace des manuels (2 min)

Supabase → **SQL Editor** → **New query** → coller tout le contenu de `edge/procedures.sql` → **Run**.

Ça crée :
- `procedures` : une procédure par bon (on peut la refaire), avec son contenu et son coût ;
- `procedure_etat` : les coches et les mesures, **une ligne par case** (deux tablettes sur le même bon ne s'écrasent pas) ;
- `manuels` et `manuel_pages` : la bibliothèque de manuels d'atelier (le texte de chaque page) ;
- l'espace de stockage privé **manuels** pour les PDF (jusqu'à 500 Mo par fichier) ;
- le temps réel (une case cochée sur une tablette apparaît sur les autres).

Le script se relance sans danger.

> **Gros manuels** : Supabase limite aussi la taille des fichiers pour tout le projet (50 Mo sur le plan gratuit).
> Storage → **Settings** → « Upload file size limit ». Si un PDF dépasse la limite, l'app garde quand même son **texte**
> (Claude peut le lire), mais les pages ne s'affichent pas dans la procédure (« texte seulement »).

## 2. La fonction serveur `procedure-claude` (3 min)

Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor** :
1. Nom : `procedure-claude` (exactement).
2. Remplacer le code d'exemple par tout le contenu de `edge/procedure-claude/index.ts`.
3. **Deploy function**.
4. Laisser « Verify JWT » **activé** : seuls les employés connectés peuvent s'en servir.

Ou en ligne de commande, depuis le dossier qui contient `supabase/functions/procedure-claude/index.ts` :

```bash
supabase functions deploy procedure-claude --project-ref riwamsdpynpbjfadajlz
```

## 3. La clé de Claude

Edge Functions → **Secrets** : `ANTHROPIC_API_KEY` doit y être. Elle y est déjà si l'🤖 Assistant fonctionne
(même clé). Sinon : console.anthropic.com → API Keys → créer une clé → l'ajouter ici.

Facultatif — **forfait Supabase payant** : ajouter le secret `PROCEDURE_LIMITE_S` = `380`. Une fonction peut y durer
400 s (150 s sur le forfait gratuit) ; Claude a alors plus de temps pour ses recherches. Sans ce secret, la fonction
s'arrête à 140 s avec le message « Claude a pris trop de temps : réessaie (ou décoche la recherche internet) ».

## 4. Essayer

Bon de travail live → **📋 Procédure** → **✨ Créer la procédure**. Compter 2 à 5 minutes.
La fenêtre montre où ça en est ; on peut la fermer, la création continue tant que l'app reste ouverte sur cet appareil.

## Comment ça marche

1. **Plan** (1 à 2 min) : Claude lit le bon (travaux, pièces, soumission, notes du technicien), les pages du manuel
   qui parlent de ces travaux, et cherche sur internet (specs du fabricant, huiles, couples, n° de pièces).
   Il écrit le plan : étapes, matériel, outils, décisions à demander au client, specs.
2. **Détail** : les étapes sont détaillées par groupes de 3, jusqu'à 4 groupes en même temps (cases à cocher, côtés
   G/D ou cylindres, mesures avec limites, pages du manuel à voir). Un groupe qui échoue est réessayé une fois.
3. Si des étapes restent sans détail, la procédure est « incomplète » mais utilisable ; **↻ Compléter** refait
   seulement celles qui manquent.

**Manuel d'atelier** : « ➕ Ajouter un manuel (PDF) » dans la fenêtre. Le texte est lu sur l'appareil (page par page),
puis le PDF est gardé sur le serveur. Un manuel sert à toutes les procédures de ce modèle : celui qui correspond
au modèle (et à l'année) de la machine est marqué ★ et choisi d'office. Sans manuel, Claude fait seulement la
recherche internet. Les PDF numérisés (images sans texte) sont mal lus : l'app le signale.

## 📥 Importer une procédure déjà faite (v171)

Une procédure que Claude a faite **ailleurs** (sur un autre ordinateur, dans claude.ai), comme « Procédure BT-089 » :
un dossier avec `index.html` et un dossier `img` de photos.

**Une fois** : relancer `edge/procedures.sql` dans le SQL Editor. Ça ajoute l'espace privé **procedures** pour les
photos (10 Mo par image). Le reste était déjà là.

Dans le bon de travail live → **📋 Procédure** → **📥 Procédure déjà faite** :
- **📄 Fichier .html ou .zip** :
  - `index.html` seul : les étapes, cases, specs et mesures, **sans les photos** ;
  - le **.zip** du dossier (clic droit sur le dossier → Envoyer vers → Dossier compressé) : **avec les photos**.
- **📁 Dossier de la procédure** : choisir le dossier au complet (sur un ordinateur). Avec les photos, sans rien compresser.

Ce que ça donne :
- Elle devient une procédure **de ce bon**, comme celles que Claude crée dans l'app :
  - coches partagées entre les tablettes ;
  - mesures avec leur verdict vert / jaune / rouge ;
  - résumé → notes du BT.
- Elle garde :
  - la préparation et les décisions du client ;
  - les cases par côté (G / D) ou par coin ;
  - les alertes, les specs ;
  - les références du manuel ;
  - les **figures** (galerie de l'étape, et bouton « Fig. » sur la case qui en parle).
- **📺 TV** dans la procédure : la TV montre l'étape avec sa figure. À la télécommande :
  - **▶ ◀** : étape suivante / précédente ;
  - **▲ ▼** : figure suivante / précédente de l'étape.
- Faite pour **un autre BT** (ex. BT-089 dans BT-103) : l'app demande avant d'importer.

Bon à savoir :
- **Sécurité** : la page n'est jamais exécutée dans l'app. Elle tourne dans un cadre isolé, sans accès à l'app ni à ta
  session, et l'app ne reprend que ses données.
- Les calculs propres à une page (ex. « dimensions différentes avant / arrière : pas de permutation ») ne sont pas
  repris. Les limites des mesures, elles, le sont (ex. courroie : minimum 34,7 mm).
- Une page d'un autre format est lue « texte seulement » :
  - chaque titre devient une étape ;
  - chaque liste devient des cases ;
  - les images suivent.
- Supprimer la procédure (🗑️, administration) retire aussi ses photos.

## Coût

Environ **0,50 $ à 1,50 $ US par procédure** (Claude Opus 5.5 + recherches web). Le coût approximatif de chaque
procédure est affiché dans la liste du bon. Le suivi exact est sur console.anthropic.com → Usage.

## À savoir

- Il faut un **compte d'employé** (courriel + mot de passe) : un employé connecté seulement avec son NIP ne peut pas créer
  de procédure (l'app le lui dit).
- Les valeurs viennent du manuel ou de sources fiables ; ce que Claude n'a pas pu confirmer est marqué « à confirmer
  au manuel ». La procédure aide le technicien, elle ne remplace pas le manuel du fabricant.
- Seule l'administration peut **supprimer** une procédure (🗑️) ; la supprimer efface aussi ses coches.
- Si le filtre de sécurité de l'API refuse une demande (rare pour de la mécanique), la fonction la reprend
  automatiquement sur le modèle recommandé par Anthropic (`fallbacks: "default"`).
