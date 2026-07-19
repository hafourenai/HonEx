function getParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    targetUrl: params.get('targetUrl') || '',
    probability: parseFloat(params.get('probability')) || 0
  };
}

function init() {
  const { targetUrl, probability } = getParams();

  const urlEl = document.getElementById('targetUrl');
  const scoreFill = document.getElementById('scoreFill');
  const scoreText = document.getElementById('scoreText');
  const errorEl = document.getElementById('error');

  urlEl.textContent = targetUrl;

  const percent = Math.round(probability * 100);
  scoreFill.style.width = percent + '%';
  scoreText.textContent = percent + '%';

  document.getElementById('btnBack').addEventListener('click', async () => {
    try {
      const tab = await getCurrentTab();
      if (tab && tab.id) {
        await chrome.tabs.goBack(tab.id);
      }
    } catch {
      window.history.back();
    }
  });

  document.getElementById('btnContinue').addEventListener('click', async () => {
    try {
      const tab = await getCurrentTab();
      if (tab && tab.id) {
        await chrome.runtime.sendMessage({
          type: 'BYPASS_URL',
          url: targetUrl
        });
        await chrome.tabs.update(tab.id, { url: targetUrl, active: true });
      }
    } catch (err) {
      errorEl.style.display = 'block';
      errorEl.textContent = 'Failed to navigate: ' + err.message;
    }
  });
}

async function getCurrentTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  } catch {
    return null;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
