import { useRef, useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useOutletContext } from 'react-router-dom'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Bot, Send, User, Loader2, Settings2, Wrench, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { Header } from '@/components/Header'
import { useSettings } from '@/hooks/useSettings'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { AIProviderDialog } from '@/components/settings/AIProviderDialog'

interface OutletContext {
  sidebarTrigger: React.ReactNode
}

const TOOL_LABELS: Record<string, { en: string; es: string; pt: string }> = {
  listNotes: { en: 'Listed notes', es: 'Notas listadas', pt: 'Notas listadas' },
  searchNotes: { en: 'Searched notes', es: 'Notas buscadas', pt: 'Notas buscadas' },
  createNote: { en: 'Created note', es: 'Nota creada', pt: 'Nota criada' },
  updateNote: { en: 'Updated note', es: 'Nota actualizada', pt: 'Nota atualizada' },
  deleteNote: { en: 'Deleted note', es: 'Nota eliminada', pt: 'Nota excluída' },
  completeNote: { en: 'Toggled completion', es: 'Completado cambiado', pt: 'Conclusão alternada' },
  listProjects: { en: 'Listed projects', es: 'Proyectos listados', pt: 'Projetos listados' },
  listLabels: { en: 'Listed labels', es: 'Etiquetas listadas', pt: 'Etiquetas listadas' },
}

/** Extract tool name from a part type like "tool-listNotes" or from toolName on dynamic parts */
function getToolInfo(part: { type: string; [key: string]: unknown }) {
  if (part.type === 'dynamic-tool') {
    return {
      toolName: part.toolName as string,
      toolCallId: part.toolCallId as string,
      state: part.state as string,
      input: part.input,
      output: part.output,
    }
  }
  // Static tool parts have type "tool-<name>"
  if (part.type.startsWith('tool-')) {
    return {
      toolName: part.type.slice(5),
      toolCallId: part.toolCallId as string,
      state: part.state as string,
      input: part.input,
      output: part.output,
    }
  }
  return null
}

export function Chat() {
  const { t, i18n } = useTranslation()
  const { sidebarTrigger } = useOutletContext<OutletContext>()
  const { settings } = useSettings()
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
  const [input, setInput] = useState('')

  const isConfigured = !!settings.aiProvider?.apiKey

  // Keep a ref to settings so the transport body function always reads the latest values
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const transport = useMemo(() => new DefaultChatTransport({
    api: `${import.meta.env.VITE_API_URL || ''}/api/chat`,
    fetch: async (url: string | URL | Request, init?: RequestInit) => {
      const { data: { session: freshSession } } = await supabase!.auth.getSession()
      return fetch(url, {
        ...init,
        headers: {
          ...(init?.headers as Record<string, string>),
          'Authorization': `Bearer ${freshSession?.access_token}`,
        },
      })
    },
    body: () => ({
      provider: settingsRef.current.aiProvider?.provider,
      apiKey: settingsRef.current.aiProvider?.apiKey,
      model: settingsRef.current.aiProvider?.model,
    }),
  }), [])

  const { messages, sendMessage, status, error, regenerate, setMessages } = useChat({
    transport,
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(e)
    }
  }

  const toggleToolExpanded = (id: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const lang = i18n.language === 'es' ? 'es' : i18n.language === 'pt' ? 'pt' : 'en'

  if (!isConfigured) {
    return (
      <>
        <Header>{sidebarTrigger}</Header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <Bot className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-center">
            {t('chat.configureAI')}
          </p>
          <Button onClick={() => setAiDialogOpen(true)} variant="outline">
            <Settings2 className="mr-2 h-4 w-4" />
            {t('chat.configure')}
          </Button>
          <AIProviderDialog open={aiDialogOpen} onOpenChange={setAiDialogOpen} />
        </div>
      </>
    )
  }

  return (
    <>
      <Header>
        {sidebarTrigger}
        <div className="flex items-center gap-2 flex-1">
          <Bot className="h-5 w-5" />
          <h1 className="text-base font-medium">{t('chat.title')}</h1>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMessages([])}
              title={t('chat.newConversation')}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAiDialogOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </Header>

      <div className="flex flex-1 flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-20">
              <Bot className="h-10 w-10" />
              <p className="text-sm">{t('chat.empty')}</p>
            </div>
          )}

          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((message) => {
              // Collect text from text parts
              const textContent = message.parts
                .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                .map(p => p.text)
                .join('')

              // Collect tool invocation parts
              const toolParts = message.parts
                .map(p => getToolInfo(p as { type: string; [key: string]: unknown }))
                .filter((info): info is NonNullable<typeof info> => info !== null)

              return (
                <div key={message.id}>
                  {/* Text content */}
                  {textContent && (
                    <div className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {message.role === 'assistant' && (
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`rounded-lg px-3 py-2 max-w-[85%] text-sm whitespace-pre-wrap ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {textContent}
                      </div>
                      {message.role === 'user' && (
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center mt-0.5">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tool invocations */}
                  {toolParts.map((tool) => {
                    const isExpanded = expandedTools.has(tool.toolCallId)
                    const label = TOOL_LABELS[tool.toolName]?.[lang] || tool.toolName
                    const isDone = tool.state === 'output-available' || tool.state === 'output-error'

                    return (
                      <div key={tool.toolCallId} className="flex gap-3 justify-start my-2">
                        <div className="flex-shrink-0 w-7 h-7" />
                        <button
                          onClick={() => toggleToolExpanded(tool.toolCallId)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Wrench className="h-3 w-3" />
                          <Badge variant="secondary" className="text-xs font-normal">
                            {label}
                          </Badge>
                          {isDone ? (
                            isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                          ) : (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="flex flex-col gap-1 max-w-[70%]">
                            {!!tool.input && (
                              <pre className="text-xs bg-blue-500/10 rounded p-2 overflow-auto max-h-32 border border-blue-500/20">
                                <span className="text-blue-600 dark:text-blue-400 font-medium">Input: </span>
                                {JSON.stringify(tool.input, null, 2)}
                              </pre>
                            )}
                            {tool.state === 'output-available' && (
                              <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto max-h-40 border">
                                <span className="text-green-600 dark:text-green-400 font-medium">Output: </span>
                                {JSON.stringify(tool.output, null, 2)}
                              </pre>
                            )}
                            {tool.state === 'output-error' && (
                              <pre className="text-xs bg-destructive/10 rounded p-2 overflow-auto max-h-40 border border-destructive/20 text-destructive">
                                Error
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {error && (
          <div className="px-4 py-2 text-sm text-destructive bg-destructive/10 border-t">
            {error.message}
            <Button variant="link" size="sm" onClick={() => regenerate()} className="ml-2 text-destructive">
              {t('chat.retry')}
            </Button>
          </div>
        )}

        <div className="border-t p-4">
          <form onSubmit={onSubmit} className="max-w-2xl mx-auto flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.placeholder')}
              className="resize-none min-h-[40px] max-h-[160px]"
              rows={1}
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="shrink-0 self-end"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </div>

      <AIProviderDialog open={aiDialogOpen} onOpenChange={setAiDialogOpen} />
    </>
  )
}
