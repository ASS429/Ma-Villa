@php
    $u = $utilisateur;
    $c = $chiffres;
    $fcfa = fn ($m) => number_format((int) $m, 0, ',', "\u{00A0}")."\u{00A0}FCFA";
    $date = fn ($d) => $d ? \Carbon\Carbon::parse($d)->locale('fr')->isoFormat('D MMM YYYY') : '—';
    $roles = ['client' => 'Client', 'proprietaire' => 'Propriétaire', 'admin' => 'Administrateur'];
    $statutsAnnonce = ['validee' => 'En ligne', 'en_attente' => 'En attente', 'rejetee' => 'Retirée', 'brouillon' => 'Brouillon'];
    $statutsResa = ['en_attente' => 'En attente', 'confirmee' => 'Confirmée', 'annulee' => 'Annulée'];
    $proprietaire = $c['annonces'] > 0;
@endphp
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Fiche — {{ $u['name'] }}</title>
<style>
    @page { margin: 15mm 15mm 20mm; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 8.8pt; color: #1A1614; line-height: 1.35; }
    table { border-collapse: collapse; width: 100%; }
    .entete td { vertical-align: middle; }
    .logo { width: 30pt; height: 30pt; }
    .marque { font-size: 12pt; font-weight: bold; }
    .confidentiel { text-align: right; font-size: 7.5pt; font-weight: bold; color: #A34D1F; letter-spacing: 1pt; text-transform: uppercase; }
    .filet { border-top: 2px solid #A34D1F; margin: 8pt 0 10pt; }
    h1 { font-size: 16pt; margin: 0; }
    .role { color: #6B625A; font-size: 9pt; margin-bottom: 8pt; }
    .alerte { margin: 6pt 0 10pt; padding: 6pt 9pt; border: 1px solid #C9A227; background: #FBF6E6; font-size: 8.4pt; }
    .infos td { width: 33.3%; padding: 6pt 8pt; border: 1px solid #E6DED6; background: #F7F3EE; vertical-align: top; }
    .etiquette { font-size: 6.8pt; font-weight: bold; color: #6B625A; text-transform: uppercase; letter-spacing: .6pt; }
    .valeur { font-size: 9.4pt; margin-top: 1pt; }
    h2 { font-size: 10pt; margin: 12pt 0 5pt; }
    .chiffres td { width: 25%; padding: 6pt 8pt; border: 1px solid #E6DED6; vertical-align: top; }
    .chiffre { font-size: 12pt; font-weight: bold; }
    .liste th { background: #A34D1F; color: #FFFFFF; font-size: 7pt; text-transform: uppercase; letter-spacing: .5pt; padding: 5pt 6pt; text-align: left; }
    .liste td { padding: 5pt 6pt; border-bottom: 1px solid #E6DED6; vertical-align: top; }
    .nombre { text-align: right; white-space: nowrap; }
    .vide { color: #8A8178; font-style: italic; }
    .pied { position: fixed; bottom: -12mm; left: 0; right: 0; text-align: center; font-size: 7pt; color: #8A8178; border-top: 1px solid #E6DED6; padding-top: 3pt; }
</style>
</head>
<body>

<div class="pied">
    Document interne PasseTemps — coordonnées personnelles, à ne pas transmettre.
    Édité le {{ now()->locale('fr')->isoFormat('D MMMM YYYY [à] HH:mm') }} par {{ $auteur?->name }}.
</div>

<table class="entete">
    <tr>
        <td style="width: 38pt;">@if ($logo)<img class="logo" src="{{ $logo }}" alt="">@endif</td>
        <td><div class="marque">PasseTemps</div></td>
        <td class="confidentiel">Fiche interne · confidentiel</td>
    </tr>
</table>
<div class="filet"></div>

<h1>{{ $u['name'] }}</h1>
<div class="role">{{ $roles[$u['role']] ?? $u['role'] }} · compte n° {{ $u['id'] }} · inscrit le {{ $date($u['created_at']) }}</div>

@if ($u['compte_d_attente'])
    <div class="alerte">Compte créé par import, sans boîte aux lettres : personne ne s’y connecte. Le rattacher à la vraie adresse du titulaire dès qu’elle est connue.</div>
@endif

<table class="infos">
    <tr>
        <td><div class="etiquette">E-mail</div><div class="valeur">{{ $u['email'] }}</div></td>
        <td><div class="etiquette">Téléphone</div><div class="valeur">{{ $u['phone'] ?: '—' }}</div></td>
        <td><div class="etiquette">Adresse confirmée</div><div class="valeur">{{ $u['email_verified_at'] ? 'Oui, le '.$date($u['email_verified_at']) : 'Non' }}</div></td>
    </tr>
</table>

<h2>En chiffres</h2>
<table class="chiffres">
    @if ($proprietaire)
    <tr>
        <td><div class="etiquette">Annonces</div><div class="chiffre">{{ $c['annonces'] }}</div><div class="vide">{{ $c['annonces_en_ligne'] }} en ligne</div></td>
        <td><div class="etiquette">Réservations reçues</div><div class="chiffre">{{ $c['reservations_recues'] }}</div></td>
        <td><div class="etiquette">Encaissé sur ses annonces</div><div class="chiffre">{{ $fcfa($c['encaisse']) }}</div><div class="vide">dont sa part : {{ $fcfa($c['part_proprietaire']) }}</div></td>
        <td><div class="etiquette">Versé · reste dû</div><div class="chiffre">{{ $fcfa($c['verse']) }}</div><div class="vide">dû : {{ $fcfa($c['du']) }}</div></td>
    </tr>
    @endif
    <tr>
        <td><div class="etiquette">Réservations faites</div><div class="chiffre">{{ $c['reservations_faites'] }}</div></td>
        <td><div class="etiquette">Commandes boutique</div><div class="chiffre">{{ $c['commandes'] }}</div></td>
        <td><div class="etiquette">Avis donnés</div><div class="chiffre">{{ $c['avis'] }}</div></td>
        <td><div class="etiquette">Messages envoyés</div><div class="chiffre">{{ $c['messages'] }}</div><div class="vide">contenu non reproduit</div></td>
    </tr>
</table>

@if ($proprietaire)
<h2>Ses annonces</h2>
<table class="liste">
    <thead><tr><th>Annonce</th><th>Lieu</th><th>Statut</th><th class="nombre">Logements</th><th class="nombre">À partir de</th></tr></thead>
    <tbody>
    @foreach ($annonces as $a)
        <tr>
            <td>{{ $a['nom'] }} <span class="vide">n° {{ $a['id'] }}</span></td>
            <td>{{ collect([$a['quartier'], $a['ville']])->filter()->unique()->implode(', ') }}</td>
            <td>{{ $statutsAnnonce[$a['statut']] ?? $a['statut'] }}</td>
            <td class="nombre">{{ $a['logements'] }}</td>
            <td class="nombre">{{ $a['prix_min'] ? $fcfa($a['prix_min']) : '—' }}</td>
        </tr>
    @endforeach
    </tbody>
</table>

<h2>Dernières réservations reçues</h2>
@if (count($reservations_recues))
<table class="liste">
    <thead><tr><th>N°</th><th>Hébergement</th><th>Client</th><th>Séjour</th><th>Statut</th><th class="nombre">Montant</th></tr></thead>
    <tbody>
    @foreach ($reservations_recues as $r)
        <tr>
            <td>#{{ $r['id'] }}</td>
            <td>{{ $r['hebergement'] }}</td>
            <td>{{ $r['client'] ?? '—' }}</td>
            <td>{{ $date($r['date_debut']) }} → {{ $date($r['date_fin']) }}</td>
            <td>{{ $statutsResa[$r['statut']] ?? $r['statut'] }}</td>
            <td class="nombre">{{ $fcfa($r['montant']) }}</td>
        </tr>
    @endforeach
    </tbody>
</table>
@else
<p class="vide">Aucune réservation reçue.</p>
@endif
@endif

@if (count($reservations))
<h2>Ses réservations</h2>
<table class="liste">
    <thead><tr><th>N°</th><th>Hébergement</th><th>Séjour</th><th>Statut</th><th class="nombre">Montant</th></tr></thead>
    <tbody>
    @foreach ($reservations as $r)
        <tr>
            <td>#{{ $r['id'] }}</td>
            <td>{{ $r['hebergement'] }}</td>
            <td>{{ $date($r['date_debut']) }} → {{ $date($r['date_fin']) }}</td>
            <td>{{ $statutsResa[$r['statut']] ?? $r['statut'] }}</td>
            <td class="nombre">{{ $fcfa($r['montant']) }}</td>
        </tr>
    @endforeach
    </tbody>
</table>
@endif

@if (count($journal))
<h2>Décisions de l’administration</h2>
<table class="liste">
    <thead><tr><th>Quand</th><th>Action</th><th>Sur</th><th>Par</th></tr></thead>
    <tbody>
    @foreach ($journal as $j)
        <tr>
            <td>{{ $date($j->created_at) }}</td>
            <td>{{ $j->action }}</td>
            <td>{{ $j->cible_libelle }}</td>
            <td>{{ $j->auteur_nom }}</td>
        </tr>
    @endforeach
    </tbody>
</table>
@endif

</body>
</html>
