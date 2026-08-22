# -*- coding: utf-8 -*-
"""Cherche les classes qu'une feuille redéfinit derrière une autre.

Deux bogues réels l'ont motivé, et ils étaient invisibles à la compilation :
`.tunnel-total` et `.commande-entete`. Dans les deux cas, `console.css`
redéfinissait une classe d'`index.css` ; chargée après, elle gagnait, et la
règle d'origine cessait de s'appliquer. Les deux feuilles étaient valides —
c'est leur superposition qui mentait.

⚠️ Ne compte que les définitions **nues** : `.x { … }`, éventuellement avec une
pseudo-classe. `.parent .x` et `.x.modificateur` sont des règles qui *ajoutent*
à une classe, pas qui la remplacent, et les signaler noierait les vraies
collisions sous des faux positifs — un audit qui crie au loup cesse d'être lu.

    python scripts/audit-collisions-css.py
"""
import io
import os
import re
import sys
from collections import defaultdict

FEUILLES = [
    os.path.join('src', 'index.css'),
    os.path.join('src', 'styles', 'console.css'),
    os.path.join('src', 'styles', 'profondeur.css'),
]

# `.ma-classe`, `.ma-classe:hover`, `.ma-classe::after` — mais pas
# `.autre .ma-classe` ni `.ma-classe.variante`.
NUE = re.compile(r'^\.([a-zA-Z][\w-]*)((:{1,2}[\w-]+(\([^)]*\))?)*)$')


def definitions_nues(chemin):
    s = io.open(chemin, encoding='utf-8').read()
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)  # les commentaires citent des classes

    trouvees = set()
    for m in re.finditer(r'(^|\}|\{)\s*([^{}@;]+?)\s*\{', s, re.M):
        for selecteur in m.group(2).split(','):
            correspond = NUE.match(selecteur.strip())
            if correspond:
                trouvees.add(correspond.group(1))
    return trouvees


def main():
    manquantes = [f for f in FEUILLES if not os.path.exists(f)]
    if manquantes:
        print('feuilles introuvables :', ', '.join(manquantes))
        print('à lancer depuis Ma-Villa/')
        return 2

    par_feuille = {f: definitions_nues(f) for f in FEUILLES}

    ou = defaultdict(list)
    for feuille, classes in par_feuille.items():
        for c in classes:
            ou[c].append(os.path.basename(feuille))

    collisions = {c: f for c, f in ou.items() if len(f) > 1}

    for f, classes in par_feuille.items():
        print('  %-28s %d classes définies nues' % (f, len(classes)))
    print()

    if not collisions:
        print('aucune collision')
        return 0

    print('%d COLLISION(S) — la dernière feuille chargée écrase la première :' % len(collisions))
    for c in sorted(collisions):
        print('  .%-28s %s' % (c, ' + '.join(collisions[c])))
    return 1


if __name__ == '__main__':
    sys.exit(main())
