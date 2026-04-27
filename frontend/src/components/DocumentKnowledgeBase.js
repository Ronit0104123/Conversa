'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileUp, 
  FileText, 
  FileCheck, 
  Loader2, 
  X, 
  File as FileIcon, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  FileType
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { uploadDocument, listDocuments } from '@/lib/api'

export function DocumentKnowledgeBase({ chatbotId, token, onStatusChange }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchFiles = useCallback(async () => {
    if (!token || !chatbotId) return
    try {
      const docs = await listDocuments(token, chatbotId)
      // Filter for only file-based documents (starting with file://)
      const fileDocs = docs.filter(d => d.source_url && d.source_url.startsWith('file://'))
      setFiles(fileDocs)
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setLoading(false)
    }
  }, [token, chatbotId])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return
    
    setUploading(true)
    const file = acceptedFiles[0]
    
    try {
      await uploadDocument(token, chatbotId, file)
      toast.success(`${file.name} uploaded successfully!`)
      if (onStatusChange) onStatusChange('processing')
      // Refresh list after a delay to allow indexing to start
      setTimeout(fetchFiles, 2000)
    } catch (error) {
      toast.error(error.message || 'Failed to upload document')
    } finally {
      setUploading(false)
    }
  }, [token, chatbotId, fetchFiles, onStatusChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt']
    },
    maxFiles: 1,
    disabled: uploading
  })

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase()
    if (ext === 'pdf') return <FileText className="h-5 w-5 text-red-500" />
    if (ext === 'xlsx' || ext === 'xls') return <FileSpreadsheet className="h-5 w-5 text-green-600" />
    if (ext === 'docx' || ext === 'doc') return <FileType className="h-5 w-5 text-blue-600" />
    return <FileText className="h-5 w-5 text-slate-400" />
  }

  return (
    <Card className="border-0 shadow-xl bg-white/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="bg-slate-50/80 border-b border-slate-100/50 py-4">
        <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
          <div className="p-1.5 rounded-lg bg-indigo-600 shadow-indigo-200 shadow-lg">
            <FileUp className="h-4 w-4 text-white" />
          </div>
          Knowledge Base
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {files.length} {files.length === 1 ? 'File' : 'Files'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <p className="text-sm text-slate-500 leading-relaxed">
          Upload PDF, DOCX, or Excel files to add specific knowledge to your chatbot. 
          Information from files is combined with website content for better accuracy.
        </p>
        
        <div 
          {...getRootProps()} 
          className={`
            relative group cursor-pointer overflow-hidden
            flex flex-col items-center justify-center p-10 
            border-2 border-dashed rounded-2xl transition-all duration-300
            ${isDragActive 
              ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]' 
              : 'border-slate-200 bg-slate-50/30 hover:bg-slate-50/80 hover:border-indigo-300'
            }
            ${uploading ? 'pointer-events-none opacity-80' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          <AnimatePresence mode="wait">
            {uploading ? (
              <motion.div 
                key="uploading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center"
              >
                <div className="relative">
                  <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="h-1 w-1 bg-indigo-600 rounded-full" />
                  </motion.div>
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-900">Indexing your file...</p>
                <p className="text-xs text-slate-500 mt-1">This usually takes a few seconds</p>
              </motion.div>
            ) : isDragActive ? (
              <motion.div 
                key="active"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center text-indigo-600"
              >
                <Plus className="h-12 w-12 mb-2 animate-bounce" />
                <p className="text-sm font-bold">Drop it here!</p>
              </motion.div>
            ) : (
              <motion.div 
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center"
              >
                <div className="p-4 rounded-2xl bg-white shadow-md mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                  <FileUp className="h-8 w-8 text-indigo-600" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Click or drag & drop to upload
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">PDF, DOCX, XLSX up to 10MB</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Subtle background glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* File List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
            Uploaded Documents
          </h4>
          
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-14 bg-slate-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 border border-slate-100 rounded-xl bg-slate-50/20">
              <FileIcon className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-xs font-medium">No documents uploaded yet</p>
            </div>
          ) : (
            <div className="grid gap-2">
              <AnimatePresence initial={false}>
                {files.map((doc, idx) => {
                  const filename = doc.page_title || doc.source_url.replace('file://', '')
                  return (
                    <motion.div
                      key={doc.source_url}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-indigo-50 transition-colors">
                          {getFileIcon(filename)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate pr-4">
                            {filename}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-medium text-slate-400">
                              {doc.word_count || 0} words
                            </span>
                            <span className="text-[10px] text-slate-300">•</span>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase tracking-tighter">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Indexed
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        onClick={() => toast.info('Delete functionality coming soon!')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
