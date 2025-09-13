# DEVLOG Step 11

## Changes
- Removed anonymous login, magic link login, and anonymous upgrade flows
- Kept only Email/Password + Google OAuth authentication
- Implemented site-wide authentication:
  - Unauthenticated access to any main route redirects to /auth
  - TopNav is now hidden on auth routes (/auth and /auth/callback)
- Modified logout behavior to directly redirect to /auth without anonymous fallback

## Technical Changes
- Updated AuthGate.tsx to:
  - Remove automatic anonymous sign-in
  - Implement route-based TopNav visibility
  - Handle auth state changes and redirects
- Modified layout.tsx to remove TopNav from root layout
- Updated TopNav.tsx logout function to remove anonymous fallback
- Simplified auth/page.tsx to only show Google and Email/Password options

## Notes
- Historical anonymous data will no longer be accessible
- If migration of anonymous data is needed, a separate migration script using Service Role API will be required
- /auth/callback now automatically redirects to home page after successful login
