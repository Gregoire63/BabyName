/* Recherche de prénom des pages publiques babyNamed (voir scripts/recherche.mjs).
   Les adresses des fichiers (index, INSEE par lettre) sont posées au build par scripts/seo.mjs. */
(function () {
  'use strict'
  var INDEX = '__INDEX__', INSEE = __INSEE__
  var SEXE = { f: 'fille', m: 'garçon', fm: 'mixte' }
  var nf = function (x) { return Math.round(x).toLocaleString('fr-FR') }
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  var sansAccent = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() }
  var slug = function (s) { return sansAccent(s).replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') }
  var norm = function (s) { return sansAccent(s).replace(/[^a-z]/g, '') }
  /* Une clé de prononciation, grossière mais utile : Maëlys, Maelis, Mayliss. */
  var phon = function (s) {
    return norm(s).replace(/ph/g, 'f').replace(/qu/g, 'k').replace(/ck/g, 'k').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k')
      .replace(/y/g, 'i').replace(/h/g, '').replace(/ei|ai/g, 'e').replace(/eau|au/g, 'o').replace(/z/g, 's')
      .replace(/([a-z])\1+/g, '$1').replace(/[estxd]$/, '')
  }
  var joli = function (s) { return s.toLocaleLowerCase('fr').replace(/(^|[-\s'])(\S)/g, function (m, a, b) { return a + b.toLocaleUpperCase('fr') }) }
  var distance = function (a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1
    var v = [], i, j
    for (j = 0; j <= b.length; j++) v[j] = j
    for (i = 1; i <= a.length; i++) {
      var prec = v[0], mini = v[0] = i
      for (j = 1; j <= b.length; j++) {
        var t = v[j]
        v[j] = Math.min(v[j] + 1, v[j - 1] + 1, prec + (a[i - 1] === b[j - 1] ? 0 : 1))
        prec = t; if (v[j] < mini) mini = v[j]
      }
      if (mini > max) return max + 1
    }
    return v[b.length]
  }

  /* ------------------------------------------------------------ données */
  var index = null, chargement = null
  function charger() {
    if (index) return Promise.resolve(index)
    if (chargement) return chargement
    chargement = fetch(INDEX).then(function (r) { return r.text() }).then(function (t) {
      index = t.split('\n').map(function (l) {
        var c = l.split('\t')
        return { l: c[0], fiche: c[1] || slug(c[0]), s: c[2], n: +c[3], gp: c[4], k: norm(c[0]), p: phon(c[0]) }
      })
      return index
    })
    return chargement
  }
  var lettres = {}
  function insee(q) {
    var l = slug(q)[0]
    if (!l || !INSEE[l]) return Promise.resolve(null)
    var p = lettres[l] || (lettres[l] = fetch(INSEE[l]).then(function (r) { return r.text() }).then(function (t) {
      var m = {}
      t.split('\n').forEach(function (x) { var c = x.split('\t'); m[norm(c[0])] = { l: joli(c[0]), n: +c[1], a: +c[2], b: +c[3] } })
      return m
    }))
    return p.then(function (m) { return m[norm(q)] || null })
  }

  function suggestions(q, max) {
    var k = norm(q), debut = [], dedans = []
    if (!k) return []
    for (var i = 0; i < index.length && debut.length < max; i++) {
      var e = index[i]
      if (e.k.indexOf(k) === 0) debut.push(e)
      else if (dedans.length < max && k.length > 1 && e.k.indexOf(k) > 0) dedans.push(e)
    }
    return unique(debut.concat(dedans)).slice(0, max)
  }
  function proches(q, max) {
    var k = norm(q), p = phon(q), lim = k.length > 5 ? 2 : 1, r = []
    for (var i = 0; i < index.length; i++) {
      var e = index[i]
      if (e.k === k) continue
      if (e.p === p) r.push({ e: e, d: 0 })
      else if (Math.abs(e.k.length - k.length) <= lim) { var d = distance(e.k, k, lim); if (d <= lim) r.push({ e: e, d: d }) }
    }
    r.sort(function (a, b) { return a.d - b.d || b.e.n - a.e.n })
    return unique(r.map(function (x) { return x.e })).slice(0, max)
  }
  function unique(xs) { var vus = {}; return xs.filter(function (e) { var c = e.l + e.s; return vus[c] ? false : (vus[c] = 1) }) }

  var ligne = function (e) {
    return '<li><a href="/prenom/' + e.fiche + '/"><b>' + esc(e.l) + '</b><small>' + (SEXE[e.s] || '') +
      (e.n >= 5 ? ' · ' + nf(e.n) + ' bébés en 3 ans' : ' · rare aujourd’hui') + '</small></a></li>'
  }

  /* ------------------------------------------------------------ le clavier du téléphone */
  /* Il prend la moitié basse de l'écran, et les suggestions s'écrivent SOUS le
     champ : elles y restaient cachées, il fallait ranger le clavier pour les
     lire. Dès qu'on entre dans le grand champ, il monte donc en haut de
     l'écran, juste sous l'en-tête : la liste a la place de se lire au-dessus
     du clavier. Sur un ordinateur rien ne recouvre la page, elle ne bouge pas. */
  var media = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches) }
  var TACTILE = media('(pointer: coarse)')
  function auDessusDuClavier(form, champ) {
    var jusqua = 0
    var monter = function () {
      if (document.activeElement !== champ) return
      var entete = document.querySelector('header.h')
      var haut = entete ? Math.max(0, entete.getBoundingClientRect().bottom) : 0
      var ecart = form.getBoundingClientRect().top - haut - 8
      if (Math.abs(ecart) > 12) window.scrollBy({ top: ecart, behavior: media('(prefers-reduced-motion: reduce)') ? 'auto' : 'smooth' })
    }
    // Le clavier sort en glissant et le navigateur replace la page à sa façon :
    // on passe après lui, et encore une fois quand la vue a fini de rétrécir.
    champ.addEventListener('focus', function () { jusqua = Date.now() + 1500; setTimeout(monter, 300) })
    if (window.visualViewport) window.visualViewport.addEventListener('resize', function () { if (Date.now() < jusqua) monter() })
  }

  /* ------------------------------------------------------------ un champ */
  function brancher(form) {
    var champ = form.querySelector('input[name=q]')
    if (!champ || form.dataset.branche) return
    form.dataset.branche = '1'
    var liste = form.querySelector('.suggestions') || form.appendChild(document.createElement('ul'))
    liste.className = 'suggestions'
    liste.id = liste.id || 'sugg-' + Math.random().toString(36).slice(2, 8)
    champ.setAttribute('aria-controls', liste.id)
    champ.setAttribute('autocomplete', 'off')
    var verdict = form.querySelector('.verdict') || form.appendChild(document.createElement('div'))
    verdict.className = 'verdict'
    verdict.setAttribute('aria-live', 'polite')

    var tape = function () {
      var q = champ.value.trim()
      verdict.innerHTML = ''
      if (!q) { liste.innerHTML = ''; return }
      charger().then(function () {
        if (champ.value.trim() !== q) return
        liste.innerHTML = suggestions(q, 8).map(ligne).join('')
      })
    }
    champ.addEventListener('input', tape)
    champ.addEventListener('focus', charger, { once: true })
    if (TACTILE && form.classList.contains('grand')) auDessusDuClavier(form, champ)
    champ.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { var a = liste.querySelector('a'); if (a) { ev.preventDefault(); a.focus() } }
    })
    liste.addEventListener('keydown', function (ev) {
      var liens = [].slice.call(liste.querySelectorAll('a')), i = liens.indexOf(document.activeElement)
      if (ev.key === 'ArrowDown' && i < liens.length - 1) { ev.preventDefault(); liens[i + 1].focus() }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); (i > 0 ? liens[i - 1] : champ).focus() }
    })
    form.addEventListener('submit', function (ev) {
      ev.preventDefault()
      var q = champ.value.trim()
      if (!q) return
      if (form.dataset.adresse) history.replaceState(null, '', location.pathname + '?q=' + encodeURIComponent(q))
      charger().then(function () {
        var k = norm(q), exacts = index.filter(function (e) { return e.k === k })
        if (exacts.length) { location.href = '/prenom/' + exacts[0].fiche + '/'; return }
        liste.innerHTML = ''
        verdict.innerHTML = '<p class="doux">Recherche…</p>'
        insee(q).then(function (x) {
          // Tout prénom de l'INSEE a sa fiche (rendue par le serveur s'il n'a
          // pas de page statique) : on y va.
          if (x) { location.href = '/prenom/' + slug(x.l) + '/'; return }
          var p = proches(q, 6)
          var titre = esc(x ? x.l : joli(q))
          var html = x
            ? '<p><b>' + titre + ' existe</b> : ' + nf(x.n) + ' bébé' + (x.n > 1 ? 's' : '') + ' l’ont reçu en France ' +
              (x.a === x.b ? 'en ' + x.a : 'entre ' + x.a + ' et ' + x.b) + ' (INSEE). Il n’a pas encore de fiche détaillée ici.</p>'
            : '<p><b>Aucun bébé « ' + titre + ' »</b> dans les naissances publiées depuis 1900. L’INSEE ne publie un prénom qu’à partir de 3 naissances : en dessous, il peut exister sans apparaître. Et rien n’interdit de le donner.</p>'
          html += p.length ? '<p class="t">Proches, par l’écriture ou le son :</p><ul class="suggestions">' + p.map(ligne).join('') + '</ul>' : ''
          verdict.innerHTML = html
          // La réponse s'écrit sous le champ : sur un téléphone, on range le clavier pour qu'elle se lise.
          if (TACTILE) champ.blur()
        })
      })
    })
    if (form.dataset.adresse) {
      var q = new URLSearchParams(location.search).get('q')
      if (q) { champ.value = q; form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')) }
    }
  }

  /* ------------------------------------------------------------ la loupe de l'en-tête */
  var voile = null
  function ouvrir(ev) {
    ev.preventDefault()
    if (!voile) {
      voile = document.createElement('div')
      voile.className = 'recherche-voile'
      voile.innerHTML = '<div class="recherche-boite" role="dialog" aria-modal="true" aria-label="Chercher un prénom">' +
        '<form class="cherche" action="/chercher-un-prenom/" method="get" role="search"><div class="champ-ligne">' +
        '<input name="q" type="search" placeholder="Un prénom : Louise, Maël…" aria-label="Prénom à chercher" enterkeyhint="search" autocapitalize="words" spellcheck="false">' +
        '<button type="button" class="fermer" aria-label="Fermer">✕</button></div></form></div>'
      document.body.appendChild(voile)
      brancher(voile.querySelector('form'))
      voile.addEventListener('click', function (e) { if (e.target === voile) fermer() })
      voile.querySelector('.fermer').addEventListener('click', fermer)
      voile.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer() })
    }
    voile.hidden = false
    document.documentElement.classList.add('recherche-ouverte')
    voile.querySelector('input').focus()
  }
  function fermer() {
    voile.hidden = true
    document.documentElement.classList.remove('recherche-ouverte')
    var l = document.querySelector('header.h .loupe'); if (l) l.focus()
  }

  document.querySelectorAll('form.cherche').forEach(brancher)
  document.querySelectorAll('header.h .loupe').forEach(function (a) { a.addEventListener('click', ouvrir) })
})()
