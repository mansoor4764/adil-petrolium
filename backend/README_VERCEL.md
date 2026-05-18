# Quick Vercel Deployment

## 🚀 Quick Start

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy from backend directory**
   ```bash
   cd backend
   vercel --prod
   ```

## 📋 Environment Variables Required

Set these in Vercel Dashboard (Project Settings → Environment Variables):

```bash
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/petro_dealer
JWT_ACCESS_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<64-char-random-string>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ADMIN_REGISTRATION_SECRET=<strong-secret>
NODE_ENV=production
PORT=5000
API_VERSION=v1
LOG_LEVEL=info
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

## 🔑 Generate Secrets

```bash
# JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Admin secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## ✅ Test Deployment

```bash
curl https://your-backend.vercel.app/health
```

Should return: `{"status":"ok","ts":"..."}`

## 📚 Full Documentation

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for complete guide.

## 🔧 Project Structure for Vercel

```
backend/
├── api/
│   └── index.js          # Vercel entry point
├── src/
│   ├── server.js         # Express app
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── utils/
├── vercel.json           # Vercel configuration
├── .vercelignore         # Files to exclude
└── package.json
```

## 🌐 CORS Setup

Update `ALLOWED_ORIGINS` to include your frontend:

```
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://www.yourdomain.com,http://localhost:3000
```

Multiple origins separated by commas.

## 🐛 Common Issues

### MongoDB Connection Failed
- Whitelist `0.0.0.0/0` in MongoDB Atlas Network Access
- Verify connection string format
- Check database user permissions

### CORS Errors
- Add frontend URL to `ALLOWED_ORIGINS`
- No trailing slashes in URLs

### Function Timeout
- Vercel Hobby: 10s limit
- Optimize database queries
- Add database indexes

## 📊 Monitoring

- **Logs**: `vercel logs <deployment-url>`
- **Dashboard**: https://vercel.com/dashboard
- **MongoDB**: Check Atlas monitoring

## 🔒 Security Checklist

- ✅ All secrets in environment variables
- ✅ Strong JWT secrets (64+ characters)
- ✅ MongoDB IP whitelist configured
- ✅ CORS restricted to known domains
- ✅ Rate limiting enabled
- ✅ Helmet security headers active

## 📞 Support

- Vercel Docs: https://vercel.com/docs
- MongoDB Atlas: https://docs.atlas.mongodb.com
