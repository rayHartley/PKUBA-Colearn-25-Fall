import { detectInitialLanguage, t, localeFor, normalizeLanguage, isChinese } from './i18n.js';

const state = {
  currentAddress: '',
  x402Mode: 'demo',
  demoToken: 'demo-paid',
  watchlist: [],
  bankOfAi: null,
  health: null,
  lang: detectInitialLanguage()
};

const elements = {
  addressForm: document.querySelector('#addressForm'),
  addressInput: document.querySelector('#addressInput'),
  analyzeButton: document.querySelector('#analyzeButton'),
  refreshCurrentButton: document.querySelector('#refreshCurrentButton'),
  refreshOverviewButton: document.querySelector('#refreshOverviewButton'),
  refreshMarketButton: document.querySelector('#refreshMarketButton'),
  premiumButton: document.querySelector('#premiumButton'),
  langZhButton: document.querySelector('#langZhButton'),
  langEnButton: document.querySelector('#langEnButton'),
  modeBadge: document.querySelector('#modeBadge'),
  statusBanner: document.querySelector('#statusBanner'),
  pitchCards: document.querySelector('#pitchCards'),
  demoFlow: document.querySelector('#demoFlow'),
  bankDescription: document.querySelector('#bankDescription'),
  bankHealth: document.querySelector('#bankHealth'),
  bankCards: document.querySelector('#bankCards'),
  bankIssues: document.querySelector('#bankIssues'),
  bankLinks: document.querySelector('#bankLinks'),
  watchlistChips: document.querySelector('#watchlistChips'),
  marketDescription: document.querySelector('#marketDescription'),
  marketHealth: document.querySelector('#marketHealth'),
  marketDiagnostics: document.querySelector('#marketDiagnostics'),
  marketCards: document.querySelector('#marketCards'),
  hotWallets: document.querySelector('#hotWallets'),
  analysisEmpty: document.querySelector('#analysisEmpty'),
  analysisContent: document.querySelector('#analysisContent'),
  analysisHealth: document.querySelector('#analysisHealth'),
  analysisDiagnostics: document.querySelector('#analysisDiagnostics'),
  walletAddress: document.querySelector('#walletAddress'),
  walletHeadline: document.querySelector('#walletHeadline'),
  tagRow: document.querySelector('#tagRow'),
  summaryList: document.querySelector('#summaryList'),
  observationList: document.querySelector('#observationList'),
  alertList: document.querySelector('#alertList'),
  metricCards: document.querySelector('#metricCards'),
  transferTableWrap: document.querySelector('#transferTableWrap'),
  premiumHint: document.querySelector('#premiumHint'),
  premiumChallenge: document.querySelector('#premiumChallenge'),
  premiumContent: document.querySelector('#premiumContent'),
  eyebrowText: document.querySelector('#eyebrowText'),
  heroDescription: document.querySelector('#heroDescription'),
  heroBankLabel: document.querySelector('#heroBankLabel'),
  heroBankValue: document.querySelector('#heroBankValue'),
  heroDataLabel: document.querySelector('#heroDataLabel'),
  heroDataValue: document.querySelector('#heroDataValue'),
  pitchTitle: document.querySelector('#pitchTitle'),
  pitchDescription: document.querySelector('#pitchDescription'),
  bankTitle: document.querySelector('#bankTitle'),
  controlsTitle: document.querySelector('#controlsTitle'),
  controlsDescription: document.querySelector('#controlsDescription'),
  marketTitle: document.querySelector('#marketTitle'),
  analysisTitle: document.querySelector('#analysisTitle'),
  analysisDescription: document.querySelector('#analysisDescription'),
  premiumTitle: document.querySelector('#premiumTitle'),
  premiumDescription: document.querySelector('#premiumDescription')
};

init().catch((error) => showBanner(error.message, 'error'));

elements.addressForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const address = elements.addressInput.value.trim();
  if (!address) {
    showBanner(t(state.lang, 'enterAddress'), 'error');
    return;
  }

  loadOverview(address, { forceRefresh: true }).catch((error) => showBanner(error.message, 'error'));
});

elements.refreshCurrentButton.addEventListener('click', async () => {
  const address = elements.addressInput.value.trim() || state.currentAddress;
  if (!address) {
    showBanner(t(state.lang, 'selectWallet'), 'error');
    return;
  }

  loadOverview(address, { forceRefresh: true }).catch((error) => showBanner(error.message, 'error'));
});

elements.refreshOverviewButton.addEventListener('click', async () => {
  if (!state.currentAddress) {
    showBanner(t(state.lang, 'runOverviewFirst'), 'error');
    return;
  }

  loadOverview(state.currentAddress, { forceRefresh: true }).catch((error) => showBanner(error.message, 'error'));
});

elements.refreshMarketButton.addEventListener('click', async () => {
  loadMarket({ forceRefresh: true }).catch((error) => showBanner(error.message, 'error'));
});

elements.premiumButton.addEventListener('click', async () => {
  if (!state.currentAddress) {
    showBanner(t(state.lang, 'unlockAfterOverview'), 'error');
    return;
  }

  unlockPremium().catch((error) => showBanner(error.message, 'error'));
});

elements.langZhButton.addEventListener('click', () => {
  setLanguage('zh-CN').catch((error) => showBanner(error.message, 'error'));
});

elements.langEnButton.addEventListener('click', () => {
  setLanguage('en').catch((error) => showBanner(error.message, 'error'));
});

async function init() {
  applyStaticTranslations();
  const health = await fetchJson(withLang('/api/health'));
  hydrateFromHealth(health);
  await loadMarket();

  const defaultAddress = health.defaultAddress || state.watchlist[0]?.address;
  if (defaultAddress) {
    elements.addressInput.value = defaultAddress;
    await loadOverview(defaultAddress);
  }
}

async function setLanguage(language) {
  const next = normalizeLanguage(language);
  if (next === state.lang) {
    return;
  }

  state.lang = next;
  localStorage.setItem('tron-whale-radar-lang', next);
  applyStaticTranslations();

  const health = await fetchJson(withLang('/api/health'));
  hydrateFromHealth(health);
  await loadMarket();

  if (state.currentAddress) {
    await loadOverview(state.currentAddress);
  }
}

function hydrateFromHealth(health) {
  state.health = health;
  state.x402Mode = health.x402.mode;
  state.demoToken = health.x402.demoToken || state.demoToken;
  state.watchlist = health.watchlist || [];
  state.bankOfAi = health.bankOfAi || null;

  renderModeBadge(health.x402, health.bankOfAi);
  renderPitchPanel(health.x402, health.bankOfAi);
  renderBankOfAiPanel(health.x402, health.bankOfAi);
  renderWatchlist();
}

async function loadMarket(options = {}) {
  setButtonBusy(elements.refreshMarketButton, true, busyLabel('refreshMarketButton'));

  try {
    const payload = await fetchJson(withLang(`/api/free/hot-wallets${options.forceRefresh ? '?refresh=1' : ''}`));
    renderMarket(payload);
    if (options.forceRefresh) {
      showBanner(t(state.lang, 'rankRefreshed'), payload.degraded ? 'warning' : 'success');
    }
  } catch (error) {
    showBanner(error.message, 'error');
    throw error;
  } finally {
    setButtonBusy(elements.refreshMarketButton, false, busyLabel('refreshMarketButton'), idleLabel('refreshMarketButton'));
  }
}

async function loadOverview(address, options = {}) {
  clearPremium();
  showBanner(t(state.lang, options.forceRefresh ? 'walletRefreshing' : 'walletLoading'), 'info');
  setButtonBusy(elements.analyzeButton, true, busyLabel('analyzeButton'));
  setButtonBusy(elements.refreshCurrentButton, true, busyLabel('refreshCurrentButton'));
  setButtonBusy(elements.refreshOverviewButton, true, busyLabel('refreshOverviewButton'));

  try {
    const query = new URLSearchParams({ address, lang: state.lang });
    if (options.forceRefresh) {
      query.set('refresh', '1');
    }

    const payload = await fetchJson(`/api/free/overview?${query.toString()}`);
    state.currentAddress = payload.address;
    elements.addressInput.value = payload.address;
    renderOverview(payload);
    showBanner(
      t(state.lang, payload.degraded ? 'degradedReady' : 'freeReady'),
      payload.degraded ? 'warning' : 'success'
    );
  } catch (error) {
    showBanner(error.message, 'error');
    throw error;
  } finally {
    setButtonBusy(elements.analyzeButton, false, busyLabel('analyzeButton'), idleLabel('analyzeButton'));
    setButtonBusy(elements.refreshCurrentButton, false, busyLabel('refreshCurrentButton'), idleLabel('refreshCurrentButton'));
    setButtonBusy(elements.refreshOverviewButton, false, busyLabel('refreshOverviewButton'), idleLabel('refreshOverviewButton'));
  }
}

async function unlockPremium(manualPayment = null) {
  showBanner(t(state.lang, 'premiumRequesting'), 'info');
  setButtonBusy(elements.premiumButton, true, busyLabel('premiumButton'));

  try {
    const headers = {};
    if (state.x402Mode === 'demo') {
      headers['X-Demo-Payment'] = state.demoToken;
    }
    if (manualPayment) {
      headers['X-PAYMENT'] = manualPayment;
    }

    const response = await fetch(
      `/api/premium/deep-dive?address=${encodeURIComponent(state.currentAddress)}&lang=${encodeURIComponent(state.lang)}`,
      { headers }
    );

    const payload = await response.json();

    if (response.status === 402) {
      renderChallenge(payload);
      showBanner(t(state.lang, 'premiumChallenge'), 'warning');
      return;
    }

    if (!response.ok) {
      throw new Error(payload.message || 'Unable to unlock premium insight.');
    }

    renderPremium(payload.premium, payload.payment, payload.cache);
    showBanner(t(state.lang, 'premiumUnlocked'), 'success');
  } catch (error) {
    showBanner(error.message, 'error');
    throw error;
  } finally {
    setButtonBusy(elements.premiumButton, false, busyLabel('premiumButton'), idleLabel('premiumButton'));
  }
}

function applyStaticTranslations() {
  elements.eyebrowText.textContent = t(state.lang, 'eyebrowText');
  elements.heroDescription.textContent = t(state.lang, 'heroDescription');
  elements.heroBankLabel.textContent = t(state.lang, 'heroBankLabel');
  elements.heroBankValue.textContent = t(state.lang, 'heroBankValue');
  elements.heroDataLabel.textContent = t(state.lang, 'heroDataLabel');
  elements.heroDataValue.textContent = t(state.lang, 'heroDataValue');
  elements.pitchTitle.textContent = t(state.lang, 'pitchTitle');
  elements.pitchDescription.textContent = t(state.lang, 'pitchDescription');
  elements.bankTitle.textContent = t(state.lang, 'bankTitle');
  elements.controlsTitle.textContent = t(state.lang, 'controlsTitle');
  elements.controlsDescription.textContent = t(state.lang, 'controlsDescription');
  elements.marketTitle.textContent = t(state.lang, 'marketTitle');
  elements.analysisTitle.textContent = t(state.lang, 'analysisTitle');
  elements.analysisDescription.textContent = t(state.lang, 'analysisDescription');
  elements.analysisEmpty.textContent = t(state.lang, 'analysisEmpty');
  elements.premiumTitle.textContent = t(state.lang, 'premiumTitle');
  elements.premiumDescription.textContent = t(state.lang, 'premiumDescription');
  updateIdleButtonLabel(elements.analyzeButton, idleLabel('analyzeButton'));
  updateIdleButtonLabel(elements.refreshCurrentButton, idleLabel('refreshCurrentButton'));
  updateIdleButtonLabel(elements.refreshMarketButton, idleLabel('refreshMarketButton'));
  updateIdleButtonLabel(elements.refreshOverviewButton, idleLabel('refreshOverviewButton'));
  updateIdleButtonLabel(elements.premiumButton, idleLabel('premiumButton'));
  elements.langZhButton.classList.toggle('active', state.lang === 'zh-CN');
  elements.langEnButton.classList.toggle('active', state.lang === 'en');
}

function renderModeBadge(x402, bankOfAi) {
  const label =
    x402.mode === 'demo'
      ? t(state.lang, 'modeDemo')
      : bankOfAi?.ready
        ? t(state.lang, 'modeLive')
        : t(state.lang, 'modeIncomplete');

  elements.modeBadge.textContent = `${label} - ${formatAtomicPrice(x402.priceAtomic)} ${x402.asset} ${x402.network}`;
}

function renderBankOfAiPanel(x402, bankOfAi) {
  const ready = bankOfAi?.ready;
  const issues = bankOfAi?.issues || [];
  const description =
    x402.mode === 'demo'
      ? t(state.lang, 'bankDescriptionDemo')
      : ready
        ? t(state.lang, 'bankDescriptionLive', {
            price: bankOfAi.priceHuman,
            asset: bankOfAi.asset,
            network: bankOfAi.network
          })
        : t(state.lang, 'bankDescriptionIncomplete');

  elements.bankDescription.textContent = description;

  elements.bankHealth.innerHTML = [
    `<span class="health-pill ${ready ? 'success' : x402.mode === 'demo' ? 'source' : 'warning'}">${ready ? t(state.lang, 'sellerReady') : x402.mode === 'demo' ? t(state.lang, 'demoMode') : t(state.lang, 'setupIncomplete')}</span>`,
    `<span class="health-pill ${bankOfAi?.officialFacilitator ? 'success' : 'warning'}">${bankOfAi?.officialFacilitator ? t(state.lang, 'officialFacilitator') : t(state.lang, 'facilitatorNotOfficial')}</span>`,
    `<span class="health-pill source">${bankOfAi?.priceHuman || formatAtomicPrice(x402.priceAtomic)} ${bankOfAi?.asset || x402.asset}</span>`,
    `<span class="health-pill source">${bankOfAi?.network || x402.network}</span>`,
    `<span class="health-pill source">${t(state.lang, 'agentCardReady')}</span>`
  ].join('');

  const cards = [
    {
      label: t(state.lang, 'sellerMode'),
      value: x402.mode,
      detail: x402.mode === 'facilitator' ? t(state.lang, 'sellerModeDetailLive') : t(state.lang, 'sellerModeDetailDemo')
    },
    {
      label: t(state.lang, 'facilitator'),
      value: bankOfAi?.officialFacilitator ? 'Bank of AI' : t(state.lang, 'needsReview'),
      detail: bankOfAi?.facilitatorUrl || t(state.lang, 'notConfigured')
    },
    {
      label: t(state.lang, 'sellerWallet'),
      value: bankOfAi?.hasPayTo ? shorten(bankOfAi.payTo) : t(state.lang, 'missing'),
      detail: bankOfAi?.hasPayTo ? bankOfAi.payTo : t(state.lang, 'bankWalletDetailMissing')
    },
    {
      label: t(state.lang, 'facilitatorApiKey'),
      value: bankOfAi?.hasApiKey ? t(state.lang, 'configured') : t(state.lang, 'missing'),
      detail: bankOfAi?.hasApiKey ? t(state.lang, 'bankApiKeyDetailConfigured') : t(state.lang, 'bankApiKeyDetailMissing')
    },
    {
      label: t(state.lang, 'premiumEndpoint'),
      value: t(state.lang, 'premiumEndpointValue'),
      detail: bankOfAi?.premiumEndpoint || t(state.lang, 'unavailable')
    },
    {
      label: t(state.lang, 'helper8004'),
      value: t(state.lang, 'helper8004Value'),
      detail: t(state.lang, 'bankCard8004Detail')
    }
  ];

  elements.bankCards.innerHTML = cards.map((card) => `
        <article class="bank-card">
          <span class="meta-label">${card.label}</span>
          <strong>${card.value}</strong>
          <p>${card.detail}</p>
        </article>
      `).join('');

  renderDiagnostics(elements.bankIssues, issues);

  elements.bankLinks.innerHTML = [
    linkButton(bankOfAi?.agentCardUrl, t(state.lang, 'agentCard')),
    linkButton(bankOfAi?.premiumEndpoint, t(state.lang, 'premiumApi')),
    linkButton(bankOfAi?.healthEndpoint, t(state.lang, 'healthJson')),
    linkButton(bankOfAi?.adminUrl, t(state.lang, 'bankAdmin'))
  ].filter(Boolean).join('');
}

function renderPitchPanel(x402, bankOfAi) {
  const pitchCards = [
    { title: t(state.lang, 'pitchCard1Title'), detail: t(state.lang, 'pitchCard1Detail') },
    { title: t(state.lang, 'pitchCard2Title'), detail: t(state.lang, 'pitchCard2Detail') },
    {
      title: bankOfAi?.ready ? t(state.lang, 'pitchCard3TitleLive') : t(state.lang, 'pitchCard3TitleBuilt'),
      detail: bankOfAi?.ready
        ? t(state.lang, 'pitchCard3DetailLive', { price: bankOfAi.priceHuman, asset: bankOfAi.asset })
        : t(state.lang, 'pitchCard3DetailBuilt')
    },
    { title: t(state.lang, 'pitchCard4Title'), detail: t(state.lang, 'pitchCard4Detail') }
  ];

  elements.pitchCards.innerHTML = pitchCards.map((card) => `
        <article class="pitch-card">
          <span class="meta-label">${t(state.lang, 'pitchJudgeSignal')}</span>
          <strong>${card.title}</strong>
          <p>${card.detail}</p>
        </article>
      `).join('');

  const steps = [
    {
      step: '1',
      title: t(state.lang, 'demoStep1Title'),
      detail: bankOfAi?.ready ? t(state.lang, 'demoStep1DetailLive') : t(state.lang, 'demoStep1DetailIncomplete')
    },
    { step: '2', title: t(state.lang, 'demoStep2Title'), detail: t(state.lang, 'demoStep2Detail') },
    { step: '3', title: t(state.lang, 'demoStep3Title'), detail: t(state.lang, 'demoStep3Detail') },
    {
      step: '4',
      title: t(state.lang, 'demoStep4Title'),
      detail: x402.mode === 'demo' ? t(state.lang, 'demoStep4DetailDemo') : t(state.lang, 'demoStep4DetailLive')
    }
  ];

  elements.demoFlow.innerHTML = steps.map((item) => `
        <article class="demo-step">
          <span class="step-index">${item.step}</span>
          <div>
            <strong>${item.title}</strong>
            <p>${item.detail}</p>
          </div>
        </article>
      `).join('');
}

function renderWatchlist() {
  elements.watchlistChips.innerHTML = '';
  for (const item of state.watchlist) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = item.label;
    button.addEventListener('click', () => {
      elements.addressInput.value = item.address;
      loadOverview(item.address, { forceRefresh: true }).catch((error) => showBanner(error.message, 'error'));
    });
    elements.watchlistChips.appendChild(button);
  }
}

function renderMarket(payload) {
  if (elements.marketDescription && payload.leaderboard?.description) {
    const prefix = state.bankOfAi?.ready
      ? t(state.lang, 'marketPrefixLive')
      : state.bankOfAi?.mode === 'facilitator'
        ? t(state.lang, 'marketPrefixIncomplete')
        : '';
    elements.marketDescription.textContent = `${prefix}${payload.leaderboard.description}`;
  }

  renderHealthStrip(elements.marketHealth, payload);
  renderDiagnostics(elements.marketDiagnostics, payload.diagnostics);

  const cards = [
    { label: t(state.lang, 'statTransferValue'), value: payload.marketOverview.totalTransferValue || 'N/A' },
    { label: t(state.lang, 'statTransactions'), value: formatInteger(payload.marketOverview.totalTransactions) },
    { label: t(state.lang, 'statActiveAddresses'), value: formatInteger(payload.marketOverview.activeAddresses) },
    {
      label: t(state.lang, 'statLiveTrackedWallets'),
      value: `${formatInteger(payload.leaderboard?.liveSeedCount)}/${formatInteger(payload.leaderboard?.configuredSeedCount)}`
    },
    {
      label: t(state.lang, 'statRankedCounterparties'),
      value: formatInteger(payload.leaderboard?.rankedWalletCount || payload.wallets.length)
    },
    { label: t(state.lang, 'statRankingMetric'), value: payload.leaderboard?.metricLabel || '7d whale radar score' }
  ];

  elements.marketCards.innerHTML = cards.map((card) => `
        <article class="stat-card">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
        </article>
      `).join('');

  elements.hotWallets.innerHTML = payload.wallets.map((wallet) => `
        <article class="wallet-card">
          <div class="wallet-topline">
            <span class="direction ${wallet.direction}">${localizeDirection(wallet.direction)}</span>
            <span class="wallet-rank">#${wallet.rank}</span>
          </div>
          <strong>${wallet.label}</strong>
          <div class="wallet-value">${wallet.metricValue}</div>
          <div class="wallet-meta">${wallet.metricLabel}</div>
          <div class="wallet-support">${wallet.supportingMetric || `${formatInteger(wallet.transactionCount)} tx`}</div>
          <div class="wallet-support">${wallet.profile || t(state.lang, 'trackedCounterparty')}</div>
          <code>${shorten(wallet.address)}</code>
          <p>${wallet.insight}</p>
        </article>
      `).join('');
}

function renderOverview(payload) {
  elements.analysisEmpty.classList.add('hidden');
  elements.analysisContent.classList.remove('hidden');

  elements.walletAddress.textContent = payload.address;
  elements.walletHeadline.textContent = payload.headline;
  elements.tagRow.innerHTML = payload.behaviorTags.map((tag) => `<span class="tag">${tag}</span>`).join('');
  renderHealthStrip(elements.analysisHealth, payload, { includeAlertLevel: true, includeModel: true });
  renderDiagnostics(elements.analysisDiagnostics, payload.diagnostics);

  elements.summaryList.innerHTML = payload.summary.map((item) => `<p>- ${item}</p>`).join('');
  elements.observationList.innerHTML = payload.observations.map((item) => `
        <article class="observation-card">
          <span class="meta-label">${t(state.lang, 'observation')}</span>
          <p>${item}</p>
        </article>
      `).join('');

  elements.alertList.innerHTML = payload.alerts.length
    ? payload.alerts.map((alert) => `
            <div class="alert ${alert.severity}">
              <strong class="alert-title">${alert.title}</strong>
              <p>${alert.message}</p>
              <p class="alert-evidence">${alert.evidence || ''}</p>
            </div>
          `).join('')
    : `<div class="alert calm"><strong class="alert-title">${t(state.lang, 'calmWindow')}</strong><p>${t(state.lang, 'calmMessage')}</p></div>`;

  const metricCards = [
    { label: t(state.lang, 'metricActivityScore'), value: `${payload.activityScore}/100` },
    { label: t(state.lang, 'metricWhaleAlert'), value: localizeAlertLevel(payload.whaleAlertLevel || 'calm') },
    { label: t(state.lang, 'metric24hTransfers'), value: formatInteger(payload.windows['24h'].count) },
    { label: t(state.lang, 'metric7dWhaleTransfers'), value: formatInteger(payload.windows['7d'].largeTransfers.length) },
    { label: t(state.lang, 'metric7dMegaTransfers'), value: formatInteger(payload.whaleSignals?.megaTransferCount7d) },
    { label: t(state.lang, 'metricTopProfile'), value: payload.profile.label }
  ];

  elements.metricCards.innerHTML = metricCards.map((card) => `
        <article class="stat-card">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
        </article>
      `).join('');

  elements.transferTableWrap.innerHTML = `
    <table class="transfer-table">
      <thead>
        <tr>
          <th>${t(state.lang, 'tableTime')}</th>
          <th>${t(state.lang, 'tableToken')}</th>
          <th>${t(state.lang, 'tableDirection')}</th>
          <th>${t(state.lang, 'tableAmount')}</th>
          <th>${t(state.lang, 'tableCounterparty')}</th>
        </tr>
      </thead>
      <tbody>
        ${payload.transfers.map((transfer) => `
              <tr>
                <td>${new Date(transfer.timestamp).toLocaleString(localeFor(state.lang))}</td>
                <td>${transfer.token}</td>
                <td><span class="direction ${transfer.direction === 'in' ? 'inflow' : 'outflow'}">${localizeDirection(transfer.direction)}</span></td>
                <td>${formatAmount(transfer.amount)}</td>
                <td><code>${shorten(transfer.counterparty)}</code></td>
              </tr>
            `).join('')}
      </tbody>
    </table>
  `;

  elements.premiumHint.textContent =
    state.x402Mode === 'demo'
      ? t(state.lang, 'premiumHintDemo', {
          model: payload.model?.mode === 'llm' ? payload.model.model : t(state.lang, 'templateInsight')
        })
      : state.bankOfAi?.ready
        ? t(state.lang, 'premiumHintLive')
        : t(state.lang, 'premiumHintIncomplete', { issue: (state.bankOfAi?.issues || []).slice(0, 1).join(' ') });
}

function renderChallenge(payload) {
  const requirement = payload.paymentRequirements?.[0];
  const isDemo = payload.paymentMode === 'demo';

  elements.premiumChallenge.classList.remove('hidden');
  elements.premiumContent.classList.add('hidden');
  elements.premiumChallenge.innerHTML = `
    <div class="challenge-card">
      <div class="challenge-head">
        <strong>${t(state.lang, 'challengeTitle')}</strong>
        <span>${requirement?.amountHuman || 'N/A'} ${requirement?.asset || ''}</span>
      </div>
      <p>${payload.message}</p>
      <p class="challenge-note">${isDemo ? t(state.lang, 'challengeDemoNote') : t(state.lang, 'challengeLiveNote')}</p>
      <pre>${JSON.stringify(requirement, null, 2)}</pre>
      ${
        isDemo
          ? `<button id="demoUnlockButton" class="premium-button" type="button">${t(state.lang, 'challengeSimulate')}</button>`
          : `
            <label class="manual-input">
              <span>${t(state.lang, 'challengePasteLabel')}</span>
              <textarea id="paymentPayloadInput" placeholder="${t(state.lang, 'challengePlaceholder')}"></textarea>
            </label>
            <button id="manualPaymentButton" class="premium-button" type="button">${t(state.lang, 'challengeSubmit')}</button>
          `
      }
    </div>
  `;

  if (isDemo) {
    document.querySelector('#demoUnlockButton')?.addEventListener('click', () => {
      unlockPremium().catch((error) => showBanner(error.message, 'error'));
    });
  } else {
    document.querySelector('#manualPaymentButton')?.addEventListener('click', () => {
      const manualPayload = document.querySelector('#paymentPayloadInput')?.value.trim();
      if (!manualPayload) {
        showBanner(t(state.lang, 'pastePayment'), 'error');
        return;
      }
      unlockPremium(manualPayload).catch((error) => showBanner(error.message, 'error'));
    });
  }
}

function renderPremium(premium, payment, cache) {
  elements.premiumChallenge.classList.add('hidden');
  elements.premiumContent.classList.remove('hidden');
  elements.premiumContent.innerHTML = `
    <div class="premium-grid">
      <article class="premium-card">
        <span class="meta-label">${t(state.lang, 'premiumProfile')}</span>
        <h3>${premium.profileSummary}</h3>
        <div class="bullet-list">${(premium.narrative || []).map((item) => `<p>- ${item}</p>`).join('')}</div>
      </article>
      <article class="premium-card">
        <span class="meta-label">${t(state.lang, 'premiumHypotheses')}</span>
        <div class="bullet-list">
          ${(premium.hypotheses || []).map((item) => `<p>- <strong>${item.title}</strong> (${item.confidence}): ${item.rationale}</p>`).join('')}
        </div>
      </article>
      <article class="premium-card">
        <span class="meta-label">${t(state.lang, 'premiumEvidencePack')}</span>
        <div class="bullet-list">
          ${(premium.evidencePack || []).map((item) => `<p>- <strong>${item.label}</strong>: ${item.value}. ${item.explanation}</p>`).join('')}
        </div>
      </article>
      <article class="premium-card">
        <span class="meta-label">${t(state.lang, 'premiumMonitoring')}</span>
        <div class="bullet-list">${(premium.monitoringPlaybook || []).map((item) => `<p>- ${item}</p>`).join('')}</div>
      </article>
      <article class="premium-card">
        <span class="meta-label">${t(state.lang, 'premiumWatchpoints')}</span>
        <div class="bullet-list">${(premium.actionItems || []).map((item) => `<p>- ${item}</p>`).join('')}</div>
      </article>
      <article class="premium-card">
        <span class="meta-label">${t(state.lang, 'premiumPaymentCache')}</span>
        <p>${payment.mode} - ${payment.settlementStatus}</p>
        <p class="wallet-support">${t(state.lang, 'cacheLabel')}: ${cache?.status || 'live'}${cache?.cachedAt ? ` / ${new Date(cache.cachedAt).toLocaleTimeString(localeFor(state.lang))}` : ''}</p>
        <p class="wallet-support">${t(state.lang, 'modelLabel')}: ${premium.model?.mode === 'llm' ? premium.model.model : t(state.lang, 'templateFallback')}</p>
      </article>
    </div>
  `;
}

function renderHealthStrip(target, payload, options = {}) {
  const pills = [];

  if (payload.cache?.status) {
    pills.push(`<span class="health-pill cache">${payload.cache.status}</span>`);
  }

  if (options.includeAlertLevel && payload.whaleAlertLevel) {
    pills.push(`<span class="health-pill ${payload.whaleAlertLevel}">${t(state.lang, 'healthWhaleAlert')}: ${localizeAlertLevel(payload.whaleAlertLevel)}</span>`);
  }

  pills.push(
    payload.degraded
      ? `<span class="health-pill warning">${t(state.lang, 'healthDegraded')}</span>`
      : `<span class="health-pill success">${t(state.lang, 'healthLive')}</span>`
  );

  for (const source of payload.source || []) {
    pills.push(`<span class="health-pill source">${source}</span>`);
  }

  if (options.includeModel && payload.model?.mode) {
    pills.push(`<span class="health-pill source">${payload.model.mode === 'llm' ? payload.model.model : t(state.lang, 'templateInsight')}</span>`);
  }

  target.innerHTML = pills.join('');
}

function renderDiagnostics(target, diagnostics = []) {
  if (!diagnostics.length) {
    target.classList.add('hidden');
    target.innerHTML = '';
    return;
  }

  target.classList.remove('hidden');
  target.innerHTML = diagnostics.map((item) => `<div class="diagnostic-item">${item}</div>`).join('');
}

function clearPremium() {
  elements.premiumChallenge.classList.add('hidden');
  elements.premiumContent.classList.add('hidden');
  elements.premiumChallenge.innerHTML = '';
  elements.premiumContent.innerHTML = '';
}

function showBanner(message, tone) {
  elements.statusBanner.textContent = message;
  elements.statusBanner.className = `status-banner ${tone}`;
}

function setButtonBusy(button, busy, busyLabel, idleLabel = null) {
  if (!button) {
    return;
  }

  if (!button.dataset.idleLabel) {
    button.dataset.idleLabel = idleLabel || button.textContent;
  }

  button.disabled = busy;
  button.textContent = busy ? busyLabel : idleLabel || button.dataset.idleLabel;
}

function updateIdleButtonLabel(button, label) {
  if (!button || button.disabled) {
    return;
  }

  button.dataset.idleLabel = label;
  button.textContent = label;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }
  return payload;
}

function withLang(url) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}lang=${encodeURIComponent(state.lang)}`;
}

function busyLabel(buttonName) {
  if (buttonName === 'analyzeButton') {
    return isChinese(state.lang) ? '分析中...' : 'Analyzing...';
  }
  if (buttonName === 'premiumButton') {
    return isChinese(state.lang) ? '解锁中...' : 'Unlocking...';
  }
  return isChinese(state.lang) ? '刷新中...' : 'Refreshing...';
}

function idleLabel(buttonName) {
  return t(state.lang, buttonName);
}

function formatAmount(value) {
  return new Intl.NumberFormat(localeFor(state.lang), {
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(value);
}

function formatInteger(value) {
  return new Intl.NumberFormat(localeFor(state.lang)).format(Number(value) || 0);
}

function formatAtomicPrice(value) {
  return Number(value || 0) / 1_000_000;
}

function shorten(value) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function linkButton(href, label) {
  if (!href) {
    return '';
  }

  return `<a class="quick-link" href="${href}" target="_blank" rel="noreferrer">${label}</a>`;
}

function localizeDirection(direction) {
  const mapping = {
    inflow: t(state.lang, 'directionInflow'),
    outflow: t(state.lang, 'directionOutflow'),
    mixed: t(state.lang, 'directionMixed'),
    in: t(state.lang, 'directionIn'),
    out: t(state.lang, 'directionOut')
  };

  return mapping[direction] || direction;
}

function localizeAlertLevel(level) {
  const mapping = {
    high: t(state.lang, 'alertHigh'),
    medium: t(state.lang, 'alertMedium'),
    low: t(state.lang, 'alertLow'),
    calm: t(state.lang, 'alertCalm')
  };

  return mapping[level] || level;
}
