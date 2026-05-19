import { useState, useEffect } from 'react'
import axios from 'axios'
import { useStore } from './store'
import TeacherDashboard from './components/TeacherDashboard'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8011'
import GapSidebar from './components/GapSidebar'
import ChatArea from './components/ChatArea'
import Scene from './components/Scene'
import LandingScene from './components/LandingScene'
import CursorGlow from './components/CursorGlow'
import QuizMode from './components/QuizMode'
import { motion, AnimatePresence } from 'framer-motion'

function SetupScreen({ onStart }: { onStart: () => void }) {
  const { setStudent, setLanguage, setSessionId } = useStore()
  const [name, setName] = useState('')
  const [cls, setCls] = useState('7')
  const [subject, setSubject] = useState('Mathematics')
  const [language, setLang] = useState('English')

  const LANGUAGES = [
    // Indian
    'English', 'Hindi', 'Bengali', 'Telugu', 'Marathi',
    'Tamil', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi',
    'Odia', 'Urdu',
    // Foreign
    'Spanish', 'French', 'German', 'Arabic', 'Portuguese',
    'Russian', 'Japanese', 'Korean', 'Chinese (Simplified)', 'Italian',
    'Turkish', 'Dutch', 'Polish', 'Swedish', 'Indonesian'
  ]

  const SUBJECTS = ['Mathematics', 'Science', 'English', 'Social Science', 'Hindi']

  const EXAMPLE_QUESTIONS: Record<string, string[]> = {
    Mathematics: ['How do I solve 2x + 5 = 11?', 'What is a fraction?', 'How do I find the area of a triangle?'],
    Science: ['What is photosynthesis?', 'How does the water cycle work?', 'What are Newton\'s laws?'],
    English: ['What is a noun?', 'How do I write a paragraph?', 'What is the difference between simile and metaphor?'],
    'Social Science': ['What caused World War 1?', 'What is democracy?', 'How are maps made?'],
    Hindi: ['संज्ञा क्या होती है?', 'क्रिया और विशेषण में क्या अंतर है?', 'मुहावरे क्या होते हैं?'],
  }

  const handleStart = async (prefill?: string) => {
    const studentName = name || 'Student'
    setStudent(studentName, +cls, subject)
    setLanguage(language)
    if (prefill) {
      useStore.getState().addMessage({ role: 'student', content: prefill })
    }
    // Start chatbox immediately — don't wait for session/create
    onStart()
    // Create session in background (non-blocking)
    axios.post(`${API}/session/create`, {
      student_name: studentName,
      student_class: +cls,
      subject,
      language,
    }).then(({ data }) => {
      if (data?.session_id) setSessionId(data.session_id)
    }).catch(e => {
      console.warn('[CuriOS] session/create failed, using local id', e)
    })
  }

  return (
    <>
      {/* Teacher Portal - top left */}
      <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 2 }}>
        <button 
          onClick={() => {
            window.history.pushState({}, '', '/teacher');
            window.dispatchEvent(new Event('popstate'));
          }}
          style={{
            background: 'rgba(11, 12, 15, 0.6)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            borderRadius: '8px',
            padding: '6px 12px',
            color: '#22d3ee',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 0 10px rgba(6, 182, 212, 0.2)',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(6, 182, 212, 0.1)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(11, 12, 15, 0.6)';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(6, 182, 212, 0.2)';
          }}
        >
          <span>👥</span> Teacher Portal
        </button>
      </div>

      {/* Language picker - top right */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 2 }}>
        <select value={language} onChange={e => setLang(e.target.value)}
          style={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', padding: '6px 10px', color: '#9ca3af', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50, scale: 0.95 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass-panel" 
        style={{ 
          borderRadius: '24px', padding: '40px', width: '100%', maxWidth: '420px', 
          zIndex: 1, backdropFilter: 'blur(20px)', backgroundColor: 'rgba(17, 24, 39, 0.4)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</div>
          <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 'bold' }}>CuriOS</h1>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>AI Learning Gap Detector</p>
          <p style={{ color: '#6b7280', fontSize: '12px' }}>NCERT Class 5–10</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input className="glass-input" value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
            placeholder="Your name"
            style={{ borderRadius: '12px', padding: '12px 16px', width: '100%', boxSizing: 'border-box' }}
          />
          <select value={cls} onChange={e => setCls(e.target.value)}
            style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '14px', outline: 'none', width: '100%' }}>
            {[5,6,7,8,9,10].map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
          <select value={subject} onChange={e => setSubject(e.target.value)}
            style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '14px', outline: 'none', width: '100%' }}>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div style={{ marginTop: '4px' }}>
            <p style={{ color: '#6b7280', fontSize: '12px', marginBottom: '8px' }}>Try an example question:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {EXAMPLE_QUESTIONS[subject].map(q => (
                <button key={q} onClick={() => handleStart(q)}
                  style={{ 
                    background: 'rgba(31, 41, 55, 0.4)', border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '10px', padding: '8px 12px', color: '#d1d5db', fontSize: '12px', 
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease',
                    backdropFilter: 'blur(5px)'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.6)'; e.currentTarget.style.background = 'rgba(31, 41, 55, 0.8)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.background = 'rgba(31, 41, 55, 0.4)'; }}
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => handleStart()}
            style={{ 
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', 
              color: 'black', fontWeight: 'bold', padding: '14px', borderRadius: '12px', 
              border: 'none', cursor: 'pointer', fontSize: '15px', marginTop: '8px',
              boxShadow: '0 4px 15px rgba(34, 197, 94, 0.4)', transition: 'transform 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            Start Learning →
          </button>
        </div>
        <p style={{ color: '#4b5563', fontSize: '11px', textAlign: 'center', marginTop: '16px' }}>
          Powered by Gemini AI • Free for students
        </p>
      </motion.div>
    </>
  )
}

function ScanningScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 50, background: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(12px)' }}
    >
      <motion.div 
        animate={{ rotate: 360 }} 
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        style={{ fontSize: '64px', marginBottom: '20px' }}
      >
        ⚛️
      </motion.div>
      <motion.h2 
        animate={{ opacity: [0.5, 1, 0.5] }} 
        transition={{ repeat: Infinity, duration: 1.5 }}
        style={{ color: '#38bdf8', fontSize: '24px', fontWeight: 'bold', letterSpacing: '1px' }}
      >
        Scanning AI Learning Patterns...
      </motion.h2>
    </motion.div>
  )
}

export default function App() {
  const [appState, setAppState] = useState<'setup' | 'scanning' | 'main'>('setup')
  const { isQuizActive } = useStore()
  
  const [currentPath, setCurrentPath] = useState(window.location.pathname)

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname)
    }
    window.addEventListener('popstate', handleLocationChange)
    return () => window.removeEventListener('popstate', handleLocationChange)
  }, [])

  const handleStart = () => {
    setAppState('scanning')
    setTimeout(() => setAppState('main'), 2500)
  }

  if (currentPath.startsWith('/teacher')) {
    return <TeacherDashboard />
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', cursor: 'none' }}>
      <CursorGlow />
      <AnimatePresence mode="wait">
        {appState === 'setup' && (
          <motion.div key="setup" exit={{ opacity: 0 }} transition={{ duration: 0.5 }} style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <LandingScene />
            <SetupScreen onStart={handleStart} />
          </motion.div>
        )}

        {appState === 'scanning' && <ScanningScreen key="scanning" />}

        {appState === 'main' && (
          <motion.div 
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            style={{ width: '100%', height: '100%' }}
          >
            <Scene />
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'flex', justifyContent: 'space-between', zIndex: 10 }}>
              <motion.div 
                initial={{ x: -300, opacity: 0 }} 
                animate={{ x: 0, opacity: 1 }} 
                transition={{ type: 'spring', damping: 20, delay: 0.2 }} 
                style={{ width: '300px', height: '100%', padding: '16px', pointerEvents: 'auto' }}
              >
                <GapSidebar />
              </motion.div>
              <motion.div 
                initial={{ x: 420, opacity: 0 }} 
                animate={{ x: 0, opacity: 1 }} 
                transition={{ type: 'spring', damping: 20, delay: 0.4 }} 
                style={{ width: '420px', height: '100%', padding: '16px', pointerEvents: 'auto' }}
              >
                <ChatArea />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isQuizActive && <QuizMode />}
      </AnimatePresence>
    </div>
  )
}
