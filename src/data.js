window.SEED_PORTFOLIO = {
  asOfDate: "2026-01-01",
  fundName: "Sample Fund, LP",
  assumptions: {
    capitalCalled: 0,
    managementFeePct: 2.5,
    carryPct: 20,
    hurdlePct: 0,
    waterfallStyle: "european",
    safeMarkMode: "cost"
  },
  companies: [
    { id: "sample-co", name: "Sample Company", shares: 0, cost: 0, value: 0, ownershipPct: 0, fdShares: 0, tranches: [
      { id: "sample-co-safe", type: "safe-pre", name: "SAFE", date: "2026-01-01", shares: 0, cost: 0, value: 0, valuationCap: 0, discountPct: 0, proRata: false, cashOutMultiple: 1, source: "Placeholder starting template. Real portfolio data now lives in the shared Google Drive file - connect to load it, or use Edit Position to replace this sample company." }
    ] }
  ]
};
