'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listChatbots, listChatSessions, listMessages } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageSquare, Bot, User, ArrowLeft } from 'lucide-react'

export default function ChatsPage() {
  const [chatbots, setChatbots] = useState([])
  const [selectedBot, setSelectedBot] = useState(null)
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [messages, setMessages] = useState([])
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
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSelectBot(bot) {
    setSelectedBot(bot)
    setSelectedSession(null)
    setMessages([])
    try {
      const data = await listChatSessions(token, bot.id)
      setSessions(data)
    } catch (error) {
      console.error('Failed to load sessions:', error)
    }
  }

  async function handleSelectSession(session) {
    setSelectedSession(session)
    try {
      const data = await listMessages(token, session.id)
      setMessages(data)
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  // Show messages view
  if (selectedSession) {
    return (
      <div className="space-y-4">
        <button 
          onClick={() => { setSelectedSession(null); setMessages([]) }}
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to sessions
        </button>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900">
              Chat with {selectedSession.visitor_id?.slice(0, 8) || 'Visitor'}
            </CardTitle>
              <p className="text-xs text-slate-500">
              Started {new Date(selectedSession.started_at).toLocaleString()}
            </p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No messages in this session.</p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'assistant' ? '' : 'justify-end'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-1">
                          <Bot className="h-3.5 w-3.5 text-indigo-600" />
                        </div>
                      )}
                      <div className={`max-w-[75%] rounded-lg px-4 py-2.5 text-sm ${
                        msg.role === 'assistant' 
                          ? 'bg-slate-100 text-slate-900' 
                          : 'bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-white'
                      }`}>
                        {msg.content}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="h-3.5 w-3.5 text-slate-600" />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show sessions list
  if (selectedBot) {
    return (
      <div className="space-y-4">
        <button 
          onClick={() => { setSelectedBot(null); setSessions([]) }}
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to chatbots
        </button>

        <h2 className="text-xl font-bold text-slate-900">Sessions for {selectedBot.name}</h2>

        {sessions.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No chat sessions yet for this chatbot.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <Card 
                key={session.id} 
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleSelectSession(session)}
              >
                <CardContent className="flex items-center justify-between pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Visitor {session.visitor_id?.slice(0, 8) || 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(session.started_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <MessageSquare className="h-4 w-4 text-slate-400" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Show chatbot picker
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Chat History</h2>
        <p className="text-sm text-slate-500 mt-1">Select a chatbot to view its conversations</p>
      </div>

      {chatbots.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No chatbots yet. Create one to start seeing conversations.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {chatbots.map((bot) => (
            <Card 
              key={bot.id} 
              className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleSelectBot(bot)}
            >
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="p-2 rounded-lg bg-indigo-50">
                  <Bot className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-900">{bot.name}</p>
                  <p className="text-xs text-slate-500">{bot.website_url}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
