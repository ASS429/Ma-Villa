@php
    $en = $en ?? false;
    $fcfa = fn ($m) => number_format((int) $m, 0, ',', "\u{00A0}")."\u{00A0}FCFA";
    $date = fn ($d) => $d ? ucfirst(\Carbon\Carbon::parse($d)->locale($en ? 'en' : 'fr')->isoFormat($en ? 'dddd, D MMMM YYYY' : 'dddd D MMMM YYYY')) : null;
    $pluriel = fn ($unite, $n) => $unite && $n > 1 && ! str_ends_with($unite, 's') ? $unite.'s' : $unite;
    $enLigne = $devis->origine === 'site';
    // Les mots du document. Un client venu de /en/ reçoit son devis en anglais.
    $t = $en ? [
        'titre' => 'Quote', 'type' => 'Rental quote', 'en_ligne' => 'Prepared online', 'numero' => 'Quote no.',
        'emission' => 'Date of issue', 'validite' => 'Valid until', 'client' => 'Customer', 'occupant' => 'Guest',
        'sejour' => 'Stay details', 'arrivee' => 'Arrival', 'depart' => 'Departure', 'duree' => 'Length',
        'personnes' => 'guests', 'pers' => 'guests', 'prestations' => 'Services', 'prestation' => 'Service',
        'quantite' => 'Quantity', 'prix' => 'Unit price', 'montant' => 'Amount', 'total' => 'Total due',
        'lettres' => 'This quote amounts to:', 'conditions' => 'Terms and notes', 'le_client' => 'The customer',
        'pour' => 'For PasseTemps', 'signature' => 'Signature and stamp', 'a_valider' => 'To be confirmed by the PasseTemps team',
        'cachet_1' => 'Booking platform', 'cachet_2' => 'Places to stay in Senegal', 'tel' => 'Tel',
    ] : [
        'titre' => 'Devis', 'type' => 'Devis de location', 'en_ligne' => 'Établi en ligne', 'numero' => 'Devis n°',
        'emission' => 'Date d’émission', 'validite' => 'Valable jusqu’au', 'client' => 'Client', 'occupant' => 'Occupant',
        'sejour' => 'Détail du séjour', 'arrivee' => 'Date d’arrivée', 'depart' => 'Date de départ', 'duree' => 'Durée',
        'personnes' => 'personnes', 'pers' => 'pers.', 'prestations' => 'Prestations', 'prestation' => 'Prestation',
        'quantite' => 'Quantité', 'prix' => 'Prix unitaire', 'montant' => 'Montant', 'total' => 'Total à payer',
        'lettres' => 'Arrêté le présent devis à la somme de :', 'conditions' => 'Conditions et observations', 'le_client' => 'Le client',
        'pour' => 'Pour PasseTemps', 'signature' => 'Signature et cachet', 'a_valider' => 'À valider par l’équipe PasseTemps',
        'cachet_1' => 'Plateforme de réservation', 'cachet_2' => 'Hébergements au Sénégal', 'tel' => 'Tél',
    ];
@endphp
<!DOCTYPE html>
<html lang="{{ $en ? 'en' : 'fr' }}">
<head>
<meta charset="utf-8">
<title>{{ $t['titre'] }} {{ $devis->numero }}</title>
<style>
    @page { margin: 15mm 15mm 22mm; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 9pt; color: #1A1614; line-height: 1.35; }
    table { border-collapse: collapse; }
    .entete { width: 100%; }
    .entete td { vertical-align: middle; }
    .logo { width: 34pt; height: 34pt; }
    .marque { font-size: 13pt; font-weight: bold; color: #1A1614; }
    .marque-detail { font-size: 7.8pt; color: #6B625A; }
    .doc { text-align: right; }
    .doc-type { font-size: 8pt; font-weight: bold; color: #A34D1F; letter-spacing: 1.2pt; text-transform: uppercase; }
    .doc-numero { font-size: 15pt; font-weight: bold; }
    .en-ligne { display: inline-block; margin-top: 3pt; padding: 1.5pt 6pt; border: 1px solid #A34D1F; color: #A34D1F; font-size: 7pt; border-radius: 6pt; }
    .filet { border-top: 2px solid #A34D1F; margin: 8pt 0 10pt; }
    h1 { font-size: 15pt; margin: 0 0 1pt; text-transform: uppercase; letter-spacing: .3pt; }
    .sous-titre { color: #6B625A; font-size: 8.6pt; margin-bottom: 8pt; }
    .cadre { width: 100%; }
    .cadre td { width: 33.3%; padding: 6pt 8pt; border: 1px solid #E6DED6; background: #F7F3EE; vertical-align: top; }
    .etiquette { font-size: 7pt; font-weight: bold; color: #6B625A; text-transform: uppercase; letter-spacing: .7pt; }
    .valeur { font-size: 10pt; margin-top: 1.5pt; }
    h2 { font-size: 10pt; margin: 11pt 0 5pt; }
    .sejour { width: 100%; }
    .sejour td { width: 33.3%; padding: 6pt 8pt; border: 1px solid #E6DED6; vertical-align: top; }
    .lignes { width: 100%; margin-top: 4pt; }
    .lignes th { background: #A34D1F; color: #FFFFFF; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .6pt; padding: 7pt 8pt; text-align: left; }
    .lignes td { padding: 6pt 8pt; border-bottom: 1px solid #E6DED6; vertical-align: top; }
    .detail { color: #6B625A; font-size: 8pt; margin-top: 1.5pt; }
    .nombre { text-align: right; white-space: nowrap; }
    .total { margin-top: 8pt; width: 100%; }
    .total td { padding: 6pt 10pt; }
    .total-libelle { text-align: right; font-size: 10pt; font-weight: bold; }
    .total-montant { text-align: right; font-size: 15pt; font-weight: bold; color: #A34D1F; white-space: nowrap; width: 38%; border-top: 2px solid #A34D1F; }
    .lettres { margin-top: 8pt; font-size: 9pt; }
    .conditions { margin-top: 11pt; padding: 7pt 10pt; border-left: 3px solid #E6DED6; color: #3D3631; font-size: 8.6pt; }
    .signatures { width: 100%; margin-top: 12pt; page-break-inside: avoid; }
    .signatures td { width: 50%; border: 1px solid #E6DED6; padding: 8pt 10pt; vertical-align: top; height: 84pt; }
    .cachet { margin: 5pt auto 0; width: 175pt; border: 2.4pt double #2742B5; color: #2742B5; padding: 5pt 4pt; text-align: center; transform: rotate(-4deg); }
    .cachet-nom { font-size: 15pt; font-weight: bold; letter-spacing: 1.5pt; }
    .cachet-ligne { font-size: 7.4pt; font-weight: bold; }
    .a-valider { margin-top: 26pt; color: #8A8178; font-size: 8pt; text-align: center; }
    .pied { position: fixed; bottom: -14mm; left: 0; right: 0; text-align: center; font-size: 7.4pt; color: #8A8178; border-top: 1px solid #E6DED6; padding-top: 4pt; }
</style>
</head>
<body>

<div class="pied">
    {{ $emetteur['nom'] }} · {{ $emetteur['titulaire'] }}, {{ $en ? 'sole proprietorship' : 'entreprise individuelle' }}
    @if ($emetteur['ninea']) · NINEA {{ $emetteur['ninea'] }} @endif
    @if ($emetteur['rccm']) · RCCM {{ $emetteur['rccm'] }} @endif
    <br>{{ $emetteur['site'] }} · WhatsApp {{ $emetteur['telephone'] }} · {{ $emetteur['email'] }}
    @if ($emetteur['adresse']) · {{ $emetteur['adresse'] }} @endif
</div>

<table class="entete">
    <tr>
        <td style="width: 42pt;">
            @if ($logo)<img class="logo" src="{{ $logo }}" alt="">@endif
        </td>
        <td>
            <div class="marque">{{ $emetteur['nom'] }}</div>
            <div class="marque-detail">{{ $emetteur['activite'] }} · {{ $emetteur['site'] }}</div>
        </td>
        <td class="doc">
            <div class="doc-type">{{ $t['type'] }}</div>
            <div class="doc-numero">{{ $en ? 'No.' : 'N°' }} {{ $devis->numero }}</div>
            @if ($enLigne)<div class="en-ligne">{{ $t['en_ligne'] }}</div>@endif
        </td>
    </tr>
</table>

<div class="filet"></div>

<h1>{{ $devis->titre }}</h1>
@if ($sousTitre)<div class="sous-titre">{{ $sousTitre }}</div>@endif

<table class="cadre">
    <tr>
        <td>
            <div class="etiquette">{{ $t['numero'] }}</div>
            <div class="valeur">{{ $devis->numero }}</div>
        </td>
        <td>
            <div class="etiquette">{{ $t['emission'] }}</div>
            <div class="valeur">{{ $date($devis->date_emission) }}</div>
        </td>
        <td>
            <div class="etiquette">{{ $t['validite'] }}</div>
            <div class="valeur">{{ $date($devis->valable_jusqu_au) ?? '—' }}</div>
        </td>
    </tr>
    <tr>
        <td colspan="{{ $devis->occupant_nom ? 2 : 3 }}">
            <div class="etiquette">{{ $t['client'] }}</div>
            <div class="valeur">{{ $devis->client_nom }}</div>
            @if ($devis->client_telephone || $devis->client_email)
                <div class="detail">{{ collect([$devis->client_telephone, $devis->client_email])->filter()->implode(' · ') }}</div>
            @endif
        </td>
        @if ($devis->occupant_nom)
        <td>
            <div class="etiquette">{{ $t['occupant'] }}</div>
            <div class="valeur">{{ $devis->occupant_nom }}</div>
        </td>
        @endif
    </tr>
</table>

@if ($devis->date_arrivee || $devis->date_depart || $duree || $devis->personnes)
<h2>{{ $t['sejour'] }}</h2>
<table class="sejour">
    <tr>
        <td><div class="etiquette">{{ $t['arrivee'] }}</div><div class="valeur"><b>{{ $date($devis->date_arrivee) ?? '—' }}</b></div></td>
        <td><div class="etiquette">{{ $t['depart'] }}</div><div class="valeur"><b>{{ $date($devis->date_depart) ?? '—' }}</b></div></td>
        <td>
            <div class="etiquette">{{ $t['duree'] }}{{ $devis->personnes ? ' · '.$t['personnes'] : '' }}</div>
            <div class="valeur"><b>{{ collect([$duree, $devis->personnes ? $devis->personnes.' '.$t['pers'] : null])->filter()->implode(' · ') ?: '—' }}</b></div>
        </td>
    </tr>
</table>
@endif

<h2>{{ $t['prestations'] }}</h2>
<table class="lignes">
    <thead>
        <tr>
            <th style="width: 46%;">{{ $t['prestation'] }}</th>
            <th class="nombre" style="width: 16%;">{{ $t['quantite'] }}</th>
            <th class="nombre" style="width: 19%;">{{ $t['prix'] }}</th>
            <th class="nombre" style="width: 19%;">{{ $t['montant'] }}</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($devis->lignes as $ligne)
        <tr>
            <td>
                {{ $ligne['designation'] }}
                @if (! empty($ligne['detail']))<div class="detail">{{ $ligne['detail'] }}</div>@endif
            </td>
            <td class="nombre">{{ $ligne['quantite'] }} {{ $pluriel($ligne['unite'] ?? null, $ligne['quantite']) }}</td>
            <td class="nombre">{{ $fcfa($ligne['prix_unitaire']) }}</td>
            <td class="nombre">{{ $fcfa($ligne['montant']) }}</td>
        </tr>
        @endforeach
    </tbody>
</table>

<table class="total">
    <tr>
        <td class="total-libelle">{{ $t['total'] }}</td>
        <td class="total-montant">{{ $fcfa($devis->total) }}</td>
    </tr>
</table>

<div class="lettres"><b>{{ $t['lettres'] }}</b> {{ $enLettres }}.</div>

@if ($devis->conditions)
<div class="conditions">
    <div class="etiquette" style="margin-bottom: 3pt;">{{ $t['conditions'] }}</div>
    {!! nl2br(e($devis->conditions)) !!}
</div>
@endif

<table class="signatures">
    <tr>
        <td>
            <div class="etiquette">{{ $t['le_client'] }}</div>
            <div class="detail">{{ $t['signature'] }}</div>
        </td>
        <td>
            <div class="etiquette">{{ $t['pour'] }}</div>
            <div class="detail">{{ $t['signature'] }}</div>
            @if ($devis->cachet)
                @if ($cachetImage)
                    <div style="text-align: center; margin-top: 6pt;"><img src="{{ $cachetImage }}" alt="" style="width: 175pt;"></div>
                @else
                    <div class="cachet">
                        <div class="cachet-nom">PASSETEMPS</div>
                        <div class="cachet-ligne">{{ $t['cachet_1'] }}</div>
                        <div class="cachet-ligne">{{ $t['cachet_2'] }}</div>
                        <div class="cachet-ligne">{{ $t['tel'] }} : {{ $emetteur['telephone'] }}</div>
                        <div class="cachet-ligne">www.{{ $emetteur['site'] }}</div>
                        <div class="cachet-ligne">NINEA {{ $emetteur['ninea'] }} · RCCM {{ $emetteur['rccm'] }}</div>
                    </div>
                @endif
            @elseif ($enLigne)
                <div class="a-valider">{{ $t['a_valider'] }}</div>
            @endif
        </td>
    </tr>
</table>

</body>
</html>
