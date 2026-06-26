'use client'

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { 
  Bot, 
  Users, 
  MessageSquare, 
  Code, 
  CheckCircle2, 
  BarChart3, 
  Plus, 
  Settings,
  MoreVertical,
  Search,
  LayoutDashboard
} from 'lucide-react'
import { Logo } from './Logo'

export function InteractiveDashboardMockup() {
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const mouseXSpring = useSpring(x)
  const mouseYSpring = useSpring(y)

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["5deg", "-5deg"])
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-5deg", "5deg"])

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const xPct = mouseX / width - 0.5
    const yPct = mouseY / height - 0.5
    x.set(xPct)
    y.set(yPct)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className="relative w-full aspect-[4/3] max-w-[600px] mx-auto"
    >
      {/* Main Dashboard Window */}
      <div className="absolute inset-0 rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden flex transform translate-z-10">
        {/* Sidebar */}
        <div className="w-[18%] bg-slate-50 border-r border-slate-100 p-3 flex flex-col gap-4">
          <div className="mb-2">
            <Logo className="h-6 w-6" />
          </div>
          {[LayoutDashboard, Bot, Users, MessageSquare, Settings].map((Icon, i) => (
            <div key={i} className={`flex items-center gap-2 p-1.5 rounded-lg ${i === 0 ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>
              <Icon className="h-4 w-4" />
              <div className={`h-1.5 w-10 rounded ${i === 0 ? 'bg-indigo-200' : 'bg-slate-100'}`} />
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="h-12 border-b border-slate-100 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 bg-slate-100 rounded" />
              <div className="h-4 w-12 bg-green-50 text-green-600 flex items-center justify-center rounded-full text-[8px] font-bold">LIVE</div>
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-indigo-600 rounded-lg" />
              <div className="h-6 w-6 bg-slate-100 rounded-lg" />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { title: 'Leads', value: '128', icon: Users },
                { title: 'Chats', value: '452', icon: MessageSquare }
              ].map((stat, i) => (
                <div key={i} className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                    <stat.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="h-1.5 w-8 bg-slate-100 rounded mb-1.5" />
                    <div className="text-sm font-bold text-slate-900">{stat.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* List */}
            <div className="rounded-xl border border-slate-100 overflow-hidden bg-white shadow-sm">
              <div className="h-8 bg-slate-50/50 border-b border-slate-100 px-3 flex items-center gap-2">
                <div className="h-2 w-20 bg-slate-200 rounded" />
              </div>
              <div className="p-2 space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-[10px]">JD</div>
                      <div className="space-y-1">
                        <div className="h-2 w-16 bg-slate-200 rounded" />
                        <div className="h-1.5 w-24 bg-slate-100 rounded" />
                      </div>
                    </div>
                    <div className="h-4 w-12 bg-slate-50 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Elements */}
      {/* Lead Card */}
      <motion.div
        style={{
          translateZ: "50px",
        }}
        className="absolute -right-6 top-1/4 p-4 rounded-2xl bg-white shadow-2xl border border-slate-100 flex items-center gap-4 animate-bounce-slow"
      >
        <div className="p-2.5 rounded-full bg-green-100 text-green-600">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">New Lead</div>
          <div className="text-sm font-bold text-slate-900">Sarah Johnson</div>
        </div>
        <div className="ml-2 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
      </motion.div>

      {/* Embed Badge */}
      <motion.div
        style={{
          translateZ: "80px",
        }}
        className="absolute -left-10 bottom-1/4 p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-2xl text-white flex flex-col gap-2"
      >
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4" />
          <div className="text-xs font-bold">Copy Embed Code</div>
        </div>
        <div className="h-1 w-24 bg-white/20 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "70%" }}
            transition={{ duration: 2, repeat: Infinity }}
            className="h-full bg-white"
          />
        </div>
      </motion.div>

      {/* AI Bubble */}
      <motion.div
        style={{
          translateZ: "120px",
        }}
        className="absolute -top-6 left-1/3 p-3 rounded-2xl bg-white shadow-xl border border-indigo-100 flex items-center gap-3"
      >
        <Logo className="h-8 w-8" />
        <div className="space-y-1">
          <div className="h-1.5 w-16 bg-slate-200 rounded" />
          <div className="h-1.5 w-24 bg-slate-100 rounded" />
        </div>
      </motion.div>

      <style jsx>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
      `}</style>
    </motion.div>
  )
}
