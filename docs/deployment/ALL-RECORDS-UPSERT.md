# Production all-record upsert

This procedure merges every record bundled in `scratch/localhost_data.json`
into the production database selected by `/var/www/vaxplan/.env`.

It is non-destructive: the runner does not execute `DROP`, `TRUNCATE`,
`DELETE`, `git reset`, or `git clean`. It creates and verifies a PostgreSQL
custom-format backup before starting. Existing matching records are updated;
missing records are inserted; records belonging to protected tenants are
skipped by the importer.

After pulling the release branch and installing dependencies, run:

```bash
cd /var/www/vaxplan
bash scripts/vps-upsert-all.sh
npm run build
pm2 restart vaxplan
pm2 save
pm2 status
```

Timestamped backups and import logs are stored in
`/var/www/vaxplan/backups`. If the backup fails or any row reports an import
error, the script exits non-zero and does not report success.
