#!/bin/sh
set -e

cd /var/www

echo "==> Nettoyage du cache de configuration..."
php artisan config:clear
php artisan cache:clear

echo "==> Migrations..."
php artisan migrate --force

echo "==> Lien de stockage..."
php artisan storage:link 2>/dev/null || true

echo "==> Peuplement initial (ignoré si des villas existent déjà)..."
php artisan db:seed --force

# Les notifications (nouvelle réservation, confirmation, réinitialisation de mot
# de passe) implémentent ShouldQueue. Sans ce worker, elles s'empilent dans la
# table `jobs` et ne partent jamais — sans la moindre erreur visible.
#
# La boucle relance le worker s'il s'arrête ; --max-time le recycle chaque heure
# pour éviter toute dérive mémoire sur un processus de longue durée.
echo "==> Démarrage du worker de file d'attente..."
while true; do
    php artisan queue:work --tries=3 --sleep=3 --max-time=3600 --quiet || true
    echo "[queue] worker arrêté, redémarrage dans 5s"
    sleep 5
done &

echo "==> Diagnostic d'infrastructure..."
php artisan mavilla:diagnostic || true

echo "==> Démarrage du serveur sur le port ${PORT:-10000}..."
exec php artisan serve --host=0.0.0.0 --port=${PORT:-10000}
