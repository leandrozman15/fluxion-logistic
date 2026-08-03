import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('Missing JWT_SECRET in environment.');
  process.exit(1);
}

const userId = process.env.JWT_USER_ID ?? 'dev-user';
const tenantId = process.env.JWT_TENANT_ID ?? 'dev-tenant';
const role = process.env.JWT_ROLE ?? 'viewer';
const email = process.env.JWT_EMAIL ?? 'dev@example.com';
const expiresIn = process.env.JWT_EXPIRES_IN ?? '12h';

const token = jwt.sign(
  {
    tenantId,
    role,
    email,
  },
  secret,
  {
    subject: userId,
    expiresIn,
  }
);

console.log(token);
