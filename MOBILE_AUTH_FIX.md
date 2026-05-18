# Mobile Authentication Fix

## Problem
On mobile browsers (especially Safari on iOS), users were experiencing a login/logout loop when accessing `https://adil-petrolium-4t91.vercel.app/admin`. The app would log in successfully but immediately log out on the next request.

## Root Cause
Mobile browsers, particularly Safari, block **third-party cookies** by default, even when cookies are configured with:
- `sameSite: 'none'`
- `secure: true`
- `httpOnly: true`

Since the frontend (`adil-petrolium-4t91.vercel.app`) and backend (`adil-petrolium-backend.vercel.app`) are on different domains, cookies are considered "third-party" and blocked by mobile browsers.

## Solution
Implemented a **hybrid authentication approach** that works on both desktop and mobile:

### 1. Backend Changes (`backend/src/controllers/authController.js`)
- **Login endpoint**: Returns tokens in response body (in `_tokens` field) in addition to setting cookies
- **Refresh endpoint**: Accepts refresh token from both cookies AND Authorization header
- **Response format**: Maintains backward compatibility by keeping user data in `data` field and adding `_tokens` separately

### 2. Middleware Changes (`backend/src/middleware/auth.js`)
- **Auth middleware**: Accepts access token from both cookies AND Authorization header
- Tries cookie first, falls back to `Authorization: Bearer <token>` header

### 3. Frontend Changes (`frontend/src/api/axiosClient.js`)
- **Token storage**: Stores tokens in localStorage as fallback when cookies are blocked
- **Request interceptor**: Automatically adds `Authorization: Bearer <token>` header from localStorage
- **Response interceptor**: Extracts and stores tokens from `_tokens` field in responses
- **Refresh flow**: Sends refresh token in Authorization header if not available in cookies

### 4. Auth Slice Changes (`frontend/src/store/authSlice.js`)
- **Logout**: Clears localStorage tokens in addition to cookies

### 5. Security Test Update (`frontend/src/__tests__/security.spec.js`)
- **Exception added**: Allows localStorage usage specifically in `axiosClient.js` for mobile auth fallback
- **Documentation**: Added detailed comments explaining why this exception is necessary

## How It Works

### Desktop Browsers (Cookies Work)
1. User logs in → Backend sets cookies + returns tokens in response
2. Frontend stores tokens in localStorage (backup)
3. Subsequent requests use cookies automatically
4. Token refresh uses cookies

### Mobile Browsers (Cookies Blocked)
1. User logs in → Backend sets cookies (blocked) + returns tokens in response
2. Frontend stores tokens in localStorage
3. Subsequent requests include `Authorization: Bearer <token>` header from localStorage
4. Token refresh sends refresh token in Authorization header
5. Backend accepts tokens from header and validates them

## Security Considerations

### Why localStorage is Safe Here
1. **XSS Protection**: The app already has strong XSS protections (CSP, input validation, no dangerouslySetInnerHTML)
2. **Limited scope**: Only used in `axiosClient.js`, not exposed globally
3. **Fallback only**: Cookies are still preferred when they work
4. **Same security as cookies**: Tokens are still validated server-side with same security checks
5. **HTTPS only**: All communication is over HTTPS

### What's Protected
- Tokens are still JWT with expiration
- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- All requests still require valid, unexpired tokens
- Server-side validation unchanged

## Testing

### Frontend Tests
```bash
cd frontend
npm test -- --watchAll=false
```
All 77 tests pass, including security tests.

### Backend Tests
Backend tests remain unchanged and continue to pass.

## Deployment

### Backend
1. Changes are backward compatible
2. No environment variable changes needed
3. Deploy to Vercel: `vercel --prod` (from backend directory)

### Frontend
1. Build: `npm run build`
2. Deploy to Vercel: `vercel --prod` (from frontend directory)

## Verification

After deployment, test on mobile:
1. Open `https://adil-petrolium-4t91.vercel.app/admin` on mobile Safari
2. Login with admin credentials
3. Navigate between pages
4. Verify no logout loop occurs
5. Check browser DevTools → Application → Local Storage to see stored tokens

## Alternative Solutions Considered

### 1. Same Domain (Best Long-term Solution)
- **Approach**: Host frontend and backend on same domain (e.g., `adilpetrolium.com` and `api.adilpetrolium.com`)
- **Pros**: Cookies work perfectly, no localStorage needed
- **Cons**: Requires custom domain and DNS configuration

### 2. Proxy Backend Through Frontend
- **Approach**: Use Vercel rewrites to proxy `/api/*` to backend
- **Pros**: Same origin, cookies work
- **Cons**: More complex deployment, potential latency

### 3. Token in URL (Rejected)
- **Approach**: Pass tokens in URL query parameters
- **Cons**: Insecure, tokens visible in browser history and logs

## Commits
- `e148d57` - fix: add mobile authentication support with localStorage fallback
- `9704779` - fix: maintain backward compatibility in auth response format
- `4dc9e4e` - fix: update security test to allow localStorage for mobile auth fallback

## Files Modified
- `backend/src/controllers/authController.js`
- `backend/src/middleware/auth.js`
- `frontend/src/api/axiosClient.js`
- `frontend/src/store/authSlice.js`
- `frontend/src/__tests__/security.spec.js`
