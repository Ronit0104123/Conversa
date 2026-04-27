'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listChatbots, listAllLeads } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bot, Users, MessageSquare, TrendingUp, Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    chatbots: 0,
    leads: 0,
    activeChatbots: 0,
  })
  const [recentLeads, setRecentLeads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const token = session.access_token

        const [chatbots, leads] = await Promise.all([
          listChatbots(token),
          listAllLeads(token),
        ])

        setStats({
          chatbots: chatbots.length,
          leads: leads.length,
          activeChatbots: chatbots.filter(c => c.status === 'active').length,
        })

        setRecentLeads(leads.slice(0, 5))
      } catch (error) {
        console.error('Failed to load dashboard:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const statCards = [
    { label: 'Total Chatbots', value: stats.chatbots, icon: Bot, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Active Chatbots', value: stats.activeChatbots, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Leads Captured', value: stats.leads, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  // EMPTY STATE
  if (stats.chatbots === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] max-w-[700px] mx-auto text-center">
        {/* Illustration/Image */}
        <div className="w-[120px] h-[120px] mb-[24px] rounded-[24px] bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
          <Bot className="w-16 h-16 text-indigo-200" />
        </div>
        
        {/* Heading */}
        <h2 className="text-[22px] font-semibold text-slate-900 mb-[8px]">
          No agents yet..
        </h2>
        
        {/* Subtext */}
        <p className="text-[14px] text-slate-500 mb-[16px] max-w-[300px]">
          Create your first AI agent to start capturing leads and answering questions.
        </p>
        
        {/* CTA button */}
        <div className="mb-[20px]">
          <Link href="/dashboard/chatbots/new">
            <Button>
              + New AI agent
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-slate-500">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/dashboard/chatbots/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create New Chatbot
            </Button>
          </Link>
          <Link href="/dashboard/leads">
            <Button variant="outline">
              <Users className="h-4 w-4 mr-2" />
              View All Leads
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent Leads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Leads</CardTitle>
          <Link href="/dashboard/leads">
            <Button variant="ghost" size="sm">View all</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              No leads yet. Create a chatbot and embed it on your site to start capturing leads.
            </p>
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{lead.name || 'Anonymous'}</p>
                    <p className="text-xs text-slate-500">{lead.email || lead.phone || 'No contact info'}</p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
