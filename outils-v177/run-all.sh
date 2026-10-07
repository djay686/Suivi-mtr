#!/bin/bash
# run-all.sh — non-régression Suivi-Garage-Partage (test-v159.js … test-v1xx.js, chacun contre index.html).
#   outils-v177/run-all.sh [./index.html] [motif]
#     motif = expression régulière sur le nom du test (ex. 'v17[0-9]'). Sort avec le nombre de fichiers en échec.
#   Exécuteur par défaut : Chromium / Playwright (run-in-chromium.js), sans jsdom.
#     Avec jsdom installé : RUNNER=node NODE_PATH=/chemin/node_modules outils-v177/run-all.sh
#   MTR_FAKE_NOW="2026-10-07T10:00:00-04:00" simule un mercredi (test-v168b.js échoue le samedi et le dimanche, ligne 141).
#   SKIP (regex, défaut test-v171.js) : test-v171.js exige bt089/ et bt089.zip, absents du dépôt.
R=$(cd "$(dirname "$0")" && pwd); cd "$R/.." || exit 2
INDEX=${1:-./index.html}; MOTIF=${2:-.}; SKIP=${SKIP:-test-v171\.js}
RUNNER=${RUNNER:-node $R/run-in-chromium.js}
export PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}
AVANT=$(git status --porcelain 2>/dev/null | md5sum)
mal=0; n=0; t0=$(date +%s)
printf "%-18s %9s %7s  %-7s %s\n" test "ok/total" durée attendu état
for f in test-v1*.js; do
  [[ "$f" =~ $MOTIF ]] || continue
  if [[ -n "$SKIP" && "$f" =~ $SKIP ]]; then printf "%-18s %9s %7s  %-7s %s\n" "$f" - - - "SAUTÉ (voir SKIP)"; continue; fi
  attendu=$(grep -h -o -E "\`$f\` \| [0-9]+/[0-9]+" CHANGELOG-atelier-v17[5-9].md 2>/dev/null | grep -o -E "[0-9]+/[0-9]+" | head -1)
  s=$(date +%s%N)
  sortie=$(timeout 240 $RUNNER "$f" "$INDEX" 2>&1); code=$?
  d=$(awk -v a="$s" -v b="$(date +%s%N)" 'BEGIN{printf "%.1fs", (b-a)/1e9}')
  ok=$(grep -c '^✅' <<<"$sortie"); ko=$(grep -c '^❌' <<<"$sortie")
  etat="OK"; if [ "$ko" -gt 0 ] || [ $code -ne 0 ] || [ "$ok" -eq 0 ]; then etat="ECHEC"; mal=$((mal+1)); grep '^❌' <<<"$sortie" | head -5 | sed 's/^/      /'; fi
  printf "%-18s %9s %7s  %-7s %s\n" "$f" "$ok/$((ok+ko))" "$d" "${attendu:--}" "$etat"
  n=$((n+1))
done
[ "$AVANT" = "$(git status --porcelain 2>/dev/null | md5sum)" ] || echo "ATTENTION : un test a modifié le dépôt (git status a changé)"
echo "$n fichiers, $mal en échec, $(( $(date +%s) - t0 )) s"
exit $mal
