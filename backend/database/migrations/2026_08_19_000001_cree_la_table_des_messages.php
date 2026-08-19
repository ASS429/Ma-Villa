<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Messagerie entre le client et le propriétaire.
 *
 * Il n'y a pas de table « conversation » : **la réservation est la
 * conversation**. Elle porte déjà les deux interlocuteurs — le client par
 * `user_id`, le propriétaire par `logement.villa.user_id` — et la règle d'accès
 * existe déjà dans `ReservationPolicy`. Ajouter un fil séparé aurait dupliqué
 * cette autorisation à un second endroit, avec le risque que les deux divergent.
 *
 * Conséquence assumée, et c'est un choix produit : on ne s'écrit qu'après avoir
 * réservé. Un contact libre depuis la fiche convertirait sans doute mieux, mais
 * rien n'empêcherait alors d'échanger un numéro et de conclure hors plateforme —
 * la commission s'évaporerait.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();

            $table->foreignId('reservation_id')->constrained()->cascadeOnDelete();

            // L'auteur. `nullOnDelete` et non `cascade` : un compte supprimé ne
            // doit pas trouer la conversation de l'autre partie, qui perdrait
            // le fil d'un litige en cours.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $table->text('corps');

            // Lu par le destinataire, pas par l'auteur. Nul tant qu'il ne l'a
            // pas ouvert : c'est ce qui alimente la pastille « non lus ».
            $table->timestamp('lu_le')->nullable();

            $table->timestamps();

            // Tout affichage part de « les messages de cette réservation, dans
            // l'ordre » ; tout compteur part de « non lus qui ne sont pas de moi ».
            $table->index(['reservation_id', 'created_at']);
            $table->index(['reservation_id', 'lu_le']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
