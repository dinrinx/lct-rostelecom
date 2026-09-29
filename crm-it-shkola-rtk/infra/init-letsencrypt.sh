#!/usr/bin/env bash
# Первичный выпуск Let's Encrypt сертификата для itschool-rtk-supremum.ru.
#
# Запускать ОДИН РАЗ на самом сервере (не локально), из папки infra/, после
# того как DNS домена уже указывает на IP этого сервера и docker compose
# конфиг (nginx-сервис) добавлен. Дальше продление берёт на себя сервис
# certbot в docker-compose.yml (сам крутится и раз в 12 часов пробует renew).
#
# Как работает: nginx не может стартовать со ссылкой на сертификат, которого
# ещё нет на диске, поэтому сначала кладём фиктивный self-signed сертификат
# ("dummy"), поднимаем nginx (он уже способен отвечать на ACME-challenge по
# HTTP), просим настоящий сертификат у Let's Encrypt через webroot-проверку,
# и на этом фиктивный сертификат заменяется реальным — остаётся только
# перезапустить nginx, чтобы он его подхватил.

set -euo pipefail
cd "$(dirname "$0")"

DOMAIN="itschool-rtk-supremum.ru"
WWW_DOMAIN="www.itschool-rtk-supremum.ru"
EMAIL="${LETSENCRYPT_EMAIL:-}"
DATA_PATH="./certbot"

if [ -z "$EMAIL" ]; then
  echo "Укажите e-mail для регистрации в Let's Encrypt (уведомления об истечении):"
  read -r EMAIL
fi

mkdir -p "$DATA_PATH/conf/live/$DOMAIN" "$DATA_PATH/www"

if [ -d "$DATA_PATH/conf/live/$DOMAIN" ] && [ -f "$DATA_PATH/conf/live/$DOMAIN/fullchain.pem" ]; then
  echo "Сертификат для $DOMAIN уже есть в $DATA_PATH/conf — ничего не делаю."
  echo "Чтобы перевыпустить заново, удалите $DATA_PATH/conf/live/$DOMAIN и запустите скрипт снова."
  exit 0
fi

echo "### Кладу временный self-signed сертификат, чтобы nginx смог стартовать..."
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout '/etc/letsencrypt/live/$DOMAIN/privkey.pem' \
    -out '/etc/letsencrypt/live/$DOMAIN/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo "### Поднимаю nginx с временным сертификатом..."
docker compose up -d nginx

echo "### Удаляю временный сертификат, прошу настоящий у Let's Encrypt..."
docker compose run --rm --entrypoint "\
  rm -rf /etc/letsencrypt/live/$DOMAIN /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --email $EMAIL -d $DOMAIN -d $WWW_DOMAIN \
    --rsa-key-size 4096 --agree-tos --non-interactive" certbot

echo "### Перезапускаю nginx с настоящим сертификатом..."
docker compose exec nginx nginx -s reload

echo "Готово: https://$DOMAIN должен открываться с валидным сертификатом."
