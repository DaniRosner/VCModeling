window.SEED_PORTFOLIO = {
  asOfDate: "2026-06-10",
  fundName: "Maccabee Ventures Fund II, LP",
  assumptions: {
    capitalCalled: 2329982,
    managementFeePct: 2.5,
    carryPct: 20,
    hurdlePct: 0,
    waterfallStyle: "european",
    safeMarkMode: "cost"
  },
  companies: [
    { id: "anchor-forge", name: "Anchor Forge Ltd.", shares: 217391, cost: 99999.86, value: 99999.86, ownershipPct: 0.4545, fdShares: 47826079, outstandingShares: 43043471, tranches: [
      { id: "anchor-seed", type: "priced", name: "Series Seed Preferred", date: "2025-08-13", shares: 217391, cost: 99999.86, value: 99999.86, price: 0.46, seniority: 1, liqMultiple: 1, participation: "non", simplifyingAssumption: "Assumes standard early-stage preferred economics: 1x non-participating liquidation preference, rank 1 / pari passu. This assumption is not based on the data provided.", source: "Ancor_Cap table - all.xlsx: Maccabee/Moshe deferred closing row shows 217,391 shares, 0.5050% issued ownership, 0.4545% FD ownership, and total FD shares of 47,826,079; legal terms still not cleanly parsed into model" }
    ] },
    { id: "covered-health", name: "Covered Health Inc, Inc. dba Protego", shares: 49999, cost: 499.99, value: 499.99, ownershipPct: 0.5, fdShares: 9999800, tranches: [
      { id: "covered-common", type: "common", name: "Common Stock", date: "2025-01-06", shares: 49999, cost: 499.99, value: 499.99, advisorShare: true, price: 0.01, seniority: 99, liqMultiple: 0, participation: "common", source: "SOI; Covered RSA/advisor documentation provided" }
    ] },
    { id: "eraborn", name: "Eraborn, Inc.", shares: 1666, cost: 100000, value: 100000.02, ownershipPct: 3, fdShares: 55533, tranches: [
      { id: "eraborn-safe", type: "safe-pre", name: "SAFE", date: "2026-05-01", shares: 0, cost: 100000, value: 100000, valuationCap: 6000000, discountPct: 20, proRata: false, cashOutMultiple: 1, source: "eraborn-inc-form-of-safe: $100k purchase amount, $6M valuation cap, 80% discount rate, capitalization excludes converting securities" },
      { id: "eraborn-options", type: "option", name: "Options - Common Stock", date: "2026-05-06", shares: 1666, cost: 0, value: 0.02, advisorShare: true, strikePrice: 0, vestedPct: 100, seniority: 99, liqMultiple: 0, participation: "common", source: "SOI; advisory option agreement provided separately" }
    ] },
    { id: "get-sonar", name: "Get Sonar, Inc.", shares: 65139, cost: 50000.65, value: 50000.65, ownershipPct: 0.6552, fdShares: 9942221, outstandingShares: 9284319, tranches: [
      { id: "get-sonar-common", type: "common", name: "Common Stock", date: "2025-12-16", shares: 65139, cost: 0.65, value: 0.65, advisorShare: true, price: 0.00001, seniority: 99, liqMultiple: 0, participation: "common", vestingMonths: 12, source: "sonar_2026-06-22 cap table: Maccabee Ventures Management, LLC row shows 65,139 common shares, 0.7016% outstanding ownership, and 0.6552% FD ownership; stock purchase agreement confirms $0.00001/share and 12-month vesting" },
      { id: "get-sonar-safe", type: "safe-post", name: "SAFE", date: "2025-12-16", shares: 0, cost: 50000, value: 50000, valuationCap: 10000000, discountPct: 0, proRata: false, cashOutMultiple: 1, source: "get-sonar-inc-safe: $50k purchase amount, $10M post-money valuation cap, YC post-money cap form with no separate discount filled in" }
    ] },
    { id: "grace-care", name: "Grace Care Navigation Services, Inc.", shares: 0, cost: 100000, value: 100000, ownershipPct: 0, fdShares: 10000000, tranches: [
      { id: "grace-safe", type: "safe-post", name: "SAFE", date: "2025-09-28", shares: 0, cost: 100000, value: 100000, valuationCap: 7000000, discountPct: 15, proRata: false, cashOutMultiple: 1, qualifiedFinancingMin: 3000000, source: "maccabee-vc-grace-care-safe: $100k purchase amount, $7M post-money valuation cap, 85% discount rate, $3M qualified financing threshold" }
    ] },
    { id: "joshu", name: "Joshu Inc.", shares: 151080, cost: 300000, value: 300000.01, ownershipPct: 0.7604, fdShares: 19867421, outstandingShares: 14536023, tranches: [
      { id: "joshu-safe-2024", type: "safe-post", name: "SAFE 2024", date: "2024-04-18", shares: 0, cost: 200000, value: 200000, valuationCap: 16000000, discountPct: 20, proRata: false, cashOutMultiple: 1, mfn: true, source: "joshu-inc-safe-2024: $200k purchase amount, $16M post-money valuation cap, 80% discount rate, MFN provision" },
      { id: "joshu-warrants", type: "warrant", name: "Common Stock Warrants", date: "2025-03-04", shares: 151080, cost: 0, value: 0.01, strikePrice: 0.01, vestedPct: 100, seniority: 99, liqMultiple: 0, participation: "common", source: "joshu-inc_2026-06-23 cap table: Maccabee Ventures Fund II, LP row shows 151,080 common warrants and 0.7604% FD ownership; warrant agreement confirms $0.01/share exercise price" },
      { id: "joshu-safe-2025", type: "safe-pre", name: "SAFE 2025", date: "2025-03-04", shares: 0, cost: 100000, value: 100000, valuationCap: 16000000, discountPct: 20, proRata: false, cashOutMultiple: 3, source: "joshu-safe-2025: $100k purchase amount, $16M pre-money valuation cap, 80% discount rate, liquidity cash-out is 300% of purchase amount" }
    ] },
    { id: "liquidonate", name: "LiquiDonate Inc.", shares: 145232, cost: 200000, value: 200000, ownershipPct: 1.309, fdShares: 11095646, outstandingShares: 9708021, tranches: [
      { id: "liquidonate-seed3", type: "priced", name: "Series Seed-3 Preferred", date: "2024-08-29", shares: 145232, cost: 200000, value: 200000, price: 1.38, seniority: 1, liqMultiple: 1, participation: "non", source: "User-provided current metrics: 145,232 shares equal 1.496% outstanding ownership and 1.309% FD ownership; Major Investor rights letter confirms 72,616-share threshold for Major Investor treatment" }
    ] },
    { id: "lira-ai", name: "Lira AI Ltd.", shares: 37131, cost: 100000, value: 100000, ownershipPct: 1.04, fdShares: 3564739, tranches: [
      { id: "lira-preseed", type: "priced", name: "Series Pre-Seed Preferred", date: "2025-12-31", shares: 37131, cost: 100000, value: 100000, price: 2.6976, seniority: 1, liqMultiple: 1, participation: "non", source: "User-provided metrics: 37,131 shares, 3,564,739 FD shares outstanding, and 1.04% FD ownership; lira-ai-series-pre-seed-spa supplies $2.6976 PPS, $6.5M pre-money, $3M round, ESOP 316,955 shares / 9% post-money FD" }
    ] },
    { id: "materialspace", name: "Materialspace Ltd.", shares: 594483, cost: 282000, value: 527187.34, ownershipPct: 2.51, fdShares: 23684582, tranches: [
      { id: "materialspace-seed", type: "priced", name: "Series Seed Preferred", date: "2025-11-24", shares: 148850, cost: 132000, value: 132000, price: 0.8868, seniority: 1, liqMultiple: 1, participation: "non", source: "materialspace-seed-round-spa: Maccabee $132k for 148,850 Series Seed Preferred at $0.8868 PPS; user-provided current metric confirms 594,483 aggregate shares and 2.51% ownership" },
      { id: "materialspace-seed1", type: "priced", name: "Series Seed-1 Preferred", date: "2025-11-24", shares: 445633, cost: 150000, value: 395187.34, price: 0.3366, seniority: 1, liqMultiple: 1, participation: "non", source: "materialspace-seed-round-spa: Maccabee $150k SAFE converted into 445,633 Series Seed-1 Preferred at $0.3366 PPS; FD denominator now implied by user-provided 2.51% ownership" }
    ] },
    { id: "pluro", name: "Pluro Ltd.", shares: 20582, cost: 100000.01, value: 100000.01, ownershipPct: 2, fdShares: 1029100, tranches: [
      { id: "pluro-safe", type: "safe-pre", name: "SAFE", date: "2024-12-12", shares: 0, cost: 100000, value: 100000, valuationCap: 4000000, discountPct: 20, proRata: false, cashOutMultiple: 1, source: "f-pluro-safe: $100k purchase amount, $4M valuation cap, 80% discount rate, capitalization excludes converting securities" },
      { id: "pluro-options", type: "option", name: "Options", date: "2025-03-31", shares: 20582, cost: 0.01, value: 0.01, advisorShare: true, strikePrice: 0, vestedPct: 100, seniority: 99, liqMultiple: 0, participation: "common", source: "SOI; option-specific agreement not cleanly extracted" }
    ] },
    { id: "shopeaks", name: "Shopeaks Pixel Ltd", shares: 667, cost: 150000.01, value: 150000.01, ownershipPct: 3, fdShares: 22233, tranches: [
      { id: "shopeaks-safe-1", type: "safe-post", name: "SAFE", date: "2025-01-13", shares: 0, cost: 100000, value: 100000, valuationCap: 3500000, discountPct: 0, proRata: false, cashOutMultiple: 1, source: "Shopeaks Pixel Ltd. - SAFE [GGS Jan, 2025] - Signed.pdf: $100k purchase amount, $3.5M post-money valuation cap, no discount rate stated, liquidity event pays greater of purchase amount or conversion amount; Pay-Out Amount is on par with other SAFEs / most senior preferred and senior to other preferred / ordinary" },
      { id: "shopeaks-options", type: "option", name: "Options", date: "2025-03-31", shares: 667, cost: 0.01, value: 0.01, advisorShare: true, strikePrice: 0, vestedPct: 100, seniority: 99, liqMultiple: 0, participation: "common", source: "SOI; option-specific agreement not cleanly extracted" },
      { id: "shopeaks-safe-2", type: "safe-pre", name: "SAFE", date: "2026-02-24", shares: 0, cost: 50000, value: 50000, valuationCap: 8000000, discountPct: 0, proRata: false, cashOutMultiple: 1, source: "50k Shopeaks SAFE 8M [FINAL].pdf: $50k purchase amount, $8M pre-money valuation cap, no discount rate stated, liquidity event pays greater of purchase amount or conversion amount; Pay-Out Amount is on par with other SAFEs / most senior preferred and senior to other preferred / ordinary" }
    ] },
    { id: "spiral", name: "Spiral Financial, Inc.", shares: 54425, cost: 100000, value: 100000.01, ownershipPct: 0.515, fdShares: 10561916, tranches: [
      { id: "spiral-a3", type: "priced", name: "Series A-3 Preferred", date: "2025-09-08", shares: 49478, cost: 100000, value: 100000, price: 2.02, seniority: 1, liqMultiple: 1, participation: "non", simplifyingAssumption: "Assumes standard early-stage preferred economics: 1x non-participating liquidation preference, rank 1 / pari passu. This assumption is not based on the data provided.", source: "User-provided metrics: 10,561,916 FD shares outstanding and 0.515% current ownership; no Spiral legal doc provided in current set for preferred economics" },
      { id: "spiral-warrants", type: "warrant", name: "Series A-3 Preferred Warrants", date: "2025-09-08", shares: 4947, cost: 0, value: 0.01, strikePrice: 0, vestedPct: 100, seniority: 99, liqMultiple: 0, participation: "common", source: "SOI; no Spiral warrant doc provided in current set" }
    ] },
    { id: "timeos", name: "Supertools, Inc. dba TimeOS", shares: 250006264, cost: 100000.01, value: 100000.01, ownershipPct: 3, fdShares: 8333542133, tranches: [
      { id: "timeos-options", type: "option", name: "Options", date: "2025-04-17", shares: 6264, cost: 0.01, value: 0.01, advisorShare: true, strikePrice: 0, vestedPct: 100, seniority: 99, liqMultiple: 0, participation: "common", source: "SOI; advisory agreement grants options equal to 0.25% of FD share capital, 12-month monthly vesting, FMV exercise price; SOI supplies actual option count" },
      { id: "timeos-seed-plus", type: "priced", name: "Series Seed Plus Preferred", date: "2025-04-17", shares: 250000000, cost: 100000, value: 100000, price: 0.0004, seniority: 1, liqMultiple: 1, participation: "non", simplifyingAssumption: "Assumes standard early-stage preferred economics: 1x non-participating liquidation preference, rank 1 / pari passu. Also assumes the SOI share count is the controlling current record and that any 10,000:1 reverse split should be ignored unless the whole cap table is restated consistently. This assumption is not based on the data provided.", source: "timeOS joinder: $100k for 250,000,000 additional purchased shares; reverse split consent later references 10,000:1 but appears pending/not applied to SOI" }
    ] },
    { id: "taxray", name: "TaxRay, Inc.", shares: 0, cost: 100000, value: 100000, ownershipPct: 0, fdShares: 10000000, tranches: [
      { id: "taxray-safe", type: "safe-pre", name: "SAFE", date: "2025-10-16", shares: 0, cost: 100000, value: 100000, valuationCap: 12000000, discountPct: 20, proRata: false, cashOutMultiple: 1, qualifiedFinancingMin: 2000000, mfn: true, source: "safe-taxray-inc: $100k purchase amount, $12M pre-money valuation cap, 80% discount rate, $2M equity financing threshold, MFN provision" }
    ] },
    { id: "uplifted", name: "Uplifted AI Ltd.", shares: 406502, cost: 100000, value: 100000.01, ownershipPct: 2.1074, fdShares: 19289219, tranches: [
      { id: "uplifted-ordinary", type: "common", name: "Ordinary Shares", date: "2025-07-23", shares: 81299, cost: 0, value: 0.01, advisorShare: true, price: 0, seniority: 99, liqMultiple: 0, participation: "common", simplifyingAssumption: "Assumes the SOI ordinary share count is the controlling current share count for the fund or affiliate. This assumption is not based on the data provided.", source: "SOI; advisory/common share source not cleanly extracted from provided docs" },
      { id: "uplifted-seed4", type: "priced", name: "Series Seed-4 Preferred", date: "2025-07-23", shares: 325203, cost: 100000, value: 100000, price: 0.3075, seniority: 1, liqMultiple: 1, participation: "non", source: "Uplifted Cap Table Proforma November 2025.xlsx: 'Macabbee Ventures' row confirms 325,203 Seed-4 shares and 1.6859% FD ownership for that tranche; total pro forma FD shares are 19,289,219. SPA supplies $0.3075 PPS, $4M pre-money, and $2M round" }
    ] }
  ]
};
