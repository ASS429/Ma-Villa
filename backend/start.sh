#!/bin/sh
set -e

cd /var/www

echo "==> Clearing config cache..."
php artisan config:clear
php artisan cache:clear

echo "==> Running migrations..."
php artisan migrate --force

echo "==> Creating storage link..."
php artisan storage:link 2>/dev/null || true

echo "==> Seeding database (first deploy only)..."
php artisan db:seed --force

echo "==> Starting server on port ${PORT:-10000}..."
exec php artisan serve --host=0.0.0.0 --port=${PORT:-10000}
