'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getChatbot, listChatbotLeads, listChatSessions } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Bot, Users, MessageSquare, Code, Copy, Check, RefreshCw, ChevronDown, ChevronUp, FileUp } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { triggerScrape } from '@/lib/api'
import { DocumentKnowledgeBase } from '@/components/DocumentKnowledgeBase'

export default function ChatbotDetailPage() {
  const params = useParams()
  const chatbotId = params.id
  const [chatbot, setChatbot] = useState(null)
  const [leads, setLeads] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [token, setToken] = useState(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [maxPages, setMaxPages] = useState(1)
  const [recursive, setRecursive] = useState(false)
  const [respectRobots, setRespectRobots] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        setToken(session.access_token)

        const [bot, leadsData, sessionsData] = await Promise.all([
          getChatbot(session.access_token, chatbotId),
          listChatbotLeads(session.access_token, chatbotId),
          listChatSessions(session.access_token, chatbotId),
        ])

        setChatbot(bot)
        setLeads(leadsData)
        setSessions(sessionsData)
      } catch (error) {
        console.error('Failed to load chatbot:', error)
        toast.error('Failed to load chatbot details')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [chatbotId])

  // Poll for status changes when processing
  useEffect(() => {
    if (!chatbot || chatbot.status !== 'processing' || !token) return

    const interval = setInterval(async () => {
      try {
        const updated = await getChatbot(token, chatbotId)
        if (updated.status !== 'processing') {
          setChatbot(updated)
          clearInterval(interval)
          if (updated.status === 'active') {
            toast.success('Chatbot is ready!')
          } else {
            toast.error('Scraping failed. Please try again.')
          }
        }
      } catch (error) {
        // Ignore polling errors
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [chatbot?.status, chatbotId, token])

  function getEmbedCode() {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'
    return `<script src="${origin}/widget/widget.js" data-chatbot-id="${chatbotId}"></script>`
  }

  function copyEmbedCode() {
    navigator.clipboard.writeText(getEmbedCode())
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRetrain() {
    if (!token || !chatbot) return
    try {
      await triggerScrape(token, chatbot.id, chatbot.website_url, {
        max_pages: parseInt(maxPages),
        recursive: recursive,
        respect_robots: respectRobots
      })
      setChatbot(prev => ({ ...prev, status: 'processing' }))
      toast.info('Re-scraping started...')
      setShowAdvanced(false)
    } catch (error) {
      toast.error('Failed to start re-scraping')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!chatbot) {
    return <p className="text-slate-500">Chatbot not found.</p>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/dashboard/chatbots" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Chatbots
      </Link>

      {/* Chatbot Info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="p-3 rounded-xl bg-indigo-50 shrink-0">
                <Bot className="h-8 w-8 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-slate-900 truncate">{chatbot.name}</h2>
                <a 
                  href={chatbot.website_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm text-slate-500 hover:text-slate-900 transition-colors block truncate max-w-[200px] sm:max-w-none"
                >
                  {chatbot.website_url}
                </a>
                <div className="mt-2">
                  {chatbot.status === 'active' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      ● Active
                    </span>
                  )}
                  {chatbot.status === 'processing' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1.5 animate-pulse" />
                      Processing...
                    </span>
                  )}
                  {chatbot.status === 'error' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      ● Error
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRetrain}
                disabled={chatbot.status === 'processing'}
                className="w-full sm:w-auto"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${chatbot.status === 'processing' ? 'animate-spin' : ''}`} />
                Re-train
              </Button>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-[10px] text-slate-400 hover:text-slate-600 uppercase tracking-wider font-semibold flex items-center px-1"
              >
                {showAdvanced ? 'Hide Options' : 'Advanced Options'}
              </button>
            </div>
          </div>

          {showAdvanced && (
            <div className="mt-6 p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-4 max-w-md w-full sm:ml-auto">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">Recursive Crawling</span>
                <input
                  type="checkbox"
                  checked={recursive}
                  onChange={(e) => {
                    setRecursive(e.target.checked)
                    if (e.target.checked && maxPages === 1) setMaxPages(10)
                  }}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-slate-700">Max Pages</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value)}
                  disabled={!recursive && maxPages === 1}
                  className="w-16 px-2 py-1 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">Respect robots.txt</span>
                <input
                  type="checkbox"
                  checked={respectRobots}
                  onChange={(e) => setRespectRobots(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-indigo-50">
              <Users className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Leads Captured</p>
              <p className="text-2xl font-bold text-slate-900">{leads.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-indigo-50">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Chat Sessions</p>
              <p className="text-2xl font-bold text-slate-900">{sessions.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Knowledge Base / File Upload */}
      <DocumentKnowledgeBase 
        chatbotId={chatbotId} 
        token={token} 
        onStatusChange={(status) => setChatbot(prev => ({ ...prev, status }))}
      />

      {/* Embed Code */}
      {chatbot.status === 'active' && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
              <Code className="h-5 w-5" />
              Embed Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-3">
              Paste this code snippet before the closing <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> tag of your website.
            </p>
            <div className="relative">
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto">
                <code>{getEmbedCode()}</code>
              </pre>
              <Button 
                size="sm" 
                variant="secondary" 
                className="absolute top-2 right-2"
                onClick={copyEmbedCode}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
