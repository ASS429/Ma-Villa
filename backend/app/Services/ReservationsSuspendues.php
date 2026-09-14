<?php

namespace App\Services;

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

    /** La réponse à renvoyer quand la réservation est suspendue, `null` sinon. */
    public static function refus(): ?JsonResponse
    {
        if (! self::enVigueur()) {
            return null;
        }

        // 503 et non 403 : ce n'est pas un refus adressé à ce client, c'est un
        // service momentanément fermé — un 403 se lirait « vous n'avez pas le
        // droit ». Même code que le paiement fermé, déjà en place.
        return response()->json([
            'message'  => self::message(),
            'suspendu' => true,
            'contact'  => self::contact(),
        ], 503);
    }
}
