<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JournalAdmin;
use App\Services\FichierClients;
use App\Services\Tableur;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;

/**
 * Le fichier clients dans la console. Voir `FichierClients`.
 *
 * L'export est un fichier de données personnelles qui sort de la plateforme :
 * chaque téléchargement est noté au journal, comme la fiche d'un compte.
 */
class ClientsController extends Controller
{
    private const FILTRES = ['sans_compte', 'avec_compte', 'ont_reserve', 'devis_seul'];

    public function index(Request $request): JsonResponse
    {
        $filtres = $request->validate([
            'recherche' => 'sometimes|nullable|string|max:100',
            'filtre'    => 'sometimes|nullable|in:'.implode(',', self::FILTRES),
            'page'      => 'sometimes|integer|min:1',
        ]);

        $tous = FichierClients::construire();
        $liste = $this->filtrer($tous, $filtres);

        $parPage = 25;
        $page = (int) ($filtres['page'] ?? 1);
        $pagine = new LengthAwarePaginator(
            array_slice($liste, ($page - 1) * $parPage, $parPage),
            count($liste),
            $parPage,
            $page,
        );

        return response()->json($pagine->toArray() + [
            'resume' => [
                'clients'     => count($tous),
                'sans_compte' => count(array_filter($tous, fn ($c) => ! $c['compte'])),
                'joignables'  => count(array_filter($tous, fn ($c) => $c['telephones'] !== [] || $c['emails'] !== [])),
                'ont_reserve' => count(array_filter($tous, fn ($c) => $c['nombres']['reservations'] > 0)),
            ],
        ]);
    }

    public function export(Request $request): Response
    {
        $filtres = $request->validate([
            'recherche' => 'sometimes|nullable|string|max:100',
            'filtre'    => 'sometimes|nullable|in:'.implode(',', self::FILTRES),
        ]);

        $liste = $this->filtrer(FichierClients::construire(), $filtres);

        $date = fn (?string $d) => $d ? Carbon::parse($d)->timezone('Africa/Dakar')->format('d/m/Y') : '';
        $csv = Tableur::csv(
            ['Nom', 'Téléphones', 'E-mails', 'Compte', 'Premier contact', 'Dernier contact', 'Devis',
                'Montant des devis (FCFA)', 'Demandes particulières', 'Demandes de service', 'Réservations', 'Commandes', 'Hébergements'],
            array_map(fn (array $c) => [
                $c['nom'],
                implode(' / ', $c['telephones']),
                implode(' / ', $c['emails']),
                $c['compte'] ? 'Oui' : 'Non',
                $date($c['premier_contact']),
                $date($c['dernier_contact']),
                $c['nombres']['devis'],
                $c['montant_devis'],
                $c['nombres']['demandes'],
                $c['nombres']['services'],
                $c['nombres']['reservations'],
                $c['nombres']['commandes'],
                implode(' / ', $c['hebergements']),
            ], $liste),
        );

        JournalAdmin::consigner($request->user(), 'clients.exporte', null, 'Fichier clients', [
            'lignes' => count($liste),
            'filtre' => $filtres['filtre'] ?? null,
        ], $request->ip());

        return response($csv, 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="PasseTemps-clients-'.now()->format('Y-m-d').'.csv"',
            'Cache-Control'       => 'private, no-store',
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $clients
     * @param  array<string, mixed>  $filtres
     * @return list<array<string, mixed>>
     */
    private function filtrer(array $clients, array $filtres): array
    {
        $filtre = $filtres['filtre'] ?? null;
        $recherche = (string) ($filtres['recherche'] ?? '');

        return array_values(array_filter($clients, function (array $c) use ($filtre, $recherche) {
            $garde = match ($filtre) {
                'sans_compte' => ! $c['compte'],
                'avec_compte' => (bool) $c['compte'],
                'ont_reserve' => $c['nombres']['reservations'] > 0,
                'devis_seul'  => $c['nombres']['devis'] > 0 && $c['nombres']['reservations'] === 0,
                default       => true,
            };

            return $garde && FichierClients::correspond($c, $recherche);
        }));
    }
}
