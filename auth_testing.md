# Auth Testing Playbook

## Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
```
Verify bcrypt hash starts with `$2b$`, unique index on users.email.

## Step 2: API Testing
```
curl -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"chennakeshavaediga@gmail.com","password":"admin123"}'
# returns {token, user}
curl $API/api/auth/me -H "Authorization: Bearer <token>"
```
Login returns user object + token. /me returns same user.

## Brute force
5 failed logins for same email+IP → 429 lockout for 15 minutes.
