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
    /**
     * Ce qui part sans erreur mais arrive mal, ou arrive signé du mauvais nom.
     *
     * Un transport valide ne dit rien de ce que le destinataire voit. Ces
     * contrôles couvrent les défauts qui ne lèvent aucune exception — donc
     * ceux qu'aucun envoi de test ne révèle.
     *
     * @return array<int, array{sujet: string, message: string}>
     */
    private function avertissements(string $transport, ?string $expediteur): array
    {
        $avertissements = [];

        $marque = (string) config('app.name');

        // Le nom affiché voyage dans chaque message et survit aux renommages :
        // il est posé une fois dans un panneau, et plus personne ne le relit.
        $nomAffiche = (string) config('mail.from.name');
        if ($nomAffiche !== '' && $marque !== '' && $nomAffiche !== $marque) {
            $avertissements[] = [
                'sujet'   => 'Nom affiché',
                'message' => "Les messages sont signés « {$nomAffiche} » alors que la plateforme s'appelle « {$marque} ». C'est le nom que le destinataire lit avant d'ouvrir.",
            ];
        }

        if (blank($expediteur)) {
            $avertissements[] = [
                'sujet'   => 'Adresse d\'expédition',
                'message' => "Aucune adresse d'expédition n'est définie.",
            ];

            return $avertissements;
        }

        if (str_contains($expediteur, 'example.com') || str_contains($expediteur, 'hello@')) {
            $avertissements[] = [
                'sujet'   => 'Adresse d\'expédition',
                'message' => "L'adresse {$expediteur} ressemble à une valeur d'exemple.",
            ];
        }

        // Le destinataire compare l'expéditeur à ce qu'il a vu sur le site.
        // Deux adresses différentes, et un lien de réinitialisation ressemble
        // à une tentative d'hameçonnage — ce qu'on apprend justement aux gens
        // à repérer.
        $contactPublie = (string) config('mail.contact_publie');
        $adresseDeReponse = (string) config('mail.reply_to.address');

        // L'adresse de réponse suffit à faire le lien. L'expéditeur peut
        // porter le domaine de la marque — ce que réclament SPF et DKIM —
        // tant que « Répondre » ramène vers la boîte que le site publie.
        $reconnaissable = $expediteur === $contactPublie || $adresseDeReponse === $contactPublie;

        if ($contactPublie !== '' && ! $reconnaissable) {
            $avertissements[] = [
                'sujet'   => 'Cohérence avec le site',
                'message' => "Les messages partent de {$expediteur}, mais le site publie {$contactPublie} comme adresse de contact. Un lien de réinitialisation venu d'une autre adresse se lit comme une tentative d'hameçonnage. Deux façons de le régler : publier la même adresse sur le site, ou poser `MAIL_REPLY_TO_ADDRESS={$contactPublie}` — les réponses retomberont alors sur une boîte qui existe.",
            ];
        }

        // Un domaine public en expéditeur passe l'authentification mais échoue
        // l'alignement DMARC : le message part et finit en indésirables.
        foreach (['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'] as $public) {
            if (str_ends_with($expediteur, '@' . $public)) {
                $avertissements[] = [
                    'sujet'   => 'Domaine d\'expédition',
                    'message' => "L'expéditeur est une adresse {$public}. Ces domaines refusent qu'un tiers écrive en leur nom : le message part, mais il est classé indésirable chez une bonne part des destinataires. Une adresse sur votre propre domaine, avec SPF et DKIM, change tout.",
                ];
                break;
            }
        }

        /*
         * Gmail n'expédie qu'au nom d'une adresse vérifiée dans le compte
         * authentifié. Si les deux diffèrent sans que « Envoyer des e-mails
         * en tant que » ait été configuré, **Gmail réécrit silencieusement
         * l'expéditeur** : le message arrive au nom du compte, pas de
         * l'adresse choisie.
         *
         * C'est un défaut qu'aucune sonde ne peut constater — la réécriture a
         * lieu chez Google, après notre envoi, et notre configuration continue
         * d'afficher l'adresse voulue. Seul le message reçu le dit.
         */
        $identifiant = (string) config("mail.mailers.{$transport}.username");
        $hote = (string) config("mail.mailers.{$transport}.host");

        if (str_contains($hote, 'gmail') && $identifiant !== '' && $identifiant !== $expediteur) {
            $avertissements[] = [
                'sujet'   => 'Compte et expéditeur',
                'message' => "Le compte authentifié est {$identifiant}, mais les messages prétendent partir de {$expediteur}. Gmail n'accepte cela que si la seconde adresse est déclarée dans « Envoyer des e-mails en tant que » du premier compte ; sinon il réécrit l'expéditeur en silence, et vos utilisateurs reçoivent le message au nom de {$identifiant}. La sonde ne peut pas le voir : regardez l'expéditeur du message de test.",
            ];
        }

        /*
         * Expédier depuis un domaine n'est pas y recevoir.
         *
         * Un service d'envoi écrit au nom de l'adresse choisie sans qu'aucune
         * boîte n'existe derrière. Le message part, arrive — et la réponse
         * rebondit, au moment précis où quelqu'un cherche de l'aide.
         */
        if (blank($adresseDeReponse) && ! str_ends_with($expediteur, '@gmail.com')) {
            $avertissements[] = [
                'sujet'   => 'Réponses',
                'message' => "Aucune adresse de réponse n'est posée. Si {$expediteur} n'a pas de boîte derrière — expédier depuis un domaine n'est pas y recevoir — toute réponse rebondira. `MAIL_REPLY_TO_ADDRESS` fait retomber les réponses sur une boîte qui existe.",
            ];
        }

        // Gmail affiche ses mots de passe d'application par groupes de quatre.
        // Recopiés tels quels, les espaces partent dans l'authentification et
        // le serveur refuse — sans jamais dire que c'est à cause d'eux.
        $motDePasse = (string) config("mail.mailers.{$transport}.password");
        if ($motDePasse !== '' && str_contains($motDePasse, ' ')) {
            $avertissements[] = [
                'sujet'   => 'Mot de passe',
                'message' => "Le mot de passe contient des espaces. Google affiche ses mots de passe d'application par groupes de quatre, mais ils se saisissent **collés**. Avec les espaces, l'authentification est refusée.",
            ];
        }

        return $avertissements;
    }

    public function __invoke(Request $request): JsonResponse
    {
        // Pas de `validate()` ici, et c'est délibéré.
        //
        // Une adresse mal formée y produirait un 422 : une erreur de
        // formulaire, en anglais, dans la console du navigateur — sur un
        // écran dont le métier est justement d'expliquer ce qui ne va pas.
        // Une sonde qui échoue de façon opaque est une sonde de moins.
        $destinataire = trim((string) $request->query('email', ''));

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

        $etat['avertissements'] = $this->avertissements($transport, $expediteur);
        $expediteurDouteux = $etat['avertissements'] !== [];

        // ── L'adresse de test, si elle tient debout ───────────────────
        if ($destinataire !== '' && ! filter_var($destinataire, FILTER_VALIDATE_EMAIL)) {
            return response()->json($etat + [
                'ok'      => false,
                'verdict' => "L'adresse de test « {$destinataire} » n'est pas une adresse valide. Rien n'a été envoyé — corrigez-la et relancez.",
                'envoi'   => ['tente' => false],
            ]);
        }

        // ── L'envoi réel, seulement sur demande ───────────────────────
        if ($destinataire === '') {
            return response()->json($etat + [
                'ok'      => ! $expediteurDouteux,
                'verdict' => $expediteurDouteux
                    ? "À moitié. Le transport « {$transport} » est configuré, mais " . count($etat['avertissements']) . ' point' . (count($etat['avertissements']) > 1 ? 's' : '') . " demande" . (count($etat['avertissements']) > 1 ? 'nt' : '') . " correction avant d'écrire à de vrais utilisateurs."
                    : "Le transport « {$transport} » est configuré, et l'expéditeur tient. Rien ne prouve encore qu'un message arrive : donnez une adresse pour envoyer un test.",
                'envoi'   => ['tente' => false],
            ]);
        }

        /*
         * Le délai du transport est `null` par défaut : un serveur qui ne
         * répond pas fait attendre indéfiniment. Sur une sonde, c'est le pire
         * comportement possible — le navigateur abandonne au bout de vingt
         * secondes et affiche « le serveur met trop de temps », qui accuse
         * notre serveur alors que c'est le service de courrier qui se tait.
         *
         * Douze secondes laissent la marge pour rapporter le blocage plutôt
         * que de le subir. `purge` force la reconstruction du transport, sans
         * quoi le réglage arriverait après coup.
         */
        config(["mail.mailers.{$transport}.timeout" => 12]);
        Mail::purge($transport);

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
            $message = $e->getMessage();

            // Un blocage réseau ne se lit pas comme un refus : le service ne
            // dit rien du tout. Chez un hébergeur, c'est presque toujours le
            // port qui est fermé en sortie.
            $silence = str_contains($message, 'timed out')
                || str_contains($message, 'timeout')
                || str_contains($message, 'Connection could not be established');

            return response()->json($etat + [
                'ok'      => false,
                'verdict' => $silence
                    ? "Non. {$transport} n'a pas répondu en douze secondes. Le service ne refuse pas : il se tait — signature d'un port fermé en sortie, pas d'un refus d'identifiants. Les hébergeurs bloquent couramment le SMTP (25, 465, 587) pour endiguer le courrier indésirable, et aucun réglage ne le contourne. Un service qui expédie en HTTP passe, lui : `MAIL_MAILER=resend` et `RESEND_API_KEY`, le transport étant déjà installé."
                    : "Non. Le serveur a refusé l'envoi. C'est la réponse du service de courrier, telle quelle — elle nomme presque toujours la cause : identifiants, port, ou domaine d'expédition non vérifié.",
                'envoi'   => ['tente' => true, 'ok' => false, 'erreur' => $message],
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
