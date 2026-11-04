<?php

namespace App\Services;

use App\Models\Commande;
use App\Models\DemandeParticuliere;
use App\Models\DemandeService;
use App\Models\Devis;
use App\Models\Reservation;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Le fichier clients : une ligne par personne, quel que soit le chemin par
 * lequel elle nous a laissé ses coordonnées.
 *
 * Rien n'est stocké en plus : on lit les devis, les demandes, les comptes, les
 * réservations et les commandes, et on les regroupe. Une table « clients » à
 * tenir à jour finirait par contredire ces écrans ; la relecture coûte peu au
 * volume actuel (quelques centaines de lignes).
 *
 * Deux traces vont à la même personne si elles ont un numéro, une adresse ou un
 * compte en commun — de proche en proche : un devis et un compte partagent un
 * numéro, ce compte et une commande partagent l'identifiant, les trois se
 * retrouvent sur une ligne.
 *
 * Nos propres numéro et adresse ne relient personne : l'équipe les met parfois
 * sur un devis fait pour un client, et ils fondraient tout le fichier en une
 * seule ligne. Une trace sans aucune coordonnée se rattache à son nom, et
 * seulement aux autres traces sans coordonnée de ce nom.
 */
final class FichierClients
{
    /** Assez pour le dossier d'un client ; au-delà, on va à la console. */
    private const EVENEMENTS_MAX = 40;

    /**
     * @return list<array<string, mixed>> du contact le plus récent au plus ancien
     */
    public static function construire(): array
    {
        $traces = self::traces();
        $racines = self::regrouper($traces);

        $groupes = [];
        foreach ($traces as $i => $trace) {
            $groupes[$racines[$i]][] = $trace;
        }

        $clients = array_map(fn (array $g) => self::client($g), array_values($groupes));
        usort($clients, fn ($a, $b) => [$b['dernier_contact'], $b['cle']] <=> [$a['dernier_contact'], $a['cle']]);

        return $clients;
    }

    /**
     * @param  array<string, mixed>  $client
     */
    public static function correspond(array $client, string $recherche): bool
    {
        $terme = Str::lower(trim($recherche));
        if ($terme === '') {
            return true;
        }

        $textes = array_merge([$client['nom']], $client['noms'], $client['emails'], $client['hebergements']);
        foreach ($textes as $texte) {
            if (str_contains(Str::lower((string) $texte), $terme)) {
                return true;
            }
        }

        // Un numéro se cherche en partie : « +221 76 999 » n'a pas ses neuf chiffres,
        // `Telephone::local` n'y reconnaît donc pas l'indicatif. On le retire ici.
        $chiffres = Telephone::chiffres($terme);
        $national = str_starts_with($chiffres, '221') ? substr($chiffres, 3) : $chiffres;
        if (strlen($national) >= 4) {
            foreach ($client['telephones'] as $telephone) {
                if (str_contains(Telephone::local($telephone), $national)) {
                    return true;
                }
            }
        }

        return false;
    }

    /* ── Les traces ────────────────────────────────────────────── */

    /** @return list<array<string, mixed>> */
    private static function traces(): array
    {
        $traces = [];

        $comptes = User::where('role', 'client')->get(['id', 'name', 'email', 'phone', 'created_at']);
        $idsClients = $comptes->pluck('id')->flip();

        foreach ($comptes as $u) {
            $traces[] = self::trace('compte', $u->created_at, [
                'nom'       => $u->name,
                'telephone' => $u->phone,
                'email'     => $u->email,
                'user_id'   => $u->id,
                'compte'    => ['id' => $u->id, 'nom' => $u->name],
                'libelle'   => 'Compte créé',
                'lien'      => "/admin/utilisateurs/{$u->id}",
            ]);
        }

        foreach (Devis::with('villa:id,nom')->get() as $d) {
            $traces[] = self::trace('devis', $d->created_at, [
                'nom'         => $d->client_nom,
                'telephone'   => $d->client_telephone,
                'email'       => $d->client_email,
                'libelle'     => "{$d->numero} · {$d->titre}",
                'detail'      => $d->origine === 'site' ? 'Établi en ligne' : 'Établi par l’équipe',
                'montant'     => (int) $d->total,
                'statut'      => Devis::STATUTS[$d->statut] ?? $d->statut,
                'lien'        => "/admin/devis/{$d->id}",
                'hebergement' => $d->villa?->nom ?? $d->titre,
                'langue'      => $d->langue,
            ]);
        }

        foreach (DemandeParticuliere::with('villa:id,nom')->get() as $d) {
            $traces[] = self::trace('demande', $d->created_at, [
                'nom'         => $d->nom,
                'telephone'   => $d->telephone,
                'email'       => $d->email,
                'user_id'     => $d->user_id && isset($idsClients[$d->user_id]) ? $d->user_id : null,
                'libelle'     => "{$d->reference} · {$d->libelle_type}",
                'statut'      => DemandeParticuliere::STATUTS[$d->statut] ?? $d->statut,
                'lien'        => '/admin/demandes-particulieres',
                'hebergement' => $d->villa?->nom,
                'langue'      => $d->langue,
            ]);
        }

        foreach (DemandeService::get() as $d) {
            $traces[] = self::trace('service', $d->created_at, [
                'nom'       => $d->nom,
                'telephone' => $d->telephone,
                'email'     => $d->email,
                'user_id'   => $d->user_id && isset($idsClients[$d->user_id]) ? $d->user_id : null,
                'libelle'   => "{$d->reference} · {$d->libelle_prestation}",
                'statut'    => DemandeService::STATUTS[$d->statut] ?? $d->statut,
                'lien'      => '/admin/demandes',
                'langue'    => $d->langue,
            ]);
        }

        // Une réservation ne porte que le compte qui l'a faite : ses coordonnées
        // sont celles du compte, et seuls les comptes clients ont une ligne ici.
        $reservations = Reservation::with('logement:id,villa_id,nom', 'logement.villa:id,nom')
            ->whereIn('user_id', $comptes->pluck('id'))
            ->get(['id', 'user_id', 'logement_id', 'montant_total', 'statut', 'created_at']);
        foreach ($reservations as $r) {
            $villa = $r->logement?->villa?->nom;
            $traces[] = self::trace('reservation', $r->created_at, [
                'user_id'     => $r->user_id,
                'libelle'     => "Réservation #{$r->id}".($villa ? " · {$villa}" : ''),
                'montant'     => (int) $r->montant_total,
                'statut'      => $r->statut,
                'lien'        => '/admin/reservations',
                'hebergement' => $villa,
            ]);
        }

        foreach (Commande::get(['id', 'user_id', 'destinataire', 'telephone', 'oeuvre_titre', 'montant_total', 'statut', 'created_at']) as $c) {
            $traces[] = self::trace('commande', $c->created_at, [
                'nom'       => $c->destinataire,
                'telephone' => $c->telephone,
                'user_id'   => $c->user_id && isset($idsClients[$c->user_id]) ? $c->user_id : null,
                'libelle'   => "Commande #{$c->id} · {$c->oeuvre_titre}",
                'montant'   => (int) $c->montant_total,
                'statut'    => $c->statut,
                'lien'      => '/admin/commandes',
            ]);
        }

        return $traces;
    }

    /**
     * @param  array<string, mixed>  $champs
     * @return array<string, mixed>
     */
    private static function trace(string $type, mixed $date, array $champs): array
    {
        $telephone = trim((string) ($champs['telephone'] ?? ''));
        $email = Str::lower(trim((string) ($champs['email'] ?? '')));
        $nom = trim((string) ($champs['nom'] ?? ''));

        $cles = [];
        $local = Telephone::local($telephone);
        if (strlen($local) >= 8 && $local !== Telephone::local((string) config('reservations.contact.telephone'))) {
            $cles[] = "t:{$local}";
        }
        if ($email !== '' && $email !== Str::lower((string) config('reservations.contact.email'))) {
            $cles[] = "e:{$email}";
        }
        if (! empty($champs['user_id'])) {
            $cles[] = "u:{$champs['user_id']}";
        }
        if ($cles === [] && $nom !== '') {
            $cles[] = 'n:'.Str::lower($nom);
        }

        return $champs + [
            'type'      => $type,
            'date'      => $date ? Carbon::parse($date)->toIso8601String() : null,
            'cles'      => $cles,
            'nom'       => $nom,
            'telephone' => $telephone,
            'email'     => $email,
        ];
    }

    /* ── Le regroupement, de proche en proche ──────────────────── */

    /**
     * @param  list<array<string, mixed>>  $traces
     * @return array<int, string> la racine de chaque trace
     */
    private static function regrouper(array $traces): array
    {
        $parent = [];
        $trouver = function (string $cle) use (&$parent, &$trouver): string {
            $parent[$cle] ??= $cle;
            if ($parent[$cle] !== $cle) {
                $parent[$cle] = $trouver($parent[$cle]);
            }

            return $parent[$cle];
        };

        foreach ($traces as $i => $trace) {
            $cles = $trace['cles'] ?: ["sans:{$i}"];
            $premiere = $trouver($cles[0]);
            foreach ($cles as $cle) {
                $racine = $trouver($cle);
                if ($racine !== $premiere) {
                    $parent[$racine] = $premiere;
                }
            }
        }

        $racines = [];
        foreach ($traces as $i => $trace) {
            $racines[$i] = $trouver(($trace['cles'] ?: ["sans:{$i}"])[0]);
        }

        return $racines;
    }

    /**
     * @param  list<array<string, mixed>>  $traces
     * @return array<string, mixed>
     */
    private static function client(array $traces): array
    {
        usort($traces, fn ($a, $b) => [$b['date'], $b['libelle']] <=> [$a['date'], $a['libelle']]);

        $compte = collect($traces)->pluck('compte')->filter()->first();
        $noms = collect($traces)->pluck('nom')->filter()->unique(fn ($n) => Str::lower($n))->values();
        $telephones = collect($traces)->pluck('telephone')->filter()
            ->unique(fn ($t) => Telephone::local($t))->values();
        $emails = collect($traces)->pluck('email')->filter()->unique()->values();
        $types = collect($traces)->countBy('type');
        $dates = collect($traces)->pluck('date')->filter();
        $cles = collect($traces)->pluck('cles')->flatten()->sort()->values();

        return [
            // Stable d'un appel à l'autre : le navigateur s'en sert pour déplier une ligne.
            'cle'             => substr(sha1((string) ($cles->first() ?? $noms->first() ?? '')), 0, 12),
            'nom'             => $compte['nom'] ?? $noms->first() ?? 'Sans nom',
            'noms'            => $noms->take(4)->all(),
            'telephones'      => $telephones->all(),
            'emails'          => $emails->all(),
            'compte'          => $compte,
            'premier_contact' => $dates->min(),
            'dernier_contact' => $dates->max(),
            'langue'          => collect($traces)->pluck('langue')->filter()->first(),
            'nombres'         => [
                'devis'        => $types['devis'] ?? 0,
                'demandes'     => $types['demande'] ?? 0,
                'services'     => $types['service'] ?? 0,
                'reservations' => $types['reservation'] ?? 0,
                'commandes'    => $types['commande'] ?? 0,
            ],
            'montant_devis'   => (int) collect($traces)->where('type', 'devis')->sum('montant'),
            'hebergements'    => collect($traces)->pluck('hebergement')->filter()->unique()->take(6)->values()->all(),
            'evenements'      => collect($traces)->take(self::EVENEMENTS_MAX)->map(fn (array $t) => [
                'type'    => $t['type'],
                'date'    => $t['date'],
                'libelle' => $t['libelle'],
                'detail'  => $t['detail'] ?? null,
                'montant' => $t['montant'] ?? null,
                'statut'  => $t['statut'] ?? null,
                'lien'    => $t['lien'] ?? null,
            ])->values()->all(),
        ];
    }
}
