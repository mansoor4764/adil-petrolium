# Vercel Deployment Troubleshooting

## Fixed: FUNCTION_INVOCATION_FAILED Error

### What was the problem?
The original `api/index.js` was simply exporting the server.js module, which tried to start an HTTP server. This doesn't work in Vercel's serverless environment.

### What was fixed?
1. **Created a proper serverless handler** in `api/index.js` that:
   - Exports an async function instead of starting a server
   - Handles database connections with caching for better performance
   - Properly handles errors without crashing
   - Reuses MongoDB connections across invocations

2. **Updated vercel.json** with proper routing:
   - Routes all requests to the serverless function
   - Handles health checks and API routes

### How to deploy now:

```bash
cd backend
vercel --prod
```

## Common Vercel Errors and Solutions

### 1. FUNCTION_INVOCATION_FAILED
**Cause**: Function crashes during execution
**Solutions**:
- Check Vercel logs: `vercel logs <deployment-url>`
- Ensure all environment variables are set
- Verify MongoDB connection string is correct
- Check that all required dependencies are in `dependencies` (not `devDependencies`)

### 2. Cannot connect to MongoDB
**Cause**: MongoDB Atlas network access or connection string issues
**Solutions**:
- Whitelist `0.0.0.0/0` in MongoDB Atlas Network Access
- Verify connection string format: `mongodb+srv://username:password@cluster.mongodb.net/dbname`
- Check database user has read/write permissions
- Ensure password doesn't contain special characters (or URL encode them)

### 3. Missing environment variables
**Cause**: Required env vars not set in Vercel
**Solutions**:
- Go to Vercel Dashboard → Project → Settings → Environment Variables
- Add all required variables (see DEPLOYMENT_SUMMARY.md)
- Redeploy after adding variables

### 4. Module not found errors
**Cause**: Dependencies not installed or in wrong section
**Solutions**:
- Move all runtime dependencies to `dependencies` section in package.json
- Remove `devDependencies` from production build
- Run `npm install` locally to verify

### 5. Timeout errors (10 seconds)
**Cause**: Function takes too long to execute
**Solutions**:
- Optimize database queries
- Add indexes to MongoDB collections
- Reduce data fetching in single requests
- Consider upgrading to Vercel Pro (60s timeout)

### 6. CORS errors
**Cause**: Frontend domain not in ALLOWED_ORIGINS
**Solutions**:
- Add frontend URL to `ALLOWED_ORIGINS` environment variable
- Format: `https://frontend.vercel.app,http://localhost:3000`
- No trailing slashes
- Redeploy after updating

## Checking Logs

### View logs in real-time:
```bash
vercel logs <deployment-url> --follow
```

### View logs for specific function:
```bash
vercel logs <deployment-url> --output=raw
```

### Check build logs:
Go to Vercel Dashboard → Deployments → Click deployment → Build Logs

## Testing Your Deployment

### 1. Health Check
```bash
curl https://your-backend.vercel.app/health
```
Expected response:
```json
{
  "status": "ok",
  "ts": "2024-01-15T12:00:00.000Z",
  "db": "connected"
}
```

### 2. Test API endpoint
```bash
curl -X POST https://your-backend.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Admin@12345"}'
```

### 3. Check CORS
```bash
curl -X OPTIONS https://your-backend.vercel.app/api/v1/customers \
  -H "Origin: https://your-frontend.vercel.app" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

## Environment Variables Checklist

Make sure these are set in Vercel:

- [ ] `MONGO_URI` - MongoDB connection string
- [ ] `JWT_ACCESS_SECRET` - 64+ character random string
- [ ] `JWT_REFRESH_SECRET` - 64+ character random string
- [ ] `JWT_ACCESS_EXPIRES_IN` - e.g., "15m"
- [ ] `JWT_REFRESH_EXPIRES_IN` - e.g., "7d"
- [ ] `ADMIN_REGISTRATION_SECRET` - Strong random string
- [ ] `NODE_ENV` - Set to "production"
- [ ] `PORT` - Set to "5000"
- [ ] `API_VERSION` - Set to "v1"
- [ ] `LOG_LEVEL` - Set to "info"
- [ ] `ALLOWED_ORIGINS` - Your frontend URL(s)

## Performance Tips

### 1. Database Connection Pooling
The updated `api/index.js` now caches database connections between invocations for better performance.

### 2. Cold Starts
First request after inactivity will be slower. This is normal for serverless.

### 3. Keep Functions Warm
Set up a cron job or uptime monitor to ping your health endpoint every 5 minutes:
```bash
curl https://your-backend.vercel.app/health
```

### 4. Optimize Bundle Size
- Remove unused dependencies
- Use `.vercelignore` to exclude unnecessary files
- Keep functions small and focused

## Getting Help

1. **Check Vercel Logs**: Most issues show up in logs
2. **MongoDB Atlas Logs**: Check for connection issues
3. **Vercel Status**: https://www.vercel-status.com/
4. **Vercel Community**: https://github.com/vercel/vercel/discussions

## Quick Fixes

### Redeploy
```bash
cd backend
vercel --prod --force
```

### Clear cache and redeploy
```bash
vercel --prod --force --no-cache
```

### Rollback to previous deployment
Go to Vercel Dashboard → Deployments → Click previous working deployment → Promote to Production

## Success Indicators

✅ Health endpoint returns 200 OK
✅ Database connection shows "connected"
✅ API endpoints respond correctly
✅ No errors in Vercel logs
✅ CORS headers present in responses
✅ Frontend can communicate with backend

## Still Having Issues?

1. Check all environment variables are set correctly
2. Verify MongoDB Atlas IP whitelist includes `0.0.0.0/0`
3. Test MongoDB connection string locally
4. Review Vercel function logs for specific errors
5. Ensure all dependencies are in `dependencies` section
6. Try deploying to a preview environment first: `vercel` (without --prod)
