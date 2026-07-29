# Complete local-database production upsert

The committed snapshot `scratch/local_database_all.jsonl.gz` contains every
row from every base table in the local PostgreSQL `public` schema:

- **104 tables**
- **182,069 records**
- **9,962 health facilities**
- **72,226 communities**
- **579 clients**
- **5,090 client vaccinations**
- **13 stored administrative boundaries**
- **58,237 master settlements**
- all other local operational, configuration, history, audit, and user records

The importer discovers and preserves all exported columns. Tables are processed
in foreign-key dependency order. Records with primary or unique keys use
`INSERT ... ON CONFLICT DO UPDATE`; keyless tables insert only rows that do not
already exist. Generated identity values are preserved.

The runner creates and verifies a timestamped production backup before it
starts. It does not execute `DROP`, `TRUNCATE`, `DELETE`, database reset,
restore, Git reset, or Git clean operations.

## VPS commands

```bash
cd /var/www/vaxplan
npm install
bash scripts/vps-upsert-all.sh
npm run build
pm2 restart vaxplan
pm2 save
pm2 status
```

Backups and logs are written to `/var/www/vaxplan/backups`. The command exits
non-zero unless all 182,069 snapshot records are processed successfully.

Shapefile components stored only as repository files are deployed by Git and
the application build. Boundary geometries stored as database records are part
of this database-wide snapshot.
