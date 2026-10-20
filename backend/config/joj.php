<?php

/*
|--------------------------------------------------------------------------
| JOJ Dakar 2026 — la vitrine temporaire
|--------------------------------------------------------------------------
|
| Une page et un bandeau pour les familles des athlètes, du 31 octobre au
| 13 novembre 2026. **Temporaire par décision de l'exploitant** : après les
| Jeux, tout ce qui porte « JOJ » quitte la plateforme. D'où une variable à
| part, et du code rangé à part (`Ma-Villa/src/joj/`) — la liste de ce qu'il
| faut retirer est dans `docs/16-RETRAIT-JOJ.md`.
|
| Les services qu'elle met en avant (transport, repas) ne lui appartiennent
| pas : ils ont leurs propres variables et lui survivent.
|
*/

return [

    'actif' => (bool) env('JOJ_ACTIF', false),

];
