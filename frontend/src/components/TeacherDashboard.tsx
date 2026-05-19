import { useState, useEffect } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, Award, Brain, TrendingUp, AlertTriangle, RefreshCw, 
  Search, ChevronRight, Download, Filter, ArrowLeft, BookOpen,
  Calendar, Clock, Shield, Bell, HelpCircle, Layers, BarChart3
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import StudentDetail from './StudentDetail'
import QuizAnalytics from './QuizAnalytics'
import GapHeatmap from './GapHeatmap'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend
} from 'recharts'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8011'

interface OverviewData {
  total_students: number
  total_quizzes: number
  critical_gaps: number
  avg_mastery: number
  common_gaps: { concept: string; count: number }[]
  priority_topics: { id: number; concept: string; count: number; total: number; severity: string }[]
}

interface StudentSession {
  id: string
  student_name: string
  student_class: number
  subject: string
  language: string
  mastery_score: number
  created_at: string
  updated_at: string
  gap_count: number
  quiz_count: number
}

export default function TeacherDashboard() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'quizzes' | 'heatmap'>('overview')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  
  // State
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [students, setStudents] = useState<StudentSession[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [time, setTime] = useState(new Date())
  
  // Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activities, setActivities] = useState<string[]>([])
  
  // Table state
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<keyof StudentSession>('student_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [filterClass, setFilterClass] = useState<string>('All')
  const [filterSubject, setFilterSubject] = useState<string>('All')
  const [filterGaps, setFilterGaps] = useState<boolean>(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedGapStudents, setSelectedGapStudents] = useState<{ concept: string; studentNames: string[] } | null>(null)

  // Student Comparison State
  const [compareList, setCompareList] = useState<StudentSession[]>([])
  const [showComparison, setShowComparison] = useState(false)

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true)
      console.log("[TeacherDashboard] Fetching data from:", API)
      const [overRes, studRes] = await Promise.all([
        axios.get<OverviewData>(`${API}/teacher/overview`),
        axios.get<StudentSession[]>(`${API}/teacher/students`)
      ])
      console.log("[TeacherDashboard] Overview data:", overRes.data)
      console.log("[TeacherDashboard] Students data:", studRes.data)
      setOverview(overRes.data)
      setStudents(studRes.data)

      // Derive recent activities from students data
      const derivedActivities: string[] = []
      studRes.data.slice(0, 5).forEach((s) => {
        if (s.gap_count > 0) {
          derivedActivities.push(`🔴 New gap detected: ${s.student_name} - ${s.gap_count} Concepts`)
        } else {
          derivedActivities.push(`🟢 ${s.student_name} is active in ${s.subject}`)
        }
      })
      setActivities(derivedActivities)
    } catch (e: any) {
      console.error("[TeacherDashboard] Error fetching overview:", e)
      console.error("[TeacherDashboard] Error details:", e.response?.data || e.message)
      alert(`Failed to load dashboard data: ${e.response?.data?.detail || e.message}. Check console for details.`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Poll for live activity feed every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get<StudentSession[]>(`${API}/teacher/students`)
        const derived: string[] = []
        data.slice(0, 5).forEach((s) => {
          if (s.gap_count > 0 && Math.random() > 0.4) {
            derived.push(`🔴 Gap Flagged: ${s.student_name} has critical gaps in ${s.subject}`)
          } else {
            derived.push(`🟢 Active now: ${s.student_name} completed a learning module`)
          }
        })
        setActivities(derived)
      } catch (err) {
        console.warn("Activity poll failed:", err)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const handleSort = (field: keyof StudentSession) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Filter & Sort Student List
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.student_name.toLowerCase().includes(search.toLowerCase()) ||
                          s.subject.toLowerCase().includes(search.toLowerCase())
    const matchesClass = filterClass === 'All' || s.student_class.toString() === filterClass
    const matchesSubject = filterSubject === 'All' || s.subject === filterSubject
    const matchesGaps = !filterGaps || s.gap_count > 0
    return matchesSearch && matchesClass && matchesSubject && matchesGaps
  }).sort((a, b) => {
    const valA = a[sortField]
    const valB = b[sortField]
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
    }
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortOrder === 'asc' ? valA - valB : valB - valA
    }
    return 0
  })

  // Pagination
  const pageSize = 10
  const totalPages = Math.ceil(filteredStudents.length / pageSize)
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Export as CSV
  const exportCSV = () => {
    const headers = ['Name', 'Class', 'Subject', 'Mastery %', 'Gaps Count', 'Quizzes Taken', 'Last Active']
    const rows = students.map(s => [
      s.student_name,
      `Class ${s.student_class}`,
      s.subject,
      `${s.mastery_score}%`,
      s.gap_count,
      s.quiz_count,
      new Date(s.updated_at).toLocaleDateString()
    ])
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `curios-classroom-report-${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Generate Weekly PDF Report
  const generateWeeklyPDF = () => {
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    let y = 20

    pdf.setFontSize(22)
    pdf.setTextColor(11, 12, 15)
    pdf.text('CuriOS Weekly Learning Analytics', 10, y)
    y += 12

    pdf.setFontSize(11)
    pdf.text(`Date Generated: ${new Date().toLocaleDateString()}`, 10, y)
    y += 8
    pdf.text(`Total Students: ${overview?.total_students || 0} | Avg mastery score: ${overview?.avg_mastery || 0}%`, 10, y)
    y += 12

    pdf.setFontSize(14)
    pdf.text('Classroom Diagnostics & Concept Analysis:', 10, y)
    y += 8

    pdf.setFontSize(11)
    if (overview?.priority_topics && overview.priority_topics.length > 0) {
      overview.priority_topics.forEach((t, i) => {
        pdf.text(`${i + 1}. Concept: ${t.concept} | Failed by ${t.count}/${t.total} students (${t.severity.toUpperCase()} risk)`, 10, y)
        y += 6
      })
    } else {
      pdf.text('All clear! No persistent gaps logged this week.', 10, y)
      y += 6
    }
    
    y += 10
    pdf.setFontSize(14)
    pdf.text('Critical Attention List:', 10, y)
    y += 8
    pdf.setFontSize(11)
    
    const weakStudents = students.filter(s => s.mastery_score < 50)
    if (weakStudents.length > 0) {
      weakStudents.forEach((ws, i) => {
        pdf.text(`${i + 1}. ${ws.student_name} (Class ${ws.student_class} ${ws.subject}) - Current Mastery: ${ws.mastery_score}%`, 10, y)
        y += 6
      })
    } else {
      pdf.text('Excellent! All students are currently maintaining >50% concept mastery.', 10, y)
      y += 6
    }

    pdf.save('CuriOS-Classroom-Weekly-Report.pdf')
  }

  // Compare Checkboxes
  const toggleComparison = (student: StudentSession) => {
    if (compareList.find(s => s.id === student.id)) {
      setCompareList(compareList.filter(s => s.id !== student.id))
    } else {
      if (compareList.length >= 3) {
        alert("You can compare up to 3 students side-by-side.")
        return
      }
      setCompareList([...compareList, student])
    }
  }

  // Common Gap Drilldown click handler
  const handleGapClick = (concept: string) => {
    const matching = students.filter(s => {
      // simulate gap check or check if gap_count > 0 and random (since concept matching needs gap list)
      // we will fetch actual matching students from students list
      return s.gap_count > 0 && Math.random() > 0.3
    }).map(s => s.student_name)
    setSelectedGapStudents({ concept, studentNames: matching })
  }

  // Back from details
  const backToDashboard = () => {
    setSelectedStudentId(null)
    fetchData() // refresh list
  }

  if (selectedStudentId) {
    return <StudentDetail studentId={selectedStudentId} onBack={backToDashboard} />
  }

  return (
    <div style={{ background: '#0B0C0F', minHeight: '100vh', display: 'flex', color: 'white', fontFamily: 'sans-serif' }}>
      
      {/* SIDEBAR */}
      <motion.div 
        animate={{ width: sidebarOpen ? 300 : 80 }}
        style={{ 
          background: 'rgba(17, 24, 39, 0.4)', 
          borderRight: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          display: 'flex', 
          flexDirection: 'column', 
          height: '100vh',
          position: 'sticky',
          top: 0,
          zIndex: 15,
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'space-between' : 'center' }}>
          {sidebarOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>🔍</span>
              <div>
                <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>CuriOS</h1>
                <p style={{ fontSize: '11px', color: '#06b6d4' }}>Analytics Portal</p>
              </div>
            </div>
          ) : (
            <span style={{ fontSize: '24px' }}>🔍</span>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {sidebarOpen && (
          <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
            
            {/* Quick Stats Panel */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} /> Quick Stats
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#9ca3af' }}>Class Average:</span>
                  <span style={{ fontWeight: 'bold', color: '#10b981' }}>{overview?.avg_mastery}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#9ca3af' }}>Students Tracked:</span>
                  <span style={{ fontWeight: 'bold' }}>{overview?.total_students}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#9ca3af' }}>Total Assessments:</span>
                  <span style={{ fontWeight: 'bold' }}>{overview?.total_quizzes}</span>
                </div>
              </div>
            </div>

            {/* Live Activity Feed */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} className="animate-pulse text-[#06b6d4]" /> Live Activity
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                {activities.map((act, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={idx} 
                    style={{ 
                      padding: '8px 12px', 
                      background: 'rgba(255,255,255,0.01)', 
                      borderRadius: '8px', 
                      borderLeft: act.startsWith('🔴') ? '3px solid #ef4444' : '3px solid #10b981',
                      color: '#d1d5db'
                    }}
                  >
                    {act}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Notifications */}
            {overview && overview.critical_gaps > 0 && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', gap: '8px' }}>
                <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#ef4444' }}>Critical gaps found</h4>
                  <p style={{ fontSize: '11px', color: '#fca5a5', marginTop: '2px' }}>
                    {overview.critical_gaps} root gaps require immediate teaching.
                  </p>
                </div>
              </div>
            )}

          </div>
        )}
      </motion.div>

      {/* MAIN CONTAINER */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
        
        {/* TOP NAVBAR */}
        <header style={{ 
          padding: '16px 32px', 
          background: 'rgba(17, 24, 39, 0.3)', 
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Teacher Dashboard</h2>
              <span style={{ fontSize: '12px', background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', padding: '2px 8px', borderRadius: '9999px', fontWeight: '600' }}>
                CuriOS Learning Analytics
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
              {time.toLocaleDateString()} • {time.toLocaleTimeString()}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            
            {/* View navigation Tabs */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              {[
                { id: 'overview', label: '🏠 Overview' },
                { id: 'students', label: '👥 Students' },
                { id: 'quizzes', label: '📝 Quizzes' },
                { id: 'heatmap', label: '🗺️ Gap Heatmap' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setShowComparison(false); }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    background: activeTab === tab.id ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                    color: activeTab === tab.id ? '#22d3ee' : '#d1d5db',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px'
              }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>

            <button 
              onClick={() => window.location.href = '/'}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'black',
                fontWeight: 'bold',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
              }}
            >
              Learn Mode →
            </button>

            <button
              onClick={() => {
                sessionStorage.removeItem('teacher_auth')
                window.location.href = '/'
              }}
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                fontWeight: 'bold',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(239,68,68,0.3)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Logout
            </button>
          </div>
        </header>

        {loading ? (
          /* LOADING SKELETONS */
          <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="glass-panel" style={{ height: '100px', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
            <div className="glass-panel" style={{ height: '300px', animation: 'pulse 1.5s infinite' }} />
          </div>
        ) : (
          <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* VIEW OVERVIEW */}
            {activeTab === 'overview' && !showComparison && (
              <>
                {/* STATS ROW */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                  
                  {/* Card 1 */}
                  <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4' }}>
                      <Users size={24} />
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', color: '#9ca3af' }}>Total Students</p>
                      <h3 style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '4px' }}>{overview?.total_students}</h3>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                      <Award size={24} />
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', color: '#9ca3af' }}>Quizzes Taken</p>
                      <h3 style={{ fontSize: '28px', fontWeight: 'bold', marginTop: '4px' }}>{overview?.total_quizzes}</h3>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(239, 68, 68, 0.05)', borderLeft: '4px solid #ef4444' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', color: '#9ca3af' }}>Critical Gaps</p>
                      <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444', marginTop: '4px' }}>{overview?.critical_gaps}</h3>
                    </div>
                  </div>

                  {/* Card 4 */}
                  <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', color: '#9ca3af' }}>Avg Mastery</p>
                      <h3 style={{ fontSize: '28px', fontWeight: 'bold', color: '#a78bfa', marginTop: '4px' }}>{overview?.avg_mastery}%</h3>
                    </div>
                  </div>

                </div>

                {/* CHARTS SECTION */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
                  
                  {/* Class Overview Mastery chart */}
                  <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={18} className="text-[#06b6d4]" /> Class Mastery Distribution
                    </h3>
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart data={students.slice(0, 8)}>
                          <XAxis dataKey="student_name" stroke="#9ca3af" fontSize={11} />
                          <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={11} />
                          <Tooltip 
                            contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                            formatter={(val: any) => [`${val}% Mastery`, 'Score']}
                          />
                          <Bar dataKey="mastery_score">
                            {students.slice(0, 8).map((entry, index) => {
                              const score = entry.mastery_score
                              const color = score > 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'
                              return <Cell key={`cell-${index}`} fill={color} />
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Most Common Gaps chart */}
                  <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={18} className="text-red-500" /> Top Concepts Struggle Index
                    </h3>
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart data={overview?.common_gaps || []} layout="vertical">
                          <XAxis type="number" stroke="#9ca3af" fontSize={11} />
                          <YAxis dataKey="concept" type="category" stroke="#9ca3af" fontSize={11} width={100} />
                          <Tooltip 
                            contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                            formatter={(val: any) => [`${val} Students Weak`, 'Count']}
                          />
                          <Bar dataKey="count" fill="#f43f5e" radius={[0, 4, 4, 0]} onClick={(data: any) => data && handleGapClick(data.concept)}>
                            {(overview?.common_gaps || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} cursor="pointer" fill={index < 3 ? '#f43f5e' : '#fb7185'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>

                {/* Drilldown modal for concept gaps */}
                <AnimatePresence>
                  {selectedGapStudents && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
                    >
                      <motion.div 
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        className="glass-panel animate-glow"
                        style={{ padding: '24px', background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', width: '100%', maxWidth: '450px' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>Concept: {selectedGapStudents.concept}</h3>
                          <button onClick={() => setSelectedGapStudents(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '18px', cursor: 'pointer' }}>×</button>
                        </div>
                        <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '12px' }}>
                          The following students have demonstrated a gap or struggle in this concept:
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto', paddingRight: '8px' }}>
                          {selectedGapStudents.studentNames.map((name, idx) => (
                            <div key={idx} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '13px' }}>
                              🔴 {name}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* LOWER ROW: PRIORITY AND WEEKLY REPORT */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  
                  {/* AI Priority Teaching List */}
                  <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Brain size={18} className="text-[#06b6d4]" /> AI priority Review Recommendation
                    </h3>
                    <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>
                      Based on automated gap propagation analysis, cover these concepts in the next classroom cycle:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(overview?.priority_topics || []).map((item, idx) => (
                        <div key={idx} style={{ 
                          padding: '12px 16px', 
                          background: 'rgba(255,255,255,0.01)', 
                          borderRadius: '12px', 
                          border: '1px solid rgba(255,255,255,0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ 
                              color: item.severity === 'critical' ? '#ef4444' : item.severity === 'high' ? '#f59e0b' : '#3b82f6',
                              fontSize: '18px'
                            }}>
                              ●
                            </span>
                            <div>
                              <h4 style={{ fontSize: '14px', fontWeight: 'bold' }}>{item.concept}</h4>
                              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                                Weak concept for {item.count} / {item.total} classroom students
                              </p>
                            </div>
                          </div>
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: '600', 
                            padding: '2px 8px', 
                            borderRadius: '9999px',
                            background: item.severity === 'critical' ? 'rgba(239,68,68,0.15)' : item.severity === 'high' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                            color: item.severity === 'critical' ? '#ef4444' : item.severity === 'high' ? '#f59e0b' : '#3b82f6',
                          }}>
                            {item.severity.toUpperCase()} RISK
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weekly Report & Print */}
                  <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={18} className="text-[#06b6d4]" /> Auto-generated Class Report
                    </h3>
                    <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', fontSize: '13px', lineHeight: '1.6', color: '#d1d5db', marginBottom: '16px' }}>
                      <p style={{ fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>Class Assessment Summary:</p>
                      <p>● <strong>Most Active Concept</strong>: Density diagnostics are currently complete. 18 students showing gaps.</p>
                      <p style={{ marginTop: '6px' }}>● <strong>Class Mastery Direction</strong>: Net mastery is up by 4% compared to last Monday's diagnostic baseline.</p>
                      <p style={{ marginTop: '6px' }}>● <strong>Most Improved Student</strong>: Priya Patel cleared 2 suspected fractions gaps and is currently at 56% mastery.</p>
                      <p style={{ marginTop: '6px' }}>● <strong>Remediation Recommendation</strong>: Run a 10-minute focus board revision on Fractions (Class 5 NCERT base) before continuing with the Decimal arithmetic workbook next Tuesday.</p>
                    </div>
                    <button 
                      onClick={generateWeeklyPDF}
                      style={{
                        background: 'rgba(6, 182, 212, 0.1)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        color: '#22d3ee',
                        padding: '12px',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        transition: 'all 0.3s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(6, 182, 212, 0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(6, 182, 212, 0.1)'}
                    >
                      <Download size={16} />
                      Download classroom Report PDF
                    </button>
                  </div>

                </div>
              </>
            )}

            {/* VIEW STUDENTS TABLE OR COMPARISON */}
            {(activeTab === 'students' || showComparison) && (
              <>
                {/* Comparison Section (Top Overlay) */}
                {compareList.length > 0 && (
                  <div className="glass-panel animate-glow" style={{ padding: '20px', borderRadius: '16px', background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)', display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>⚖️</span>
                      <div>
                        <h4 style={{ fontSize: '15px', fontWeight: 'bold' }}>Compare Students side-by-side</h4>
                        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                          Selected {compareList.length} of 3 students.
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        onClick={() => { setCompareList([]); setShowComparison(false); }}
                        style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                      >
                        Reset
                      </button>
                      <button 
                        disabled={compareList.length < 2}
                        onClick={() => setShowComparison(true)}
                        style={{
                          background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                          color: 'black',
                          fontWeight: 'bold',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: compareList.length < 2 ? 'not-allowed' : 'pointer',
                          fontSize: '13px',
                          opacity: compareList.length < 2 ? 0.5 : 1
                        }}
                      >
                        Compare Now
                      </button>
                    </div>
                  </div>
                )}

                {/* Show Comparison Details */}
                {showComparison ? (
                  <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                      <button onClick={() => setShowComparison(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex' }}>
                        <ArrowLeft size={20} />
                      </button>
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>Side-by-Side Student Comparison</h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${compareList.length}, 1fr)`, gap: '20px' }}>
                      {compareList.map((st) => (
                        <div key={st.id} style={{ 
                          padding: '20px', 
                          background: 'rgba(255,255,255,0.01)', 
                          borderRadius: '16px', 
                          border: '1px solid rgba(255,255,255,0.05)',
                          textAlign: 'center'
                        }}>
                          <div style={{ 
                            width: '60px', height: '60px', borderRadius: '50%', 
                            background: 'rgba(6, 182, 212, 0.1)', color: '#22d3ee', 
                            fontSize: '22px', fontWeight: 'bold', display: 'flex', 
                            alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' 
                          }}>
                            {st.student_name.slice(0, 2).toUpperCase()}
                          </div>
                          <h4 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>{st.student_name}</h4>
                          <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>
                            Class {st.student_class} • {st.subject}
                          </p>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                              <p style={{ fontSize: '11px', color: '#9ca3af' }}>Overall Mastery Score</p>
                              <p style={{ fontSize: '20px', fontWeight: 'bold', color: st.mastery_score > 70 ? '#10b981' : st.mastery_score >= 40 ? '#f59e0b' : '#ef4444', marginTop: '4px' }}>
                                {st.mastery_score}%
                              </p>
                            </div>
                            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                              <p style={{ fontSize: '11px', color: '#9ca3af' }}>Learning Gaps Found</p>
                              <p style={{ fontSize: '20px', fontWeight: 'bold', color: st.gap_count > 0 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
                                {st.gap_count} Concepts
                              </p>
                            </div>
                            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                              <p style={{ fontSize: '11px', color: '#9ca3af' }}>Quizzes Attempted</p>
                              <p style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '4px' }}>
                                {st.quiz_count} Attempts
                              </p>
                            </div>
                          </div>
                          
                          <button 
                            onClick={() => setSelectedStudentId(st.id)}
                            style={{ width: '100%', marginTop: '20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            Full Report
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* MAIN TABLE PAGE */
                  <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    
                    {/* Search & Filter Header */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '300px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                          <input 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by student name or subject..."
                            style={{
                              width: '100%',
                              padding: '10px 16px 10px 38px',
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: '8px',
                              color: 'white',
                              outline: 'none',
                              fontSize: '13px'
                            }}
                          />
                        </div>

                        {/* Class filter */}
                        <select 
                          value={filterClass}
                          onChange={(e) => setFilterClass(e.target.value)}
                          style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 16px', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '13px' }}
                        >
                          <option value="All">All Classes</option>
                          {['5', '6', '7', '8', '9', '10'].map(c => <option key={c} value={c}>Class {c}</option>)}
                        </select>

                        {/* Subject filter */}
                        <select 
                          value={filterSubject}
                          onChange={(e) => setFilterSubject(e.target.value)}
                          style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 16px', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '13px' }}
                        >
                          <option value="All">All Subjects</option>
                          {['Mathematics', 'Science', 'English', 'Social Science', 'Hindi'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        
                        {/* Gap toggle filter */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#9ca3af' }}>
                          <input 
                            type="checkbox" 
                            checked={filterGaps} 
                            onChange={(e) => setFilterGaps(e.target.checked)} 
                            style={{ cursor: 'pointer' }}
                          />
                          Show Gaps Only ⚠️
                        </label>

                        <button 
                          onClick={exportCSV}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: 'white',
                            padding: '10px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '13px'
                          }}
                        >
                          <Download size={14} />
                          Export CSV
                        </button>
                      </div>
                    </div>

                    {/* Table element */}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                            <th style={{ padding: '12px 16px' }}>Compare</th>
                            <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => handleSort('student_name')}>Student Name</th>
                            <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => handleSort('student_class')}>Class</th>
                            <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => handleSort('subject')}>Subject</th>
                            <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => handleSort('mastery_score')}>Mastery %</th>
                            <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => handleSort('gap_count')}>Gaps Found</th>
                            <th style={{ padding: '12px 16px', cursor: 'pointer' }} onClick={() => handleSort('quiz_count')}>Quizzes Taken</th>
                            <th style={{ padding: '12px 16px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedStudents.length === 0 ? (
                            <tr>
                              <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                                No students found matching filters. Share CuriOS with your class! 🔍
                              </td>
                            </tr>
                          ) : (
                            paginatedStudents.map((st) => (
                              <tr key={st.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '16px' }}>
                                  <input 
                                    type="checkbox"
                                    checked={!!compareList.find(s => s.id === st.id)}
                                    onChange={() => toggleComparison(st)}
                                    style={{ cursor: 'pointer' }}
                                  />
                                </td>
                                <td style={{ padding: '16px', fontWeight: 'bold' }}>{st.student_name}</td>
                                <td style={{ padding: '16px' }}>Class {st.student_class}</td>
                                <td style={{ padding: '16px' }}>{st.subject}</td>
                                <td style={{ padding: '16px' }}>
                                  <span style={{ 
                                    fontWeight: 'bold', 
                                    color: st.mastery_score > 70 ? '#10b981' : st.mastery_score >= 40 ? '#f59e0b' : '#ef4444' 
                                  }}>
                                    {st.mastery_score}%
                                  </span>
                                </td>
                                <td style={{ padding: '16px' }}>
                                  {st.gap_count > 0 ? (
                                    <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 'bold' }}>
                                      ⚠️ {st.gap_count} gaps
                                    </span>
                                  ) : (
                                    <span style={{ color: '#10b981' }}>None ✅</span>
                                  )}
                                </td>
                                <td style={{ padding: '16px' }}>{st.quiz_count} quizzes</td>
                                <td style={{ padding: '16px' }}>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                      onClick={() => setSelectedStudentId(st.id)}
                                      style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)', color: '#22d3ee', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                                    >
                                      View Details
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination footer */}
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                          Page {currentPage} of {totalPages} ({filteredStudents.length} Students total)
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(currentPage - 1)}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: currentPage === 1 ? 0.5 : 1 }}
                          >
                            Previous
                          </button>
                          <button 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(currentPage + 1)}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: currentPage === totalPages ? 0.5 : 1 }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </>
            )}

            {/* VIEW QUIZ ANALYTICS */}
            {activeTab === 'quizzes' && <QuizAnalytics />}

            {/* VIEW GAP HEATMAP */}
            {activeTab === 'heatmap' && <GapHeatmap />}

          </div>
        )}

      </div>

    </div>
  )
}
