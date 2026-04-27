'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createChatbot, triggerScrape } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2, Globe, Bot, Settings, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function NewChatbotPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [step, setStep] = useState('form') // form | creating | done
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [maxPages, setMaxPages] = useState(1)
  const [recursive, setRecursive] = useState(false)
  const [respectRobots, setRespectRobots] = useState(true)

  async function handleSubmit(e) {
    e.preventDefault()
    setIsCreating(true)
    setStep('creating')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const token = session.access_token

      // Step 1: Create the chatbot record
      const chatbot = await createChatbot(token, { name, website_url: url })
      toast.success('Chatbot created!')

      // Step 2: Trigger scrape without blocking navigation.
      // This keeps the flow responsive while backend processing continues.
      triggerScrape(token, chatbot.id, url, {
        max_pages: parseInt(maxPages),
        recursive: recursive,
        respect_robots: respectRobots
      })
        .then(() => {
          toast.info('Website scraping started — this takes a few seconds...')
        })
        .catch((scrapeError) => {
          console.error('Scrape trigger failed:', scrapeError)
          toast.error(scrapeError.message || 'Chatbot created, but scraping failed to start')
        })

      setStep('done')
      router.push(`/dashboard/chatbots/${chatbot.id}`)

    } catch (error) {
      console.error('Failed to create chatbot:', error)
      toast.error(error.message || 'Failed to create chatbot')
      setStep('form')
      setIsCreating(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard/chatbots" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Chatbots
      </Link>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-900">Create New Chatbot</CardTitle>
          <CardDescription>
            Paste your website URL and Conversa will scrape the content to train your AI chatbot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'creating' && (
            <div className="flex flex-col items-center py-8 text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
              <div>
                <p className="font-medium text-slate-900">Setting up your chatbot...</p>
                <p className="text-sm text-slate-500 mt-1">Scraping website and generating embeddings</p>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Bot className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-700">Chatbot created successfully!</p>
                <p className="text-sm text-slate-500 mt-1">Redirecting to chatbot details...</p>
              </div>
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Chatbot Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., My Company Assistant"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isCreating}
                />
                <p className="text-xs text-slate-500">Give your chatbot a name so you can identify it later.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">Website URL</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    disabled={isCreating}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Conversa will scrape this page to train your chatbot. Make sure it&apos;s a public URL.
                </p>
              </div>

              {/* Advanced Options */}
              <div className="space-y-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors"
                >
                  {showAdvanced ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                  Advanced Crawling Options
                </button>

                {showAdvanced && (
                  <div className="space-y-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="recursive" className="text-sm font-medium">Recursive Crawling</Label>
                        <p className="text-xs text-slate-500">Follow internal links to scrape the whole site.</p>
                      </div>
                      <input
                        id="recursive"
                        type="checkbox"
                        checked={recursive}
                        onChange={(e) => {
                          setRecursive(e.target.checked)
                          if (e.target.checked && maxPages === 1) setMaxPages(10)
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxPages">Max Pages to Scrape</Label>
                      <Input
                        id="maxPages"
                        type="number"
                        min="1"
                        max="50"
                        value={maxPages}
                        onChange={(e) => setMaxPages(e.target.value)}
                        disabled={!recursive && maxPages === 1}
                      />
                      <p className="text-xs text-slate-500">Maximum number of pages to index (1-50).</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="respectRobots" className="text-sm font-medium">Respect robots.txt</Label>
                        <p className="text-xs text-slate-500">Only scrape pages allowed by the website owner.</p>
                      </div>
                      <input
                        id="respectRobots"
                        type="checkbox"
                        checked={respectRobots}
                        onChange={(e) => setRespectRobots(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isCreating || !name || !url}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4 mr-2" />
                    Create Chatbot
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
