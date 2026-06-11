const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const context = { window: {}, Intl, console };
vm.createContext(context);
vm.runInContext(fs.readFileSync("src/data.js", "utf8"), context);
vm.runInContext(fs.readFileSync("src/model.js", "utf8"), context);

const { SEED_PORTFOLIO, VCModel } = context.window;

const byId = Object.fromEntries(SEED_PORTFOLIO.companies.map((company) => [company.id, company]));
const tranche = (companyId, trancheId) => byId[companyId].tranches.find((item) => item.id === trancheId);

assert.strictEqual(tranche("eraborn", "eraborn-safe").type, "safe-pre", "Eraborn SAFE should use pre-money style capitalization from legal docs");
assert.strictEqual(tranche("eraborn", "eraborn-safe").valuationCap, 6000000, "Eraborn SAFE cap should be sourced at $6M");
assert.strictEqual(tranche("get-sonar", "get-sonar-safe").valuationCap, 10000000, "Get Sonar SAFE should be sourced at $10M post-money cap");
assert.strictEqual(tranche("pluro", "pluro-safe").valuationCap, 4000000, "Pluro SAFE cap should be sourced at $4M");
assert.strictEqual(tranche("joshu", "joshu-safe-2025").cashOutMultiple, 3, "Joshu 2025 SAFE should carry 3x cash-out");
assert.strictEqual(tranche("taxray", "taxray-safe").valuationCap, 12000000, "TaxRay SAFE cap should be sourced at $12M");
assert.strictEqual(tranche("shopeaks", "shopeaks-safe-2").type, "safe-pre", "Shopeaks $50k SAFE should use pre-money cap mechanics");
assert.strictEqual(tranche("shopeaks", "shopeaks-safe-2").valuationCap, 8000000, "Shopeaks $50k SAFE should be sourced at $8M pre-money cap");
assert.strictEqual(tranche("shopeaks", "shopeaks-safe-2").discountPct, 0, "Shopeaks $50k SAFE should not apply a discount unless one is stated");
assert.strictEqual(tranche("shopeaks", "shopeaks-safe-2").cashOutMultiple, 1, "Shopeaks $50k SAFE liquidity pay-out should be at least 1x purchase amount");
assert.strictEqual(SEED_PORTFOLIO.assumptions.managementFeePct, 2.5, "management fee should be fixed at 2.5%");
assert.strictEqual(SEED_PORTFOLIO.assumptions.carryPct, 20, "carry should be fixed at 20%");
["anchor-seed", "spiral-a3", "timeos-seed-plus"].forEach((trancheId) => {
  const companyId = trancheId === "anchor-seed" ? "anchor-forge" : trancheId === "spiral-a3" ? "spiral" : "timeos";
  const item = tranche(companyId, trancheId);
  assert.strictEqual(item.liqMultiple, 1, `${trancheId} simplifying assumption should use 1x liquidation preference`);
  assert.strictEqual(item.seniority, 1, `${trancheId} simplifying assumption should use rank 1`);
  assert.strictEqual(item.participation, "non", `${trancheId} simplifying assumption should use non-participating preferred`);
  assert(item.simplifyingAssumption.includes("not based on the data provided"), `${trancheId} should disclose the simplifying assumption`);
});
assert(tranche("timeos", "timeos-seed-plus").simplifyingAssumption.includes("SOI share count is the controlling current record"), "TimeOS should disclose the split simplification");
assert(tranche("uplifted", "uplifted-ordinary").simplifyingAssumption.includes("SOI ordinary share count"), "Uplifted ordinary shares should disclose the SOI count simplification");
assert.strictEqual(tranche("covered-health", "covered-common").advisorShare, true, "Covered advisor shares should be tagged for the advisor-share haircut");
assert.strictEqual(
  VCModel.trancheCurrentValue(tranche("covered-health", "covered-common"), SEED_PORTFOLIO.assumptions),
  tranche("covered-health", "covered-common").value * 0.8,
  "advisor shares should be carried at 80% of stated value"
);

const baseScenario = { name: "Current book", events: {} };
const current = VCModel.computeFund(SEED_PORTFOLIO.companies, baseScenario, SEED_PORTFOLIO.assumptions, SEED_PORTFOLIO.asOfDate);
assert(current.paidIn > 1800000 && current.paidIn < 1900000, "seed paid-in should match SOI total");
assert(current.residual > 2100000 && current.residual < 2200000, "seed residual should match SOI total");
assert(current.tvpi > 1.1, "current TVPI should reflect Materialspace markup");

const scenario = {
  name: "Round test",
  events: {
    materialspace: [
      { id: "e1", type: "round", date: "2026-12-31", roundSize: 5000000, preMoney: 20000000, optionPoolPct: 10, action: "prorata", customCheck: 0 }
    ]
  }
};
const pro = VCModel.computeFund(SEED_PORTFOLIO.companies, scenario, SEED_PORTFOLIO.assumptions, SEED_PORTFOLIO.asOfDate);
assert(pro.paidIn > current.paidIn, "pro-rata participation should increase paid-in");
assert(!Object.prototype.hasOwnProperty.call(pro, "dryPowder"), "fund model should not expose dry powder");

const safeRoundScenario = {
  name: "SAFE conversion test",
  events: {
    eraborn: [
      { id: "safe-round", type: "round", date: "2026-12-31", roundSize: 2000000, preMoney: 10000000, optionPoolPct: 0, action: "none", customCheck: 0 }
    ]
  }
};
const safeRound = VCModel.computeFund(SEED_PORTFOLIO.companies, safeRoundScenario, SEED_PORTFOLIO.assumptions, SEED_PORTFOLIO.asOfDate);
assert(safeRound.byCompany.eraborn.shares > SEED_PORTFOLIO.companies.find((c) => c.id === "eraborn").shares, "post-money SAFE should convert into shares in a priced round");
assert(safeRound.byCompany.eraborn.ownership > 0, "converted SAFE should create ownership");

const roundSecondarySaleScenario = {
  name: "Round secondary sale test",
  events: {
    materialspace: [
      {
        id: "round-secondary-sale",
        type: "round",
        date: "2026-12-31",
        roundSize: 5000000,
        preMoney: 20000000,
        optionPoolPct: 0,
        action: "none",
        customCheck: 0,
        secondary: { enabled: true, side: "sell", mode: "pct", amount: 20, premiumDiscountPct: -30 }
      }
    ]
  }
};
const roundSecondarySale = VCModel.computeFund(SEED_PORTFOLIO.companies, roundSecondarySaleScenario, SEED_PORTFOLIO.assumptions, SEED_PORTFOLIO.asOfDate);
assert(roundSecondarySale.distributions > 0, "concurrent round secondary sale should produce distributions");
assert(roundSecondarySale.dpi > current.dpi, "concurrent round secondary sale should increase DPI");

const roundSecondaryBuyScenario = {
  name: "Round secondary buy test",
  events: {
    materialspace: [
      {
        id: "round-secondary-buy",
        type: "round",
        date: "2026-12-31",
        roundSize: 5000000,
        preMoney: 20000000,
        optionPoolPct: 0,
        action: "none",
        customCheck: 0,
        secondary: { enabled: true, side: "buy", mode: "dollars", amount: 100000, premiumDiscountPct: -20 }
      }
    ]
  }
};
const roundSecondaryBuy = VCModel.computeFund(SEED_PORTFOLIO.companies, roundSecondaryBuyScenario, SEED_PORTFOLIO.assumptions, SEED_PORTFOLIO.asOfDate);
assert(roundSecondaryBuy.paidIn > current.paidIn, "concurrent round secondary buy should increase paid-in");
assert(!Object.prototype.hasOwnProperty.call(roundSecondaryBuy, "dryPowder"), "secondary buys should not expose dry powder");

const exitScenario = {
  name: "Exit test",
  events: {
    liquidonate: [
      { id: "exit", type: "exit", date: "2028-06-30", exitType: "ma", exitEV: 100000000 }
    ]
  }
};
const exited = VCModel.computeFund(SEED_PORTFOLIO.companies, exitScenario, SEED_PORTFOLIO.assumptions, SEED_PORTFOLIO.asOfDate);
assert(exited.distributions > 0, "exit should create distributions");
assert(exited.dpi > current.dpi, "exit should increase DPI");

console.log("model tests passed");
