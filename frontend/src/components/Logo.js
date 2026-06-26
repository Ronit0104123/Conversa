'use client'

import { motion } from 'framer-motion'

export function Logo({ className = "h-8 w-8", showText = false, textClassName = "text-xl font-bold tracking-tight text-slate-900" }) {
  return (
    <div className="flex items-center gap-2.5">
      <motion.div 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`${className} relative flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-200 overflow-hidden`}
      >
        {/* Chat Bubble Icon */}
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          className="w-[60%] h-[60%] text-white" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M21 11.5C21 15.6421 17.1941 19 12.5 19C11.5827 19 10.7025 18.8719 9.88344 18.6344L5 21L6.21062 16.5611C4.24036 15.2285 3 13.2084 3 11.5C3 7.35786 6.80589 4 11.5 4C16.1941 4 21 7.35786 21 11.5Z" 
            fill="currentColor"
          />
        </svg>
        
        {/* Subtle Shine Effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-50" />
      </motion.div>
      
      {showText && (
        <span className={textClassName}>Conversa</span>
      )}
    </div>
  )
}
