# Version épinglée, pas « 8.4-cli » : PHP2Shell (CVE-2026-109618 et
# CVE-2026-109619, exécution de code à distance sans authentification) est
# corrigé en 8.4.27, publié le 21 octobre 2026. L'image construite le 20 servait
# 8.4.26. Une étiquette mouvante peut ressortir d'un cache de construction ; une
# version écrite ne le peut pas. À monter à chaque correctif de sécurité.
FROM php:8.4.27-cli

# Durcissement, en plus du correctif :
#  — session.upload_progress.enabled : le chemin d'attaque confirmé de la
#    CVE-2026-109619. Laravel ne se sert pas des sessions natives de PHP ; le
#    couper ne retire rien au site ;
#  — expose_php : l'API annonçait « x-powered-by: PHP/8.4.26 » à chaque réponse,
#    de quoi désigner les serveurs pas encore à jour.
RUN printf 'session.upload_progress.enabled = 0\nexpose_php = Off\n' \
        > /usr/local/etc/php/conf.d/zz-durcissement.ini

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
