/**
 * Conversa — FastAPI Client
 * 
 * A thin wrapper around fetch() that:
 * 1. Prepends the API base URL
 * 2. Automatically attaches the Supabase JWT token
 * 3. Handles JSON parsing and errors consistently
 * 
 * WHY NOT AXIOS?
 * fetch() is built into Next.js and browsers — no extra dependency.
 * For our simple REST calls, fetch is more than enough.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * Make an authenticated request to the FastAPI backend.
 * 
 * @param {string} endpoint - API path (e.g. "/api/chatbots")
 * @param {object} options - fetch options (method, body, etc.)
 * @param {string} token - Supabase JWT token
 * @returns {Promise<any>} Parsed JSON response
 */
export async function apiRequest(endpoint, options = {}, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  // For 204 No Content (e.g. DELETE), there's no body to parse
  if (response.status === 204) {
    return null
  }

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.detail || 'Something went wrong')
  }

  return data
}

// ============================================================
// Chatbot API calls
// ============================================================

export async function createChatbot(token, { name, website_url }) {
  return apiRequest('/api/chatbots/', {
    method: 'POST',
    body: JSON.stringify({ name, website_url }),
  }, token)
}

export async function listChatbots(token) {
  return apiRequest('/api/chatbots/', {}, token)
}

export async function getChatbot(token, chatbotId) {
  return apiRequest(`/api/chatbots/${chatbotId}`, {}, token)
}

export async function deleteChatbot(token, chatbotId) {
  return apiRequest(`/api/chatbots/${chatbotId}`, {
    method: 'DELETE',
  }, token)
}

// ============================================================
// Scrape API calls
// ============================================================

export async function triggerScrape(token, chatbotId, url, options = {}) {
  const { max_pages = 1, recursive = false, respect_robots = true } = options
  return apiRequest('/api/scrape/', {
    method: 'POST',
    body: JSON.stringify({ 
      chatbot_id: chatbotId, 
      url,
      max_pages,
      recursive,
      respect_robots
    }),
  }, token)
}

// ============================================================
// Leads API calls
// ============================================================

export async function listAllLeads(token) {
  return apiRequest('/api/leads/', {}, token)
}

export async function listChatbotLeads(token, chatbotId) {
  return apiRequest(`/api/leads/${chatbotId}`, {}, token)
}

// ============================================================
// Chat API calls (for dashboard — viewing history)
// ============================================================

export async function listChatSessions(token, chatbotId) {
  return apiRequest(`/api/chat/sessions/${chatbotId}`, {}, token)
}

export async function listMessages(token, sessionId) {
  return apiRequest(`/api/chat/messages/${sessionId}`, {}, token)
}

// ============================================================
// Documents API calls
// ============================================================

export async function uploadDocument(token, chatbotId, file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_URL}/api/documents/${chatbotId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
      // Note: Don't set Content-Type header here, the browser will set it with the boundary for FormData
    },
    body: formData
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to upload document')
  }
  return data
}

export async function listDocuments(token, chatbotId) {
  return apiRequest(`/api/documents/${chatbotId}`, {}, token)
}
