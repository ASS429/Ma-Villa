<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

/**
 * La sonde du courrier — la quatrième, et celle qui manquait le plus.
 *
 * Trois sondes couvraient l'encaissement, les notifications et le
 * déboursement. Le courrier, lui, n'en avait aucune, alors qu'il porte la
 * seule chose qu'un utilisateur ne peut pas contourner : **récupérer son
 * compte**. Sans SMS, un mot de passe oublié se répare par courriel ou pas du
 * tout.
 *
 * Et la panne est silencieuse par construction. `forgotPassword` répond « si
 * un compte existe, un lien vient d'être envoyé » quoi qu'il arrive — c'est
 * volontaire, cela évite de dire qui est inscrit. Mais le même silence cache
 * une panne totale à l'exploitant, qui ne l'apprend que par un utilisateur
 * bloqué. Cette sonde est le seul endroit où la vérité se dit.
 *
 * ⚠️ Le test réel **envoie un message**. Il n'est donc tenté que si une
 * adresse est fournie : rien ne doit partir par surprise.
 */
class DiagnosticCourrielController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $donnees = $request->validate([
            'email' => 'sometimes|nullable|email',
        ]);

        $transport = (string) config('mail.default');
        $expediteur = config('mail.from.address');
        $connus = array_keys(config('mail.mailers', []));

        $etat = [
            'transport'   => $transport,
            'expediteur'  => $expediteur,
            'nom_affiche' => config('mail.from.name'),
            'hote'        => config("mail.mailers.{$transport}.host"),
            'port'        => config("mail.mailers.{$transport}.port"),
            'transports_connus' => $connus,
        ];

        // ── Le transport est-il seulement valide ? ────────────────────
        if (! in_array($transport, $connus, true)) {
            return response()->json($etat + [
                'ok'      => false,
                'verdict' => str_contains($transport, '@')
                    // L'erreur classique : une adresse posée dans MAIL_MAILER,
                    // qui attend un type de transport. Tout envoi lève alors.
                    ? "Non. `MAIL_MAILER` contient une adresse électronique, alors qu'il attend un type de transport. Une adresse se renseigne dans `MAIL_FROM_ADDRESS` ; pour un envoi par SMTP, mettez `MAIL_MAILER=smtp`."
                    : "Non. `MAIL_MAILER` vaut « {$transport} », qui n'est pas un transport connu. Valeurs acceptées : " . implode(', ', $connus) . '.',
            ]);
        }

        if ($transport === 'log') {
            return response()->json($etat + [
                'ok'      => false,
                'verdict' => "Non. Le transport vaut « log » : les messages sont écrits dans le journal du serveur et ne partent jamais. La réinitialisation de mot de passe et la vérification d'adresse sont inopérantes — et sans SMS, un mot de passe oublié perd le compte.",
            ]);
        }

        if ($transport === 'array') {
            return response()->json($etat + [
                'ok'      => false,
                'verdict' => "Non. Le transport vaut « array » : les messages sont gardés en mémoire pour les tests et disparaissent. Rien ne part.",
            ]);
        }

        $expediteurDouteux = blank($expediteur)
            || str_contains((string) $expediteur, 'example.com')
            || str_contains((string) $expediteur, 'hello@');

        // ── L'envoi réel, seulement sur demande ───────────────────────
        $destinataire = $donnees['email'] ?? null;

        if (blank($destinataire)) {
            return response()->json($etat + [
                'ok'      => ! $expediteurDouteux,
                'verdict' => $expediteurDouteux
                    ? "À moitié. Le transport « {$transport} » est configuré, mais l'adresse d'expédition ({$expediteur}) ressemble à une valeur d'exemple : les messages partiraient d'une adresse qui n'existe pas, et finiraient en indésirables."
                    : "Le transport « {$transport} » est configuré, et l'adresse d'expédition tient. Rien ne prouve encore qu'un message arrive : donnez une adresse pour envoyer un test.",
                'envoi'   => ['tente' => false],
            ]);
        }

        try {
            Mail::raw(
                "Ce message vient de la sonde de courrier de PasseTemps.\n\n"
                . "Si vous le lisez, la configuration est bonne : les réinitialisations "
                . "de mot de passe et les vérifications d'adresse partiront.\n\n"
                . "Transport : {$transport}\n"
                . "Expéditeur : {$expediteur}",
                fn ($m) => $m->to($destinataire)->subject('PasseTemps — sonde de courrier')
            );
        } catch (\Throwable $e) {
            return response()->json($etat + [
                'ok'      => false,
                'verdict' => "Non. Le serveur a refusé l'envoi. C'est la réponse du service de courrier, telle quelle — elle nomme presque toujours la cause : identifiants, port, ou domaine d'expédition non vérifié.",
                'envoi'   => ['tente' => true, 'ok' => false, 'erreur' => $e->getMessage()],
            ]);
        }

        return response()->json($etat + [
            'ok'      => true,
            // Nuance qui compte : « parti » n'est pas « reçu ». Un domaine
            // d'expédition sans SPF ni DKIM passe le serveur et finit en
            // indésirables — ce que seule la boîte du destinataire dira.
            'verdict' => "Oui, le message est parti sans erreur vers {$destinataire}. Vérifiez la boîte, **et les indésirables** : un domaine d'expédition sans SPF ni DKIM part bien et arrive mal.",
            'envoi'   => ['tente' => true, 'ok' => true, 'destinataire' => $destinataire],
        ]);
    }
}
