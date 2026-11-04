@php
    $fcfa = fn ($m) => number_format((int) $m, 0, ',', "\u{00A0}")."\u{00A0}FCFA";
    $formules = ['nuitee' => 'Nuitée', 'journee' => 'Journée', 'demi_journee' => 'Demi-journée', 'pass' => 'Pass'];
    $unites = ['nuitee' => 'la nuit', 'journee' => 'la journée', 'demi_journee' => 'la demi-journée', 'pass' => 'le pass'];
    $options = fn ($t) => collect([$t->avec_clim ? 'avec clim' : null, $t->avec_buffet ? 'avec buffet' : null])->filter()->implode(' et ');
@endphp
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Catalogue — {{ $proprietaire->name }}</title>
<style>
    @page { margin: 14mm 14mm 18mm; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 9pt; color: #1A1614; line-height: 1.4; }
    table { border-collapse: collapse; width: 100%; }
    .entete td { vertical-align: middle; }
    .logo { width: 32pt; height: 32pt; }
    .marque { font-size: 13pt; font-weight: bold; }
    .marque-detail { font-size: 7.8pt; color: #6B625A; }
    .doc { text-align: right; font-size: 8pt; font-weight: bold; color: #A34D1F; letter-spacing: 1.2pt; text-transform: uppercase; }
    .filet { border-top: 2px solid #A34D1F; margin: 8pt 0 12pt; }
    h1 { font-size: 17pt; margin: 0 0 2pt; }
    .chapeau { color: #6B625A; margin-bottom: 6pt; }
    .annonce { page-break-inside: avoid; margin-top: 14pt; padding-top: 12pt; border-top: 1px solid #E6DED6; }
    .annonce h2 { font-size: 13pt; margin: 0 0 1pt; }
    .lieu { color: #6B625A; font-size: 8.6pt; margin-bottom: 6pt; }
    .photos td { vertical-align: top; padding: 0 3pt 0 0; }
    .principale { width: 100%; }
    .vignette { width: 100%; margin-bottom: 3pt; }
    .description { margin: 7pt 0; color: #3D3631; font-size: 8.6pt; }
    .tarifs th { background: #F7F3EE; color: #6B625A; font-size: 7pt; text-transform: uppercase; letter-spacing: .5pt; padding: 4pt 6pt; text-align: left; border-bottom: 1px solid #E6DED6; }
    .tarifs td { padding: 4pt 6pt; border-bottom: 1px solid #F0EAE3; vertical-align: top; }
    .nombre { text-align: right; white-space: nowrap; }
    .lien { margin-top: 5pt; font-size: 8pt; color: #A34D1F; }
    .pied { position: fixed; bottom: -11mm; left: 0; right: 0; text-align: center; font-size: 7.2pt; color: #8A8178; border-top: 1px solid #E6DED6; padding-top: 3pt; }
</style>
</head>
<body>

<div class="pied">
    Réservations et renseignements : PasseTemps · passetemps.sn · WhatsApp {{ $contact['telephone'] }} · {{ $contact['email'] }}
</div>

<table class="entete">
    <tr>
        <td style="width: 40pt;">@if ($logo)<img class="logo" src="{{ $logo }}" alt="">@endif</td>
        <td>
            <div class="marque">PasseTemps</div>
            <div class="marque-detail">Plateforme de réservation · Hébergements au Sénégal · passetemps.sn</div>
        </td>
        <td class="doc">Catalogue des hébergements</td>
    </tr>
</table>
<div class="filet"></div>

<h1>{{ $proprietaire->name }}</h1>
<div class="chapeau">
    {{ $annonces->count() }} {{ $annonces->count() > 1 ? 'hébergements en ligne' : 'hébergement en ligne' }} sur PasseTemps,
    aux prix affichés le {{ now()->locale('fr')->isoFormat('D MMMM YYYY') }}. Les disponibilités se confirment auprès de notre équipe.
</div>

@foreach ($annonces as $v)
<div class="annonce">
    <h2>{{ $v->nom }}</h2>
    <div class="lieu">{{ collect([$v->quartier, $v->ville])->filter()->unique()->implode(', ') }}</div>

    @php
        $principale = $photos[$v->id.'-0'] ?? null;
        $vignettes = array_values(array_filter([$photos[$v->id.'-1'] ?? null, $photos[$v->id.'-2'] ?? null]));
    @endphp
    @if ($principale)
    <table class="photos">
        <tr>
            <td style="width: {{ $vignettes ? '66%' : '100%' }};"><img class="principale" src="{{ $principale }}" alt=""></td>
            @if ($vignettes)
            <td style="width: 34%;">
                @foreach ($vignettes as $vignette)<img class="vignette" src="{{ $vignette }}" alt="">@endforeach
            </td>
            @endif
        </tr>
    </table>
    @endif

    @if ($v->description)
        <div class="description">{{ \Illuminate\Support\Str::limit(preg_replace('/\s+/', ' ', strip_tags($v->description)), 420) }}</div>
    @endif

    <table class="tarifs">
        <thead><tr><th>Logement</th><th>Capacité</th><th>Formule</th><th class="nombre">Prix</th></tr></thead>
        <tbody>
        @foreach ($v->logements as $l)
            @foreach ($l->tarifs as $i => $t)
            <tr>
                <td>{{ $i === 0 ? $l->nom : '' }}</td>
                <td>{{ $i === 0 ? $l->capacite.' pers.' : '' }}</td>
                <td>{{ $formules[$t->type_tarif] ?? $t->type_tarif }}{{ $options($t) ? ', '.$options($t) : '' }}</td>
                <td class="nombre">{{ $fcfa($t->prix) }} / {{ $unites[$t->type_tarif] ?? '' }}</td>
            </tr>
            @endforeach
        @endforeach
        </tbody>
    </table>
    <div class="lien">passetemps.sn/hebergements/{{ $v->id }}/</div>
</div>
@endforeach

</body>
</html>
