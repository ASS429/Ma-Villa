<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Le pendant sortant des reversements, côté client.
 *
 * La plateforme encaisse tout, puis rend parfois. Jusqu'ici le remboursement
 * se faisait entièrement hors de l'application — un geste dans le tableau de
 * bord PayDunya, dont rien ne gardait trace. Trois conséquences, toutes
 * vérifiées dans le code avant d'écrire cette table :
 *
 *   — le chiffre d'affaires restait faux, `encaisse` sommant tous les
 *     paiements aboutis sans retrancher ce qui a été rendu ;
 *   — plus rien ne distinguait, un mois plus tard, une réservation remboursée
 *     d'une simple annulation ;
 *   — et si le propriétaire avait **déjà** été payé, la somme était perdue
 *     sans que rien ne le signale.
 *
 * Comme `reversements`, cette table **enregistre** ; elle ne déclenche rien.
 * Le virement de retour reste un geste humain chez le prestataire, tant que
 * l'option de déboursement n'est pas ouverte.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('remboursements', function (Blueprint $table) {
            $table->id();

            // Le paiement remboursé. `cascadeOnDelete` serait une faute : on
            // ne supprime pas un paiement, et si cela arrivait, la trace du
            // remboursement devrait survivre pour la comptabilité.
            $table->foreignId('paiement_id')->constrained()->restrictOnDelete();
            $table->foreignId('reservation_id')->constrained()->restrictOnDelete();

            $table->decimal('montant', 12, 2);

            /*
             | À qui l'annulation est imputable — ce qui décide du montant.
             |
             | La plateforme ou le propriétaire : remboursement intégral,
             | commission comprise. Le client n'a pas à payer notre
             | défaillance. Le client lui-même : le barème s'applique, et la
             | commission reste acquise au service rendu.
             */
            $table->enum('impute_a', ['plateforme', 'proprietaire', 'client']);

            // Vrai quand la commission a été rendue elle aussi. Stocké plutôt
            // que déduit : le barème changera, l'écriture passée ne doit pas
            // changer avec lui.
            $table->boolean('commission_rendue')->default(false);

            $table->text('motif');

            // La référence chez le prestataire, quand l'exploitant la reporte.
            // Sans elle, rapprocher un remboursement d'une ligne de relevé
            // demande de chercher par montant et par date.
            $table->string('reference')->nullable();

            /*
             | Ce que le propriétaire doit rendre, quand il avait déjà été payé.
             |
             | L'écran prévient mais laisse passer : refuser n'aiderait pas,
             | l'argent étant déjà sorti dans la réalité. Reste à savoir
             | combien on doit récupérer, et auprès de qui.
             */
            $table->decimal('a_recuperer_proprietaire', 12, 2)->default(0);

            $table->foreignId('cree_par')->nullable()->constrained('users')->nullOnDelete();
            $table->string('createur_nom')->nullable();

            $table->timestamps();

            // Un paiement peut être remboursé partiellement puis complété :
            // pas d'unicité, mais un index pour sommer ce qui a été rendu.
            $table->index('paiement_id');
            $table->index('reservation_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('remboursements');
    }
};
