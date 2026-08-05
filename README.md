This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Local setup

1. Copy `.env.example` to `.env.local` and fill in at least `MONGO_DB_URI`, `MONGO_DB_NAME`, and `AUTH_SECRET`. Add `FOOTBALL_API` (free key from [football-data.org](https://www.football-data.org/)) if you want real fixtures and the league table.
2. Seed the database:

```bash
npm run seed
```

This creates two verified dev accounts (idempotent — safe to re-run):

| Account | Email | Password |
| --- | --- | --- |
| Player | `player@dev.local` | `password123` |
| Admin | `admin@dev.local` | `password123` |

Override the password with `SEED_PASSWORD=… npm run seed`. With `FOOTBALL_API` set it also syncs the Premier League teams and the full season's fixtures.

Then log in as the admin and start a game from `/admin`, or as the player to make picks. The script refuses to run with `NODE_ENV=production` unless you pass `--force`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
