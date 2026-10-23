<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Comptes de démonstration, et surtout leurs mots de passe.
 *
 * Séparé du peuplement des villas parce qu'il doit tourner **à chaque
 * démarrage**, y compris sur une base déjà remplie. Tant que ce code vivait
 * dans `VillaSeeder`, il n'était jamais exécuté en production : `DatabaseSeeder`
 * abandonne dès qu'une villa existe. Le correctif de sécurité était donc écrit,
 * déployé, et sans effet — vérifié en tentant la connexion, pas en relisant.
 */
class ComptesSeeder extends Seeder
{
    /**
     * Mot de passe historique de ces comptes. Il est écrit dans un dépôt
     * public, donc connu de tous : partout où il subsiste, le compte est
     * ouvert.
     */
    public const MOT_DE_PASSE_HISTORIQUE = 'password';

    /**
     * Adresse historique de l'admin. Le domaine mavilla.sn n'est pas à nous :
     * qui l'achète reçoit le lien « mot de passe oublié » de ce compte. En
     * production, `ADMIN_EMAIL` doit désigner une adresse que l'exploitant lit.
     */
    public const ADMIN = 'admin@mavilla.sn';

    public static function adresseAdmin(): string
    {
        $voulue = Str::lower(trim((string) env('ADMIN_EMAIL', '')));

        return $voulue !== '' ? $voulue : self::ADMIN;
    }

    /** @var list<array{email: string, name: string, role: string}> */
    public const PROPRIETAIRES = [
        ['email' => 'amadou.diallo@mavilla.sn',  'name' => 'Amadou Diallo',  'role' => 'proprietaire'],
        ['email' => 'fatou.ndiaye@mavilla.sn',   'name' => 'Fatou Ndiaye',   'role' => 'proprietaire'],
        ['email' => 'ibrahima.fall@mavilla.sn',  'name' => 'Ibrahima Fall',  'role' => 'proprietaire'],
    ];

    /** @var list<array{email: string, name: string, role: string}> */
    public const CLIENTS = [
        ['email' => 'sophie.martin@gmail.com',    'name' => 'Sophie Martin',    'role' => 'client'],
        ['email' => 'mamadou.gueye@gmail.com',    'name' => 'Mamadou Gueye',    'role' => 'client'],
        ['email' => 'aissatou.ba@gmail.com',      'name' => 'Aïssatou Ba',      'role' => 'client'],
        ['email' => 'pierre.dupont@gmail.com',    'name' => 'Pierre Dupont',    'role' => 'client'],
        ['email' => 'mariama.diop@gmail.com',     'name' => 'Mariama Diop',     'role' => 'client'],
        ['email' => 'jeanluc.bernard@gmail.com',  'name' => 'Jean-Luc Bernard', 'role' => 'client'],
    ];

    public function run(): void
    {
        // En production, plus aucun compte n'est créé d'office : l'exploitant
        // a son propre compte admin, et les comptes de démonstration ont été
        // retirés (migration du 23 octobre 2026) — leurs adresses en
        // @mavilla.sn, domaine qui n'est pas à nous, ou sur des gmail
        // inventés, permettaient à leur détenant de les reprendre. Seul
        // `ADMIN_EMAIL`, s'il est posé, désigne un admin à tenir.
        if (app()->environment('production')) {
            if (trim((string) env('ADMIN_EMAIL', '')) !== '') {
                $this->administrateur();
            }

            foreach ([self::ADMIN, ...array_column([...self::PROPRIETAIRES, ...self::CLIENTS], 'email')] as $email) {
                $this->fermerSiOuvert($email);
            }

            return;
        }

        $this->administrateur();
        $this->proprietaires();
        $this->clients();
    }

    /** Un compte historique encore présent ne garde jamais le mot de passe public. */
    private function fermerSiOuvert(string $email): void
    {
        $compte = User::where('email', $email)->first();

        if ($compte && Hash::check(self::MOT_DE_PASSE_HISTORIQUE, (string) $compte->password)) {
            $compte->forceFill(['password' => Hash::make(Str::random(48))])->save();
            $compte->tokens()->delete();
            $this->command?->warn("  ! {$email} : mot de passe public révoqué.");
        }
    }

    public function administrateur(): ?User
    {
        $email = self::adresseAdmin();
        $compte = User::where('email', $email)->first();

        // Changer d'adresse déménage l'admin existant — son historique, son
        // journal — au lieu d'en créer un second, et libère l'ancienne.
        if (! $compte && $email !== self::ADMIN) {
            $compte = User::where('email', self::ADMIN)->where('role', 'admin')->first();
            $compte?->forceFill(['email' => $email])->save();
        }

        // Jamais de promotion : un compte inscrit à cette adresse par
        // quelqu'un d'autre deviendrait admin au démarrage suivant.
        if ($compte && $compte->role !== 'admin') {
            $this->command?->warn("  ! {$email} appartient à un compte non admin : il n'est pas promu.");

            return null;
        }

        return $this->creerOuSecuriser(
            $email,
            ['name' => 'Admin PasseTemps', 'role' => 'admin'],
            (string) env('ADMIN_PASSWORD', '')
        );
    }

    /** @return Collection<int, User> */
    public function proprietaires(): Collection
    {
        return $this->lot(self::PROPRIETAIRES);
    }

    /** @return Collection<int, User> */
    public function clients(): Collection
    {
        return $this->lot(self::CLIENTS);
    }

    /**
     * @param  list<array{email: string, name: string, role: string}>  $comptes
     * @return Collection<int, User>
     */
    private function lot(array $comptes): Collection
    {
        $motDePasse = (string) env('SEED_PASSWORD', '');

        return new Collection(array_map(
            fn (array $c) => $this->creerOuSecuriser(
                $c['email'],
                ['name' => $c['name'], 'role' => $c['role']],
                $motDePasse
            ),
            $comptes
        ));
    }

    /**
     * Crée un compte sans jamais laisser derrière lui un mot de passe que tout
     * le monde peut lire.
     *
     *  — un mot de passe fourni par l'environnement fait foi, toujours ;
     *  — sinon, hors production, « password » reste, commode en local ;
     *  — sinon, on tire un secret que personne ne connaîtra. Le compte devient
     *    inaccessible : mieux vaut une porte fermée dont on a perdu la clé
     *    qu'une porte ouverte.
     *
     * Un compte existant n'est réécrit que s'il porte encore le mot de passe
     * historique — un secret déjà choisi par l'exploitant n'est jamais cassé.
     *
     * @param  array{name: string, role: string}  $attributs
     */
    private function creerOuSecuriser(string $email, array $attributs, string $motDePasseVoulu): User
    {
        $utilisateur = User::firstOrNew(['email' => $email]);
        // Le nom n'est posé qu'à la création : un compte existant désigné par
        // ADMIN_EMAIL garde celui que son titulaire a choisi.
        $utilisateur->fill($utilisateur->exists ? ['role' => $attributs['role']] : $attributs);

        $vulnerable = $utilisateur->exists
            && Hash::check(self::MOT_DE_PASSE_HISTORIQUE, (string) $utilisateur->password);

        if ($motDePasseVoulu !== '') {
            // Réécrit seulement s'il change. Et un mot de passe qui change
            // ferme les sessions ouvertes avec l'ancien, comme sur le site.
            if (! $utilisateur->exists || ! Hash::check($motDePasseVoulu, (string) $utilisateur->password)) {
                $utilisateur->password = Hash::make($motDePasseVoulu);
                if ($utilisateur->exists) {
                    $utilisateur->tokens()->delete();
                }
            }
        } elseif (! $utilisateur->exists || $vulnerable) {
            $enProduction = app()->environment('production');
            $utilisateur->password = Hash::make(
                $enProduction ? Str::random(48) : self::MOT_DE_PASSE_HISTORIQUE
            );

            if ($enProduction && $vulnerable) {
                $this->command?->warn(
                    "  ! {$email} : mot de passe public révoqué. Renseignez "
                    .'ADMIN_PASSWORD (admin) ou SEED_PASSWORD (démonstration) pour en fixer un.'
                );
            }
        }

        $utilisateur->save();

        return $utilisateur;
    }
}
