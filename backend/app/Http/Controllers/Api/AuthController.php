<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
            // Un compte admin ne se crée jamais par inscription publique.
            'role' => 'sometimes|in:client,proprietaire',
            // Le numéro sert désormais à se connecter : deux comptes qui le
            // partagent rendraient la connexion ambiguë. La contrainte porte
            // sur la forme canonique, la seule qui compare vraiment.
            'phone' => ['sometimes', 'nullable', 'string', 'max:50', $this->numeroLibre()],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role' => $data['role'] ?? 'client',
            // Une chaîne vide n'est pas un numéro : la stocker laisserait
            // un champ qui a l'air rempli et ne joint personne.
            'phone' => ($data['phone'] ?? null) ?: null,
        ]);

        // Un transport email mal configuré ne doit jamais empêcher la création
        // d'un compte : sans ce garde-fou, l'inscription renvoyait une 500
        // alors que l'utilisateur venait d'être enregistré.
        $this->envoyerSansBloquer(
            fn () => $user->sendEmailVerificationNotification(),
            "Email de vérification non envoyé à {$user->email}"
        );

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            // `identifiant` est la forme actuelle : une adresse **ou** un
            // numéro. `email` reste accepté parce que le front et l'API ne
            // sont jamais déployés en même temps — pendant la fenêtre, un
            // écran ancien continue de l'envoyer, et refuser sa requête
            // couperait la connexion à tout le monde le temps du décalage.
            'identifiant' => 'required_without:email|nullable|string|max:255',
            'email'       => 'required_without:identifiant|nullable|string|max:255',
            'password'    => 'required|string',
        ]);

        $identifiant = trim((string) ($data['identifiant'] ?? $data['email']));
        $parNumero = ! str_contains($identifiant, '@');

        // La limite porte sur la forme canonique, pas sur ce qui a été tapé :
        // sinon « 77 123 45 67 » et « +221771234567 » ouvriraient chacun leur
        // compteur, et cinq essais deviendraient dix.
        $empreinte = $parNumero
            ? (User::normaliserNumero($identifiant) ?? $identifiant)
            : Str::lower($identifiant);

        // Sans limite, l'endpoint permet de tester des mots de passe en boucle.
        $cle = 'login:'.$empreinte.'|'.$request->ip();

        // Le message d'échec porte sur le champ que l'écran affiche.
        $champ = isset($data['identifiant']) ? 'identifiant' : 'email';

        if (RateLimiter::tooManyAttempts($cle, 5)) {
            $secondes = RateLimiter::availableIn($cle);

            throw ValidationException::withMessages([
                $champ => ["Trop de tentatives. Réessayez dans {$secondes} secondes."],
            ]);
        }

        $user = $parNumero
            ? User::where('phone_normalise', User::normaliserNumero($identifiant))->first()
            : User::where('email', $identifiant)->first();

        // ⚠️ Un numéro qui ne se normalise pas vaut `null`, et `where(…, null)`
        // ne compare pas : la requête ne rendrait rien, ce qui est le
        // comportement voulu. On ne s'en remet pas au hasard pour autant.
        if ($parNumero && User::normaliserNumero($identifiant) === null) {
            $user = null;
        }

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($cle, 60);

            // Un message unique, quelle que soit la cause. Distinguer
            // « ce compte n'existe pas » de « mot de passe incorrect »
            // transforme l'écran de connexion en annuaire : on y teste des
            // numéros jusqu'à savoir qui est inscrit.
            throw ValidationException::withMessages([
                $champ => [$parNumero
                    ? 'Ce numéro et ce mot de passe ne correspondent pas.'
                    : 'Cette adresse et ce mot de passe ne correspondent pas.'],
            ]);
        }

        RateLimiter::clear($cle);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    /**
     * « Ce numéro n'est pas déjà pris. »
     *
     * L'unicité ne peut pas se déclarer sur `phone` : la colonne garde la
     * saisie telle quelle, et « +221 77 123 45 67 » y cohabiterait sans
     * difficulté avec « 77 123 45 67 ». C'est la forme canonique qui décide,
     * comme à la connexion.
     *
     * Le message ne dit pas *qui* détient le numéro, et propose la seule
     * suite utile : se connecter.
     */
    private function numeroLibre(?int $saufId = null): \Closure
    {
        return function (string $attribut, ?string $valeur, \Closure $echoue) use ($saufId) {
            $normalise = User::normaliserNumero($valeur);

            if ($normalise === null) {
                return;
            }

            $existe = User::where('phone_normalise', $normalise)
                ->when($saufId, fn ($q) => $q->where('id', '!=', $saufId))
                ->exists();

            if ($existe) {
                $echoue('Un compte utilise déjà ce numéro. Connectez-vous plutôt.');
            }
        };
    }

    /* ── Mot de passe oublié ────────────────────────────────────── */

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => 'required|email']);

        try {
            $statut = Password::sendResetLink($request->only('email'));
        } catch (\Throwable $e) {
            // Transport email indisponible : on le journalise et on répond
            // comme d'habitude, sans exposer la panne ni révéler si l'adresse
            // existe. L'utilisateur réessaiera, l'exploitant verra le journal.
            Log::error('Lien de réinitialisation non envoyé', ['erreur' => $e->getMessage()]);

            return response()->json([
                'message' => 'Si un compte existe avec cette adresse, un lien de réinitialisation vient d\'être envoyé.',
            ]);
        }

        // On répond toujours la même chose : indiquer qu'une adresse est
        // inconnue permettrait d'énumérer les comptes de la plateforme.
        if ($statut === Password::RESET_THROTTLED) {
            return response()->json([
                'message' => 'Un email vient déjà d\'être envoyé. Patientez quelques minutes.',
            ], 429);
        }

        return response()->json([
            'message' => 'Si un compte existe avec cette adresse, un lien de réinitialisation vient d\'être envoyé.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string',
            'email' => 'required|email',
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        $statut = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])->save();

                // Un mot de passe réinitialisé doit invalider les sessions
                // ouvertes ailleurs : c'est souvent un compte compromis.
                $user->tokens()->delete();
            }
        );

        if ($statut !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => ['Ce lien de réinitialisation est invalide ou expiré.'],
            ]);
        }

        return response()->json(['message' => 'Mot de passe modifié. Vous pouvez vous connecter.']);
    }

    /* ── Vérification d'adresse email ───────────────────────────── */

    public function verifyEmail(Request $request, int $id, string $hash): RedirectResponse
    {
        $front = rtrim(config('app.frontend_url'), '/');
        $user = User::find($id);

        if (! $user || ! hash_equals($hash, sha1($user->getEmailForVerification()))) {
            return redirect($front.'/email-verifie?statut=invalide');
        }

        if ($user->hasVerifiedEmail()) {
            return redirect($front.'/email-verifie?statut=deja');
        }

        $user->markEmailAsVerified();
        event(new Verified($user));

        return redirect($front.'/email-verifie?statut=ok');
    }

    public function resendVerification(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Votre adresse est déjà confirmée.']);
        }

        $cle = 'verif:'.$user->id;

        if (RateLimiter::tooManyAttempts($cle, 3)) {
            return response()->json([
                'message' => 'Trop d\'envois. Réessayez dans quelques minutes.',
            ], 429);
        }

        RateLimiter::hit($cle, 300);

        if (! $this->envoyerSansBloquer(
            fn () => $user->sendEmailVerificationNotification(),
            "Renvoi de vérification impossible pour {$user->email}"
        )) {
            return response()->json([
                'message' => "L'envoi a échoué. Réessayez plus tard ou contactez-nous.",
            ], 503);
        }

        return response()->json(['message' => 'Email de confirmation renvoyé.']);
    }

    /**
     * Exécute un envoi d'email sans laisser une panne de transport interrompre
     * l'action métier en cours. Renvoie false si l'envoi a échoué.
     */
    private function envoyerSansBloquer(callable $envoi, string $contexte): bool
    {
        try {
            $envoi();

            return true;
        } catch (\Throwable $e) {
            Log::error($contexte, ['erreur' => $e->getMessage()]);

            return false;
        }
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->user()->currentAccessToken();
        if ($token) {
            $token->delete();
        }

        return response()->json(['message' => 'Déconnecté avec succès.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user());
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name'                  => 'sometimes|string|max:255',
            'email'                 => 'sometimes|email|unique:users,email,' . $user->id,
            'phone'                 => ['sometimes', 'nullable', 'string', 'max:50', $this->numeroLibre($user->id)],
            'current_password'      => 'required_with:password|string',
            'password'              => 'sometimes|string|min:8|confirmed',
            'password_confirmation' => 'sometimes|string',
        ]);

        $motDePasseChange = isset($data['password']);

        if ($motDePasseChange) {
            if (! Hash::check($data['current_password'], $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['Mot de passe actuel incorrect.'],
                ]);
            }
            $user->password = $data['password'];
        }

        if (isset($data['name']))  $user->name  = $data['name'];
        if (array_key_exists('phone', $data)) $user->phone = $data['phone'] ?: null;

        // Changer d'adresse reprend la vérification à zéro. Sans cela le compte
        // reste marqué « vérifié » sur une adresse que personne n'a confirmée —
        // y compris celle de quelqu'un d'autre — et la vérification ne garantit
        // plus rien.
        $adresseChangee = isset($data['email']) && $data['email'] !== $user->email;

        if ($adresseChangee) {
            $user->email = $data['email'];
            $user->email_verified_at = null;
        }

        $user->save();

        if ($adresseChangee) {
            $this->envoyerSansBloquer(
                fn () => $user->sendEmailVerificationNotification(),
                "Vérification de la nouvelle adresse non envoyée à {$user->email}"
            );
        }

        // Changer son mot de passe est le geste de quelqu'un qui pense son
        // compte compromis. Laisser vivre les jetons déjà émis le rendrait
        // inutile : celui qui est entré y resterait. La session courante est
        // épargnée, sans quoi l'utilisateur se déconnecte lui-même.
        if ($motDePasseChange) {
            $courant = $request->user()->currentAccessToken();

            $user->tokens()
                ->when($courant, fn ($q) => $q->where('id', '!=', $courant->id))
                ->delete();
        }

        return response()->json($user);
    }
}
