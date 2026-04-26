<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\Villa;
use Illuminate\Database\Eloquent\Factories\Factory;

class VillaFactory extends Factory
{
    protected $model = Villa::class;

    public function definition(): array
    {
        return [
            'user_id'     => User::factory()->proprietaire(),
            'nom'         => fake()->words(3, true),
            'description' => fake()->paragraph(),
            'adresse'     => fake()->streetAddress(),
            'ville'       => fake()->randomElement(['Dakar', 'Saly', 'Mbour', 'Ziguinchor']),
            'telephone'   => '+221 77 000 00 00',
            'statut'      => 'en_attente',
            'vedette'     => false,
        ];
    }

    public function validee(): static
    {
        return $this->state(['statut' => 'validee']);
    }

    public function rejetee(): static
    {
        return $this->state(['statut' => 'rejetee']);
    }
}
