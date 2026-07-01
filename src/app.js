(function () {
  const seed = window.SEED_PORTFOLIO;
  const model = window.VCModel;
  const storageKey = "maccabee-fund-ii-scenarios-v1";
  const assumptionsKey = "maccabee-fund-ii-assumptions-v1";
  const assumptionOriginsKey = "maccabee-fund-ii-assumption-origins-v1";
  const companyFieldOriginsKey = "maccabee-fund-ii-company-field-origins-v1";
  const setupInputsKey = "maccabee-fund-ii-required-inputs-v2";
  const setupCompleteKey = "maccabee-fund-ii-setup-complete-v3";
  const masterColumnsKey = "maccabee-fund-ii-master-table-columns-v4";
  const storageVersionKey = "maccabee-fund-ii-storage-version";
  const appStorageVersion = "2026-07-01-source-baseline-v1";

  prepareStorage();
  let assumptions = loadAssumptions();
  let assumptionOrigins = loadAssumptionOrigins();
  let companyFieldOrigins = loadCompanyFieldOrigins();
  let setupInputs = loadSetupInputs();
  let scenarios = loadScenarios();
  let activeScenarioId = scenarios[0].id;
  let selectedCompanyId = seed.companies[0].id;
  let activeTab = "baseline";
  let activeView = "company";
  let visibleMasterColumns = loadVisibleMasterColumns();
  let editedMasterCells = new Set();
  let masterInputTimers = new Map();

  const $ = (id) => document.getElementById(id);

  const baselineAssumptions = normalizeAssumptions(model.clone(seed.assumptions));
  const baselineAssumptionOrigins = {};
  const baselineCompanyFieldOrigins = {};
  const baselineCompanies = model.clone(seed.companies);
  applySetupInputs();

  function prepareStorage() {
    if (localStorage.getItem(storageVersionKey) === appStorageVersion) return;
    [
      assumptionsKey,
      assumptionOriginsKey,
      companyFieldOriginsKey,
      setupInputsKey,
      setupCompleteKey,
      masterColumnsKey
    ].forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(storageVersionKey, appStorageVersion);
  }

  function readJson(key, fallback) {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem(key);
      return fallback;
    }
  }

  function normalizeAssumptions(source) {
    const loaded = model.clone(source || {});
    loaded.managementFeePct = 2.5;
    loaded.carryPct = 20;
    delete loaded.fundSize;
    delete loaded.dryPowderReserve;
    return loaded;
  }

  function loadAssumptions() {
    return normalizeAssumptions({ ...seed.assumptions, ...readJson(assumptionsKey, {}) });
  }

  function saveAssumptions() {
    localStorage.setItem(assumptionsKey, JSON.stringify(assumptions));
  }

  function loadAssumptionOrigins() {
    return readJson(assumptionOriginsKey, {});
  }

  function saveAssumptionOrigins() {
    localStorage.setItem(assumptionOriginsKey, JSON.stringify(assumptionOrigins));
  }

  function loadCompanyFieldOrigins() {
    return readJson(companyFieldOriginsKey, {});
  }

  function saveCompanyFieldOrigins() {
    localStorage.setItem(companyFieldOriginsKey, JSON.stringify(companyFieldOrigins));
  }

  function defaultMasterColumnIds() {
    return masterColumns().map((column) => column.id);
  }

  function loadVisibleMasterColumns() {
    return readJson(masterColumnsKey, defaultMasterColumnIds());
  }

  function saveVisibleMasterColumns() {
    localStorage.setItem(masterColumnsKey, JSON.stringify(visibleMasterColumns));
  }

  function loadSetupInputs() {
    return readJson(setupInputsKey, { assumptions: {}, companies: {}, tranches: {} });
  }

  function saveSetupInputs() {
    localStorage.setItem(setupInputsKey, JSON.stringify(setupInputs));
  }

  function setupIsComplete() {
    return localStorage.getItem(setupCompleteKey) === "true";
  }

  function setSetupComplete() {
    localStorage.setItem(setupCompleteKey, "true");
  }

  function applySetupInputs() {
    Object.entries(setupInputs.assumptions || {}).forEach(([key, value]) => {
      assumptions[key] = value;
      assumptionOrigins[key] = "user";
    });
    seed.companies.forEach((company) => {
      const companyInputs = setupInputs.companies?.[company.id] || {};
      Object.entries(companyInputs).forEach(([key, value]) => {
        company[key] = value;
        companyFieldOrigins[`${company.id}.${key}`] = "user";
      });
      company.tranches.forEach((tranche) => {
        const trancheInputs = setupInputs.tranches?.[tranche.id] || {};
        Object.entries(trancheInputs).forEach(([key, value]) => {
          tranche[key] = value;
        });
        if (Object.keys(trancheInputs).length) {
          delete tranche.simplifyingAssumption;
          tranche.source = `User input supplied during setup; original note: ${tranche.source || "unsourced"}`;
        }
      });
    });
  }

  function loadScenarios() {
    const saved = readJson(storageKey, null);
    if (saved) return saved;
    return [{ id: "current", name: "Current book", events: {} }];
  }

  function saveScenarios() {
    localStorage.setItem(storageKey, JSON.stringify(scenarios));
  }

  function baselineCompany(companyId) {
    return baselineCompanies.find((company) => company.id === companyId);
  }

  function baselineTranche(trancheId) {
    return baselineCompanies.flatMap((company) => company.tranches).find((tranche) => tranche.id === trancheId);
  }

  function currentTranche(trancheId) {
    return seed.companies.flatMap((company) => company.tranches).find((tranche) => tranche.id === trancheId);
  }

  function valuesEqual(previous, next) {
    if (typeof previous === "number" || typeof next === "number") {
      return Math.abs((Number(previous) || 0) - (Number(next) || 0)) < 0.000001;
    }
    return JSON.stringify(previous ?? "") === JSON.stringify(next ?? "");
  }

  function changeKey(parts) {
    return parts.map((part) => encodeURIComponent(String(part))).join("|");
  }

  function parseChangeKey(key) {
    return key.split("|").map((part) => decodeURIComponent(part));
  }

  function changeFieldLabel(field) {
    const labels = {
      capitalCalled: "Capital called",
      safeMarkMode: "SAFE / note marks",
      shares: "Shares held",
      fdShares: "FD shares",
      ownershipPct: "Ownership %",
      cost: "Cost",
      value: "Carrying value",
      price: "Share price",
      valuationCap: "SAFE cap",
      discountPct: "SAFE discount %",
      cashOutMultiple: "Cash-out multiple",
      proRata: "Pro-rata rights",
      strikePrice: "Strike / exercise price",
      vestedPct: "Vested %",
      liqMultiple: "Liquidation preference",
      seniority: "Seniority rank",
      participation: "Participation",
      type: "Security type"
    };
    return labels[field] || field;
  }

  function formatChangeValue(value) {
    if (value === true) return "Yes";
    if (value === false) return "No";
    if (value === "" || value === null || value === undefined) return "blank";
    if (typeof value === "number") {
      if (Math.abs(value) >= 1000) return number(value);
      return Number.isInteger(value) ? String(value) : String(Math.round(value * 10000) / 10000);
    }
    return String(value);
  }

  function changedFromTo(previous, next) {
    return `${formatChangeValue(previous)} -> ${formatChangeValue(next)}`;
  }

  function activeScenarioEvents() {
    const scenario = activeScenario();
    return seed.companies.flatMap((company) => (scenario.events[company.id] || []).map((event) => ({ company, event })));
  }

  function trackedTrancheFields(tranche) {
    const common = ["shares", "cost", "value"];
    if (["safe-post", "safe-pre", "note"].includes(tranche.type)) {
      return [...common, "type", "valuationCap", "discountPct", "cashOutMultiple", "proRata"];
    }
    if (["option", "warrant"].includes(tranche.type)) {
      return [...common, "strikePrice", "vestedPct"];
    }
    return [...common, "price", "liqMultiple", "seniority", "participation"];
  }

  function changeItems() {
    const items = [];
    ["capitalCalled", "safeMarkMode"].forEach((field) => {
      if (valuesEqual(baselineAssumptions[field], assumptions[field])) return;
      items.push({
        key: changeKey(["assumption", field]),
        intent: "Fund-level policy",
        title: changeFieldLabel(field),
        detail: changedFromTo(baselineAssumptions[field], assumptions[field])
      });
    });

    seed.companies.forEach((company) => {
      const originalCompany = baselineCompany(company.id);
      if (!originalCompany) return;
      ["shares", "fdShares", "ownershipPct"].forEach((field) => {
        if (valuesEqual(originalCompany[field], company[field])) return;
        items.push({
          key: changeKey(["company", company.id, field]),
          intent: "Current-book data",
          title: `${company.name} - ${changeFieldLabel(field)}`,
          detail: changedFromTo(originalCompany[field], company[field])
        });
      });
      company.tranches.forEach((tranche) => {
        const originalTranche = baselineTranche(tranche.id);
        if (!originalTranche) return;
        trackedTrancheFields(tranche).forEach((field) => {
          if (valuesEqual(originalTranche[field], tranche[field])) return;
          items.push({
            key: changeKey(["tranche", company.id, tranche.id, field]),
            intent: "Current-book data",
            title: `${company.name} - ${tranche.name} - ${changeFieldLabel(field)}`,
            detail: changedFromTo(originalTranche[field], tranche[field])
          });
        });
      });
    });

    activeScenarioEvents().forEach(({ company, event }) => {
      items.push({
        key: changeKey(["event", company.id, event.id]),
        intent: "Hypothetical lever",
        title: `${company.name} - Scenario event`,
        detail: describeEvent(event)
      });
    });
    return items;
  }

  function restoreOrigin(map, baselineMap, key) {
    if (baselineMap[key]) map[key] = baselineMap[key];
    else delete map[key];
  }

  function deleteSetupValue(kind, id, field) {
    if (kind === "assumption") {
      delete setupInputs.assumptions?.[id];
    } else if (kind === "company") {
      delete setupInputs.companies?.[id]?.[field];
      if (setupInputs.companies?.[id] && !Object.keys(setupInputs.companies[id]).length) delete setupInputs.companies[id];
    } else if (kind === "tranche") {
      delete setupInputs.tranches?.[id]?.[field];
      if (setupInputs.tranches?.[id] && !Object.keys(setupInputs.tranches[id]).length) delete setupInputs.tranches[id];
    }
    saveSetupInputs();
  }

  function restoreTrancheMetadataIfClean(tranche) {
    const original = baselineTranche(tranche.id);
    if (!original) return;
    const clean = trackedTrancheFields(tranche).every((field) => valuesEqual(original[field], tranche[field]));
    if (!clean) return;
    if (original.simplifyingAssumption) tranche.simplifyingAssumption = original.simplifyingAssumption;
    else delete tranche.simplifyingAssumption;
    tranche.source = original.source;
  }

  function clearMasterEditHighlightsFor(companyId) {
    if (!companyId) {
      editedMasterCells.clear();
      return;
    }
    editedMasterCells = new Set(Array.from(editedMasterCells).filter((key) => !key.startsWith(`${companyId}.`)));
  }

  function revertChange(key) {
    const [type, id, subId, field] = parseChangeKey(key);
    if (type === "assumption") {
      assumptions[id] = baselineAssumptions[id];
      restoreOrigin(assumptionOrigins, baselineAssumptionOrigins, id);
      deleteSetupValue("assumption", id);
      saveAssumptions();
      saveAssumptionOrigins();
    } else if (type === "company") {
      const company = seed.companies.find((item) => item.id === id);
      const original = baselineCompany(id);
      if (company && original) {
        company[subId] = original[subId];
        restoreOrigin(companyFieldOrigins, baselineCompanyFieldOrigins, `${id}.${subId}`);
        deleteSetupValue("company", id, subId);
        saveCompanyFieldOrigins();
        clearMasterEditHighlightsFor(id);
      }
    } else if (type === "tranche") {
      const company = seed.companies.find((item) => item.id === id);
      const tranche = currentTranche(subId);
      const original = baselineTranche(subId);
      if (company && tranche && original) {
        tranche[field] = original[field];
        restoreTrancheMetadataIfClean(tranche);
        deleteSetupValue("tranche", subId, field);
        refreshCompanyTotals(company);
        clearMasterEditHighlightsFor(id);
      }
    } else if (type === "event") {
      const events = eventsFor(id);
      const index = events.findIndex((event) => event.id === subId);
      if (index >= 0) events.splice(index, 1);
      saveScenarios();
      clearMasterEditHighlightsFor(id);
    }
    render();
  }

  function revertAllChanges() {
    Object.keys(assumptions).forEach((key) => delete assumptions[key]);
    Object.assign(assumptions, model.clone(baselineAssumptions));
    assumptionOrigins = model.clone(baselineAssumptionOrigins);
    companyFieldOrigins = model.clone(baselineCompanyFieldOrigins);
    setupInputs = { assumptions: {}, companies: {}, tranches: {} };
    seed.companies.splice(0, seed.companies.length, ...model.clone(baselineCompanies));
    activeScenario().events = {};
    editedMasterCells.clear();
    saveAssumptions();
    saveAssumptionOrigins();
    saveCompanyFieldOrigins();
    saveSetupInputs();
    saveScenarios();
    render();
  }

  function activeScenario() {
    return scenarios.find((scenario) => scenario.id === activeScenarioId) || scenarios[0];
  }

  function selectedCompany() {
    return seed.companies.find((company) => company.id === selectedCompanyId) || seed.companies[0];
  }

  function eventsFor(companyId) {
    const scenario = activeScenario();
    scenario.events[companyId] ||= [];
    return scenario.events[companyId];
  }

  function companyCashFlows(company, state) {
    const flows = [];
    company.tranches.forEach((tranche) => {
      if (tranche.cost > 0) flows.push({ date: tranche.date || seed.asOfDate, amount: -tranche.cost });
    });
    flows.push(...state.cashFlows);
    if (state.value > 0) flows.push({ date: seed.asOfDate, amount: state.value });
    return flows;
  }

  function companyIrr(company, state) {
    return model.xirr(companyCashFlows(company, state));
  }

  function companyEnterpriseValue(company, state) {
    if (state.ownership > 0) return state.value / state.ownership;
    return state.totalShares * Math.max(model.weightedSharePrice(company), 0.000001);
  }

  function upsertValuationEvent(companyId, enterpriseValue) {
    const events = eventsFor(companyId);
    let event = events.find((item) => item.type === "valuation" && item.source === "master-table");
    if (!event) {
      event = {
        id: `valuation-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: "valuation",
        source: "master-table",
        date: seed.asOfDate,
        enterpriseValue: 0
      };
      events.push(event);
    }
    event.enterpriseValue = enterpriseValue;
    saveScenarios();
  }

  function defaultMasterScenarioEvent(type) {
    const defaults = {
      round: {
        type: "round",
        source: "master-table-round",
        date: "2026-12-01",
        roundSize: 0,
        preMoney: 0,
        optionPoolPct: 0,
        action: "none",
        customCheck: 0,
        secondary: {
          enabled: false,
          side: "sell",
          mode: "pct",
          amount: 0,
          premiumDiscountPct: 0
        }
      },
      secondary: {
        type: "secondary",
        source: "master-table-secondary",
        date: "2027-06-01",
        side: "sell",
        mode: "pct",
        amount: 0,
        premiumDiscountPct: 0
      },
      exit: {
        type: "exit",
        source: "master-table-exit",
        date: "2029-12-01",
        exitType: "ma",
        exitEV: 0
      }
    };
    return model.clone(defaults[type]);
  }

  function masterScenarioEvent(companyId, type) {
    const events = eventsFor(companyId);
    const source = `master-table-${type}`;
    return events.find((event) => event.type === type && event.source === source)
      || events.find((event) => event.type === type)
      || null;
  }

  function upsertMasterScenarioEvent(companyId, type) {
    let event = masterScenarioEvent(companyId, type);
    if (!event) {
      event = defaultMasterScenarioEvent(type);
      event.id = `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      eventsFor(companyId).push(event);
    }
    if (type === "round") event.secondary ||= defaultMasterScenarioEvent("round").secondary;
    return event;
  }

  function monthFromDate(date) {
    return date ? String(date).slice(0, 7) : "";
  }

  function dateFromMonth(month, fallback) {
    if (!month) return fallback || seed.asOfDate;
    return `${month}-01`;
  }

  function nestedValue(object, path, fallback = "") {
    return path.split(".").reduce((value, key) => value?.[key], object) ?? fallback;
  }

  function setNestedValue(object, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((current, key) => {
      current[key] ||= {};
      return current[key];
    }, object);
    target[last] = value;
  }

  function scenarioFieldValue(company, column) {
    const event = masterScenarioEvent(company.id, column.eventType);
    if (!event) return "";
    const value = nestedValue(event, column.eventKey, "");
    return column.kind === "month" ? monthFromDate(value) : value;
  }

  function masterColumns() {
    return [
      { id: "company", group: "Company", label: "Company", kind: "text", fixed: true, value: ({ company }) => company.name },
      { id: "proCompanyEv", group: "Scenario Levers", label: "Pro Forma Company Valuation", kind: "number", editable: true, target: "scenarioValuation", step: "100000", affected: true, value: ({ company, proState }) => companyEnterpriseValue(company, proState) },
      { id: "roundDate", group: "Future Round", label: "Round Date", kind: "month", editable: true, target: "scenarioEvent", eventType: "round", eventKey: "date", affected: true, value: ({ company }) => scenarioFieldValue(company, masterColumnById("roundDate")) },
      { id: "roundSize", group: "Future Round", label: "Round Size", kind: "number", editable: true, target: "scenarioEvent", eventType: "round", eventKey: "roundSize", step: "50000", affected: true, value: ({ company }) => scenarioFieldValue(company, masterColumnById("roundSize")) },
      { id: "preMoney", group: "Future Round", label: "Pre-Money", kind: "number", editable: true, target: "scenarioEvent", eventType: "round", eventKey: "preMoney", step: "100000", affected: true, value: ({ company }) => scenarioFieldValue(company, masterColumnById("preMoney")) },
      { id: "optionPoolPct", group: "Future Round", label: "Option Pool %", kind: "number", editable: true, target: "scenarioEvent", eventType: "round", eventKey: "optionPoolPct", step: "1", affected: true, value: ({ company }) => scenarioFieldValue(company, masterColumnById("optionPoolPct")) },
      { id: "roundAction", group: "Future Round", label: "Fund Action", kind: "select", editable: true, target: "scenarioEvent", eventType: "round", eventKey: "action", affected: true, choices: [["none", "Do nothing"], ["prorata", "Pro-rata"], ["custom", "Custom check"]], value: ({ company }) => scenarioFieldValue(company, masterColumnById("roundAction")) },
      { id: "customCheck", group: "Future Round", label: "Custom Check", kind: "number", editable: true, target: "scenarioEvent", eventType: "round", eventKey: "customCheck", step: "25000", affected: true, value: ({ company }) => scenarioFieldValue(company, masterColumnById("customCheck")) },
      { id: "roundSecondaryEnabled", group: "Round Secondary", label: "Include Secondary", kind: "select", editable: true, target: "scenarioEvent", eventType: "round", eventKey: "secondary.enabled", affected: true, choices: [["false", "No"], ["true", "Yes"]], value: ({ company }) => scenarioFieldValue(company, masterColumnById("roundSecondaryEnabled")) },
      { id: "roundSecondarySide", group: "Round Secondary", label: "Buy / Sell", kind: "select", editable: true, target: "scenarioEvent", eventType: "round", eventKey: "secondary.side", affected: true, choices: [["sell", "Sell shares"], ["buy", "Buy shares"]], value: ({ company }) => scenarioFieldValue(company, masterColumnById("roundSecondarySide")) },
      { id: "roundSecondaryMode", group: "Round Secondary", label: "Amount Mode", kind: "select", editable: true, target: "scenarioEvent", eventType: "round", eventKey: "secondary.mode", affected: true, choices: [["pct", "% of position"], ["shares", "Shares"], ["dollars", "Dollars"]], value: ({ company }) => scenarioFieldValue(company, masterColumnById("roundSecondaryMode")) },
      { id: "roundSecondaryAmount", group: "Round Secondary", label: "Amount", kind: "number", editable: true, target: "scenarioEvent", eventType: "round", eventKey: "secondary.amount", step: "1", affected: true, value: ({ company }) => scenarioFieldValue(company, masterColumnById("roundSecondaryAmount")) },
      { id: "roundSecondaryDiscount", group: "Round Secondary", label: "Discount / Premium %", kind: "number", editable: true, target: "scenarioEvent", eventType: "round", eventKey: "secondary.premiumDiscountPct", step: "1", affected: true, value: ({ company }) => scenarioFieldValue(company, masterColumnById("roundSecondaryDiscount")) },
      { id: "secondaryDate", group: "Standalone Secondary", label: "Secondary Date", kind: "month", editable: true, target: "scenarioEvent", eventType: "secondary", eventKey: "date", affected: true, value: ({ company }) => scenarioFieldValue(company, masterColumnById("secondaryDate")) },
      { id: "secondarySide", group: "Standalone Secondary", label: "Buy / Sell", kind: "select", editable: true, target: "scenarioEvent", eventType: "secondary", eventKey: "side", affected: true, choices: [["sell", "Sell shares"], ["buy", "Buy shares"]], value: ({ company }) => scenarioFieldValue(company, masterColumnById("secondarySide")) },
      { id: "secondaryMode", group: "Standalone Secondary", label: "Amount Mode", kind: "select", editable: true, target: "scenarioEvent", eventType: "secondary", eventKey: "mode", affected: true, choices: [["pct", "% of position"], ["shares", "Shares / dollars"]], value: ({ company }) => scenarioFieldValue(company, masterColumnById("secondaryMode")) },
      { id: "secondaryAmount", group: "Standalone Secondary", label: "Amount", kind: "number", editable: true, target: "scenarioEvent", eventType: "secondary", eventKey: "amount", step: "1", affected: true, value: ({ company }) => scenarioFieldValue(company, masterColumnById("secondaryAmount")) },
      { id: "secondaryDiscount", group: "Standalone Secondary", label: "Discount / Premium %", kind: "number", editable: true, target: "scenarioEvent", eventType: "secondary", eventKey: "premiumDiscountPct", step: "1", affected: true, value: ({ company }) => scenarioFieldValue(company, masterColumnById("secondaryDiscount")) },
      { id: "exitDate", group: "Exit / Write-Off", label: "Exit Date", kind: "month", editable: true, target: "scenarioEvent", eventType: "exit", eventKey: "date", affected: true, value: ({ company }) => scenarioFieldValue(company, masterColumnById("exitDate")) },
      { id: "exitType", group: "Exit / Write-Off", label: "Exit Type", kind: "select", editable: true, target: "scenarioEvent", eventType: "exit", eventKey: "exitType", affected: true, choices: [["ma", "M&A"], ["ipo", "IPO"], ["writeoff", "Write-off"]], value: ({ company }) => scenarioFieldValue(company, masterColumnById("exitType")) },
      { id: "exitEV", group: "Exit / Write-Off", label: "Exit EV", kind: "number", editable: true, target: "scenarioEvent", eventType: "exit", eventKey: "exitEV", step: "1000000", affected: true, value: ({ company }) => scenarioFieldValue(company, masterColumnById("exitEV")) },
      { id: "proNav", group: "Impact", label: "Pro Forma NAV", kind: "money", affected: true, value: ({ proState }) => proState.value },
      { id: "navDelta", group: "Impact", label: "NAV Delta", kind: "money", affected: true, value: ({ state, proState }) => proState.value - state.value },
      { id: "proOwnership", group: "Impact", label: "Pro Forma Ownership", kind: "percent", affected: true, value: ({ proState }) => proState.ownership },
      { id: "ownershipDelta", group: "Impact", label: "Ownership Delta", kind: "percent", affected: true, value: ({ state, proState }) => proState.ownership - state.ownership },
      { id: "proMoic", group: "Impact", label: "Pro Forma MOIC", kind: "multiple", affected: true, value: ({ proState }) => (proState.value + proState.distributions) / Math.max(proState.cost, 1) },
      { id: "moicDelta", group: "Impact", label: "MOIC Delta", kind: "multiple", affected: true, value: ({ state, proState }) => ((proState.value + proState.distributions) / Math.max(proState.cost, 1)) - ((state.value + state.distributions) / Math.max(state.cost, 1)) },
      { id: "proIrr", group: "Impact", label: "Pro Forma IRR", kind: "irr", affected: true, value: ({ company, proState }) => companyIrr(company, proState) },
      { id: "distributions", group: "Impact", label: "Distributions", kind: "money", affected: true, value: ({ proState }) => proState.distributions },
      { id: "currentNav", group: "Current Position", label: "Current NAV", kind: "money", affected: true, value: ({ state }) => state.value },
      { id: "currentCost", group: "Current Position", label: "Current Cost", kind: "money", affected: true, value: ({ state }) => state.cost },
      { id: "currentMoic", group: "Current Position", label: "Current MOIC", kind: "multiple", affected: true, value: ({ state }) => (state.value + state.distributions) / Math.max(state.cost, 1) },
      { id: "currentIrr", group: "Current Position", label: "Current IRR", kind: "irr", affected: true, value: ({ company, state }) => companyIrr(company, state) },
      { id: "carryingValue", group: "Current Position", label: "Carrying Value", kind: "number", editable: true, target: "aggregate", aggregate: "all", key: "value", step: "1000", value: ({ company }) => aggregateTrancheValue(company, "all", "value") },
      { id: "shares", group: "Ownership", label: "Shares Held", kind: "number", editable: true, target: "company", key: "shares", step: "1", value: ({ company }) => company.shares || 0 },
      { id: "fdShares", group: "Ownership", label: "FD Shares", kind: "number", editable: true, target: "company", key: "fdShares", step: "1", value: ({ company }) => company.fdShares || 0 },
      { id: "ownershipPct", group: "Ownership", label: "Current Ownership %", kind: "number", editable: true, target: "company", key: "ownershipPct", step: "0.01", value: ({ company }) => company.ownershipPct || 0 },
      { id: "lastPrice", group: "Ownership", label: "Last Share Price", kind: "money", affected: true, value: ({ company }) => model.weightedSharePrice(company) },
      { id: "pricedShares", group: "Priced Equity", label: "Priced Shares", kind: "number", editable: true, target: "aggregate", aggregate: "priced", key: "shares", step: "1", value: ({ company }) => aggregateTrancheValue(company, "priced", "shares") },
      { id: "pricedCost", group: "Priced Equity", label: "Priced Cost", kind: "number", editable: true, target: "aggregate", aggregate: "priced", key: "cost", step: "1000", value: ({ company }) => aggregateTrancheValue(company, "priced", "cost") },
      { id: "pricedValue", group: "Priced Equity", label: "Priced Value", kind: "number", editable: true, target: "aggregate", aggregate: "priced", key: "value", step: "1000", value: ({ company }) => aggregateTrancheValue(company, "priced", "value") },
      { id: "pricedPps", group: "Priced Equity", label: "Priced PPS", kind: "number", editable: true, target: "aggregate", aggregate: "priced", key: "price", step: "0.0001", value: ({ company }) => weightedTrancheAverage(company, "priced", "price") },
      { id: "liqMultiple", group: "Priced Equity", label: "Liq Pref Multiple", kind: "number", editable: true, target: "aggregate", aggregate: "priced", key: "liqMultiple", step: "0.1", value: ({ company }) => weightedTrancheAverage(company, "priced", "liqMultiple") },
      { id: "seniority", group: "Priced Equity", label: "Seniority Rank", kind: "number", editable: true, target: "aggregate", aggregate: "priced", key: "seniority", step: "1", value: ({ company }) => weightedTrancheAverage(company, "priced", "seniority") },
      { id: "participation", group: "Priced Equity", label: "Participation", kind: "select", editable: true, target: "aggregate", aggregate: "priced", key: "participation", choices: [["non", "Non-participating"], ["full", "Fully participating"], ["common", "Common/as-converted only"]], value: ({ company }) => commonTrancheChoice(company, "priced", "participation") },
      { id: "safeType", group: "SAFEs / Notes", label: "SAFE Type", kind: "select", editable: true, target: "aggregate", aggregate: "safe", key: "type", choices: [["safe-post", "Post-money SAFE"], ["safe-pre", "Pre-money SAFE"], ["note", "Convertible note"]], value: ({ company }) => commonTrancheChoice(company, "safe", "type") },
      { id: "safeCost", group: "SAFEs / Notes", label: "SAFE Cost", kind: "number", editable: true, target: "aggregate", aggregate: "safe", key: "cost", step: "1000", value: ({ company }) => aggregateTrancheValue(company, "safe", "cost") },
      { id: "safeValue", group: "SAFEs / Notes", label: "SAFE Value", kind: "number", editable: true, target: "aggregate", aggregate: "safe", key: "value", step: "1000", value: ({ company }) => aggregateTrancheValue(company, "safe", "value") },
      { id: "safeCap", group: "SAFEs / Notes", label: "SAFE Cap", kind: "number", editable: true, target: "aggregate", aggregate: "safe", key: "valuationCap", step: "100000", value: ({ company }) => weightedTrancheAverage(company, "safe", "valuationCap") },
      { id: "safeDiscount", group: "SAFEs / Notes", label: "SAFE Discount %", kind: "number", editable: true, target: "aggregate", aggregate: "safe", key: "discountPct", step: "0.1", value: ({ company }) => weightedTrancheAverage(company, "safe", "discountPct") },
      { id: "safeCashOut", group: "SAFEs / Notes", label: "SAFE Cash-Out", kind: "number", editable: true, target: "aggregate", aggregate: "safe", key: "cashOutMultiple", step: "0.1", value: ({ company }) => weightedTrancheAverage(company, "safe", "cashOutMultiple") },
      { id: "safeProRata", group: "SAFEs / Notes", label: "SAFE Pro-Rata", kind: "select", editable: true, target: "aggregate", aggregate: "safe", key: "proRata", choices: [["false", "No"], ["true", "Yes"]], value: ({ company }) => commonTrancheChoice(company, "safe", "proRata") },
      { id: "optionShares", group: "Options / Warrants", label: "Option/Warrant Shares", kind: "number", editable: true, target: "aggregate", aggregate: "option", key: "shares", step: "1", value: ({ company }) => aggregateTrancheValue(company, "option", "shares") },
      { id: "optionStrike", group: "Options / Warrants", label: "Option/Warrant Strike", kind: "number", editable: true, target: "aggregate", aggregate: "option", key: "strikePrice", step: "0.0001", value: ({ company }) => weightedTrancheAverage(company, "option", "strikePrice") },
      { id: "optionVested", group: "Options / Warrants", label: "Option/Warrant Vested %", kind: "number", editable: true, target: "aggregate", aggregate: "option", key: "vestedPct", step: "0.1", value: ({ company }) => weightedTrancheAverage(company, "option", "vestedPct") }
    ];
  }

  function aggregateTypes(kind) {
    const map = {
      all: ["priced", "common", "safe-post", "safe-pre", "note", "option", "warrant"],
      priced: ["priced"],
      safe: ["safe-post", "safe-pre", "note"],
      option: ["option", "warrant"]
    };
    return map[kind] || [kind];
  }

  function aggregateTranches(company, kind) {
    const types = aggregateTypes(kind);
    return company.tranches.filter((tranche) => types.includes(tranche.type));
  }

  function aggregateTrancheValue(company, kind, key) {
    return aggregateTranches(company, kind).reduce((total, tranche) => total + (Number(tranche[key]) || 0), 0);
  }

  function weightedTrancheAverage(company, kind, key) {
    const tranches = aggregateTranches(company, kind).filter((tranche) => Number.isFinite(Number(tranche[key])));
    const weightTotal = tranches.reduce((total, tranche) => total + Math.max(Number(tranche.cost) || Number(tranche.value) || Number(tranche.shares) || 1, 1), 0);
    if (!tranches.length || !weightTotal) return "";
    return tranches.reduce((total, tranche) => {
      const weight = Math.max(Number(tranche.cost) || Number(tranche.value) || Number(tranche.shares) || 1, 1);
      return total + (Number(tranche[key]) || 0) * weight;
    }, 0) / weightTotal;
  }

  function commonTrancheChoice(company, kind, key) {
    const tranches = aggregateTranches(company, kind);
    if (!tranches.length) return "";
    const first = String(tranches[0][key] ?? "");
    return tranches.every((tranche) => String(tranche[key] ?? "") === first) ? first : "";
  }

  function distributeAggregateValue(company, kind, key, value) {
    const tranches = aggregateTranches(company, kind);
    if (!tranches.length) return;
    const currentTotal = aggregateTrancheValue(company, kind, key);
    tranches.forEach((tranche, index) => {
      if (currentTotal > 0) {
        tranche[key] = value * ((Number(tranche[key]) || 0) / currentTotal);
      } else {
        tranche[key] = value / tranches.length;
      }
      if (index === tranches.length - 1 && key !== "price") {
        const subtotal = tranches.slice(0, -1).reduce((total, item) => total + (Number(item[key]) || 0), 0);
        tranche[key] = value - subtotal;
      }
    });
  }

  function setAggregateField(company, kind, key, value) {
    const tranches = aggregateTranches(company, kind);
    if (!tranches.length) return;
    if (["shares", "cost", "value"].includes(key)) {
      distributeAggregateValue(company, kind, key, value);
    } else if (key === "proRata") {
      tranches.forEach((tranche) => { tranche[key] = value === true || value === "true"; });
    } else {
      tranches.forEach((tranche) => { tranche[key] = value; });
    }
    tranches.forEach((tranche) => {
      delete tranche.simplifyingAssumption;
      tranche.source = `User input supplied in master table; original note: ${tranche.source || "unsourced"}`;
    });
    refreshCompanyTotals(company);
  }

  function refreshCompanyTotals(company) {
    company.shares = aggregateTrancheValue(company, "all", "shares");
    company.cost = aggregateTrancheValue(company, "all", "cost");
    company.value = aggregateTrancheValue(company, "all", "value");
  }

  function money(value) {
    return model.fmtMoney(value);
  }

  function multiple(value) {
    return Number.isFinite(value) ? `${value.toFixed(2)}x` : "N/A";
  }

  function percent(value) {
    return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "N/A";
  }

  function irr(value) {
    return value === null || !Number.isFinite(value) ? "N/A" : `${(value * 100).toFixed(1)}%`;
  }

  function assumedMark(note) {
    return `<span class="assumption-mark" title="${escapeHtml(note)}">*</span>`;
  }

  function withAssumption(value, note, assumed = true) {
    return `${value}${assumed ? assumedMark(note) : ""}`;
  }

  function labelWithAssumption(label, note, assumed = true) {
    return `${escapeHtml(label)}${assumed ? assumedMark(note) : ""}`;
  }

  function metricCard(label, value, note = "") {
    return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${note ? withAssumption(value, note) : value}</strong></div>`;
  }

  function sourceLooksAssumed(source = "") {
    return /estimated|not identified|not cleanly|not yet parsed|no .*provided|no .*doc|SOI supplies|SOI-only|remains estimated|pending\/not applied|provided separately|conflict|mismatch|states .*while/i.test(source);
  }

  function companyMetricIsSourced(company, field) {
    const sourcedMetrics = {
      "anchor-forge": ["fdShares", "ownershipPct"],
      "get-sonar": ["fdShares", "ownershipPct"],
      joshu: ["fdShares", "ownershipPct"],
      liquidonate: ["fdShares", "ownershipPct"],
      "lira-ai": ["fdShares", "ownershipPct"],
      materialspace: ["fdShares", "ownershipPct"],
      spiral: ["fdShares", "ownershipPct"],
      uplifted: ["fdShares", "ownershipPct"]
    };
    return sourcedMetrics[company.id]?.includes(field);
  }

  function companyFieldAssumption(company, field) {
    if (companyFieldOrigins[`${company.id}.${field}`] === "user") return "";
    if (companyMetricIsSourced(company, field)) return "";
    if (field === "fdShares") {
      return "Assumption";
    }
    if (field === "ownershipPct") {
      return "Assumption";
    }
    return "";
  }

  function assumptionNote(id) {
    const notes = {
      capitalCalled: "Assumption",
      safeMarkMode: "Assumption"
    };
    return assumptionOrigins[id] === "user" ? "" : notes[id];
  }

  function renderAssumptionLabel(id, label) {
    const note = assumptionNote(id);
    return labelWithAssumption(label, note, Boolean(note));
  }

  function trancheAssumptionNote(tranche) {
    if (tranche.simplifyingAssumption) return "Assumption";
    if (!trancheRequiresSetup(tranche)) return "";
    return "Assumption";
  }

  function sourceRequiresSetup(source = "") {
    if (/^User input supplied during setup/i.test(source)) return false;
    return /estimated|not identified|not cleanly|not yet parsed|no .*provided|no .*doc|SOI-only|remains estimated|pending\/not applied|provided separately|conflict|mismatch|states .*while/i.test(source);
  }

  function trancheRequiresSetup(tranche) {
    if (tranche.simplifyingAssumption) return false;
    return sourceRequiresSetup(tranche.source);
  }

  function trancheNeedsSetupPrompt(tranche) {
    return Boolean(tranche.simplifyingAssumption) || trancheRequiresSetup(tranche);
  }

  function qualityLevelClass(level) {
    return level.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function companyMetricQuality(company, field) {
    if (companyFieldOrigins[`${company.id}.${field}`] === "user") {
      return { level: "User supplied", note: "Entered by a user in setup or the master table." };
    }
    if (field === "shares") {
      return { level: "Sourced", note: "Loaded from the portfolio data source." };
    }
    if (companyMetricIsSourced(company, field)) {
      return { level: "Sourced", note: "Supported by provided cap table, legal document, or user-provided current metric." };
    }
    return { level: "Assumption", note: field === "fdShares" ? "FD share denominator is not explicitly sourced." : "Ownership percentage is not explicitly sourced." };
  }

  function trancheQuality(tranche) {
    if (/^User input supplied/i.test(tranche.source || "")) {
      return { level: "User supplied", note: "User input replaced the default assumption for this security." };
    }
    if (tranche.simplifyingAssumption) {
      return { level: "Assumption", note: tranche.simplifyingAssumption };
    }
    if (trancheRequiresSetup(tranche)) {
      return { level: "Needs review", note: "The source note indicates that one or more terms are not cleanly sourced." };
    }
    return { level: "Sourced", note: "Terms are supported by the provided materials or current metrics." };
  }

  function qualityBadge(level) {
    return `<span class="quality-badge ${qualityLevelClass(level)}">${escapeHtml(level)}</span>`;
  }

  function renderDataQualityPanel(company) {
    const metricRows = [
      ["Current shares held", "shares", companyMetricQuality(company, "shares")],
      ["Fully diluted shares", "fdShares", companyMetricQuality(company, "fdShares")],
      ["Ownership %", "ownershipPct", companyMetricQuality(company, "ownershipPct")]
    ];
    const trancheRows = company.tranches.map((tranche) => {
      const quality = trancheQuality(tranche);
      return `
        <tr>
          <td>${escapeHtml(tranche.name)}</td>
          <td>${qualityBadge(quality.level)}</td>
          <td>${escapeHtml(quality.note)}</td>
        </tr>
      `;
    }).join("");
    return `
      <div class="section data-quality">
        <h3>Data Quality / Source Confidence</h3>
        <div class="quality-grid">
          ${metricRows.map(([label, field, quality]) => `
            <div class="quality-card">
              <span>${escapeHtml(label)}</span>
              <strong>${field === "ownershipPct" ? `${company[field] || 0}%` : number(company[field] || 0)}</strong>
              ${qualityBadge(quality.level)}
              <small>${escapeHtml(quality.note)}</small>
            </div>
          `).join("")}
        </div>
        <table class="table quality-table">
          <thead><tr><th>Security</th><th>Status</th><th>Note</th></tr></thead>
          <tbody>${trancheRows}</tbody>
        </table>
      </div>
    `;
  }

  function setupField(id, label, type, target, note, options = {}) {
    return {
      id,
      label,
      type,
      target,
      note,
      priority: options.priority || "Optional accuracy improvement",
      step: options.step || "any",
      min: options.min ?? 0,
      choices: options.choices || null
    };
  }

  function buildSetupFields() {
    const fields = [
      setupField("capitalCalled", "Capital called", "number", { kind: "assumption", key: "capitalCalled" }, "Used only for net metrics. You can leave this blank and use the default.", { priority: "Fund-level policy" }),
      setupField("safeMarkMode", "SAFE / Note valuation policy", "select", { kind: "assumption", key: "safeMarkMode" }, "This is a model policy choice.", {
        priority: "Fund-level policy",
        choices: [
          ["cost", "Hold at cost"],
          ["cap", "Mark to cap"]
        ]
      })
    ];

    seed.companies.forEach((company) => {
      ["fdShares", "ownershipPct"].forEach((field) => {
        if (!companyFieldAssumption(company, field)) return;
        fields.push(setupField(
          `${company.id}.${field}`,
          `${company.name} - ${field === "fdShares" ? "fully diluted shares" : "ownership %"}`,
          "number",
          { kind: "company", companyId: company.id, key: field },
          field === "fdShares" ? "Company FD share denominator is not sourced." : "Ownership percentage is not sourced.",
          { priority: "Ownership accuracy", step: field === "fdShares" ? "1" : "0.01" }
        ));
      });

      company.tranches.forEach((tranche) => {
        const optionNeedsSetup = ["option", "warrant"].includes(tranche.type) && /FMV exercise price|SOI supplies actual option count/i.test(tranche.source || "");
        if (!trancheNeedsSetupPrompt(tranche) && !optionNeedsSetup) return;
        const prefix = `${company.name} - ${tranche.name}`;
        if (["safe-post", "safe-pre", "note"].includes(tranche.type)) {
          fields.push(setupField(`${tranche.id}.valuationCap`, `${prefix} valuation cap`, "number", { kind: "tranche", trancheId: tranche.id, key: "valuationCap" }, "SAFE/note cap is not fully sourced.", { priority: "SAFE / note terms" }));
          fields.push(setupField(`${tranche.id}.discountPct`, `${prefix} discount %`, "number", { kind: "tranche", trancheId: tranche.id, key: "discountPct" }, "SAFE/note discount is not fully sourced.", { priority: "SAFE / note terms", step: "0.1" }));
          fields.push(setupField(`${tranche.id}.cashOutMultiple`, `${prefix} cash-out multiple`, "number", { kind: "tranche", trancheId: tranche.id, key: "cashOutMultiple" }, "Liquidity cash-out multiple is not fully sourced.", { priority: "SAFE / note terms", step: "0.1" }));
          fields.push(setupField(`${tranche.id}.proRata`, `${prefix} pro-rata rights`, "select", { kind: "tranche", trancheId: tranche.id, key: "proRata" }, "Pro-rata/side-letter rights are not fully sourced.", {
            priority: "SAFE / note terms",
            choices: [["false", "No"], ["true", "Yes"]]
          }));
        } else if (["option", "warrant"].includes(tranche.type)) {
          fields.push(setupField(`${tranche.id}.strikePrice`, `${prefix} strike / exercise price`, "number", { kind: "tranche", trancheId: tranche.id, key: "strikePrice" }, "Strike or exercise price is not fully sourced.", { priority: "Option / warrant terms", step: "0.0001" }));
          fields.push(setupField(`${tranche.id}.vestedPct`, `${prefix} vested %`, "number", { kind: "tranche", trancheId: tranche.id, key: "vestedPct" }, "Vesting percentage is not fully sourced.", { priority: "Option / warrant terms", step: "0.1" }));
        } else if (tranche.type === "priced") {
          fields.push(setupField(`${tranche.id}.liqMultiple`, `${prefix} liquidation preference multiple`, "number", { kind: "tranche", trancheId: tranche.id, key: "liqMultiple" }, "Liquidation preference multiple is not fully sourced.", { priority: "Exit waterfall terms", step: "0.1" }));
          fields.push(setupField(`${tranche.id}.seniority`, `${prefix} seniority rank`, "number", { kind: "tranche", trancheId: tranche.id, key: "seniority" }, "Seniority rank is not fully sourced.", { priority: "Exit waterfall terms", step: "1" }));
          fields.push(setupField(`${tranche.id}.participation`, `${prefix} participation`, "select", { kind: "tranche", trancheId: tranche.id, key: "participation" }, "Participation rights are not fully sourced.", {
            priority: "Exit waterfall terms",
            choices: [["non", "Non-participating"], ["full", "Fully participating"], ["common", "Common/as-converted only"]]
          }));
        } else if (tranche.type === "common") {
          fields.push(setupField(`${tranche.id}.shares`, `${prefix} confirmed shares held`, "number", { kind: "tranche", trancheId: tranche.id, key: "shares" }, "The legal document conflicts with or does not cleanly match the SOI share count.", { priority: "Ownership accuracy", step: "1" }));
        }
      });
    });

    return fields;
  }

  function groupedSetupFields(fields) {
    return fields.reduce((groups, field) => {
      groups[field.priority] ||= [];
      groups[field.priority].push(field);
      return groups;
    }, {});
  }

  function setupInputHtml(field) {
    if (field.type === "select") {
      const options = field.choices.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
      return `<select name="${escapeHtml(field.id)}"><option value="">Use default assumption</option>${options}</select>`;
    }
    return `<input name="${escapeHtml(field.id)}" type="${field.type}" min="${field.min}" step="${field.step}" placeholder="Use default assumption" />`;
  }

  function renderSetupGate() {
    const gate = $("setupGate");
    if (!gate) return;
    if (setupIsComplete()) {
      gate.classList.add("hidden");
      document.body.classList.remove("setup-active");
      return;
    }
    const fields = buildSetupFields();
    if (!fields.length) {
      setSetupComplete();
      gate.classList.add("hidden");
      document.body.classList.remove("setup-active");
      return;
    }
    $("setupCount").textContent = `${fields.length} fields`;
    const groups = groupedSetupFields(fields);
    $("setupFields").innerHTML = Object.entries(groups).map(([group, groupFields]) => `
      <section class="setup-group">
        <h3>${escapeHtml(group)}</h3>
        <div class="setup-group-grid">
          ${groupFields.map((field) => `
            <label class="setup-field">
              <span>${escapeHtml(field.label)}</span>
              ${setupInputHtml(field)}
              <small>${escapeHtml(field.note)}</small>
            </label>
          `).join("")}
        </div>
      </section>
    `).join("");
    document.body.classList.add("setup-active");
    gate.classList.remove("hidden");
  }

  function fieldById(fields, id) {
    return fields.find((field) => field.id === id);
  }

  function findTranche(trancheId) {
    for (const company of seed.companies) {
      const tranche = company.tranches.find((item) => item.id === trancheId);
      if (tranche) return { company, tranche };
    }
    return null;
  }

  function coerceSetupValue(field, rawValue) {
    if (field.type === "select" && field.target.key === "proRata") return rawValue === "true";
    if (field.type === "select") return rawValue;
    return Number(rawValue);
  }

  function hasSetupInput(rawValue) {
    return rawValue !== null && String(rawValue).trim() !== "";
  }

  function applySetupValue(field, value) {
    if (field.target.kind === "assumption") {
      setupInputs.assumptions[field.target.key] = value;
      assumptions[field.target.key] = value;
      assumptionOrigins[field.target.key] = "user";
      return;
    }
    if (field.target.kind === "company") {
      setupInputs.companies[field.target.companyId] ||= {};
      setupInputs.companies[field.target.companyId][field.target.key] = value;
      const company = seed.companies.find((item) => item.id === field.target.companyId);
      if (company) company[field.target.key] = value;
      companyFieldOrigins[`${field.target.companyId}.${field.target.key}`] = "user";
      return;
    }
    if (field.target.kind === "tranche") {
      setupInputs.tranches[field.target.trancheId] ||= {};
      setupInputs.tranches[field.target.trancheId][field.target.key] = value;
      const match = findTranche(field.target.trancheId);
      if (match) {
        match.tranche[field.target.key] = value;
        delete match.tranche.simplifyingAssumption;
        match.tranche.source = `User input supplied during setup; original note: ${match.tranche.source || "unsourced"}`;
        if (field.target.key === "shares") {
          match.company.shares = match.company.tranches.reduce((total, tranche) => total + (Number(tranche.shares) || 0), 0);
        }
      }
    }
  }

  function submitSetup(event) {
    event.preventDefault();
    const fields = buildSetupFields();
    const data = new FormData(event.currentTarget);
    fields.forEach((field) => {
      const rawValue = data.get(field.id);
      if (!hasSetupInput(rawValue)) return;
      applySetupValue(field, coerceSetupValue(field, rawValue));
    });
    saveSetupInputs();
    saveAssumptions();
    saveAssumptionOrigins();
    saveCompanyFieldOrigins();
    setSetupComplete();
    render();
  }

  function unresolvedInputCount() {
    return setupIsComplete() ? buildSetupFields().length : buildSetupFields().length;
  }

  function portfolioHasUnsourcedDenominators() {
    return seed.companies.some((company) => companyFieldAssumption(company, "fdShares") || companyFieldAssumption(company, "ownershipPct"));
  }

  function renderScenarioSelect() {
    $("scenarioSelect").innerHTML = scenarios.map((scenario) => (
      `<option value="${scenario.id}" ${scenario.id === activeScenarioId ? "selected" : ""}>${escapeHtml(scenario.name)}</option>`
    )).join("");
  }

  function renderDashboard() {
    const current = model.computeFund(seed.companies, { events: {} }, { ...assumptions, safeMarkMode: "cost" }, seed.asOfDate);
    const pro = model.computeFund(seed.companies, activeScenario(), assumptions, seed.asOfDate);
    const denominatorNote = portfolioHasUnsourcedDenominators()
      ? "This value depends on company-level FD share or ownership inputs that have not been supplied yet."
      : "";
    const currentCards = [
      ["TVPI", multiple(current.tvpi)],
      ["DPI", multiple(current.dpi)],
      ["RVPI", multiple(current.rvpi)],
      ["IRR", irr(current.irr)],
      ["MOIC", multiple(current.moic)],
      ["Portfolio EV", money(current.totalEV), denominatorNote],
      ["Aggregate ownership", percent(current.aggregateOwnership), denominatorNote]
    ];
    const netMetricNote = ["capitalCalled"].map(assumptionNote).filter(Boolean).join(" ");
    const proCards = [
      ["Gross TVPI", multiple(pro.tvpi)],
      ["Gross DPI", multiple(pro.dpi)],
      ["Gross RVPI", multiple(pro.rvpi)],
      ["Gross IRR", irr(pro.irr)],
      ["Net TVPI", multiple(pro.netTvpi), netMetricNote || ""],
      ["Total EV", money(pro.totalEV), denominatorNote],
      ["Aggregate ownership", percent(pro.aggregateOwnership), denominatorNote]
    ];
    $("currentMetrics").innerHTML = currentCards.map(([label, value, note]) => metricCard(label, value, note)).join("");
    $("proFormaMetrics").innerHTML = proCards.map(([label, value, note]) => metricCard(label, value, note)).join("");
    const deltas = [
      ["TVPI delta", pro.tvpi - current.tvpi, "x"],
      ["DPI delta", pro.dpi - current.dpi, "x"],
      ["RVPI delta", pro.rvpi - current.rvpi, "x"],
      ["Top 3 NAV", pro.top3, "%"],
      ["Loss ratio", pro.lossRatio, "%"]
    ];
    $("deltaMetrics").innerHTML = deltas.map(([label, value, kind]) => {
      const negative = value < 0;
      const rendered = kind === "$" ? money(value) : kind === "%" ? percent(value) : `${value >= 0 ? "+" : ""}${value.toFixed(2)}x`;
      const note = label === "Top 3 NAV" && unresolvedInputCount() > 0
        ? "This delta depends on missing inputs that must be supplied in setup."
        : "";
      return `<div class="delta ${negative ? "negative" : ""}"><div class="muted">${label}</div><strong>${note ? withAssumption(rendered, note) : rendered}</strong></div>`;
    }).join("");
  }

  function renderChangeSummary() {
    const node = $("changeSummary");
    if (!node) return;
    const items = changeItems();
    node.classList.toggle("hidden", !items.length);
    if (!items.length) {
      node.innerHTML = "";
      return;
    }
    node.innerHTML = `
      <div class="change-summary-header">
        <div>
          <p class="eyebrow">Current changes</p>
          <h2>${items.length} change${items.length === 1 ? "" : "s"}</h2>
        </div>
        <button id="revertAllChangesBtn" type="button" class="secondary">Revert All Changes</button>
      </div>
      <div class="change-list">
        ${items.map((item) => `
          <div class="change-item">
            <div>
              <strong>${escapeHtml(item.title)} <span class="change-intent ${intentClass(item.intent)}">${escapeHtml(item.intent)}</span></strong>
              <span>${escapeHtml(item.detail)}</span>
            </div>
            <button type="button" data-revert-change="${escapeHtml(item.key)}">Revert</button>
          </div>
        `).join("")}
      </div>
    `;
    $("revertAllChangesBtn").addEventListener("click", () => {
      if (!confirm("Revert all current edits and scenario events?")) return;
      revertAllChanges();
    });
  }

  function renderCompanyList() {
    const query = $("companySearch").value.trim().toLowerCase();
    const pro = model.computeFund(seed.companies, activeScenario(), assumptions, seed.asOfDate);
    $("companyRows").innerHTML = seed.companies
      .filter((company) => !query || company.name.toLowerCase().includes(query))
      .map((company) => {
        const state = pro.byCompany[company.id];
        const count = eventsFor(company.id).length;
        return `<button class="company-row ${company.id === selectedCompanyId ? "active" : ""}" data-company="${company.id}" type="button">
          <span><strong>${escapeHtml(company.name)}</strong><small>${money(state.value)} NAV · ${percent(state.ownership)} ownership · ${count} event${count === 1 ? "" : "s"}</small></span>
          <span class="badge">${multiple((state.value + state.distributions) / Math.max(state.cost, 1))}</span>
        </button>`;
      }).join("");
    document.querySelectorAll("[data-company]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedCompanyId = button.dataset.company;
        render();
      });
    });
  }

  function renderCompanyDetail() {
    const company = selectedCompany();
    const state = model.applyCompanyScenario(company, eventsFor(company.id), assumptions);
    $("selectedName").textContent = company.name;
    $("selectedStats").innerHTML = [
      ["Cost", money(state.cost)],
      ["NAV", money(state.value)],
      ["Ownership", percent(state.ownership), companyFieldAssumption(company, "ownershipPct")]
    ].map(([label, value, note]) => `<div class="mini-stat"><span>${label}</span><strong>${note ? withAssumption(value, note) : value}</strong></div>`).join("");
    renderBaseline(company, state);
    renderRound(company);
    renderSecondary(company);
    renderExit(company);
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tab === activeTab);
    });
    document.querySelectorAll(".panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `${activeTab}Panel`);
    });
  }

  function renderViewTabs() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === activeView);
    });
    const companyHidden = activeView !== "company";
    const masterHidden = activeView !== "master";
    $("companyWorkspace").classList.toggle("hidden", companyHidden);
    $("masterWorkspace").classList.toggle("hidden", masterHidden);
    $("companyWorkspace").hidden = companyHidden;
    $("masterWorkspace").hidden = masterHidden;
    $("companyWorkspace").style.display = companyHidden ? "none" : "";
    $("masterWorkspace").style.display = masterHidden ? "none" : "";
  }

  function visibleColumns() {
    const columns = masterColumns();
    const selected = new Set(visibleMasterColumns);
    const visible = columns.filter((column) => column.fixed || selected.has(column.id));
    return visible.length ? visible : columns.filter((column) => column.fixed);
  }

  function renderColumnPicker() {
    const selected = new Set(visibleMasterColumns);
    $("columnPicker").innerHTML = masterColumns().map((column) => `
      <label>
        <input type="checkbox" data-column-toggle="${escapeHtml(column.id)}" ${column.fixed ? "checked disabled" : selected.has(column.id) ? "checked" : ""} />
        <span>${escapeHtml(column.label)}</span>
      </label>
    `).join("");
  }

  function tableCellKey(company, column) {
    return `${company.id}.${column.id}`;
  }

  function rowHasMasterEdits(company) {
    return Array.from(editedMasterCells).some((key) => key.startsWith(`${company.id}.`));
  }

  function formatMasterValue(column, value) {
    if (value === "" || value === null || value === undefined || Number.isNaN(value)) return "N/A";
    if (column.kind === "money") return money(value);
    if (column.kind === "percent") return percent(value);
    if (column.kind === "multiple") return multiple(value);
    if (column.kind === "irr") return irr(value);
    if (column.kind === "month") return value;
    if (column.kind === "number") return number(value);
    if (column.kind === "select") {
      const choice = column.choices?.find(([choiceValue]) => String(choiceValue) === String(value));
      return choice ? choice[1] : value || "Mixed";
    }
    return value;
  }

  function columnIntent(column) {
    if (!column.editable) return "Calculated output";
    if (column.target === "scenarioValuation" || column.target === "scenarioEvent") return "Hypothetical lever";
    if (column.target === "company" || column.target === "aggregate") return "Current-book data";
    return "Reference";
  }

  function intentClass(intent) {
    return intent.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function masterInputValue(value) {
    if (value === "" || value === null || value === undefined || Number.isNaN(value)) return "";
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return value;
    return Number.isInteger(numberValue) ? String(numberValue) : String(Math.round(numberValue * 10000) / 10000);
  }

  function renderMasterCell(company, column, context) {
    const key = tableCellKey(company, column);
    const rowEdited = rowHasMasterEdits(company);
    const edited = editedMasterCells.has(key);
    const affected = !edited && rowEdited && column.affected;
    const intent = columnIntent(column);
    const classes = [`intent-${intentClass(intent)}`, edited ? "edited-cell" : "", affected ? "affected-cell" : ""].filter(Boolean).join(" ");
    const value = column.value(context);
    if (column.fixed) return `<td class="${classes}"><span class="readonly">${escapeHtml(value)}</span></td>`;
    if (!column.editable) return `<td class="${classes}"><span class="readonly">${escapeHtml(formatMasterValue(column, value))}</span></td>`;
    const hasTarget = column.target === "company" || column.target === "scenarioValuation" || column.target === "scenarioEvent" || aggregateTranches(company, column.aggregate).length > 0;
    if (!hasTarget) return `<td class="muted-cell ${classes}">N/A</td>`;
    if (column.kind === "select") {
      const options = column.choices.map(([choiceValue, label]) => (
        `<option value="${escapeHtml(choiceValue)}" ${String(choiceValue) === String(value) ? "selected" : ""}>${escapeHtml(label)}</option>`
      )).join("");
      return `<td class="${classes}"><select title="${escapeHtml(intent)}" data-master-input="${escapeHtml(column.id)}" data-company-id="${escapeHtml(company.id)}"><option value="">Mixed</option>${options}</select></td>`;
    }
    if (column.kind === "month") {
      return `<td class="${classes}"><input title="${escapeHtml(intent)}" data-master-input="${escapeHtml(column.id)}" data-company-id="${escapeHtml(company.id)}" type="month" value="${escapeHtml(masterInputValue(value))}" /></td>`;
    }
    return `<td class="${classes}"><input title="${escapeHtml(intent)}" data-master-input="${escapeHtml(column.id)}" data-company-id="${escapeHtml(company.id)}" type="number" step="${column.step || "any"}" value="${escapeHtml(masterInputValue(value))}" /></td>`;
  }

  function groupedMasterHeaders(columns) {
    return columns.reduce((groups, column) => {
      const label = column.group || "Other";
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.count += 1;
      } else {
        groups.push({ label, count: 1, fixed: column.fixed });
      }
      return groups;
    }, []);
  }

  function renderMasterTable() {
    renderColumnPicker();
    const current = model.computeFund(seed.companies, { events: {} }, { ...assumptions, safeMarkMode: "cost" }, seed.asOfDate);
    const pro = model.computeFund(seed.companies, activeScenario(), assumptions, seed.asOfDate);
    const columns = visibleColumns();
    $("masterTable").innerHTML = `
      <thead>
        <tr class="master-group-row">
          ${groupedMasterHeaders(columns).map((group) => `<th class="master-group-heading ${group.fixed ? "sticky-left" : ""}" colspan="${group.count}">${escapeHtml(group.label)}</th>`).join("")}
        </tr>
        <tr class="master-column-row">
          ${columns.map((column) => `<th class="master-column-heading">${escapeHtml(column.label)}<span class="column-intent">${escapeHtml(columnIntent(column))}</span></th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${seed.companies.map((company) => {
          const context = { company, state: current.byCompany[company.id], proState: pro.byCompany[company.id] };
          return `<tr>${columns.map((column) => renderMasterCell(company, column, context)).join("")}</tr>`;
        }).join("")}
      </tbody>
    `;
  }

  function masterColumnById(id) {
    return masterColumns().find((column) => column.id === id);
  }

  function currentMasterValue(company, column) {
    const state = model.applyCompanyScenario(company, [], { ...assumptions, safeMarkMode: "cost" });
    const proState = model.applyCompanyScenario(company, eventsFor(company.id), assumptions);
    return column.value({ company, state, proState });
  }

  function masterValuesEqual(column, previous, next) {
    if (column.kind === "select") return String(previous) === String(next);
    return String(masterInputValue(previous)) === String(masterInputValue(next));
  }

  function coerceMasterEditValue(column, rawValue) {
    if (column.kind === "select" && column.eventKey?.endsWith(".enabled")) return rawValue === "true";
    if (column.kind === "select") return rawValue;
    if (column.kind === "month") return rawValue;
    return Number(rawValue) || 0;
  }

  function displayComparableValue(column, value) {
    if (column.kind === "select" && typeof value === "boolean") return String(value);
    return value;
  }

  function applyMasterScenarioEventEdit(companyId, column, value) {
    const event = upsertMasterScenarioEvent(companyId, column.eventType);
    const nextValue = column.kind === "month" && column.eventKey === "date"
      ? dateFromMonth(value, event.date)
      : value;
    setNestedValue(event, column.eventKey, nextValue);
    saveScenarios();
  }

  function applyMasterTableEdit(companyId, columnId, rawValue) {
    const company = seed.companies.find((item) => item.id === companyId);
    const column = masterColumnById(columnId);
    if (!company || !column || !column.editable) return;
    const value = coerceMasterEditValue(column, rawValue);
    const previous = currentMasterValue(company, column);
    if (masterValuesEqual(column, displayComparableValue(column, previous), displayComparableValue(column, value))) return;
    if (column.target === "company") {
      company[column.key] = value;
      if (["fdShares", "ownershipPct", "shares"].includes(column.key)) {
        companyFieldOrigins[`${company.id}.${column.key}`] = "user";
      }
      saveCompanyFieldOrigins();
    } else if (column.target === "aggregate") {
      setAggregateField(company, column.aggregate, column.key, value);
    } else if (column.target === "scenarioValuation") {
      upsertValuationEvent(company.id, value);
    } else if (column.target === "scenarioEvent") {
      applyMasterScenarioEventEdit(company.id, column, value);
    }
    editedMasterCells.add(`${company.id}.${column.id}`);
    render();
  }

  function handleMasterInputCommit(input) {
    const masterInput = input.dataset.masterInput;
    if (!masterInput) return;
    if (input.tagName === "SELECT" && input.value === "") return;
    applyMasterTableEdit(input.dataset.companyId, masterInput, input.value);
  }

  function scheduleMasterInputCommit(input) {
    const masterInput = input.dataset.masterInput;
    if (!masterInput || input.tagName === "SELECT") return;
    const companyId = input.dataset.companyId;
    const value = input.value;
    const key = `${companyId}.${masterInput}`;
    clearTimeout(masterInputTimers.get(key));
    masterInputTimers.set(key, setTimeout(() => {
      masterInputTimers.delete(key);
      applyMasterTableEdit(companyId, masterInput, value);
    }, 350));
  }

  function renderBaseline(company, state) {
    $("baselinePanel").innerHTML = `
      <div class="two-col">
        <div class="section">
          <h3>Current capitalization</h3>
          <p class="muted">Read-only current book data. Model future changes in the Future Round, Secondary, Exit tabs, or the hypothetical columns in Master Table.</p>
          <div class="readonly-grid">
            <div class="readonly-field"><span>Current shares held</span><strong>${number(company.shares || 0)}</strong></div>
            <div class="readonly-field"><span>${renderCompanyFieldLabel(company, "fdShares", "Fully diluted shares")}</span><strong>${number(company.fdShares || 0)}</strong></div>
            <div class="readonly-field"><span>${renderCompanyFieldLabel(company, "ownershipPct", "Ownership %")}</span><strong>${company.ownershipPct || 0}%</strong></div>
          </div>
        </div>
        <div class="section">
          <h3>Pro forma company state</h3>
          <div class="detail-stats">
            <div class="mini-stat"><span>Shares</span><strong>${number(state.shares)}</strong></div>
            <div class="mini-stat"><span>FD shares</span><strong>${withAssumption(number(state.totalShares), companyFieldAssumption(company, "fdShares"), Boolean(companyFieldAssumption(company, "fdShares")))}</strong></div>
            <div class="mini-stat"><span>Distributions</span><strong>${money(state.distributions)}</strong></div>
          </div>
        </div>
      </div>
      ${renderDataQualityPanel(company)}
      <div class="section">
        <h3>Tranches and liquidation preferences</h3>
        <table class="table">
          <thead><tr><th>Security</th><th>Type</th><th>Date</th><th>Shares</th><th>Cost</th><th>Value</th><th>Terms</th><th>Source</th></tr></thead>
          <tbody>${company.tranches.map((tranche) => `
            <tr>
              <td>${escapeHtml(tranche.name)}</td><td>${escapeHtml(labelType(tranche.type))}</td><td>${tranche.date || ""}</td>
              <td>${number(tranche.shares || 0)}</td><td>${money(tranche.cost || 0)}</td><td>${money(model.trancheCurrentValue(tranche, assumptions))}${tranche.advisorShare ? " (80%)" : ""}</td>
              <td>${renderTrancheTerms(tranche)}</td><td class="source-cell">${escapeHtml(tranche.source || "SOI / estimated")}</td>
            </tr>`).join("")}</tbody>
        </table>
      </div>
      ${renderEvents(company.id)}
    `;
  }

  function renderRound(company) {
    $("roundPanel").innerHTML = `
      <div class="section">
        <h3>Model future primary round</h3>
        <div class="form-grid">
          <label>Target date<input id="roundDate" type="month" value="2026-12" /></label>
          <label>Round size<input id="roundSize" type="number" step="50000" value="5000000" /></label>
          <label>Pre-money valuation<input id="preMoney" type="number" step="100000" value="20000000" /></label>
          <label>Option pool expansion %<input id="optionPoolPct" type="number" step="1" value="10" /></label>
          <label>Fund action<select id="roundAction"><option value="none">Do nothing</option><option value="prorata">Pro-rata</option><option value="custom">Custom check</option></select></label>
          <label>Custom check<input id="customCheck" type="number" step="25000" value="100000" /></label>
        </div>
        <p class="muted">Option pool expansion is applied inside pre-money share price mechanics so dilution is borne by existing holders.</p>
        <h3 class="subhead">Concurrent secondary in this round</h3>
        <div class="form-grid">
          <label>Include secondary<select id="roundSecondaryEnabled"><option value="no">No</option><option value="yes">Yes</option></select></label>
          <label>Buy / sell<select id="roundSecondarySide"><option value="sell">Sell shares</option><option value="buy">Buy shares</option></select></label>
          <label>Amount mode<select id="roundSecondaryMode"><option value="pct">% of position</option><option value="shares">Shares</option><option value="dollars">Dollars</option></select></label>
          <label>Amount<input id="roundSecondaryAmount" type="number" step="1" value="20" /></label>
          <label>Discount / premium to round price %<input id="roundSecondaryDiscount" type="number" step="1" value="-30" /></label>
          <label>Pricing basis<input type="text" disabled value="New round share price" /></label>
        </div>
        <button id="addRoundBtn" type="button">Add Future Round</button>
      </div>
      ${renderEvents(company.id)}
    `;
    $("addRoundBtn").addEventListener("click", () => addEvent(company.id, {
      type: "round",
      date: `${$("roundDate").value}-01`,
      roundSize: Number($("roundSize").value) || 0,
      preMoney: Number($("preMoney").value) || 0,
      optionPoolPct: Number($("optionPoolPct").value) || 0,
      action: $("roundAction").value,
      customCheck: Number($("customCheck").value) || 0,
      secondary: {
        enabled: $("roundSecondaryEnabled").value === "yes",
        side: $("roundSecondarySide").value,
        mode: $("roundSecondaryMode").value,
        amount: Number($("roundSecondaryAmount").value) || 0,
        premiumDiscountPct: Number($("roundSecondaryDiscount").value) || 0
      }
    }));
  }

  function renderSecondary(company) {
    $("secondaryPanel").innerHTML = `
      <div class="section">
        <h3>Model secondary transaction</h3>
        <div class="form-grid">
          <label>Target date<input id="secondaryDate" type="month" value="2027-06" /></label>
          <label>Buy / sell<select id="secondarySide"><option value="sell">Sell shares</option><option value="buy">Buy shares</option></select></label>
          <label>Amount mode<select id="secondaryMode"><option value="pct">% of position</option><option value="shares">Shares or dollars</option></select></label>
          <label>Amount<input id="secondaryAmount" type="number" step="1" value="20" /></label>
          <label>Discount / premium %<input id="secondaryDiscount" type="number" step="1" value="-30" /></label>
          <label>Last price<input type="text" disabled value="${money(model.weightedSharePrice(company))} / share" /></label>
        </div>
        <button id="addSecondaryBtn" type="button">Add Secondary</button>
      </div>
      ${renderEvents(company.id)}
    `;
    $("addSecondaryBtn").addEventListener("click", () => addEvent(company.id, {
      type: "secondary",
      date: `${$("secondaryDate").value}-01`,
      side: $("secondarySide").value,
      mode: $("secondaryMode").value,
      amount: Number($("secondaryAmount").value) || 0,
      premiumDiscountPct: Number($("secondaryDiscount").value) || 0
    }));
  }

  function renderExit(company) {
    $("exitPanel").innerHTML = `
      <div class="section">
        <h3>Model exit or write-off</h3>
        <div class="form-grid">
          <label>Target date<input id="exitDate" type="month" value="2029-12" /></label>
          <label>Exit type<select id="exitType"><option value="ma">M&amp;A</option><option value="ipo">IPO</option><option value="writeoff">Write-off</option></select></label>
          <label>Exit enterprise value<input id="exitEV" type="number" step="1000000" value="100000000" /></label>
        </div>
        <p class="muted">The waterfall honors preferred liquidation multiples and seniority first, then allocates residual value to common, options, warrants, and SAFE conversion assumptions.</p>
        <button id="addExitBtn" type="button">Add Exit / Write-off</button>
      </div>
      ${renderEvents(company.id)}
    `;
    $("addExitBtn").addEventListener("click", () => addEvent(company.id, {
      type: "exit",
      date: `${$("exitDate").value}-01`,
      exitType: $("exitType").value,
      exitEV: Number($("exitEV").value) || 0
    }));
  }

  function renderEvents(companyId) {
    const events = eventsFor(companyId);
    if (!events.length) return `<div class="section"><h3>Scenario events</h3><p class="muted">No hypotheticals for this company in the active scenario.</p></div>`;
    return `<div class="section"><h3>Scenario events</h3><div class="events">${events.map((event) => `
      <div class="event-row">
        <strong>${event.date || ""}</strong>
        <span>${escapeHtml(describeEvent(event))}</span>
        <button data-delete-event="${event.id}" type="button">Remove</button>
      </div>`).join("")}</div></div>`;
  }

  function describeEvent(event) {
    if (event.type === "round") {
      const secondary = event.secondary?.enabled
        ? `; concurrent secondary ${event.secondary.side} ${event.secondary.amount}${event.secondary.mode === "pct" ? "% position" : ` ${event.secondary.mode}`} at ${event.secondary.premiumDiscountPct}% to round price`
        : "";
      return `Future round: ${money(event.roundSize)} at ${money(event.preMoney)} pre, ${event.optionPoolPct}% pool, action ${event.action}${secondary}`;
    }
    if (event.type === "secondary") return `${event.side === "sell" ? "Sell" : "Buy"} secondary: ${event.amount}${event.mode === "pct" ? "% position" : ""} at ${event.premiumDiscountPct}% to last round`;
    if (event.type === "valuation") return `Pro forma company valuation set to ${money(event.enterpriseValue)} EV`;
    if (event.type === "exit") return event.exitType === "writeoff" ? "Write-off" : `${event.exitType.toUpperCase()} exit at ${money(event.exitEV)} EV`;
    return event.type;
  }

  function describeTrancheTerms(tranche) {
    if (["safe-post", "safe-pre", "note"].includes(tranche.type)) {
      const cap = tranche.valuationCap ? `cap ${money(tranche.valuationCap)}` : "no cap";
      const discount = tranche.discountPct ? `${tranche.discountPct}% discount` : "no discount";
      const cashOut = tranche.cashOutMultiple && tranche.cashOutMultiple !== 1 ? `${tranche.cashOutMultiple}x cash-out` : "1x cash-out";
      const threshold = tranche.qualifiedFinancingMin ? `; QEF ${money(tranche.qualifiedFinancingMin)}` : "";
      return `${cap}; ${discount}; ${cashOut}${threshold}`;
    }
    if (["option", "warrant"].includes(tranche.type)) {
      const strike = tranche.strikePrice || tranche.strikePrice === 0 ? `strike ${money(tranche.strikePrice)}` : "strike N/A";
      const vesting = tranche.vestingMonths ? `${tranche.vestingMonths}-month vesting` : `${tranche.vestedPct ?? 100}% vested`;
      return `${strike}; ${vesting}`;
    }
    if (tranche.liqMultiple || tranche.participation) {
      return `${tranche.liqMultiple || 0}x pref; rank ${tranche.seniority || 1}; ${tranche.participation || "N/A"}`;
    }
    return "N/A";
  }

  function renderTrancheTerms(tranche) {
    const note = trancheAssumptionNote(tranche);
    return withAssumption(escapeHtml(describeTrancheTerms(tranche)), note, Boolean(note));
  }

  function renderCompanyFieldLabel(company, field, label) {
    const note = companyFieldAssumption(company, field);
    return labelWithAssumption(label, note, Boolean(note));
  }

  function addEvent(companyId, event) {
    event.id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    eventsFor(companyId).push(event);
    saveScenarios();
    render();
  }

  function bindStaticEvents() {
    $("setupForm").addEventListener("submit", submitSetup);
    $("scenarioSelect").addEventListener("change", (event) => {
      activeScenarioId = event.target.value;
      render();
    });
    $("saveScenarioBtn").addEventListener("click", () => {
      const name = prompt("Scenario name", `Scenario ${scenarios.length}`);
      if (!name) return;
      const copy = model.clone(activeScenario());
      copy.id = `${Date.now()}`;
      copy.name = name;
      scenarios.push(copy);
      activeScenarioId = copy.id;
      saveScenarios();
      render();
    });
    $("resetScenarioBtn").addEventListener("click", () => {
      if (!confirm("Revert all current edits and scenario events?")) return;
      revertAllChanges();
    });
    $("companySearch").addEventListener("input", renderCompanyList);
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        activeTab = tab.dataset.tab;
        renderCompanyDetail();
      });
    });
    ["capitalCalled", "safeMarkMode"].forEach((id) => {
      $(id).addEventListener("change", () => {
        assumptions[id] = id === "safeMarkMode" ? $(id).value : Number($(id).value) || 0;
        assumptionOrigins[id] = "user";
        saveAssumptions();
        saveAssumptionOrigins();
        render();
      });
    });
    document.body.addEventListener("click", (event) => {
      const view = event.target.dataset.view;
      if (view) {
        activeView = view;
        render();
        return;
      }
      const revertKey = event.target.dataset.revertChange;
      if (revertKey) {
        revertChange(revertKey);
        return;
      }
      const id = event.target.dataset.deleteEvent;
      if (!id) return;
      const events = eventsFor(selectedCompanyId);
      const index = events.findIndex((item) => item.id === id);
      if (index >= 0) events.splice(index, 1);
      saveScenarios();
      render();
    });
    document.body.addEventListener("change", (event) => {
      const columnId = event.target.dataset.columnToggle;
      if (columnId) {
        const selected = new Set(visibleMasterColumns);
        if (event.target.checked) selected.add(columnId);
        else selected.delete(columnId);
        visibleMasterColumns = Array.from(selected);
        saveVisibleMasterColumns();
        renderMasterTable();
        return;
      }
      const masterInput = event.target.dataset.masterInput;
      if (masterInput) {
        handleMasterInputCommit(event.target);
      }
    });
    document.body.addEventListener("focusout", (event) => {
      if (event.target.dataset.masterInput) handleMasterInputCommit(event.target);
    });
    document.body.addEventListener("input", (event) => {
      if (event.target.dataset.masterInput) scheduleMasterInputCommit(event.target);
    });
  }

  function renderAssumptions() {
    const labels = {
      capitalCalled: "Capital called",
      safeMarkMode: "SAFE / Note marks"
    };
    Object.entries(labels).forEach(([id, label]) => {
      const node = document.querySelector(`[data-assumption-label="${id}"]`);
      if (node) node.innerHTML = renderAssumptionLabel(id, label);
    });
    $("capitalCalled").value = assumptions.capitalCalled;
    $("managementFeePct").value = assumptions.managementFeePct;
    $("carryPct").value = assumptions.carryPct;
    $("safeMarkMode").value = assumptions.safeMarkMode;
  }

  function render() {
    renderAssumptions();
    renderViewTabs();
    renderScenarioSelect();
    renderDashboard();
    renderChangeSummary();
    renderCompanyList();
    renderCompanyDetail();
    renderMasterTable();
    renderSetupGate();
  }

  function labelType(type) {
    const labels = {
      priced: "Priced equity",
      common: "Common",
      "safe-post": "Post-money SAFE",
      "safe-pre": "Pre-money SAFE",
      note: "Convertible note",
      option: "Options",
      warrant: "Warrants"
    };
    return labels[type] || type;
  }

  function number(value) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value) || 0);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[char]));
  }

  bindStaticEvents();
  render();
})();
