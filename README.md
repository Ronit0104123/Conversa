# LeadPilot 🚀

LeadPilot is an AI-powered lead generation SaaS that includes a chatbot platform capable of scraping websites, indexing documents, and providing intelligent responses based on your data.

## Project Structure

This is a monorepo containing both the frontend and backend:

-   `/frontend`: Next.js application (React, Tailwind CSS, Supabase).
-   `/backend`: FastAPI application (Python, LangChain, Groq, Playwright).

---

## 🛠️ Getting Started

### 1. Prerequisites

-   **Node.js** (v18+)
-   **Python** (v3.10+)
-   **Supabase Account** (for Auth and Database)
-   **Groq API Key** (for AI models)

### 2. Environment Setup

Both the frontend and backend require environment variables.

-   **Backend:**
    ```bash
    cd backend
    cp .env.example .env
    # Fill in your SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GROQ_API_KEY
    ```

-   **Frontend:**
    ```bash
    cd frontend
    cp .env.local.example .env.local
    # Fill in your NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
    ```

---

## 🚀 Running the Application

### Backend (FastAPI)

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create and activate a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Install Playwright browsers (required for scraping):
    ```bash
    playwright install chromium
    ```
5.  Start the server:
    ```bash
    uvicorn app.main:app --reload
    ```
    The backend will be available at `http://localhost:8000`.

### Frontend (Next.js)

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
    The frontend will be available at `http://localhost:3000`.

---

## 📁 Key Features

-   **AI Chatbot:** Built with LangChain and Groq for high-speed, intelligent responses.
-   **Website Scraping:** Uses Playwright and BeautifulSoup to crawl and index websites.
-   **Document Indexing:** Supports PDF and DOCX files for knowledge base expansion.
-   **Auth:** Secure authentication via Supabase Auth.
-   **Vector Search:** Local embeddings using `sentence-transformers`.

## 📄 License

This project is private and intended for LeadPilot internal use.
