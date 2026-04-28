# UberEats API (Fastify + Prisma + MySQL)

API REST + GraphQL + WebSocket pour le projet Uber Eats (M1).

## Stack

- Fastify 5
- Prisma 7 + MySQL (adapter MariaDB)
- TypeScript
- Auth JWT (access + refresh)
- GraphQL (Mercurius + GraphiQL)
- WebSocket (`/ws/restaurant`)

## Prérequis

- Node.js 20+ recommandé
- MySQL/MariaDB
- npm

## Installation

```bash
npm install
```

## Variables d'environnement

Créer un fichier `.env` dans `uberEats-api` :

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/ubereats_api"
JWT_SECRET="change-me"
JWT_ACCESS_EXPIRES_IN="30m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3001
HOST=0.0.0.0
CORS_ORIGIN="http://localhost:3000"
CORS_CREDENTIALS=true
```

## Base de données

```bash
# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate deploy

# Peupler la base
npm run db:seed
```

## Lancer le projet

```bash
# Dev
npm run dev

# Build
npm run build

# Start production
npm run start
```

## Docker

Le dossier contient aussi un setup Docker pour l'API + MariaDB.

Fichiers fournis :

- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`

Lancement :

```bash
docker compose up --build
```

Ce compose démarre :

- l'API sur `http://localhost:3001`
- MariaDB sur `localhost:3306`

Le service API attend que MariaDB soit healthy, génère Prisma, applique les migrations puis démarre en mode dev.

## Scripts utiles

- `npm run dev` : démarre l’API en développement
- `npm run build` : compile TypeScript
- `npm run test` : lance Vitest
- `npm run test:coverage` : lance Vitest avec couverture
- `npm run db:seed` : seed de la base
- `npm run prisma:generate` : régénère Prisma Client
- `npm run prisma:migrate` : migration en mode dev

## Comptes seed

Après `npm run db:seed` :

- Admin: `admin@seed.local` / `admin12345`
- Restaurateur: `restaurant@seed.local` / `resto12345`
- Client: `client@seed.local` / `client12345`

Le seed crée aussi un dataset conséquent:

- 12 restaurants
- 96 plats
- 12 commandes

## Endpoints principaux

### REST

- Auth: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/me`
- Restaurants: `/restaurants`, `/restaurants/:restaurantId`, `/restaurants/me`
- Dishes: `/restaurants/:restaurantId/dishes`, `/dishes/:dishId`
- Orders: `/orders`, `/orders/:orderId`, `/users/me/orders`, `/restaurants/me/orders`
- Profil: `/users/me`

Pagination standard:

```json
{
  "data": [],
  "pagination": { "total": 0, "limit": 20, "offset": 0 }
}
```

### GraphQL

- Endpoint: `http://localhost:3001/graphql`
- IDE: `http://localhost:3001/graphiql`

### WebSocket

- URL: `ws://localhost:3001/ws/restaurant`
- Premier message attendu:

```json
{ "event": "authenticate", "token": "ACCESS_JWT" }
```

## Vérifications rapides

1. `GET /restaurants?limit=5&offset=0`
2. `GET /users/me/orders?status=PENDING&from=...&to=...` (avec JWT)
3. `DELETE /orders/:id` non `PENDING` -> `409`
4. GraphQL `me { id email role }` avec header `Authorization`
5. WebSocket: réception `new-order` après création commande client

## Tests automatisés

La suite Vitest couvre actuellement :

- tests unitaires `AuthService` avec mocks Prisma
- tests d’intégration des routes auth avec `app.inject()`
- tests RFC 7807 sur le handler d’erreurs

Commandes :

```bash
# suite complète
npm test

# couverture
npm run test:coverage
```

Cas testés :

- `register` OK
- `register` email dupliqué
- `login` OK
- `login` mot de passe invalide
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

La couverture globale dépasse 30%, ce qui permet de satisfaire l’exigence minimale du barème.

