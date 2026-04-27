'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listChatbots, deleteChatbot } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bot, Plus, Trash2, ExternalLink, Code } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function ChatbotsPage() {
  const [chatbots, setChatbots] = useState([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        setToken(session.access_token)

        const data = await listChatbots(session.access_token)
        setChatbots(data)
      } catch (error) {
        console.error('Failed to load chatbots:', error)
        toast.error('Failed to load chatbots')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleDelete(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"? This will also delete all leads and chat history.`)) {
      return
    }
    try {
      await deleteChatbot(token, id)
      setChatbots(prev => prev.filter(c => c.id !== id))
      toast.success(`"${name}" deleted successfully`)
    } catch (error) {
      toast.error('Failed to delete chatbot')
    }
  }

  function getStatusBadge(status) {
    const variants = {
      active: 'bg-green-100 text-green-700',
      processing: 'bg-yellow-100 text-yellow-700',
      error: 'bg-red-100 text-red-700',
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[status] || variants.error}`}>
        {status === 'processing' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1.5 animate-pulse" />}
        {status}
      </span>
    )
  }

  function copyEmbedCode(chatbotId) {
    const code = `<script src="${window.location.origin}/widget/widget.js" data-chatbot-id="${chatbotId}"></script>`
    navigator.clipboard.writeText(code)
    toast.success('Embed code copied to clipboard!')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Your Chatbots</h2>
          <p className="text-sm text-slate-500 mt-1">Create and manage your AI chatbots</p>
        </div>
        <Link href="/dashboard/chatbots/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Chatbot
          </Button>
        </Link>
      </div>

      {/* Chatbot List */}
      {chatbots.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No chatbots yet</h3>
            <p className="text-sm text-slate-500 mb-4 max-w-sm">
              Create your first chatbot by pasting a website URL. Conversa will scrape the content and create an AI assistant.
            </p>
            <Link href="/dashboard/chatbots/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create your first chatbot
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {chatbots.map((bot) => (
            <Card key={bot.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-50">
                      <Bot className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-slate-900">{bot.name}</h3>
                      <p className="text-xs text-slate-500 truncate max-w-[180px]">{bot.website_url}</p>
                    </div>
                  </div>
                  {getStatusBadge(bot.status)}
                </div>

                <div className="text-xs text-slate-400 mb-4">
                  Created {new Date(bot.created_at).toLocaleDateString()}
                </div>

                <div className="flex items-center gap-2 border-t pt-3">
                  <Link href={`/dashboard/chatbots/${bot.id}`} className="flex-1">
                    <Button variant="ghost" size="sm" className="w-full text-xs">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Details
                    </Button>
                  </Link>
                  {bot.status === 'active' && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs"
                      onClick={() => copyEmbedCode(bot.id)}
                    >
                      <Code className="h-3 w-3 mr-1" />
                      Embed
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(bot.id, bot.name)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
