(function () {
  const DAY = 24 * 60 * 60 * 1000;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sum(items, selector) {
    return items.reduce((total, item) => total + (Number(selector(item)) || 0), 0);
  }

  function pct(value) {
    return Number.isFinite(value) ? value / 100 : 0;
  }

  function roundMoney(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function currentOwnership(company) {
    if (company.fdShares > 0 && company.shares > 0) return company.shares / company.fdShares;
    return pct(company.ownershipPct);
  }

  function valueForSafe(tranche, mode) {
    if (mode !== "cap" || !tranche.valuationCap) return tranche.value || tranche.cost || 0;
    const base = tranche.cost || 0;
    const markup = Math.max(1, 12000000 / tranche.valuationCap);
    return base * markup;
  }

  function isAdvisorShare(tranche) {
    return Boolean(tranche.advisorShare);
  }

  function trancheCurrentValue(tranche, assumptions = {}) {
    if (["safe-post", "safe-pre", "note"].includes(tranche.type)) return valueForSafe(tranche, assumptions.safeMarkMode);
    const value = tranche.value || 0;
    return isAdvisorShare(tranche) ? value * 0.8 : value;
  }

  function xirr(cashFlows) {
    const flows = cashFlows
      .filter((flow) => flow.amount && flow.date)
      .map((flow) => ({ amount: Number(flow.amount), date: new Date(flow.date) }))
      .sort((a, b) => a.date - b.date);
    if (!flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0)) return null;
    const start = flows[0].date;
    const npv = (rate) => flows.reduce((total, flow) => {
      const years = (flow.date - start) / (365.25 * DAY);
      return total + flow.amount / Math.pow(1 + rate, years);
    }, 0);
    let low = -0.999;
    let high = 10;
    let lowVal = npv(low);
    let highVal = npv(high);
    let guard = 0;
    while (lowVal * highVal > 0 && guard < 40) {
      high *= 2;
      highVal = npv(high);
      guard += 1;
    }
    if (lowVal * highVal > 0) return null;
    for (let i = 0; i < 120; i += 1) {
      const mid = (low + high) / 2;
      const midVal = npv(mid);
      if (Math.abs(midVal) < 0.001) return mid;
      if (lowVal * midVal < 0) {
        high = mid;
        highVal = midVal;
      } else {
        low = mid;
        lowVal = midVal;
      }
    }
    return (low + high) / 2;
  }

  function baselineCashFlows(companies, asOfDate) {
    const flows = [];
    companies.forEach((company) => {
      company.tranches.forEach((tranche) => {
        if (tranche.cost > 0) flows.push({ date: tranche.date || asOfDate, amount: -tranche.cost });
      });
    });
    flows.push({ date: asOfDate, amount: sum(companies, (c) => c.value) });
    return flows;
  }

  function optionPayout(tranche, perShare) {
    const vested = pct(tranche.vestedPct ?? 100);
    return Math.max(0, perShare - (tranche.strikePrice || 0)) * (tranche.shares || 0) * vested;
  }

  function yearsBetween(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return 0;
    return (end - start) / (365.25 * DAY);
  }

  function notePrincipalAtRound(tranche, roundDate) {
    const principal = tranche.cost || 0;
    if (tranche.type !== "note") return principal;
    const interest = principal * pct(tranche.interestRatePct || 0) * yearsBetween(tranche.date, roundDate);
    return principal + interest;
  }

  function conversionInstrumentPrincipal(tranche, roundDate) {
    return notePrincipalAtRound(tranche, roundDate);
  }

  function lowerPositive(...values) {
    const positives = values.filter((value) => Number.isFinite(value) && value > 0);
    return positives.length ? Math.min(...positives) : 0;
  }

  function optionPoolShares(baseShares, optionPoolPct) {
    const poolPct = pct(optionPoolPct);
    if (poolPct <= 0) return 0;
    return baseShares * (poolPct / Math.max(1 - poolPct, 0.000001));
  }

  function convertSafesForRound(company, round) {
    let fundShares = company.shares || 0;
    let totalShares = Math.max(company.fdShares || 0, fundShares || 1);
    const conversions = [];
    const preMoney = round.preMoney || 0;
    const preRoundInstruments = company.tranches.filter((tranche) => ["safe-pre", "note"].includes(tranche.type));
    const postMoneySafes = company.tranches.filter((tranche) => tranche.type === "safe-post");

    let iterativeTotal = totalShares;
    let solvedPre = [];
    for (let i = 0; i < 75; i += 1) {
      const roundPrice = preMoney > 0 ? preMoney / Math.max(iterativeTotal, 1) : 0;
      solvedPre = preRoundInstruments.map((tranche) => {
        const principal = conversionInstrumentPrincipal(tranche, round.date);
        const capPrice = tranche.valuationCap ? tranche.valuationCap / Math.max(iterativeTotal, 1) : Infinity;
        const discountPrice = roundPrice * (1 - pct(tranche.discountPct || 0));
        const conversionPrice = Math.max(0.000001, lowerPositive(capPrice, discountPrice) || roundPrice || capPrice || 0.000001);
        return { tranche, principal, conversionPrice, shares: principal / conversionPrice };
      });
      const nextTotal = totalShares + sum(solvedPre, (item) => item.shares);
      if (Math.abs(nextTotal - iterativeTotal) < 0.0001) break;
      iterativeTotal = nextTotal;
    }

    solvedPre.forEach((item) => {
      fundShares += item.shares;
      totalShares += item.shares;
      conversions.push({
        trancheId: item.tranche.id,
        type: item.tranche.type,
        principal: item.principal,
        shares: item.shares,
        conversionPrice: item.conversionPrice
      });
    });

    const postTargets = postMoneySafes.map((tranche) => {
      const principal = conversionInstrumentPrincipal(tranche, round.date);
      const targetOwnership = (tranche.cost || 0) / Math.max(tranche.valuationCap || preMoney || 1, 1);
      return { tranche, principal, targetOwnership: Math.max(0, Math.min(targetOwnership, 0.95)) };
    });
    const totalPostTarget = Math.min(0.95, sum(postTargets, (item) => item.targetOwnership));
    const postSafeTotalShares = totalPostTarget > 0 ? totalShares / Math.max(1 - totalPostTarget, 0.000001) : totalShares;
    postTargets.forEach((item) => {
      const roundPrice = preMoney > 0 ? preMoney / Math.max(postSafeTotalShares, 1) : 0;
      const capShares = item.targetOwnership * postSafeTotalShares;
      const discountPrice = roundPrice * (1 - pct(item.tranche.discountPct || 0));
      const standardShares = item.principal / Math.max(discountPrice || roundPrice, 0.000001);
      const shares = Math.max(capShares, standardShares);
      const principal = item.principal;
      const conversionPrice = principal / Math.max(shares, 0.000001);
      fundShares += shares;
      totalShares += shares;
      conversions.push({
        trancheId: item.tranche.id,
        type: item.tranche.type,
        principal,
        shares,
        conversionPrice
      });
    });

    return { fundShares, totalShares, conversions };
  }

  function applyRoundSecondary(round, state, roundPrice, postMoneyValue) {
    const secondary = round.secondary || {};
    if (!secondary.enabled) return;
    const secondaryPrice = roundPrice * (1 + pct(Number(secondary.premiumDiscountPct) || 0));
    if (secondaryPrice <= 0) return;
    if (secondary.side === "sell") {
      const sharesToSell = secondary.mode === "pct"
        ? state.shares * pct(Number(secondary.amount) || 0)
        : Number(secondary.amount) || 0;
      const soldShares = Math.min(state.shares, Math.max(0, sharesToSell));
      const proceeds = soldShares * secondaryPrice;
      state.shares -= soldShares;
      state.distributions += proceeds;
      state.cashFlows.push({ date: round.date, amount: proceeds });
      state.notes.push(`Concurrent secondary sale: ${fmtMoney(proceeds)} at ${fmtMoney(secondaryPrice)} / share`);
    } else if (secondary.side === "buy") {
      const dollars = secondary.mode === "shares"
        ? (Number(secondary.amount) || 0) * secondaryPrice
        : Number(secondary.amount) || 0;
      const boughtShares = dollars / secondaryPrice;
      state.shares += boughtShares;
      state.cost += dollars;
      state.cashFlows.push({ date: round.date, amount: -dollars });
      state.notes.push(`Concurrent secondary buy: ${fmtMoney(dollars)} at ${fmtMoney(secondaryPrice)} / share`);
    }
    state.value = (state.shares / Math.max(state.totalShares, 1)) * postMoneyValue;
  }

  function applyFutureRound(company, event, state) {
    const round = {
      date: event.date,
      preMoney: Number(event.preMoney) || 0,
      roundSize: Number(event.roundSize) || 0,
      optionPoolPct: Number(event.optionPoolPct) || 0,
      action: event.action || "none",
      customCheck: Number(event.customCheck) || 0,
      secondary: event.secondary || {}
    };
    const converted = convertSafesForRound(company, round);
    const poolAdjustedPre = round.preMoney * (1 - pct(round.optionPoolPct));
    const sharePrice = poolAdjustedPre / Math.max(converted.totalShares, 1);
    const newInvestorShares = round.roundSize / Math.max(sharePrice, 0.000001);
    const optionShares = optionPoolShares(converted.totalShares, round.optionPoolPct);
    let fundCheck = 0;
    if (round.action === "prorata") {
      const preNewMoneyOwnership = converted.fundShares / Math.max(converted.totalShares + optionShares, 1);
      fundCheck = preNewMoneyOwnership * round.roundSize;
    } else if (round.action === "custom") {
      fundCheck = round.customCheck;
    }
    const fundNewShares = fundCheck / Math.max(sharePrice, 0.000001);
    const postShares = converted.totalShares + optionShares + newInvestorShares;
    state.shares = converted.fundShares + fundNewShares;
    state.totalShares = postShares;
    const postMoneyValue = round.preMoney + round.roundSize;
    state.value = (state.shares / Math.max(postShares, 1)) * postMoneyValue;
    state.cost += fundCheck;
    if (fundCheck > 0) state.cashFlows.push({ date: round.date, amount: -fundCheck });
    applyRoundSecondary(round, state, sharePrice, postMoneyValue);
    state.notes.push(`Round: ${fmtMoney(round.roundSize)} raised at ${fmtMoney(round.preMoney)} pre-money; ${converted.conversions.length} SAFE/note conversion${converted.conversions.length === 1 ? "" : "s"}`);
  }

  function applySecondary(company, event, state, impliedCompanyValue) {
    const lastPrice = event.priceBasis === "current-nav" && state.totalShares > 0
      ? impliedCompanyValue / Math.max(state.totalShares, 1)
      : weightedSharePrice(company);
    const price = lastPrice * (1 + pct(Number(event.premiumDiscountPct) || 0));
    if (event.side === "sell") {
      const sharesToSell = event.mode === "pct"
        ? state.shares * pct(Number(event.amount) || 0)
        : Number(event.amount) || 0;
      const proceeds = Math.min(state.shares, sharesToSell) * price;
      state.shares = Math.max(0, state.shares - sharesToSell);
      state.distributions += proceeds;
      state.cashFlows.push({ date: event.date, amount: proceeds });
      state.value = (state.shares / Math.max(state.totalShares, 1)) * impliedCompanyValue;
      state.notes.push(`Secondary sale: ${fmtMoney(proceeds)} proceeds`);
    } else {
      const dollars = event.mode === "shares"
        ? (Number(event.amount) || 0) * price
        : Number(event.amount) || 0;
      const boughtShares = dollars / Math.max(price, 0.000001);
      state.shares += boughtShares;
      state.cost += dollars;
      state.cashFlows.push({ date: event.date, amount: -dollars });
      state.value = (state.shares / Math.max(state.totalShares, 1)) * impliedCompanyValue;
      state.notes.push(`Secondary buy: ${fmtMoney(dollars)} deployed`);
    }
  }

  function weightedSharePrice(company) {
    const priced = company.tranches.filter((t) => t.shares > 0 && t.price > 0);
    const shares = sum(priced, (t) => t.shares);
    if (!shares) return company.value / Math.max(company.shares || 1, 1);
    return sum(priced, (t) => t.shares * t.price) / shares;
  }

  function waterfallExit(company, exitEV, state) {
    if (exitEV <= 0) return 0;
    const totalShares = Math.max(state.totalShares || company.fdShares || company.shares || 1, 1);
    const commonPerShare = exitEV / totalShares;
    let remaining = exitEV;
    let fundPayout = 0;
    const preferred = company.tranches
      .filter((t) => ["priced"].includes(t.type) && t.liqMultiple > 0)
      .sort((a, b) => (a.seniority || 99) - (b.seniority || 99));
    preferred.forEach((tranche) => {
      const prefAmount = (tranche.cost || 0) * (tranche.liqMultiple || 1);
      const asConverted = (tranche.shares || 0) * commonPerShare;
      let payout = Math.min(remaining, Math.max(prefAmount, asConverted));
      if (tranche.participation === "full") {
        payout = Math.min(remaining, prefAmount + (tranche.shares || 0) * commonPerShare);
      }
      const fundShare = (tranche.shares || 0) / Math.max(company.shares || 1, 1);
      fundPayout += payout * fundShare;
      remaining -= Math.min(remaining, payout);
    });
    const residualPerShare = remaining / totalShares;
    company.tranches.forEach((tranche) => {
      if (tranche.type === "common") fundPayout += (tranche.shares || 0) * residualPerShare;
      if (["option", "warrant"].includes(tranche.type)) fundPayout += optionPayout(tranche, residualPerShare);
      if (["safe-post", "safe-pre", "note"].includes(tranche.type)) {
        const safeOwnership = (tranche.cost || 0) / Math.max(tranche.valuationCap || exitEV, 1);
        const conversionAmount = exitEV * safeOwnership;
        const cashOutAmount = (tranche.cost || 0) * (tranche.cashOutMultiple || 1);
        fundPayout += Math.max(cashOutAmount, conversionAmount);
      }
    });
    return Math.max(0, Math.min(exitEV, fundPayout));
  }

  function applyExit(company, event, state) {
    const exitEV = Number(event.exitEV) || 0;
    const payout = event.exitType === "writeoff" ? 0 : waterfallExit(company, exitEV, state);
    state.value = 0;
    state.exited = true;
    state.distributions += payout;
    state.cashFlows.push({ date: event.date, amount: payout });
    state.notes.push(event.exitType === "writeoff" ? "Write-off" : `Exit proceeds: ${fmtMoney(payout)}`);
  }

  function applyCompanyScenario(company, events = [], assumptions = {}) {
    const state = {
      id: company.id,
      cost: company.cost,
      value: company.tranches.reduce((total, tranche) => total + trancheCurrentValue(tranche, assumptions), 0),
      shares: company.shares || 0,
      totalShares: company.fdShares || 0,
      distributions: 0,
      exited: false,
      notes: [],
      cashFlows: []
    };
    state.ownership = state.totalShares > 0 ? state.shares / state.totalShares : currentOwnership(company);
    const sorted = events.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach((event) => {
      if (state.exited) return;
      if (event.type === "round") applyFutureRound(company, event, state);
      if (event.type === "secondary") {
        const impliedCompanyValue = state.ownership > 0
          ? state.value / state.ownership
          : state.totalShares * Math.max(weightedSharePrice(company), 0.000001);
        applySecondary(company, event, state, impliedCompanyValue);
      }
      if (event.type === "exit") applyExit(company, event, state);
      state.ownership = state.totalShares > 0 ? state.shares / state.totalShares : currentOwnership(company);
    });
    state.ownership = state.totalShares > 0 ? state.shares / state.totalShares : currentOwnership(company);
    return state;
  }

  function companyCashFlows(company, state, asOfDate) {
    const flows = [];
    company.tranches.forEach((tranche) => {
      if (tranche.cost > 0) flows.push({ date: tranche.date || asOfDate, amount: -tranche.cost });
    });
    flows.push(...state.cashFlows);
    if (state.value > 0) flows.push({ date: asOfDate, amount: state.value });
    return flows;
  }

  function computeFund(companies, scenario, assumptions, asOfDate) {
    const byCompany = {};
    const flows = [];
    let paidIn = 0;
    let residual = 0;
    let distributions = 0;
    const companyStates = companies.map((company) => {
      const state = applyCompanyScenario(company, scenario.events[company.id] || [], assumptions);
      byCompany[company.id] = state;
      paidIn += state.cost;
      residual += state.value;
      distributions += state.distributions;
      flows.push(...companyCashFlows(company, state, asOfDate));
      return { company, state };
    });
    const totalEV = sum(companyStates, ({ state }) => {
      if (!state.ownership) return 0;
      return state.value / state.ownership;
    });
    const active = companyStates.filter(({ state }) => state.value > 0);
    const aggregateOwnership = sum(active, ({ state }) => state.ownership * state.value) / Math.max(sum(active, ({ state }) => state.value), 1);
    const sortedNav = companyStates.map(({ state }) => state.value).sort((a, b) => b - a);
    const totalNav = Math.max(sum(sortedNav, (v) => v), 1);
    const grossProfit = Math.max(0, distributions + residual - paidIn);
    const fees = assumptions.capitalCalled * pct(assumptions.managementFeePct || 0);
    const carry = grossProfit * pct(assumptions.carryPct || 0);
    const netResidual = Math.max(0, residual - fees - carry);
    return {
      byCompany,
      companyStates,
      paidIn,
      residual,
      distributions,
      tvpi: (residual + distributions) / Math.max(paidIn, 1),
      dpi: distributions / Math.max(paidIn, 1),
      rvpi: residual / Math.max(paidIn, 1),
      moic: (residual + distributions) / Math.max(paidIn, 1),
      irr: xirr(flows),
      netTvpi: (netResidual + distributions) / Math.max((assumptions.capitalCalled || paidIn), 1),
      netRvpi: netResidual / Math.max((assumptions.capitalCalled || paidIn), 1),
      netDpi: distributions / Math.max((assumptions.capitalCalled || paidIn), 1),
      totalEV,
      aggregateOwnership,
      lossRatio: sum(companyStates, ({ state }) => state.value <= 0 && state.distributions <= 0 ? state.cost : 0) / Math.max(paidIn, 1),
      hitRate: companyStates.filter(({ state }) => state.distributions > state.cost).length / Math.max(companyStates.length, 1),
      top1: sortedNav.slice(0, 1).reduce((a, b) => a + b, 0) / totalNav,
      top3: sortedNav.slice(0, 3).reduce((a, b) => a + b, 0) / totalNav,
      top5: sortedNav.slice(0, 5).reduce((a, b) => a + b, 0) / totalNav
    };
  }

  function fmtMoney(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
  }

  window.VCModel = {
    clone,
    xirr,
    currentOwnership,
    weightedSharePrice,
    trancheCurrentValue,
    applyCompanyScenario,
    computeFund,
    fmtMoney,
    roundMoney
  };
})();
