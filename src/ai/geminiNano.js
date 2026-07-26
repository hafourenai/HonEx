const AI_TIMEOUT = 10000;
const SYSTEM_PROMPT = `You are a phishing URL detector. Analyze URLs and respond with a JSON object containing "verdict" ("phishing", "legitimate", or "uncertain") and a one-sentence "reason". Consider: typosquatting, brand impersonation, suspicious paths/subdomains, unusual TLDs for the brand, and known phishing patterns. Be concise.`;

function getAI() {
  if (typeof self !== 'undefined' && self.ai?.languageModel) return self.ai.languageModel;
  if (typeof chrome?.aiOriginTrial?.languageModel !== 'undefined') return chrome.aiOriginTrial.languageModel;
  return null;
}

let cachedSession = null;
let sessionLock = false;

async function getOrCreateSession() {
  if (cachedSession && !cachedSession.destroyed) return cachedSession;
  if (sessionLock) {
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (cachedSession && !cachedSession.destroyed) return cachedSession;
    }
    return null;
  }
  sessionLock = true;
  try {
    const lm = getAI();
    if (!lm) return null;
    cachedSession = await lm.create({ systemPrompt: SYSTEM_PROMPT, temperature: 0.1 });
    return cachedSession;
  } catch {
    cachedSession = null;
    return null;
  } finally {
    sessionLock = false;
  }
}

function destroySession() {
  if (cachedSession && !cachedSession.destroyed) {
    try { cachedSession.destroy(); } catch {}
  }
  cachedSession = null;
}

export async function isAIAvailable() {
  try {
    const lm = getAI();
    if (!lm) return false;
    const caps = await lm.capabilities();
    return caps.available === 'readily' || caps.available === 'after-download';
  } catch {
    return false;
  }
}

export async function analyzeWithAI(url, domain) {
  const session = await getOrCreateSession();
  if (!session) return null;

  const prompt = `URL: ${url}\nDomain: ${domain}\nVerdict:`;

  const result = await Promise.race([
    (async () => {
      try {
        const response = await session.prompt(prompt);
        return parseResponse(response);
      } catch (err) {
        return { error: err };
      }
    })(),
    new Promise(resolve => setTimeout(() => resolve({ error: 'timeout' }), AI_TIMEOUT))
  ]);

  if (result.error === 'timeout') {
    console.log('[HonEx] AI analysis timed out');
    destroySession();
    return null;
  }

  if (result.error) {
    console.log('[HonEx] AI analysis error:', result.error);
    return null;
  }

  return result;
}

function parseResponse(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (['phishing', 'legitimate', 'uncertain'].includes(parsed.verdict)) {
        return { verdict: parsed.verdict, reason: parsed.reason || '' };
      }
    }
  } catch {}

  const lower = text.toLowerCase();
  if (lower.includes('"phishing"') || /(^|\W)phishing(\W|$)/.test(lower)) return { verdict: 'phishing', reason: text.slice(0, 100) };
  if (lower.includes('"legitimate"') || /(^|\W)legitimate(\W|$)/.test(lower)) return { verdict: 'legitimate', reason: text.slice(0, 100) };
  return { verdict: 'uncertain', reason: text.slice(0, 100) };
}
