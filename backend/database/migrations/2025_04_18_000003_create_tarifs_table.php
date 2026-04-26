<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tarifs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('logement_id')->constrained()->cascadeOnDelete();
            $table->enum('type_tarif', ['journee', 'nuitee', 'demi_journee', 'pass']);
            $table->boolean('avec_clim')->default(false);
            $table->boolean('avec_buffet')->default(false);
            $table->decimal('prix', 10, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tarifs');
    }
};
