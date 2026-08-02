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
4. Define la variable de entorno `DATABASE_URL` con la conexión de Neon.
5. Opcionalmente, configura `NODE_ENV=production` y `PORT=10000`.

También puedes usar el archivo render.yaml como punto de partida.
