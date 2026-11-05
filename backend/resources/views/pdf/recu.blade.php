@php
    $fcfa = fn ($m) => number_format((int) $m, 0, ',', "\u{00A0}")."\u{00A0}FCFA";
    $date = fn ($d) => $d ? ucfirst(\Carbon\Carbon::parse($d)->locale($en ? 'en' : 'fr')->isoFormat($en ? 'dddd, D MMMM YYYY' : 'dddd D MMMM YYYY')) : null;
    $annule = $reglement->statut !== 'valide';
    // Les mots du document. Un client venu de /en/ reçoit son reçu en anglais.
    $t = $en ? [
        'titre' => 'Receipt', 'type' => 'Payment receipt', 'annule' => 'Cancelled receipt', 'date' => 'Received on', 'moyen' => 'Payment method',
        'reference' => 'Reference', 'de' => 'Received from', 'somme' => 'Amount received', 'lettres' => 'That is:', 'pour' => 'For',
        'devis' => 'Quote', 'sejour' => 'Stay', 'du' => 'from', 'au' => 'to', 'recap' => 'Account', 'total' => 'Total of the quote',
        'avant' => 'Already paid', 'recu' => 'This receipt', 'reste' => 'Balance due', 'solde' => 'Paid in full', 'avant_arrivee' => 'The balance is due before your arrival.',
        'signature' => 'For PasseTemps', 'mention' => 'This receipt confirms the sum received. The booking is subject to the terms agreed with PasseTemps.',
        'annule_texte' => 'This receipt was cancelled and is no longer valid.',
    ] : [
        'titre' => 'Reçu', 'type' => 'Reçu de paiement', 'annule' => 'Reçu annulé', 'date' => 'Reçu le', 'moyen' => 'Moyen de paiement',
        'reference' => 'Référence', 'de' => 'Reçu de', 'somme' => 'Somme reçue', 'lettres' => 'Soit :', 'pour' => 'Pour',
        'devis' => 'Devis', 'sejour' => 'Séjour', 'du' => 'du', 'au' => 'au', 'recap' => 'État du dossier', 'total' => 'Total du devis',
        'avant' => 'Déjà réglé', 'recu' => 'Ce reçu', 'reste' => 'Reste à payer', 'solde' => 'Entièrement réglé', 'avant_arrivee' => 'Le solde est à régler avant votre arrivée.',
        'signature' => 'Pour PasseTemps', 'mention' => 'Ce reçu atteste de la somme reçue. La réservation suit les modalités convenues avec PasseTemps.',
        'annule_texte' => 'Ce reçu a été annulé et n’a plus de valeur.',
    ];
@endphp
<!DOCTYPE html>
<html lang="{{ $en ? 'en' : 'fr' }}">
<head>
<meta charset="utf-8">
<title>{{ $t['titre'] }} {{ $reglement->numero }}</title>
<style>
    @page { margin: 15mm 15mm 22mm; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 9.4pt; color: #1A1614; line-height: 1.4; }
    table { border-collapse: collapse; }
    .entete { width: 100%; }
    .entete td { vertical-align: middle; }
    .logo { width: 34pt; height: 34pt; }
    .marque { font-size: 13pt; font-weight: bold; }
    .marque-detail { font-size: 7.8pt; color: #6B625A; }
    .doc { text-align: right; }
    .doc-type { font-size: 8pt; font-weight: bold; color: #A34D1F; letter-spacing: 1.2pt; text-transform: uppercase; }
    .doc-numero { font-size: 15pt; font-weight: bold; }
    .filet { border-top: 2px solid #A34D1F; margin: 8pt 0 14pt; }
    .annule { margin-bottom: 12pt; padding: 8pt 10pt; border: 2px solid #C42020; color: #C42020; font-weight: bold; text-align: center; }
    .somme { width: 100%; background: #F7F3EE; border: 1px solid #E6DED6; }
    .somme td { padding: 12pt 14pt; vertical-align: middle; }
    .somme-libelle { font-size: 7.5pt; font-weight: bold; color: #6B625A; text-transform: uppercase; letter-spacing: .7pt; }
    .somme-montant { font-size: 20pt; font-weight: bold; color: #A34D1F; white-space: nowrap; }
    .barre { text-decoration: line-through; color: #8A8178; }
    .lettres { margin-top: 3pt; font-size: 9pt; color: #3D3631; }
    .cadre { width: 100%; margin-top: 12pt; }
    .cadre td { width: 50%; padding: 7pt 10pt; border: 1px solid #E6DED6; vertical-align: top; }
    .etiquette { font-size: 7pt; font-weight: bold; color: #6B625A; text-transform: uppercase; letter-spacing: .7pt; }
    .valeur { font-size: 10pt; margin-top: 1.5pt; }
    .detail { color: #6B625A; font-size: 8pt; margin-top: 1.5pt; }
    h2 { font-size: 10pt; margin: 15pt 0 6pt; }
    .recap { width: 100%; }
    .recap td { padding: 6pt 10pt; border-bottom: 1px solid #E6DED6; }
    .nombre { text-align: right; white-space: nowrap; }
    .fort td { font-weight: bold; font-size: 11pt; border-top: 2px solid #A34D1F; border-bottom: 0; color: #A34D1F; }
    .signature { width: 50%; margin: 18pt 0 0 auto; border: 1px solid #E6DED6; padding: 8pt 10pt; height: 66pt; }
    .mention { margin-top: 14pt; font-size: 8pt; color: #6B625A; }
    .pied { position: fixed; bottom: -14mm; left: 0; right: 0; text-align: center; font-size: 7.4pt; color: #8A8178; border-top: 1px solid #E6DED6; padding-top: 4pt; }
</style>
</head>
<body>

<div class="pied">
    {{ $emetteur['nom'] }} · {{ $emetteur['site'] }} · WhatsApp {{ $emetteur['telephone'] }} · {{ $emetteur['email'] }}
    @if ($emetteur['adresse']) · {{ $emetteur['adresse'] }} @endif
    @if ($emetteur['ninea']) · NINEA {{ $emetteur['ninea'] }} @endif
    @if ($emetteur['rccm']) · RCCM {{ $emetteur['rccm'] }} @endif
</div>

<table class="entete">
    <tr>
        <td style="width: 42pt;">@if ($logo)<img class="logo" src="{{ $logo }}" alt="">@endif</td>
        <td>
            <div class="marque">{{ $emetteur['nom'] }}</div>
            <div class="marque-detail">{{ $emetteur['activite'] }} · {{ $emetteur['site'] }}</div>
        </td>
        <td class="doc">
            <div class="doc-type">{{ $annule ? $t['annule'] : $t['type'] }}</div>
            <div class="doc-numero">{{ $reglement->numero }}</div>
        </td>
    </tr>
</table>

<div class="filet"></div>

@if ($annule)
<div class="annule">{{ $t['annule_texte'] }}</div>
@endif

<table class="somme">
    <tr>
        <td>
            <div class="somme-libelle">{{ $t['somme'] }}</div>
            <div class="somme-montant {{ $annule ? 'barre' : '' }}">{{ $fcfa($reglement->montant) }}</div>
            <div class="lettres">{{ $t['lettres'] }} {{ $enLettres }}.</div>
        </td>
    </tr>
</table>

<table class="cadre">
    <tr>
        <td>
            <div class="etiquette">{{ $t['de'] }}</div>
            <div class="valeur">{{ $reglement->client_nom }}</div>
        </td>
        <td>
            <div class="etiquette">{{ $t['date'] }}</div>
            <div class="valeur">{{ $date($reglement->recu_le) }}</div>
        </td>
    </tr>
    <tr>
        <td>
            <div class="etiquette">{{ $t['moyen'] }}</div>
            <div class="valeur">{{ $moyen }}</div>
        </td>
        <td>
            <div class="etiquette">{{ $t['reference'] }}</div>
            <div class="valeur">{{ $reglement->reference ?: '—' }}</div>
        </td>
    </tr>
    <tr>
        <td colspan="2">
            <div class="etiquette">{{ $t['pour'] }}</div>
            <div class="valeur">{{ $devis?->titre ?? $reglement->devis_numero }}</div>
            <div class="detail">
                {{ $t['devis'] }} {{ $reglement->devis_numero }}@if ($lieu) · {{ $lieu }}@endif
                @if ($devis?->date_arrivee)
                    · {{ $t['sejour'] }} {{ $t['du'] }} {{ $devis->date_arrivee->format('d/m/Y') }} {{ $t['au'] }} {{ $devis->date_depart?->format('d/m/Y') }}
                @endif
            </div>
        </td>
    </tr>
</table>

@unless ($annule)
<h2>{{ $t['recap'] }}</h2>
<table class="recap">
    <tr><td>{{ $t['total'] }}</td><td class="nombre">{{ $fcfa($total) }}</td></tr>
    <tr><td>{{ $t['avant'] }}</td><td class="nombre">{{ $fcfa($avant) }}</td></tr>
    <tr><td>{{ $t['recu'] }}</td><td class="nombre">{{ $fcfa($reglement->montant) }}</td></tr>
    <tr class="fort">
        <td>{{ $reste > 0 ? $t['reste'] : $t['solde'] }}</td>
        <td class="nombre">{{ $reste > 0 ? $fcfa($reste) : '' }}</td>
    </tr>
</table>
@if ($reste > 0)
<p class="mention">{{ $t['avant_arrivee'] }}</p>
@endif
@endunless

<div class="signature"><div class="etiquette">{{ $t['signature'] }}</div></div>

<p class="mention">{{ $t['mention'] }}</p>

</body>
</html>
