# Vercel Deployment Guide for Backend

This guide will help you deploy the Adil Petroleum backend API to Vercel.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. MongoDB Atlas account (or another hosted MongoDB instance)
3. Git repository connected to Vercel

## Step 1: Prepare MongoDB

1. Create a MongoDB Atlas cluster (free tier works fine)
2. Create a database user with read/write permissions
3. Whitelist Vercel's IP addresses (or use `0.0.0.0/0` for all IPs)
4. Get your connection string (format: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority`)

## Step 2: Configure Environment Variables in Vercel

Go to your Vercel project settings → Environment Variables and add the following:

### Required Variables:

```bash
# MongoDB
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/petro_dealer?retryWrites=true&w=majority

# JWT Secrets (generate strong random strings)
JWT_ACCESS_SECRET=<generate-a-64-char-random-string>
JWT_REFRESH_SECRET=<generate-a-different-64-char-random-string>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Admin Registration Secret
ADMIN_REGISTRATION_SECRET=<generate-a-strong-secret>

# Environment
NODE_ENV=production
PORT=5000
API_VERSION=v1

# Logging
LOG_LEVEL=info

# CORS - Add your frontend URL
ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app,https://www.your-domain.com
```

### Optional Variables (for testing):

```bash
TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASS=Admin@12345
TEST_CUSTOMER_EMAIL=customer@test.com
TEST_CUSTOMER_PASS=Customer@12345
```

## Step 3: Generate Strong Secrets

Use these commands to generate secure random strings:

```bash
# For JWT secrets (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# For admin registration secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Step 4: Deploy to Vercel

### Option A: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to backend directory
cd backend

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### Option B: Deploy via Git Integration

1. Push your code to GitHub/GitLab/Bitbucket
2. Import the project in Vercel dashboard
3. Set the **Root Directory** to `backend`
4. Vercel will auto-detect the Node.js project
5. Add all environment variables in the Vercel dashboard
6. Click "Deploy"

## Step 5: Verify Deployment

After deployment, test your API:

```bash
# Health check
curl https://your-backend.vercel.app/health

# Should return: {"status":"ok","ts":"2024-..."}
```

## Step 6: Update Frontend Configuration

Update your frontend's API URL to point to the Vercel backend:

```javascript
// frontend/.env or frontend/.env.production
REACT_APP_API_URL=https://your-backend.vercel.app/api/v1
```

## Important Notes

### 1. Serverless Limitations

Vercel uses serverless functions with these limitations:
- **10-second timeout** on Hobby plan (60s on Pro)
- **1024 MB memory** limit
- Functions are stateless (no persistent connections)

### 2. MongoDB Connection Pooling

The app uses Mongoose which handles connection pooling. However, in serverless:
- Connections may be reused across invocations
- Cold starts will create new connections
- Use MongoDB Atlas for best performance

### 3. File Uploads

If your app handles file uploads:
- Vercel has a **4.5 MB** request body limit
- Consider using external storage (AWS S3, Cloudinary, etc.)

### 4. Logs

View logs in Vercel dashboard:
- Go to your project → Deployments → Click on a deployment → Functions tab
- Or use: `vercel logs <deployment-url>`

### 5. CORS Configuration

Make sure `ALLOWED_ORIGINS` includes:
- Your production frontend URL
- Your staging/preview URLs if needed
- Local development URL for testing (http://localhost:3000)

Example:
```
ALLOWED_ORIGINS=https://your-app.vercel.app,https://www.your-domain.com,http://localhost:3000
```

## Troubleshooting

### Issue: "Cannot connect to MongoDB"
- Check your MongoDB Atlas IP whitelist
- Verify connection string format
- Ensure database user has correct permissions

### Issue: "JWT secret not configured"
- Verify all JWT environment variables are set in Vercel
- Check for typos in variable names

### Issue: "CORS errors"
- Add your frontend domain to `ALLOWED_ORIGINS`
- Ensure no trailing slashes in URLs

### Issue: "Function timeout"
- Optimize database queries
- Add indexes to frequently queried fields
- Consider upgrading to Vercel Pro for 60s timeout

### Issue: "Cold starts are slow"
- This is normal for serverless
- First request after inactivity takes longer
- Consider keeping the function warm with periodic health checks

## Post-Deployment Checklist

- [ ] Health endpoint returns 200 OK
- [ ] MongoDB connection works
- [ ] Admin can login
- [ ] Customer can login
- [ ] API endpoints respond correctly
- [ ] CORS allows frontend requests
- [ ] Logs show no errors
- [ ] Environment variables are set correctly
- [ ] Frontend is updated with new API URL

## Monitoring

Set up monitoring for production:

1. **Vercel Analytics**: Enable in project settings
2. **MongoDB Atlas Monitoring**: Check connection metrics
3. **Error Tracking**: Consider Sentry or similar service
4. **Uptime Monitoring**: Use UptimeRobot or similar

## Scaling

If you need better performance:

1. **Upgrade to Vercel Pro**: 60s timeout, better resources
2. **Optimize Database**: Add indexes, use aggregation pipelines
3. **Caching**: Implement Redis for frequently accessed data
4. **CDN**: Use Vercel's edge network for static assets

## Security Checklist

- [ ] All secrets are environment variables (not in code)
- [ ] JWT secrets are strong random strings (64+ chars)
- [ ] MongoDB user has minimal required permissions
- [ ] CORS is restricted to known domains
- [ ] Rate limiting is enabled
- [ ] Helmet security headers are active
- [ ] Input validation is working
- [ ] MongoDB injection protection is active

## Support

For issues:
- Vercel Docs: https://vercel.com/docs
- MongoDB Atlas Docs: https://docs.atlas.mongodb.com
- Project Issues: Create an issue in your repository
