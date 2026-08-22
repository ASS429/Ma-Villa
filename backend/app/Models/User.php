<?php

namespace App\Models;

use App\Notifications\ReinitialiserMotDePasse;
use App\Notifications\VerifierAdresseEmail;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = ['name', 'email', 'password', 'role', 'phone', 'avatar'];

    /**
     * `preferences_notification` reste hors de `$fillable` : elle ne se pose
     * que par le service qui l'assainit, jamais par une requête de profil.
     * Sinon un compte pourrait couper une notification verrouillée en passant
     * par la mise à jour de son nom.
     */
    /**
     * `phone_normalise` est une colonne de travail : elle ne sert qu'à
     * comparer un numéro à la connexion. La servir donnerait deux formes du
     * même champ à toute interface, qui finirait par afficher la mauvaise.
     */
    protected $hidden = ['password', 'remember_token', 'phone_normalise'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'preferences_notification' => 'array',
        ];
    }

    /* ══ Le numéro comme identifiant ══════════════════════════════ */

    /**
     * Forme canonique d'un numéro : chiffres seulement, indicatif local retiré.
     *
     * « +221 77 123 45 67 », « 77 123 45 67 » et « 221771234567 » désignent la
     * même ligne. Sans cette réduction, se connecter demanderait de retaper le
     * numéro exactement comme il a été saisi des mois plus tôt — espaces
     * compris.
     *
     * L'indicatif n'est retiré que s'il laisse un numéro sénégalais complet
     * (neuf chiffres). Un numéro étranger garde donc le sien : le tronquer
     * ferait entrer en collision un numéro français et un numéro ivoirien qui
     * se terminent pareil.
     *
     * Renvoie `null` quand il ne reste pas de quoi identifier quoi que ce
     * soit — un champ vide, ou trois chiffres tapés par erreur.
     */
    public static function normaliserNumero(?string $numero): ?string
    {
        $chiffres = preg_replace('/\D+/', '', (string) $numero);

        $indicatif = (string) config('auth.indicatif_local', '221');

        if ($indicatif !== '' && str_starts_with($chiffres, $indicatif)
            && strlen($chiffres) === strlen($indicatif) + 9) {
            $chiffres = substr($chiffres, strlen($indicatif));
        }

        return strlen($chiffres) >= 6 ? $chiffres : null;
    }

    /**
     * La forme canonique suit le numéro, toujours.
     *
     * Passer par un mutateur plutôt que par les contrôleurs : le numéro se
     * pose à l'inscription, au profil, par un peuplement et par la console.
     * Quatre chemins, dont un seul oublié suffirait à laisser un compte
     * inaccessible par son numéro sans que rien ne le signale.
     */
    public function setPhoneAttribute(?string $valeur): void
    {
        $this->attributes['phone'] = $valeur;
        $this->attributes['phone_normalise'] = self::normaliserNumero($valeur);
    }

    /** Emails transactionnels en français, pointant vers le front. */
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ReinitialiserMotDePasse($token));
    }

    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifierAdresseEmail());
    }

    public function villas(): HasMany
    {
        return $this->hasMany(Villa::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    public function avis(): HasMany
    {
        return $this->hasMany(Avis::class);
    }

    public function favoris(): HasMany
    {
        return $this->hasMany(Favori::class);
    }
}
