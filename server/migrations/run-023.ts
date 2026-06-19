import { runMigration } from "./020-catalogue-migration";
runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
