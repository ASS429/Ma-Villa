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

    public const ADMIN = 'admin@mavilla.sn';

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
        $this->administrateur();
        $this->proprietaires();
        $this->clients();
    }

    public function administrateur(): User
    {
        return $this->creerOuSecuriser(
            self::ADMIN,
            ['name' => 'Admin Ma Villa', 'role' => 'admin'],
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
        $utilisateur->fill($attributs);

        $vulnerable = $utilisateur->exists
            && Hash::check(self::MOT_DE_PASSE_HISTORIQUE, (string) $utilisateur->password);

        if ($motDePasseVoulu !== '') {
            $utilisateur->password = Hash::make($motDePasseVoulu);
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
