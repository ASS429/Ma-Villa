<?php

namespace App\Services;

use App\Models\Villa;
use Illuminate\Http\JsonResponse;

/**
 * La réservation en ligne, suspendue.
 *
 * Posé le 14 septembre 2026, à la demande de l'exploitant : le compte PayDunya
 * est bloqué par une vérification d'identité (KYC). Encaisser sur un compte
 * dont les fonds peuvent être gelés, c'est prendre l'argent d'un client sans
 * savoir quand on pourra le lui rendre, ni le reverser au propriétaire.
 *
 * Tant que `reservations.ouvertes` vaut false, les demandes passent par un
 * contact humain — l'associé de l'exploitant — et le site le dit à la place
 * du formulaire.
 *
 * ⚠️ **Le refus est côté serveur**, pas seulement à l'écran. L'application
 * mobile déjà distribuée appelle la même API avec un code qu'on ne peut plus
 * mettre à jour : un blocage d'interface seul la laisserait réserver. C'est
 * aussi pourquoi le message porte le contact en toutes lettres — c'est tout ce
 * qu'elle affichera.
 *
 * Ce qui reste ouvert, volontairement : consulter, annuler, demander un
 * remboursement, écrire au propriétaire, et **constater un paiement déjà
 * lancé**. Fermer cette vérification laisserait un client débité sans
 * confirmation de sa réservation.
 */
final class ReservationsSuspendues
{
    /** Vrai tant que la réservation en ligne est fermée. */
    public static function enVigueur(): bool
    {
        return ! (bool) config('reservations.ouvertes');
    }

    /** @return array{nom: string, telephone: string, email: string} */
    public static function contact(): array
    {
        return [
            'nom'       => (string) config('reservations.contact.nom'),
            'telephone' => (string) config('reservations.contact.telephone'),
            'email'     => (string) config('reservations.contact.email'),
        ];
    }

    public static function message(): string
    {
        $contact = self::contact();

        return 'La réservation en ligne est momentanément suspendue. '
            . "Pour réserver, contactez {$contact['nom']} au {$contact['telephone']} "
            . "ou à {$contact['email']}.";
    }

    /**
     * Vrai si cette annonce se réserve auprès de l'équipe et non en ligne.
     *
     * Décidé le 31 octobre 2026 : on rouvre la réservation en ligne, mais les
     * annonces du circuit des associés restent au contact. Certains de leurs
     * comptes n'ont aucune boîte aux lettres : une demande n'y serait lue par
     * personne. Voir `reservations.associes_ouvertes`.
     */
    public static function aupresDeLEquipe(?Villa $villa): bool
    {
        return (bool) $villa?->passeParLesAssocies()
            && ! config('reservations.associes_ouvertes');
    }

    public static function messageEquipe(): string
    {
        $contact = self::contact();

        return 'Cet hébergement se réserve auprès de notre équipe. '
            . "Contactez {$contact['nom']} au {$contact['telephone']} "
            . "ou à {$contact['email']}.";
    }

    /**
     * La réponse à renvoyer quand on ne réserve pas en ligne, `null` sinon.
     *
     * Sans annonce, seule la fermeture générale compte : c'est le contrôle
     * fait avant toute lecture. Avec l'annonce, son circuit compte aussi.
     */
    public static function refus(?Villa $villa = null): ?JsonResponse
    {
        if (self::enVigueur()) {
            return self::reponse(self::message());
        }

        return self::aupresDeLEquipe($villa)
            ? self::reponse(self::messageEquipe(), ['aupres_de_l_equipe' => true])
            : null;
    }

    private static function reponse(string $message, array $plus = []): JsonResponse
    {
        // 503 et non 403 : ce n'est pas un refus adressé à ce client, c'est un
        // service momentanément fermé — un 403 se lirait « vous n'avez pas le
        // droit ». Même code que le paiement fermé, déjà en place.
        return response()->json([
            'message'  => $message,
            'suspendu' => true,
            'contact'  => self::contact(),
        ] + $plus, 503);
    }
}
