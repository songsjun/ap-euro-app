# AP European History Adaptive Learning

Next.js learning app for AP European History.

## Local Setup

```bash
pnpm install
cp .env.example .env
createdb ap_euro
pnpm db:schema
pnpm student:create -- --name "Student Name"
pnpm dev
```

Students must sign in with a generated access code. Student identity, resource completions, section unlocks, and quiz attempts are stored in local PostgreSQL. Static curriculum content is still seeded into browser IndexedDB for fast local reads.

Both `pnpm db:schema` and `pnpm student:create` load `.env` from the project root before connecting to PostgreSQL. `SESSION_SECRET` is required for runtime auth and student creation; generate a private value before creating students.

## Scripts

- `pnpm db:schema`: create/update the local PostgreSQL tables using `DATABASE_URL` from `.env`.
- `pnpm student:create -- --name "Student Name"`: create a student and print a one-time access code using the same `.env` secrets as the app.
- `pnpm build`: production build.

## AI Gateway

`/api/ai` proxies to `AI_GATEWAY_URL` when configured. Without an external gateway it returns a structured `503 ai_gateway_not_configured` response instead of a bare 404.
