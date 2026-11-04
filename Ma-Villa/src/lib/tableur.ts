/**
 * Écrire un classeur Excel (.xlsx) ou un CSV dans le navigateur, sans bibliothèque.
 *
 * SheetJS pèse plusieurs centaines de Ko pour ce qu'on en ferait : quelques
 * feuilles de chiffres. Un .xlsx n'est qu'un zip de fichiers XML ; ce module les
 * écrit et les range, et n'est chargé qu'au moment d'exporter. Même raisonnement
 * que les graphiques en SVG : sur ce marché, la data se paie au volume.
 *
 * Les cellules de texte sont écrites comme du texte (`inlineStr`) : Excel ne peut
 * pas y voir de formule, même si un visiteur a tapé « =… » dans un formulaire.
 * Dans le CSV, où rien ne le garantit, elles reçoivent une apostrophe en tête.
 */

export type FormatColonne = 'texte' | 'nombre' | 'fcfa' | 'pourcent' | 'decimal' | 'heures' | 'evolution'

export interface Colonne {
  titre: string
  format?: FormatColonne
  /** Largeur en caractères ; sinon, déduite du contenu. */
  largeur?: number
  /** Barres de données dans les cellules, comme la mise en forme conditionnelle d'Excel. */
  barres?: boolean
}

export type Valeur = string | number | null | undefined

export interface SerieGraphique {
  /** Index de la colonne (à partir de 0) qui porte le nom et les valeurs. */
  colonne: number
  couleur: string
}

export interface Graphique {
  type: 'ligne' | 'colonnes' | 'barres'
  titre: string
  /** La feuille lue, et sa colonne de libellés. */
  feuille: string
  categories: number
  series: SerieGraphique[]
  empile?: boolean
  /** Limite le nombre de lignes lues, pour un « top 10 ». */
  lignes?: number
  /** Où le poser sur la feuille qui le porte : colonne, ligne, largeur, hauteur (en cellules). */
  place: { colonne: number; ligne: number; largeur: number; hauteur: number }
}

export interface Feuille {
  nom: string
  titre: string
  note?: string
  colonnes: Colonne[]
  lignes: Valeur[][]
  /** Une ligne de total, en gras. */
  total?: Valeur[]
  /** Quand une même colonne mêle des montants et des taux. */
  formatDe?: (ligne: number, colonne: number) => FormatColonne | undefined
  /** Colore les cellules de chiffres selon leur valeur, comme une carte de chaleur. */
  chaleur?: boolean
  graphiques?: Graphique[]
}

/** La ligne (à partir de 1) des en-têtes : titre, note, vide, puis les colonnes. */
const LIGNE_ENTETE = 4
const ACCENT = 'FFA34D1F'

/* ── Le zip ─────────────────────────────────────────────────── */

const TABLE_CRC = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(octets: Uint8Array): number {
  let c = 0xFFFFFFFF
  for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

/** Un zip sans compression : Excel l'accepte, et le fichier reste petit à ce volume. */
function zip(fichiers: { nom: string; contenu: string }[], maintenant: Date): Blob {
  const encodeur = new TextEncoder()
  const heure = (maintenant.getHours() << 11) | (maintenant.getMinutes() << 5) | (maintenant.getSeconds() >> 1)
  const jour = ((maintenant.getFullYear() - 1980) << 9) | ((maintenant.getMonth() + 1) << 5) | maintenant.getDate()

  const morceaux: Uint8Array[] = []
  const central: Uint8Array[] = []
  let position = 0

  for (const f of fichiers) {
    const nom = encodeur.encode(f.nom)
    const donnees = encodeur.encode(f.contenu)
    const crc = crc32(donnees)

    const entete = new DataView(new ArrayBuffer(30))
    entete.setUint32(0, 0x04034B50, true)
    entete.setUint16(4, 20, true)
    entete.setUint16(6, 0x0800, true) // noms en UTF-8
    entete.setUint16(8, 0, true) // sans compression
    entete.setUint16(10, heure, true)
    entete.setUint16(12, jour, true)
    entete.setUint32(14, crc, true)
    entete.setUint32(18, donnees.length, true)
    entete.setUint32(22, donnees.length, true)
    entete.setUint16(26, nom.length, true)
    morceaux.push(new Uint8Array(entete.buffer), nom, donnees)

    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014B50, true)
    c.setUint16(4, 20, true)
    c.setUint16(6, 20, true)
    c.setUint16(8, 0x0800, true)
    c.setUint16(10, 0, true)
    c.setUint16(12, heure, true)
    c.setUint16(14, jour, true)
    c.setUint32(16, crc, true)
    c.setUint32(20, donnees.length, true)
    c.setUint32(24, donnees.length, true)
    c.setUint16(28, nom.length, true)
    c.setUint32(42, position, true)
    central.push(new Uint8Array(c.buffer), nom)

    position += 30 + nom.length + donnees.length
  }

  const tailleCentral = central.reduce((t, m) => t + m.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054B50, true)
  fin.setUint16(8, fichiers.length, true)
  fin.setUint16(10, fichiers.length, true)
  fin.setUint32(12, tailleCentral, true)
  fin.setUint32(16, position, true)

  const parties = [...morceaux, ...central, new Uint8Array(fin.buffer)]
  return new Blob(parties.map((p) => p.slice().buffer), {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/* ── Le XML ─────────────────────────────────────────────────── */

const ENTETE_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

/** Échappe le texte, et retire les caractères de contrôle que XML interdit. */
function xml(texte: string): string {
  return texte
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function lettre(colonne: number): string {
  let n = colonne + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** Le numéro de style de chaque sorte de cellule, dans l'ordre de `STYLES`. */
const STYLE = {
  defaut: 0, titre: 1, note: 2, entete: 3,
  nombre: 4, fcfa: 5, pourcent: 6, decimal: 7, heures: 8, evolution: 9, texte: 10,
  totalTexte: 11, totalNombre: 12, totalFcfa: 13, totalPourcent: 14, totalDecimal: 15, totalHeures: 16,
} as const

const STYLES = `${ENTETE_XML}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="5">
<numFmt numFmtId="164" formatCode="#,##0&quot; FCFA&quot;"/>
<numFmt numFmtId="165" formatCode="0.0%"/>
<numFmt numFmtId="166" formatCode="0.0"/>
<numFmt numFmtId="167" formatCode="0.0&quot; h&quot;"/>
<numFmt numFmtId="168" formatCode="+0.0%;-0.0%;0.0%"/>
</numFmts>
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="15"/><color rgb="${ACCENT}"/><name val="Calibri"/></font>
<font><i/><sz val="10"/><color rgb="FF6B625A"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${ACCENT}"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="3">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="hair"><color rgb="FFD8D0C6"/></bottom><diagonal/></border>
<border><left/><right/><top style="thin"><color rgb="${ACCENT}"/></top><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="17">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="168" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="4" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"/>
<xf numFmtId="3" fontId="4" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="164" fontId="4" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="165" fontId="4" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="166" fontId="4" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="167" fontId="4" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

function styleDe(format: FormatColonne | undefined, total: boolean): number {
  if (total) {
    switch (format) {
      case 'nombre': return STYLE.totalNombre
      case 'fcfa': return STYLE.totalFcfa
      case 'pourcent': case 'evolution': return STYLE.totalPourcent
      case 'decimal': return STYLE.totalDecimal
      case 'heures': return STYLE.totalHeures
      default: return STYLE.totalTexte
    }
  }
  switch (format) {
    case 'nombre': return STYLE.nombre
    case 'fcfa': return STYLE.fcfa
    case 'pourcent': return STYLE.pourcent
    case 'decimal': return STYLE.decimal
    case 'heures': return STYLE.heures
    case 'evolution': return STYLE.evolution
    default: return STYLE.texte
  }
}

function cellule(col: number, ligne: number, valeur: Valeur, style: number): string {
  const ref = `${lettre(col)}${ligne}`
  if (valeur === null || valeur === undefined || valeur === '') return `<c r="${ref}" s="${style}"/>`
  if (typeof valeur === 'number') {
    return Number.isFinite(valeur) ? `<c r="${ref}" s="${style}"><v>${valeur}</v></c>` : `<c r="${ref}" s="${style}"/>`
  }
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(valeur)}</t></is></c>`
}

function largeurs(f: Feuille): number[] {
  return f.colonnes.map((c, i) => {
    if (c.largeur) return c.largeur
    const contenu = [c.titre, ...f.lignes.map((l) => l[i])].map((v) => {
      if (typeof v === 'number') return c.format === 'fcfa' ? 16 : 10
      return String(v ?? '').length
    })
    return Math.min(46, Math.max(10, Math.max(...contenu) + 2))
  })
}

function feuilleXml(f: Feuille, aDessin: boolean): string {
  const n = f.colonnes.length
  const derniereDonnee = LIGNE_ENTETE + f.lignes.length
  const lignes: string[] = []

  lignes.push(`<row r="1" ht="24" customHeight="1">${cellule(0, 1, f.titre, STYLE.titre)}</row>`)
  if (f.note) lignes.push(`<row r="2">${cellule(0, 2, f.note, STYLE.note)}</row>`)
  lignes.push(`<row r="${LIGNE_ENTETE}" ht="32" customHeight="1">${f.colonnes.map((c, i) => cellule(i, LIGNE_ENTETE, c.titre, STYLE.entete)).join('')}</row>`)

  f.lignes.forEach((l, j) => {
    const r = LIGNE_ENTETE + 1 + j
    lignes.push(`<row r="${r}">${f.colonnes.map((c, i) => cellule(i, r, l[i], styleDe(f.formatDe?.(j, i) ?? c.format, false))).join('')}</row>`)
  })
  if (f.total) {
    const r = derniereDonnee + 1
    lignes.push(`<row r="${r}">${f.colonnes.map((c, i) => cellule(i, r, f.total?.[i], styleDe(c.format, true))).join('')}</row>`)
  }

  const barres = f.colonnes.flatMap((c, i) => {
    if (!c.barres || f.lignes.length === 0) return []
    const zone = `${lettre(i)}${LIGNE_ENTETE + 1}:${lettre(i)}${derniereDonnee}`
    return [`<conditionalFormatting sqref="${zone}"><cfRule type="dataBar" priority="${i + 1}"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="FFE8A98A"/></dataBar></cfRule></conditionalFormatting>`]
  }).join('') + (f.chaleur && f.lignes.length > 0
    ? `<conditionalFormatting sqref="B${LIGNE_ENTETE + 1}:${lettre(n - 1)}${derniereDonnee}"><cfRule type="colorScale" priority="${n + 1}"><colorScale><cfvo type="min"/><cfvo type="max"/><color rgb="FFFFFFFF"/><color rgb="FFE8845A"/></colorScale></cfRule></conditionalFormatting>`
    : '')

  const filtre = f.lignes.length > 0 ? `<autoFilter ref="A${LIGNE_ENTETE}:${lettre(n - 1)}${derniereDonnee}"/>` : ''

  return `${ENTETE_XML}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${LIGNE_ENTETE}" topLeftCell="A${LIGNE_ENTETE + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${LIGNE_ENTETE + 1}" sqref="A${LIGNE_ENTETE + 1}"/></sheetView></sheetViews>`
    + `<sheetFormatPr defaultRowHeight="15"/>`
    + `<cols>${largeurs(f).map((l, i) => `<col min="${i + 1}" max="${i + 1}" width="${l}" customWidth="1"/>`).join('')}</cols>`
    + `<sheetData>${lignes.join('')}</sheetData>`
    + filtre
    + barres
    + `<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>`
    + `<pageSetup orientation="landscape" fitToHeight="0"/>`
    + (aDessin ? '<drawing r:id="rId1"/>' : '')
    + `</worksheet>`
}

/* ── Les graphiques natifs ──────────────────────────────────── */

function refFeuille(nom: string): string {
  return `'${nom.replace(/'/g, "''")}'`
}

function graphiqueXml(g: Graphique, source: Feuille): string {
  const nb = g.lignes ? Math.min(g.lignes, source.lignes.length) : source.lignes.length
  const premiere = LIGNE_ENTETE + 1
  const derniere = LIGNE_ENTETE + Math.max(nb, 1)
  const feuille = refFeuille(source.nom)
  const categories = `${feuille}!$${lettre(g.categories)}$${premiere}:$${lettre(g.categories)}$${derniere}`

  const series = g.series.map((s, i) => {
    const col = lettre(s.colonne)
    const tete = `<c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:strRef><c:f>${feuille}!$${col}$${LIGNE_ENTETE}</c:f></c:strRef></c:tx>`
    const donnees = `<c:cat><c:strRef><c:f>${categories}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${feuille}!$${col}$${premiere}:$${col}$${derniere}</c:f></c:numRef></c:val>`
    return g.type === 'ligne'
      ? `<c:ser>${tete}<c:spPr><a:ln w="25400" cap="rnd"><a:solidFill><a:srgbClr val="${s.couleur}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>${donnees}<c:smooth val="0"/></c:ser>`
      : `<c:ser>${tete}<c:spPr><a:solidFill><a:srgbClr val="${s.couleur}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>${donnees}</c:ser>`
  }).join('')

  const trace = g.type === 'ligne'
    ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/><c:axId val="50010"/><c:axId val="50020"/></c:lineChart>`
    : `<c:barChart><c:barDir val="${g.type === 'barres' ? 'bar' : 'col'}"/><c:grouping val="${g.empile ? 'stacked' : 'clustered'}"/><c:varyColors val="0"/>${series}<c:gapWidth val="50"/>${g.empile ? '<c:overlap val="100"/>' : ''}<c:axId val="50010"/><c:axId val="50020"/></c:barChart>`

  const horizontal = g.type === 'barres'
  const grille = '<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E6DED6"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>'

  return `${ENTETE_XML}<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<c:roundedCorners val="0"/><c:chart>`
    + `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="fr-FR" sz="1200" b="1"/><a:t>${xml(g.titre)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
    + `<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${trace}`
    + `<c:catAx><c:axId val="50010"/><c:scaling><c:orientation val="${horizontal ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/><c:crossAx val="50020"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`
    + `<c:valAx><c:axId val="50020"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? 't' : 'l'}"/>${grille}<c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="50010"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`
    + `</c:plotArea>`
    + (g.series.length > 1 ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' : '')
    + `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`
}

function dessinXml(graphiques: Graphique[]): string {
  const ancres = graphiques.map((g, i) => {
    const { colonne, ligne, largeur, hauteur } = g.place
    return `<xdr:twoCellAnchor><xdr:from><xdr:col>${colonne}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${ligne}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
      + `<xdr:to><xdr:col>${colonne + largeur}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${ligne + hauteur}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
      + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Graphique ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>`
      + `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>`
      + `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${i + 1}"/></a:graphicData></a:graphic>`
      + `</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
  }).join('')
  return `${ENTETE_XML}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${ancres}</xdr:wsDr>`
}

/* ── Le classeur ────────────────────────────────────────────── */

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'

export function versXlsx(feuilles: Feuille[], maintenant = new Date()): Blob {
  const fichiers: { nom: string; contenu: string }[] = []
  const types: string[] = []
  let numeroDessin = 0
  let numeroGraphique = 0

  feuilles.forEach((f, i) => {
    const graphiques = f.graphiques ?? []
    const aDessin = graphiques.length > 0
    fichiers.push({ nom: `xl/worksheets/sheet${i + 1}.xml`, contenu: feuilleXml(f, aDessin) })
    types.push(`<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)

    if (!aDessin) return

    numeroDessin++
    fichiers.push({
      nom: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`,
      contenu: `${ENTETE_XML}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/drawing" Target="../drawings/drawing${numeroDessin}.xml"/></Relationships>`,
    })
    fichiers.push({ nom: `xl/drawings/drawing${numeroDessin}.xml`, contenu: dessinXml(graphiques) })
    types.push(`<Override PartName="/xl/drawings/drawing${numeroDessin}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`)

    const liens = graphiques.map((g, j) => {
      numeroGraphique++
      const source = feuilles.find((x) => x.nom === g.feuille) ?? f
      fichiers.push({ nom: `xl/charts/chart${numeroGraphique}.xml`, contenu: graphiqueXml(g, source) })
      types.push(`<Override PartName="/xl/charts/chart${numeroGraphique}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`)
      return `<Relationship Id="rId${j + 1}" Type="${REL}/chart" Target="../charts/chart${numeroGraphique}.xml"/>`
    }).join('')
    fichiers.push({
      nom: `xl/drawings/_rels/drawing${numeroDessin}.xml.rels`,
      contenu: `${ENTETE_XML}<Relationships xmlns="${PKG}">${liens}</Relationships>`,
    })
  })

  const filtres = feuilles.flatMap((f, i) => (f.lignes.length > 0
    ? [`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${xml(refFeuille(f.nom))}!$A$${LIGNE_ENTETE}:$${lettre(f.colonnes.length - 1)}$${LIGNE_ENTETE + f.lignes.length}</definedName>`]
    : []))

  fichiers.push(
    {
      nom: 'xl/workbook.xml',
      contenu: `${ENTETE_XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}">`
        + `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14000"/></bookViews>`
        + `<sheets>${feuilles.map((f, i) => `<sheet name="${xml(f.nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>`
        + (filtres.length ? `<definedNames>${filtres.join('')}</definedNames>` : '')
        + `</workbook>`,
    },
    {
      nom: 'xl/_rels/workbook.xml.rels',
      contenu: `${ENTETE_XML}<Relationships xmlns="${PKG}">`
        + feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
        + `<Relationship Id="rId${feuilles.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
    },
    { nom: 'xl/styles.xml', contenu: STYLES },
    {
      nom: '_rels/.rels',
      contenu: `${ENTETE_XML}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
  )

  // Excel lit `[Content_Types].xml` en premier : il ouvre l'archive.
  fichiers.unshift({
    nom: '[Content_Types].xml',
    contenu: `${ENTETE_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
      + `<Default Extension="xml" ContentType="application/xml"/>`
      + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
      + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
      + types.join('')
      + `</Types>`,
  })

  return zip(fichiers, maintenant)
}

/* ── Le CSV ─────────────────────────────────────────────────── */

function celluleCsv(valeur: Valeur, format?: FormatColonne): string {
  if (valeur === null || valeur === undefined) return ''
  if (typeof valeur === 'number') {
    if (!Number.isFinite(valeur)) return ''
    if (format === 'pourcent' || format === 'evolution') return `${String(Math.round(valeur * 1000) / 10).replace('.', ',')} %`
    return String(valeur).replace('.', ',')
  }
  const texte = /^[=+\-@\t\r]/.test(valeur) ? `'${valeur}` : valeur
  return /[;"\r\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte
}

/**
 * Un seul fichier, les tableaux l'un sous l'autre : un CSV n'a pas de feuilles.
 * Point-virgule, virgule décimale et marque d'ordre des octets : c'est ce qu'Excel
 * attend en français pour ouvrir le fichier du premier coup.
 */
export function versCsv(feuilles: Feuille[]): Blob {
  const lignes: string[] = []
  for (const f of feuilles) {
    lignes.push(celluleCsv(f.titre))
    if (f.note) lignes.push(celluleCsv(f.note))
    lignes.push(f.colonnes.map((c) => celluleCsv(c.titre)).join(';'))
    f.lignes.forEach((l, j) => {
      lignes.push(f.colonnes.map((c, i) => celluleCsv(l[i], f.formatDe?.(j, i) ?? c.format)).join(';'))
    })
    if (f.total) lignes.push(f.colonnes.map((c, i) => celluleCsv(f.total?.[i], c.format)).join(';'))
    lignes.push('')
  }
  return new Blob([String.fromCharCode(0xFEFF), lignes.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}
