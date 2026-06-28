@echo off
cd /d C:\vaxplan-main
set DATABASE_URL=postgresql://postgres@localhost:5432/vaxplan
set PORT=5000
set SESSION_SECRET=local-dev-session-secret-change-before-production
set NODE_ENV=production
set SKIP_DB_BOOTSTRAP=1
set SKIP_OUTSIDE_VILLAGES_CACHE=1
set SESSION_STORE=memory
set SESSION_SECURE_COOKIE=false
set LOCAL_HTTP_SESSION=1
node dist\index.cjs > C:\vaxplan-main\vaxplan-node-repl-server.log 2>&1
