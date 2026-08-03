# Fluxion Logistic Backend

Backend mínimo en Node.js + TypeScript con Express y PostgreSQL para desplegar en Render usando Neon.

## Requisitos

- Node.js 20+
- Una base de datos PostgreSQL en Neon

## Variables de entorno

Copia .env.example a .env y ajusta los valores:

```bash
cp .env.example .env
```

Ejemplo:

```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgres://<user>:<password>@<host>/<db>?sslmode=require
JWT_SECRET=<replace-with-strong-secret>
TENANT_ADMIN_KEY=<replace-with-admin-key>
CORS_ORIGINS=http://localhost:3000
```

## Seguridad y Auth

- Todas las rutas bajo `/api` requieren JWT Bearer valido.
- Claims minimos requeridos en el token: `sub` y `tenantId`.
- Claims opcionales: `role`, `email`.

Generar token de prueba:

```bash
JWT_SECRET="<tu-secret>" \
JWT_USER_ID="user-1" \
JWT_TENANT_ID="tenant-1" \
JWT_ROLE="superadmin" \
npm run auth:token
```

Probar endpoints protegidos:

```bash
TOKEN="<token-generado>" npm run auth:smoke
```

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Despliegue en Render

1. Crea un servicio Web en Render.
2. Usa el siguiente comando de build: `npm install && npx prisma generate && npm run build`
3. Usa el comando de inicio: `npm run start`
4. Define variables de entorno: `DATABASE_URL`, `JWT_SECRET`, `TENANT_ADMIN_KEY`, `CORS_ORIGINS`.
5. Opcionalmente, configura `NODE_ENV=production` y `PORT=10000`.

También puedes usar el archivo render.yaml como punto de partida.
