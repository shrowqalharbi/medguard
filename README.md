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
src/engine/   pure decision engine (no UI, no network)
src/data/     demo data (JSON) — edited by the nursing team
docs/         data template for the nursing team
```

## Data disclaimer

All patients and product codes are invented for the demo (GTIN prefix 628-999).
Clinical rules must be reviewed and signed off by the nursing team. This is a
hackathon prototype, not a medical device.
