"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BarChart3, Bot, Handshake, Palette, Rocket, ShieldCheck } from "lucide-react";
import { InteractiveDashboardMockup } from "@/components/InteractiveDashboardMockup";

const FEATURES = [
  {
    title: "AI responses",
    description: "Human-like natural language understanding for accurate answers.",
    Icon: Bot,
  },
  {
    title: "Lead capture",
    description: "Automatically collect emails and phone numbers in the flow.",
    Icon: Handshake,
  },
  {
    title: "Analytics",
    description: "Deep insights into what your customers are asking.",
    Icon: BarChart3,
  },
  {
    title: "Fast setup",
    description: "Go from URL to live chatbot in under 2 minutes.",
    Icon: Rocket,
  },
  {
    title: "Secure",
    description: "Enterprise-grade encryption for all your data.",
    Icon: ShieldCheck,
  },
  {
    title: "Customization",
    description: "Match your brand colors, tone, and personality.",
    Icon: Palette,
  },
];

function buildVisitorId() {
  return `landing_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export default function Home() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hello! I am your Conversa AI assistant. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [visitorId, setVisitorId] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const key = "conversa_landing_visitor_id";
    const existing = window.localStorage.getItem(key);
    if (existing) {
      setVisitorId(existing);
      return;
    }
    const nextId = buildVisitorId();
    window.localStorage.setItem(key, nextId);
    setVisitorId(nextId);
  }, []);

  async function handleSendMessage() {
    const text = input.trim();
    if (!text || isSending) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          visitor_id: visitorId,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to reach demo chatbot right now.");
      }

      if (payload.session_id) {
        setSessionId(payload.session_id);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: payload.response || "I could not generate a response right now." },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: error.message || "Sorry, I am having trouble connecting. Please try again.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="bg-white text-slate-900">
      <nav className="fixed top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-2xl font-semibold tracking-tight">Conversa</div>
          
          {/* Desktop Nav */}
          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a className="hover:text-indigo-600" href="#features">
              Features
            </a>
            <a className="hover:text-indigo-500" href="#preview">
              Demo
            </a>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4">
              <Link className="text-sm font-medium text-slate-600 hover:text-indigo-600" href="/login">
                Sign In
              </Link>
              <Link
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-transform hover:scale-[0.98]"
                href="/signup"
              >
                Get Started
              </Link>
            </div>
            
            {/* Mobile Nav Toggle */}
            <button 
              className="p-2 -mr-2 text-slate-600 md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Bot className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="border-t border-slate-100 bg-white p-6 md:hidden space-y-4 animate-in slide-in-from-top-4">
            <a className="block text-base font-medium text-slate-900" href="#features" onClick={() => setIsMenuOpen(false)}>
              Features
            </a>
            <a className="block text-base font-medium text-slate-900" href="#preview" onClick={() => setIsMenuOpen(false)}>
              Demo
            </a>
            <hr className="border-slate-100" />
            <Link className="block text-base font-medium text-slate-900" href="/login">
              Sign In
            </Link>
            <Link
              className="block w-full rounded-xl bg-indigo-600 px-5 py-3 text-center text-base font-semibold text-white shadow-lg"
              href="/signup"
            >
              Get Started
            </Link>
          </div>
        )}
      </nav>

      <main>
        <section className="pt-36 pb-24">
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="space-y-6 text-center lg:text-left"
            >
              <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl tracking-tight">
                Turn your website into a{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-fuchsia-500">
                  lead-generating
                </span> AI chatbot
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Conversa uses your website content to answer customer questions instantly and capture leads while you sleep. Set up in less than 2 minutes.
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                <Link
                  className="w-full sm:w-auto rounded-2xl bg-gradient-to-br from-indigo-600 to-fuchsia-500 px-10 py-5 text-sm font-bold text-white shadow-2xl shadow-indigo-200 transition-all hover:scale-[1.02] hover:shadow-indigo-300 text-center"
                  href="/signup"
                >
                  Create your chatbot for free
                </Link>
                <a
                  className="w-full sm:w-auto rounded-2xl border border-slate-200 bg-white px-10 py-5 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-50 hover:border-slate-300 text-center"
                  href="#preview"
                >
                  See demo
                </a>
              </div>
            </motion.div>
            <div className="relative lg:block">
              <div className="absolute -inset-10 rounded-full bg-indigo-200/40 blur-3xl" />
              <div className="relative perspective-1000">
                <InteractiveDashboardMockup />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <h2 className="text-3xl font-semibold">Simple 3-step setup</h2>
            </div>
            <div className="relative mt-12 grid grid-cols-1 gap-10 md:grid-cols-3">
              <div className="absolute left-0 right-0 top-12 hidden h-0.5 bg-slate-200 md:block" />
              <div className="relative z-10 flex flex-col items-center rounded-2xl bg-white p-6 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-2xl font-semibold text-white shadow-lg">
                  1
                </div>
                <h4 className="text-xl font-semibold">Paste URL</h4>
                <p className="mt-2 text-slate-600">Enter your website address or upload a file.</p>
              </div>
              <div className="relative z-10 flex flex-col items-center rounded-2xl bg-white p-6 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-2xl font-semibold text-white shadow-lg">
                  2
                </div>
                <h4 className="text-xl font-semibold">AI generates</h4>
                <p className="mt-2 text-slate-600">Our engine trains on your data in seconds to create a custom bot.</p>
              </div>
              <div className="relative z-10 flex flex-col items-center rounded-2xl bg-white p-6 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-2xl font-semibold text-white shadow-lg">
                  3
                </div>
                <h4 className="text-xl font-semibold">Embed script</h4>
                <p className="mt-2 text-slate-600">Copy and paste one line of code to go live on your site.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="bg-slate-50 py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <h2 className="text-3xl font-semibold">Packed with powerful features</h2>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {FEATURES.map(({ title, description, Icon }) => (
                <div
                  key={title}
                  className="rounded-3xl border border-transparent bg-white p-8 shadow-sm transition-all hover:border-indigo-200/40 hover:shadow-xl"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4 className="text-xl font-semibold">{title}</h4>
                  <p className="mt-3 text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="preview" className="bg-white py-24">
          <div className="mx-auto max-w-3xl px-6">
            <div className="text-center">
              <h2 className="text-3xl font-semibold">See it in action</h2>
              <p className="mt-4 text-slate-600">This is exactly how Conversa looks on your site.</p>
            </div>
            <div className="mt-12 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between bg-gradient-to-br from-indigo-600 to-fuchsia-500 p-6 text-white">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">AI</div>
                  <div>
                    <p className="text-sm font-semibold">Conversa Assistant</p>
                    <p className="text-xs opacity-80">Always active</p>
                  </div>
                </div>
                <span className="text-sm">Menu</span>
              </div>
              <div className="space-y-6 p-8 text-sm text-slate-700">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        message.role === "user"
                          ? "max-w-[80%] rounded-2xl rounded-tr-none bg-gradient-to-br from-indigo-600 to-fuchsia-500 p-4 text-white"
                          : "max-w-[80%] rounded-2xl rounded-tl-none bg-slate-100 p-4"
                      }
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl rounded-tl-none bg-slate-100 p-4 text-slate-500">
                      Thinking...
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-4 border-t border-slate-200 p-6">
                <input
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="Type your message..."
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleSendMessage}
                  disabled={isSending || !input.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-indigo-600 to-fuchsia-500 p-12 text-center text-white shadow-2xl">
              <div className="absolute right-0 top-0 h-72 w-72 -translate-y-1/2 translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
              <div className="relative">
                <h2 className="text-4xl font-semibold">Start capturing leads today</h2>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
                  Join over 2,000 businesses already using Conversa to grow their revenue. No credit card required.
                </p>
                <Link
                  className="mt-8 inline-flex rounded-2xl bg-white px-10 py-4 text-sm font-semibold text-indigo-700 shadow-2xl transition-transform hover:scale-[1.03]"
                  href="/signup"
                >
                  Create your chatbot for free
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div>
            <div className="text-lg font-semibold">Conversa</div>
            <p className="mt-2 text-sm text-slate-500">© Conversiq (MVP)</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
            <a className="hover:text-indigo-600" href="#">
              Privacy Policy
            </a>
            <a className="hover:text-indigo-600" href="#">
              Terms of Service
            </a>
            <a className="hover:text-indigo-600" href="#">
              Cookie Policy
            </a>
            <a className="hover:text-indigo-600" href="#">
              Contact Us
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
