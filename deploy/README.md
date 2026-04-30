# Deploy

Target: VPS (Debian/Ubuntu). Assumes PostgreSQL 17 already installed and the DB `envoraicms_db` + user `user_envoraicms` exist. Replace `SERVER_IP` and `DB_PASS` with real values; never commit them.

## 1. One-time server setup

```bash
apt update
apt install -y nginx pgbouncer postgresql-client certbot python3-certbot-nginx curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm i -g pm2
mkdir -p /var/www/envoraicms /var/log/envoraicms /var/log/pm2 /var/cache/nginx/envoraicms
```

## 2. Database restore + indexes

```bash
scp dump root@SERVER_IP:/tmp/envoraicms-dump
scp -r deploy root@SERVER_IP:/tmp/envoraicms-deploy
ssh root@SERVER_IP
cd /tmp/envoraicms-deploy
PGPASSWORD='DB_PASS' DUMP=/tmp/envoraicms-dump bash restore-db.sh
```

## 3. pgBouncer

```bash
cp /tmp/envoraicms-deploy/pgbouncer.ini /etc/pgbouncer/pgbouncer.ini
# userlist.txt — md5 hash of password + user name
HASH=$(echo -n "DB_PASSuser_envoraicms" | md5sum | awk '{print $1}')
echo "\"user_envoraicms\" \"md5$HASH\"" > /etc/pgbouncer/userlist.txt
chown postgres:postgres /etc/pgbouncer/userlist.txt
chmod 600 /etc/pgbouncer/userlist.txt
systemctl enable --now pgbouncer
```

## 4. App deploy

```bash
# On your laptop:
rsync -av --delete --exclude node_modules --exclude .next --exclude public/Content \
  ./ root@SERVER_IP:/var/www/envoraicms/

# On the server:
cd /var/www/envoraicms
npm ci
cat > .env.local <<'EOF'
DB_HOST=127.0.0.1
DB_PORT=6432
DB_NAME=envoraicms_db
DB_USER=user_envoraicms
DB_PASSWORD=DB_PASS
SITE_URL=https://envoraicms.com
NODE_ENV=production
EOF
npm run build
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root
```

## 5. Image sync (CDN → local)

```bash
cd /var/www/envoraicms
bash deploy/sync-images.sh
```

## 6. Nginx + TLS

```bash
cp deploy/nginx.conf /etc/nginx/sites-available/envoraicms.conf
ln -s /etc/nginx/sites-available/envoraicms.conf /etc/nginx/sites-enabled/envoraicms.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
certbot --nginx -d envoraicms.com -d www.envoraicms.com --redirect
```

## 7. Cloudflare

1. DNS `A` record → `SERVER_IP`, proxied (orange cloud).
2. SSL/TLS → Full (strict).
3. Caching → Standard.
4. Page Rules:
   - `envoraicms.com/_next/static/*` → Cache Level: Cache Everything, Edge Cache TTL: 1 month
   - `envoraicms.com/Content/*` → Cache Level: Cache Everything, Edge Cache TTL: 1 month
   - `envoraicms.com/Upload/*` → Cache Level: Cache Everything, Edge Cache TTL: 1 month
   - `envoraicms.com/search*` → Cache Level: Bypass
5. Rate Limiting: `/search*` → 30 req / 1 min per IP.
6. Bot Fight Mode on, Brotli on, HTTP/3 on.

## 8. Ingest timer

```bash
cp deploy/envoraicms-ingest.service /etc/systemd/system/
cp deploy/envoraicms-ingest.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now envoraicms-ingest.timer
systemctl list-timers envoraicms-ingest.timer
```

## 9. Smoke test

```bash
curl -I https://envoraicms.com
curl -I https://envoraicms.com/world
curl -s https://envoraicms.com/sitemap.xml | head -20
curl -s https://envoraicms.com/rss.xml | head -20
curl -s https://envoraicms.com/api/health
pm2 status
```

## Rollbacks / maintenance

- Rebuild after code change: `cd /var/www/envoraicms && npm ci && npm run build && pm2 reload envoraicms`
- Clear Nginx cache: `rm -rf /var/cache/nginx/envoraicms/* && systemctl reload nginx`
- Purge Cloudflare: dashboard → Caching → Purge Everything (or by URL).
