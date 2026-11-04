<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Commande;
use App\Models\JournalAdmin;
use App\Models\Message;
use App\Models\Paiement;
use App\Models\Reservation;
use App\Models\Reversement;
use App\Models\User;
use App\Models\Villa;
use App\Services\DocumentPdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * La fiche d'un compte dans la console : tout ce que la base sait de lui, sur
 * un seul écran — ses annonces, les réservations reçues et faites, ce qui lui a
 * été versé et ce qui lui reste dû, ce que l'administration a décidé à son sujet.
 *
 * « Ses activités » veut dire ce que la base enregistre : ni connexions, ni
 * pages vues. Le **contenu** des messages privés n'y figure pas, seul leur
 * nombre.
 *
 * Deux PDF : la fiche interne, avec les coordonnées, notée au journal à chaque
 * téléchargement ; et le catalogue de ses annonces en ligne, sans coordonnées,
 * sans commission ni majoration, qu'on peut envoyer à un partenaire.
 */
class FicheUtilisateurController extends Controller
{
    private const TYPES = ['fiche', 'catalogue'];

    public function show(User $user): JsonResponse
    {
        return response()->json($this->donnees($user));
    }

    public function document(Request $request, User $user, string $type): Response
    {
        abort_unless(in_array($type, self::TYPES, true), 404);

        $donnees = $this->donnees($user);
        $nom = Str::slug($user->name) ?: 'compte';

        if ($type === 'catalogue') {
            $annonces = $user->villas()->where('statut', 'validee')
                ->with(['photos', 'logements.tarifs'])->orderBy('nom')->get();
            abort_if($annonces->isEmpty(), 404, 'Aucune annonce en ligne pour ce compte.');

            $photos = DocumentPdf::imagesDistantes($this->photosDuCatalogue($annonces), 720, 4 / 3);
            $pdf = DocumentPdf::depuisVue('pdf.catalogue', [
                'proprietaire' => $user,
                'annonces'     => $annonces,
                'photos'       => $photos,
                'logo'         => DocumentPdf::imageLocale('logo.png'),
                'contact'      => config('reservations.contact'),
            ]);
        } else {
            $pdf = DocumentPdf::depuisVue('pdf.fiche', $donnees + [
                'logo'   => DocumentPdf::imageLocale('logo.png'),
                'auteur' => $request->user(),
            ]);
        }

        JournalAdmin::consigner($request->user(), "utilisateur.{$type}_telecharge", $user, $user->name, [], $request->ip());

        $fichier = ($type === 'catalogue' ? 'Catalogue-' : 'Fiche-').$nom.'.pdf';

        return response($pdf, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => "attachment; filename=\"{$fichier}\"",
            'Cache-Control'       => 'private, no-store',
        ]);
    }

    /** @return array<string, mixed> */
    private function donnees(User $user): array
    {
        $villas = $user->villas()
            ->with(['photos', 'logements.tarifs'])
            ->withMin('tarifs as prix_min', 'prix')
            ->latest()
            ->get();
        $ids = $villas->pluck('id');

        $surSesAnnonces = fn (Builder $q) => $q->whereIn('villa_id', $ids);
        $recues = Reservation::whereHas('logement', $surSesAnnonces);
        $encaisses = Paiement::abouti()->whereHas('reservation.logement', $surSesAnnonces);

        return [
            'utilisateur' => [
                'id'                => $user->id,
                'name'              => $user->name,
                'email'             => $user->email,
                'phone'             => $user->phone,
                'role'              => $user->role,
                'avatar'            => $user->avatar,
                'created_at'        => $user->created_at?->toIso8601String(),
                'email_verified_at' => $user->email_verified_at?->toIso8601String(),
                // Un compte créé par import, sans boîte : personne ne s'y connecte.
                'compte_d_attente'  => str_ends_with((string) $user->email, '@passetemps.sn'),
            ],
            'chiffres' => [
                'annonces'            => $villas->count(),
                'annonces_en_ligne'   => $villas->where('statut', 'validee')->count(),
                'reservations_recues' => (clone $recues)->count(),
                'reservations_faites' => $user->reservations()->count(),
                'encaisse'            => (int) (clone $encaisses)->sum('montant'),
                'part_proprietaire'   => (int) (clone $encaisses)->sum('montant_proprietaire'),
                'verse'               => (int) Reversement::where('user_id', $user->id)->whereIn('statut', ['manuel', 'reussi'])->sum('montant'),
                'du'                  => (int) Paiement::exigible()->whereHas('reservation.logement', $surSesAnnonces)->sum('montant_proprietaire'),
                'avis'                => $user->avis()->count(),
                'favoris'             => $user->favoris()->count(),
                'messages'            => Message::where('user_id', $user->id)->count(),
                'commandes'           => Commande::where('user_id', $user->id)->count(),
            ],
            'annonces' => $villas->map(fn (Villa $v) => [
                'id'        => $v->id,
                'nom'       => $v->nom,
                'ville'     => $v->ville,
                'quartier'  => $v->quartier,
                'statut'    => $v->statut,
                'prix_min'  => $v->prix_min !== null ? (int) $v->prix_min : null,
                'logements' => $v->logements->count(),
                'capacite'  => (int) $v->logements->sum('capacite'),
                'photo'     => $v->photos->sortBy('ordre')->first()?->url,
            ])->values(),
            'reservations_recues' => (clone $recues)->with(['logement.villa:id,nom', 'client:id,name'])
                ->latest()->limit(15)->get()->map(fn (Reservation $r) => $this->reservation($r, true))->values(),
            'reservations' => $user->reservations()->with('logement.villa:id,nom')
                ->latest()->limit(15)->get()->map(fn (Reservation $r) => $this->reservation($r, false))->values(),
            'journal' => JournalAdmin::where(fn ($q) => $q
                ->where(fn ($s) => $s->where('cible_type', 'User')->where('cible_id', $user->id))
                ->orWhere(fn ($s) => $s->where('cible_type', 'Villa')->whereIn('cible_id', $ids)))
                ->latest()->latest('id')->limit(15)
                ->get(['id', 'action', 'cible_libelle', 'auteur_nom', 'created_at']),
        ];
    }

    /** @return array<string, mixed> */
    private function reservation(Reservation $r, bool $recue): array
    {
        return [
            'id'          => $r->id,
            'hebergement' => $r->logement?->villa?->nom,
            'villa_id'    => $r->logement?->villa?->id,
            'logement'    => $r->logement?->nom,
            'client'      => $recue ? $r->client?->name : null,
            'date_debut'  => $r->date_debut,
            'date_fin'    => $r->date_fin,
            'personnes'   => $r->nb_personnes,
            'montant'     => (int) $r->montant_total,
            'statut'      => $r->statut,
        ];
    }

    /**
     * Trois photos par annonce : la première en grand, deux en vignettes.
     *
     * @param  Collection<int, Villa>  $annonces
     * @return array<string, string>
     */
    private function photosDuCatalogue(Collection $annonces): array
    {
        $urls = [];
        foreach ($annonces as $v) {
            foreach ($v->photos->sortBy('ordre')->take(3)->values() as $i => $photo) {
                $urls["{$v->id}-{$i}"] = $photo->url;
            }
        }

        return $urls;
    }
}
