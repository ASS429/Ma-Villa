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
            'phone' => 'sometimes|nullable|string|max:50',
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role' => $data['role'] ?? 'client',
            'phone' => $data['phone'] ?? null,
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
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        // Sans limite, l'endpoint permet de tester des mots de passe en boucle.
        $cle = 'login:'.Str::lower($data['email']).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($cle, 5)) {
            $secondes = RateLimiter::availableIn($cle);

            throw ValidationException::withMessages([
                'email' => ["Trop de tentatives. Réessayez dans {$secondes} secondes."],
            ]);
        }

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($cle, 60);

            throw ValidationException::withMessages([
                'email' => ['Les identifiants sont incorrects.'],
            ]);
        }

        RateLimiter::clear($cle);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
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
            'phone'                 => 'sometimes|nullable|string|max:50',
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
        if (array_key_exists('phone', $data)) $user->phone = $data['phone'];

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
