#!/bin/bash
# usage : sabotage.sh <test-vNNN.js> "<texte exact à remplacer dans index.html>" "<remplacement>"
# Copie index.html / tv.html / procedure.html dans un dossier temporaire, y applique UNE faute (le texte doit exister une seule fois),
# lance le test contre la copie : il DOIT échouer (exit 1). Le dépôt n'est jamais touché.
set -e
R=$(cd "$(dirname "$0")" && pwd); REPO=${REPO:-/home/user/Suivi-mtr}
T=$1; AVANT=$2; APRES=$3
S=$(mktemp -d "$R/sab-XXXX"); trap 'rm -rf "$S"' EXIT; cp "$REPO"/index.html "$REPO"/tv.html "$REPO"/procedure.html "$S"/
AVANT="$AVANT" APRES="$APRES" S="$S" node -e '
const fs=require("fs"),f=process.env.S+"/index.html";let h=fs.readFileSync(f,"utf8");
const n=h.split(process.env.AVANT).length-1; if(n!==1){console.error("SABOTAGE INVALIDE : "+n+" occurrence(s)");process.exit(3)}
fs.writeFileSync(f,h.replace(process.env.AVANT,()=>process.env.APRES));'
cd "$REPO"
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node "$R/run-in-chromium.js" "$T" "$S/index.html" > "$S/out.txt" 2>&1 || true
grep -E "^❌|##RESULT" "$S/out.txt" | cut -c1-200
if grep -q '"ko":0' "$S/out.txt" && ! grep -q "exitCode\":1" "$S/out.txt"; then echo "=> NON ATTRAPÉ (le test passe malgré la faute)"; else echo "=> ATTRAPÉ"; fi
