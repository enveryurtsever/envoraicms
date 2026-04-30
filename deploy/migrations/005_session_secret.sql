-- Settings.SessionSecret: admin login cookie imzalama secret'ı.
-- Kurulumda /install otomatik üretir. .env yerine DB'de saklanması:
-- WordPress mantığı (kullanıcı tek dosyada DB bilgisi yazıp kuruluyor).

BEGIN;

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "SessionSecret" TEXT;

COMMIT;
