(function () {
  const seed = window.SEED_PORTFOLIO;
  const model = window.VCModel;
  const storageKey = "maccabee-fund-ii-scenarios-v1";
  const assumptionsKey = "maccabee-fund-ii-assumptions-v1";
  const assumptionOriginsKey = "maccabee-fund-ii-assumption-origins-v1";
  const companyFieldOriginsKey = "maccabee-fund-ii-company-field-origins-v1";
  const setupInputsKey = "maccabee-fund-ii-required-inputs-v2";
  const setupCompleteKey = "maccabee-fund-ii-setup-complete-v3";

  let assumptions = loadAssumptions();
  let assumptionOrigins = loadAssumptionOrigins();
  let companyFieldOrigins = loadCompanyFieldOrigins();
  let setupInputs = loadSetupInputs();
  let scenarios = loadScenarios();
  let activeScenarioId = scenarios[0].id;
  let selectedCompanyId = seed.companies[0].id;
  let activeTab = "baseline";

  const $ = (id) => document.getElementById(id);

  applySetupInputs();

  function loadAssumptions() {
    const saved = localStorage.getItem(assumptionsKey);
    const loaded = saved ? { ...seed.assumptions, ...JSON.parse(saved) } : model.clone(seed.assumptions);
    loaded.managementFeePct = 2.5;
    loaded.carryPct = 20;
    delete loaded.fundSize;
    delete loaded.dryPowderReserve;
    return loaded;
  }

  function saveAssumptions() {
    localStorage.setItem(assumptionsKey, JSON.stringify(assumptions));
  }

  function loadAssumptionOrigins() {
    const saved = localStorage.getItem(assumptionOriginsKey);
    return saved ? JSON.parse(saved) : {};
  }

  function saveAssumptionOrigins() {
    localStorage.setItem(assumptionOriginsKey, JSON.stringify(assumptionOrigins));
  }

  function loadCompanyFieldOrigins() {
    const saved = localStorage.getItem(companyFieldOriginsKey);
    return saved ? JSON.parse(saved) : {};
  }

  function saveCompanyFieldOrigins() {
    localStorage.setItem(companyFieldOriginsKey, JSON.stringify(companyFieldOrigins));
  }

  function loadSetupInputs() {
    const saved = localStorage.getItem(setupInputsKey);
    return saved ? JSON.parse(saved) : { assumptions: {}, companies: {}, tranches: {} };
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
    const saved = localStorage.getItem(storageKey);
    if (saved) return JSON.parse(saved);
    return [{ id: "current", name: "Current book", events: {} }];
  }

  function saveScenarios() {
    localStorage.setItem(storageKey, JSON.stringify(scenarios));
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

  function companyFieldAssumption(company, field) {
    if (companyFieldOrigins[`${company.id}.${field}`] === "user") return "";
    if (field === "fdShares") {
      const sourced = new Set(["materialspace", "lira-ai", "uplifted"]);
      if (!sourced.has(company.id)) return "Assumption";
    }
    if (field === "ownershipPct") {
      const sourced = new Set(["materialspace", "lira-ai", "uplifted"]);
      if (!sourced.has(company.id)) return "Assumption";
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

  function setupField(id, label, type, target, note, options = {}) {
    return {
      id,
      label,
      type,
      target,
      note,
      step: options.step || "any",
      min: options.min ?? 0,
      choices: options.choices || null
    };
  }

  function buildSetupFields() {
    const fields = [
      setupField("capitalCalled", "Capital called", "number", { kind: "assumption", key: "capitalCalled" }, "Not sourced from fund books."),
      setupField("safeMarkMode", "SAFE / Note valuation policy", "select", { kind: "assumption", key: "safeMarkMode" }, "This is a model policy choice.", {
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
          { step: field === "fdShares" ? "1" : "0.01" }
        ));
      });

      company.tranches.forEach((tranche) => {
        const optionNeedsSetup = ["option", "warrant"].includes(tranche.type) && /FMV exercise price|SOI supplies actual option count/i.test(tranche.source || "");
        if (!trancheNeedsSetupPrompt(tranche) && !optionNeedsSetup) return;
        const prefix = `${company.name} - ${tranche.name}`;
        if (["safe-post", "safe-pre", "note"].includes(tranche.type)) {
          fields.push(setupField(`${tranche.id}.valuationCap`, `${prefix} valuation cap`, "number", { kind: "tranche", trancheId: tranche.id, key: "valuationCap" }, "SAFE/note cap is not fully sourced."));
          fields.push(setupField(`${tranche.id}.discountPct`, `${prefix} discount %`, "number", { kind: "tranche", trancheId: tranche.id, key: "discountPct" }, "SAFE/note discount is not fully sourced.", { step: "0.1" }));
          fields.push(setupField(`${tranche.id}.cashOutMultiple`, `${prefix} cash-out multiple`, "number", { kind: "tranche", trancheId: tranche.id, key: "cashOutMultiple" }, "Liquidity cash-out multiple is not fully sourced.", { step: "0.1" }));
          fields.push(setupField(`${tranche.id}.proRata`, `${prefix} pro-rata rights`, "select", { kind: "tranche", trancheId: tranche.id, key: "proRata" }, "Pro-rata/side-letter rights are not fully sourced.", {
            choices: [["false", "No"], ["true", "Yes"]]
          }));
        } else if (["option", "warrant"].includes(tranche.type)) {
          fields.push(setupField(`${tranche.id}.strikePrice`, `${prefix} strike / exercise price`, "number", { kind: "tranche", trancheId: tranche.id, key: "strikePrice" }, "Strike or exercise price is not fully sourced.", { step: "0.0001" }));
          fields.push(setupField(`${tranche.id}.vestedPct`, `${prefix} vested %`, "number", { kind: "tranche", trancheId: tranche.id, key: "vestedPct" }, "Vesting percentage is not fully sourced.", { step: "0.1" }));
        } else if (tranche.type === "priced") {
          fields.push(setupField(`${tranche.id}.liqMultiple`, `${prefix} liquidation preference multiple`, "number", { kind: "tranche", trancheId: tranche.id, key: "liqMultiple" }, "Liquidation preference multiple is not fully sourced.", { step: "0.1" }));
          fields.push(setupField(`${tranche.id}.seniority`, `${prefix} seniority rank`, "number", { kind: "tranche", trancheId: tranche.id, key: "seniority" }, "Seniority rank is not fully sourced.", { step: "1" }));
          fields.push(setupField(`${tranche.id}.participation`, `${prefix} participation`, "select", { kind: "tranche", trancheId: tranche.id, key: "participation" }, "Participation rights are not fully sourced.", {
            choices: [["non", "Non-participating"], ["full", "Fully participating"], ["common", "Common/as-converted only"]]
          }));
        } else if (tranche.type === "common") {
          fields.push(setupField(`${tranche.id}.shares`, `${prefix} confirmed shares held`, "number", { kind: "tranche", trancheId: tranche.id, key: "shares" }, "The legal document conflicts with or does not cleanly match the SOI share count.", { step: "1" }));
        }
      });
    });

    return fields;
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
    $("setupFields").innerHTML = fields.map((field) => `
      <label class="setup-field">
        <span>${escapeHtml(field.label)}</span>
        ${setupInputHtml(field)}
        <small>${escapeHtml(field.note)}</small>
      </label>
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

  function renderBaseline(company, state) {
    $("baselinePanel").innerHTML = `
      <div class="two-col">
        <div class="section">
          <h3>Current capitalization</h3>
          <div class="form-grid">
            <label>Current shares held<input data-company-field="shares" type="number" value="${company.shares || 0}" /></label>
            <label>${renderCompanyFieldLabel(company, "fdShares", "Fully diluted shares")}<input data-company-field="fdShares" type="number" value="${company.fdShares || 0}" /></label>
            <label>${renderCompanyFieldLabel(company, "ownershipPct", "Ownership %")}<input data-company-field="ownershipPct" type="number" step="0.1" value="${company.ownershipPct || 0}" /></label>
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
    document.querySelectorAll("[data-company-field]").forEach((input) => {
      input.addEventListener("change", () => {
        company[input.dataset.companyField] = Number(input.value) || 0;
        companyFieldOrigins[`${company.id}.${input.dataset.companyField}`] = "user";
        saveCompanyFieldOrigins();
        render();
      });
    });
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
      if (!confirm("Clear all hypotheticals in this scenario?")) return;
      activeScenario().events = {};
      saveScenarios();
      render();
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
      const id = event.target.dataset.deleteEvent;
      if (!id) return;
      const events = eventsFor(selectedCompanyId);
      const index = events.findIndex((item) => item.id === id);
      if (index >= 0) events.splice(index, 1);
      saveScenarios();
      render();
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
    renderScenarioSelect();
    renderDashboard();
    renderCompanyList();
    renderCompanyDetail();
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
