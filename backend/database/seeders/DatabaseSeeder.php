<?php

namespace Database\Seeders;

use App\Models\Villa;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (Villa::count() > 0) {
            $this->command->info('Base déjà peuplée, seeding ignoré.');
            return;
        }
        $this->call(VillaSeeder::class);
    }
}
