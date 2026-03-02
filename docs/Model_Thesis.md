# Travel Tier — Model Thesis (Prototype)

Travel Tier is a **transparent framework for aligning travel decisions with personal priorities**.

It is not a claim that there is an objectively “best” city.

---

## What the score means

Travel Tier produces an **Alignment Score (0–100)**.

- Each city has component scores (0–100) for key drivers (flight, hotel, dining, culinary density, shopping, safety + transit).
- You provide raw priority weights (0–100 each).
- We normalize weights internally into **shares** that sum to 1.
- The Alignment Score is the weighted blend of component scores.

This makes tradeoffs explicit and adjustable.

---

## Core formula

Let:

- `s_k(city)` be the component score for driver `k` (0..100)
- `w_k` be your raw slider weight (0..100)
- `ŵ_k = w_k / Σ(w)` be the normalized weight share (0..1)

Then:

`Alignment(city) = Σ_k ( ŵ_k × s_k(city) )`

---

## Design principles

1) **Transparency over magic**
- The product must show the “why” (drivers and contributions).
- No hidden boosts.

2) **Tradeoffs, not winners**
- Rankings change when priorities change.
- The system surfaces “fit,” not objective truth.

3) **No false precision**
- This is a prototype with curated estimates.
- We avoid implying predictive certainty without validation.

---

## Interpretation rules

- Two cities within a few points are often “close” — treat them as tradeoffs.
- If rankings feel wrong, adjust priorities; the model is a lens, not a verdict.
- Use Compare to see which drivers create separation.

---

## Known limitations (prototype)

- Data is curated estimates, not live API feeds yet.
- Some dimensions may be correlated (double-count risk when both weights are high).
- Coverage varies; missing values may compress differences.

---

## Next integrity upgrades

- Clarify cost vs value metrics (rename / re-derive “value” when possible).
- Correlation warnings to reduce accidental double-counting.
- Validation loop: post-trip feedback to calibrate scoring and uncertainty.


