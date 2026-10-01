# MEDGUARD

**Scan. Verify. Administer Safer.** — bedside medication safety for Hajj and Umrah emergency units.

An app (PWA) on the nurse's own phone. The nurse scans the pilgrim's wristband
or Hajj health card, then the medication. MEDGUARD runs three safety checks at
once and shows **one** signal instead of a stream of pop-ups:

| Signal | Meaning | What the nurse can do |
|---|---|---|
| 🔴 critical | Recorded allergy, kidney contraindication, expired pack | **Nothing to override.** Ask the doctor to change the drug. |
| 🟠 warning | Major drug interaction, or any kidney alert (dose adjustment, avoid, eGFR missing) | Continue only with a reason, recorded in the audit trail |
| 🟢 safe | Nothing worth interrupting for | Confirm and give |

Everything else is kept in a collapsed list under the result.

## Scope

Hajj and Umrah only, for two groups whose data already exists electronically:

| Pilgrims | Source | Standard | Scanned |
|---|---|---|---|
| Saudi citizens and residents | Electronic health record | HL7 FHIR | Wristband barcode (national ID / iqama) |
| Indonesian pilgrims | Hajj health card KKJH | International Patient Summary (IPS, built on FHIR) | QR on the card (`KKJH:<number>`) |

Only the **critical profile** is read, never the whole record:
allergies (`AllergyIntolerance`), current medicines (`MedicationStatement`),
chronic conditions (`Condition`), latest eGFR and blood type (`Observation`).

## The three checks (rules, not AI)

`src/engine/checks.ts` — deterministic and testable. They decide the colour.

1. **Allergy** — by drug family (penicillin allergy blocks amoxicillin).
2. **Interactions** — the new drug against the pilgrim's current medicines.
3. **Dose vs. kidneys** — against the latest eGFR. With no eGFR on record the
   app does not stop: it runs the other checks and shows
   "⚠️ أظهرنا التعارضات المتاحة، قراءة الكلى مفقودة".

## Where the AI is

> The rules find the risk and decide the colour. Claude decides what is worth
> interrupting the nurse for. Red never goes through Claude.

**One AI role: alert ranking** (`src/engine/alertRanker.ts`, `api/rank-alerts.ts`,
`src/lib/ranking.ts`). After the rules run, the non-critical alerts are sent to
Claude (Haiku, via a Vercel server function so the key never reaches the phone).
Claude returns them in order of importance with a one-line reason each. Guards,
all in code and all tested:

- Critical findings are never sent and never reordered.
- Claude orders alerts only inside their own severity band. The colour cannot change.
- The reply must contain exactly the alerts that were sent, or it is rejected.
- Nothing that identifies the pilgrim is sent, and no lab value: kidney alerts go
  out as fixed generic text (no eGFR value, no age, no condition). What does leave
  the device is the alert kind, its severity band, and the name of a current
  medicine when the alert is an interaction with it. A test checks this for every
  demo pilgrim and drug.
- No reply within 2 seconds, offline, or no API key → fixed fallback order.
  The safety decision does not depend on the network.

Not AI, and not presented as AI: scanning, reading the record, the three checks.

## Offline

A service worker (`sw/sw.template.js`, built into `dist/sw.js`) caches every built
file after the first online visit, so the app opens, scans and runs the checks with
no connection. Tested in a real browser: load once, cut the network, reload.

| Part | Offline |
|---|---|
| App shell, scanning, the three checks, the colour | ✅ after one online visit |
| Indonesian KKJH data | ✅ by design: the card's QR carries the IPS data itself (GovInsider), so no lookup is needed. The demo uses an invented `KKJH:<number>` payload; the real QR must be decoded as IPS |
| Saudi / resident record | ⚠️ needs a read from the hospital system, or data preloaded for a camp. Not connected: the prototype uses demo data |
| Claude ranking | ❌ → fixed fallback order. Never cached, never faked |

## Data sources: what is verified and what is not

| Claim | Status |
|---|---|
| KKJH card QR holds IPS data (allergies, medicines, history), readable without a special app | ✅ published (GovInsider) |
| KKJH includes an eGFR | ❓ not stated in the source, so the app handles a missing eGFR explicitly |
| Saudi hospital record readable by a third-party app through FHIR | ❓ not verified. Production design: a read-only FHIR query to the hospital's own system. The prototype uses demo data |
| Wristband barcode carries the national ID / iqama | ✅ confirmed by the nursing team |

## Printable stage props

```bash
npm run labels   # → print/labels.html, open and print on A4 at 100% scale
```

Wristbands (Code 128, national ID / iqama), Indonesian KKJH cards (QR) and
medicine pack labels (GS1 DataMatrix with expiry and batch, plus one expired
backup pack), all generated from `src/data`. `scripts/labels.test.ts` decodes
every printed code with the same ZXing library as the camera.
`print/medguard-labels.pdf` is a ready-to-print copy.

## Run it

```bash
npm install
npm run dev      # local dev server
npm test         # engine + ranking + API test suite
npm run build    # production build
```

The camera only works over HTTPS, so test scanning on the phone through the
Vercel deployment, not the local dev server.

## Project layout

```
src/engine/      pure decision engine + alert-ranking guards (no UI, no network)
src/data/        demo pilgrims, drugs, interactions (JSON) — edited by the nursing team
src/nurse/       app screens (login, scan, pilgrim card, drug scan, result, profile, calculator, settings)
src/lib/         session, audit log, Claude ranking client, sound, preferences
api/             Vercel server function: Claude alert ranking
scripts/         printable labels generator + scan test
docs/            data template for the nursing team
```

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel project settings | Enables Claude alert ranking. Without it the app uses the fixed fallback order. |

## Stage backup

Settings → "وضع العرض التجريبي" shows simulate-scan buttons on the scan screens,
in case the camera or lighting fails during the live demo.

## Data disclaimer

All pilgrims, ID numbers and product codes are invented for the demo (GTIN
prefix 628-999). Clinical rules must be reviewed and signed off by the nursing
team. This is a hackathon prototype, not a medical device.
