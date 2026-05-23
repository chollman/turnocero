import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { API } from '../../api/endpoints'
import UserRef from '../../components/shared/UserRef'
import AdminPanel from './components/AdminPanel'
import RegistrationsList from './components/RegistrationsList'
import ParticipantsList from './components/ParticipantsList'
import RegisterButton from './components/RegisterButton'
import LeagueStandings from './components/LeagueStandings'
import LeagueRoundsList from './components/LeagueRoundsList'
import Bracket from './components/Bracket'
import RecordResultModal from './components/RecordResultModal'
import SeedReorderModal from './components/SeedReorderModal'
import AddParticipantModal from './components/AddParticipantModal'
import GroupsView from './components/GroupsView'
import styles from './TorneoDetail.module.css'

const STATUS_META = {
  draft:        { label: 'Borrador',         className: 'chipDraft' },
  registration: { label: 'Inscripción abierta', className: 'chipRegistration' },
  in_progress:  { label: 'En curso',         className: 'chipInProgress' },
  finished:     { label: 'Finalizado',       className: 'chipFinished' },
}

const FORMAT_LABEL = {
  league:      { label: 'Liga (todos contra todos)', icon: '🔁' },
  single_elim: { label: 'Eliminación simple',         icon: '🏆' },
  groups:      { label: 'Grupos multi-fase',           icon: '🧩' },
}

const TABS_BY_FORMAT = {
  league:      ['standings', 'matches', 'participants'],
  single_elim: ['bracket', 'participants'],
  groups:      ['groups', 'participants'],
}

const TAB_LABEL = {
  standings:    'Posiciones',
  matches:      'Partidos',
  bracket:      'Bracket',
  groups:       'Grupos',
  participants: 'Participantes',
}

export default function TorneoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isActuallyAdmin, viewAsUser } = useAuth()
  const { setActiveTorneo } = useNotifications()
  const showAdminUI = isActuallyAdmin && !viewAsUser

  useEffect(() => {
    setActiveTorneo(id)
  }, [id, setActiveTorneo])

  const [torneo, setTorneo]     = useState(null)
  const [matches, setMatches]   = useState([])
  const [standings, setStandings] = useState([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState(null)
  const [recordingMatch, setRecording] = useState(null)
  const [reorderingSeeds, setReordering] = useState(false)
  const [addingParticipants, setAddingParticipants] = useState(false)

  const loadAll = useCallback(async (signal) => {
    try {
      const t = await axios.get(API.torneos.DETAIL(id), { signal })
      if (signal?.aborted) return
      const torneoData = t.data
      setTorneo(torneoData)

      // For groups format we don't need /matches or /standings; the GroupsView
      // loads /groups separately.
      if (torneoData.format !== 'groups') {
        const [m, s] = await Promise.all([
          axios.get(API.torneos.MATCHES(id), { signal }),
          axios.get(API.torneos.STANDINGS(id), { signal }).catch((err) => {
            if (axios.isCancel(err)) throw err
            return { data: { standings: [] } }
          }),
        ])
        if (signal?.aborted) return
        setMatches(m.data || [])
        setStandings(s.data?.standings || [])
      } else {
        setMatches([])
        setStandings([])
      }
      const defaultTab = TABS_BY_FORMAT[torneoData.format]?.[0]
      setActiveTab((prev) => prev || defaultTab)
    } catch (err) {
      if (axios.isCancel(err)) return
      if (err.response?.status === 404) setNotFound(true)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const ac = new AbortController()
    loadAll(ac.signal)
    return () => ac.abort()
  }, [loadAll])

  const refresh = () => loadAll()

  const handleRecord = async (payload) => {
    if (!recordingMatch) return
    await axios.post(API.torneos.MATCH_RESULT(id, recordingMatch._id), payload)
    setRecording(null)
    await loadAll()
  }

  const handleUndoResult = async (match) => {
    try {
      await axios.delete(API.torneos.MATCH_RESULT(id, match._id))
      await loadAll()
    } catch (err) {
      alert(err.response?.data?.message || 'Error al deshacer')
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.loadingMsg}>Cargando…</p>
        </div>
      </div>
    )
  }

  if (notFound || !torneo) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <Link to="/torneos" className={styles.backLink}>← Volver a torneos</Link>
          <p className={styles.loadingMsg}>Torneo no encontrado.</p>
        </div>
      </div>
    )
  }

  const status = STATUS_META[torneo.status]
  const format = FORMAT_LABEL[torneo.format]
  const tabs = TABS_BY_FORMAT[torneo.format] || []

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{torneo.title} – Torneos – Turnocero 🏆</title>
        <meta name="description" content={`${torneo.title} — ${torneo.game}`} />
      </Helmet>

      <div className={styles.inner}>
        <Link to="/torneos" className={styles.backLink}>← Volver a torneos</Link>

        {torneo.image?.url ? (
          <div className={styles.banner}>
            <img src={torneo.image.url} alt="" className={styles.bannerBg} aria-hidden="true" />
            <img src={torneo.image.url} alt={torneo.title} className={styles.bannerImg} />
          </div>
        ) : null}

        <header className={styles.titleBlock}>
          <div className={styles.titleRow}>
            <span className={`${styles.chip} ${styles[status.className]}`}>{status.label}</span>
            <span className={styles.formatLabel}>{format.icon} {format.label}</span>
          </div>
          <h1 className={styles.titleHeading}>{torneo.title}</h1>
          <p className={styles.titleGame}>🎲 {torneo.game}</p>
          {torneo.description && (
            <p className={styles.titleDesc}>{torneo.description}</p>
          )}
          <p className={styles.titleMeta}>
            Organiza <UserRef user={torneo.createdBy} /> ·{' '}
            👥 {(torneo.participants?.length || 0)}{torneo.maxParticipants ? ` / ${torneo.maxParticipants}` : ''} participantes
          </p>
        </header>

        {torneo.status === 'registration' && (
          <div className={styles.registerRow}>
            <RegisterButton torneo={torneo} user={user} onChange={refresh} />
          </div>
        )}

        {torneo.status === 'finished' && torneo.winner && (
          <div className={styles.podium}>
            <h3 className={styles.podiumTitle}>🏆 Resultado final</h3>
            <p className={styles.podiumRow}>
              <span className={styles.podiumGold}>🥇 Campeón:</span> <UserRef user={torneo.winner} />
            </p>
            {torneo.runnerUp && (
              <p className={styles.podiumRow}>
                <span className={styles.podiumSilver}>🥈 Subcampeón:</span> <UserRef user={torneo.runnerUp} />
              </p>
            )}
          </div>
        )}

        {showAdminUI && (
          <AdminPanel
            torneo={torneo}
            onChange={(updated) => setTorneo(updated)}
            onReorderSeeds={() => setReordering(true)}
            onAddParticipants={() => setAddingParticipants(true)}
            onDelete={() => navigate('/torneos')}
          />
        )}

        {showAdminUI && (torneo.status === 'registration') && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Inscripciones pendientes</h3>
            <RegistrationsList torneo={torneo} onChange={(updated) => setTorneo(updated)} />
          </section>
        )}

        <nav className={styles.tabs}>
          {tabs.map((t) => (
            <button
              key={t}
              className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </nav>

        <section className={styles.tabBody}>
          {activeTab === 'standings' && (
            <LeagueStandings standings={standings} participants={torneo.participants || []} />
          )}
          {activeTab === 'matches' && (
            <LeagueRoundsList
              matches={matches}
              isAdmin={showAdminUI && torneo.status === 'in_progress'}
              onRecord={setRecording}
              onUndo={handleUndoResult}
            />
          )}
          {activeTab === 'bracket' && (
            <Bracket
              matches={matches}
              isAdmin={showAdminUI && torneo.status === 'in_progress'}
              onRecord={setRecording}
              onUndo={handleUndoResult}
            />
          )}
          {activeTab === 'groups' && (
            <GroupsView
              torneo={torneo}
              isAdmin={showAdminUI}
              onTorneoChange={refresh}
            />
          )}
          {activeTab === 'participants' && (
            <ParticipantsList
              torneo={torneo}
              isAdmin={showAdminUI}
              onChange={(updated) => setTorneo(updated)}
            />
          )}
        </section>
      </div>

      {recordingMatch && (
        <RecordResultModal
          match={recordingMatch}
          format={torneo.format}
          onClose={() => setRecording(null)}
          onConfirm={handleRecord}
        />
      )}

      {reorderingSeeds && (
        <SeedReorderModal
          torneo={torneo}
          onClose={() => setReordering(false)}
          onSaved={(updated) => { setTorneo(updated); setReordering(false) }}
        />
      )}

      {addingParticipants && (
        <AddParticipantModal
          torneo={torneo}
          onClose={() => setAddingParticipants(false)}
          onChange={(updated) => setTorneo(updated)}
        />
      )}
    </div>
  )
}
