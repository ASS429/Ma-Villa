# -*- coding: utf-8 -*-
"""Miroir HTML des CGU, pour en tirer un PDF.

Importe le texte depuis `generer` : une seule source, donc aucun risque que le
Word et le PDF finissent par dire des choses différentes.
"""

import html
import os

from generer import TITRE, VERSION, CHAPEAU, INTRO, SECTIONS, RETOUR

GABARIT = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>{titre}</title>
<style>
  @page {{ size: letter; margin: 22mm 25mm; }}
  body {{ font-family: Calibri, Carlito, "Segoe UI", sans-serif; font-size: 11pt;
         line-height: 1.55; color: #1A1614; }}
  .marque {{ font-size: 13pt; font-weight: 700; color: #A34D1F; }}
  .sous-marque {{ font-size: 9pt; color: #5C5650; margin-bottom: 14pt; }}
  h1 {{ font-size: 24pt; font-weight: 400; color: #1A1614; margin: 0 0 6pt; }}
  .version {{ font-size: 9pt; color: #5C5650; margin-bottom: 16pt; }}
  .banniere {{ font-size: 9.5pt; font-weight: 700; margin-bottom: 4pt; }}
  .chapeau {{ font-size: 9.5pt; color: #5C5650; margin-bottom: 18pt; }}
  h2 {{ font-size: 12.5pt; font-weight: 400; color: #A34D1F;
        margin: 16pt 0 4pt; page-break-after: avoid; }}
  h2 .mention {{ font-size: 9pt; color: #5C5650; font-style: italic; }}
  p {{ margin: 0 0 6pt; text-align: justify; }}
  .fin {{ text-align: center; color: #5C5650; margin-top: 20pt; }}
  .retour {{ text-align: center; color: #5C5650; font-size: 9pt; }}
</style></head><body>
<div class="marque">MA VILLA</div>
<div class="sous-marque">Plateforme de location de villas au Sénégal</div>
<h1>{titre}</h1>
<div class="version">{version}</div>
<div class="banniere">DOCUMENT SOUMIS À RELECTURE JURIDIQUE — NON PUBLIÉ EN L'ÉTAT</div>
<div class="chapeau">{chapeau}</div>
<p>{intro}</p>
{corps}
<p class="fin">— Fin du document —</p>
<p class="retour">{retour}</p>
</body></html>
"""


def construire_html(chemin):
    blocs = []
    for titre, mention, paragraphes in SECTIONS:
        suffixe = ''
        if mention:
            suffixe = ' <span class="mention">— %s</span>' % html.escape(mention)
        blocs.append('<h2>%s%s</h2>' % (html.escape(titre), suffixe))
        blocs.extend('<p>%s</p>' % html.escape(p) for p in paragraphes)

    page = GABARIT.format(
        titre=html.escape(TITRE),
        version=html.escape(VERSION),
        chapeau=html.escape(CHAPEAU),
        intro=html.escape(INTRO),
        corps='\n'.join(blocs),
        retour=html.escape(RETOUR),
    )

    with open(chemin, 'w', encoding='utf-8') as f:
        f.write(page)

    return chemin


if __name__ == '__main__':
    cible = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         '1-Conditions-generales-utilisation-v2.html')
    print('Écrit :', construire_html(cible))
