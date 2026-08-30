<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Boutique d'œuvres d'art — second métier de la plateforme.
 *
 * Décidée le 12 août 2026. Trois arbitrages, pris le 20 août, décident de tout
 * ce schéma :
 *
 * 1. **PasseTemps est le seul vendeur.** Pas de rôle « artiste », pas de
 *    modération, pas de commission ni de reversement : l'argent d'une vente
 *    revient entièrement à la plateforme. L'artiste est donc une **information
 *    portée par l'œuvre**, pas un compte.
 * 2. **Une œuvre par commande.** Une pièce est unique — l'exemplaire vendu ne
 *    peut plus l'être. Un panier n'aurait servi qu'à gérer des conflits de
 *    stock sur des articles qui n'en ont pas.
 * 3. **Frais de livraison par zone.** Le client connaît son total avant de
 *    payer, ce qui est la moitié de la confiance sur un premier achat.
 *
 * La commande porte son propre paiement plutôt que de réutiliser la table
 * `paiements` : celle-ci charrie commission, part du propriétaire et
 * rattachement à un reversement, qui n'ont aucun sens ici. Les y greffer
 * aurait rendu nullable ce qui doit rester obligatoire pour une réservation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('oeuvres', function (Blueprint $table) {
            $table->id();

            $table->string('titre');
            $table->string('artiste');
            $table->text('description')->nullable();

            // Ce qu'un acheteur d'art regarde avant le prix. Libres plutôt
            // qu'énumérés : « acrylique sur toile » et « bogolan » ne se
            // rangent pas dans la même liste, et une liste fermée obligerait
            // à migrer à chaque nouvelle technique.
            $table->string('technique')->nullable();
            $table->string('dimensions')->nullable();
            $table->unsignedSmallInteger('annee')->nullable();

            $table->unsignedInteger('prix');

            /*
             | `vendue` est un état, pas une suppression : la fiche reste
             | consultable et indexée. Une galerie qui efface ce qu'elle a
             | vendu perd la preuve qu'elle vend.
             */
            $table->enum('statut', ['brouillon', 'publiee', 'vendue'])->default('brouillon');

            $table->boolean('vedette')->default(false);

            $table->timestamps();

            // Toute vitrine part de « les œuvres publiées, les plus récentes
            // d'abord » ; la mise en avant se lit dans la foulée.
            $table->index(['statut', 'created_at']);
            $table->index(['statut', 'vedette']);
        });

        Schema::create('commandes', function (Blueprint $table) {
            $table->id();

            // L'acheteur est relié **et** recopié, comme dans le journal
            // d'audit et les reversements : un compte supprimé ne doit pas
            // effacer la trace d'une vente ni son adresse de livraison.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            // `restrictOnDelete` : on ne supprime pas une œuvre qui a été
            // vendue. La commande perdrait son objet, et la comptabilité avec.
            $table->foreignId('oeuvre_id')->constrained()->restrictOnDelete();

            // Le titre, l'artiste et le prix sont figés à la commande. Un
            // changement de prix ne doit jamais réécrire une vente passée —
            // même raisonnement que la répartition figée des paiements.
            $table->string('oeuvre_titre');
            $table->string('oeuvre_artiste');
            $table->unsignedInteger('montant_oeuvre');

            $table->string('zone_livraison');
            $table->unsignedInteger('frais_livraison');
            $table->unsignedInteger('montant_total');

            // Coordonnées de livraison, saisies à la commande. Recopiées et
            // non lues depuis le compte : une adresse de compte change, une
            // adresse de livraison est celle du jour de l'expédition.
            $table->string('destinataire');
            $table->string('telephone');
            $table->text('adresse');
            $table->string('ville');
            $table->text('note')->nullable();

            /*
             | Deux façons de payer, décidées le 12 août.
             |
             | `livraison` n'est pas un paiement en attente : c'est un accord
             | de payer plus tard, en main propre. La commande est donc
             | valable sans qu'un franc ait transité, et c'est la livraison
             | qui solde.
             */
            $table->enum('mode_paiement', ['en_ligne', 'livraison']);
            $table->enum('statut_paiement', ['en_attente', 'reussi', 'echoue'])->default('en_attente');

            /*
             | Le cycle de vie, du point de vue de l'acheteur.
             |
             | `en_attente` couvre aussi bien un paiement en ligne inachevé
             | qu'une commande à régler à la livraison : dans les deux cas,
             | rien n'est encore parti.
             */
            $table->enum('statut', ['en_attente', 'confirmee', 'expediee', 'livree', 'annulee'])
                  ->default('en_attente');

            // PayDunya, quand le règlement est en ligne. Mêmes champs que pour
            // une réservation, mêmes raisons : le jeton identifie la facture
            // pour toute sa vie, et c'est avec lui qu'on relit le statut réel.
            $table->string('reference')->nullable();
            $table->string('token_paydunya')->nullable();
            $table->string('url_paiement')->nullable();
            $table->string('url_application')->nullable();
            $table->json('reponse_prestataire')->nullable();
            $table->timestamp('paye_le')->nullable();

            $table->timestamp('expediee_le')->nullable();
            $table->timestamp('livree_le')->nullable();

            $table->timestamps();

            $table->index('token_paydunya');
            $table->index(['statut', 'created_at']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commandes');
        Schema::dropIfExists('oeuvres');
    }
};
