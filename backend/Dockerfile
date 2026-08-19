FROM php:8.4-cli

# gmp : nécessaire à `php artisan push:cles`, qui génère la paire VAPID.
# Sans elle, la génération échoue sur « Unable to create the key », un message
# qui ne nomme pas l'extension manquante.
#
# ⚠️ Elle n'est PAS requise pour *envoyer* une notification — vérifié le
# 19 août 2026, la signature aboutit sans elle. Elle est gardée pour que la
# paire puisse être régénérée depuis le serveur le jour où il le faudra.
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
