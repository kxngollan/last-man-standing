# Getting on the App Store and Google Play

The code side of store compliance is done — this file is the part that lives in
App Store Connect and the Play Console, plus the handful of values only you can
supply. Verified against Apple's App Store Review Guidelines and Google Play's
policy pages in August 2026; check the dates below if you are reading this much
later.

## Do these first

**1. Confirm the bundle ID and package name — this is permanent.**

Both are currently `com.lastmanstanding.app`, in `app.json`. Once a build is
uploaded under an identifier it can never be changed or reused, so change it now
if you want something else. It does not have to match your domain.

**2. Put the server somewhere with an https address.**

The app is useless without one, and a reviewer opening an app whose every screen
fails is an Apple 2.1 rejection. On the server set:

| Variable | Why |
| --- | --- |
| `APP_URL` | Canonical site URL. Email links, sitemap and share URLs all derive from it, and it still defaults to `http://localhost:3000`. |
| `SUPPORT_EMAIL` | Shown on `/policy` and `/delete-account` as the way to reach you. Defaults to `support@lastmanstanding.app` — **make sure that mailbox exists and is read**, because it is the route for someone locked out of their account, and Play checks it. |

**3. Point the app at that server.**

`app.config.ts` refuses to build a `production` or `preview` profile unless
`EXPO_PUBLIC_API_URL` is set to an https URL, so this cannot be forgotten:

```bash
eas env:create --name EXPO_PUBLIC_API_URL --value https://your-domain \
  --environment production --visibility plaintext
```

**4. Link the EAS project and fill in the App Store Connect app ID.**

`eas init` writes `extra.eas.projectId` into the config. Then create the app
record in App Store Connect and replace `REPLACE_WITH_APP_STORE_CONNECT_APP_ID`
in `eas.json` with the App ID from **App Information → General Information**.

**5. Make a review account.**

The app is entirely behind a login, so Apple needs working credentials in the
App Review notes or it will be rejected under 2.1. Do not use the seed accounts
from the repo README — `player@dev.local` is not a real address and the password
is public. Create a real account, and make sure it is:

- email-verified (sign-up alone leaves it unverified and unable to log in);
- **not** an admin, because admin accounts cannot self-delete and a reviewer may
  well test the delete flow;
- already joined to a game that is running, so the reviewer sees the actual app
  rather than an empty state.

Give Google the same credentials under **App content → App access**.

## Store listing assets

You need to produce these; nothing in the repo can generate them.

| Asset | Requirement |
| --- | --- |
| iPhone screenshots | 6.9" display, 1260 × 2736 portrait, 1–10 images, no alpha channel. Required. |
| iPad screenshots | Not needed — `ios.supportsTablet` is `false`, so the app ships iPhone-only. |
| Play screenshots | At least 2, 16:9 or 9:16, 320–3840 px per side. |
| Play feature graphic | 1024 × 500, no transparency. Required. |
| Play app icon | 512 × 512 PNG. Generate from `assets/images/icon.png`. |
| App icon | Done — `scripts/make-icons.py` draws the set from the design tokens. Replace with real artwork whenever you have some; keep the sizes and the transparency rules noted in that script. |

Support URL and marketing URL both want a real page — `/` works for marketing,
and a support page or the `SUPPORT_EMAIL` mailbox covers support.

## App Privacy (Apple) and Data safety (Google)

These questionnaires are mandatory, hand-entered, and a wrong answer is its own
rejection. What the app actually collects, read off the sign-up flow and
`src/api/client.ts`:

| Data | Apple category | Play category | Purpose | Linked to identity | Used for tracking |
| --- | --- | --- | --- | --- | --- |
| First and last name | Contact Info → Name | Personal info → Name | App Functionality — shown to other players on the standings | Yes | No |
| Email address | Contact Info → Email Address | Personal info → Email address | App Functionality — sign-in, verification, password reset | Yes | No |
| Date of birth | Other Data | Personal info → Other info | App Functionality — the 16+ age gate | Yes | No |
| Picks, entries, results | Other Data | App activity → Other actions | App Functionality — running the game | Yes | No |
| Feedback and issue reports | User Content | App activity → Other actions | Customer Support | Yes | No |

Answer **no** to everything else. In particular:

- **No tracking, no advertising, no analytics.** There is no analytics or ad SDK
  in `package.json` — do not tick Usage Data or Diagnostics.
- **No biometric data.** `expo-local-authentication` asks the operating system to
  verify a face or fingerprint; the app never sees or stores biometric data, and
  it never leaves the device. Do not declare it.
- **The session token is not "collected".** It is held in the device keychain by
  `expo-secure-store` and never sent anywhere except back to your own server as
  a bearer token.

Play's Data safety form additionally asks:

| Question | Answer |
| --- | --- |
| Is all data encrypted in transit? | **Yes** — the build cannot ship a non-https API URL. |
| Do you provide a way for users to request data deletion? | **Yes** |
| Data deletion URL | `https://your-domain/delete-account` |
| Committed to Play Families policy? | **No** — the app is 16+, not aimed at children. |

## Age rating and the contest questions

This is where a football game most easily gets itself rejected. The app is a
**free contest with no stakes**, and the answers have to say exactly that.

Apple's questionnaire, under Chance-Based Activities:

| Question | Answer |
| --- | --- |
| Gambling | **No** — no real-money gambling of any kind |
| Simulated Gambling | **None** — no casino, cards, slots or simulated betting |
| Contests | **Frequent** — a weekly contest is the whole app |
| Loot Boxes | **No** |

Google's IARC questionnaire: no violence, no sexuality, no profanity, no
drug references, **no gambling and no simulated gambling**.

Apple's tiers now include 13+, 16+ and 18+, so a 16+ rating is available and
matches the app's own age gate. Whatever rating the questionnaire produces, the
16+ gate in `src/app/sign-up.tsx` keeps applying — the store rating describes
content, the gate enforces eligibility.

Because it is a contest, Apple guideline 5.3.1 requires you to be the sponsor
and 5.3.2 requires the official rules to be in the app. The rules screen at
`src/app/(app)/rules.tsx` covers both, including the line saying Apple is not a
sponsor. If you change how the game works, change it there too.

There is deliberately no real-money element anywhere. Keep it that way unless you
are ready for guideline 5.3.4, which would mean gambling licences, geo-fencing to
licensed territories, and in the UK a Gambling Commission licence.

## Other declarations

| Item | Answer |
| --- | --- |
| Export compliance | Exempt — the app only uses https and the platform keychain. Already declared: `ITSAppUsesNonExemptEncryption: false` in `app.json`, so App Store Connect will stop asking on every build. |
| EU Digital Services Act trader status | Required in App Store Connect **and** the Play Console before you can distribute in the EU. You must declare whether you are a trader and, if so, publish your name, address, phone and email. |
| Content rights | **Yes** — the app displays third-party content (fixtures, results and club crests). Answer this honestly; see the section below. |
| Terms of service | Not required by either store. Apple's standard EULA applies by default, and the rules screen carries the terms that matter for the game itself. |

## Third-party content — read this before you submit

The one thing here that code cannot settle for you.

**Club crests.** The app renders Premier League club badges, fetched from
`crests.football-data.org` (`src/components/crest.tsx`, `components/portal/TeamCrest.tsx`).
Those badges are the clubs' registered trade marks. Getting them through an API
is not a licence to publish them, and Apple guideline 5.2.1 and Play's
Intellectual Property policy both allow a takedown on a rights-holder complaint —
which for football badges is a real risk rather than a theoretical one. Your
options, cheapest first:

1. Drop the crests and show team names and the three-letter codes instead. The
   `Crest` component already falls back to a TLA disc when it has no image, so
   this is a small change rather than a redesign.
2. Replace them with your own non-infringing marks — colour discs, initials.
3. Get written permission from the rights holder. Slowest, and unlikely at this
   scale.

**Data attribution.** Fixtures and results come from football-data.org, now
credited on `/policy` and on the app's rules screen. Their published terms were
not reachable when this was written — check the terms attached to your API plan
and match whatever wording it asks for.

## User-generated content

Players choose their own first and last name and those names are shown to every
other player on the standings and profiles. That makes them user-generated
content, and Apple guideline 1.2 expects apps with UGC to have a way to filter
objectionable material and to report it.

What exists today: names are length-bounded (`lib/validation.ts`), the rules
screen says an offensive name can get an account removed, and both clients have a
"Report an issue" route into `/api/mobile/issues`. That is a defensible position
for a small contest app with no free-text chat, and it is what to point at if a
reviewer raises 1.2. If they push back, the cheapest answer is a profanity filter
on the name field in `lib/validation.ts`, applied in one place for both clients.

## Google Play production access

If your Play developer account is a **personal** account created after
13 November 2023, Google will not grant production access until you have run a
closed test with **at least 12 testers opted in continuously for 14 days**. Plan
for that fortnight — it is the longest lead time in this whole list. Organisation
accounts are exempt.

## Android target API level

New submissions must target API 36 from **31 August 2026**. React Native 0.86.2
already sets `targetSdk = 36` in its version catalog, which Expo SDK 57 uses, so
you are compliant with no configuration. If you ever pin these yourself, use
`expo-build-properties` and keep `targetSdkVersion` at 36 or higher.

## Build and submit

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

`autoIncrement` with `appVersionSource: "remote"` means EAS owns the iOS build
number and the Android version code, so a second upload can never collide with
the first. That is why neither appears in `app.json` — only `version`, which is
the user-visible string you bump for a release.

`eas submit --platform ios` will fail until you have replaced the placeholder
`ascAppId` in `eas.json`, which you cannot do until the App Store Connect record
exists. That ordering is deliberate, not an oversight.
