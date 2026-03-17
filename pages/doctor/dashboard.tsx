import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'

type Screening = {
  id: string
  patient_name: string
  patient_age: number
  patient_gender: string
  mmse_score: number
  risk_level: 'LOW' | 'MODERATE' | 'HIGH'
  risk_score: number
  clock_score: number
  pentagon_score: number
  speech_score: number
  memory_recall: string
  ai_summary: string
  answers: Record<string, string>
  completed_at: string
}

const RISK_COLOR: Record<string, string> = {
  LOW: '#10b981', MODERATE: '#f59e0b', HIGH: '#ef4444'
}
const RISK_EMOJI: Record<string, string> = {
  LOW: '✅', MODERATE: '⚠️', HIGH: '🔴'
}

export default function Dashboard() {
  const router = useRouter()
  const [screenings, setScreenings] = useState<Screening[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Screening | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'LOW' | 'MODERATE' | 'HIGH'>('ALL')

  useEffect(() => {
    if (typeof window !== 'undefined' && !sessionStorage.getItem('doctor_auth')) {
      router.push('/doctor')
      return
    }
    loadScreenings()
  }, [])

  const loadScreenings = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('screenings')
      .select('*')
      .order('completed_at', { ascending: false })
    if (!error && data) setScreenings(data as Screening[])
    setLoading(false)
  }

  const logout = () => {
    sessionStorage.removeItem('doctor_auth')
    router.push('/doctor')
  }

  const filtered = screenings.filter(s => {
    const matchSearch = s.patient_name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'ALL' || s.risk_level === filter
    return matchSearch && matchFilter
  })

  const stats = {
    total: screenings.length,
    high: screenings.filter(s => s.risk_level === 'HIGH').length,
    moderate: screenings.filter(s => s.risk_level === 'MODERATE').length,
    low: screenings.filter(s => s.risk_level === 'LOW').length,
    avgMmse: screenings.length ? Math.round(screenings.reduce((a, s) => a + (s.mmse_score || 0), 0) / screenings.length) : 0,
  }

  return (
    <>
      <Head><title>Doctor Dashboard — NeuroScreen</title></Head>
      <div style={{ minHeight: '100vh', background: '#0d1117', color: '#e5e7eb' }}>

        {/* Header */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 28 }}>🧠</div>
          <div>
            <div className="font-lora text-xl text-white">NeuroScreen</div>
            <div className="text-xs text-gray-500 font-mono tracking-wide">DOCTOR DASHBOARD</div>
          </div>
          <div className="ml-auto flex gap-3 items-center">
            <button onClick={loadScreenings} style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)', color: '#6ee7b7', padding: '7px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 13 }}>↻ Refresh</button>
            <button onClick={logout} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af', padding: '7px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 13 }}>Log out</button>
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>

          {/* Stats cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              ['Total Patients', stats.total, '#e5e7eb'],
              ['High Risk', stats.high, '#ef4444'],
              ['Moderate', stats.moderate, '#f59e0b'],
              ['Low Risk', stats.low, '#10b981'],
              ['Avg MMSE', `${stats.avgMmse}/30`, '#818cf8'],
            ].map(([label, val, color]) => (
              <div key={String(label)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>{label}</div>
                <div className="font-lora text-3xl" style={{ color: String(color) }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Search + filter */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <input className="inp" style={{ flex: 1, minWidth: 200, fontSize: 14, padding: '10px 16px' }} placeholder="Search by patient name…" value={search} onChange={e => setSearch(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              {(['ALL', 'HIGH', 'MODERATE', 'LOW'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '8px 16px', borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'monospace',
                  background: filter === f ? (f === 'ALL' ? 'rgba(129,140,248,0.15)' : `${RISK_COLOR[f]}20`) : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${filter === f ? (f === 'ALL' ? 'rgba(129,140,248,0.4)' : `${RISK_COLOR[f]}50`) : 'rgba(255,255,255,0.08)'}`,
                  color: filter === f ? (f === 'ALL' ? '#818cf8' : RISK_COLOR[f]) : '#6b7280',
                }}>{f}</button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-16">
              <div className="dots"><span /><span /><span /></div>
              <p className="text-gray-500 text-sm mt-3">Loading patient records…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p className="text-gray-400">No patient records yet.</p>
              <p className="text-gray-600 text-sm mt-2">Results will appear here after patients complete the screening test.</p>
            </div>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 80px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                {['Patient', 'Age', 'Risk', 'MMSE', 'Clock', 'Speech', ''].map(h => (
                  <div key={h} style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280' }}>{h}</div>
                ))}
              </div>
              {filtered.map((s, i) => (
                <div key={s.id} onClick={() => setSelected(s)} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 80px',
                  padding: '14px 20px', cursor: 'pointer', transition: 'background 0.15s',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  background: selected?.id === s.id ? 'rgba(52,211,153,0.04)' : 'transparent',
                }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                   onMouseLeave={e => (e.currentTarget.style.background = selected?.id === s.id ? 'rgba(52,211,153,0.04)' : 'transparent')}>
                  <div>
                    <div className="text-sm text-white font-medium">{s.patient_name}</div>
                    <div className="text-xs text-gray-500">{s.patient_gender} · {new Date(s.completed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div className="text-sm text-gray-300">{s.patient_age} yrs</div>
                  <div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${RISK_COLOR[s.risk_level] || '#6b7280'}15`, border: `1px solid ${RISK_COLOR[s.risk_level] || '#6b7280'}30`, borderRadius: 7, padding: '3px 9px', fontSize: 11, color: RISK_COLOR[s.risk_level] || '#6b7280', fontFamily: 'monospace' }}>
                      {RISK_EMOJI[s.risk_level]} {s.risk_level}
                    </span>
                  </div>
                  <div className="text-sm text-gray-300">{s.mmse_score}<span className="text-gray-500">/30</span></div>
                  <div className="text-sm text-gray-300">{s.clock_score ?? '—'}<span className="text-gray-500">/5</span></div>
                  <div className="text-sm text-gray-300">{s.speech_score ?? '—'}<span className="text-gray-500">/5</span></div>
                  <div>
                    <button style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc', padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12 }}>View</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Drawer */}
        {selected && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
            <div style={{ flex: 1, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setSelected(null)} />
            <div style={{ width: '100%', maxWidth: 520, background: '#0f1623', borderLeft: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto', padding: '24px 24px 40px', animation: 'slideUp 0.3s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <h2 className="font-lora text-2xl text-white">{selected.patient_name}</h2>
                  <p className="text-gray-500 text-sm">Age {selected.patient_age} · {selected.patient_gender}</p>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', width: 36, height: 36, borderRadius: 9, cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>

              {/* Risk banner */}
              <div style={{ textAlign: 'center', padding: '20px', borderRadius: 16, background: `${RISK_COLOR[selected.risk_level]}0f`, border: `1px solid ${RISK_COLOR[selected.risk_level]}28`, marginBottom: 18 }}>
                <div style={{ fontSize: 36, marginBottom: 4 }}>{RISK_EMOJI[selected.risk_level]}</div>
                <div className="font-lora text-2xl mb-2" style={{ color: RISK_COLOR[selected.risk_level] }}>{selected.risk_level} RISK</div>
                <div className="text-xs font-mono text-gray-500">Composite score: {selected.risk_score?.toFixed(1)}</div>
              </div>

              {/* Score grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9, marginBottom: 18 }}>
                {[['MMSE', `${selected.mmse_score}/30`], ['Clock', `${selected.clock_score ?? '—'}/5`], ['Speech', `${selected.speech_score ?? '—'}/5`], ['Pentagon', `${selected.pentagon_score ?? '—'}/2`]].map(([l, v]) => (
                  <div key={l} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 11, padding: '12px 10px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>{l}</div>
                    <div className="font-lora text-xl text-white">{v}</div>
                  </div>
                ))}
              </div>

              {/* Key answers */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 12 }}>KEY RESPONSES</div>
                {[
                  ['Memory Recall', selected.answers?.memory_recall || '—'],
                  ['Serial 7s', [selected.answers?.s7_1, selected.answers?.s7_2, selected.answers?.s7_3, selected.answers?.s7_4, selected.answers?.s7_5].join(', ')],
                  ['Story — Name', selected.answers?.sr_name || '—'],
                  ['Story — Day', selected.answers?.sr_day || '—'],
                  ['Family History', selected.answers?.family_history || '—'],
                  ['Memory Complaint', selected.answers?.memory_complaint || '—'],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className="text-xs text-gray-200 text-right max-w-48">{val}</span>
                  </div>
                ))}
              </div>

              {/* AI Summary */}
              {selected.ai_summary && (
                <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.16)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#818cf8', marginBottom: 10 }}>⚡ AI CLINICAL SUMMARY</div>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(229,231,235,0.82)', whiteSpace: 'pre-wrap' }}>{selected.ai_summary}</p>
                </div>
              )}

              <div className="text-xs text-gray-600 text-center">
                Completed: {new Date(selected.completed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export const getServerSideProps = async () => {
  return { props: {} }
}
