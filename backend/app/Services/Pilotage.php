<?php

namespace App\Services;

use App\Models\Avis;
use App\Models\Commande;
use App\Models\DemandeParticuliere;
use App\Models\DemandeService;
use App\Models\Devis;
use App\Models\DevisRefuse;
use App\Models\Paiement;
use App\Models\Reservation;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Le tableau de pilotage : ce que nous faisons, ce que nous réalisons, ce qui
 * nous manque, et ce qu'il faudrait décider.
 *
 * « Ce qui attend » répond à « ai-je du travail ce matin ? ». Ici, la question
 * est « est-ce que ça marche, et où agir ? » : sur une période choisie, comparée
 * à la période d'égale durée qui la précède.
 *
 * Les lignes sont lues puis comptées en PHP. Les fonctions de date ne s'écrivent
 * pas pareil en SQLite (les tests) et en PostgreSQL (la production), et le volume
 * — quelques milliers de lignes au plus — ne justifie pas d'en maintenir deux.
 *
 * Une limite assumée : **on ne sait rien des visites**. La politique de
 * confidentialité promet qu'aucune mesure commerciale de navigation n'est faite,
 * et aucun chiffre ici n'en dépend. Une réservation refusée en ligne ne laisse pas
 * de trace non plus ; seuls les devis refusés sont comptés (`DevisRefuse`).
 */
final class Pilotage
{
    /** Les essais faits en production, qui ne doivent fausser aucun chiffre. */
    public const MARQUE_TEST = 'TEST PasseTemps';

    /** Au-delà, une demande sans réponse est un manquement. */
    private const ATTENTE_HEURES = 24;

    private const CRENEAUX = ['0–4 h', '4–8 h', '8–12 h', '12–16 h', '16–20 h', '20–24 h'];

    private const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

    /** @return array<string, mixed> */
    public static function pour(Carbon $du, Carbon $au): array
    {
        $du = $du->copy()->startOfDay();
        $au = $au->copy()->endOfDay();
        $jours = (int) round($du->diffInDays($au->copy()->startOfDay()), 0) + 1;
        $avantDu = $du->copy()->subDays($jours);
        $avantAu = $du->copy()->subSecond();

        $d = self::donnees();
        $mesures = self::mesures($d, $du, $au);
        $avant = self::mesures($d, $avantDu, $avantAu);
        $hebergements = self::hebergements($d, $du, $au);
        $villes = self::villes($hebergements);

        return [
            'periode' => [
                'du'        => $du->toDateString(),
                'au'        => $au->toDateString(),
                'jours'     => $jours,
                'avant_du'  => $avantDu->toDateString(),
                'avant_au'  => $avantAu->toDateString(),
            ],
            'genere_le'    => now()->toIso8601String(),
            'indicateurs'  => self::indicateurs($mesures, $avant, $d),
            'series'       => self::series($d, $du, $au, $jours),
            'entonnoir'    => self::entonnoir($mesures),
            'repartitions' => self::repartitions($d, $du, $au),
            'moments'      => self::moments($d, $du, $au),
            'hebergements' => $hebergements,
            'villes'       => $villes,
            'manquements'  => self::manquements($d, $mesures, $hebergements, $villes, $jours),
            'atouts'       => self::atouts($mesures, $avant, $hebergements, $villes),
        ];
    }

    /* ── Les lignes ────────────────────────────────────────────── */

    /** @return array<string, Collection> */
    private static function donnees(): array
    {
        $estTest = fn (?string $nom) => Str::contains((string) $nom, self::MARQUE_TEST);

        return [
            'devis' => Devis::get(['id', 'numero', 'origine', 'statut', 'total', 'suivi_le', 'created_at', 'valable_jusqu_au', 'villa_id', 'langue', 'client_nom'])
                ->reject(fn ($x) => $estTest($x->client_nom))->values(),
            'particulieres' => DemandeParticuliere::get(['id', 'type', 'statut', 'traitee_le', 'created_at', 'villa_id', 'langue', 'nom'])
                ->reject(fn ($x) => $estTest($x->nom))->values(),
            'services' => DemandeService::get(['id', 'prestation', 'statut', 'traitee_le', 'created_at', 'langue', 'nom'])
                ->reject(fn ($x) => $estTest($x->nom))->values(),
            'reservations' => Reservation::with('logement:id,villa_id')
                ->get(['id', 'logement_id', 'statut', 'montant_total', 'created_at', 'date_debut', 'date_fin']),
            'paiements' => Paiement::with('reservation:id,logement_id', 'reservation.logement:id,villa_id')
                ->get(['id', 'reservation_id', 'statut', 'montant', 'commission', 'methode', 'paye_le', 'created_at']),
            'commandes' => Commande::get(['id', 'statut', 'statut_paiement', 'montant_total', 'created_at']),
            'refus' => DevisRefuse::get(['id', 'villa_id', 'motif', 'created_at']),
            'comptes' => User::get(['id', 'role', 'created_at']),
            'villas' => Villa::with([
                'proprietaire:id,name',
                'logements:id,villa_id,capacite',
                'logements.tarifs:id,logement_id,prix',
            ])->withCount('photos', 'avis')->withAvg('avis', 'note')
                ->get(['id', 'nom', 'ville', 'quartier', 'statut', 'user_id', 'description', 'latitude', 'longitude', 'position_approximative', 'created_at']),
        ];
    }

    private static function entre(Collection $lignes, string $champ, Carbon $a, Carbon $b): Collection
    {
        return $lignes->filter(function ($x) use ($champ, $a, $b) {
            $date = $x->{$champ};

            return $date && Carbon::parse($date)->betweenIncluded($a, $b);
        })->values();
    }

    /* ── Les mesures d'une période ─────────────────────────────── */

    /**
     * @param  array<string, Collection>  $d
     * @return array<string, int|float|null>
     */
    private static function mesures(array $d, Carbon $a, Carbon $b): array
    {
        $devis = self::entre($d['devis'], 'created_at', $a, $b);
        $enLigne = $devis->where('origine', 'site');
        $particulieres = self::entre($d['particulieres'], 'created_at', $a, $b);
        $services = self::entre($d['services'], 'created_at', $a, $b);
        $reservations = self::entre($d['reservations'], 'created_at', $a, $b);
        $encaisse = self::entre($d['paiements']->where('statut', 'reussi'), 'paye_le', $a, $b);
        $essais = self::entre($d['paiements'], 'created_at', $a, $b);
        $commandes = self::entre($d['commandes'], 'created_at', $a, $b)->where('statut', '!=', 'annulee');
        $comptes = self::entre($d['comptes'], 'created_at', $a, $b);

        // Une demande a reçu sa réponse quand l'équipe l'a suivie ou traitée.
        $delais = collect();
        $repondues = 0;
        foreach ([[$enLigne, 'suivi_le'], [$particulieres, 'traitee_le'], [$services, 'traitee_le']] as [$lignes, $champ]) {
            foreach ($lignes as $x) {
                if ($x->{$champ}) {
                    $repondues++;
                    $delais->push(max(0, Carbon::parse($x->created_at)->diffInMinutes(Carbon::parse($x->{$champ})) / 60));
                }
            }
        }
        $aRepondre = $enLigne->count() + $particulieres->count() + $services->count();
        $confirmees = $reservations->where('statut', 'confirmee');
        $payees = $d['paiements']->where('statut', 'reussi')->pluck('reservation_id')->flip();
        $decides = $devis->whereIn('statut', ['accepte', 'refuse'])->count();

        return [
            'demandes'             => $aRepondre + $reservations->count(),
            'demandes_a_repondre'  => $aRepondre,
            'devis_en_ligne'       => $enLigne->count(),
            'particulieres'        => $particulieres->count(),
            'services'             => $services->count(),
            'devis'                => $devis->count(),
            'devis_montant'        => (int) $devis->sum('total'),
            'devis_acceptes'       => $devis->where('statut', 'accepte')->count(),
            'devis_acceptes_montant' => (int) $devis->where('statut', 'accepte')->sum('total'),
            'devis_decides'        => $decides,
            'taux_acceptation'     => $decides ? $devis->where('statut', 'accepte')->count() / $decides : null,
            'reservations'         => $reservations->count(),
            'reservations_confirmees' => $confirmees->count(),
            'volume_confirme'      => (int) $confirmees->sum('montant_total'),
            'taux_annulation'      => $reservations->count() ? $reservations->where('statut', 'annulee')->count() / $reservations->count() : null,
            'encaisse'             => (int) $encaisse->sum('montant'),
            'commission'           => (int) $encaisse->sum('commission'),
            'paiements_tentes'     => $essais->count(),
            'paiements_echoues'    => $essais->where('statut', 'echoue')->count(),
            'boutique'             => (int) $commandes->sum('montant_total'),
            'commandes'            => $commandes->count(),
            'nouveaux_clients'     => $comptes->where('role', 'client')->count(),
            'nouveaux_proprietaires' => $comptes->where('role', 'proprietaire')->count(),
            'annonces_ajoutees'    => self::entre($d['villas'], 'created_at', $a, $b)->count(),
            'delai_median'         => $delais->isEmpty() ? null : round((float) $delais->median(), 1),
            'repondues'            => $repondues,
            'taux_reponse'         => $aRepondre ? $repondues / $aRepondre : null,
            'accords'              => $enLigne->where('statut', 'accepte')->count() + $confirmees->count(),
            'payees'               => $reservations->filter(fn ($r) => isset($payees[$r->id]))->count(),
            'avis_nouveaux'        => Avis::whereBetween('created_at', [$a, $b])->count(),
            'devis_refuses'        => self::entre($d['refus'], 'created_at', $a, $b)->count(),
        ];
    }

    /**
     * Les chiffres de tête, rangés par la question à laquelle ils répondent.
     * `sens` dit si une hausse est une bonne nouvelle, et donc la couleur de l'écart.
     *
     * @param  array<string, int|float|null>  $m
     * @param  array<string, int|float|null>  $p
     * @param  array<string, Collection>  $d
     * @return list<array<string, mixed>>
     */
    private static function indicateurs(array $m, array $p, array $d): array
    {
        $ligne = fn (string $groupe, string $cle, string $libelle, string $format, string $sens, ?string $aide = null) => [
            'groupe' => $groupe, 'cle' => $cle, 'libelle' => $libelle, 'format' => $format, 'sens' => $sens,
            'valeur' => $m[$cle] ?? null, 'precedent' => $p[$cle] ?? null, 'aide' => $aide,
        ];

        // L'état d'aujourd'hui, sans comparaison : il ne dépend pas de la période.
        $villas = $d['villas'];
        $ouverts = $d['devis']->where('statut', 'emis')
            ->filter(fn ($x) => ! $x->valable_jusqu_au || Carbon::parse($x->valable_jusqu_au)->endOfDay()->isFuture());
        $etat = fn (string $cle, string $libelle, string $format, $valeur, ?string $aide = null) => [
            'groupe' => 'aujourdhui', 'cle' => $cle, 'libelle' => $libelle, 'format' => $format, 'sens' => 'neutre',
            'valeur' => $valeur, 'precedent' => null, 'aide' => $aide,
        ];

        return [
            $ligne('activite', 'demandes', 'Demandes reçues', 'nombre', 'haut', 'Devis en ligne, demandes particulières, demandes de service et réservations.'),
            $ligne('activite', 'devis', 'Devis établis', 'nombre', 'haut', 'En ligne et par l’équipe.'),
            $ligne('activite', 'devis_montant', 'Montant des devis', 'fcfa', 'haut', 'Ce qui a été proposé, pas ce qui est encaissé.'),
            $ligne('activite', 'nouveaux_clients', 'Nouveaux comptes clients', 'nombre', 'haut'),

            $ligne('resultat', 'accords', 'Accords obtenus', 'nombre', 'haut', 'Devis en ligne acceptés et réservations confirmées.'),
            $ligne('resultat', 'volume_confirme', 'Réservations confirmées', 'fcfa', 'haut'),
            $ligne('resultat', 'encaisse', 'Encaissé', 'fcfa', 'haut', 'Paiements réussis sur la période.'),
            $ligne('resultat', 'commission', 'Commission', 'fcfa', 'haut', 'Ce qui nous revient sur ces paiements.'),
            $ligne('resultat', 'boutique', 'Boutique', 'fcfa', 'haut', 'Commandes non annulées.'),

            $ligne('qualite', 'taux_reponse', 'Demandes suivies', 'pourcent', 'haut', 'Part des demandes marquées suivies ou traitées dans la console.'),
            $ligne('qualite', 'delai_median', 'Délai de réponse médian', 'heures', 'bas', 'De la demande au geste « suivi » ou « traitée ». La moitié des réponses sont plus rapides.'),
            $ligne('qualite', 'taux_acceptation', 'Devis acceptés', 'pourcent', 'haut', 'Parmi les devis marqués acceptés ou refusés.'),
            $ligne('qualite', 'taux_annulation', 'Réservations annulées', 'pourcent', 'bas'),
            $ligne('qualite', 'devis_refuses', 'Devis refusés par le site', 'nombre', 'bas', 'Dates prises, séjour trop court, trop de monde : des demandes que nous n’avons pas pu servir.'),

            $etat('annonces', 'Annonces en ligne', 'nombre', $villas->where('statut', 'validee')->count()),
            $etat('logements', 'Logements en ligne', 'nombre', $villas->where('statut', 'validee')->sum(fn ($v) => $v->logements->count())),
            $etat('proprietaires', 'Propriétaires', 'nombre', $d['comptes']->where('role', 'proprietaire')->count()),
            $etat('clients', 'Comptes clients', 'nombre', $d['comptes']->where('role', 'client')->count()),
            $etat('devis_ouverts', 'Devis en cours de validité', 'fcfa', (int) $ouverts->sum('total'), "{$ouverts->count()} devis sans réponse du client."),
            $etat('du_proprietaires', 'Dû aux propriétaires', 'fcfa', (int) Paiement::query()->exigible()->sum('montant_proprietaire'), 'Séjours terminés, pas encore reversés.'),
        ];
    }

    /* ── Dans le temps ─────────────────────────────────────────── */

    /**
     * Toutes les périodes sont présentes, même vides : une série trouée se
     * dessinerait comme une droite entre deux points, et inventerait une activité.
     *
     * @param  array<string, Collection>  $d
     * @return array<string, mixed>
     */
    private static function series(array $d, Carbon $du, Carbon $au, int $jours): array
    {
        $pas = $jours <= 31 ? 'jour' : ($jours <= 186 ? 'semaine' : 'mois');

        $debutDe = fn (Carbon $date) => match ($pas) {
            'jour'    => $date->copy()->startOfDay(),
            'semaine' => $date->copy()->startOfWeek(Carbon::MONDAY),
            default   => $date->copy()->startOfMonth(),
        };

        $lignes = [];
        for ($c = $debutDe($du); $c->lte($au); $c = match ($pas) {
            'jour' => $c->copy()->addDay(), 'semaine' => $c->copy()->addWeek(), default => $c->copy()->addMonth(),
        }) {
            $lignes[$c->toDateString()] = [
                'date'    => $c->toDateString(),
                'libelle' => match ($pas) {
                    'jour'    => $c->format('d/m'),
                    'semaine' => $c->format('d/m'),
                    default   => Str::ucfirst($c->copy()->locale('fr')->isoFormat('MMM YY')),
                },
                'devis' => 0, 'particulieres' => 0, 'services' => 0, 'reservations' => 0,
                'devis_montant' => 0, 'encaisse' => 0, 'comptes' => 0, 'refus' => 0,
            ];
        }

        $compter = function (Collection $rangees, string $champ, callable $ajout) use (&$lignes, $du, $au, $debutDe) {
            foreach (self::entre($rangees, $champ, $du, $au) as $x) {
                $cle = $debutDe(Carbon::parse($x->{$champ}))->toDateString();
                if (isset($lignes[$cle])) {
                    $ajout($lignes[$cle], $x);
                }
            }
        };

        $compter($d['devis']->where('origine', 'site'), 'created_at', function (&$l) { $l['devis']++; });
        $compter($d['devis'], 'created_at', function (&$l, $x) { $l['devis_montant'] += (int) $x->total; });
        $compter($d['particulieres'], 'created_at', function (&$l) { $l['particulieres']++; });
        $compter($d['services'], 'created_at', function (&$l) { $l['services']++; });
        $compter($d['reservations'], 'created_at', function (&$l) { $l['reservations']++; });
        $compter($d['paiements']->where('statut', 'reussi'), 'paye_le', function (&$l, $x) { $l['encaisse'] += (int) $x->montant; });
        $compter($d['comptes'], 'created_at', function (&$l) { $l['comptes']++; });
        $compter($d['refus'], 'created_at', function (&$l) { $l['refus']++; });

        return ['pas' => $pas, 'lignes' => array_values($lignes)];
    }

    /**
     * @param  array<string, int|float|null>  $m
     * @return list<array{cle: string, libelle: string, valeur: int}>
     */
    private static function entonnoir(array $m): array
    {
        return [
            ['cle' => 'demandes', 'libelle' => 'Demandes reçues', 'valeur' => (int) $m['demandes']],
            ['cle' => 'repondues', 'libelle' => 'Suivies par l’équipe', 'valeur' => (int) $m['repondues'] + (int) $m['reservations_confirmees']],
            ['cle' => 'accords', 'libelle' => 'Accords obtenus', 'valeur' => (int) $m['accords']],
            ['cle' => 'payees', 'libelle' => 'Réservations payées', 'valeur' => (int) $m['payees']],
        ];
    }

    /**
     * @param  array<string, Collection>  $d
     * @return array<string, list<array{nom: string, valeur: int}>>
     */
    private static function repartitions(array $d, Carbon $du, Carbon $au): array
    {
        $devis = self::entre($d['devis'], 'created_at', $du, $au);
        $particulieres = self::entre($d['particulieres'], 'created_at', $du, $au);
        $services = self::entre($d['services'], 'created_at', $du, $au);

        $classer = fn (Collection $noms) => $noms->countBy()->sortDesc()
            ->map(fn ($n, $nom) => ['nom' => (string) $nom, 'valeur' => (int) $n])->values()->all();

        $enLigne = $devis->where('origine', 'site');

        return [
            'prestations' => $classer($services->map(fn ($x) => $x->libelle_prestation)),
            'types'       => $classer($particulieres->map(fn ($x) => $x->libelle_type)),
            'statuts_devis' => $classer($devis->map(fn ($x) => Devis::STATUTS[$x->statut] ?? $x->statut)),
            'refus'       => $classer(self::entre($d['refus'], 'created_at', $du, $au)->map(fn ($x) => DevisRefuse::MOTIFS[$x->motif] ?? $x->motif)),
            'origines_devis' => $classer($devis->map(fn ($x) => $x->origine === 'site' ? 'En ligne' : 'Par l’équipe')),
            'langues'     => $classer(collect()
                ->concat($enLigne->pluck('langue'))
                ->concat($particulieres->pluck('langue'))
                ->concat($services->pluck('langue'))
                ->map(fn ($l) => $l === 'en' ? 'Anglais' : 'Français')),
        ];
    }

    /**
     * À quels moments les demandes arrivent : ce qui dit quand tenir le téléphone.
     *
     * @param  array<string, Collection>  $d
     * @return array<string, mixed>
     */
    private static function moments(array $d, Carbon $du, Carbon $au): array
    {
        $grille = array_fill(0, 7, array_fill(0, count(self::CRENEAUX), 0));
        $lignes = collect()
            ->concat(self::entre($d['devis']->where('origine', 'site'), 'created_at', $du, $au))
            ->concat(self::entre($d['particulieres'], 'created_at', $du, $au))
            ->concat(self::entre($d['services'], 'created_at', $du, $au))
            ->concat(self::entre($d['reservations'], 'created_at', $du, $au));

        foreach ($lignes as $x) {
            $date = Carbon::parse($x->created_at);
            $grille[$date->dayOfWeekIso - 1][min(5, intdiv($date->hour, 4))]++;
        }

        return ['jours' => self::JOURS, 'creneaux' => self::CRENEAUX, 'grille' => $grille];
    }

    /* ── Les annonces et les villes ────────────────────────────── */

    /**
     * @param  array<string, Collection>  $d
     * @return list<array<string, mixed>>
     */
    private static function hebergements(array $d, Carbon $du, Carbon $au): array
    {
        $devis = self::entre($d['devis'], 'created_at', $du, $au)->groupBy('villa_id');
        $particulieres = self::entre($d['particulieres'], 'created_at', $du, $au)->groupBy('villa_id');
        $reservations = self::entre($d['reservations'], 'created_at', $du, $au)
            ->groupBy(fn ($r) => $r->logement?->villa_id);
        $encaisse = self::entre($d['paiements']->where('statut', 'reussi'), 'paye_le', $du, $au)
            ->groupBy(fn ($p) => $p->reservation?->logement?->villa_id);
        $refus = self::entre($d['refus'], 'created_at', $du, $au)->countBy('villa_id');

        $lignes = [];
        foreach ($d['villas'] as $v) {
            $sesDevis = $devis[$v->id] ?? collect();
            $sesDemandes = $particulieres[$v->id] ?? collect();
            $sesResas = $reservations[$v->id] ?? collect();

            $demandes = $sesDevis->where('origine', 'site')->count() + $sesDemandes->count() + $sesResas->count();
            $sesRefus = (int) ($refus[$v->id] ?? 0);
            if ($v->statut !== 'validee' && $demandes === 0 && $sesRefus === 0) {
                continue;
            }

            $prix = $v->logements->flatMap(fn ($l) => $l->tarifs)->pluck('prix')->filter();
            $derniere = collect()->concat($sesDevis)->concat($sesDemandes)->concat($sesResas)
                ->pluck('created_at')->filter()->max();

            $lignes[] = [
                'id'           => $v->id,
                'nom'          => $v->nom,
                'ville'        => $v->ville,
                'quartier'     => $v->quartier,
                'proprietaire' => $v->proprietaire?->name,
                'statut'       => $v->statut,
                'demandes'     => $demandes,
                'refus'        => $sesRefus,
                'devis'        => $sesDevis->count(),
                'particulieres' => $sesDemandes->count(),
                'reservations' => $sesResas->count(),
                'confirmees'   => $sesResas->where('statut', 'confirmee')->count(),
                'montant_devis' => (int) $sesDevis->sum('total'),
                'encaisse'     => (int) ($encaisse[$v->id] ?? collect())->sum('montant'),
                'note'         => $v->avis_avg_note ? round((float) $v->avis_avg_note, 1) : null,
                'avis'         => (int) $v->avis_count,
                'photos'       => (int) $v->photos_count,
                'prix_min'     => $prix->isEmpty() ? null : (int) $prix->min(),
                'derniere_demande' => $derniere ? Carbon::parse($derniere)->toDateString() : null,
                'defauts'      => self::defauts($v, $prix->isEmpty()),
            ];
        }

        usort($lignes, fn ($a, $b) => [$b['demandes'], $b['montant_devis'], $a['nom']] <=> [$a['demandes'], $a['montant_devis'], $b['nom']]);

        return $lignes;
    }

    /** @return list<string> */
    private static function defauts(Villa $v, bool $sansPrix): array
    {
        return array_values(array_filter([
            $sansPrix ? 'Sans prix' : null,
            (int) $v->photos_count < 3 ? 'Moins de 3 photos' : null,
            mb_strlen((string) $v->description) < 120 ? 'Description courte' : null,
            ! $v->latitude || ! $v->longitude ? 'Sans position' : ($v->position_approximative ? 'Position approchée' : null),
        ]));
    }

    /**
     * @param  list<array<string, mixed>>  $hebergements
     * @return list<array<string, mixed>>
     */
    private static function villes(array $hebergements): array
    {
        $parVille = [];
        foreach ($hebergements as $h) {
            $nom = trim((string) $h['ville']) ?: 'Non précisée';
            $parVille[$nom] ??= ['ville' => $nom, 'annonces' => 0, 'demandes' => 0, 'refus' => 0, 'montant_devis' => 0, 'reservations' => 0, 'encaisse' => 0];
            $parVille[$nom]['annonces'] += $h['statut'] === 'validee' ? 1 : 0;
            $parVille[$nom]['demandes'] += $h['demandes'];
            $parVille[$nom]['refus'] += $h['refus'];
            $parVille[$nom]['montant_devis'] += $h['montant_devis'];
            $parVille[$nom]['reservations'] += $h['reservations'];
            $parVille[$nom]['encaisse'] += $h['encaisse'];
        }

        $lignes = array_values($parVille);
        foreach ($lignes as &$l) {
            $l['demandes_par_annonce'] = $l['annonces'] ? round($l['demandes'] / $l['annonces'], 1) : null;
        }
        unset($l);

        usort($lignes, fn ($a, $b) => [$b['demandes'], $b['annonces'], $a['ville']] <=> [$a['demandes'], $a['annonces'], $b['ville']]);

        return $lignes;
    }

    /* ── Ce qui manque, et ce qui marche ───────────────────────── */

    /**
     * Des règles écrites à la main, chacune avec ce qu'on propose de faire. Pas de
     * ligne à zéro : un manquement qui n'existe pas n'a pas à se lire.
     *
     * @param  array<string, Collection>  $d
     * @param  array<string, int|float|null>  $m
     * @param  list<array<string, mixed>>  $hebergements
     * @param  list<array<string, mixed>>  $villes
     * @return list<array<string, mixed>>
     */
    private static function manquements(array $d, array $m, array $hebergements, array $villes, int $jours): array
    {
        $liste = [];
        $ajouter = function (string $gravite, string $titre, string $detail, string $conseil, ?string $lien = null) use (&$liste) {
            $liste[] = compact('gravite', 'titre', 'detail', 'conseil', 'lien');
        };

        $limite = now()->subHours(self::ATTENTE_HEURES);

        if (ReservationsSuspendues::enVigueur()) {
            $ajouter('haute', 'La réservation en ligne est fermée',
                'Chaque client passe par un devis puis par WhatsApp : rien ne s’encaisse sans une main humaine.',
                'Terminer la vérification d’identité auprès du prestataire de paiement est ce qui débloque le plus de chiffre d’affaires.',
                '/admin/paiement');
        }

        $devisSansSuite = $d['devis']->where('origine', 'site')->whereNull('suivi_le')
            ->filter(fn ($x) => Carbon::parse($x->created_at)->lt($limite));
        if ($devisSansSuite->isNotEmpty()) {
            $ajouter('haute', self::pluriel($devisSansSuite->count(), 'devis en ligne sans suite depuis plus de 24 h', 'devis en ligne sans suite depuis plus de 24 h'),
                'Montant en jeu : '.self::fcfa((int) $devisSansSuite->sum('total')).'. Le client a laissé son numéro et attend.',
                'Rappeler aujourd’hui, puis cliquer « Suivi » : c’est ce qui fait baisser le délai ci-dessus.',
                '/admin/devis');
        }

        $particulieres = $d['particulieres']->where('statut', 'nouvelle')->filter(fn ($x) => Carbon::parse($x->created_at)->lt($limite));
        if ($particulieres->isNotEmpty()) {
            $ajouter('haute', self::pluriel($particulieres->count(), 'demande particulière sans réponse depuis plus de 24 h', 'demandes particulières sans réponse depuis plus de 24 h'),
                'Un événement ou un groupe se décide vite, et vaut souvent plusieurs nuits.',
                'Répondre sur WhatsApp, ou établir un devis depuis la demande.',
                '/admin/demandes-particulieres');
        }

        $services = $d['services']->where('statut', 'nouvelle')->filter(fn ($x) => Carbon::parse($x->created_at)->lt($limite));
        if ($services->isNotEmpty()) {
            $ajouter('haute', self::pluriel($services->count(), 'demande de service sans réponse depuis plus de 24 h', 'demandes de service sans réponse depuis plus de 24 h'),
                'Le site promet une réponse sous deux heures.',
                'Répondre, puis marquer traitée. Si le délai ne peut pas être tenu, changer la promesse affichée.',
                '/admin/demandes');
        }

        if ($m['delai_median'] !== null && $m['delai_median'] > self::ATTENTE_HEURES) {
            $ajouter('moyenne', 'Le délai de réponse médian dépasse 24 h',
                "La moitié des demandes attendent plus de {$m['delai_median']} h, alors que le client compare plusieurs annonces en même temps.",
                'Désigner une personne de permanence, et activer les notifications de la console sur son téléphone.',
                '/admin/notifications');
        }

        $expires = $d['devis']->where('statut', 'emis')
            ->filter(fn ($x) => $x->valable_jusqu_au && Carbon::parse($x->valable_jusqu_au)->endOfDay()->isPast());
        if ($expires->isNotEmpty()) {
            $ajouter('moyenne', self::pluriel($expires->count(), 'devis expiré sans réponse notée', 'devis expirés sans réponse notée'),
                'Montant : '.self::fcfa((int) $expires->sum('total')).'. Tant qu’ils restent « émis », le taux d’acceptation ne veut rien dire.',
                'Relancer une dernière fois, puis les marquer acceptés ou refusés.',
                '/admin/devis');
        }

        if ($m['devis'] >= 5 && $m['devis_decides'] === 0) {
            $ajouter('basse', 'Aucun devis n’a été marqué accepté ou refusé',
                'On ne sait donc pas combien de devis se transforment en séjours.',
                'Prendre l’habitude de changer le statut à la fin de chaque échange.',
                '/admin/devis');
        } elseif ($m['devis_decides'] >= 5 && $m['taux_acceptation'] < 0.2) {
            $ajouter('moyenne', 'Moins d’un devis sur cinq est accepté',
                'Sur '.$m['devis_decides'].' devis décidés.',
                'Demander aux clients pourquoi : prix, dates, ou absence de paiement en ligne.',
                '/admin/devis');
        }

        if ($m['paiements_tentes'] >= 5 && $m['paiements_echoues'] / $m['paiements_tentes'] > 0.3) {
            $ajouter('moyenne', 'Plus de 30 % des paiements échouent',
                "{$m['paiements_echoues']} échecs sur {$m['paiements_tentes']} tentatives.",
                'Lancer la sonde d’encaissement, et vérifier le moyen de paiement concerné.',
                '/admin/paiement');
        }

        if ($m['devis_refuses'] >= 3) {
            $parMotif = collect($hebergements)->sortByDesc('refus')->firstWhere('refus', '>', 0);
            $ajouter('moyenne', "{$m['devis_refuses']} devis refusés par le site sur la période",
                ($parMotif ? "Surtout sur {$parMotif['nom']}. " : '').'Ces clients voulaient séjourner chez nous et sont repartis sans rien.',
                'Dates prises : prospecter sur ces périodes. Séjour trop court : revoir la durée minimale avec le propriétaire.',
                null);
        }

        $enLigne = collect($hebergements)->where('statut', 'validee');

        $sansPrix = $enLigne->filter(fn ($h) => in_array('Sans prix', $h['defauts'], true));
        if ($sansPrix->isNotEmpty()) {
            $ajouter('haute', self::pluriel($sansPrix->count(), 'annonce en ligne sans aucun prix', 'annonces en ligne sans aucun prix'),
                'Aucun devis ne peut en sortir : '.self::quelques($sansPrix).'.',
                'Compléter les tarifs avec le propriétaire, ou retirer l’annonce.',
                '/admin/villas');
        }

        if ($jours >= 14 && $enLigne->isNotEmpty()) {
            $sansDemande = $enLigne->where('demandes', 0);
            if ($sansDemande->count() > 0) {
                $ajouter($sansDemande->count() > $enLigne->count() / 2 ? 'moyenne' : 'basse',
                    "{$sansDemande->count()} annonce".($sansDemande->count() > 1 ? 's' : '')." sur {$enLigne->count()} sans aucune demande sur la période",
                    'Par exemple : '.self::quelques($sansDemande).'.',
                    'Revoir leurs photos et leur prix, les mettre en avant, ou en parler à leur propriétaire.',
                    '/admin/villas');
            }
        }

        $peuDePhotos = $enLigne->filter(fn ($h) => in_array('Moins de 3 photos', $h['defauts'], true));
        if ($peuDePhotos->isNotEmpty()) {
            $ajouter('moyenne', self::pluriel($peuDePhotos->count(), 'annonce avec moins de 3 photos', 'annonces avec moins de 3 photos'),
                self::quelques($peuDePhotos).'.',
                'Une annonce sans photos ne se réserve pas : demander des photos au propriétaire.',
                '/admin/villas');
        }

        $sansPosition = $enLigne->filter(fn ($h) => array_intersect(['Sans position', 'Position approchée'], $h['defauts']) !== []);
        if ($sansPosition->isNotEmpty()) {
            $ajouter('basse', self::pluriel($sansPosition->count(), 'annonce sans position exacte sur la carte', 'annonces sans position exacte sur la carte'),
                self::quelques($sansPosition).'.',
                'Demander la position exacte au propriétaire : elle améliore la recherche par carte et Google.',
                '/admin/villas');
        }

        $courtes = $enLigne->filter(fn ($h) => in_array('Description courte', $h['defauts'], true));
        if ($courtes->isNotEmpty()) {
            $ajouter('basse', self::pluriel($courtes->count(), 'annonce avec une description trop courte', 'annonces avec une description trop courte'),
                self::quelques($courtes).'.',
                'Moins de 120 signes : le client n’en sait pas assez, et Google non plus.',
                '/admin/villas');
        }

        $maisons = collect($villes)->filter(fn ($v) => $v['demandes'] >= 3 && $v['annonces'] <= 1);
        foreach ($maisons->take(3) as $v) {
            $ajouter('moyenne', "{$v['ville']} : {$v['demandes']} demandes pour {$v['annonces']} annonce".($v['annonces'] > 1 ? 's' : ''),
                'La demande dépasse l’offre dans cette ville.',
                'Prospecter de nouveaux propriétaires ici en priorité.',
                '/admin/villas');
        }

        $mauvaises = $enLigne->filter(fn ($h) => $h['note'] !== null && $h['note'] < 3.5 && $h['avis'] >= 2);
        if ($mauvaises->isNotEmpty()) {
            $ajouter('moyenne', self::pluriel($mauvaises->count(), 'annonce mal notée', 'annonces mal notées'),
                self::quelques($mauvaises).'.',
                'Lire les avis et en parler au propriétaire avant que la note ne fasse fuir d’autres clients.',
                '/admin/avis');
        }

        $attente = $d['villas']->where('statut', 'en_attente')
            ->filter(fn ($v) => Carbon::parse($v->created_at)->lt(now()->subDays(3)));
        if ($attente->isNotEmpty()) {
            $ajouter('moyenne', self::pluriel($attente->count(), 'annonce à valider depuis plus de 3 jours', 'annonces à valider depuis plus de 3 jours'),
                'Un propriétaire qui attend finit par publier ailleurs.',
                'Valider, ou dire ce qui manque.',
                '/admin/villas');
        }

        $proprietaires = $d['comptes']->where('role', 'proprietaire')->pluck('id');
        $avecAnnonce = $d['villas']->pluck('user_id')->flip();
        $sansAnnonce = $proprietaires->reject(fn ($id) => isset($avecAnnonce[$id]))->count();
        if ($sansAnnonce > 0) {
            $ajouter('basse', self::pluriel($sansAnnonce, 'propriétaire inscrit sans annonce', 'propriétaires inscrits sans annonce'),
                'Ils ont fait la moitié du chemin.',
                'Les appeler : c’est le moyen le moins cher d’ajouter des annonces.',
                '/admin/utilisateurs');
        }

        $rang = ['haute' => 0, 'moyenne' => 1, 'basse' => 2];
        usort($liste, fn ($a, $b) => $rang[$a['gravite']] <=> $rang[$b['gravite']]);

        return $liste;
    }

    /**
     * @param  array<string, int|float|null>  $m
     * @param  array<string, int|float|null>  $p
     * @param  list<array<string, mixed>>  $hebergements
     * @param  list<array<string, mixed>>  $villes
     * @return list<string>
     */
    private static function atouts(array $m, array $p, array $hebergements, array $villes): array
    {
        $liste = [];

        if ($p['demandes'] > 0 && $m['demandes'] > $p['demandes']) {
            $hausse = (int) round(($m['demandes'] - $p['demandes']) / $p['demandes'] * 100);
            $liste[] = "Les demandes progressent de {$hausse} % par rapport à la période précédente.";
        }

        $premier = $hebergements[0] ?? null;
        if ($premier && $premier['demandes'] > 0 && $m['demandes'] > 0) {
            $part = (int) round($premier['demandes'] / $m['demandes'] * 100);
            $liste[] = "{$premier['nom']} est l’annonce la plus demandée : {$premier['demandes']} demande".($premier['demandes'] > 1 ? 's' : '')." ({$part} % du total).";
        }

        $ville = $villes[0] ?? null;
        if ($ville && $ville['demandes'] > 0) {
            $liste[] = "{$ville['ville']} est la ville la plus demandée, avec {$ville['annonces']} annonce".($ville['annonces'] > 1 ? 's' : '').' en ligne.';
        }

        if ($m['delai_median'] !== null && $m['delai_median'] <= self::ATTENTE_HEURES) {
            $liste[] = "La moitié des demandes reçoivent une réponse en moins de {$m['delai_median']} h.";
        }

        if ($m['encaisse'] > 0) {
            $liste[] = self::fcfa((int) $m['encaisse']).' encaissés sur la période.';
        }

        return $liste;
    }

    private static function pluriel(int $n, string $un, string $plusieurs): string
    {
        return $n.' '.($n > 1 ? $plusieurs : $un);
    }

    private static function fcfa(int $montant): string
    {
        return number_format($montant, 0, ',', "\u{00A0}")."\u{00A0}FCFA";
    }

    private static function quelques(Collection $hebergements): string
    {
        $noms = $hebergements->pluck('nom')->take(3)->implode(', ');
        $reste = $hebergements->count() - 3;

        return $noms.($reste > 0 ? " et {$reste} autre".($reste > 1 ? 's' : '') : '');
    }
}
