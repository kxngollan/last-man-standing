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
| `APP_URL` | Canonical site URL. Email links, sitemap and share URLs all derive from it, and it still defaults to `http://localhost:3000`. Already set correctly on the live deploy — `robots.txt` and `sitemap.xml` both read `https://www.footballlms.com`. |
| `SUPPORT_EMAIL` | Shown on `/policy` and `/delete-account` as the way to reach you. **Not set on the live deploy** — both pages currently print the code default, `support@lastmanstanding.app`, which is not a domain you own. Set it to a mailbox that exists and is read: it is the route for someone locked out of their account, and Play verifies it. |

**3. Point the app at that server.**

`app.config.ts` refuses to build a `production` or `preview` profile unless
`EXPO_PUBLIC_API_URL` is set to an https URL, so this cannot be forgotten. Both
profiles now carry it in `eas.json`, pointing at `https://www.footballlms.com`;
if you move the server, change it in both places or the internal test builds go
on pointing at the old one. To keep it out of the repo instead, use an EAS
environment variable and drop the `env` block:

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

All of these are generated. `store/` is gitignored — regenerate rather than
edit, and never commit it: the raw captures are of a live account.

```bash
python3 scripts/make-store-assets.py   # Play icon + feature graphic
python3 scripts/make-screenshots.py    # both screenshot sets, from store/raw/
```

| Asset | Requirement | Where |
| --- | --- | --- |
| iPhone screenshots | 6.9" display, 1260 × 2736 portrait, 1–10 images, no alpha. Required. | `store/ios/` — four |
| iPad screenshots | Not needed — `ios.supportsTablet` is `false`, so the app ships iPhone-only. | — |
| Play screenshots | At least 2, 320–3840 px per side, aspect no wider than 2:1. | `store/play/` — four, 1080 × 1920 |
| Play feature graphic | 1024 × 500, no transparency. Required. | `store/play/feature-graphic-1024x500.png` |
| Play app icon | 512 × 512 PNG, no alpha. | `store/play/icon-512.png` |
| App icon | Done — `scripts/make-icons.py` draws the set from the design tokens. Replace with real artwork whenever you have some; keep the sizes and the transparency rules noted in that script. | `assets/images/` |

### Recapturing the screenshots

The captures in `store/raw/` came off the Android emulator running the app in
Expo Go against production. To redo them:

```bash
adb shell settings put global sysui_demo_allowed 1          # clean status bar
adb shell am broadcast -a com.android.systemui.demo -e command enter
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0900
adb shell am broadcast -a com.android.systemui.demo -e command network -e mobile hide -e wifi show -e level 4 -e fully true
adb shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081/--/fixtures"
adb exec-out screencap -p > store/raw/04-fixtures.png
```

The empty path (`/--/`) does not route to the index — reach Standings through
the drawer instead. Captions and listing order live in `SHOTS` in
`scripts/make-screenshots.py`; a raw file with no entry there is skipped, which
is how `store/raw/unused/` stays out of the listing.

**Two things to decide before uploading these.** The standings shot shows other
players' names, abbreviated but real, and a store listing is public in a way the
in-app board is not — swap in a demo account's game if that matters to you. And
every shot but the rules screen shows club crests, which is the trade mark
exposure described under *Third-party content* below, now on a public page that
rights holders' agents actually scan.

Support URL and marketing URL both want a real page. Use `/support` for support
— it explains how to reach us, how to recover an account you are locked out of,
and how to report a player's name, without needing a session — and `/` for
marketing. `/help` and `/contact` redirect to `/support`, so any of the three
works if you type the wrong one into a console field.

`/support` prints `SUPPORT_EMAIL`, so it is only as good as that variable. Set
it before you paste the URL into either console.

## App Privacy (Apple) and Data safety (Google)

These questionnaires are mandatory, hand-entered, and a wrong answer is its own
rejection. What the app actually collects, read off the sign-up flow and
`src/api/client.ts`:

| Data | Apple category | Play category | Purpose | Linked to identity | Used for tracking |
| --- | --- | --- | --- | --- | --- |
| First and last name | Contact Info → Name | Personal info → Name | App Functionality — shown to other players on the standings | Yes | No |
| Email address | Contact Info → Email Address | Personal info → Email address | App Functionality — sign-in, verification, password reset | Yes | No |
| Date of birth | Other Data | Personal info → Other info | App Functionality — the 13+ age gate | Yes | No |
| Parental-permission declaration | Other Data | Personal info → Other info | App Functionality — the under-16 permission check | Yes | No |
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
| Committed to Play Families policy? | **Read the section below before answering.** The minimum age is 13, so 13–15 year olds are a permitted audience and this is no longer an automatic no. |

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

Apple's tiers now include 13+, 16+ and 18+. The app's own floor is 13, so a 13+
rating matches it. Whatever rating the questionnaire produces, the gate in
`lib/age.ts` keeps applying — the store rating describes content, the gate
enforces eligibility.

### The under-16 band, and what it costs you

`MIN_AGE` is 13 and `PARENTAL_CONSENT_AGE` is 16 (`lib/age.ts`). A player aged
13, 14 or 15 must tick a box saying a parent or guardian has given permission;
the server refuses to create the account without it and records the declaration
on the user. It is a self-declaration, not verified parental consent — nobody
contacts the guardian.

That distinction is the thing to be deliberate about:

- **Google Play.** Under **App content → Target audience and content**, you now
  have to include the 13–15 age band. Naming any under-18 band makes the app a
  mixed-audience app and brings the **Families policy** into scope, which is why
  the table above no longer answers it for you. Expect the ads, data-safety and
  content-rating questions to be applied more strictly.
- **Apple.** A 13+ rating is fine, but an app whose audience includes minors
  attracts more scrutiny on data collection and on anything social. The
  standings show other players' names, which is the part a reviewer would look
  at.
- **UK GDPR.** 13 is the UK's age of digital consent, so a 13 year old can
  consent for themselves here. Several EU states set it at 14, 15 or 16, and a
  self-declared tick box is not "verifiable parental consent" in those
  territories. If you distribute EU-wide and want to be strict about it, the
  options are to raise `MIN_AGE` back to 16 for those markets or to build real
  guardian-email verification.
- **US COPPA** does not apply, since nobody under 13 can hold an account.

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

**Club crests.** Club badges are the clubs' registered trade marks. Getting them
through an API is not a licence to publish them, and Apple guideline 5.2.1 and
Play's Intellectual Property policy both act on a rights holder's complaint
rather than weighing the merits — which for football badges is a real risk, not a
theoretical one.

This is now a setting rather than a rewrite. `CREST_STYLE` (`lib/crests.ts`)
decides what gets stored on each team at sync time:

| `CREST_STYLE` | What renders | Where it stands |
| --- | --- | --- |
| `pixel` (default) | Our own pixelated copies from `public/crests/`, generated by `scripts/pixelate-crests.py` | A smaller target. Not a defence — see below |
| `official` | The club's real badge, hotlinked | What the app shipped with. Highest exposure |
| `none` | The lettered disc both clients already draw when a badge is missing | Nothing to complain about |

Changing it means re-running the team sync (`npm run seed`, or Seed from
/admin), because the resolved value is written to `Team.crest` — it is not
resolved at render time.

**Be clear about what pixelation buys you.** It is risk reduction, not
compliance. A badge has to stay recognisable to be worth putting on a team row,
and recognisable is precisely what a trade mark protects, so a pixelated crest
still identifies the club — and is now also a derivative of the club's artwork.

It is also worth being clear about what *fair use* does and does not do here,
because it is the usual reason people talk themselves into keeping the badges:

- Fair use is a **copyright** doctrine. Crests are mainly a **trade mark**
  problem, where the analogous defences are nominative use (US) and honest
  practices / descriptive use (UK, s.11 Trade Marks Act 1994).
- **Being free does not help.** Shipping through an app store is a commercial
  channel, and infringement turns on likelihood of confusion and unfair
  advantage taken of the mark's reputation, not on whether money changes hands.
- **Nominative use covers the name, not the badge.** It permits only as much of
  the mark as is needed to identify the thing — and "Arsenal" in text identifies
  Arsenal perfectly well, which is what makes the stylised badge the weak point.
- **Marketing use is the weakest ground of all**, and store screenshots and the
  feature graphic are marketing.

None of that is legal advice. The practical position: `CREST_STYLE=none`, club
names in text, and a line on the rules screen saying the app is not affiliated
with any club or with the Premier League, is the combination with nothing to
argue about. Everything above `none` is a judgement call about how much risk is
worth a prettier team row.

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
"Report an issue" form with a **Player's name** category — the website's dialog
in `components/portal/ReportIssueModal.tsx`, the app's screen at
`mobile/src/app/(app)/report.tsx`, reachable from the drawer and from Settings.
Both post to the same endpoint and land in one admin queue at `/admin`.

If a reviewer raises 1.2, that is what to point at: **Menu → Report an issue →
Player's name**. Say it in the review notes rather than making them find it. That
is a defensible position for a small contest app with no free-text chat. If they
push back, the cheapest next step is a profanity filter on the name field in
`lib/validation.ts`, applied in one place for both clients.

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
