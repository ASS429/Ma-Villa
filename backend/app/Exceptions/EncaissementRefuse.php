<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Un règlement qui ne peut pas s'écrire, et pourquoi. Levée dans la transaction : rien de ce
 * qui avait commencé ne reste, et le message part tel quel à l'écran.
 */
class EncaissementRefuse extends RuntimeException
{
    /** @param array<string, mixed> $details */
    public function __construct(string $message, private readonly int $statut = 422, private readonly array $details = [])
    {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()] + $this->details, $this->statut);
    }
}
