# Suivi-Garage-Partage — v163 (25 sept. 2026)

Bâtie sur la v162. Aucun changement côté serveur.

## « Travailles-tu encore ? » avant la fermeture de la session (demande de Jason, modèle QuickBooks)
Règle gardée : la session d'un employé se ferme **12 h après sa connexion** (nouvelle journée, appareils partagés).
Avant, rien ne l'annonçait : on retombait sur l'écran de connexion au prochain chargement, sans savoir pourquoi.

- **5 minutes avant la fin**, une fenêtre s'ouvre par-dessus tout (bon live, calendrier…) :
  - titre « Travailles-tu encore ? » ;
  - texte : « Jason, ta session se ferme 12 h après la connexion. Dis-nous si tu veux fermer la session ou continuer à travailler. » ;
  - **compte à rebours** : « Fermeture automatique dans 4:31 » ;
  - boutons **Fermer la session** / **Continuer à travailler**, dans le style de QuickBooks.
- **Continuer à travailler** (ou ✕, ou Échap) : la session repart pour 12 h. Toast « ✅ Session prolongée de 12 h ». Vaut aussi pour les autres onglets ouverts sur le même appareil.
- **Fermer la session** : même chose que « Changer d'utilisateur ».
- **Sans réponse** : à 0:00, la session se ferme (cet appareil seulement, règle v162). L'écran de connexion l'explique : « 🔒 La session de Jason a été fermée automatiquement (12 h après la connexion). Reconnecte-toi pour continuer. »
- **App fermée ou téléphone en veille au moment de la fin** : même message au retour. Il ne s'affiche qu'une fois.
- **Écran d'atelier (2e moniteur)** : jamais fermé tout seul pendant qu'il est affiché.
- Vérifié toutes les 15 s, et aussi au retour dans l'app (onglet ou app remis au premier plan).

Rappel v162 : si c'est la connexion au **serveur** qui saute, la fenêtre « 🔒 Reconnexion au serveur » redemande le mot de passe sans fermer la session.

## Tests
- `test-v163.js` 34/34 :
  - apparition de la fenêtre : 2 h (rien), 4 min avant la fin (fenêtre + textes + compte à rebours qui avance) ;
  - Continuer / ✕ / Échap ;
  - fermeture automatique, avec le message et en déconnexion locale ;
  - compte à rebours qui arrive à 0 ; Fermer la session (sans message) ;
  - écran d'atelier ; prolongation dans un autre onglet ; session sans heure ;
  - session échue app fermée (message une seule fois) ; nom échappé.
- Sabotages : 11 fautes volontaires, toutes attrapées. `test-v163.js` sur la v162 : échoue.
- Non-régression : `test-v162.js` 36/36, `test-v161.js` 42/42, `test-v160.js` 16/16, `test-v159.js` 63/63, `test-v159b.js` 8/8. Syntaxe des 12 blocs : OK.
- Captures Chromium (ordinateur jour et nuit, iPhone 390 px) de la fenêtre et de l'écran de connexion : lisibles, par-dessus le reste, aucun débordement, 0 erreur JavaScript.
