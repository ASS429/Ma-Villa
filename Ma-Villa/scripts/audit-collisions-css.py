# -*- coding: utf-8 -*-
"""Toute classe définie à la fois dans `index.css` et dans une feuille du
projet est un piège : la seconde gagne, en silence, et casse la première.

Deux cas l'ont déjà prouvé — `.tunnel-total` et `.commande-entete`. Cet audit
les cherche tous d'un coup plutôt qu'un par un.
"""
import io
import re
from collections import defaultdict

FEUILLES = [
    'src/index.css',
    'src/styles/console.css',
    'src/styles/profondeur.css',
]


def classes(chemin):
    """Les classes définies — le premier sélecteur de chaque règle."""
    s = io.open(chemin, encoding='utf-8').read()
    # On retire les commentaires, qui citent souvent des classes.
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    trouvees = set()
    for m in re.finditer(r'(^|\}|\{)\s*([^{}@]+?)\s*\{', s, re.M):
        selecteur = m.group(2)
        if '\n' in selecteur and ':' in selecteur:
            continue  # bloc de déclarations, pas un sélecteur
        for c in re.findall(r'\.([a-zA-Z][\w-]*)', selecteur):
            trouvees.add(c)
    return trouvees


par_feuille = {f: classes(f) for f in FEUILLES}

ou = defaultdict(list)
for feuille, cs in par_feuille.items():
    for c in cs:
        ou[c].append(feuille)

collisions = {c: f for c, f in ou.items() if len(f) > 1}

print('classes definies par feuille :')
for f, cs in par_feuille.items():
    print('  %-28s %d' % (f, len(cs)))

print()
if not collisions:
    print('aucune collision')
else:
    print('%d COLLISION(S) :' % len(collisions))
    for c in sorted(collisions):
        print('  .%-28s %s' % (c, ' + '.join(x.split('/')[-1] for x in collisions[c])))
