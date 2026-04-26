<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('logements', function (Blueprint $table) {
            $table->boolean('disponible')->default(true)->after('capacite');
        });
    }

    public function down(): void
    {
        Schema::table('logements', function (Blueprint $table) {
            $table->dropColumn('disponible');
        });
    }
};
