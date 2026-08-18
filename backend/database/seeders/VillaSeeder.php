<?php

namespace Database\Seeders;

use App\Models\Avis;
use App\Models\Logement;
use App\Models\Photo;
use App\Models\Tarif;
use App\Models\User;
use App\Models\Villa;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class VillaSeeder extends Seeder
{
    /**
     * Mot de passe historique de ces comptes. Il est écrit dans un dépôt
     * public, donc connu de tout le monde : partout où il subsiste, le compte
     * est ouvert.
     */
    private const MOT_DE_PASSE_HISTORIQUE = 'password';

    public function run(): void
    {
        // ── Utilisateurs ──────────────────────────────────────────
        $this->creerOuSecuriser(
            'admin@mavilla.sn',
            ['name' => 'Admin Ma Villa', 'role' => 'admin'],
            (string) env('ADMIN_PASSWORD', '')
        );

        $motDePasseDemo = (string) env('SEED_PASSWORD', '');

        $props = collect([
            ['name' => 'Amadou Diallo',   'email' => 'amadou.diallo@mavilla.sn'],
            ['name' => 'Fatou Ndiaye',    'email' => 'fatou.ndiaye@mavilla.sn'],
            ['name' => 'Ibrahima Fall',   'email' => 'ibrahima.fall@mavilla.sn'],
        ])->map(fn ($d) => $this->creerOuSecuriser(
            $d['email'],
            ['name' => $d['name'], 'role' => 'proprietaire'],
            $motDePasseDemo
        ));

        $clients = collect([
            ['name' => 'Sophie Martin',     'email' => 'sophie.martin@gmail.com'],
            ['name' => 'Mamadou Gueye',     'email' => 'mamadou.gueye@gmail.com'],
            ['name' => 'Aïssatou Ba',       'email' => 'aissatou.ba@gmail.com'],
            ['name' => 'Pierre Dupont',     'email' => 'pierre.dupont@gmail.com'],
            ['name' => 'Mariama Diop',      'email' => 'mariama.diop@gmail.com'],
            ['name' => 'Jean-Luc Bernard', 'email' => 'jeanluc.bernard@gmail.com'],
        ])->map(fn ($d) => $this->creerOuSecuriser(
            $d['email'],
            ['name' => $d['name'], 'role' => 'client'],
            $motDePasseDemo
        ));

        // ── Données villas ────────────────────────────────────────
        $data = [
            // Propriétaire 1 — Amadou Diallo
            [
                'prop' => 0,
                'villa' => [
                    'nom'         => 'Villa Baobab',
                    'ville'       => 'Saly',
                    'adresse'     => 'Route de la Plage, Saly Portudal',
                    'telephone'   => '+221 77 100 11 01',
                    'description' => 'Majestueuse villa entourée de baobabs centenaires, à deux pas de la plage de Saly. Piscine à débordement, jardin tropical et vue panoramique sur l\'Atlantique. Idéale pour des vacances de rêve en famille ou entre amis.',
                    'statut'      => 'validee',
                    'vedette'     => true,
                    'latitude'    => 14.4509,
                    'longitude'   => -17.0042,
                ],
                'photos'  => ['V1.jpg', 'V2.jpg', 'V3.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Villa entière', 'capacite' => 14,
                        'description' => 'La villa complète avec toutes ses chambres et espaces communs.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',   'prix' => 280000, 'avec_clim' => true,  'avec_buffet' => false],
                            ['type_tarif' => 'journee',  'prix' => 200000, 'avec_clim' => true,  'avec_buffet' => true],
                        ],
                    ],
                    [
                        'type' => 'piscine', 'nom' => 'Accès Piscine', 'capacite' => 25,
                        'description' => 'Accès journée à la piscine à débordement et au jacuzzi.',
                        'tarifs' => [
                            ['type_tarif' => 'journee',     'prix' => 35000, 'avec_clim' => false, 'avec_buffet' => false],
                            ['type_tarif' => 'demi_journee','prix' => 20000, 'avec_clim' => false, 'avec_buffet' => false],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 0, 'note' => 5, 'commentaire' => 'Villa absolument magnifique ! Le cadre est exceptionnel, la piscine sublime. On reviendra sans hésiter.'],
                    ['client' => 1, 'note' => 5, 'commentaire' => 'Séjour parfait. L\'accueil était chaleureux et la villa dépassait toutes nos attentes.'],
                    ['client' => 3, 'note' => 4, 'commentaire' => 'Très belle villa, bien équipée. Quelques petits détails à améliorer mais globalement excellent.'],
                ],
            ],
            [
                'prop' => 0,
                'villa' => [
                    'nom'         => 'Villa Teranga',
                    'ville'       => 'Mbour',
                    'adresse'     => 'Cité Balnéaire, Mbour',
                    'telephone'   => '+221 77 100 11 02',
                    'description' => 'Teranga signifie hospitalité en wolof — et c\'est exactement ce que vous trouverez ici. Villa chaleureuse au cœur de Mbour, à 5 minutes de la plage, avec une magnifique cour intérieure et un jardin ombragé.',
                    'statut'      => 'validee',
                    'vedette'     => false,
                    'latitude'    => 14.3828,
                    'longitude'   => -16.9563,
                ],
                'photos'  => ['V4.jpg', 'V5.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Villa entière', 'capacite' => 10,
                        'description' => 'Maison complète avec 4 chambres, salon, cuisine équipée.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 150000, 'avec_clim' => true,  'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 120000, 'avec_clim' => true,  'avec_buffet' => false],
                        ],
                    ],
                    [
                        'type' => 'chambre', 'nom' => 'Chambre Prestige', 'capacite' => 2,
                        'description' => 'Chambre climatisée avec salle de bain privée.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee', 'prix' => 45000, 'avec_clim' => true, 'avec_buffet' => false],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 2, 'note' => 5, 'commentaire' => 'Accueil fantastique, propriétaire très disponible. Très propre et bien situé.'],
                    ['client' => 4, 'note' => 4, 'commentaire' => 'Belle villa, bonne situation. La cuisine est bien équipée.'],
                ],
            ],
            [
                'prop' => 0,
                'villa' => [
                    'nom'         => 'Villa des Palmiers',
                    'ville'       => 'Somone',
                    'adresse'     => 'Lagune de Somone, Route de Somone',
                    'telephone'   => '+221 77 100 11 03',
                    'description' => 'Nichée au bord de la lagune de Somone, cette villa d\'exception offre un panorama unique sur la réserve naturelle. Observation des oiseaux au lever du soleil, kayak dans la lagune, plage privée à 10 minutes.',
                    'statut'      => 'validee',
                    'vedette'     => true,
                    'latitude'    => 14.4744,
                    'longitude'   => -17.0236,
                ],
                'photos'  => ['V6.jpg', 'V7.jpg', 'V8.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Villa Lagune', 'capacite' => 8,
                        'description' => 'Villa complète face à la lagune, 3 chambres, terrasse panoramique.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 220000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 160000, 'avec_clim' => true, 'avec_buffet' => true],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 0, 'note' => 5, 'commentaire' => 'Un endroit magique ! La lagune est splendide, on se sent au bout du monde. Je recommande vivement.'],
                    ['client' => 5, 'note' => 5, 'commentaire' => 'Parfait pour se ressourcer. Calme, nature, beauté. La villa est superbement décorée.'],
                ],
            ],
            [
                'prop' => 0,
                'villa' => [
                    'nom'         => 'Villa Océan Bleu',
                    'ville'       => 'Saly',
                    'adresse'     => 'Saly Niakhniakhal, Bord de mer',
                    'telephone'   => '+221 77 100 11 04',
                    'description' => 'Directement sur la plage de Saly, la Villa Océan Bleu vous offre le réveil face à l\'Atlantique. Grande piscine, terrasse BBQ, accès direct à la mer.',
                    'statut'      => 'validee',
                    'vedette'     => false,
                    'latitude'    => 14.4615,
                    'longitude'   => -17.0138,
                ],
                'photos'  => ['V9.jpg', 'V10.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Villa complète', 'capacite' => 12,
                        'description' => 'Villa pieds dans l\'eau, 5 chambres, piscine, accès plage direct.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 320000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 250000, 'avec_clim' => true, 'avec_buffet' => true],
                        ],
                    ],
                    [
                        'type' => 'piscine', 'nom' => 'Piscine & Plage', 'capacite' => 30,
                        'description' => 'Journée piscine avec accès plage privée.',
                        'tarifs' => [
                            ['type_tarif' => 'journee',     'prix' => 45000, 'avec_clim' => false, 'avec_buffet' => false],
                            ['type_tarif' => 'demi_journee','prix' => 25000, 'avec_clim' => false, 'avec_buffet' => false],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 1, 'note' => 5, 'commentaire' => 'Vue mer imprenable, piscine magnifique. Nos enfants ont adoré.'],
                    ['client' => 3, 'note' => 4, 'commentaire' => 'Très bonne villa en bord de mer. Bien équipée et propre.'],
                ],
            ],
            [
                'prop' => 0,
                'villa' => [
                    'nom'         => 'Villa Almadies',
                    'ville'       => 'Dakar',
                    'adresse'     => 'Almadies, Route de la Corniche Ouest, Dakar',
                    'telephone'   => '+221 77 100 11 05',
                    'description' => 'Villa contemporaine dans le quartier chic des Almadies à Dakar. Design épuré, vue sur l\'Atlantique, à proximité des meilleurs restaurants et clubs de la capitale.',
                    'statut'      => 'validee',
                    'vedette'     => false,
                    'latitude'    => 14.7456,
                    'longitude'   => -17.5193,
                ],
                'photos'  => ['V11.jpg', 'V12.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Villa entière', 'capacite' => 8,
                        'description' => 'Maison de ville moderne, 3 chambres, rooftop avec vue mer.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 200000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 150000, 'avec_clim' => true, 'avec_buffet' => false],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 2, 'note' => 5, 'commentaire' => 'Location parfaite pour découvrir Dakar. Très bien équipée, quartier sûr.'],
                ],
            ],
            [
                'prop' => 0,
                'villa' => [
                    'nom'         => 'Villa Bel Horizon',
                    'ville'       => 'Saly',
                    'adresse'     => 'Saly Portugal, Route des Pêcheurs',
                    'telephone'   => '+221 77 100 11 06',
                    'description' => 'Perchée sur les hauteurs de Saly, la Villa Bel Horizon offre une vue à 180° sur l\'océan. Architecture coloniale rénovée, jardins luxuriants, piscine infinity.',
                    'statut'      => 'validee',
                    'vedette'     => false,
                    'latitude'    => 14.4543,
                    'longitude'   => -17.0071,
                ],
                'photos'  => ['V13.jpg', 'V14.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Villa Horizon', 'capacite' => 10,
                        'description' => 'Villa sur hauteur, 4 chambres, piscine infinity, terrasse panoramique.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 240000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 180000, 'avec_clim' => true, 'avec_buffet' => true],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 4, 'note' => 5, 'commentaire' => 'Vue époustouflante ! La piscine infinity face à la mer est un moment inoubliable.'],
                    ['client' => 0, 'note' => 4, 'commentaire' => 'Très belle villa avec une vue exceptionnelle. Le jardin est magnifique.'],
                ],
            ],
            [
                'prop' => 0,
                'villa' => [
                    'nom'         => 'Villa Sunugal',
                    'ville'       => 'Dakar',
                    'adresse'     => 'Fann Résidence, Dakar',
                    'telephone'   => '+221 77 100 11 07',
                    'description' => 'Au cœur de Dakar, dans le quartier résidentiel de Fann, cette villa familiale allie confort moderne et charme africain. Proche de la plage de Yoff et des sites touristiques.',
                    'statut'      => 'validee',
                    'vedette'     => false,
                    'latitude'    => 14.6928,
                    'longitude'   => -17.4467,
                ],
                'photos'  => ['V15.jpg', 'V17.jpg'],
                'logements' => [
                    [
                        'type' => 'appartement', 'nom' => 'Appartement Supérieur', 'capacite' => 4,
                        'description' => 'Appartement de standing, 2 chambres, salon, cuisine équipée.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 95000, 'avec_clim' => true,  'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 70000, 'avec_clim' => true,  'avec_buffet' => false],
                        ],
                    ],
                    [
                        'type' => 'chambre', 'nom' => 'Chambre Standard', 'capacite' => 2,
                        'description' => 'Chambre climatisée avec accès aux espaces communs.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee', 'prix' => 40000, 'avec_clim' => true, 'avec_buffet' => false],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 5, 'note' => 4, 'commentaire' => 'Très bon rapport qualité/prix pour Dakar. Propre et bien situé.'],
                ],
            ],

            // Propriétaire 2 — Fatou Ndiaye
            [
                'prop' => 1,
                'villa' => [
                    'nom'         => 'Villa Casamance',
                    'ville'       => 'Ziguinchor',
                    'adresse'     => 'Boucotte, Route de Kolda, Ziguinchor',
                    'telephone'   => '+221 77 200 22 01',
                    'description' => 'Au cœur de la Casamance verdoyante, cette villa est un havre de paix entouré de forêt tropicale. Rivière à proximité, pirogue disponible, cuisine casamançaise proposée. Un dépaysement total.',
                    'statut'      => 'validee',
                    'vedette'     => true,
                    'latitude'    => 12.5565,
                    'longitude'   => -16.2719,
                ],
                'photos'  => ['V18.jpg', 'V19.jpg', 'V20.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Villa forestière', 'capacite' => 12,
                        'description' => 'Villa en pleine nature, 5 chambres, terrasse en bois, hamacs.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 180000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 130000, 'avec_clim' => true, 'avec_buffet' => true],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 0, 'note' => 5, 'commentaire' => 'Expérience unique ! La forêt autour, les bruits de la nature, la quiétude absolue. Incroyable.'],
                    ['client' => 3, 'note' => 5, 'commentaire' => 'La Casamance est magnifique et cette villa en est le joyau. Je rêve d\'y retourner.'],
                ],
            ],
            [
                'prop' => 1,
                'villa' => [
                    'nom'         => 'Villa Cap Skirring',
                    'ville'       => 'Cap Skirring',
                    'adresse'     => 'Plage de Cap Skirring, Oussouye',
                    'telephone'   => '+221 77 200 22 02',
                    'description' => 'L\'une des plus belles plages d\'Afrique de l\'Ouest vous attend. La Villa Cap Skirring est posée directement sur le sable blanc, offrant un accès exclusif à 300 mètres de plage privée.',
                    'statut'      => 'validee',
                    'vedette'     => false,
                    'latitude'    => 12.3997,
                    'longitude'   => -16.7256,
                ],
                'photos'  => ['V21.jpg', 'V22.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Villa Balnéaire', 'capacite' => 16,
                        'description' => 'Grande villa de plage, 6 chambres, piscine, plage privée.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 350000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 280000, 'avec_clim' => true, 'avec_buffet' => true],
                        ],
                    ],
                    [
                        'type' => 'piscine', 'nom' => 'Plage & Piscine', 'capacite' => 40,
                        'description' => 'Accès journée à la plage privée et la piscine.',
                        'tarifs' => [
                            ['type_tarif' => 'journee',     'prix' => 55000, 'avec_clim' => false, 'avec_buffet' => false],
                            ['type_tarif' => 'demi_journee','prix' => 30000, 'avec_clim' => false, 'avec_buffet' => false],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 1, 'note' => 5, 'commentaire' => 'La plus belle villa que j\'ai eu la chance d\'habiter. Plage de rêve, service impeccable.'],
                    ['client' => 4, 'note' => 5, 'commentaire' => 'Cap Skirring est paradisiaque et cette villa est à son image. Parfait !'],
                ],
            ],
            [
                'prop' => 1,
                'villa' => [
                    'nom'         => 'Villa Keur Fatou',
                    'ville'       => 'Mbour',
                    'adresse'     => 'Thiambokh, Mbour',
                    'telephone'   => '+221 77 200 22 03',
                    'description' => 'Keur Fatou — "La maison de Fatou" en wolof — est une villa authentique décorée avec des œuvres d\'artisans sénégalais. Piscine, jardin fleuri, barbecue traditionnel.',
                    'statut'      => 'validee',
                    'vedette'     => false,
                    'latitude'    => 14.3900,
                    'longitude'   => -16.9647,
                ],
                'photos'  => ['V23.jpg', 'V24.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Keur Fatou complet', 'capacite' => 8,
                        'description' => 'Villa artisanale complète, 3 chambres, piscine, jardin.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 130000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 100000, 'avec_clim' => true, 'avec_buffet' => false],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 2, 'note' => 4, 'commentaire' => 'Villa chaleureuse avec une décoration superbe. Très authentique.'],
                    ['client' => 5, 'note' => 5, 'commentaire' => 'Endroit magnifique, plein de charme. La propriétaire est adorable.'],
                ],
            ],
            [
                'prop' => 1,
                'villa' => [
                    'nom'         => 'Villa du Fleuve',
                    'ville'       => 'Saint-Louis',
                    'adresse'     => "Île de Saint-Louis, Quai Roume",
                    'telephone'   => '+221 77 200 22 04',
                    'description' => 'Sur l\'île historique de Saint-Louis du Sénégal, classée au patrimoine mondial de l\'UNESCO, cette villa coloniale du XIXe siècle a été restaurée avec soin. Vue imprenable sur le fleuve Sénégal.',
                    'statut'      => 'validee',
                    'vedette'     => true,
                    'latitude'    => 16.0333,
                    'longitude'   => -16.5000,
                ],
                'photos'  => ['V25.jpg', 'V26.jpg', 'V27.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Demeure coloniale', 'capacite' => 10,
                        'description' => 'Maison coloniale classée, 4 chambres, terrasse fleuve, bibliothèque.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 190000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 140000, 'avec_clim' => true, 'avec_buffet' => true],
                        ],
                    ],
                    [
                        'type' => 'appartement', 'nom' => 'Suite Coloniale', 'capacite' => 3,
                        'description' => 'Suite indépendante avec vue sur le fleuve, parquet d\'époque.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee', 'prix' => 75000, 'avec_clim' => true, 'avec_buffet' => false],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 0, 'note' => 5, 'commentaire' => 'Saint-Louis est magique et cette villa est à la hauteur. Architecture coloniale préservée, vue sur le fleuve à couper le souffle.'],
                    ['client' => 3, 'note' => 5, 'commentaire' => 'Un voyage dans le temps ! La villa est superbement restaurée. Expérience unique.'],
                    ['client' => 5, 'note' => 4, 'commentaire' => 'Très beau séjour dans un cadre historique exceptionnel.'],
                ],
            ],
            [
                'prop' => 1,
                'villa' => [
                    'nom'         => 'Villa Lagune Enchantée',
                    'ville'       => 'Saly',
                    'adresse'     => 'Saly Tapé, Bord de Lagune',
                    'telephone'   => '+221 77 200 22 05',
                    'description' => 'Entre océan et lagune, ce petit paradis offre un panorama exceptionnel. Les flamants roses viennent parfois se nourrir à l\'aube dans la lagune. Kayaks disponibles pour explorer les mangroves.',
                    'statut'      => 'validee',
                    'vedette'     => false,
                    'latitude'    => 14.4687,
                    'longitude'   => -17.0145,
                ],
                'photos'  => ['V28.jpg', 'V29.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Villa vue lagune', 'capacite' => 8,
                        'description' => 'Villa 3 chambres face à la lagune, terrasse bois, kayaks inclus.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 175000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 130000, 'avec_clim' => true, 'avec_buffet' => false],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 1, 'note' => 5, 'commentaire' => 'Les flamants roses au lever du soleil, c\'est inoubliable. Villa superbe et propriétaire très sympa.'],
                    ['client' => 2, 'note' => 4, 'commentaire' => 'Très belle vue sur la lagune, endroit calme et reposant.'],
                ],
            ],
            [
                'prop' => 1,
                'villa' => [
                    'nom'         => 'Villa Toubab',
                    'ville'       => 'Toubab Dialaw',
                    'adresse'     => 'Village de Toubab Dialaw, Rufisque',
                    'telephone'   => '+221 77 200 22 06',
                    'description' => 'Dans le village d\'artistes de Toubab Dialaw, à une heure de Dakar, cette villa au style africain contemporain surplombe une falaise face à l\'Atlantique. Atelier d\'art sur place, balcon avec vue mer.',
                    'statut'      => 'validee',
                    'vedette'     => false,
                    'latitude'    => 14.6167,
                    'longitude'   => -17.2167,
                ],
                'photos'  => ['V30.jpg', 'V31.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Villa Artiste', 'capacite' => 6,
                        'description' => 'Villa sur falaise, 2 chambres, atelier d\'art, terrasse vue mer.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 145000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 110000, 'avec_clim' => true, 'avec_buffet' => false],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 4, 'note' => 5, 'commentaire' => 'Cadre inspirant, vue magnifique sur la falaise. Toubab Dialaw est un endroit à part.'],
                ],
            ],

            // Propriétaire 3 — Ibrahima Fall
            [
                'prop' => 2,
                'villa' => [
                    'nom'         => 'Villa Ngor Diambar',
                    'ville'       => 'Dakar',
                    'adresse'     => 'Île de Ngor, Dakar',
                    'telephone'   => '+221 77 300 33 01',
                    'description' => 'Sur l\'île de Ngor, accessible en pirogue depuis la plage de Ngor, cette villa offre une escapade unique à quelques minutes de Dakar. Plage préservée, eaux turquoise, ambiance insulaire garantie.',
                    'statut'      => 'validee',
                    'vedette'     => false,
                    'latitude'    => 14.7500,
                    'longitude'   => -17.5214,
                ],
                'photos'  => ['V32.jpg', 'V33.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Villa Île de Ngor', 'capacite' => 8,
                        'description' => 'Villa insulaire 3 chambres, vue 360°, accès plage privée.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 210000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 165000, 'avec_clim' => true, 'avec_buffet' => true],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 2, 'note' => 5, 'commentaire' => 'L\'île de Ngor est paradisiaque et la villa est parfaite. Arrivée en pirogue, c\'est magique !'],
                    ['client' => 5, 'note' => 5, 'commentaire' => 'Expérience insulaire unique à 10 minutes de Dakar. Incroyable.'],
                ],
            ],
            [
                'prop' => 2,
                'villa' => [
                    'nom'         => 'Villa Thiossane',
                    'ville'       => 'Dakar',
                    'adresse'     => 'Plateau, Avenue Pompidou, Dakar',
                    'telephone'   => '+221 77 300 33 02',
                    'description' => 'Thiossane (culture en wolof) — une villa qui célèbre l\'art et la culture sénégalaise. Au cœur du Plateau dakarois, design contemporain africain, toits-terrasses avec vue sur le port.',
                    'statut'      => 'validee',
                    'vedette'     => true,
                    'latitude'    => 14.6928,
                    'longitude'   => -17.4467,
                ],
                'photos'  => ['V34.jpg', 'V35.jpg', 'V36.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Penthouse Thiossane', 'capacite' => 6,
                        'description' => 'Duplex sur le toit du Plateau, 3 chambres, rooftop avec vue port.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 185000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 140000, 'avec_clim' => true, 'avec_buffet' => false],
                        ],
                    ],
                    [
                        'type' => 'appartement', 'nom' => 'Appartement Plateau', 'capacite' => 4,
                        'description' => 'Appartement moderne 2 chambres, quartier historique du Plateau.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee', 'prix' => 85000, 'avec_clim' => true, 'avec_buffet' => false],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 0, 'note' => 4, 'commentaire' => 'Vue sur le port du Plateau, superbe. Décoration soignée et propriétaire très attentionné.'],
                    ['client' => 1, 'note' => 5, 'commentaire' => 'Une villa comme nulle part ailleurs à Dakar. Art, culture, vue imprenable.'],
                ],
            ],
            [
                'prop' => 2,
                'villa' => [
                    'nom'         => 'Villa du Lac Rose',
                    'ville'       => 'Lac Rose',
                    'adresse'     => 'Bords du Lac Retba, Rufisque',
                    'telephone'   => '+221 77 300 33 03',
                    'description' => 'Face au Lac Rose (Lac Retba), classé au patrimoine mondial, cette villa offre un spectacle unique : l\'eau qui vire au rose selon la lumière du jour. Balade en pirogue, extraction du sel, dunes à explorer.',
                    'statut'      => 'validee',
                    'vedette'     => false,
                    'latitude'    => 14.8317,
                    'longitude'   => -17.2317,
                ],
                'photos'  => ['V37.jpg', 'V38.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Villa Lac Rose', 'capacite' => 8,
                        'description' => 'Villa face au lac, 3 chambres, terrasse panoramique, piscine.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 165000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 120000, 'avec_clim' => true, 'avec_buffet' => false],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 3, 'note' => 5, 'commentaire' => 'Le lac rose au coucher du soleil depuis la terrasse, c\'est un moment que je n\'oublierai jamais.'],
                    ['client' => 4, 'note' => 4, 'commentaire' => 'Endroit hors du commun ! La villa est confortable et bien équipée.'],
                ],
            ],
            [
                'prop' => 2,
                'villa' => [
                    'nom'         => 'Villa Yoff Plage',
                    'ville'       => 'Dakar',
                    'adresse'     => 'Village de Yoff, Dakar',
                    'telephone'   => '+221 77 300 33 04',
                    'description' => 'Dans le village lébou de Yoff, à Dakar, cette villa préserve l\'authenticité du quartier tout en offrant tout le confort moderne. Plage de Yoff à 200m, ambiance villageoise, couchers de soleil sur l\'Atlantique.',
                    'statut'      => 'validee',
                    'vedette'     => false,
                    'latitude'    => 14.7464,
                    'longitude'   => -17.4617,
                ],
                'photos'  => ['V39.jpg', 'V40.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Villa Yoff', 'capacite' => 6,
                        'description' => 'Villa lébou authentique, 2 chambres, cour intérieure, proche plage.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 110000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 85000,  'avec_clim' => true, 'avec_buffet' => false],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 5, 'note' => 4, 'commentaire' => 'Très authentique. On se sent vraiment dans le Sénégal profond tout en étant à Dakar.'],
                ],
            ],
            [
                'prop' => 2,
                'villa' => [
                    'nom'         => 'Villa Saint-Louis Patrimoine',
                    'ville'       => 'Saint-Louis',
                    'adresse'     => "Langue de Barbarie, Saint-Louis",
                    'telephone'   => '+221 77 300 33 05',
                    'description' => 'Sur la Langue de Barbarie, ce cordon sableux entre le fleuve Sénégal et l\'Atlantique, cette villa vous plonge dans l\'une des situations géographiques les plus spectaculaires du Sénégal.',
                    'statut'      => 'validee',
                    'vedette'     => false,
                    'latitude'    => 16.0167,
                    'longitude'   => -16.5117,
                ],
                'photos'  => ['V41.jpg', 'V42.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Villa Langue de Barbarie', 'capacite' => 8,
                        'description' => 'Villa entre fleuve et océan, 3 chambres, terrasse, accès pêche.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 155000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 115000, 'avec_clim' => true, 'avec_buffet' => false],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 1, 'note' => 5, 'commentaire' => 'Situation unique au monde, entre le fleuve et l\'Atlantique. Villa magnifique.'],
                    ['client' => 3, 'note' => 4, 'commentaire' => 'Saint-Louis est une ville hors du temps. La villa est charmante et bien tenue.'],
                ],
            ],
            [
                'prop' => 2,
                'villa' => [
                    'nom'         => 'Villa Calebasse',
                    'ville'       => 'Ziguinchor',
                    'adresse'     => 'Quartier Briqueterie, Ziguinchor',
                    'telephone'   => '+221 77 300 33 06',
                    'description' => 'Dans les rues ombragées de Ziguinchor, capitale de la Casamance, cette villa traditionnelle offre une immersion totale dans la culture diola. Cuisine casamançaise sur demande, musiques traditionnelles le soir.',
                    'statut'      => 'validee',
                    'vedette'     => false,
                    'latitude'    => 12.5632,
                    'longitude'   => -16.2784,
                ],
                'photos'  => ['V43.jpg', 'V44.jpg', 'V45.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Villa Calebasse', 'capacite' => 10,
                        'description' => 'Villa traditionnelle 4 chambres, cour ombrée, hammam, cuisine locale.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 140000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 105000, 'avec_clim' => true, 'avec_buffet' => true],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 0, 'note' => 5, 'commentaire' => 'Immersion culturelle totale ! La cuisine casamançaise proposée est délicieuse.'],
                    ['client' => 2, 'note' => 4, 'commentaire' => 'Villa authentique, bien tenue. Ziguinchor est une belle ville à découvrir.'],
                ],
            ],
            [
                'prop' => 2,
                'villa' => [
                    'nom'         => 'Villa Gorée Lumière',
                    'ville'       => 'Dakar',
                    'adresse'     => "Île de Gorée, face à Dakar",
                    'telephone'   => '+221 77 300 33 07',
                    'description' => 'Sur l\'île de Gorée, site du patrimoine mondial de l\'UNESCO, cette villa historique offre une expérience hors du commun. Ruelle sans voitures, maisons colorées, histoire et sérénité à 20 minutes de ferry de Dakar.',
                    'statut'      => 'validee',
                    'vedette'     => false,
                    'latitude'    => 14.6682,
                    'longitude'   => -17.3972,
                ],
                'photos'  => ['V46.jpg', 'V47.jpg', 'V48.jpg', 'V49.jpg', 'V50.jpg'],
                'logements' => [
                    [
                        'type' => 'villa_entiere', 'nom' => 'Maison de Gorée', 'capacite' => 6,
                        'description' => 'Maison coloniale sur l\'île de Gorée, 2 chambres, vue mer, patio.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee',  'prix' => 195000, 'avec_clim' => true, 'avec_buffet' => false],
                            ['type_tarif' => 'journee', 'prix' => 150000, 'avec_clim' => true, 'avec_buffet' => true],
                        ],
                    ],
                    [
                        'type' => 'chambre', 'nom' => 'Chambre Coloniale', 'capacite' => 2,
                        'description' => 'Chambre dans la maison historique, meubles d\'époque, vue sur la ruelle.',
                        'tarifs' => [
                            ['type_tarif' => 'nuitee', 'prix' => 65000, 'avec_clim' => true, 'avec_buffet' => false],
                        ],
                    ],
                ],
                'avis' => [
                    ['client' => 4, 'note' => 5, 'commentaire' => 'Gorée est unique au monde. Cette maison en est le cœur. Moment de grâce.'],
                    ['client' => 5, 'note' => 5, 'commentaire' => 'L\'île de Gorée sans voitures, sans bruit... et cette villa magnifique. Parfait.'],
                    ['client' => 2, 'note' => 5, 'commentaire' => 'Séjour inoubliable sur l\'île de Gorée. La villa est superbement restaurée.'],
                ],
            ],
        ];

        // ── Création des villas ───────────────────────────────────
        foreach ($data as $entry) {
            $prop = $props[$entry['prop']];

            $villa = Villa::create(array_merge($entry['villa'], ['user_id' => $prop->id]));

            // Photos
            foreach ($entry['photos'] as $i => $filename) {
                Photo::create([
                    'photoable_id'   => $villa->id,
                    'photoable_type' => Villa::class,
                    'url'            => rtrim(config('app.url'), '/') . "/storage/uploads/{$filename}",
                    'alt'            => $villa->nom,
                    'ordre'          => $i,
                ]);
            }

            // Logements + tarifs
            foreach ($entry['logements'] as $logData) {
                $tarifs = $logData['tarifs'];
                unset($logData['tarifs']);
                $logement = Logement::create(array_merge($logData, ['villa_id' => $villa->id]));
                foreach ($tarifs as $tarifData) {
                    Tarif::create(array_merge($tarifData, ['logement_id' => $logement->id]));
                }
            }

            // Avis
            foreach ($entry['avis'] as $avisData) {
                Avis::create([
                    'user_id'     => $clients[$avisData['client']]->id,
                    'villa_id'    => $villa->id,
                    'note'        => $avisData['note'],
                    'commentaire' => $avisData['commentaire'],
                ]);
            }
        }
    }

    /**
     * Crée un compte de démonstration sans jamais laisser derrière lui un mot
     * de passe que tout le monde peut lire.
     *
     * Ces comptes vivaient avec « password », écrit en clair dans un dépôt
     * public, et le peuplement rejoue à chaque déploiement. `admin@mavilla.sn`
     * donnait ainsi les pleins pouvoirs sur la production à quiconque lisait
     * ce fichier : valider des villas, supprimer des comptes, lire toutes les
     * réservations.
     *
     * Règle appliquée :
     *  — un mot de passe fourni par l'environnement fait foi, toujours ;
     *  — sinon, hors production, on garde « password », commode en local ;
     *  — sinon, on tire un secret que personne ne connaîtra. Le compte devient
     *    inaccessible, ce qui est le bon défaut : mieux vaut une porte fermée
     *    dont on a perdu la clé qu'une porte ouverte.
     *
     * Un compte existant n'est réécrit que s'il porte encore le mot de passe
     * historique — on ne casse jamais un secret déjà choisi par l'exploitant.
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
            $secret = app()->environment('production')
                ? Str::random(48)
                : self::MOT_DE_PASSE_HISTORIQUE;

            $utilisateur->password = Hash::make($secret);

            if (app()->environment('production')) {
                $this->command?->warn(
                    "  ! {$email} : mot de passe rendu inutilisable. "
                    .'Renseignez ADMIN_PASSWORD (compte admin) ou SEED_PASSWORD '
                    .'(comptes de démonstration) pour en fixer un.'
                );
            }
        }

        $utilisateur->save();

        return $utilisateur;
    }
}
