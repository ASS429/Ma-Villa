<?php

namespace Database\Seeders;

use App\Models\Oeuvre;
use Illuminate\Database\Seeder;

/**
 * Catalogue de démonstration de la boutique.
 *
 * Dix-neuf articles d'artisanat sénégalais, répartis sur les sept catégories.
 * Les photographies sont servies depuis `public/oeuvres/` du front : ce sont
 * des fichiers du dépôt, pas des téléversements — un catalogue de démonstration
 * ne doit pas dépendre du stockage distant pour s'afficher.
 *
 * Les chemins sont **relatifs**. Une URL absolue serait à réécrire le jour du
 * nom de domaine, alors que `/oeuvres/x.jpg` suit le site où qu'il aille.
 *
 * Idempotent : le titre sert de clé, relancer ne duplique rien.
 *
 *     php artisan db:seed --class=BoutiqueSeeder
 *
 * ⚠️ Les prix et les noms d'artisans sont **fictifs**, posés pour donner à voir
 * une boutique vivante. À remplacer par le vrai catalogue avant l'ouverture.
 */
class BoutiqueSeeder extends Seeder
{
    /**
     * Le stock dit la nature de l'article, et rien d'autre ne le dit.
     *
     * 1 = pièce unique : le tableau, le tam-tam, le lot de figurines. Commander
     * la retire de la vente, exactement comme au premier jour de la boutique.
     * Au-delà = série : commander en retire un exemplaire.
     */
    private const ARTICLES = [

        /* ── Tableaux ─────────────────────────────────────────────── */
        [
            'image' => 'day-in-life.jpg',
            'titre' => 'Un jour à Ngor',
            'artiste' => 'Awa Diop',
            'categorie' => 'tableaux',
            'technique' => 'Acrylique sur toile',
            'dimensions' => '70 × 120 cm',
            'annee' => 2025,
            'prix' => 285000,
            'stock' => 1,
            'vedette' => true,
            'description' => "Une scène de vie saisie au petit matin sur l'île de Ngor : les pirogues rentrent, les femmes attendent la pêche. Awa Diop peint la lumière du Cap-Vert en aplats francs, sans esquisse préalable. Toile montée sur châssis, prête à accrocher.",
        ],

        /* ── Sculptures et instruments ────────────────────────────── */
        [
            'image' => 'figurines.jpg',
            'titre' => 'Trio de figurines en bois de caïlcédrat',
            'artiste' => 'Ousmane Sow',
            'categorie' => 'sculptures',
            'technique' => 'Bois sculpté à la main',
            'dimensions' => '18 à 32 cm de haut',
            'annee' => 2025,
            'prix' => 62000,
            'stock' => 1,
            'description' => "Trois silhouettes taillées dans un seul bloc de caïlcédrat, poncées puis cirées à la main. Le grain du bois est laissé visible : deux pièces ne se ressemblent jamais tout à fait. Vendues ensemble.",
        ],
        [
            'image' => 'tamtam.jpg',
            'titre' => 'Sabar traditionnel',
            'artiste' => 'Modou Gueye',
            'categorie' => 'sculptures',
            'technique' => 'Bois de dimb, peau de chèvre, cordes tendues',
            'dimensions' => '52 cm de haut, 28 cm de diamètre',
            'annee' => 2026,
            'prix' => 95000,
            'stock' => 1,
            'vedette' => true,
            'description' => "Le sabar accompagne les cérémonies wolof depuis des siècles. Celui-ci est monté à l'ancienne : peau de chèvre tendue par des chevilles de bois, sans colle ni vis. Il se joue à la main et à la baguette. Accordé avant expédition.",
        ],

        /* ── Bijoux et montres ────────────────────────────────────── */
        [
            'image' => 'bracelets.jpg',
            'titre' => 'Bracelets en perles de Krobo',
            'artiste' => 'Coumba Sarr',
            'categorie' => 'bijoux',
            'technique' => 'Perles de verre recyclé, fil de coton ciré',
            'dimensions' => 'Tour de poignet ajustable',
            'annee' => 2026,
            'prix' => 9000,
            'stock' => 24,
            'description' => "Perles de verre recyclé enfilées à la main sur coton ciré. Le fermoir coulissant s'ajuste à tous les poignets. Vendus par trois, coloris assortis — les nuances varient d'un lot à l'autre, c'est la marque du verre recyclé.",
        ],
        [
            'image' => 'colliers.jpg',
            'titre' => 'Colliers plastron en cauris',
            'artiste' => 'Coumba Sarr',
            'categorie' => 'bijoux',
            'technique' => 'Cauris, perles de laiton, cordon tressé',
            'dimensions' => 'Plastron de 22 cm, cordon réglable',
            'annee' => 2026,
            'prix' => 18500,
            'stock' => 8,
            'description' => "Le cauris a longtemps servi de monnaie sur la côte ; il se porte aujourd'hui en parure. Chaque plastron est monté sur un cordon tressé main, avec des perles de laiton fondu à Dakar.",
        ],
        [
            'image' => 'montre.jpg',
            'titre' => 'Montre à bracelet en cuir tressé',
            'artiste' => 'Cheikh Diallo',
            'categorie' => 'bijoux',
            'technique' => 'Cuir de chèvre tanné, boîtier acier',
            'dimensions' => 'Boîtier 40 mm',
            'annee' => 2026,
            'prix' => 42000,
            'stock' => 6,
            'description' => "Bracelet tressé main dans du cuir de chèvre tanné à Ngaye Mékhé, monté sur un boîtier acier à mouvement quartz. Le cuir se patine à l'usage et prend la couleur de celui qui le porte.",
        ],

        /* ── Vêtements ────────────────────────────────────────────── */
        [
            'image' => 'chemise.jpg',
            'titre' => 'Chemise en wax, coupe droite',
            'artiste' => 'Aïssatou Ndiaye',
            'categorie' => 'vetements',
            'technique' => 'Wax imprimé, coton 100 %',
            'dimensions' => 'Tailles S à XXL',
            'annee' => 2026,
            'prix' => 27000,
            'stock' => 15,
            'description' => "Coupe droite, col ouvert, poche poitrine. Taillée dans un wax épais qui tient au lavage. Précisez votre taille dans la note de commande — à défaut, nous vous écrivons avant l'expédition.",
        ],
        [
            'image' => 'manteau.jpg',
            'titre' => 'Manteau long en bogolan',
            'artiste' => 'Aïssatou Ndiaye',
            'categorie' => 'vetements',
            'technique' => 'Bogolan teint à la boue, doublure coton',
            'dimensions' => 'Tailles M à XL',
            'annee' => 2025,
            'prix' => 78000,
            'stock' => 4,
            'vedette' => true,
            'description' => "Le bogolan est teint à la boue fermentée puis séché au soleil : chaque pièce a ses irrégularités, et c'est ce qui la distingue d'un imprimé industriel. Manteau long, doublé, deux poches latérales.",
        ],
        [
            'image' => 'pantalon.jpg',
            'titre' => 'Pantalon large en coton tissé',
            'artiste' => 'Modou Gueye',
            'categorie' => 'vetements',
            'technique' => 'Coton tissé à la main, taille élastiquée',
            'dimensions' => 'Tailles S à XL',
            'annee' => 2026,
            'prix' => 23000,
            'stock' => 12,
            'description' => "Coton tissé sur métier à bandes, assemblé en pantalon large à taille élastiquée. Il respire, il sèche vite, il se porte toute l'année sous ce climat.",
        ],

        /* ── Coiffes et chapeaux ──────────────────────────────────── */
        [
            'image' => 'chapeau-peulh.jpg',
            'titre' => 'Chapeau peulh en paille tressée',
            'artiste' => 'Fatou Cissé',
            'categorie' => 'coiffes',
            'technique' => 'Paille tressée, cuir teint',
            'dimensions' => 'Diamètre 46 cm',
            'annee' => 2026,
            'prix' => 32000,
            'stock' => 5,
            'description' => "La coiffe des bergers peulhs, large de bord pour couvrir les épaules. Paille tressée serrée, renforts de cuir teint aux quatre points cardinaux. Se porte, se pose au mur, fait les deux.",
        ],
        [
            'image' => 'chapeau-guerrier.jpg',
            'titre' => 'Coiffe cérémonielle à cauris',
            'artiste' => 'Fatou Cissé',
            'categorie' => 'coiffes',
            'technique' => 'Cuir, cauris, fils de laine',
            'dimensions' => 'Taille unique',
            'annee' => 2025,
            'prix' => 48000,
            'stock' => 2,
            'description' => "Coiffe de cérémonie, montée sur cuir et cousue de cauris. Portée lors des luttes traditionnelles et des fêtes de village. Pièce d'apparat, à manipuler avec soin.",
        ],
        [
            'image' => 'chapeau-simple.jpg',
            'titre' => 'Bonnet brodé, coton léger',
            'artiste' => 'Fatou Cissé',
            'categorie' => 'coiffes',
            'technique' => 'Coton brodé main',
            'dimensions' => 'Tour de tête 56 à 60 cm',
            'annee' => 2026,
            'prix' => 11000,
            'stock' => 20,
            'description' => "Bonnet de coton léger, broderie faite à l'aiguille. Celui qu'on met tous les jours, qui se lave et se replie dans une poche.",
        ],

        /* ── Sacs et chaussures ───────────────────────────────────── */
        [
            'image' => 'sacs-et-paniers.jpg',
            'titre' => 'Paniers en osier, lot de trois tailles',
            'artiste' => 'Mariama Bâ',
            'categorie' => 'maroquinerie',
            'technique' => 'Osier tressé, anses de cuir',
            'dimensions' => '24, 32 et 40 cm de diamètre',
            'annee' => 2026,
            'prix' => 34000,
            'stock' => 7,
            'description' => "Trois paniers qui s'emboîtent, tressés en osier à Thiès et finis d'anses de cuir. Ils servent au marché, au linge, ou simplement à ranger. Vendus ensemble.",
        ],
        [
            'image' => 'sandales-femme.jpg',
            'titre' => 'Sandales en cuir tressé',
            'artiste' => 'Cheikh Diallo',
            'categorie' => 'maroquinerie',
            'technique' => 'Cuir de chèvre, semelle cousue main',
            'dimensions' => 'Pointures 36 à 42',
            'annee' => 2026,
            'prix' => 21000,
            'stock' => 18,
            'description' => "Lanières de cuir tressées, semelle cousue à la main — aucune colle. Le cuir s'assouplit en quelques jours et prend la forme du pied. Précisez votre pointure à la commande.",
        ],
        [
            'image' => 'ensemble-sac-sandales-chapeau-femme.jpg',
            'titre' => 'Ensemble sac, sandales et chapeau',
            'artiste' => 'Mariama Bâ',
            'categorie' => 'maroquinerie',
            'technique' => 'Raphia tressé, cuir, coton',
            'dimensions' => 'Sandales 36 à 41, chapeau taille unique',
            'annee' => 2026,
            'prix' => 68000,
            'stock' => 3,
            'vedette' => true,
            'description' => "Le sac, les sandales et le chapeau assortis, tressés dans le même raphia et finis du même cuir. Pensé pour les journées de plage à Saly. Précisez la pointure à la commande.",
        ],

        /* ── Tissus et décoration ─────────────────────────────────── */
        [
            'image' => 'tissus.jpg',
            'titre' => 'Pagnes tissés, lot de quatre',
            'artiste' => 'Ibrahima Fall',
            'categorie' => 'textiles',
            'technique' => 'Coton tissé sur métier à bandes',
            'dimensions' => '160 × 110 cm chacun',
            'annee' => 2026,
            'prix' => 45000,
            'stock' => 6,
            'description' => "Quatre pagnes tissés bande par bande puis assemblés, selon la technique des tisserands manjaques. Ils se portent, se posent sur un lit, s'accrochent au mur. Motifs assortis, jamais identiques.",
        ],
        [
            'image' => 'eventail-femme.jpg',
            'titre' => 'Éventail en paille et cuir',
            'artiste' => 'Mariama Bâ',
            'categorie' => 'textiles',
            'technique' => 'Paille tressée, manche de cuir',
            'dimensions' => '38 × 26 cm',
            'annee' => 2026,
            'prix' => 9500,
            'stock' => 22,
            'description' => "L'éventail qu'on trouve dans toutes les maisons, tressé serré pour brasser l'air sans se déformer. Manche gainé de cuir, cousu main.",
        ],
        [
            'image' => 'peigne.jpg',
            'titre' => 'Peigne sculpté en ébène',
            'artiste' => 'Ousmane Sow',
            'categorie' => 'textiles',
            'technique' => 'Ébène sculpté et poli',
            'dimensions' => '22 cm',
            'annee' => 2025,
            'prix' => 14000,
            'stock' => 9,
            'description' => "Peigne à dents larges taillé dans un bloc d'ébène, tête sculptée d'un motif géométrique. Il démêle sans casser, et se transmet.",
        ],
        [
            'image' => 'parapluie.jpg',
            'titre' => 'Ombrelle en tissu wax',
            'artiste' => 'Aïssatou Ndiaye',
            'categorie' => 'textiles',
            'technique' => 'Wax doublé, armature bois',
            'dimensions' => 'Diamètre 98 cm',
            'annee' => 2026,
            'prix' => 19000,
            'stock' => 10,
            'description' => "Une ombrelle plus qu'un parapluie : le wax doublé arrête le soleil, l'armature de bois se replie en trois. De quoi traverser midi sans chercher l'ombre.",
        ],
    ];

    public function run(): void
    {
        foreach (self::ARTICLES as $article) {
            $image = $article['image'];
            unset($article['image']);

            $oeuvre = Oeuvre::firstOrCreate(
                ['titre' => $article['titre']],
                $article + ['statut' => 'publiee'],
            );

            // Une seule photo par article : c'est ce dont on dispose. La
            // rattacher seulement si elle manque, pour que relancer le
            // peuplement ne crée pas de doublons.
            if ($oeuvre->photos()->count() === 0) {
                $oeuvre->photos()->create([
                    'url'   => "/oeuvres/{$image}",
                    'alt'   => "{$oeuvre->titre}, {$oeuvre->artiste}",
                    'ordre' => 0,
                ]);
            }
        }

        $this->command?->info(count(self::ARTICLES).' articles en boutique.');
    }
}
