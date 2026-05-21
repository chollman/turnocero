import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import TableCard from './TableCard'
import TableCardSkeleton from './TableCardSkeleton'
import styles from './Dashboard.module.css'

const TABS = [
  { id: 'all', label: 'Todas las mesas' },
  { id: 'mine', label: 'Mis mesas' },
]

// Radio máximo del slider de distancia (km). 0 = sin filtro.
const MAX_RADIUS_KM = 100

const GridIcon = () => (
  <svg width='15' height='15' viewBox='0 0 15 15' fill='currentColor'>
    <rect x='1' y='1' width='5.5' height='5.5' rx='1' />
    <rect x='8.5' y='1' width='5.5' height='5.5' rx='1' />
    <rect x='1' y='8.5' width='5.5' height='5.5' rx='1' />
    <rect x='8.5' y='8.5' width='5.5' height='5.5' rx='1' />
  </svg>
)

const ListIcon = () => (
  <svg width='15' height='15' viewBox='0 0 15 15' fill='currentColor'>
    <rect x='1' y='2' width='13' height='2' rx='1' />
    <rect x='1' y='6.5' width='13' height='2' rx='1' />
    <rect x='1' y='11' width='13' height='2' rx='1' />
  </svg>
)

export default function Dashboard() {
  const { user } = useAuth()
  const hasDireccion = Boolean(user?.direccion?.lat && user?.direccion?.lng)
  const [tables, setTables] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  // Refactor: usar useDebouncedValue compartido en vez del setTimeout manual.
  const debouncedSearch = useDebouncedValue(search, 400)
  // Slider de radio. 0 = sin filtro (default). Solo se aplica si user tiene direccion.
  const [radiusKm, setRadiusKm] = useState(0)
  const debouncedRadius = useDebouncedValue(radiusKm, 300)
  const [page, setPage] = useState(1)
  const [refetchKey, setRefetchKey] = useState(0)
  const [viewMode, setViewMode] = useState('grid')

  // Resetear página al cambiar search o radio.
  useEffect(() => { setPage(1) }, [debouncedSearch, debouncedRadius])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const url = activeTab === 'mine' ? '/api/tables/mine' : '/api/tables'
        const params = { page, limit: 12 }
        if (debouncedSearch) params.search = debouncedSearch
        if (hasDireccion && debouncedRadius > 0) params.maxDistanceKm = debouncedRadius
        const { data } = await axios.get(url, { params })
        if (!cancelled) {
          setTables(data.tables)
          setPagination({
            page: data.page,
            pages: data.pages,
            total: data.total,
          })
        }
      } catch {
        if (!cancelled) setError('Error al cargar las mesas')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [activeTab, page, debouncedSearch, debouncedRadius, hasDireccion, refetchKey])

  const handleTabChange = (id) => {
    if (id === activeTab) return
    setActiveTab(id)
    setPage(1)
  }

  const handleUpdate = (updatedTable) => {
    setTables((prev) =>
      prev.map((t) => (t._id === updatedTable._id ? updatedTable : t)),
    )
  }

  const handleCancel = (tableId) => {
    setTables((prev) => prev.filter((t) => t._id !== tableId))
  }

  return (
    <div className={styles.page}>
      <div className='container'>
        {/* Mobile compact header (shown instead of hero on mobile) */}
        <div className={styles.mobileHeader}>
          <div>
            <p className={styles.heroEyebrow}>
              ◆{' '}
              {pagination.total > 0
                ? `${pagination.total} MESAS ACTIVAS`
                : 'MESAS DE JUEGO'}
            </p>
            <h1 className={styles.mobileTitle}>Tirá los dados.</h1>
          </div>
        </div>

        {/* Hero — desktop only */}
        <div className={styles.hero}>
          <div className={styles.heroDecor} aria-hidden='true'>
            <svg viewBox='0 0 100 100' width='100%' height='100%'>
              <circle
                cx='50'
                cy='50'
                r='40'
                fill='none'
                stroke='currentColor'
                strokeWidth='0.6'
                opacity='0.3'
              />
              <circle
                cx='50'
                cy='50'
                r='30'
                fill='none'
                stroke='currentColor'
                strokeWidth='0.6'
                opacity='0.3'
              />
              <circle
                cx='50'
                cy='50'
                r='20'
                fill='none'
                stroke='currentColor'
                strokeWidth='0.6'
                opacity='0.5'
              />
              <polygon
                points='50,10 60,40 90,40 65,60 75,90 50,72 25,90 35,60 10,40 40,40'
                fill='var(--amber-10)'
              />
            </svg>
          </div>
          <div className={styles.heroContent}>
            <p className={styles.heroEyebrow}>
              ◆{' '}
              {pagination.total > 0
                ? `${pagination.total} MESAS ACTIVAS`
                : 'MESAS DE JUEGO'}
            </p>
            <h1 className={styles.heroTitle}>Tirá los dados.</h1>
            <p className={styles.heroSub}>
              Sumate a una mesa o convocá la tuya. Encontrá jugadores cerca y
              empezá la próxima partida.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.tabs}>
            {TABS.filter((tab) => user || tab.id !== 'mine').map((tab) => (
              <button
                key={tab.id}
                className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.controlsRight}>
            {user && (
              <Link to='/mesas/crear' className={styles.createCtaBtn}>
                + Crear mesa
              </Link>
            )}
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.activeViewBtn : ''}`}
                onClick={() => setViewMode('grid')}
                title='Vista en cuadrícula'
              >
                <GridIcon />
              </button>
              <button
                className={`${styles.viewBtn} ${viewMode === 'list' ? styles.activeViewBtn : ''}`}
                onClick={() => setViewMode('list')}
                title='Vista en lista'
              >
                <ListIcon />
              </button>
            </div>
            <input
              type='text'
              className={styles.search}
              placeholder='Buscar juego o host…'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filtro por radio (logged-in only) */}
        {user && (
          <div className={styles.radiusRow}>
            <div className={styles.radiusLabel}>
              <span className={styles.radiusIcon} aria-hidden='true'>📍</span>
              <span>
                {hasDireccion
                  ? (radiusKm > 0
                      ? <>Mostrando mesas a <strong>menos de {radiusKm} km</strong> de tu ubicación</>
                      : <>Filtrá por <strong>distancia</strong> desde tu ubicación</>)
                  : <>Agregá tu dirección en <Link to='/perfil' className={styles.radiusInlineLink}>tu perfil</Link> para filtrar mesas por distancia</>}
              </span>
            </div>
            <div className={styles.radiusControls}>
              <button
                type='button'
                className={styles.radiusStep}
                onClick={() => setRadiusKm((r) => Math.max(0, r - 1))}
                disabled={!hasDireccion || radiusKm <= 0}
                aria-label='Disminuir radio 1 km'
                title='−1 km'
              >−</button>
              <input
                type='range'
                min='0'
                max={MAX_RADIUS_KM}
                step='1'
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className={styles.radiusSlider}
                disabled={!hasDireccion}
                aria-label='Radio máximo en kilómetros'
                title={hasDireccion ? `Radio: ${radiusKm || 'Sin límite'}` : 'Agregá tu dirección en el perfil para activar este filtro'}
              />
              <button
                type='button'
                className={styles.radiusStep}
                onClick={() => setRadiusKm((r) => Math.min(MAX_RADIUS_KM, r + 1))}
                disabled={!hasDireccion || radiusKm >= MAX_RADIUS_KM}
                aria-label='Aumentar radio 1 km'
                title='+1 km'
              >+</button>
              <span className={styles.radiusValue}>
                {radiusKm > 0 ? `${radiusKm} km` : 'Sin límite'}
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className={styles.grid}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <TableCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className={styles.center}>
            <p className={styles.errorText}>{error}</p>
            <button
              className={styles.retryBtn}
              onClick={() => setRefetchKey((k) => k + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : tables.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🃏</span>
            <p className={styles.emptyTitle}>
              {debouncedSearch
                ? 'Sin resultados para esa búsqueda'
                : 'No hay mesas disponibles'}
            </p>
            <p className={styles.emptySub}>
              {!debouncedSearch &&
                (user
                  ? '¡Sé el primero en crear una mesa!'
                  : '¡Registrate para crear la primera!')}
            </p>
            {!debouncedSearch && user && (
              <Link to='/mesas/crear' className={styles.createBtn}>
                + Crear mesa
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className={viewMode === 'list' ? styles.list : styles.grid}>
              {tables.map((table, i) => (
                <div
                  key={table._id}
                  className={styles.cardWrap}
                  style={{ '--i': i }}
                >
                  <TableCard
                    table={table}
                    onUpdate={handleUpdate}
                    onCancel={handleCancel}
                    listMode={viewMode === 'list'}
                  />
                </div>
              ))}
            </div>
            {pagination.pages > 1 && (
              <div className={styles.pagination}>
                <button
                  className={styles.pageBtn}
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                >
                  ← Anterior
                </button>
                <span className={styles.pageInfo}>
                  {page} / {pagination.pages}
                </span>
                <button
                  className={styles.pageBtn}
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === pagination.pages}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB — mobile only, logged-in users only */}
      {user && (
        <Link to='/mesas/crear' className={styles.fab}>
          <span>+</span> Crear mesa
        </Link>
      )}
    </div>
  )
}
