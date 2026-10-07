// ==UserScript==
// @name         MTR — Ajouter à la soumission depuis la boutique BRP
// @namespace    mtrperformance.ca
// @version      2.4
// @description  Bouton « + Ajouter » sur chaque pièce du catalogue BRP (Sea-Doo, Ski-Doo, Can-Am) → panier de la soumission MTR, ou pièces à commander d'un bon de travail (v178). Apprend le chemin de navigation vers la machine et le rejoue à l'ouverture.
// @match        https://sea-doo-shop.brp.com/*
// @match        https://ski-doo-shop.brp.com/*
// @match        https://can-am-shop.brp.com/*
// @match        https://*.arinet.com/*
// @match        https://*.partstream.net/*
// @updateURL    https://atelier.mtrperformance.ca/mtr-ajouter-brp.user.js
// @downloadURL  https://atelier.mtrperformance.ca/mtr-ajouter-brp.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
  COMMENT ÇA MARCHE
  - Dans le catalogue, chaque ligne de pièce (numéro + prix) reçoit un bouton
    jaune « + Ajouter ». Le clic envoie numéro, nom et prix à l'outil de
    soumission MTR (ou au bon de travail d'où la recherche a été lancée : v178)
    ouvert dans l'autre onglet. Rien n'est copié d'avance.
  - Le catalogue ARI ne met pas la machine dans l'adresse. Alors le script
    NOTE les clics de navigation (année, famille, modèle, diagramme…) et les
    envoie avec la pièce. L'outil mémorise ce « chemin » pour la machine et,
    à la prochaine ouverture, le script REJOUE les clics tout seul : le tech
    tombe directement sur la machine.
*/

(function () {
  'use strict';

  const OUTIL_URL = 'https://atelier.mtrperformance.ca/'; // Suivi-Garage-Partage (repli si l'onglet BRP n'a pas été ouvert depuis l'application)
  const RX_PN   = /\b(\d{6,10})\b/;
  const RX_PRIX = /(\d{1,3}(?:[  ]?\d{3})*(?:[.,]\d{2}))\s*\$|\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/;
  const MARQUE  = location.hostname.includes('ski-doo') ? 'skidoo' : location.hostname.includes('can-am') ? 'canam' : 'seadoo';
  const EN_HAUT = window === window.top;
  const VERSION = '2.4';
  const RX_MODELE = /\b(19|20)\d{2}\s+\d{4,}[A-Z0-9]{2,}\b/;   // « …, 2015 00060FA00 » ou « … NO CAT - 2025 00041SB00 » : un modèle avec ses codes

  /* ---------- style ---------- */
  const style = document.createElement('style');
  style.textContent = `
    .mtr-add{all:unset; display:inline-flex; align-items:center; gap:4px; margin-left:8px; padding:6px 12px; border-radius:8px; background:#F5B400; color:#172029; font:700 14px/1 system-ui,sans-serif; cursor:pointer; vertical-align:middle; white-space:nowrap}
    .mtr-add:hover{background:#DDA200}
    .mtr-add.ok{background:#1F8A5B; color:#fff}
    .mtr-bar{position:fixed; right:12px; top:150px; z-index:2147483647; background:#172029; color:#EDF0F3; padding:10px 14px; border-radius:10px; font:500 13px/1.3 system-ui,sans-serif; box-shadow:0 8px 24px rgba(0,0,0,.3); max-width:340px}
    .mtr-bar b{color:#F5B400}
    .mtr-bar.haut{top:150px; right:12px}
    .mtr-bar:not(.haut){top:auto; bottom:12px; left:12px; right:auto}
    .mtr-bar.mini{top:auto; bottom:10px; right:10px; left:auto; padding:5px 10px; font-size:11px; opacity:.55; max-width:none; border-radius:999px; cursor:default}
    .mtr-bar.mini:hover{opacity:1}
    .mtr-toast{position:fixed; left:50%; bottom:56px; transform:translateX(-50%); z-index:2147483647; background:#172029; color:#EDF0F3; padding:10px 16px; border-radius:10px; font:600 14px system-ui,sans-serif; box-shadow:0 8px 24px rgba(0,0,0,.3); opacity:0; transition:opacity .2s; pointer-events:none; max-width:70vw; text-align:center}
    .mtr-toast.show{opacity:1}
  `;
  document.head.appendChild(style);
  const bar = document.createElement('div');
  bar.className = 'mtr-bar' + (EN_HAUT ? ' haut' : '');
  document.body.appendChild(bar);
  /* ce que le formateur nous dit : la case choisie, la dernière liaison faite, la prochaine case */
  let cible = null, relie = null, prochaine = null, dernierMsg = '', formateurLie = false, total = 0;
  let cibleApp = '';   // v2.4 : où l'application range les pièces (« BT-123 · pièces à commander » ou « soumission SO-0123 »), dit par MTR_PANIER ; vide = application plus ancienne
  const dest = () => cibleApp || 'soumission';
  const BTN = 'all:unset;margin-top:6px;margin-right:6px;padding:6px 10px;border-radius:6px;background:#F5B400;color:#172029;font:700 12px system-ui;cursor:pointer';
  const BTN2 = BTN + ';background:#EDF0F3;color:#172029';
  const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toastEl = document.createElement('div'); toastEl.className = 'mtr-toast'; document.body.appendChild(toastEl);
  let toastT; const toast = m => { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600); };
  let modeComplet = false;   // double-clic sur la pastille pour tout voir (diagnostic)
  bar.addEventListener('dblclick', () => { modeComplet = !modeComplet; statut(dernierMsg || 'Prêt.'); });
  const statut = msg => {
    dernierMsg = msg;
    if (!formateurLie && !modeComplet) {
      // mode technicien : une pastille discrète, aucun bouton (rien à accrocher par erreur)
      bar.className = 'mtr-bar mini';
      const o = opener(); const lie = o && !o.closed;
      bar.textContent = 'MTR v' + VERSION + (lie ? ' · lié → ' + dest() : ' · non lié') + (total ? ' · ' + total + ' pièce' + (total > 1 ? 's' : '') : '');
      return;
    }
    bar.className = 'mtr-bar' + (EN_HAUT ? ' haut' : '');
    let haut = '';
    if (relie) haut += `<div style="color:#7FD1A6;font-weight:700">✓ Relié : ${esc(relie)}</div>`;
    if (cible) haut += `<div style="font-size:15px;font-weight:700;color:#F5B400;margin-bottom:4px">Case choisie : ${esc(cible)}</div>`;
    else if (formateurLie) haut += '<div style="color:#96A2AD">Aucune case choisie dans le formateur.</div>';
    let boutons = `<button type="button" id="mtr-memo" style="${BTN}">Mémoriser cette machine</button>`;
    if (modeComplet) boutons += `<button type="button" id="mtr-diag" style="${BTN2}" title="Copie ce que le script voit sur ce diagramme (à coller à Claude)">Diagnostic repères</button>`;
    if (cible) boutons += `<button type="button" id="mtr-x" style="${BTN2};color:#B45309" title="Cette machine n'est pas dans le catalogue BRP : marquer ✕ et passer à la suivante">✕ N’existe pas</button>`;
    if (prochaine) boutons += `<button type="button" id="mtr-next" style="${BTN2}">Prochaine : ${esc(prochaine)} →</button>`;
    bar.innerHTML = haut + `<div style="opacity:.85">${msg}</div>` + boutons;
    const b = bar.querySelector('#mtr-memo'); if (b) b.addEventListener('click', () => envoyerMachine(true));
    const n = bar.querySelector('#mtr-next'); if (n) n.addEventListener('click', () => { const o = opener(); if (o && !o.closed) o.postMessage({ type: 'MTR_SUIVANT' }, '*'); });
    const x = bar.querySelector('#mtr-x'); if (x) x.addEventListener('click', () => { const o = opener(); if (o && !o.closed) o.postMessage({ type: 'MTR_INEXISTANT' }, '*'); });
    const dg = bar.querySelector('#mtr-diag'); if (dg) dg.addEventListener('click', diagnostic);
  };
  /* ce que le script voit : les repères des lignes, les grandes images, et les éléments dont le texte est un repère */
  function diagnostic() {
    const out = { version: VERSION, url: location.href, cadre: EN_HAUT ? 'haut' : 'cadre', panier: [...panier.keys()], appris: appris, reperes: {}, images: [], candidats: [] };
    const toks = new Set();
    for (const b of boutonsAjout()) { const l = b.closest('.mtr-ligne'); const r = l ? extraire(l).repere : null; if (r) { out.reperes[b.dataset.pn] = r; tokensRepere(r).forEach(t => toks.add(t.toLowerCase())); } }
    for (const el of tousElements()) {
      const tag = el.tagName ? el.tagName.toLowerCase() : ''; const r = el.getBoundingClientRect();
      if ((tag === 'img' || tag === 'svg' || tag === 'canvas' || tag === 'iframe') && r.width >= 120) out.images.push({ tag, w: Math.round(r.width), h: Math.round(r.height), classe: (el.getAttribute('class') || '').slice(0, 60), src: (el.getAttribute('src') || '').slice(0, 80) });
      if (el.closest && el.closest('.mtr-ligne, .mtr-bar')) continue;
      const txt = (el.textContent || '').trim().toLowerCase();
      if (r.width >= 8 && r.width <= 130 && r.height >= 6 && r.height <= 70 && surImage(r, grandesImages()) && txt.length <= 12 && out.candidats.length < 40) {
        const chaine = []; let n = el; for (let i = 0; i < 4 && n && n.tagName; i++, n = n.parentElement || (n.getRootNode && n.getRootNode().host)) chaine.push(n.tagName.toLowerCase() + (n.getAttribute && n.getAttribute('class') ? '.' + String(n.getAttribute('class')).trim().split(/\s+/).slice(0, 2).join('.') : ''));
        out.candidats.push({ texte: txt, w: Math.round(r.width), h: Math.round(r.height), attrs: attrsDe(el).slice(0, 6), chaine: chaine.join(' < '), marque: marques.has(el), appris: zonesConnues.get(el) || null });
      }
    }
    const txt = JSON.stringify(out, null, 1);
    navigator.clipboard.writeText(txt).then(() => toast('Diagnostic copié — colle-le à Claude'), () => { prompt('Copie ce texte :', txt); });
  }
  window.addEventListener('message', e => {
    const d = e.data; if (!d || d.type !== 'MTR_CIBLE') return;
    formateurLie = true; cible = d.cible || null; relie = d.relie || null; prochaine = d.prochaine || null;
    if (d.relie || d.auto) machineEnvoyee = '';   // la case a changé : la même page pourra être renvoyée pour la prochaine case
    statut(dernierMsg || 'Prêt.');
    if (d.auto && Array.isArray(d.prefixe)) setTimeout(() => allerA(d.prefixe), 200);
  });

  /* ---------- chemin jusqu'à la machine (année → modèle), sans le diagramme ---------- */
  let machineEnvoyee = '';
  function estListeDiagrammes() {
    // la liste des diagrammes ARI est faite d'entrées numérotées « 01- Engine - Crankcase », « 02- … »
    const noms = new Set();
    for (const el of tousElements()) {
      if (el.children.length > 3) continue;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^\d{2}-\s*\S/.test(t) && t.length < 80 && !RX_MODELE.test(t)) noms.add(t);
      if (noms.size >= 3) return true;
    }
    return false;
  }
  /* Le fil d'Ariane de BRP (« Sea-Doo (Canada) CAD » Sea-Doo Watercraft » 2016 ») dit
     exactement où on est, peu importe comment on y est arrivé. On le lit en premier. */
  function lireFilAriane() {
    let meilleur = null;
    for (const el of tousElements()) {
      if (el.closest && el.closest('.mtr-bar')) continue;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t.includes('»') || t.length > 600) continue;
      const attr = ((el.getAttribute && (el.getAttribute('aria-label') || '')) + ' ' + (typeof el.className === 'string' ? el.className : '')).toLowerCase();
      const n = (t.match(/»/g) || []).length;
      const parAttr = /breadcrumb|crumb|ariane/.test(attr);
      // priorité : bloc marqué « breadcrumb » > plus de séparateurs > texte le plus court
      if (!meilleur || (parAttr && !meilleur.parAttr) || (parAttr === meilleur.parAttr && (n > meilleur.n || (n === meilleur.n && t.length < meilleur.t.length)))) meilleur = { el, t, n, parAttr };
    }
    if (!meilleur) { filEl = null; return null; }
    const items = meilleur.t.split('»').map(x => x.trim()).filter(Boolean);
    if (!items.length || items.some(x => x.length > 120)) { filEl = null; return null; }   // pas un fil d'Ariane
    filEl = meilleur.el;
    if (items.length >= 2) dernierFil = items.slice();
    return items;
  }
  let filEl = null, dernierFil = null;
  function cliquerFil(label) {
    if (!filEl) return false;
    const cands = [...tousElements(filEl)].filter(el => el.children.length <= 1 && (el.textContent || '').replace(/\s+/g, ' ').trim() === label);
    const el = cands.find(x => x.tagName === 'A' || x.getAttribute('role') === 'link' || x.onclick) || cands[0];
    if (!el) return false;
    el.click(); return true;
  }
  /* Ramener BRP à la page d'une année : marque › famille › année (le préfixe vient du formateur) */
  let navigationEnCours = false;
  async function allerA(prefixe) {
    if (!prefixe || prefixe.length < 2 || navigationEnCours) return;
    navigationEnCours = true;
    try {
      const annee = prefixe[prefixe.length - 1];
      const fil = lireFilAriane() || [];
      const i = fil.indexOf(annee);
      if (i >= 0 && fil.slice(0, i).join('|') === prefixe.slice(0, -1).join('|')) {
        // déjà dans la bonne année : remonter à sa page par le fil d'Ariane
        if (fil.length - 1 > i) cliquerFil(annee);
        statut(`Page de ${annee} — choisis la famille puis le modèle.`);
        return;
      }
      if (fil.length) { cliquerFil(fil[0]); await dormir(900); }   // retour à la racine
      const ok = await rejouer(prefixe.slice(1).map(t => (typeof t === 'string' ? { t } : t)));
      if (ok) statut(`Page de ${annee} — choisis la famille puis le modèle.`);
    } finally { navigationEnCours = false; }
  }
  function cheminMachine() {
    const fil = lireFilAriane();
    if (fil && fil.length) {
      const etapes = fil.slice();
      if (estListeDiagrammes()) {
        // sur la grille de diagrammes, le modèle est un titre sous le fil d'Ariane, pas dedans
        let titre = null;
        for (const el of tousElements()) {
          if (el.children.length > 3) continue;
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (t.length <= 400 && RX_MODELE.test(t) && !t.includes('»') && !(filEl && el.contains(filEl))) { titre = t; break; }
        }
        if (titre && titre !== etapes[etapes.length - 1]) etapes.push(titre);
      }
      return etapes.filter(t => !/^\d{2}\s*-\s*\S/.test(t) && !RX_PN.test(t) && !/^(Accueil|Home|Accessories|Accessoires)$/i.test(t)).map(t => ({ t }));
    }
    // repli : le journal de clics, repris à partir de la dernière fois qu'on est reparti de la racine
    let log = chemin.filter(c => !/^\d{2}\s*-\s*\S/.test(c.t) && !RX_PN.test(c.t));
    if (log.length) { const racine = log[0].t; const i = log.map(c => c.t).lastIndexOf(racine); if (i > 0) log = log.slice(i); }
    // si le fil d'Ariane n'est pas (encore) affiché mais qu'on en a vu un sur cette page, on le met devant
    if (dernierFil && log.length && !/\bCAD\b|Canada/i.test(log[0].t)) {
      const deja = new Set(dernierFil); return [...dernierFil.map(t => ({ t })), ...log.filter(c => !deja.has(c.t))];
    }
    return log;
  }
  function cheminComplet(ch) {
    if (!ch || ch.length < 3) return false;
    if (!/\bCAD\b|Canada/i.test(ch[0].t)) return false;                 // doit partir de la racine du catalogue
    if (!ch.some(c => /^(19|20)\d{2}$/.test(c.t))) return false;         // doit passer par une année
    return RX_MODELE.test(ch[ch.length - 1].t);                            // doit finir par un modèle
  }
  function envoyerMachine(manuel) {
    const ch = cheminMachine();
    if (!cheminComplet(ch)) {
      if (manuel) alert('Chemin incomplet : ' + (ch.map(c => c.t).join(' › ') || '(vide)') + '\n\nIl doit partir de « Sea-Doo (Canada) CAD », passer par l’année et finir par le modèle avec ses codes. Attends que le fil d’Ariane soit affiché en haut de la page, puis réessaie.');
      return;   // en automatique : on réessaie à la prochaine passe, sans marquer « envoyé »
    }
    if (!ch.length) { if (manuel) alert('Aucun clic de navigation noté encore. Choisis la marque, l’année et le modèle, puis réessaie.'); return; }
    const cle = JSON.stringify(ch);
    if (!manuel && cle === machineEnvoyee) return;
    if (!manuel) { const o = opener(); if (!o || o.closed) return; }
    machineEnvoyee = cle;
    versOutil({ type: 'MTR_CHEMIN_MACHINE', chemin: ch, marque: MARQUE, url: location.href, manuel: !!manuel });
    statut(`MTR : machine envoyée à l’outil — ${ch.map(c => c.t).join(' › ')}`);
  }
  const STYLE_BTN = 'all:unset;display:inline-flex;align-items:center;gap:4px;margin-left:8px;padding:6px 12px;border-radius:8px;background:#F5B400;color:#172029;font:700 14px/1 system-ui,sans-serif;cursor:pointer;vertical-align:middle;white-space:nowrap';
  const STYLE_OK  = STYLE_BTN + ';background:#1F8A5B;color:#fff';

  /* ---------- parcours qui entre dans les shadow DOM ---------- */
  function* tousElements(racine = document) {
    const pile = [racine];
    while (pile.length) {
      const r = pile.pop();
      const els = r.querySelectorAll ? r.querySelectorAll('*') : [];
      for (const el of els) { yield el; if (el.shadowRoot) pile.push(el.shadowRoot); }
    }
  }
  function* tousTextes(racine = document.body) {
    const pile = [racine];
    while (pile.length) {
      const r = pile.pop();
      const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let n;
      while ((n = w.nextNode())) {
        if (n.nodeType === 3) yield n;
        else if (n.shadowRoot) pile.push(n.shadowRoot);
      }
    }
  }

  /* ---------- lien vers l'outil MTR ---------- */
  function opener() { try { return window.top.opener; } catch (e) { try { return window.opener; } catch (e2) { return null; } } }
  function versOutil(msg) {
    const o = opener();
    if (o && !o.closed) { o.postMessage(msg, '*'); return true; }
    const u = new URL(OUTIL_URL); u.searchParams.set('ajout', JSON.stringify(msg)); window.open(u.toString(), 'mtr-outil');
    return false;
  }

  /* =====================================================================
     1. CHEMIN DE NAVIGATION — enregistrement des clics
     ===================================================================== */
  const chemin = [];   // [{t:'Spark'}, {t:'2019'}, {t:'Pompe à jet'}, …]
  function texteCliquable(el) {
    let n = el;
    for (let i = 0; i < 6 && n && n !== document.body; i++, n = n.parentElement) {
      const tag = n.tagName;
      if (/^(A|BUTTON|LI|OPTION|LABEL|TD|SUMMARY)$/.test(tag) || n.getAttribute('role') === 'button' || n.getAttribute('role') === 'option' || n.onclick || getComputedStyle(n).cursor === 'pointer') {
        const t = (n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t.length <= 400 && !n.classList.contains('mtr-add')) return t;
      }
    }
    return null;
  }
  document.addEventListener('click', e => {
    const cible = (e.composedPath && e.composedPath()[0]) || e.target;
    const el = cible.nodeType === 1 ? cible : cible.parentElement;
    if (!el || el.closest('.mtr-add, .mtr-bar')) return;
    const t = texteCliquable(el);
    if (!t) return;
    if (RX_PN.test(t) && RX_PRIX.test(t)) return;   // clic sur une ligne de pièce : pas de la navigation
    chemin.push({ t });
    if (chemin.length > 12) chemin.shift();
  }, true);
  document.addEventListener('change', e => {
    const s = e.target;
    if (s.tagName === 'SELECT' && s.selectedOptions[0]) chemin.push({ t: s.selectedOptions[0].text.trim(), select: true });
  }, true);

  /* ---------- moisson des options visibles pour le formateur ----------
     Les listes ARI sont numérotées (« 004 - RXP Series », « 001 - RXP 300, 2020 … »)
     ou faites d'années (« 2020 »). On les lit à l'écran et on les envoie avec le
     chemin courant : le formateur en déduit l'arbre marque › famille › année ›
     série › modèle sans qu'il faille cliquer chaque modèle.                  */
  let derniereMoisson = '';
  function moissonner() {
    const vues = new Set();
    for (const el of tousElements()) {
      if (el.closest && el.closest('.mtr-bar')) continue;
      if (el.children.length > 4) continue;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length > 400) continue;
      if (/^\d{3}\s*-\s*\S/.test(t) || /^(19|20)\d{2}$/.test(t) || /,\s*(19|20)\d{2}\s+\d{4,}[A-Z0-9]{2,}/.test(t)) vues.add(t);
    }
    const options = [...vues];
    if (options.length < 2) return;
    const o = opener(); if (!o || o.closed) return;   // pas d'outil lié : on ne fait rien (surtout pas ouvrir des onglets)
    const ch = cheminMachine();
    const cle = JSON.stringify([ch, options]);
    if (cle === derniereMoisson) return;
    derniereMoisson = cle;
    versOutil({ type: 'MTR_OPTIONS', chemin: ch, options, marque: MARQUE, diagrammes: estListeDiagrammes() });
  }

  /* =====================================================================
     2. REJOUER un chemin reçu de l'outil (via #mtr=… lu par la page du haut)
     ===================================================================== */
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  function trouverParTexte(t) {
    const tous = [...tousElements()];
    for (const s of tous.filter(e => e.tagName === 'SELECT')) {
      const o = [...s.options].find(o => o.text.trim() === t);
      if (o) return { select: s, option: o };
    }
    const cands = tous.filter(el => /^(A|BUTTON|LI|LABEL|TD|SUMMARY|DIV|SPAN|P|H\d)$/.test(el.tagName) || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'option')
      .filter(el => { if (el.closest('.mtr-bar')) return false; const x = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(); if (!x || x.length > 400) return false;
        const xs = x.replace(/^\d{3}\s*-\s*/, ''), ts = t.replace(/^\d{3}\s*-\s*/, '');
        return x === t || xs === ts || (ts.length > 20 && xs.startsWith(ts.slice(0, 40))) || (xs.length > 20 && ts.startsWith(xs.slice(0, 40))); })
      .sort((a, b) => (a.textContent.length - b.textContent.length) || (b.compareDocumentPosition(a) & 2 ? 1 : -1));
    return cands.length ? { el: cands[0] } : null;
  }
  async function rejouer(etapes) {
    statut(`MTR : navigation automatique… (${etapes.length} étapes)`);
    const fil = lireFilAriane() || [];
    if (fil.length > 1 && etapes.length && fil[0] === etapes[0].t) { cliquerFil(fil[0]); await dormir(900); etapes = etapes.slice(1); }   // déjà dans le catalogue : retour à la racine, puis on rejoue le reste
    else if (fil.length === 1 && etapes.length && fil[0] === etapes[0].t) etapes = etapes.slice(1);
    for (let i = 0; i < etapes.length; i++) {
      const t = etapes[i].t; let cible = null;
      for (let k = 0; k < 40 && !cible; k++) { cible = trouverParTexte(t); if (!cible) await dormir(250); }   // jusqu'à 10 s par étape
      if (!cible) { statut(`MTR : navigation arrêtée à l'étape ${i + 1} (« ${t} » introuvable). Continue à la main.`); toast(`Navigation arrêtée à « ${t.slice(0, 40)} » — continue à la main`); return false; }
      if (cible.select) { cible.select.value = cible.option.value; cible.select.dispatchEvent(new Event('change', { bubbles: true })); }
      else { cible.el.scrollIntoView({ block: 'center' }); cible.el.click(); }
      chemin.push(etapes[i]);
      await dormir(700);
    }
    statut('MTR : machine ouverte automatiquement. Touche « + Ajouter » sur une pièce.');
    toast('Machine ouverte — touche « + Ajouter » sur une pièce du diagramme');
    return true;
  }
  /* La page du haut lit #mtr=… (posé par l'outil de soumission) et le transmet au cadre
     qui contient le catalogue. Aussi quand l'adresse change sans rechargement (onglet réutilisé). */
  let recuChemin = false;
  function lancerDepuisHash() {
    if (!EN_HAUT) return;
    const m = location.hash.match(/#mtr=(.+)$/); if (!m) return;
    let etapes = null; try { etapes = JSON.parse(decodeURIComponent(m[1])); } catch (e) {}
    if (!etapes || !etapes.length) return;
    recuChemin = false; dejaRejoue = false;
    demanderPanier();   // v2.4 : fenêtre réutilisée (l'adresse change sans rechargement) : l'application apprend que le script est là et renvoie sa cible
    const envoyerChemin = () => {
      if (recuChemin) return;
      window.postMessage({ type: 'MTR_CHEMIN', etapes }, '*');
      document.querySelectorAll('iframe').forEach(f => { try { f.contentWindow.postMessage({ type: 'MTR_CHEMIN', etapes }, '*'); } catch (e) {} });
      setTimeout(envoyerChemin, 1000);
    };
    setTimeout(envoyerChemin, 1200);
  }
  window.addEventListener('message', e => { if (e.data && e.data.type === 'MTR_CHEMIN_RECU') recuChemin = true; });
  window.addEventListener('hashchange', lancerDepuisHash);
  setTimeout(lancerDepuisHash, 300);
  let dejaRejoue = false;
  window.addEventListener('message', e => {
    const d = e.data;
    if (!d || d.type !== 'MTR_CHEMIN' || dejaRejoue) return;
    if (!document.body || !document.body.textContent.trim()) return;   // page pas encore rendue
    dejaRejoue = true;
    try { (e.source || window).postMessage({ type: 'MTR_CHEMIN_RECU' }, '*'); } catch (err) {}
    try { window.top.postMessage({ type: 'MTR_CHEMIN_RECU' }, '*'); } catch (err) {}
    rejouer(d.etapes.map(x => (typeof x === 'string' ? { t: x } : x)));
  });

  /* =====================================================================
     3. BOUTONS « + AJOUTER » sur les lignes de pièces
     ===================================================================== */
  const vus = new WeakSet();
  function boutonsAjout() { const out = []; for (const el of tousElements()) if (el.classList && el.classList.contains('mtr-add')) out.push(el); return out; }   // aussi dans les shadow DOM
  function texteDe(el) {
    const parts = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const v = (n.nodeValue || '').trim(); if (v && !(n.parentElement && n.parentElement.closest('style, script, .mtr-add'))) parts.push(v); }
    return parts.join(' ').replace(/\s+/g, ' ');
  }
  const RX_REF = /Ref\.?\s*:?\s*(\d{6,10})/i;
  function ligneDe(el) {
    let n = el;
    for (let i = 0; i < 8 && n && n.nodeType === 1; i++, n = n.parentElement) {
      const t = texteDe(n);
      if (t.length > 700) return null;
      const tSans = t.replace(/(replaces|remplace)\s+\d{6,10}/gi, '');   // le numéro remplacé ne compte pas
      const aPn = RX_REF.test(tSans) || RX_PN.test(tSans);
      const aPrix = /Price|Prix|MSRP|PDSF|Appelez|Call/i.test(t) || RX_PRIX.test(t);
      if (aPn && aPrix) {
        const refs = tSans.match(/Ref\.?\s*:?\s*\d{6,10}/gi) || tSans.match(/\b\d{6,10}\b/g) || [];
        if (new Set(refs).size === 1) return n;   // un seul numéro = une seule ligne, pas le conteneur
      }
    }
    return null;
  }
  function extraire(ligne) {
    const t = texteDe(ligne);
    const tSans = t.replace(/(replaces|remplace)\s+\d{6,10}/gi, '');
    const pn = (tSans.match(RX_REF) || tSans.match(RX_PN) || [])[1];
    const mp = t.match(RX_PRIX); const prixStr = mp ? (mp[1] || mp[2]) : '';
    const prix = prixStr ? parseFloat(prixStr.replace(/[  ]/g, '').replace(/,(\d{2})$/, '.$1').replace(/,/g, '')) : NaN;
    const remplace = (t.match(/(?:replaces|remplace)\s+(\d{6,10})/i) || [])[1] || null;
    // nom : ce qu'il y a entre le numéro (et son repère de diagramme) et « Price: »
    let nom = t.replace(RX_REF, '').replace(pn || '', '');
    nom = nom.replace(/^\s*Ref\.?\s*:?\s*/i, '');
    // repère sur le diagramme : « 1140 », « 1160<1160c », « 3 » … juste après le numéro
    const mref = nom.match(/^\s*([0-9]{1,4}[a-z]?(?:\s*[<>–-]\s*[0-9]{1,4}[a-z]?)?)\s+(?=[A-Za-z])/); const repere = mref ? mref[1].replace(/\s+/g, '') : null;
    if (mref) nom = nom.slice(mref[0].length);
    nom = nom.split(/Price\s*:|Prix\s*:|MSRP\s*:?|PDSF\s*:?/i)[0].replace(RX_PRIX, '').replace(/Appelez en magasin|Call (the )?store/i, '');
    nom = nom.replace(/^\s*(Part\s*Number|Num[ée]ro de pi[èe]ce|N[°o]\.?\s*de pi[èe]ce|Part\s*#)\s*:?\s*/i, '');   // l'aperçu BRP écrit « Part Number: … MSRP: … »
    nom = nom.replace(/⚠.*$/, '').replace(/(This part replaces|Cette pièce remplace).*$/i, '').replace(/\b(Détails?|Details?|\+ Ajouter|✓ Ajouté)\b/g, '').replace(/[•·]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (nom.length > 120) nom = nom.slice(0, 120).trim();
    const appeler = /Appelez|Call/i.test(t) && isNaN(prix);
    return { pn, repere, nom: nom || `Pièce ${pn}`, prix: isNaN(prix) ? null : prix, devise: 'CAD', remplace, note: appeler ? 'Prix « appelez en magasin » sur BRP' : null };
  }
  /* ---------- pièces déjà dans la soumission : ligne verte + repère vert sur le diagramme ----------
     Source de vérité : l'application (message MTR_PANIER avec les numéros de la soumission courante).
     En attendant sa réponse, un clic local marque tout de suite.
     Sur le diagramme BRP, les numéros de repère sont dessinés DANS l'image : par-dessus, des zones
     cliquables (hotspots) sans texte. On retrouve la zone d'une pièce (1) par son texte ou ses attributs,
     (2) par ce qu'on a appris en survolant (l'aperçu qui s'ouvre dit le numéro), (3) en sondant
     nous-mêmes les zones au besoin. Les correspondances sont gardées par diagramme (sessionStorage). */
  const VERT = '#1F8A5B', VERT_BORD = '#0f5132';
  const panier = new Map();            // pn → qté dans la soumission
  const reperes = new Map();           // pn → repère vu sur la ligne (« 1160 », « 1160<1160c », « 3 »)
  const sauve = new WeakMap();         // élément → { prop: { v, p } } valeurs d'origine des propriétés qu'on a touchées
  const marques = new Set();           // éléments actuellement colorés
  let overlays = [];                   // pastilles posées par-dessus les <area> ou les zones sans boîte
  function poser(el, props) {
    if (!sauve.has(el)) sauve.set(el, {});
    const s = sauve.get(el);
    for (const p in props) { if (!(p in s)) s[p] = { v: el.style.getPropertyValue(p), pr: el.style.getPropertyPriority(p) }; el.style.setProperty(p, props[p], 'important'); }
    marques.add(el);
  }
  function decolorerTout() {
    for (const el of marques) { const s = sauve.get(el) || {}; for (const p in s) { el.style.removeProperty(p); if (s[p].v) el.style.setProperty(p, s[p].v, s[p].pr); } sauve.delete(el); }
    marques.clear(); overlays.forEach(o => o.remove()); overlays = [];
  }
  const PROPS_LIGNE = { 'background-color': '#DCFCE7', 'box-shadow': 'inset 0 0 0 2px ' + VERT, 'border-radius': '6px' };
  const PROPS_BOITE = { 'background-color': VERT, 'color': '#fff', 'outline': '2px solid ' + VERT_BORD, 'box-shadow': '0 0 0 2px #fff, 0 0 6px rgba(0,0,0,.45)', 'opacity': '1' };
  const PROPS_ZONE  = { 'background-color': 'rgba(31,138,91,.55)', 'outline': '2px solid ' + VERT_BORD, 'box-shadow': '0 0 0 2px #fff', 'opacity': '1' };
  function tokensRepere(r) { return String(r || '').split(/[<>–-]/).map(x => x.trim()).filter(Boolean); }
  const estSvg = el => el.namespaceURI === 'http://www.w3.org/2000/svg';
  function grandesImages() {
    const out = [];
    for (const el of tousElements()) { const tag = el.tagName && el.tagName.toLowerCase(); if (tag === 'img' || tag === 'svg' || tag === 'canvas' || tag === 'image') { const r = el.getBoundingClientRect(); if (r.width >= 180 && r.height >= 180) out.push({ el, r }); } }
    return out;
  }
  function imageSous(rect, images) { const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2; return images.find(i => cx >= i.r.left - 4 && cx <= i.r.right + 4 && cy >= i.r.top - 4 && cy <= i.r.bottom + 4) || null; }
  function surImage(rect, images) { return !!imageSous(rect, images); }
  const ATTR_IGNORES = new Set(['class', 'style', 'width', 'height', 'coords', 'shape', 'd', 'points', 'transform', 'viewbox', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'src', 'srcset', 'fill', 'stroke']);
  function attrsDe(el) { const o = []; for (const a of el.attributes || []) { if (!ATTR_IGNORES.has(a.name.toLowerCase())) o.push(a.name + '=' + String(a.value).slice(0, 80)); } return o; }
  /* la zone correspond-elle à un numéro du panier ? (texte, attributs) → pn ou null */
  function pnDeZone(el, voulus, pns) {
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    const txt = (el.textContent || '').trim().toLowerCase();
    if (txt && txt.length <= 12 && voulus.has(txt) && (!el.children.length || tag === 'text')) return voulus.get(txt);
    for (const a of el.attributes || []) {
      if (ATTR_IGNORES.has(a.name.toLowerCase())) continue;
      const v = String(a.value).trim().toLowerCase(); if (!v) continue;
      for (const pn of pns) if (new RegExp('(^|[^0-9])' + pn + '([^0-9]|$)').test(v)) return pn;
      if (voulus.has(v)) return voulus.get(v);
      for (const [t, pn] of voulus) if (t.length >= 2 && new RegExp('(^|[^0-9a-z])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^0-9a-z]|$)').test(v)) return pn;
    }
    return null;
  }
  /* candidats « zone de repère » : petits éléments posés sur la grande image, hors lignes de pièces et hors aperçu */
  function zonesCandidates(images) {
    const out = [];
    for (const el of tousElements()) {
      const tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (!tag || ['html', 'body', 'script', 'style', 'img', 'svg', 'canvas', 'image', 'br', 'tspan'].includes(tag)) continue;
      if (el.closest && el.closest('.mtr-ligne, .mtr-bar, .mtr-toast, .mtr-overlay')) continue;
      if (tag === 'area') { const im = images[0]; if (im) out.push({ el, tag, r: null, im }); continue; }
      const r = el.getBoundingClientRect(); if (!r.width || r.width > 130 || r.height < 6 || r.height > 70) continue;
      const txt = (el.textContent || '').trim(); if (txt.length > 12) continue;   // une zone ne porte pas de phrase
      if (r.width < (txt ? 4 : 8)) continue;   // un chiffre seul est étroit; une zone transparente, elle, a une vraie largeur
      const im = imageSous(r, images); if (!im) continue;
      if (el.children.length > 2 && tag !== 'text') continue;
      out.push({ el, tag, r, im });
    }
    return out;
  }
  function geometrie(r, im) { return { x: (r.left - im.r.left) / im.r.width, y: (r.top - im.r.top) / im.r.height, w: r.width / im.r.width, h: r.height / im.r.height }; }
  function memeGeometrie(a, b) { return a && b && Math.abs(a.x - b.x) < 0.012 && Math.abs(a.y - b.y) < 0.012 && Math.abs(a.w - b.w) < 0.02 && Math.abs(a.h - b.h) < 0.02; }
  /* correspondances apprises pn → géométrie de la zone, par diagramme */
  const cleDiag = () => 'mtr_hs|' + location.href.replace(/#mtr=.*$/, '');
  let appris = {}; try { appris = JSON.parse(sessionStorage.getItem(cleDiag()) || '{}') || {}; } catch (e) {}
  function apprendre(pn, el, im) { if (!el || !im) return; appris[pn] = geometrie(el.getBoundingClientRect(), im); try { sessionStorage.setItem(cleDiag(), JSON.stringify(appris)); } catch (e) {} }
  const zonesConnues = new Map();   // élément → pn (appris par survol, pour la vie de la page)
  function marquerZone(z, pn) {
    const el = z.el;
    if (z.tag === 'area') {   // image cliquable : pastille par-dessus
      const img = el.parentElement && el.parentElement.getAttribute('name') ? (document.querySelector('img[usemap="#' + el.parentElement.getAttribute('name') + '"]') || z.im.el) : z.im.el;
      const c = (el.getAttribute('coords') || '').split(',').map(Number); if (c.length < 3 || c.some(isNaN)) return false;
      const ri = img.getBoundingClientRect(); const sx = ri.width / (img.naturalWidth || ri.width), sy = ri.height / (img.naturalHeight || ri.height);
      let x, y, w, h; if (el.getAttribute('shape') === 'circle') { x = c[0] - c[2]; y = c[1] - c[2]; w = h = c[2] * 2; } else { x = Math.min(c[0], c[2]); y = Math.min(c[1], c[3]); w = Math.abs(c[2] - c[0]); h = Math.abs(c[3] - c[1]); }
      const o = document.createElement('div'); o.className = 'mtr-overlay'; o.title = pn;
      o.setAttribute('style', 'position:fixed;z-index:2147483000;pointer-events:none;border-radius:3px;background:rgba(31,138,91,.55);outline:2px solid ' + VERT_BORD + ';box-shadow:0 0 0 2px #fff;left:' + (ri.left + x * sx) + 'px;top:' + (ri.top + y * sy) + 'px;width:' + Math.max(12, w * sx) + 'px;height:' + Math.max(10, h * sy) + 'px');
      document.body.appendChild(o); overlays.push(o); return true;
    }
    const txt = (el.textContent || '').trim();
    if (estSvg(el)) {
      if (el.tagName.toLowerCase() === 'text') {
        poser(el, { fill: '#fff' });
        const g = el.parentNode; let forme = el.previousElementSibling;
        if (!forme || !/^(rect|circle|ellipse|polygon|path)$/i.test(forme.tagName)) forme = g && g.querySelector ? g.querySelector('rect, circle, ellipse, polygon, path') : null;
        if (forme) poser(forme, { fill: VERT, stroke: VERT_BORD, 'fill-opacity': '1' });
      } else poser(el, { fill: VERT, stroke: VERT_BORD, 'fill-opacity': '.6', opacity: '1' });
      return true;
    }
    if (txt) {   // une boîte avec le numéro dedans : on colore la boîte
      let boite = el;
      for (let k = 0; k < 2 && boite.parentElement; k++) { const p = boite.parentElement; const rp = p.getBoundingClientRect(); if (p.children.length === 1 && rp.width <= 130 && rp.height <= 70 && rp.width > 0) boite = p; else break; }
      poser(boite, PROPS_BOITE); return true;
    }
    poser(el, PROPS_ZONE); return true;   // zone transparente par-dessus le numéro dessiné dans l'image
  }
  function marquerReperes() {
    if (!panier.size) return 0;
    const voulus = new Map(); const pns = [...panier.keys()];
    for (const pn of pns) for (const t of tokensRepere(reperes.get(pn))) voulus.set(t.toLowerCase(), pn);
    const images = grandesImages(); if (!images.length) return 0;
    const zones = zonesCandidates(images); let n = 0; const trouves = new Set();
    for (const z of zones) {
      let pn = zonesConnues.get(z.el) || pnDeZone(z.el, voulus, pns);
      if (!pn && z.r) { const g = geometrie(z.r, z.im); for (const p of pns) if (memeGeometrie(appris[p], g)) { pn = p; break; } }
      if (!pn || !panier.has(pn)) continue;
      if (marquerZone(z, pn)) { n++; trouves.add(pn); if (z.r) apprendre(pn, z.el, z.im); }
    }
    // des pièces du panier sont sur ce diagramme (ligne à droite) mais sans zone trouvée → on sonde les zones par survol
    const surCeDiag = [...boutonsAjout()].map(b => b.dataset.pn).filter(pn => panier.has(pn) && !trouves.has(pn));
    if (surCeDiag.length && zones.some(z => z.r && !zonesConnues.has(z.el))) sonder(zones, images);
    return n;
  }
  /* survol réel : on apprend zone ↔ pièce quand l'aperçu s'ouvre */
  let derniereZone = null;
  document.addEventListener('mouseover', e => {
    const t = e.target; if (!t || !t.getBoundingClientRect) return;
    const r = t.getBoundingClientRect(); if (r.width < 8 || r.width > 130 || r.height < 6 || r.height > 70) return;
    if (t.closest && t.closest('.mtr-ligne, .mtr-bar, .mtr-overlay')) return;
    derniereZone = { el: t, t: Date.now() };
  }, true);
  function apercus(images) {   // les lignes de pièce posées PAR-DESSUS l'image = l'aperçu du survol
    const out = [];
    for (const tn of tousTextes()) { const pe = tn.parentElement; if (!pe || !RX_PN.test(tn.nodeValue || '')) continue; const l = ligneDe(pe); if (!l || out.includes(l)) continue; const r = l.getBoundingClientRect(); if (r.width && surImage(r, images)) out.push(l); }
    return out;
  }
  let sondeEnCours = false, sondeFaite = new WeakSet();
  async function sonder(zones, images) {
    if (sondeEnCours) return; sondeEnCours = true;
    try {
      const aFaire = zones.filter(z => z.r && !zonesConnues.has(z.el) && !sondeFaite.has(z.el) && !(z.el.textContent || '').trim()).slice(0, 400);
      const ev = (el, type) => { try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: 0, clientY: 0 })); } catch (e) {} try { el.dispatchEvent(new PointerEvent(type.replace('mouse', 'pointer'), { bubbles: true, cancelable: true, view: window })); } catch (e) {} };
      for (const z of aFaire) {
        sondeFaite.add(z.el);
        ev(z.el, 'mouseover'); ev(z.el, 'mouseenter'); ev(z.el, 'mousemove');
        await new Promise(r => setTimeout(r, 90));
        const ap = apercus(images).map(l => extraire(l).pn).filter(Boolean);
        if (new Set(ap).size === 1) { const pn = ap[0]; zonesConnues.set(z.el, pn); apprendre(pn, z.el, z.im); }
        ev(z.el, 'mouseout'); ev(z.el, 'mouseleave');
        if (![...panier.keys()].some(pn => !appris[pn] && boutonsAjout().some(b => b.dataset.pn === pn))) break;   // tout ce qu'il fallait est trouvé
      }
    } finally { sondeEnCours = false; rafraichirPanier(); }
  }
  function marquerLignes() {
    for (const b of boutonsAjout()) {
      const ligne = b.closest('.mtr-ligne'); if (!ligne) continue;
      const p = extraire(ligne).pn; if (p && p !== b.dataset.pn) b.dataset.pn = p;   // l'aperçu réutilise la même boîte pour une autre pièce
      const q = panier.get(b.dataset.pn) || 0;
      if (q) { poser(ligne, PROPS_LIGNE); b.textContent = '✓ Ajouté' + (q > 1 ? ' ×' + q : ''); b.setAttribute('style', STYLE_OK); }
      else if (b.textContent !== '+ Ajouter') { b.textContent = '+ Ajouter'; b.setAttribute('style', STYLE_BTN); }
    }
  }
  let rafraichirT;
  function rafraichirPanier() {
    clearTimeout(rafraichirT);
    rafraichirT = setTimeout(() => { if (sondeEnCours) return; decolorerTout(); marquerLignes(); marquerReperes(); }, 60);
  }
  window.addEventListener('scroll', () => { if (overlays.length) rafraichirPanier(); }, true);
  // le site efface parfois nos couleurs (survol qui remet le style à zéro) : on remet dès qu'un élément marqué perd sa couleur
  new MutationObserver(ms => {
    if (sondeEnCours) return;
    for (const m of ms) { const el = m.target; if (!marques.has(el)) continue; const s = sauve.get(el) || {}; for (const p in s) { if (el.style.getPropertyPriority(p) !== 'important') { rafraichirPanier(); return; } } }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'], subtree: true });
  window.addEventListener('resize', () => { if (marques.size) rafraichirPanier(); });
  function relayerCadres(d) {
    try { const t = window.top; const visiter = w => { for (let i = 0; i < w.frames.length; i++) { try { w.frames[i].postMessage(Object.assign({}, d, { relaye: true }), '*'); visiter(w.frames[i]); } catch (e) {} } }; if (t !== window) t.postMessage(Object.assign({}, d, { relaye: true }), '*'); visiter(t); } catch (e) {}
  }
  window.addEventListener('message', e => {
    const d = e.data; if (!d || d.type !== 'MTR_PANIER' || !Array.isArray(d.lignes)) return;
    if (!d.relaye) relayerCadres(d);
    const nouvelleCible = d.cible ? String(d.cible) : '';
    if (nouvelleCible !== cibleApp) { cibleApp = nouvelleCible; statut(dernierMsg || 'Prêt.'); }   // v2.4 : la pastille suit la cible
    panier.clear(); d.lignes.forEach(l => { if (l && l.pn) panier.set(String(l.pn), Number(l.qte) || 1); if (l && l.pn && l.repere && !reperes.has(String(l.pn))) reperes.set(String(l.pn), l.repere); });
    rafraichirPanier();
  });
  function demanderPanier() { const o = opener(); if (o && !o.closed) { try { o.postMessage({ type: 'MTR_PANIER_DEMANDE', ver: VERSION }, '*'); } catch (e) {} } }

  function scanner() {
    let n = 0; const cibles = [];
    for (const tn of tousTextes()) {
      const pe = tn.parentElement; if (!pe) continue;
      if ((RX_PN.test(tn.nodeValue || '')) && !pe.closest('.mtr-bar, script, style')) cibles.push(pe);
    }
    cibles.forEach(el => {
      const ligne = ligneDe(el); if (!ligne || vus.has(ligne)) return;
      if (ligne.querySelector('.mtr-add') || (ligne.closest && ligne.closest('.mtr-ligne'))) { vus.add(ligne); return; }   // déjà un bouton (ligne ou parent)
      // un seul bouton par numéro de pièce visible : si un bloc parent contient déjà ce numéro avec un bouton, on passe
      const p = extraire(ligne); if (!p.pn) return;
      for (const b of boutonsAjout()) { if (b.dataset.pn === p.pn && b.isConnected && ligne.contains(b)) { vus.add(ligne); return; } }
      vus.add(ligne); ligne.classList.add('mtr-ligne');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mtr-add'; b.dataset.pn = p.pn; b.setAttribute('style', STYLE_BTN); b.textContent = '+ Ajouter'; b.title = `Ajouter ${p.pn} à l'outil MTR (bon de travail ou soumission)`;
      b.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const piece = extraire(ligne);
        const ok = versOutil({ type: 'MTR_AJOUT_PIECE', ...piece, marque: MARQUE, source: 'brp', date: new Date().toISOString().slice(0, 10), url: location.href, chemin: cheminMachine(), ver: VERSION });
        panier.set(piece.pn, (panier.get(piece.pn) || 0) + 1); if (piece.repere) reperes.set(piece.pn, piece.repere);
        // « + Ajouter » depuis l'aperçu d'un repère : la zone survolée juste avant est celle de cette pièce
        if (derniereZone && Date.now() - derniereZone.t < 15000) { const ims = grandesImages(); const rz = derniereZone.el.getBoundingClientRect(); const im = imageSous(rz, ims); if (im && !derniereZone.el.closest('.mtr-ligne')) { zonesConnues.set(derniereZone.el, piece.pn); apprendre(piece.pn, derniereZone.el, im); } }
        b.textContent = '✓ Ajouté'; b.setAttribute('style', STYLE_OK); rafraichirPanier();
        statut(ok ? `<b>${piece.pn}</b> ${piece.nom} envoyé → ${esc(dest())}.` : `<b>${piece.pn}</b> envoyé — l'outil MTR s'est ouvert dans un autre onglet.`);
        toast(ok ? '✓ ' + piece.nom + ' → ' + dest() : '✓ ' + piece.nom + ' → l’application s’est ouverte dans un autre onglet');
      });
      // à côté du prix si on le trouve, sinon en fin de ligne
      const feuilles = [...tousElements(ligne)].filter(x => x.children.length === 0 && /\$|Appelez|Call/i.test(x.textContent || ''));
      const montant = feuilles[feuilles.length - 1];
      if (montant && montant.parentElement && montant.parentElement !== ligne) montant.parentElement.appendChild(b);   // après le montant
      else if (montant) montant.after(b);
      else ligne.appendChild(b);
      n++;
    });
    return n;
  }
  const ou = EN_HAUT ? 'page ' + location.hostname : 'cadre ' + location.hostname;
  function passe() {
    const neufs = scanner(); total = boutonsAjout().length;
    for (const b of boutonsAjout()) { const l = b.closest('.mtr-ligne'); if (l && b.dataset.pn && !reperes.has(b.dataset.pn)) { const r = extraire(l).repere; if (r) reperes.set(b.dataset.pn, r); } }
    if (panier.size || marques.size) rafraichirPanier();
    if (neufs) demanderPanier();
    if (estListeDiagrammes() && cheminMachine().length >= 2) envoyerMachine(false);
    moissonner();
    const ok = machineEnvoyee ? ' ✓ machine mémorisée' : '';
    if (total) statut(`MTR v${VERSION} : <b>${total}</b> pièce${total > 1 ? 's' : ''} avec « + Ajouter ». ${opener() ? 'Outil lié → ' + esc(dest()) + '.' : '<b>Outil non lié</b>.'}${ok}<br>Chemin : ${cheminMachine().map(c => c.t).join(' › ') || '—'}`);
    else if (!dejaRejoue) statut(`MTR v${VERSION} (${ou}) : ${estListeDiagrammes() ? 'liste des diagrammes' : 'aucune ligne de pièce ici'}.${ok} Chemin : ${cheminMachine().map(c => c.t).join(' › ') || '—'}`);
  }
  passe(); demanderPanier();
  let t; new MutationObserver(() => { clearTimeout(t); t = setTimeout(passe, 200); }).observe(document.body, { childList: true, subtree: true });
})();
