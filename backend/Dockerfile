FROM php:8.4-cli

# gmp : exigé par la crypto VAPID des notifications poussées (courbe P-256).
# Sans elle, `php artisan push:cles` et tout envoi échouent sur
# « Unable to create the key », sans que rien ne désigne l'extension manquante.
RUN apt-get update && apt-get install -y \
        git curl libpng-dev libonig-dev libxml2-dev zip unzip libpq-dev libgmp-dev \
    && docker-php-ext-install pdo pdo_pgsql pdo_mysql mbstring exif pcntl bcmath gd gmp \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

COPY . .

RUN composer install --no-dev --optimize-autoloader \
    && chmod -R 775 storage bootstrap/cache

COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 10000

CMD ["/start.sh"]
