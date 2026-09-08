This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

## Scheduled publishing

Scheduled videos are published by the protected endpoint at
`/api/cron/publish-scheduled`. Supabase Cron calls it every minute and the
endpoint processes only videos whose `scheduledAt` time has arrived.

To enable it in production:

1. Set `APP_URL` and `CRON_SECRET` in the production hosting environment.
2. Open the Supabase SQL Editor.
3. Open [`supabase/setup-publishing-cron.sql`](supabase/setup-publishing-cron.sql),
   replace `REPLACE_WITH_YOUR_CRON_SECRET`, and run the whole script.
4. In Supabase, open **Integrations > Cron > Jobs** and confirm that
   `creatorhub-publish-scheduled` is active.

The SQL currently uses `https://360creatorhub.vercel.app` as the production
URL. Update that value if the production domain changes, without adding a
trailing slash. Keep `CRON_SECRET` private and use exactly the same value in
the production environment and the SQL script. Re-running the script updates
the Vault values and replaces the existing job.

To test the endpoint directly:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://YOUR_PRODUCTION_DOMAIN/api/cron/publish-scheduled
```

A successful response includes `processedVideos`. A value of `0` is normal
when no scheduled video is due.
