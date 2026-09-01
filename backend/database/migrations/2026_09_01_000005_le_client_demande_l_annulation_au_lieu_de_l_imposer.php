<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Une réservation payée ne s'annule plus d'un clic.
 *
 * Le client pouvait annuler seul, à tout moment, y compris la veille de
 * l'arrivée et y compris après avoir payé. Trois choses en découlaient :
 * il attendait son argent sans qu'aucune règle ne dise combien, l'exploitant
 * découvrait l'annulation après coup, et le propriétaire pouvait avoir été
 * payé entre-temps.
 *
 * ⚠️ **Une demande n'est pas un statut.** La réservation reste `confirmee`
 * tant que la décision n'est pas prise, et c'est voulu : les dates doivent
 * rester bloquées. Les libérer à la demande laisserait un second client
 * réserver un séjour qu'on n'a pas encore décidé d'annuler — et il faudrait
 * alors annuler deux fois.
 *
 * D'où un horodatage plutôt qu'une valeur d'énumération de plus : rien de ce
 * qui filtre sur `statut` ne change de comportement, et la demande se lit
 * partout où on veut l'afficher.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->timestamp('annulation_demandee_le')->nullable()->after('statut');
            $table->text('annulation_motif')->nullable()->after('annulation_demandee_le');

            // La file de travail de l'administration les cherche par ce champ.
            $table->index('annulation_demandee_le');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropIndex(['annulation_demandee_le']);
            $table->dropColumn(['annulation_demandee_le', 'annulation_motif']);
        });
    }
};
