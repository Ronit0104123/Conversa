/**
 * Conversa — Embeddable Chat Widget
 * 
 * HOW IT WORKS:
 * 1. User adds <script src="https://your-domain/widget/widget.js" data-chatbot-id="abc123"></script>
 * 2. This script reads the data-chatbot-id attribute
 * 3. Creates a Shadow DOM container (CSS isolation from host site)
 * 4. Renders a chat bubble → click → chat panel opens
 * 5. Messages are sent to the FastAPI backend via REST
 * 6. visitor_id and session_id are persisted in localStorage
 * 
 * WHY SHADOW DOM?
 * If we just appended regular HTML, the host site's CSS could break our
 * widget (imagine a site that sets `* { margin: 0; font-size: 10px; }`).
 * Shadow DOM creates a completely isolated DOM tree with its own styles.
 */

(function () {
  'use strict';

  // ============================================================
  // 1. Read config from the script tag
  // ============================================================
  const scriptTag = document.currentScript;
  const CHATBOT_ID = scriptTag?.getAttribute('data-chatbot-id');
  const API_URL = scriptTag?.getAttribute('data-api-url') || 'http://localhost:8000';
  const POSITION = scriptTag?.getAttribute('data-position') || 'right'; // 'left' or 'right'
  const PRIMARY_COLOR = scriptTag?.getAttribute('data-color') || '#2563eb'; // blue-600

  if (!CHATBOT_ID) {
    console.error('[Conversa] Missing data-chatbot-id attribute on script tag.');
    return;
  }

  // ============================================================
  // 2. Generate or retrieve visitor ID
  // ============================================================
  const STORAGE_KEY = `conversa_visitor_${CHATBOT_ID}`;
  const SESSION_KEY = `conversa_session_${CHATBOT_ID}`;
  const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes of inactivity

  function getVisitorId() {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = 'v_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  }

  function getSessionId() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    // Backward compatible: older versions stored only the session ID string.
    if (!raw.startsWith('{')) {
      return raw;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.id) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      const lastActiveAt = Number(parsed.lastActiveAt || 0);
      if (!lastActiveAt || (Date.now() - lastActiveAt) > SESSION_TTL_MS) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      return parsed.id;
    } catch (_) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function setSessionId(id) {
    const payload = {
      id,
      lastActiveAt: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }

  const visitorId = getVisitorId();
  const DEFAULT_GREETING = 'Hello! How can I help you today?';

  // ============================================================
  // 3. Create Shadow DOM container
  // ============================================================
  const host = document.createElement('div');
  host.id = 'conversa-widget-host';
  host.style.cssText = 'position:fixed;bottom:0;' + POSITION + ':0;z-index:2147483647;font-family:system-ui,-apple-system,sans-serif;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // ============================================================
  // 4. Inject styles into Shadow DOM
  // ============================================================
  const styles = document.createElement('style');
  styles.textContent = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    .conversa-bubble {
      position: fixed;
      bottom: 24px;
      ${POSITION}: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: ${PRIMARY_COLOR};
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.18);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      z-index: 10;
    }

    .conversa-bubble:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 32px rgba(0,0,0,0.25);
    }

    .conversa-bubble svg {
      width: 28px;
      height: 28px;
      transition: transform 0.3s ease;
    }

    .conversa-bubble.open svg {
      transform: rotate(90deg);
    }

    .conversa-panel {
      position: fixed;
      bottom: 100px;
      ${POSITION}: 24px;
      width: 380px;
      max-width: calc(100vw - 48px);
      height: 520px;
      max-height: calc(100vh - 140px);
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease;
      z-index: 9;
    }

    .conversa-panel.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    .conversa-header {
      background: ${PRIMARY_COLOR};
      color: white;
      padding: 18px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .conversa-header-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .conversa-header-avatar svg {
      width: 20px;
      height: 20px;
    }

    .conversa-header-text h3 {
      font-size: 15px;
      font-weight: 600;
      line-height: 1.3;
    }

    .conversa-header-text p {
      font-size: 12px;
      opacity: 0.85;
      margin-top: 1px;
    }

    .conversa-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #f9fafb;
    }

    .conversa-messages::-webkit-scrollbar {
      width: 4px;
    }

    .conversa-messages::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 4px;
    }

    .conversa-msg {
      max-width: 82%;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      animation: fadeIn 0.25s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .conversa-msg.bot {
      background: #ffffff;
      color: #1f2937;
      align-self: flex-start;
      border: 1px solid #e5e7eb;
      border-bottom-left-radius: 4px;
    }

    .conversa-msg.user {
      background: ${PRIMARY_COLOR};
      color: #ffffff;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }

    .conversa-typing {
      display: flex;
      gap: 4px;
      padding: 12px 16px;
      align-self: flex-start;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      border-bottom-left-radius: 4px;
    }

    .conversa-typing span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #9ca3af;
      animation: bounce 1.4s infinite;
    }

    .conversa-typing span:nth-child(2) { animation-delay: 0.15s; }
    .conversa-typing span:nth-child(3) { animation-delay: 0.3s; }

    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    .conversa-input-area {
      padding: 12px 16px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 8px;
      background: #ffffff;
      flex-shrink: 0;
    }

    .conversa-input-area input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s;
      font-family: inherit;
      background: #f9fafb;
    }

    .conversa-input-area input:focus {
      border-color: ${PRIMARY_COLOR};
      background: #ffffff;
    }

    .conversa-input-area input::placeholder {
      color: #9ca3af;
    }

    .conversa-input-area button {
      padding: 10px 16px;
      background: ${PRIMARY_COLOR};
      color: white;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: opacity 0.15s;
      font-family: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .conversa-input-area button:hover {
      opacity: 0.9;
    }

    .conversa-input-area button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .conversa-input-area button svg {
      width: 18px;
      height: 18px;
    }

    .conversa-powered {
      text-align: center;
      padding: 6px;
      font-size: 10px;
      color: #9ca3af;
      background: #ffffff;
      border-top: 1px solid #f3f4f6;
    }

    .conversa-powered a {
      color: #6b7280;
      text-decoration: none;
      font-weight: 500;
    }

    .conversa-lead-success {
      text-align: center;
      padding: 8px 12px;
      margin: 0 -14px;
      margin-top: 8px;
      background: #ecfdf5;
      color: #065f46;
      font-size: 12px;
      border-radius: 8px;
      animation: fadeIn 0.3s ease;
    }
  `;
  shadow.appendChild(styles);

  // ============================================================
  // 5. Build the widget HTML
  // ============================================================
  const container = document.createElement('div');

  // SVG icons
  const chatIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  const closeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  const sendIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
  const botIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>';

  container.innerHTML = `
    <button class="conversa-bubble" aria-label="Open chat">${chatIcon}</button>
    <div class="conversa-panel">
      <div class="conversa-header">
        <div class="conversa-header-avatar">${botIcon}</div>
        <div class="conversa-header-text">
          <h3>Hi there! 👋</h3>
          <p>Ask me anything about our website</p>
        </div>
      </div>
      <div class="conversa-messages">
        <div class="conversa-msg bot">${DEFAULT_GREETING}</div>
      </div>
      <div class="conversa-input-area">
        <input type="text" placeholder="Type your message..." aria-label="Chat message" />
        <button aria-label="Send message">${sendIcon}</button>
      </div>
      <div class="conversa-powered">Powered by <a href="#">Conversa</a></div>
    </div>
  `;

  shadow.appendChild(container);

  // ============================================================
  // 6. Get references to DOM elements
  // ============================================================
  const bubble = shadow.querySelector('.conversa-bubble');
  const panel = shadow.querySelector('.conversa-panel');
  const messagesContainer = shadow.querySelector('.conversa-messages');
  const input = shadow.querySelector('.conversa-input-area input');
  const sendBtn = shadow.querySelector('.conversa-input-area button');

  let isOpen = false;
  let isLoading = false;
  let historyLoaded = false;
  let historyLoading = false;

  // ============================================================
  // 7. Toggle panel open/close
  // ============================================================
  bubble.addEventListener('click', function () {
    isOpen = !isOpen;
    panel.classList.toggle('visible', isOpen);
    bubble.classList.toggle('open', isOpen);
    bubble.innerHTML = isOpen ? closeIcon : chatIcon;

    if (isOpen) {
      loadHistoryIfAvailable();
      setTimeout(function () { input.focus(); }, 300);
    }
  });

  // ============================================================
  // 8. Send message
  // ============================================================
  function addMessage(text, role) {
    const msg = document.createElement('div');
    msg.className = 'conversa-msg ' + role;
    msg.textContent = text;
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return msg;
  }

  function clearMessages() {
    messagesContainer.innerHTML = '';
  }

  function renderHistory(messages) {
    clearMessages();

    if (!messages || !messages.length) {
      addMessage(DEFAULT_GREETING, 'bot');
      return;
    }

    for (const message of messages) {
      if (!message || !message.content) continue;
      const uiRole = message.role === 'assistant' ? 'bot' : 'user';
      addMessage(message.content, uiRole);
    }
  }

  async function loadHistoryIfAvailable() {
    if (historyLoaded || historyLoading) return;

    const sessionId = getSessionId();
    if (!sessionId) {
      historyLoaded = true;
      return;
    }

    historyLoading = true;
    try {
      const params = new URLSearchParams({
        chatbot_id: CHATBOT_ID,
        session_id: sessionId,
        visitor_id: visitorId,
        limit: '30',
      });

      const response = await fetch(API_URL + '/api/chat/history?' + params.toString(), {
        method: 'GET',
      });

      if (!response.ok) {
        // Stale/invalid session should be dropped so new chat starts cleanly.
        if (response.status === 403 || response.status === 404) {
          localStorage.removeItem(SESSION_KEY);
        }
        historyLoaded = true;
        return;
      }

      const history = await response.json();
      renderHistory(Array.isArray(history) ? history : []);
    } catch (error) {
      console.error('[Conversa] Failed to load history:', error);
    } finally {
      historyLoading = false;
      historyLoaded = true;
    }
  }

  function showTyping() {
    const typing = document.createElement('div');
    typing.className = 'conversa-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    messagesContainer.appendChild(typing);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return typing;
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isLoading) return;

    await loadHistoryIfAvailable();

    // Show user message
    addMessage(text, 'user');
    input.value = '';
    isLoading = true;
    sendBtn.disabled = true;

    // Show typing indicator
    const typing = showTyping();

    try {
      const response = await fetch(API_URL + '/api/chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatbot_id: CHATBOT_ID,
          session_id: getSessionId(),
          visitor_id: visitorId,
          message: text,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Chat request failed';
        try {
          const errorData = await response.json();
          if (errorData && errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (_) {
          // Keep fallback message when error payload is not JSON.
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Save session ID for future messages
      if (data.session_id) {
        setSessionId(data.session_id);
      }

      // Remove typing indicator
      typing.remove();

      // Show bot response
      const botMsg = addMessage(data.agent_response.response, 'bot');

      // If lead was captured, show success indicator
      if (data.agent_response.lead_captured) {
        const success = document.createElement('div');
        success.className = 'conversa-lead-success';
        success.textContent = '✓ Thanks! Your info has been saved.';
        botMsg.appendChild(success);
      }

    } catch (error) {
      typing.remove();
      addMessage(error.message || 'Sorry, I\'m having trouble connecting. Please try again.', 'bot');
      console.error('[Conversa] Chat error:', error);
    } finally {
      isLoading = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  // Send on button click
  sendBtn.addEventListener('click', sendMessage);

  // Send on Enter key
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

})();
