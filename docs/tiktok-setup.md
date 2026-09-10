# TikTok account connections

## Sandbox setup for draft uploads and private publishing

The intended sandbox integration includes both uploading drafts to TikTok and
posting privately to connected test accounts. The code currently implements
account connection only; the publishing integrations below still need to be built.

In TikTok for Developers > Manage apps > CreatorHub, switch to Sandbox and
create or select a sandbox. Configure these app details:

| Field | Value |
| --- | --- |
| App name | CreatorHub |
| Platform | Web |
| Description | CreatorHub lets creators connect their TikTok accounts, upload videos for review and completion in TikTok, and publish videos directly with their chosen settings. |
| Website | `https://360creatorhub.vercel.app` |
| Privacy policy | `https://360creatorhub.vercel.app/privacy` |
| Terms of service | `https://360creatorhub.vercel.app/terms` |
| Login Kit redirect URI | `https://360creatorhub.vercel.app/api/platforms/tiktok/callback` |

The description describes the intended integration; implement and test it before
submitting the app for production review.

Add Login Kit and Content Posting API, enable Direct Post, and configure:

- `user.info.basic`: identify the connected account.
- `video.upload`: send a video to the account's TikTok inbox for the user to
  continue editing and complete the post in TikTok.
- `video.publish`: publish directly to the authorized account. Unaudited
  clients are restricted to private viewing; sandbox does not enable public
  API publishing.

Add the TikTok accounts you own under the sandbox's target users, complete
their authorization, and apply the sandbox changes. TikTok supports up to
10 target accounts per sandbox. Use that sandbox's Client key and Client secret
as the server-side `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET` values.
Do not use a TikTok account password as either value.

Set the deployed `APP_URL` to `https://360creatorhub.vercel.app`. For local
testing, use an HTTPS tunnel and register its exact callback instead of HTTP
localhost. Reconnect accounts after the implementation requests the new scopes.

Implementation must distinguish an inbox upload awaiting user action from a
completed post. Direct Post must query current creator information, offer the
returned privacy choices and required publishing controls, and track asynchronous
post status. Public Direct Post requires TikTok's audit to lift visibility
restrictions.

References: [Sandbox setup](https://developers.tiktok.com/docs/en/add-a-sandbox),
[Upload drafts](https://developers.tiktok.com/docs/en/content-posting-api-get-started-upload-content),
[Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-get-started).

## Existing account connection implementation

1. Register at https://developers.tiktok.com/ and create an app under Manage apps.
2. Select Web, complete the app details (including real website, privacy policy,
   and terms URLs), and add Login Kit with `user.info.basic` access.
3. Register `https://360creatorhub.vercel.app/api/platforms/tiktok/callback` as
   the Login Kit redirect URI. If your domain changes, update both this value
   and `APP_URL` on the app host. Use the same origin when opening CreatorHub.
4. Copy Client key and Client secret from Credentials into the host's
   `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET` environment variables.
   Keep the secret server-side. The existing `ENCRYPTION_KEY` must also be set.
5. Deploy the changes. For sandbox testing, configure the target accounts in
   TikTok's sandbox; public access depends on TikTok app review.
6. In CreatorHub, use TikTok > Connect, then Add account for each further login.
   Switch accounts on TikTok's authorization page. If TikTok reuses a login,
   sign out of TikTok in that browser first, keeping CreatorHub signed in.

The account list shows each profile separately. Reauthorizing the same account
updates its credentials. The first account is default; changing defaults and
disconnecting individual accounts never affects another CreatorHub user's rows.
Removing a default account promotes a remaining account. Disconnect attempts to
revoke the TikTok grant; if TikTok is unavailable or the token has expired,
local credentials are still removed. Access can also be revoked inside TikTok.

The connection flow requests only profile access. Direct Post and scheduled
TikTok publishing are not implemented in this change, and publishing now returns
an explicit error instead of the previous mock success. For a future Direct Post
integration, add Content Posting API, obtain `video.publish` permission, and
complete TikTok's audit and required publishing UI before public posting.

## Verification

Use HTTPS for local testing (a tunnel with its URI registered in TikTok).
Connect two sandbox accounts; check that both appear, change the default,
reconnect either account to verify there is no duplicate, and disconnect the
default to check that the remaining account becomes default. Cancel consent and
confirm the app returns an error without creating a connection.

References: [App registration](https://developers.tiktok.com/docs/en/getting-started-create-an-app),
[Web Login Kit](https://developers.tiktok.com/doc/login-kit-web/),
[Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-get-started).
