# MEDGUARD

**Scan. Verify. Administer Safer.** — bedside medication safety with AI alert triage.

The nurse scans the patient's wristband and the medication. MEDGUARD runs every
check at once and shows **one** signal instead of a stream of pop-ups:

| Signal | Meaning |
|---|---|
| 🔴 critical | Do not give: documented or AI-detected allergy, expired pack, renal contraindication |
| 🟠 interaction | Major drug interaction: confirm with a reason |
| 🟡 renal | Dose must be adjusted for kidney function (adjusted dose suggested) |
| 🟢 safe | Nothing worth interrupting for |

Everything else is kept in a collapsed, ranked list under the result.

## How the AI fits in

> The rules protect, our model ranks, and the language model catches what the rules miss.
> AI can raise risk. It can never lower it.

1. **Clinical rules** (`src/engine/checks.ts`) — the safety floor. Deterministic.
2. **Ranking model** (`src/engine/ranker.ts`) — logistic regression that predicts
   how likely a nurse is to dismiss a finding as noise, and orders the deferred
   list. Learns from override reasons. Never changes the colour.
3. **Clinical-note analyzer** (`src/engine/noteAnalyzer.ts`) — reads free-text
   notes for reactions never entered in the allergy field (e.g. "rash after
   Augmentin"). Output is only accepted if the quoted evidence exists verbatim
   in the record, and it can only add critical findings.

All three guarantees are covered by tests in `src/engine/engine.test.ts`.

## Hajj card (pilgrim with no wristband)

During Hajj season many ER patients are pilgrims with no hospital record yet.
Home → "مريض حاج بدون سوار" scans the QR on the Hajj card (`HAJJ:H-1447-208153`,
or the number typed by hand) and reads what the pilgrim declared at
registration: allergies, chronic conditions, current medicines, language and
campaign contact. After the nurse confirms identity, the normal drug scan runs:

- A card-declared allergy is **red**, like a documented one, until a doctor reviews it.
- Card medicines feed the interaction check.
- There is no eGFR yet, so it is never assumed normal. Kidney-dosed drugs turn
  **yellow ("يحتاج تحليل كلى")** when the card declares kidney disease or the
  patient is 65+, otherwise they are a deferred note.

Demo registry: `src/data/pilgrims.json`. Scanning a card on the wristband screen
also works.

## Printable stage props

```bash
npm run labels   # → print/labels.html, open and print on A4 at 100% scale
```

Wristbands (Code 128), Hajj cards (QR) and medicine pack labels (GS1 DataMatrix
with expiry and batch, plus one expired backup pack), all generated from
`src/data`. `scripts/labels.test.ts` decodes every printed code with the same
ZXing library as the camera and checks it resolves to the right patient or drug.
`print/medguard-labels.pdf` is a ready-to-print copy.

## Run it

```bash
npm install
npm run dev      # local dev server
npm test         # engine test suite
npm run build    # production build
```

The camera only works over HTTPS, so test scanning on the phone through the
Vercel deployment, not the local dev server.

## Project layout

```
src/engine/      pure decision engine (no UI, no network)
src/data/        demo data (JSON) — edited by the nursing team
src/nurse/       nurse app screens (login, scan, Hajj card, result, profile, calculator, settings)
scripts/         printable labels generator + scan test
src/components/  shared UI (buttons, cards, bottom sheet, camera scanner)
src/lib/         session state, event log, note analyzer client, sound, preferences
api/             Vercel serverless function for the language-model note analyzer
docs/            data template for the nursing team
```

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel project settings | Enables the language-model note analyzer. Without it the app uses the offline matcher. |

Only note text, date and author are sent to the analyzer — never names or record ids.

## Stage backup

Settings → "وضع العرض التجريبي" shows simulate-scan buttons on the scan screens,
in case the camera or lighting fails during the live demo.

## Data disclaimer

All patients and product codes are invented for the demo (GTIN prefix 628-999).
Clinical rules must be reviewed and signed off by the nursing team. This is a
hackathon prototype, not a medical device.
