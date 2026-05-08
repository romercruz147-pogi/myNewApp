# Backend Deployment Guide

## Overview

This guide covers deploying the Romers Vendo backend to production using various cloud platforms.

---

## Part 1: Prepare for Deployment

### Prerequisites

- Backend code ready in `iot-backend/` folder
- All dependencies in `package.json`
- `.env` file with all required variables (NOT in git)
- Supabase database setup complete

### Build Checklist

- [ ] All dependencies installed: `npm install`
- [ ] Code runs locally: `npm run dev`
- [ ] Tests pass (if any): `npm test`
- [ ] No console errors or warnings
- [ ] `.env` file created with production values
- [ ] `.env` NOT in git (check `.gitignore`)

### Environment Variables for Production

Create `.env` with these values (use strong secrets):

```env
# Server
PORT=8080
NODE_ENV=production

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# JWT
JWT_SECRET=your_super_secure_secret_min_32_chars_random
JWT_EXPIRES_IN=7d

# Provisioning
PROVISIONING_KEY=another_secure_key_min_32_chars_random

# CORS (Production)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://api.yourdomain.com

# Bcrypt
BCRYPT_ROUNDS=12
```

---

## Part 2: Railway.app Deployment (Recommended)

Railway is easiest for Node.js apps.

### Step 1: Create Railway Account

1. Go to https://railway.app
2. Sign up with GitHub or email
3. Create new project

### Step 2: Connect GitHub Repository

1. In Railway: **New Project** → **Deploy from GitHub**
2. Select your repository
3. Select branch (main)
4. Railway auto-deploys on push

### Step 3: Add PostgreSQL Database

1. In Railway project: **New** → **Database** → **PostgreSQL**
2. It creates a PostgreSQL instance
3. Copy connection string (shown in dashboard)

### Step 4: Set Environment Variables

1. In Railway: Go to your deployment
2. Click **Variables** tab
3. Add these variables:

```
NODE_ENV=production
PORT=8080
JWT_SECRET=your_secret_here
PROVISIONING_KEY=your_provisioning_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
CORS_ORIGINS=https://yourdomain.com
BCRYPT_ROUNDS=12
```

### Step 5: Setup Database Schema

1. In Railway: Open PostgreSQL database
2. Go to **Connect** → **Connection Pool** → copy connection string
3. Run SQL in Supabase or Railway SQL editor:

```sql
-- Create tables (see DATABASE_SCHEMA.sql)
-- Copy and run all CREATE TABLE statements
```

### Step 6: Deploy

1. Commit and push code:
```bash
git add .
git commit -m "Production deployment"
git push origin main
```

2. Railway auto-deploys
3. Monitor deployment in Railway dashboard
4. Get public URL (shown in dashboard)

### Step 7: Test Deployment

```bash
# Test health endpoint
curl https://your-railway-url.railway.app/health

# Should return: {"ok":true,"service":"romers-vendo-iot-api"}
```

---

## Part 3: Heroku Deployment

Heroku free tier deprecated, but still available for paid accounts.

### Step 1: Install Heroku CLI

```bash
# Download from https://devcenter.heroku.com/articles/heroku-cli
# Install and login
heroku login
```

### Step 2: Create Heroku App

```bash
cd iot-backend
heroku create romers-vendo-api
# Remember the app name shown
```

### Step 3: Add PostgreSQL

```bash
# Add Heroku Postgres addon
heroku addons:create heroku-postgresql:mini
```

### Step 4: Set Environment Variables

```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_secret_here
heroku config:set PROVISIONING_KEY=your_provisioning_key
heroku config:set SUPABASE_URL=https://your-project.supabase.co
heroku config:set SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
heroku config:set CORS_ORIGINS=https://yourdomain.com
```

### Step 5: Deploy

```bash
git push heroku main
```

### Step 6: View Logs

```bash
heroku logs --tail
```

### Step 7: Test

```bash
curl https://romers-vendo-api.herokuapp.com/health
```

---

## Part 4: AWS Elastic Beanstalk Deployment

For more control and scalability.

### Step 1: Install EB CLI

```bash
pip install awsebcli
# Requires Python and pip
```

### Step 2: Initialize Project

```bash
cd iot-backend
eb init -p node.js-20 romers-vendo-api
# Select region (us-east-1 recommended)
```

### Step 3: Create Environment

```bash
eb create romers-vendo-api-env
```

### Step 4: Set Environment Variables

```bash
eb setenv NODE_ENV=production
eb setenv JWT_SECRET=your_secret
# ... set all variables
```

### Step 5: Deploy

```bash
eb deploy
```

### Step 6: View Status

```bash
eb status
eb logs
eb open  # Opens app in browser
```

---

## Part 5: Docker Deployment

For any platform that supports Docker.

### Step 1: Create Dockerfile

Create `iot-backend/Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy app code
COPY src ./src

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start app
CMD ["node", "src/server.js"]
```

### Step 2: Create .dockerignore

```
node_modules
npm-debug.log
.git
.gitignore
.env
README.md
.DS_Store
```

### Step 3: Build Image

```bash
docker build -t romers-vendo-api:latest .
```

### Step 4: Run Locally (Test)

```bash
docker run -p 8080:8080 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your_secret \
  -e SUPABASE_URL=your_url \
  -e SUPABASE_SERVICE_ROLE_KEY=your_key \
  romers-vendo-api:latest
```

### Step 5: Deploy to Cloud

Upload to:
- Docker Hub
- GitHub Container Registry
- AWS ECR
- Any Kubernetes cluster

---

## Part 6: Environment Configuration

### Production Secrets

**DO NOT commit `.env` file!**

For each platform, use their secrets management:
- Railway: Variables tab
- Heroku: `heroku config:set`
- AWS: Systems Manager Parameter Store
- Docker: Environment variables or Docker secrets

### Generate Secure Secrets

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate PROVISIONING_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### CORS for Production

Only allow your actual domains:

```env
# Good
CORS_ORIGINS=https://app.yourdomain.com,https://api.yourdomain.com

# Bad (too permissive)
CORS_ORIGINS=*

# Bad (exposes localhost)
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

---

## Part 7: Database Setup

### Supabase (Recommended)

1. Create project at https://supabase.com
2. Get SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
3. Go to SQL Editor
4. Run all CREATE TABLE statements from `DATABASE_SCHEMA.sql`
5. Verify tables created in Table Editor

### Connection Pooling

For production, use connection pooling:

```javascript
// In supabase.js
const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  // Add connection pooling
  db: {
    schema: 'public',
  },
});
```

---

## Part 8: Monitoring & Logging

### Application Logs

**Railway:** Dashboard → Logs tab
**Heroku:** `heroku logs --tail`
**AWS:** CloudWatch Logs
**Docker:** `docker logs container-id`

### Health Check

```bash
curl https://your-deployment-url/health

# Should return quickly:
# {"ok":true,"service":"romers-vendo-iot-api"}
```

### Database Monitoring

Supabase Dashboard:
- Storage tab: Database size
- Realtime tab: Active connections
- SQL tab: Run custom queries

---

## Part 9: HTTPS & SSL Certificates

### Get Free Certificate (Let's Encrypt)

- Railway: Auto-provided
- Heroku: Auto-provided for herokuapp.com domain
- AWS: Use AWS Certificate Manager (free)
- Custom Domain: Use Route 53 + ACM

### Configure Custom Domain

1. Buy domain (e.g., api.yourdomain.com)
2. Add DNS records pointing to deployment
3. Configure SSL certificate
4. Update CORS_ORIGINS to use https://

Example DNS record:
```
api.yourdomain.com CNAME your-railway-app.railway.app
```

---

## Part 10: Scaling & Performance

### For Development
```env
PORT=8080
BCRYPT_ROUNDS=10
```

### For Production (High Traffic)
```env
PORT=8080
BCRYPT_ROUNDS=12
# Add caching layer if needed
# Use CDN for static files
# Add database read replicas
```

---

## Part 11: Backup & Disaster Recovery

### Database Backups

**Supabase:**
1. Dashboard → Backups
2. Configure auto-backup (daily recommended)
3. Test restore procedure

**PostgreSQL Generic:**
```bash
# Export database
pg_dump -h hostname -U username -d database > backup.sql

# Restore
psql -h hostname -U username -d database < backup.sql
```

### Code Backups

- GitHub: Your main backup
- Enable GitHub Actions for CI/CD
- Tag releases: `git tag v1.0.0`

---

## Part 12: CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway up
        env:
          RAILWAY_API_TOKEN: ${{ secrets.RAILWAY_API_TOKEN }}
```

---

## Part 13: Troubleshooting Deployment

### App Won't Start

Check logs:
```bash
# Railway
railway logs

# Heroku
heroku logs --tail

# Docker
docker logs container-id
```

Common errors:
- Missing environment variables
- Database connection failed
- Node version mismatch
- Missing dependencies

### Database Connection Failed

```bash
# Test connection
psql postgresql://user:pass@host/db

# Check credentials in .env
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

### CORS Errors in Production

Add to CORS_ORIGINS:
```env
CORS_ORIGINS=https://your-app-domain.com,https://api.your-domain.com
```

---

## Part 14: Post-Deployment Checklist

- [ ] App running: `curl https://your-url/health`
- [ ] Database connected and responsive
- [ ] CORS properly configured
- [ ] All environment variables set
- [ ] SSL certificate valid
- [ ] Logging working (check logs)
- [ ] Auto-backup enabled
- [ ] Custom domain configured (optional)
- [ ] Monitoring alerts setup
- [ ] Team has access/credentials
- [ ] Documented deployment process
- [ ] Tested endpoint with mobile app

---

## Quick Reference Commands

```bash
# Railway
railway up
railway logs
railway env

# Heroku
heroku deploy
heroku logs --tail
heroku config:set KEY=value

# Docker
docker build -t app:latest .
docker run -p 8080:8080 app:latest
docker logs container-id
```

---

## URLs After Deployment

Update these in your mobile app `.env`:

```env
# Development
EXPO_PUBLIC_IOT_BACKEND_URL=http://192.168.0.100:8080

# Production
EXPO_PUBLIC_IOT_BACKEND_URL=https://api.yourdomain.com
```

And in ESP32 firmware:

```cpp
const char* BACKEND_URL = "https://api.yourdomain.com";
```

---

## Next Steps

1. ✅ Choose deployment platform
2. ✅ Prepare environment variables
3. ✅ Deploy backend
4. ✅ Test health endpoint
5. ✅ Setup database
6. ✅ Configure custom domain (optional)
7. ✅ Update app .env files
8. ⬜ Test end-to-end with app and ESP32
9. ⬜ Monitor logs in production
10. ⬜ Setup alerts and backups

**Questions?** Check ROMERS_VENDO_COMPLETE_FIX_GUIDE.md
