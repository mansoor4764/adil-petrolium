# Vercel Deployment Checklist

Use this checklist to ensure a smooth deployment process.

## Pre-Deployment

### MongoDB Setup
- [ ] MongoDB Atlas account created
- [ ] Cluster created (M0 free tier or higher)
- [ ] Database user created with read/write permissions
- [ ] IP whitelist configured (`0.0.0.0/0` for Vercel)
- [ ] Connection string obtained and tested
- [ ] Database name is `petro_dealer`

### Secrets Generation
- [ ] JWT_ACCESS_SECRET generated (64 chars)
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] JWT_REFRESH_SECRET generated (64 chars)
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] ADMIN_REGISTRATION_SECRET generated
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- [ ] All secrets saved securely (password manager)

### Vercel Account
- [ ] Vercel account created
- [ ] Vercel CLI installed (`npm install -g vercel`)
- [ ] Logged into Vercel CLI (`vercel login`)

## Deployment

### Environment Variables in Vercel
Set these in Project Settings → Environment Variables:

- [ ] `MONGO_URI` - MongoDB connection string
- [ ] `JWT_ACCESS_SECRET` - Generated secret
- [ ] `JWT_REFRESH_SECRET` - Generated secret
- [ ] `JWT_ACCESS_EXPIRES_IN` - Set to `15m`
- [ ] `JWT_REFRESH_EXPIRES_IN` - Set to `7d`
- [ ] `ADMIN_REGISTRATION_SECRET` - Generated secret
- [ ] `NODE_ENV` - Set to `production`
- [ ] `PORT` - Set to `5000`
- [ ] `API_VERSION` - Set to `v1`
- [ ] `LOG_LEVEL` - Set to `info`
- [ ] `ALLOWED_ORIGINS` - Your frontend URL(s)

### Deploy Backend
- [ ] Navigate to backend directory (`cd backend`)
- [ ] Run deployment command (`npm run deploy` or `vercel --prod`)
- [ ] Deployment completed successfully
- [ ] Deployment URL noted

## Post-Deployment Testing

### Health Check
- [ ] Health endpoint accessible
  ```bash
  curl https://your-backend.vercel.app/health
  ```
- [ ] Returns `{"status":"ok","ts":"..."}`

### API Endpoints
- [ ] POST `/api/v1/auth/login` - Admin login works
- [ ] POST `/api/v1/auth/login` - Customer login works
- [ ] GET `/api/v1/customers` - Returns customer list (with auth)
- [ ] POST `/api/v1/transactions` - Can create transaction (with auth)

### Database Connection
- [ ] Check Vercel logs for MongoDB connection success
- [ ] No connection errors in logs
- [ ] Data persists between requests

### CORS
- [ ] Frontend can make requests to backend
- [ ] No CORS errors in browser console
- [ ] Preflight OPTIONS requests succeed

## Frontend Integration

### Update Frontend
- [ ] Frontend `.env.production` updated with backend URL
  ```
  REACT_APP_API_URL=https://your-backend.vercel.app/api/v1
  ```
- [ ] Frontend redeployed
- [ ] Frontend can communicate with backend

### End-to-End Testing
- [ ] Admin can login from frontend
- [ ] Customer can login from frontend
- [ ] Can view customer list
- [ ] Can create new customer
- [ ] Can record fuel sale
- [ ] Can record payment
- [ ] Can view transactions
- [ ] Can generate reports
- [ ] Can export data

## Monitoring & Maintenance

### Logs
- [ ] Vercel logs accessible
- [ ] No critical errors in logs
- [ ] MongoDB Atlas monitoring enabled

### Performance
- [ ] API response times acceptable
- [ ] No timeout errors
- [ ] Cold start times reasonable

### Security
- [ ] All secrets in environment variables
- [ ] No secrets in code or logs
- [ ] CORS properly restricted
- [ ] Rate limiting working
- [ ] Helmet headers present

## Documentation

- [ ] Backend URL documented
- [ ] Environment variables documented
- [ ] Deployment process documented
- [ ] Team members have access

## Optional Enhancements

- [ ] Custom domain configured
- [ ] SSL certificate verified
- [ ] Uptime monitoring set up (UptimeRobot, etc.)
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Performance monitoring enabled
- [ ] Backup strategy implemented
- [ ] CI/CD pipeline configured

## Rollback Plan

In case of issues:
- [ ] Previous deployment URL saved
- [ ] Can revert to previous deployment in Vercel
- [ ] Database backup available
- [ ] Team notified of rollback procedure

## Sign-Off

- [ ] Deployment tested by developer
- [ ] Deployment tested by QA (if applicable)
- [ ] Deployment approved for production
- [ ] Team notified of new deployment

---

**Deployment Date**: _______________

**Deployed By**: _______________

**Backend URL**: _______________

**Frontend URL**: _______________

**Notes**: 
_______________________________________________
_______________________________________________
_______________________________________________
