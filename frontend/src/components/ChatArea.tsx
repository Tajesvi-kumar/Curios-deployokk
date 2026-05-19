import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { useStore } from '../store'
import { Volume2 } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8011'

function TypewriterMessage({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState('')
  
  useEffect(() => {
    let index = 0
    setDisplayedText('') // reset
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText((prev) => prev + text.charAt(index))
        index++
      } else {
        clearInterval(interval)
      }
    }, 15) // Speed of typing
    
    return () => clearInterval(interval)
  }, [text])

  return <span>{displayedText}</span>
}

export default function ChatArea() {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const { sessionId, studentName, studentClass, language, messages, isLoading,
          addMessage, setLoading, updateFromResponse } = useStore()

  const hasSentInitial = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const formatChatError = (error: any) => {
    const detail = error?.response?.data?.detail || error?.message || ''
    if (detail.includes('429') || detail.includes('quota') || detail.includes('RESOURCE_EXHAUSTED')) {
      return '⚠️ API quota exceeded. The AI service has hit its daily limit. Please try again later or contact support.'
    }
    if (detail) {
      return `Error: ${detail}`
    }
    return 'Sorry, something went wrong. Try again!'
  }

  // Auto-send if an example question was prefilled before entering chat
  useEffect(() => {
    if (!hasSentInitial.current && messages.length === 1 && messages[0].role === 'student') {
      hasSentInitial.current = true
      const text = messages[0].content
      setLoading(true)
      axios.post(`${API}/chat`, {
        session_id: sessionId,
        student_name: studentName,
        student_class: studentClass,
        language: language,
        message: text,
      }).then(({ data }) => {
        addMessage({ role: 'curios', content: data.message })
        updateFromResponse(data)
      }).catch((err) => {
        addMessage({ role: 'curios', content: formatChatError(err) })
      }).finally(() => setLoading(false))
    }
  }, [])

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || isLoading) return
    setInput('')
    addMessage({ role: 'student', content: text })
    setLoading(true)
    try {
      console.log('Sending to:', `${API}/chat`)
      console.log('Payload:', { session_id: sessionId, student_name: studentName, student_class: studentClass, message: text })
      const { data } = await axios.post(`${API}/chat`, {
        session_id: sessionId,
        student_name: studentName,
        student_class: studentClass,
        language: language,
        message: text,
      })
      console.log('API Response:', data)
      console.log('Gaps:', data.gaps)
      console.log('Root gaps:', data.root_gaps)
      
      addMessage({ role: 'curios', content: data.message })
      updateFromResponse(data)
    } catch (error: any) {
      console.error('Error:', error)
      addMessage({ role: 'curios', content: formatChatError(error) })
    } finally {
      setLoading(false)
    }
  }

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel() // Stop currently playing
      const utterance = new SpeechSynthesisUtterance(text)
      window.speechSynthesis.speak(utterance)
    }
  }

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: '24px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🔍</span>
          <div>
            <h1 style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>CuriOS Gap Detector</h1>
            <p style={{ color: '#9ca3af', fontSize: '11px' }}>AI Learning Diagnostics • NCERT Class 5–10</p>
          </div>
        </div>
        <button 
          onClick={() => useStore.getState().setQuizActive(true)}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
          }}
        >
          <span style={{ fontSize: '14px' }}>📝</span> Quiz Mode
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: '60px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <h2 style={{ color: 'white', fontWeight: 'bold', fontSize: '20px', marginBottom: '8px' }}>
              Namaste, {studentName}!
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>Tell me a topic you're confused about</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '16px' }}>
              {['Why does hot air rise?', 'What is density?', 'Explain convection'].map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{
                  fontSize: '12px', background: '#1f2937', color: '#d1d5db',
                  border: '1px solid #374151', borderRadius: '9999px',
                  padding: '6px 12px', cursor: 'pointer'
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'student' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'curios' && (
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: '#052e16', border: '1px solid #22c55e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', marginRight: '8px', marginTop: '4px', flexShrink: 0
              }}>🔍</div>
            )}
            <div style={{
              maxWidth: '360px', padding: '10px 14px', borderRadius: '18px',
              fontSize: '14px', lineHeight: '1.5',
              background: msg.role === 'student' ? 'rgba(22, 163, 74, 0.5)' : 'rgba(31, 41, 55, 0.5)',
              backdropFilter: 'blur(10px)',
              color: 'white',
              border: msg.role === 'curios' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(34, 197, 94, 0.2)',
              borderBottomRightRadius: msg.role === 'student' ? '4px' : '18px',
              borderBottomLeftRadius: msg.role === 'curios' ? '4px' : '18px',
            }}>
              {msg.role === 'curios' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <p style={{ fontSize: '11px', color: '#4ade80', fontWeight: '600' }}>CuriOS 🔍</p>
                  <button onClick={() => speak(msg.content)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex' }} title="Read aloud">
                    <Volume2 size={14} />
                  </button>
                </div>
              )}
              {msg.role === 'curios' ? <TypewriterMessage text={msg.content} /> : msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: '#052e16', border: '1px solid #22c55e',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px'
            }}>🔍</div>
            <div style={{ background: 'rgba(31, 41, 55, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 14px', borderRadius: '18px', borderBottomLeftRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: '500' }}>Analyzing NCERT patterns...</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[0, 150, 300].map(delay => (
                    <div key={delay} style={{
                      width: '5px', height: '5px', borderRadius: '50%', background: '#38bdf8',
                      animation: 'bounce 1s infinite', animationDelay: `${delay}ms`
                    }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '8px' }}>
          <input
            className="glass-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
            placeholder="Type your question or answer..."
            style={{
              flex: 1, borderRadius: '12px', padding: '10px 16px', boxSizing: 'border-box'
            }}
          />
        <button onClick={() => sendMessage()} disabled={isLoading || !input.trim()} style={{
          background: '#22c55e', color: 'black', fontWeight: 'bold',
          padding: '10px 20px', borderRadius: '12px', border: 'none',
          cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1,
          fontSize: '16px'
        }}>→</button>
      </div>
    </div>
  )
}