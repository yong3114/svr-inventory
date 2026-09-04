import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  Boxes,
  CalendarDays,
  CalendarRange,
  Camera,
  CheckCircle2,
  CircleUserRound,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  History,
  Home,
  KeyRound,
  LogOut,
  MapPin,
  MessageCircle,
  Menu,
  PackageCheck,
  PackageMinus,
  ReceiptText,
  Phone,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  Search,
  Star,
  Settings,
  ShieldCheck,
  ToggleLeft,
  Upload,
  Pencil,
  SlidersHorizontal,
  UserCog,
  UserRound,
  UserPlus,
  Users,
  Warehouse,
  Wrench,
  AlertTriangle,
  X,
  XCircle,
} from 'lucide-react'
import { supabase } from './lib/supabaseClient'
import './App.css'


const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

let googleMapsLoaderPromise = null

function loadGoogleMapsPlaces() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps is only available in the browser.'))
  }

  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google.maps)
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(
      new Error('VITE_GOOGLE_MAPS_API_KEY is missing from .env.local')
    )
  }

  if (googleMapsLoaderPromise) return googleMapsLoaderPromise

  googleMapsLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('svr-google-maps-js')

    const waitForGoogle = () => {
      let attempts = 0
      const timer = window.setInterval(() => {
        attempts += 1
        if (window.google?.maps?.importLibrary) {
          window.clearInterval(timer)
          resolve(window.google.maps)
        } else if (attempts > 100) {
          window.clearInterval(timer)
          reject(new Error('Google Maps took too long to load.'))
        }
      }, 100)
    }

    if (existing) {
      waitForGoogle()
      return
    }

    const script = document.createElement('script')
    script.id = 'svr-google-maps-js'
    script.async = true
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        GOOGLE_MAPS_API_KEY
      )}&loading=async&libraries=places&v=weekly&region=MY&language=en`
    script.onload = waitForGoogle
    script.onerror = () =>
      reject(new Error('Unable to load Google Maps JavaScript API.'))
    document.head.appendChild(script)
  })

  return googleMapsLoaderPromise
}

function GooglePlacesAddress({
  currentAddress,
  onPlaceSelected,
}) {
  const hostRef = useRef(null)
  const elementRef = useRef(null)
  const [mapsState, setMapsState] = useState(
    GOOGLE_MAPS_API_KEY ? 'loading' : 'missing'
  )

  useEffect(() => {
    let cancelled = false
    let autocompleteElement = null
    let selectionHandler = null

    async function mountAutocomplete() {
      if (!GOOGLE_MAPS_API_KEY) {
        setMapsState('missing')
        return
      }

      try {
        await loadGoogleMapsPlaces()
        const { PlaceAutocompleteElement } =
          await window.google.maps.importLibrary('places')

        if (cancelled || !hostRef.current) return

        autocompleteElement = new PlaceAutocompleteElement()
        autocompleteElement.placeholder =
          currentAddress || 'Search condo / residence / street...'

        // Bias the experience toward Malaysia without hard-blocking
        // Singapore / other nearby jobs.
        try {
          autocompleteElement.region = 'my'
        } catch {
          // Some weekly builds may not expose a writable region property.
        }

        selectionHandler = async (event) => {
          try {
            const place = event.placePrediction.toPlace()
            await place.fetchFields({
              fields: [
                'id',
                'displayName',
                'formattedAddress',
                'location',
              ],
            })

            const location = place.location
            onPlaceSelected({
              place_name: place.displayName || '',
              installation_address:
                place.formattedAddress || place.displayName || '',
              google_place_id: place.id || '',
              latitude:
                typeof location?.lat === 'function'
                  ? location.lat()
                  : location?.lat ?? null,
              longitude:
                typeof location?.lng === 'function'
                  ? location.lng()
                  : location?.lng ?? null,
            })
          } catch (error) {
            console.error('Google place selection failed', error)
          }
        }

        autocompleteElement.addEventListener(
          'gmp-select',
          selectionHandler
        )

        hostRef.current.innerHTML = ''
        hostRef.current.appendChild(autocompleteElement)
        elementRef.current = autocompleteElement
        setMapsState('ready')
      } catch (error) {
        console.error(error)
        if (!cancelled) setMapsState('error')
      }
    }

    mountAutocomplete()

    return () => {
      cancelled = true
      if (autocompleteElement && selectionHandler) {
        autocompleteElement.removeEventListener(
          'gmp-select',
          selectionHandler
        )
      }
      if (hostRef.current) hostRef.current.innerHTML = ''
      elementRef.current = null
    }
  }, [])

  return (
    <div className="google-place-control">
      <div ref={hostRef} className="google-place-host" />

      {mapsState === 'loading' && (
        <small>Loading Google Places...</small>
      )}
      {mapsState === 'missing' && (
        <small className="maps-warning">
          Google Maps API key is not configured. You can still type the
          address manually below.
        </small>
      )}
      {mapsState === 'error' && (
        <small className="maps-warning">
          Google Places could not load. Check API restrictions / billing,
          or type the address manually below.
        </small>
      )}
      {mapsState === 'ready' && (
        <small>
          Start typing a condo, residence or street and select the Google
          suggestion.
        </small>
      )}
    </div>
  )
}

function googleMapsUrl(record) {
  const address =
    record?.installation_address ||
    record?.place_name ||
    record?.installation_area

  if (!address && record?.latitude == null && record?.longitude == null) {
    return ''
  }

  const query =
    record?.latitude != null && record?.longitude != null
      ? `${record.latitude},${record.longitude}`
      : address

  const placePart = record?.google_place_id
    ? `&query_place_id=${encodeURIComponent(record.google_place_id)}`
    : ''

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query
  )}${placePart}`
}

function whatsappUrl(phone) {
  if (!phone) return ''
  let digits = String(phone).replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `60${digits.slice(1)}`
  if (!digits.startsWith('60') && digits.length >= 9) digits = `60${digits}`
  return digits ? `https://wa.me/${digits}` : ''
}

function formatLocalDateKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeekMonday(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function addDays(date, count) {
  const d = new Date(date)
  d.setDate(d.getDate() + count)
  return d
}

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'operations', label: 'Operations', icon: CalendarDays },
  { id: 'jobs', label: 'Jobs', icon: FileText },
  { id: 'holders', label: 'Stock Holders', icon: Users },
  { id: 'activity', label: 'Activity', icon: History },
  { id: 'more', label: 'More', icon: Menu },
]

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  const [inventory, setInventory] = useState([])
  const [locations, setLocations] = useState([])
  const [locationStock, setLocationStock] = useState([])
  const [movements, setMovements] = useState([])
  const [reservations, setReservations] = useState([])
  const [jobs, setJobs] = useState([])
  const [profiles, setProfiles] = useState([])
  const [profile, setProfile] = useState(null)
  const [auditEvents, setAuditEvents] = useState([])
  const [profileLoading, setProfileLoading] = useState(true)
  const [reservationFilter, setReservationFilter] = useState('reserved')
  const [jobFilter, setJobFilter] = useState('not_invoiced')

  const [jobModal, setJobModal] = useState(null)
  const [jobForm, setJobForm] = useState({
    customer_name: '',
    customer_phone: '',
    installation_area: '',
    installation_date: '',
    stock_location_id: '',
    remark: '',
  })
  const [jobItems, setJobItems] = useState([
    { product_id: '', quantity: 1 },
  ])
  const [jobSaving, setJobSaving] = useState(false)
  const [jobError, setJobError] = useState('')

  const [invoiceJob, setInvoiceJob] = useState(null)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [invoiceSaving, setInvoiceSaving] = useState(false)
  const [invoiceError, setInvoiceError] = useState('')

  const [accessUser, setAccessUser] = useState(null)
  const [accessForm, setAccessForm] = useState({
    display_name: '',
    role: 'viewer',
    location_id: '',
    active: true,
  })
  const [accessSaving, setAccessSaving] = useState(false)
  const [accessError, setAccessError] = useState('')

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    display_name: '',
    email: '',
    role: 'viewer',
    location_id: '',
  })
  const [inviteSaving, setInviteSaving] = useState(false)
  const [inviteError, setInviteError] = useState('')

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirm: '',
  })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [inviteLanding] = useState(() => {
    if (typeof window === 'undefined') return false

    const url = new URL(window.location.href)
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, '')
    )
    const type =
      url.searchParams.get('type') ||
      hashParams.get('type')

    return (
      type === 'invite' ||
      type === 'recovery' ||
      url.searchParams.get('password_setup') === '1' ||
      url.searchParams.has('code') ||
      hashParams.has('access_token')
    )
  })

  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')

  const [activeTab, setActiveTab] = useState('home')
  const historyReadyRef = useRef(false)
  const restoringHistoryRef = useRef(false)

  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeTab])

  const [actionMode, setActionMode] = useState(null)
  const [actionItems, setActionItems] = useState([
    { product_id: '', quantity: 1 },
  ])
  const [actionForm, setActionForm] = useState({
    from_location_id: '',
    to_location_id: '',
    customer_name: '',
    customer_phone: '',
    installation_date: '',
    installation_area: '',
    reference_no: '',
    remark: '',
  })
  const [actionSaving, setActionSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [toast, setToast] = useState('')

  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [holderStock, setHolderStock] = useState({})
  const [stockCountValues, setStockCountValues] = useState({})
  const [stockCountLoading, setStockCountLoading] = useState(false)
  const [stockCountSaving, setStockCountSaving] = useState(false)
  const [stockCountMessage, setStockCountMessage] = useState('')
  const [stockCountError, setStockCountError] = useState('')
  const [stockCountCategory, setStockCountCategory] = useState('smart_lock')

  const [productCatalog, setProductCatalog] = useState([])
  const [allLocations, setAllLocations] = useState([])
  const [settingsView, setSettingsView] = useState('products')
  const [productEditor, setProductEditor] = useState(null)
  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    category: 'smart_lock',
    app_variant: '',
    minimum_stock: 0,
    active: true,
  })
  const [productSaving, setProductSaving] = useState(false)
  const [productError, setProductError] = useState('')
  const [locationEditor, setLocationEditor] = useState(null)
  const [locationForm, setLocationForm] = useState({
    code: '',
    name: '',
    location_type: 'warehouse',
    active: true,
  })
  const [locationSaving, setLocationSaving] = useState(false)
  const [locationError, setLocationError] = useState('')


  const [operationsView, setOperationsView] = useState('board')

  const [bookingEditor, setBookingEditor] = useState(null)
  const [bookingForm, setBookingForm] = useState({
    customer_name: '',
    customer_phone: '',
    unit_no: '',
    installation_area: '',
    installation_address: '',
    place_name: '',
    google_place_id: '',
    latitude: null,
    longitude: null,
    booking_type: 'product_confirmed',
    promotion_name: '',
    selling_price: '',
    deposit_amount: '',
    payment_status: 'deposit_paid',
    schedule_type: 'tbc',
    installation_date: '',
    installation_time: '',
    estimated_installation: '',
    installer_location_id: '',
    remark: '',
  })
  const [bookingItems, setBookingItems] = useState([{ product_id: '', quantity: 1 }])
  const [bookingSaving, setBookingSaving] = useState(false)
  const [bookingError, setBookingError] = useState('')

  const [handoverBooking, setHandoverBooking] = useState(null)
  const [handoverForm, setHandoverForm] = useState({ from_location_id: '', to_location_id: '' })
  const [handoverSaving, setHandoverSaving] = useState(false)
  const [handoverError, setHandoverError] = useState('')

  const [completionBooking, setCompletionBooking] = useState(null)
  const [completionForm, setCompletionForm] = useState({
    stock_location_id: '',
    customer_taught: false,
    review_asked: false,
    review_received: false,
    completion_remark: '',
    pending_settle: false,
    pending_issue: '',
  })
  const [completionFiles, setCompletionFiles] = useState([])
  const [completionSaving, setCompletionSaving] = useState(false)
  const [completionError, setCompletionError] = useState('')

  const [followups, setFollowups] = useState([])
  const [jobPhotos, setJobPhotos] = useState([])
  const [followupEditor, setFollowupEditor] = useState(null)
  const [followupForm, setFollowupForm] = useState({
    technician_location_id: '',
    scheduled_date: '',
    scheduled_time: '',
    remark: '',
    resolution_note: '',
    review_asked: false,
    review_received: false,
  })
  const [followupSaving, setFollowupSaving] = useState(false)
  const [followupError, setFollowupError] = useState('')

  function closeTopOverlayForBack() {
    if (passwordOpen) {
      setPasswordOpen(false)
      return true
    }
    if (inviteOpen) {
      setInviteOpen(false)
      return true
    }
    if (accessUser) {
      setAccessUser(null)
      return true
    }
    if (productEditor) {
      setProductEditor(null)
      return true
    }
    if (locationEditor) {
      setLocationEditor(null)
      return true
    }
    if (followupEditor) {
      setFollowupEditor(null)
      return true
    }
    if (completionBooking) {
      setCompletionBooking(null)
      return true
    }
    if (handoverBooking) {
      setHandoverBooking(null)
      return true
    }
    if (bookingEditor) {
      setBookingEditor(null)
      return true
    }
    if (invoiceJob) {
      setInvoiceJob(null)
      return true
    }
    if (jobModal) {
      setJobModal(null)
      return true
    }
    if (actionMode) {
      setActionMode(null)
      return true
    }
    if (mobileActionsOpen) {
      setMobileActionsOpen(false)
      return true
    }

    return false
  }

  function currentHistoryState() {
    return {
      ...(window.history.state || {}),
      svrInventory: true,
      activeTab,
      operationsView,
    }
  }

  function goBackInApp() {
    if (typeof window === 'undefined') {
      setActiveTab('home')
      return
    }

    if (closeTopOverlayForBack()) return

    if (window.history.state?.svrInventory) {
      window.history.back()
    } else {
      setActiveTab('home')
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!historyReadyRef.current) {
      window.history.replaceState(
        {
          ...(window.history.state || {}),
          svrInventory: true,
          activeTab,
          operationsView,
        },
        '',
        window.location.href
      )
      historyReadyRef.current = true
      return
    }

    if (restoringHistoryRef.current) {
      restoringHistoryRef.current = false
      return
    }

    const state = window.history.state

    if (
      state?.svrInventory &&
      state.activeTab === activeTab &&
      state.operationsView === operationsView
    ) {
      return
    }

    window.history.pushState(
      currentHistoryState(),
      '',
      window.location.href
    )
  }, [activeTab, operationsView])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = (event) => {
      // Android / browser Back should close the current overlay first.
      // Because overlays do not create their own URL, restore the current
      // app page into browser history after closing the overlay.
      if (closeTopOverlayForBack()) {
        window.history.pushState(
          currentHistoryState(),
          '',
          window.location.href
        )
        return
      }

      const state = event.state

      if (state?.svrInventory) {
        restoringHistoryRef.current = true
        setActiveTab(state.activeTab || 'home')
        setOperationsView(state.operationsView || 'board')
      }
      // If there is no SVR state left, the user is already at the first
      // app page. At that point the browser may leave the website normally.
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [
    activeTab,
    operationsView,
    passwordOpen,
    inviteOpen,
    accessUser,
    productEditor,
    locationEditor,
    followupEditor,
    completionBooking,
    handoverBooking,
    bookingEditor,
    invoiceJob,
    jobModal,
    actionMode,
    mobileActionsOpen,
  ])

  async function establishAuthSessionFromUrl() {
    if (typeof window === 'undefined') {
      const { data, error } = await supabase.auth.getSession()
      return { session: data?.session || null, error }
    }

    const url = new URL(window.location.href)
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, '')
    )

    const code = url.searchParams.get('code')
    const tokenHash = url.searchParams.get('token_hash')
    const type =
      url.searchParams.get('type') ||
      hashParams.get('type')
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    // 1. Implicit invite / recovery flow.
    if (accessToken && refreshToken) {
      const result = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (!result.error && result.data?.session) {
        return {
          session: result.data.session,
          error: null,
        }
      }
    }

    // 2. PKCE flow.
    if (code) {
      const result = await supabase.auth.exchangeCodeForSession(code)

      if (!result.error && result.data?.session) {
        return {
          session: result.data.session,
          error: null,
        }
      }
    }

    // 3. Custom email template using token_hash.
    if (
      tokenHash &&
      ['invite', 'recovery'].includes(type || '')
    ) {
      const result = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      })

      if (!result.error && result.data?.session) {
        return {
          session: result.data.session,
          error: null,
        }
      }
    }

    // 4. The Supabase client may already have processed the URL.
    const current = await supabase.auth.getSession()

    return {
      session: current.data?.session || null,
      error: current.error || null,
    }
  }

  useEffect(() => {
    let cancelled = false

    async function initializeAuth() {
      const result = await establishAuthSessionFromUrl()

      if (cancelled) return

      setSession(result.session)

      if (result.session && inviteLanding) {
        setPasswordForm({ password: '', confirm: '' })
        setPasswordError('')
        setPasswordOpen(true)
      } else if (!result.session && inviteLanding) {
        setLoginError(
          'This invitation link is expired or no longer valid. Ask the Owner to Resend Invite.'
        )
      }

      setAuthLoading(false)
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return

      setSession(newSession)

      if (
        newSession &&
        (inviteLanding ||
          event === 'PASSWORD_RECOVERY' ||
          event === 'SIGNED_IN')
      ) {
        setPasswordForm({ password: '', confirm: '' })
        setPasswordError('')
        setPasswordOpen(true)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [inviteLanding])

  useEffect(() => {
    if (session) loadAppData()
  }, [session])

  useEffect(() => {
    if (!session) return

    let refreshTimer

    const refreshSoon = () => {
      window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        loadAppData()
      }, 250)
    }

    const channel = supabase
      .channel('svr-inventory-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_movements' },
        refreshSoon
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        refreshSoon
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservation_items' },
        refreshSoon
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        refreshSoon
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_items' },
        refreshSoon
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_followups' },
        refreshSoon
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_photos' },
        refreshSoon
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        refreshSoon
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'audit_events' },
        refreshSoon
      )
      .subscribe()

    return () => {
      window.clearTimeout(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, [session])

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError('')
    setSigningIn(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error(error)
      setLoginError('Email 或 Password 不正确')
    }

    setSigningIn(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setInventory([])
    setLocations([])
    setLocationStock([])
    setMovements([])
    setReservations([])
    setJobs([])
    setProfiles([])
    setProfile(null)
    setAuditEvents([])
    setProductCatalog([])
    setAllLocations([])
    setFollowups([])
    setJobPhotos([])
    setProfileLoading(true)
    setActiveTab('home')
  }

  async function loadAppData() {
    setDataLoading(true)
    setDataError('')

    const [
      inventoryResult,
      locationsResult,
      stockResult,
      movementsResult,
      reservationsResult,
      jobsResult,
      profilesResult,
      auditResult,
      catalogResult,
      allLocationsResult,
      followupsResult,
      photosResult,
    ] = await Promise.all([
      supabase.rpc('get_inventory_summary'),
      supabase.from('locations').select('*').eq('active', true).order('created_at'),
      supabase.rpc('get_stock_by_location'),
      supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(180),
      supabase
        .from('reservations')
        .select('*, reservation_items(product_id, quantity)')
        .order('created_at', { ascending: false }),
      supabase
        .from('jobs')
        .select('*, job_items(product_id, quantity)')
        .order('completed_at', { ascending: false }),
      supabase
        .from('user_profiles')
        .select('user_id, email, display_name, role, location_id, active, created_at, updated_at')
        .order('created_at'),
      supabase.from('audit_events').select('*').order('created_at', { ascending: false }).limit(100),
      supabase
        .from('products')
        .select('id, sku, name, category, app_variant, minimum_stock, active, created_at')
        .order('category').order('name'),
      supabase.from('locations').select('*').order('created_at'),
      supabase.from('job_followups').select('*').order('created_at', { ascending: false }),
      supabase.from('job_photos').select('*').order('created_at', { ascending: false }),
    ])

    const firstError =
      inventoryResult.error || locationsResult.error || stockResult.error ||
      movementsResult.error || reservationsResult.error || jobsResult.error ||
      profilesResult.error || auditResult.error || catalogResult.error ||
      allLocationsResult.error || followupsResult.error || photosResult.error

    if (firstError) {
      console.error(firstError)
      setDataError('读取资料失败，请 Refresh 再试。')
    } else {
      const nextProfiles = profilesResult.data || []
      let nextPhotos = photosResult.data || []

      const paths = nextPhotos.map((item) => item.storage_path).filter(Boolean)
      if (paths.length > 0) {
        const { data: signed, error: signedError } = await supabase.storage
          .from('job-photos')
          .createSignedUrls(paths, 3600)

        if (!signedError && signed) {
          const urlMap = new Map(signed.map((item, index) => [paths[index], item.signedUrl]))
          nextPhotos = nextPhotos.map((item) => ({
            ...item,
            signed_url: urlMap.get(item.storage_path) || '',
          }))
        }
      }

      setInventory(inventoryResult.data || [])
      setLocations(locationsResult.data || [])
      setLocationStock(stockResult.data || [])
      setMovements(movementsResult.data || [])
      setReservations(reservationsResult.data || [])
      setJobs(jobsResult.data || [])
      setProfiles(nextProfiles)
      setAuditEvents(auditResult.data || [])
      setProductCatalog(catalogResult.data || [])
      setAllLocations(allLocationsResult.data || [])
      setFollowups(followupsResult.data || [])
      setJobPhotos(nextPhotos)
      setProfile(nextProfiles.find((item) => item.user_id === session?.user?.id) || null)
    }

    setProfileLoading(false)
    setDataLoading(false)
  }

  function productDisplayName(item) {
    return item?.app_variant
      ? `${item.name} (${item.app_variant})`
      : item?.name || 'Unknown Product'
  }

  function productById(id) {
    const catalogItem = productCatalog.find((item) => item.id === id)
    if (catalogItem) return { ...catalogItem, product_id: catalogItem.id }
    return inventory.find((item) => item.product_id === id)
  }

  function locationById(id) {
    return (
      allLocations.find((item) => item.id === id) ||
      locations.find((item) => item.id === id)
    )
  }

  function profileByUserId(id) {
    return profiles.find((item) => item.user_id === id)
  }

  const currentRole = profile?.role || 'viewer'
  const isOwner = currentRole === 'owner'
  const isAdmin = currentRole === 'admin'
  const isManagement = isOwner || isAdmin
  const isTechnician = currentRole === 'technician'
  const isAgent = currentRole === 'agent'
  const canCompleteJobs = isManagement || isTechnician
  const canManageInventory = isManagement
  const canManageReservations = isManagement
  const canInvoiceJobs = isManagement
  const canViewUserAccess = isOwner

  function formatRole(role) {
    if (role === 'owner') return 'Owner'
    if (role === 'admin') return 'Admin'
    if (role === 'technician') return 'Technician'
    if (role === 'agent') return 'Agent'
    return 'Viewer'
  }

  function formatDate(value) {
    if (!value) return ''
    const date = new Date(value)
    return new Intl.DateTimeFormat('en-MY', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  function movementTitle(movement) {
    const product = productById(movement.product_id)
    return `${productDisplayName(product)} × ${movement.quantity}`
  }

  function movementSubtitle(movement) {
    const from = locationById(movement.from_location_id)?.name
    const to = locationById(movement.to_location_id)?.name

    if (movement.movement_type === 'stock_in') {
      return `Stock In → ${to || 'Location'}`
    }

    if (movement.movement_type === 'transfer') {
      return `${from || 'Location'} → ${to || 'Location'}`
    }

    if (movement.movement_type === 'stock_out') {
      return `${from || 'Location'} → Stock Out`
    }

    if (movement.movement_type === 'adjustment_in') {
      return `Count Adjustment → ${to || 'Location'}`
    }

    if (movement.movement_type === 'adjustment_out') {
      return `${from || 'Location'} → Count Adjustment`
    }

    if (movement.movement_type === 'return') {
      return `Return → ${to || from || 'Location'}`
    }

    return movement.movement_type
  }


  function openDirectJob() {
    if (!canCompleteJobs) {
      showToast('Your account cannot complete Jobs')
      return
    }

    const warehouse =
      locations.find((location) => location.code === 'SVR-JB') ||
      locations[0]
    const defaultLocation = isTechnician
      ? profile?.location_id
      : warehouse?.id

    setMobileActionsOpen(false)
    setJobModal({ type: 'direct' })
    setJobForm({
      customer_name: '',
      customer_phone: '',
      installation_area: '',
      installation_date: new Date().toISOString().slice(0, 10),
      stock_location_id: defaultLocation || '',
      remark: '',
    })
    setJobItems([{ product_id: '', quantity: 1 }])
    setJobError('')
  }

  function openReservationJob(reservation) {
    if (!canCompleteJobs) {
      showToast('Your account cannot complete Jobs')
      return
    }

    if (
      isTechnician &&
      reservation.installer_location_id &&
      reservation.installer_location_id !== profile?.location_id
    ) {
      showToast('This reservation is assigned to another installer')
      return
    }

    const warehouse =
      locations.find((location) => location.code === 'SVR-JB') ||
      locations[0]

    const defaultLocation = isTechnician
      ? profile?.location_id
      : reservation.installer_location_id || warehouse?.id

    setJobModal({ type: 'reservation', reservation })
    setJobForm({
      customer_name: reservation.customer_name || '',
      customer_phone: reservation.customer_phone || '',
      installation_area: reservation.installation_area || '',
      installation_date:
        reservation.installation_date ||
        new Date().toISOString().slice(0, 10),
      stock_location_id: defaultLocation || '',
      remark: reservation.remark || '',
    })
    setJobItems(
      (reservation.reservation_items || []).map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
      }))
    )
    setJobError('')
  }

  function closeJobModal() {
    if (jobSaving) return
    setJobModal(null)
    setJobError('')
  }

  function updateJobForm(field, value) {
    setJobForm((current) => ({
      ...current,
      [field]: value,
    }))
    setJobError('')
  }

  function updateJobItem(index, field, value) {
    setJobItems((current) =>
      current.map((item, itemIndex) => {
        if (index !== itemIndex) return item

        if (field === 'quantity') {
          return {
            ...item,
            quantity: Math.max(1, Math.floor(Number(value) || 1)),
          }
        }

        return { ...item, [field]: value }
      })
    )
    setJobError('')
  }

  function addJobItem() {
    setJobItems((current) => [
      ...current,
      { product_id: '', quantity: 1 },
    ])
  }

  function removeJobItem(index) {
    setJobItems((current) => {
      if (current.length === 1) {
        return [{ product_id: '', quantity: 1 }]
      }

      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  async function saveJob() {
    if (!jobModal) return

    if (!jobForm.stock_location_id) {
      setJobError('请选择从哪个 Stock Holder / Location 使用库存。')
      return
    }

    if (!jobForm.customer_name.trim()) {
      setJobError('请填写 Customer Name。')
      return
    }

    if (jobModal.type === 'direct') {
      const items = jobItems.filter((item) => item.product_id)

      if (items.length === 0) {
        setJobError('请至少选择一个门锁或锁体。')
        return
      }

      const duplicateIds = items
        .map((item) => item.product_id)
        .filter((id, index, all) => all.indexOf(id) !== index)

      if (duplicateIds.length > 0) {
        setJobError('同一个产品不要重复添加，请直接改 Qty。')
        return
      }
    }

    setJobSaving(true)
    setJobError('')

    try {
      if (jobModal.type === 'reservation') {
        const { data, error } = await supabase.rpc(
          'complete_reservation_job',
          {
            p_reservation_id: jobModal.reservation.id,
            p_stock_location_id: jobForm.stock_location_id,
            p_remark: jobForm.remark.trim() || null,
          }
        )

        if (error) throw error

        const jobNo = data?.[0]?.job_no
        showToast(
          jobNo
            ? `${jobNo} completed`
            : 'Reservation completed successfully'
        )
      } else {
        const cleanItems = jobItems
          .filter((item) => item.product_id)
          .map((item) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
          }))

        const { data, error } = await supabase.rpc(
          'create_direct_job',
          {
            p_customer_name: jobForm.customer_name.trim(),
            p_customer_phone:
              jobForm.customer_phone.trim() || null,
            p_installation_area:
              jobForm.installation_area.trim() || null,
            p_stock_location_id: jobForm.stock_location_id,
            p_installation_date:
              jobForm.installation_date || null,
            p_remark: jobForm.remark.trim() || null,
            p_items: cleanItems,
          }
        )

        if (error) throw error

        const jobNo = data?.[0]?.job_no
        showToast(jobNo ? `${jobNo} saved` : 'Job saved successfully')
      }

      setJobModal(null)
      await loadAppData()
      setActiveTab('jobs')
      setJobFilter('not_invoiced')
    } catch (error) {
      console.error(error)
      setJobError(
        error?.message ||
          '保存 Job 失败，请不要重复按，把错误截图给我。'
      )
    } finally {
      setJobSaving(false)
    }
  }

  async function cancelReservation(reservation) {
    if (!canManageReservations) {
      showToast('Owner/Admin permission required')
      return
    }

    const confirmed = window.confirm(
      `Cancel reservation for ${reservation.customer_name}?`
    )

    if (!confirmed) return

    const { error } = await supabase.rpc(
      'cancel_reservation_secure',
      { p_reservation_id: reservation.id }
    )

    if (error) {
      console.error(error)
      showToast('Cancel failed')
      return
    }

    showToast('Reservation cancelled')
    await loadAppData()
  }

  function openInvoiceModal(job) {
    setInvoiceJob(job)
    setInvoiceNo(job.invoice_no || '')
    setInvoiceError('')
  }

  function closeInvoiceModal() {
    if (invoiceSaving) return
    setInvoiceJob(null)
    setInvoiceError('')
  }

  async function saveInvoice() {
    if (!invoiceJob) return

    if (!canInvoiceJobs) {
      setInvoiceError('Owner/Admin permission required.')
      return
    }

    const cleanInvoice = invoiceNo.trim()

    if (!cleanInvoice) {
      setInvoiceError('请填写 Invoice No.')
      return
    }

    setInvoiceSaving(true)
    setInvoiceError('')

    const { error } = await supabase.rpc('set_job_invoice', {
      p_job_id: invoiceJob.id,
      p_invoice_no: cleanInvoice,
    })

    if (error) {
      console.error(error)
      setInvoiceError(error.message || '更新 Invoice 失败。')
      setInvoiceSaving(false)
      return
    }

    setInvoiceJob(null)
    setInvoiceSaving(false)
    showToast('Invoice marked as completed')
    await loadAppData()
  }

  function canVoidJob(job) {
    if (!job || job.status !== 'completed') return false
    if (isManagement) return true

    return (
      isTechnician &&
      profile?.location_id &&
      job.technician_location_id === profile.location_id &&
      job.invoice_status !== 'invoiced'
    )
  }

  async function voidJob(job) {
    if (!canVoidJob(job)) {
      showToast('You cannot void this Job')
      return
    }

    const reason = window.prompt(
      `Void ${job.job_no}?\n\nReason (optional):`,
      ''
    )

    if (reason === null) return

    const confirmed = window.confirm(
      `Confirm VOID ${job.job_no}?\n\nStock used by this Job will be restored. The Job record will remain.`
    )

    if (!confirmed) return

    const { error } = await supabase.rpc('void_job', {
      p_job_id: job.id,
      p_reason: reason.trim() || null,
    })

    if (error) {
      console.error(error)
      showToast(error.message || 'Void failed')
      return
    }

    showToast(`${job.job_no} voided • stock restored`)
    await loadAppData()
  }

  async function deleteJobPermanently(job) {
    if (!isOwner) {
      showToast('Only Owner can permanently delete Jobs')
      return
    }

    const typed = window.prompt(
      `OWNER ONLY\n\nPermanently delete ${job.job_no}?\nStock effect will be reversed and the Job will disappear.\n\nType DELETE to continue:`
    )

    if (typed !== 'DELETE') return

    const photoPaths = jobPhotos
      .filter((item) => item.job_id === job.id)
      .map((item) => item.storage_path)
      .filter(Boolean)

    const { error } = await supabase.rpc('delete_job_permanently', {
      p_job_id: job.id,
    })

    if (error) {
      console.error(error)
      showToast(error.message || 'Delete failed')
      return
    }

    if (photoPaths.length > 0) {
      const { error: photoDeleteError } = await supabase.storage
        .from('job-photos')
        .remove(photoPaths)
      if (photoDeleteError) console.error(photoDeleteError)
    }

    showToast(`${job.job_no} permanently deleted`)
    await loadAppData()
  }

  function openUserAccess(user) {
    if (!isOwner) {
      showToast('Only Owner can manage user access')
      return
    }

    setAccessUser(user)
    setAccessForm({
      display_name: user.display_name || '',
      role: user.role || 'viewer',
      location_id: user.location_id || '',
      active: user.active !== false,
    })
    setAccessError('')
  }

  function closeUserAccess() {
    if (accessSaving) return
    setAccessUser(null)
    setAccessError('')
  }

  function updateAccessForm(field, value) {
    setAccessForm((current) => ({ ...current, [field]: value }))
    setAccessError('')
  }

  async function saveUserAccess() {
    if (!accessUser) return

    if (!isOwner) {
      setAccessError('Only Owner can manage access.')
      return
    }

    if (
      ['technician', 'agent'].includes(accessForm.role) &&
      !accessForm.location_id
    ) {
      setAccessError('Technician / Agent 必须选择 Stock Holder。')
      return
    }

    setAccessSaving(true)
    setAccessError('')

    const { error } = await supabase.rpc('update_user_access', {
      p_user_id: accessUser.user_id,
      p_display_name: accessForm.display_name.trim() || accessUser.email,
      p_role: accessForm.role,
      p_location_id:
        ['technician', 'agent'].includes(accessForm.role)
          ? accessForm.location_id
          : null,
      p_active: accessForm.active,
    })

    if (error) {
      console.error(error)
      setAccessError(error.message || '更新权限失败。')
      setAccessSaving(false)
      return
    }

    setAccessUser(null)
    setAccessSaving(false)
    showToast('User access updated')
    await loadAppData()
  }


  async function resendUserInvite() {
    if (!accessUser || !isOwner || accessSaving) return

    const ok = window.confirm(
      `Resend invitation to ${accessUser.email}?\n\nUse this for an invited user who has NOT finished setting up their account.`
    )

    if (!ok) return

    setAccessSaving(true)
    setAccessError('')

    try {
      const { data, error } = await supabase.functions.invoke(
        'invite-user',
        {
          body: {
            action: 'resend_invite',
            user_id: accessUser.user_id,
          },
        }
      )

      if (error) throw error
      if (!data?.ok) {
        throw new Error(data?.error || 'Unable to resend invitation')
      }

      setAccessUser(null)
      showToast(`New invitation sent to ${data.email || accessUser.email}`)
      await loadAppData()
    } catch (error) {
      console.error(error)
      setAccessError(
        error?.message ||
          'Resend Invite failed. Please try again.'
      )
    } finally {
      setAccessSaving(false)
    }
  }

  async function deleteUserAccount() {
    if (!accessUser || !isOwner || accessSaving) return

    if (accessUser.user_id === session?.user?.id) {
      setAccessError('You cannot delete your own Owner account.')
      return
    }

    const ok = window.confirm(
      `DELETE ${accessUser.display_name || accessUser.email}?\n\nThis permanently removes the login account. Use this for test / wrong / unused users. This cannot be undone.`
    )

    if (!ok) return

    setAccessSaving(true)
    setAccessError('')

    try {
      const { data, error } = await supabase.functions.invoke(
        'invite-user',
        {
          body: {
            action: 'delete_user',
            user_id: accessUser.user_id,
          },
        }
      )

      if (error) throw error
      if (!data?.ok) {
        throw new Error(data?.error || 'Unable to delete user')
      }

      setAccessUser(null)
      showToast('User deleted')
      await loadAppData()
    } catch (error) {
      console.error(error)
      setAccessError(
        error?.message ||
          'Delete User failed. If this user already owns records, deactivate the account instead.'
      )
    } finally {
      setAccessSaving(false)
    }
  }


  function openInventorySettings() {
    if (!isManagement) {
      showToast('Owner/Admin only')
      return
    }
    setActiveTab('settings')
  }

  function openProductEditor(product = null) {
    if (!isManagement) return
    setProductEditor(product || { id: null })
    setProductForm({
      sku: product?.sku || '',
      name: product?.name || '',
      category: product?.category || 'smart_lock',
      app_variant: product?.app_variant || '',
      minimum_stock: Number(product?.minimum_stock || 0),
      active: product?.active !== false,
    })
    setProductError('')
  }

  function closeProductEditor() {
    if (productSaving) return
    setProductEditor(null)
    setProductError('')
  }

  function updateProductForm(field, value) {
    setProductForm((current) => ({ ...current, [field]: value }))
    setProductError('')
  }

  async function saveProductSetting() {
    if (!isManagement || !productEditor) return
    if (!productForm.sku.trim() || !productForm.name.trim()) {
      setProductError('SKU 和 Product Name 都必须填写。')
      return
    }

    setProductSaving(true)
    setProductError('')

    const { error } = await supabase.rpc('manage_product_setting', {
      p_product_id: productEditor.id || null,
      p_sku: productForm.sku.trim(),
      p_name: productForm.name.trim(),
      p_category: productForm.category,
      p_app_variant: productForm.app_variant.trim() || null,
      p_minimum_stock: Math.max(0, Math.floor(Number(productForm.minimum_stock) || 0)),
      p_active: productForm.active,
    })

    if (error) {
      console.error(error)
      setProductError(error.message || '保存 Product 失败。')
      setProductSaving(false)
      return
    }

    setProductEditor(null)
    setProductSaving(false)
    showToast(productEditor.id ? 'Product updated' : 'Product added')
    await loadAppData()
  }

  function openLocationEditor(location = null) {
    if (!isManagement) return
    setLocationEditor(location || { id: null })
    setLocationForm({
      code: location?.code || '',
      name: location?.name || '',
      location_type: location?.location_type || 'warehouse',
      active: location?.active !== false,
    })
    setLocationError('')
  }

  function closeLocationEditor() {
    if (locationSaving) return
    setLocationEditor(null)
    setLocationError('')
  }

  function updateLocationForm(field, value) {
    setLocationForm((current) => ({ ...current, [field]: value }))
    setLocationError('')
  }

  async function saveLocationSetting() {
    if (!isManagement || !locationEditor) return
    if (!locationForm.code.trim() || !locationForm.name.trim()) {
      setLocationError('Location Code 和 Name 都必须填写。')
      return
    }

    setLocationSaving(true)
    setLocationError('')

    const { error } = await supabase.rpc('manage_location_setting', {
      p_location_id: locationEditor.id || null,
      p_code: locationForm.code.trim().toUpperCase(),
      p_name: locationForm.name.trim(),
      p_location_type: locationForm.location_type,
      p_active: locationForm.active,
    })

    if (error) {
      console.error(error)
      setLocationError(error.message || '保存 Stock Holder 失败。')
      setLocationSaving(false)
      return
    }

    setLocationEditor(null)
    setLocationSaving(false)
    showToast(locationEditor.id ? 'Stock Holder updated' : 'Stock Holder added')
    await loadAppData()
  }


  function openInviteUser() {
    if (!isOwner) {
      showToast('Only Owner can invite users')
      return
    }

    setInviteForm({
      display_name: '',
      email: '',
      role: 'viewer',
      location_id: '',
    })
    setInviteError('')
    setInviteOpen(true)
  }

  function closeInviteUser() {
    if (inviteSaving) return
    setInviteOpen(false)
    setInviteError('')
  }

  function updateInviteForm(field, value) {
    setInviteForm((current) => ({ ...current, [field]: value }))
    setInviteError('')
  }

  async function sendInvite() {
    if (!isOwner) {
      setInviteError('Only Owner can invite users.')
      return
    }

    const cleanName = inviteForm.display_name.trim()
    const cleanEmail = inviteForm.email.trim().toLowerCase()

    if (!cleanName) {
      setInviteError('请填写 Name。')
      return
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setInviteError('请填写正确的 Email。')
      return
    }

    if (
      ['technician', 'agent'].includes(inviteForm.role) &&
      !inviteForm.location_id
    ) {
      setInviteError('Technician / Agent 必须选择 Stock Holder。')
      return
    }

    setInviteSaving(true)
    setInviteError('')

    try {
      const { data, error } = await supabase.functions.invoke(
        'invite-user',
        {
          body: {
            display_name: cleanName,
            email: cleanEmail,
            role: inviteForm.role,
            location_id:
              ['technician', 'agent'].includes(inviteForm.role)
                ? inviteForm.location_id
                : null,
          },
        }
      )

      if (error) throw error
      if (!data?.ok) {
        throw new Error(data?.error || 'Invite failed')
      }

      setInviteOpen(false)
      showToast(`Invitation sent to ${cleanEmail}`)
      await loadAppData()
    } catch (error) {
      console.error(error)
      setInviteError(
        error?.message ||
          'Invite 失败。请确认 Edge Function 已 Deploy。'
      )
    } finally {
      setInviteSaving(false)
    }
  }

  function openPasswordChange() {
    setPasswordForm({ password: '', confirm: '' })
    setPasswordError('')
    setPasswordOpen(true)
  }

  function closePasswordChange() {
    if (passwordSaving) return
    setPasswordOpen(false)
    setPasswordError('')
  }

  async function savePasswordChange() {
    if (passwordForm.password.length < 8) {
      setPasswordError('Password 至少 8 个字符。')
      return
    }

    if (passwordForm.password !== passwordForm.confirm) {
      setPasswordError('两次 Password 不一样。')
      return
    }

    setPasswordSaving(true)
    setPasswordError('')

    let currentSession = null

    try {
      const current = await supabase.auth.getSession()
      currentSession = current.data?.session || null

      if (!currentSession && inviteLanding) {
        const restored = await establishAuthSessionFromUrl()
        currentSession = restored.session
      }
    } catch (error) {
      console.error(error)
    }

    if (!currentSession) {
      setPasswordError(
        'Invitation session is missing or expired. Ask the Owner to Resend Invite.'
      )
      setPasswordSaving(false)
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: passwordForm.password,
    })

    if (error) {
      console.error(error)
      setPasswordError(error.message || 'Password 更新失败。')
      setPasswordSaving(false)
      return
    }

    setPasswordSaving(false)
    setPasswordOpen(false)
    setPasswordForm({ password: '', confirm: '' })

    if (typeof window !== 'undefined') {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      )
    }

    showToast('Password updated successfully')
  }

  function bookingStage(booking) {
    if (booking.booking_type === 'promotion_only') return 'promotion'
    if (booking.schedule_type === 'exact') return 'scheduled'
    if (booking.schedule_type === 'estimated') return 'estimated'
    return 'tbc'
  }

  function openNewBooking() {
    if (!isManagement) return showToast('Owner/Admin permission required')
    setMobileActionsOpen(false)
    setBookingEditor({ type: 'new' })
    setBookingForm({
      customer_name: '', customer_phone: '', unit_no: '',
      installation_area: '', installation_address: '', place_name: '',
      google_place_id: '', latitude: null, longitude: null,
      booking_type: 'product_confirmed', promotion_name: '', selling_price: '',
      deposit_amount: '', payment_status: 'deposit_paid', schedule_type: 'tbc',
      installation_date: '', installation_time: '', estimated_installation: '',
      installer_location_id: '', remark: '',
    })
    setBookingItems([{ product_id: '', quantity: 1 }])
    setBookingError('')
  }

  function openEditBooking(booking, forceProduct = false) {
    if (!isManagement) return showToast('Owner/Admin permission required')
    setBookingEditor({ type: 'edit', booking })
    setBookingForm({
      customer_name: booking.customer_name || '',
      customer_phone: booking.customer_phone || '',
      unit_no: booking.unit_no || '',
      installation_area: booking.installation_area || '',
      installation_address: booking.installation_address || '',
      place_name: booking.place_name || '',
      google_place_id: booking.google_place_id || '',
      latitude: booking.latitude ?? null,
      longitude: booking.longitude ?? null,
      booking_type: forceProduct ? 'product_confirmed' : (booking.booking_type || 'product_confirmed'),
      promotion_name: booking.promotion_name || '',
      selling_price: booking.selling_price ?? '',
      deposit_amount: booking.deposit_amount ?? '',
      payment_status: booking.payment_status || 'not_paid',
      schedule_type: booking.schedule_type || (booking.installation_date ? 'exact' : 'tbc'),
      installation_date: booking.installation_date || '',
      installation_time: booking.installation_time ? String(booking.installation_time).slice(0, 5) : '',
      estimated_installation: booking.estimated_installation || '',
      installer_location_id: booking.installer_location_id || '',
      remark: booking.remark || '',
    })
    const items = (booking.reservation_items || []).map((item) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity),
    }))
    setBookingItems(items.length ? items : [{ product_id: '', quantity: 1 }])
    setBookingError('')
  }

  function updateBookingForm(field, value) {
    setBookingForm((current) => ({ ...current, [field]: value }))
    setBookingError('')
  }

  function updateBookingItem(index, field, value) {
    setBookingItems((current) => current.map((item, i) =>
      i === index
        ? { ...item, [field]: field === 'quantity' ? Math.max(1, Number(value) || 1) : value }
        : item
    ))
    setBookingError('')
  }

  function addBookingItem() {
    setBookingItems((current) => [...current, { product_id: '', quantity: 1 }])
  }

  function removeBookingItem(index) {
    setBookingItems((current) => current.length === 1
      ? [{ product_id: '', quantity: 1 }]
      : current.filter((_, i) => i !== index))
  }

  async function saveBookingV6() {
    if (!bookingEditor) return
    const cleanItems = bookingForm.booking_type === 'product_confirmed'
      ? bookingItems.filter((item) => item.product_id).map((item) => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
        }))
      : []

    if (!bookingForm.customer_name.trim()) return setBookingError('Customer Name is required.')
    if (bookingForm.booking_type === 'product_confirmed' && cleanItems.length === 0) {
      return setBookingError('Confirmed product booking needs at least one item.')
    }

    setBookingSaving(true)
    setBookingError('')
    const params = {
      p_customer_name: bookingForm.customer_name.trim(),
      p_customer_phone: bookingForm.customer_phone.trim() || null,
      p_unit_no: bookingForm.unit_no.trim() || null,
      p_installation_area: bookingForm.installation_area.trim() || null,
      p_installation_address:
        bookingForm.installation_address.trim() || null,
      p_place_name: bookingForm.place_name.trim() || null,
      p_google_place_id: bookingForm.google_place_id.trim() || null,
      p_latitude:
        bookingForm.latitude === null ||
        bookingForm.latitude === ''
          ? null
          : Number(bookingForm.latitude),
      p_longitude:
        bookingForm.longitude === null ||
        bookingForm.longitude === ''
          ? null
          : Number(bookingForm.longitude),
      p_booking_type: bookingForm.booking_type,
      p_promotion_name: bookingForm.promotion_name.trim() || null,
      p_selling_price: bookingForm.selling_price === '' ? null : Number(bookingForm.selling_price),
      p_deposit_amount: bookingForm.deposit_amount === '' ? 0 : Number(bookingForm.deposit_amount),
      p_payment_status: bookingForm.payment_status,
      p_schedule_type: bookingForm.schedule_type,
      p_installation_date: bookingForm.schedule_type === 'exact' ? (bookingForm.installation_date || null) : null,
      p_installation_time: bookingForm.schedule_type === 'exact' ? (bookingForm.installation_time || null) : null,
      p_estimated_installation: bookingForm.schedule_type === 'estimated' ? (bookingForm.estimated_installation.trim() || null) : null,
      p_installer_location_id: bookingForm.installer_location_id || null,
      p_remark: bookingForm.remark.trim() || null,
      p_items: cleanItems,
    }

    let result
    if (bookingEditor.type === 'new') {
      result = await supabase.rpc('create_booking_v61', params)
    } else {
      result = await supabase.rpc('update_booking_v61', {
        p_reservation_id: bookingEditor.booking.id,
        ...params,
      })
    }

    if (result.error) {
      console.error(result.error)
      setBookingError(result.error.message || 'Unable to save booking.')
      setBookingSaving(false)
      return
    }

    setBookingEditor(null)
    setBookingSaving(false)
    showToast(bookingEditor.type === 'new' ? 'Booking created' : 'Booking updated')
    await loadAppData()
    setActiveTab('operations')
  }

  function openHandover(booking) {
    const warehouse = locations.find((item) => item.code === 'SVR-JB') || locations.find((item) => item.location_type === 'warehouse') || locations[0]
    setHandoverBooking(booking)
    setHandoverForm({
      from_location_id: booking.handover_from_location_id || warehouse?.id || '',
      to_location_id: booking.installer_location_id || '',
    })
    setHandoverError('')
  }

  async function saveHandover() {
    if (!handoverBooking) return
    if (!handoverForm.from_location_id || !handoverForm.to_location_id) {
      return setHandoverError('Select From and Technician / To location.')
    }
    setHandoverSaving(true)
    const { error } = await supabase.rpc('handover_booking_stock_v6', {
      p_reservation_id: handoverBooking.id,
      p_from_location_id: handoverForm.from_location_id,
      p_to_location_id: handoverForm.to_location_id,
    })
    if (error) {
      console.error(error)
      setHandoverError(error.message || 'Handover failed.')
      setHandoverSaving(false)
      return
    }
    setHandoverBooking(null)
    setHandoverSaving(false)
    showToast('Stock handed over to technician')
    await loadAppData()
  }

  function openCompleteInstallation(booking) {
    const defaultLocation = isTechnician
      ? profile?.location_id
      : booking.installer_location_id || (locations.find((item) => item.code === 'SVR-JB')?.id || locations[0]?.id)
    setCompletionBooking(booking)
    setCompletionForm({
      stock_location_id: defaultLocation || '',
      customer_taught: false,
      review_asked: false,
      review_received: false,
      completion_remark: '',
      pending_settle: false,
      pending_issue: '',
    })
    setCompletionFiles([])
    setCompletionError('')
  }

  async function uploadJobPhotos(jobId, files) {
    const failed = []
    for (const file of files) {
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const path = `${jobId}/${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(path, file, { upsert: false, contentType: file.type || undefined })
      if (uploadError) {
        console.error(uploadError)
        failed.push(file.name)
        continue
      }
      const { error: registerError } = await supabase.rpc('register_job_photo_v6', {
        p_job_id: jobId,
        p_storage_path: path,
        p_file_name: file.name,
        p_note: null,
      })
      if (registerError) {
        console.error(registerError)
        failed.push(file.name)
      }
    }
    return failed
  }

  async function saveCompleteInstallation() {
    if (!completionBooking) return
    if (!completionForm.stock_location_id) return setCompletionError('Select the stock holder / technician.')
    if (completionForm.pending_settle && !completionForm.pending_issue.trim()) {
      return setCompletionError('Pending Settle must state what is not completed.')
    }

    setCompletionSaving(true)
    setCompletionError('')
    const { data, error } = await supabase.rpc('complete_booking_installation_v6', {
      p_reservation_id: completionBooking.id,
      p_stock_location_id: completionForm.stock_location_id,
      p_customer_taught: completionForm.customer_taught,
      p_review_asked: completionForm.review_asked,
      p_review_received: completionForm.review_received,
      p_completion_remark: completionForm.completion_remark.trim() || null,
      p_pending_issue: completionForm.pending_settle ? completionForm.pending_issue.trim() : null,
    })

    if (error) {
      console.error(error)
      setCompletionError(error.message || 'Unable to complete installation.')
      setCompletionSaving(false)
      return
    }

    const jobId = data?.[0]?.job_id
    const jobNo = data?.[0]?.job_no
    let failed = []
    if (jobId && completionFiles.length) failed = await uploadJobPhotos(jobId, completionFiles)

    setCompletionBooking(null)
    setCompletionSaving(false)
    showToast(failed.length ? `${jobNo || 'Job'} saved • ${failed.length} photo(s) failed` : `${jobNo || 'Job'} completed`)
    await loadAppData()
    setActiveTab(completionForm.pending_settle ? 'operations' : 'jobs')
  }

  function openFollowup(followup, mode = 'schedule') {
    const job = jobs.find((item) => item.id === followup.job_id)
    setFollowupEditor({ followup, job, mode })
    setFollowupForm({
      technician_location_id: followup.technician_location_id || job?.technician_location_id || '',
      scheduled_date: followup.scheduled_date || '',
      scheduled_time: followup.scheduled_time ? String(followup.scheduled_time).slice(0, 5) : '',
      remark: followup.remark || '',
      resolution_note: '',
      review_asked: Boolean(job?.review_asked),
      review_received: Boolean(job?.review_received),
    })
    setFollowupError('')
  }

  async function saveFollowup() {
    if (!followupEditor) return
    setFollowupSaving(true)
    setFollowupError('')
    let result
    if (followupEditor.mode === 'resolve') {
      if (!followupForm.resolution_note.trim()) {
        setFollowupError('Please note what was settled.')
        setFollowupSaving(false)
        return
      }
      result = await supabase.rpc('resolve_followup_v6', {
        p_followup_id: followupEditor.followup.id,
        p_resolution_note: followupForm.resolution_note.trim(),
        p_review_asked: followupForm.review_asked,
        p_review_received: followupForm.review_received,
      })
    } else {
      result = await supabase.rpc('schedule_followup_v6', {
        p_followup_id: followupEditor.followup.id,
        p_technician_location_id: followupForm.technician_location_id || null,
        p_scheduled_date: followupForm.scheduled_date || null,
        p_scheduled_time: followupForm.scheduled_time || null,
        p_remark: followupForm.remark.trim() || null,
      })
    }
    if (result.error) {
      console.error(result.error)
      setFollowupError(result.error.message || 'Unable to update follow-up.')
      setFollowupSaving(false)
      return
    }
    setFollowupEditor(null)
    setFollowupSaving(false)
    showToast(followupEditor.mode === 'resolve' ? 'Pending issue settled' : 'Follow-up scheduled')
    await loadAppData()
  }


  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  function openAction(mode) {
    if (!canManageInventory) {
      showToast('Owner/Admin permission required')
      return
    }

    const warehouse =
      locations.find((location) => location.code === 'SVR-JB') ||
      locations[0]

    const firstOtherLocation = locations.find(
      (location) => location.id !== warehouse?.id
    )

    setMobileActionsOpen(false)
    setActionMode(mode)
    setActionItems([{ product_id: '', quantity: 1 }])
    setActionError('')
    setActionForm({
      from_location_id:
        mode === 'transfer' || mode === 'stock_out'
          ? warehouse?.id || ''
          : '',
      to_location_id:
        mode === 'stock_in'
          ? warehouse?.id || ''
          : mode === 'transfer'
            ? firstOtherLocation?.id || ''
            : '',
      customer_name: '',
      customer_phone: '',
      installation_date: '',
      installation_area: '',
      reference_no: '',
      remark: '',
    })
  }

  function closeAction() {
    if (actionSaving) return
    setActionMode(null)
    setActionError('')
  }

  function updateActionForm(field, value) {
    setActionForm((current) => ({
      ...current,
      [field]: value,
    }))
    setActionError('')
  }

  function updateActionItem(index, field, value) {
    setActionItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item

        if (field === 'quantity') {
          return {
            ...item,
            quantity: Math.max(1, Math.floor(Number(value) || 1)),
          }
        }

        return { ...item, [field]: value }
      })
    )
    setActionError('')
  }

  function addActionItem() {
    setActionItems((current) => [
      ...current,
      { product_id: '', quantity: 1 },
    ])
  }

  function removeActionItem(index) {
    setActionItems((current) => {
      if (current.length === 1) {
        return [{ product_id: '', quantity: 1 }]
      }

      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  function locationQuantity(productId, locationId) {
    const row = locationStock.find(
      (item) =>
        item.product_id === productId &&
        item.location_id === locationId
    )

    return Number(row?.quantity || 0)
  }

  function availableQuantity(productId) {
    const product = inventory.find(
      (item) => item.product_id === productId
    )

    return Number(product?.available_stock || 0)
  }

  function actionLabel(mode) {
    if (mode === 'stock_in') return 'Stock In'
    if (mode === 'transfer') return 'Transfer'
    if (mode === 'reserve') return 'Reserve'
    if (mode === 'stock_out') return 'Stock Out'
    return 'Stock Action'
  }

  function validateAction() {
    const items = actionItems.filter((item) => item.product_id)

    if (items.length === 0) {
      return '请至少选择一个产品。'
    }

    const duplicateIds = items
      .map((item) => item.product_id)
      .filter(
        (id, index, all) => all.indexOf(id) !== index
      )

    if (duplicateIds.length > 0) {
      return '同一个产品不要重复添加，请直接调整数量。'
    }

    if (items.some((item) => Number(item.quantity) <= 0)) {
      return 'Quantity 必须大于 0。'
    }

    if (actionMode === 'stock_in') {
      if (!actionForm.to_location_id) {
        return '请选择 Stock In 到哪个 Location。'
      }
    }

    if (actionMode === 'transfer') {
      if (
        !actionForm.from_location_id ||
        !actionForm.to_location_id
      ) {
        return '请选择 From 和 To。'
      }

      if (
        actionForm.from_location_id === actionForm.to_location_id
      ) {
        return 'From 和 To 不能是同一个 Location。'
      }

      for (const item of items) {
        const currentQty = locationQuantity(
          item.product_id,
          actionForm.from_location_id
        )

        if (Number(item.quantity) > currentQty) {
          const product = productById(item.product_id)
          return `${productDisplayName(product)} 在这个 Location 只有 ${currentQty} 个。`
        }
      }
    }

    if (actionMode === 'stock_out') {
      if (!actionForm.from_location_id) {
        return '请选择从哪个 Location 出货。'
      }

      if (!actionForm.customer_name.trim()) {
        return 'Stock Out 请填写 Customer / Job Name，方便以后查记录。'
      }

      for (const item of items) {
        const currentQty = locationQuantity(
          item.product_id,
          actionForm.from_location_id
        )

        if (Number(item.quantity) > currentQty) {
          const product = productById(item.product_id)
          return `${productDisplayName(product)} 在这个 Location 只有 ${currentQty} 个。`
        }

        const availableQty = availableQuantity(item.product_id)
        if (Number(item.quantity) > availableQty) {
          const product = productById(item.product_id)
          return `${productDisplayName(product)} 目前只有 ${availableQty} 个可卖库存，其余已 Reserved。`
        }
      }
    }

    if (actionMode === 'reserve') {
      if (!actionForm.customer_name.trim()) {
        return 'Reserve 必须填写 Customer Name。'
      }

      for (const item of items) {
        const availableQty = availableQuantity(item.product_id)

        if (Number(item.quantity) > availableQty) {
          const product = productById(item.product_id)
          return `${productDisplayName(product)} 目前只有 ${availableQty} 个 Available。`
        }
      }
    }

    return ''
  }

  async function saveAction() {
    const validationError = validateAction()

    if (validationError) {
      setActionError(validationError)
      return
    }

    const items = actionItems.filter((item) => item.product_id)
    setActionSaving(true)
    setActionError('')

    const timestamp = Date.now()
    const referenceNo =
      actionForm.reference_no.trim() ||
      `${
        actionMode === 'stock_in'
          ? 'IN'
          : actionMode === 'transfer'
            ? 'TRF'
            : actionMode === 'stock_out'
              ? 'OUT'
              : 'RSV'
      }-${timestamp}`

    try {
      if (actionMode === 'reserve') {
        const { error } = await supabase.rpc(
          'create_reservation_secure',
          {
            p_customer_name: actionForm.customer_name.trim(),
            p_customer_phone:
              actionForm.customer_phone.trim() || null,
            p_installation_date:
              actionForm.installation_date || null,
            p_installation_area:
              actionForm.installation_area.trim() || null,
            p_installer_location_id:
              actionForm.to_location_id || null,
            p_reference_no:
              actionForm.reference_no.trim() || null,
            p_remark: actionForm.remark.trim() || null,
            p_items: items.map((item) => ({
              product_id: item.product_id,
              quantity: Number(item.quantity),
            })),
          }
        )

        if (error) throw error
      } else {
        const { error } = await supabase.rpc(
          'record_stock_action',
          {
            p_mode: actionMode,
            p_from_location_id:
              actionMode === 'transfer' ||
              actionMode === 'stock_out'
                ? actionForm.from_location_id
                : null,
            p_to_location_id:
              actionMode === 'stock_in' ||
              actionMode === 'transfer'
                ? actionForm.to_location_id
                : null,
            p_customer_name:
              actionForm.customer_name.trim() || null,
            p_reference_no: referenceNo,
            p_remark: actionForm.remark.trim() || null,
            p_items: items.map((item) => ({
              product_id: item.product_id,
              quantity: Number(item.quantity),
            })),
          }
        )

        if (error) throw error
      }

      await loadAppData()
      setActionMode(null)
      showToast(`${actionLabel(actionMode)} saved successfully`)
    } catch (error) {
      console.error(error)
      setActionError(
        error?.message ||
          '保存失败，请不要重复按，把错误截图给我。'
      )
    } finally {
      setActionSaving(false)
    }
  }

  async function openStockCount(locationIdOverride = '') {
    if (!canManageInventory) {
      showToast('Owner/Admin permission required')
      return
    }

    setMobileActionsOpen(false)
    setStockCountMessage('')
    setStockCountError('')

    let locationId = locationIdOverride || selectedLocationId

    if (!locationId) {
      const warehouse =
        locations.find((location) => location.code === 'SVR-JB') ||
        locations[0]

      locationId = warehouse?.id || ''
    }

    setSelectedLocationId(locationId)
    setActiveTab('stockCount')

    if (locationId) {
      await loadHolderStock(locationId)
    }
  }

  async function loadHolderStock(locationId) {
    if (!locationId) return

    setStockCountLoading(true)
    setStockCountMessage('')
    setStockCountError('')

    // V6.2.1:
    // The app already loads the stock-by-location ledger in loadAppData().
    // Reuse that snapshot here instead of making another RPC every time
    // Stock Count opens or the holder changes.
    const current = {}

    inventory.forEach((item) => {
      current[item.product_id] = 0
    })

    locationStock
      .filter((row) => row.location_id === locationId)
      .forEach((row) => {
        current[row.product_id] = Number(row.quantity || 0)
      })

    setHolderStock(current)
    setStockCountValues(current)
    setStockCountLoading(false)
  }

  async function handleLocationChange(e) {
    const locationId = e.target.value
    setSelectedLocationId(locationId)
    await loadHolderStock(locationId)
  }

  function updateStockCount(productId, nextValue) {
    const parsed = Math.max(0, Math.floor(Number(nextValue) || 0))

    setStockCountValues((current) => ({
      ...current,
      [productId]: parsed,
    }))

    setStockCountMessage('')
    setStockCountError('')
  }

  function adjustStockCount(productId, amount) {
    const currentValue = Number(stockCountValues[productId] || 0)
    updateStockCount(productId, currentValue + amount)
  }

  async function saveStockCount() {
    if (!selectedLocationId) {
      setStockCountError('请先选择 Stock Holder。')
      return
    }

    const selectedLocation = locationById(selectedLocationId)

    const changedItems = inventory
      .map((item) => {
        const currentQty = Number(holderStock[item.product_id] || 0)
        const actualQty = Number(stockCountValues[item.product_id] || 0)

        return {
          item,
          difference: actualQty - currentQty,
        }
      })
      .filter((row) => row.difference !== 0)

    if (changedItems.length === 0) {
      setStockCountMessage('没有库存变化，不需要保存。')
      return
    }

    setStockCountSaving(true)
    setStockCountMessage('')
    setStockCountError('')

    const { error } = await supabase.rpc('save_stock_count_secure', {
      p_location_id: selectedLocationId,
      p_items: changedItems.map(({ item }) => ({
        product_id: item.product_id,
        actual_quantity: Number(stockCountValues[item.product_id] || 0),
      })),
    })

    if (error) {
      console.error(error)
      setStockCountError('保存失败，请把错误截图给我。')
      setStockCountSaving(false)
      return
    }

    const savedValues = { ...stockCountValues }

    await loadAppData()

    setHolderStock(savedValues)
    setStockCountValues(savedValues)

    setStockCountMessage(
      `已保存 ${selectedLocation?.name || 'Stock Holder'} 的库存`
    )
    setStockCountSaving(false)
  }

  const smartLocks = useMemo(
    () => inventory.filter((item) => item.category === 'smart_lock'),
    [inventory]
  )

  const lockBodies = useMemo(
    () => inventory.filter((item) => item.category === 'lock_body'),
    [inventory]
  )

  const visibleInventory = useMemo(() => {
    if (isManagement || !profile?.location_id) return inventory

    return inventory.map((item) => {
      const ownQty = Number(
        locationStock.find(
          (row) =>
            row.product_id === item.product_id &&
            row.location_id === profile.location_id
        )?.quantity || 0
      )

      return {
        ...item,
        physical_stock: ownQty,
        reserved_stock: 0,
        available_stock: ownQty,
      }
    })
  }, [inventory, locationStock, profile?.location_id, isManagement])

  const visibleReservations = useMemo(() => {
    if (isManagement) return reservations
    if (isTechnician && profile?.location_id) {
      return reservations.filter(
        (item) => item.installer_location_id === profile.location_id
      )
    }
    return []
  }, [reservations, isManagement, isTechnician, profile?.location_id])

  const visibleJobs = useMemo(() => {
    if (isManagement) return jobs
    if ((isTechnician || isAgent) && profile?.location_id) {
      return jobs.filter(
        (item) => item.technician_location_id === profile.location_id
      )
    }
    return []
  }, [jobs, isManagement, isTechnician, isAgent, profile?.location_id])

  const visibleMovements = useMemo(() => {
    if (isManagement) return movements
    if (profile?.location_id) {
      return movements.filter(
        (item) =>
          item.from_location_id === profile.location_id ||
          item.to_location_id === profile.location_id
      )
    }
    return []
  }, [movements, isManagement, profile?.location_id])

  const visibleHolderSummaryLocations = useMemo(() => {
    if (isManagement) return locations
    if (profile?.location_id) {
      return locations.filter((item) => item.id === profile.location_id)
    }
    return []
  }, [locations, isManagement, profile?.location_id])

  const roleSmartLocks = useMemo(
    () => visibleInventory.filter((item) => item.category === 'smart_lock'),
    [visibleInventory]
  )

  const roleLockBodies = useMemo(
    () => visibleInventory.filter((item) => item.category === 'lock_body'),
    [visibleInventory]
  )

  const totals = useMemo(() => {
    const totalSmartLocks = roleSmartLocks.reduce(
      (sum, item) => sum + Number(item.physical_stock || 0),
      0
    )

    const totalLockBodies = roleLockBodies.reduce(
      (sum, item) => sum + Number(item.physical_stock || 0),
      0
    )

    const totalReserved = visibleInventory.reduce(
      (sum, item) => sum + Number(item.reserved_stock || 0),
      0
    )

    const totalAvailable = visibleInventory.reduce(
      (sum, item) => sum + Number(item.available_stock || 0),
      0
    )

    return {
      totalSmartLocks,
      totalLockBodies,
      totalReserved,
      totalAvailable,
    }
  }, [visibleInventory, roleSmartLocks, roleLockBodies])

  const filteredInventory = useMemo(() => {
    return visibleInventory.filter((item) => {
      const categoryMatch =
        categoryFilter === 'all' || item.category === categoryFilter

      const query = search.trim().toLowerCase()
      const searchMatch = `${item.name} ${item.app_variant || ''}`
        .toLowerCase()
        .includes(query)

      return categoryMatch && searchMatch
    })
  }, [visibleInventory, categoryFilter, search])

  const holderSummary = useMemo(() => {
    return visibleHolderSummaryLocations.map((location) => {
      const rows = locationStock.filter(
        (row) => row.location_id === location.id
      )

      const units = rows.reduce(
        (sum, row) => sum + Number(row.quantity || 0),
        0
      )

      const products = rows.filter(
        (row) => Number(row.quantity || 0) > 0
      ).length

      return { ...location, units, products }
    })
  }, [visibleHolderSummaryLocations, locationStock])

  const stockCountProducts = inventory.filter(
    (item) =>
      stockCountCategory === 'all' ||
      item.category === stockCountCategory
  )

  const stockCountChanges = inventory.filter((item) => {
    return (
      Number(holderStock[item.product_id] || 0) !==
      Number(stockCountValues[item.product_id] || 0)
    )
  }).length

  const selectedLocation = locationById(selectedLocationId)

  if (authLoading) {
    return (
      <div className="boot-screen">
        <div className="brand-mark large">SVR</div>
        <div className="boot-line" />
        <p>Loading inventory...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="auth-shell">
        <div className="auth-visual">
          <div className="auth-visual-content">
            <div className="brand-mark">SVR</div>
            <p className="kicker light">INVENTORY MANAGEMENT</p>
            <h1>Know every lock.<br />Know where it is.</h1>
            <p>
              One clean place for SVR stock, reservations,
              technicians and agents.
            </p>
          </div>
        </div>

        <div className="auth-panel">
          <div className="auth-card">
            <div className="auth-mobile-brand">
              <div className="brand-mark">SVR</div>
              <div>
                <strong>SVR Inventory</strong>
                <span>Stock Management</span>
              </div>
            </div>

            <p className="kicker">WELCOME BACK</p>
            <h2>Sign in</h2>
            <p className="muted">
              Use your SVR Inventory account to continue.
            </p>

            <form onSubmit={handleLogin}>
              <label>Email</label>
              <input
                type="email"
                placeholder="name@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label>Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {loginError && (
                <div className="form-error">{loginError}</div>
              )}

              <button
                className="primary-button full"
                type="submit"
                disabled={signingIn}
              >
                {signingIn ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="auth-footer">
              <ShieldCheck size={15} />
              <span>Secure • Value • Reliable</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (session && profileLoading) {
    return (
      <div className="boot-screen">
        <div className="brand-mark large">SVR</div>
        <div className="boot-line" />
        <p>Checking account access...</p>
      </div>
    )
  }

  if (session && (!profile || profile.active === false)) {
    return (
      <div className="access-blocked-screen">
        <div className="access-blocked-card">
          <div className="brand-mark">SVR</div>
          <ShieldCheck size={30} />
          <h2>Account access is not active</h2>
          <p>
            This account exists, but SVR Inventory access is disabled or
            has not been assigned yet. Ask the Owner to update User Access.
          </p>
          <strong>{session.user.email}</strong>
          <button className="primary-button" onClick={handleLogout}>
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </div>
    )
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (isManagement) return true
    if (isTechnician) {
      return ['home', 'inventory', 'operations', 'jobs', 'activity', 'more'].includes(
        item.id
      )
    }
    if (isAgent) {
      return ['home', 'inventory', 'jobs', 'more'].includes(item.id)
    }
    return ['home', 'inventory', 'more'].includes(item.id)
  })

  const allowedJobLocations = isTechnician
    ? locations.filter((item) => item.id === profile?.location_id)
    : locations

  const pageTitle =
    activeTab === 'home'
      ? 'Dashboard'
      : activeTab === 'inventory'
        ? 'Inventory'
        : activeTab === 'operations'
          ? 'Operations'
          : activeTab === 'jobs'
            ? 'Jobs & Invoices'
            : activeTab === 'holders'
              ? 'Stock Holders'
              : activeTab === 'activity'
                ? 'Activity'
                : activeTab === 'more'
                  ? 'Account & Settings'
                  : activeTab === 'users'
                    ? 'User Access'
                    : activeTab === 'settings'
                      ? 'Inventory Settings'
                      : 'Stock Count'

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">SVR</div>
          <div>
            <strong>SVR Inventory</strong>
            <span>Stock Management</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleNavItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={activeTab === id ? 'active' : ''}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          {canManageInventory && (
            <button className="count-shortcut" onClick={openStockCount}>
              <ClipboardList size={18} />
              <div>
                <strong>Stock Count</strong>
                <span>Physical adjustment</span>
              </div>
            </button>
          )}

          <div className="sidebar-user">
            <div className="avatar">
              {session.user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-copy">
              <strong>{profile?.display_name || 'SVR User'}</strong>
              <span>{formatRole(currentRole)} • {session.user.email}</span>
            </div>
            <button onClick={handleLogout} title="Log out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div>
            <p className="kicker">SVR INVENTORY</p>
            <h1>{pageTitle}</h1>
          </div>

          <div className="header-actions">
            <button
              className="icon-button"
              onClick={loadAppData}
              title="Refresh"
            >
              <RefreshCw
                size={18}
                className={dataLoading ? 'spin' : ''}
              />
            </button>

            <button
              className={
                activeTab === 'more'
                  ? 'icon-button mobile-more-button active'
                  : 'icon-button mobile-more-button'
              }
              onClick={() => setActiveTab('more')}
              title="More"
              aria-label="More"
            >
              <Menu size={19} />
            </button>

            <div className="header-user">
              <div className="avatar small">
                {session.user.email?.charAt(0).toUpperCase()}
              </div>
              <span>{formatRole(currentRole)} • {session.user.email}</span>
            </div>
          </div>
        </header>

        <main
          className={
            activeTab === 'stockCount'
              ? 'page-content count-page-content'
              : 'page-content'
          }
        >
          {dataError && (
            <div className="global-error">{dataError}</div>
          )}

          {activeTab === 'home' && (
            <Dashboard
              totals={totals}
              inventory={visibleInventory}
              movements={visibleMovements}
              reservations={visibleReservations}
              jobs={visibleJobs}
              followups={followups}
              productDisplayName={productDisplayName}
              productById={productById}
              movementTitle={movementTitle}
              movementSubtitle={movementSubtitle}
              formatDate={formatDate}
              setActiveTab={setActiveTab}
              setMobileActionsOpen={setMobileActionsOpen}
              openStockCount={openStockCount}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryPage
              inventory={filteredInventory}
              search={search}
              setSearch={setSearch}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              productDisplayName={productDisplayName}
              canAddProduct={isManagement}
              openAddProduct={() => openProductEditor(null)}
            />
          )}

          {activeTab === 'operations' && (
            <OperationsPage
              bookings={visibleReservations}
              jobs={visibleJobs}
              followups={followups}
              productById={productById}
              productDisplayName={productDisplayName}
              locationById={locationById}
              calendarLocations={locations}
              currentRole={currentRole}
              profile={profile}
              operationsView={operationsView}
              setOperationsView={setOperationsView}
              openNewBooking={openNewBooking}
              openEditBooking={openEditBooking}
              openHandover={openHandover}
              openCompleteInstallation={openCompleteInstallation}
              cancelReservation={cancelReservation}
              openFollowup={openFollowup}
              canManage={isManagement}
              canCompleteJobs={canCompleteJobs}
            />
          )}

          {activeTab === 'reservations' && (
            <ReservationsPage
              reservations={visibleReservations}
              reservationFilter={reservationFilter}
              setReservationFilter={setReservationFilter}
              productDisplayName={productDisplayName}
              productById={productById}
              locationById={locationById}
              formatDate={formatDate}
              cancelReservation={cancelReservation}
              openReservationJob={openReservationJob}
              setActiveTab={setActiveTab}
              canManageReservations={canManageReservations}
            />
          )}

          {activeTab === 'jobs' && (
            <JobsPage
              jobs={visibleJobs}
              jobFilter={jobFilter}
              setJobFilter={setJobFilter}
              productDisplayName={productDisplayName}
              productById={productById}
              locationById={locationById}
              formatDate={formatDate}
              openInvoiceModal={openInvoiceModal}
              openDirectJob={openDirectJob}
              setActiveTab={setActiveTab}
              currentRole={currentRole}
              canCompleteJobs={canCompleteJobs}
              canInvoiceJobs={canInvoiceJobs}
              canVoidJob={canVoidJob}
              voidJob={voidJob}
              deleteJobPermanently={deleteJobPermanently}
              isOwner={isOwner}
              jobPhotos={jobPhotos}
              followups={followups}
              openFollowup={openFollowup}
            />
          )}

          {activeTab === 'holders' && (
            <HoldersPage
              holderSummary={holderSummary}
              setSelectedLocationId={setSelectedLocationId}
              openStockCount={openStockCount}
            />
          )}

          {activeTab === 'activity' && (
            <ActivityPage
              movements={visibleMovements}
              movementTitle={movementTitle}
              movementSubtitle={movementSubtitle}
              formatDate={formatDate}
              profileByUserId={profileByUserId}
              auditEvents={isManagement ? auditEvents : []}
            />
          )}

          {activeTab === 'more' && (
            <MorePage
              email={session.user.email}
              profile={profile}
              formatRole={formatRole}
              onLogout={handleLogout}
              openStockCount={openStockCount}
              setActiveTab={setActiveTab}
              canManageInventory={canManageInventory}
              canViewUserAccess={canViewUserAccess}
              openPasswordChange={openPasswordChange}
              openInventorySettings={openInventorySettings}
            />
          )}

          {activeTab === 'users' && isOwner && (
            <UserAccessPage
              profiles={profiles}
              locations={locations}
              currentUserId={session.user.id}
              formatRole={formatRole}
              locationById={locationById}
              openUserAccess={openUserAccess}
              openInviteUser={openInviteUser}
            />
          )}

          {activeTab === 'settings' && isManagement && (
            <InventorySettingsPage
              products={productCatalog}
              locations={allLocations}
              settingsView={settingsView}
              setSettingsView={setSettingsView}
              openProductEditor={openProductEditor}
              openLocationEditor={openLocationEditor}
              goBack={goBackInApp}
            />
          )}

          {activeTab === 'stockCount' && (
            <StockCountPage
              locations={locations}
              selectedLocationId={selectedLocationId}
              selectedLocation={selectedLocation}
              handleLocationChange={handleLocationChange}
              stockCountCategory={stockCountCategory}
              setStockCountCategory={setStockCountCategory}
              stockCountProducts={stockCountProducts}
              stockCountLoading={stockCountLoading}
              holderStock={holderStock}
              stockCountValues={stockCountValues}
              adjustStockCount={adjustStockCount}
              updateStockCount={updateStockCount}
              productDisplayName={productDisplayName}
              stockCountChanges={stockCountChanges}
              stockCountSaving={stockCountSaving}
              saveStockCount={saveStockCount}
              stockCountMessage={stockCountMessage}
              stockCountError={stockCountError}
              goBack={goBackInApp}
            />
          )}
        </main>
      </div>

      {activeTab !== 'stockCount' && (
        <nav className="mobile-nav">
          <button
            className={activeTab === 'home' ? 'active' : ''}
            onClick={() => setActiveTab('home')}
          >
            <Home size={19} />
            <span>Home</span>
          </button>

          <button
            className={activeTab === 'inventory' ? 'active' : ''}
            onClick={() => setActiveTab('inventory')}
          >
            <Boxes size={19} />
            <span>Stock</span>
          </button>

          {canManageInventory || canCompleteJobs ? (
            <button
              className="mobile-add"
              onClick={() => setMobileActionsOpen(true)}
            >
              <span>+</span>
            </button>
          ) : (
            <div className="mobile-nav-spacer" />
          )}

          {(isManagement || isTechnician) ? (
            <button
              className={activeTab === 'operations' ? 'active' : ''}
              onClick={() => setActiveTab('operations')}
            >
              <CalendarDays size={19} />
              <span>Ops</span>
            </button>
          ) : (
            <button
              className={activeTab === 'jobs' ? 'active' : ''}
              onClick={() => setActiveTab('jobs')}
            >
              <FileText size={19} />
              <span>Jobs</span>
            </button>
          )}

          {(isManagement || isTechnician) ? (
            <button
              className={activeTab === 'jobs' ? 'active' : ''}
              onClick={() => setActiveTab('jobs')}
            >
              <FileText size={19} />
              <span>Jobs</span>
            </button>
          ) : (
            <button
              className={activeTab === 'more' ? 'active' : ''}
              onClick={() => setActiveTab('more')}
            >
              <Menu size={19} />
              <span>More</span>
            </button>
          )}
        </nav>
      )}

      {mobileActionsOpen && (
        <div
          className="sheet-backdrop"
          onClick={() => setMobileActionsOpen(false)}
        >
          <div
            className="action-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="sheet-title">
              <div>
                <p className="kicker">QUICK ACTION</p>
                <h3>What do you want to do?</h3>
              </div>
              <button
                className="icon-button"
                onClick={() => setMobileActionsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {isManagement && (
              <button className="sheet-action" onClick={openNewBooking}>
                <div className="action-icon dark"><CalendarDays size={20} /></div>
                <div>
                  <strong>New Booking</strong>
                  <span>Promotion booking, reservation or scheduled install</span>
                </div>
                <ChevronRight size={18} />
              </button>
            )}

            {canManageInventory && (
              <>
                <button
                  className="sheet-action"
                  onClick={() => openAction('stock_in')}
                >
                  <div className="action-icon">
                    <ArrowDownToLine size={20} />
                  </div>
                  <div>
                    <strong>Stock In</strong>
                    <span>Receive stock from supplier</span>
                  </div>
                  <ChevronRight size={18} />
                </button>

                <button
                  className="sheet-action"
                  onClick={() => openAction('transfer')}
                >
                  <div className="action-icon">
                    <ArrowRightLeft size={20} />
                  </div>
                  <div>
                    <strong>Transfer</strong>
                    <span>Move stock to technician or agent</span>
                  </div>
                  <ChevronRight size={18} />
                </button>
              </>
            )}

            {canManageInventory && (
              <>
                <button
                  className="sheet-action"
                  onClick={() => openAction('stock_out')}
                >
                  <div className="action-icon">
                    <PackageMinus size={20} />
                  </div>
                  <div>
                    <strong>Stock Out</strong>
                    <span>Manual / exceptional stock usage</span>
                  </div>
                  <ChevronRight size={18} />
                </button>

                <button className="sheet-action" onClick={openStockCount}>
                  <div className="action-icon dark">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <strong>Stock Count</strong>
                    <span>Set or correct physical stock</span>
                  </div>
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {actionMode && (
        <ActionModal
          mode={actionMode}
          label={actionLabel(actionMode)}
          inventory={inventory}
          locations={locations}
          form={actionForm}
          items={actionItems}
          saving={actionSaving}
          error={actionError}
          updateForm={updateActionForm}
          updateItem={updateActionItem}
          addItem={addActionItem}
          removeItem={removeActionItem}
          close={closeAction}
          save={saveAction}
          productDisplayName={productDisplayName}
          locationQuantity={locationQuantity}
          availableQuantity={availableQuantity}
        />
      )}

      {jobModal && (
        <JobModal
          jobModal={jobModal}
          form={jobForm}
          items={jobItems}
          inventory={inventory}
          locations={allowedJobLocations}
          saving={jobSaving}
          error={jobError}
          updateForm={updateJobForm}
          updateItem={updateJobItem}
          addItem={addJobItem}
          removeItem={removeJobItem}
          close={closeJobModal}
          save={saveJob}
          productDisplayName={productDisplayName}
          locationQuantity={locationQuantity}
          lockLocation={isTechnician}
        />
      )}

      {invoiceJob && (
        <InvoiceModal
          job={invoiceJob}
          invoiceNo={invoiceNo}
          setInvoiceNo={setInvoiceNo}
          saving={invoiceSaving}
          error={invoiceError}
          close={closeInvoiceModal}
          save={saveInvoice}
        />
      )}

      {accessUser && (
        <UserAccessModal
          user={accessUser}
          form={accessForm}
          locations={locations}
          saving={accessSaving}
          error={accessError}
          updateForm={updateAccessForm}
          close={closeUserAccess}
          save={saveUserAccess}
          resendInvite={resendUserInvite}
          deleteUser={deleteUserAccount}
          isCurrentUser={accessUser.user_id === session?.user?.id}
        />
      )}

      {inviteOpen && (
        <InviteUserModal
          form={inviteForm}
          locations={locations}
          saving={inviteSaving}
          error={inviteError}
          updateForm={updateInviteForm}
          close={closeInviteUser}
          save={sendInvite}
        />
      )}

      {productEditor && (
        <ProductSettingsModal
          form={productForm}
          isNew={!productEditor.id}
          saving={productSaving}
          error={productError}
          updateForm={updateProductForm}
          close={closeProductEditor}
          save={saveProductSetting}
        />
      )}

      {locationEditor && (
        <LocationSettingsModal
          form={locationForm}
          isNew={!locationEditor.id}
          saving={locationSaving}
          error={locationError}
          updateForm={updateLocationForm}
          close={closeLocationEditor}
          save={saveLocationSetting}
        />
      )}

      {passwordOpen && (
        <PasswordModal
          form={passwordForm}
          setForm={setPasswordForm}
          saving={passwordSaving}
          error={passwordError}
          close={closePasswordChange}
          save={savePasswordChange}
          inviteLanding={inviteLanding}
        />
      )}

      {bookingEditor && (
        <BookingV6Modal
          editor={bookingEditor}
          form={bookingForm}
          items={bookingItems}
          products={productCatalog.filter((item) => item.active !== false)}
          locations={locations}
          saving={bookingSaving}
          error={bookingError}
          updateForm={updateBookingForm}
          updateItem={updateBookingItem}
          addItem={addBookingItem}
          removeItem={removeBookingItem}
          close={() => !bookingSaving && setBookingEditor(null)}
          save={saveBookingV6}
        />
      )}

      {handoverBooking && (
        <HandoverV6Modal
          booking={handoverBooking}
          form={handoverForm}
          setForm={setHandoverForm}
          locations={locations}
          saving={handoverSaving}
          error={handoverError}
          close={() => !handoverSaving && setHandoverBooking(null)}
          save={saveHandover}
        />
      )}

      {completionBooking && (
        <CompleteInstallationV6Modal
          booking={completionBooking}
          form={completionForm}
          setForm={setCompletionForm}
          files={completionFiles}
          setFiles={setCompletionFiles}
          locations={allowedJobLocations}
          saving={completionSaving}
          error={completionError}
          close={() => !completionSaving && setCompletionBooking(null)}
          save={saveCompleteInstallation}
        />
      )}

      {followupEditor && (
        <FollowupV6Modal
          editor={followupEditor}
          form={followupForm}
          setForm={setFollowupForm}
          locations={locations}
          saving={followupSaving}
          error={followupError}
          close={() => !followupSaving && setFollowupEditor(null)}
          save={saveFollowup}
        />
      )}

      {toast && <div className="app-toast">{toast}</div>}
    </div>
  )
}


function ActionModal({
  mode,
  label,
  inventory,
  locations,
  form,
  items,
  saving,
  error,
  updateForm,
  updateItem,
  addItem,
  removeItem,
  close,
  save,
  productDisplayName,
  locationQuantity,
  availableQuantity,
}) {
  const warehouse =
    locations.find((location) => location.code === 'SVR-JB') ||
    locations[0]

  const selectedFrom = form.from_location_id

  function stockHint(item) {
    if (!item.product_id) return ''

    if (mode === 'transfer' || mode === 'stock_out') {
      return `At source: ${locationQuantity(
        item.product_id,
        selectedFrom
      )}`
    }

    if (mode === 'reserve') {
      return `Available: ${availableQuantity(item.product_id)}`
    }

    return ''
  }

  const titleCopy =
    mode === 'stock_in'
      ? 'Receive new stock'
      : mode === 'transfer'
        ? 'Move stock between locations'
        : mode === 'reserve'
          ? 'Reserve stock for customer'
          : 'Record sold / installed stock'

  return (
    <div className="transaction-backdrop" onClick={close}>
      <section
        className="transaction-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="transaction-modal-head">
          <div>
            <p className="kicker">STOCK ACTION</p>
            <h2>{label}</h2>
            <p>{titleCopy}</p>
          </div>

          <button className="icon-button" onClick={close}>
            <X size={18} />
          </button>
        </div>

        <div className="transaction-scroll">
          {(mode === 'transfer' || mode === 'stock_out') && (
            <div className="transaction-field">
              <label>From Location</label>
              <select
                value={form.from_location_id}
                onChange={(e) =>
                  updateForm('from_location_id', e.target.value)
                }
              >
                <option value="">Select location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(mode === 'stock_in' || mode === 'transfer') && (
            <div className="transaction-field">
              <label>
                {mode === 'stock_in' ? 'Stock In To' : 'To Location'}
              </label>
              <select
                value={form.to_location_id}
                onChange={(e) =>
                  updateForm('to_location_id', e.target.value)
                }
              >
                <option value="">Select location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'reserve' && (
            <>
              <div className="transaction-two-col">
                <div className="transaction-field">
                  <label>Customer Name *</label>
                  <input
                    value={form.customer_name}
                    onChange={(e) =>
                      updateForm('customer_name', e.target.value)
                    }
                    placeholder="e.g. Mr Tan"
                  />
                </div>

                <div className="transaction-field">
                  <label>Phone</label>
                  <input
                    value={form.customer_phone}
                    onChange={(e) =>
                      updateForm('customer_phone', e.target.value)
                    }
                    placeholder="01X-XXXXXXX"
                  />
                </div>
              </div>

              <div className="transaction-two-col">
                <div className="transaction-field">
                  <label>Installation Date</label>
                  <input
                    type="date"
                    value={form.installation_date}
                    onChange={(e) =>
                      updateForm(
                        'installation_date',
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="transaction-field">
                  <label>Area</label>
                  <input
                    value={form.installation_area}
                    onChange={(e) =>
                      updateForm(
                        'installation_area',
                        e.target.value
                      )
                    }
                    placeholder="e.g. Eco Botanic"
                  />
                </div>
              </div>

              <div className="transaction-field">
                <label>Installer / Holder (optional)</label>
                <select
                  value={form.to_location_id}
                  onChange={(e) =>
                    updateForm('to_location_id', e.target.value)
                  }
                >
                  <option value="">Not assigned yet</option>
                  {locations
                    .filter(
                      (location) =>
                        location.id !== warehouse?.id ||
                        location.location_type !== 'warehouse'
                    )
                    .map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}

          {mode === 'stock_out' && (
            <div className="transaction-field">
              <label>Customer / Job Name *</label>
              <input
                value={form.customer_name}
                onChange={(e) =>
                  updateForm('customer_name', e.target.value)
                }
                placeholder="e.g. Mr Lim / Eco Botanic installation"
              />
            </div>
          )}

          <div className="transaction-products">
            <div className="transaction-products-head">
              <div>
                <p className="kicker">ITEMS</p>
                <h3>Products</h3>
              </div>

              <button
                type="button"
                className="add-line-button"
                onClick={addItem}
              >
                <Plus size={15} />
                Add item
              </button>
            </div>

            {items.map((item, index) => (
              <div className="transaction-item" key={index}>
                <div className="transaction-item-main">
                  <select
                    value={item.product_id}
                    onChange={(e) =>
                      updateItem(
                        index,
                        'product_id',
                        e.target.value
                      )
                    }
                  >
                    <option value="">Select product</option>
                    <optgroup label="Smart Locks">
                      {inventory
                        .filter(
                          (product) =>
                            product.category === 'smart_lock'
                        )
                        .map((product) => (
                          <option
                            key={product.product_id}
                            value={product.product_id}
                          >
                            {productDisplayName(product)}
                          </option>
                        ))}
                    </optgroup>

                    <optgroup label="Lock Bodies">
                      {inventory
                        .filter(
                          (product) =>
                            product.category === 'lock_body'
                        )
                        .map((product) => (
                          <option
                            key={product.product_id}
                            value={product.product_id}
                          >
                            {productDisplayName(product)}
                          </option>
                        ))}
                    </optgroup>
                  </select>

                  <div className="transaction-qty">
                    <span>Qty</span>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(
                          index,
                          'quantity',
                          e.target.value
                        )
                      }
                    />
                  </div>

                  <button
                    type="button"
                    className="remove-line-button"
                    onClick={() => removeItem(index)}
                    title="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {stockHint(item) && (
                  <small className="stock-hint">
                    {stockHint(item)}
                  </small>
                )}
              </div>
            ))}
          </div>

          <div className="transaction-two-col">
            <div className="transaction-field">
              <label>Reference No. (optional)</label>
              <input
                value={form.reference_no}
                onChange={(e) =>
                  updateForm('reference_no', e.target.value)
                }
                placeholder="PO / Job / Invoice"
              />
            </div>

            <div className="transaction-field">
              <label>Remark</label>
              <input
                value={form.remark}
                onChange={(e) =>
                  updateForm('remark', e.target.value)
                }
                placeholder="Optional note"
              />
            </div>
          </div>

          {error && (
            <div className="transaction-error">{error}</div>
          )}
        </div>

        <div className="transaction-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={close}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving...' : `Confirm ${label}`}
          </button>
        </div>
      </section>
    </div>
  )
}




function OperationsPage({
  bookings,
  jobs,
  followups,
  productById,
  productDisplayName,
  locationById,
  calendarLocations,
  currentRole,
  profile,
  operationsView,
  setOperationsView,
  openNewBooking,
  openEditBooking,
  openHandover,
  openCompleteInstallation,
  cancelReservation,
  openFollowup,
  canManage,
  canCompleteJobs,
}) {
  const activeBookings = bookings.filter((item) => item.status === 'reserved')
  const promotion = activeBookings.filter((item) => item.booking_type === 'promotion_only')
  const tbc = activeBookings.filter((item) => item.booking_type !== 'promotion_only' && item.schedule_type === 'tbc')
  const estimated = activeBookings.filter((item) => item.booking_type !== 'promotion_only' && item.schedule_type === 'estimated')
  const scheduled = activeBookings.filter((item) => item.booking_type !== 'promotion_only' && item.schedule_type === 'exact')
  const pendingFollowups = followups.filter((item) => ['pending', 'scheduled'].includes(item.status))

  const now = new Date()
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayBookings = scheduled.filter((item) => item.installation_date === localDate)
  const todayFollowups = pendingFollowups.filter((item) => item.scheduled_date === localDate)

  const bookingCard = (booking) => (
    <BookingCardV6
      key={booking.id}
      booking={booking}
      productById={productById}
      productDisplayName={productDisplayName}
      locationById={locationById}
      canManage={canManage}
      canCompleteJobs={canCompleteJobs}
      openEditBooking={openEditBooking}
      openHandover={openHandover}
      openCompleteInstallation={openCompleteInstallation}
      cancelReservation={cancelReservation}
    />
  )

  return (
    <div className="page-stack fade-in">
      <section className="surface-card page-intro operations-intro">
        <div>
          <p className="kicker">SVR DAILY OPERATIONS</p>
          <h2>Bookings & Installation Planner</h2>
          <p>Promotion booking → reserve stock → schedule → hand over → install → pending settle.</p>
        </div>
        {canManage && (
          <button className="primary-button" onClick={openNewBooking}>
            <Plus size={16} /> New Booking
          </button>
        )}
      </section>

      <section className="ops-kpi-grid">
        <div><span>Promotion / Product TBC</span><strong>{promotion.length}</strong><small>No stock reserved</small></div>
        <div><span>Installation TBC</span><strong>{tbc.length}</strong><small>Products reserved</small></div>
        <div><span>Estimated</span><strong>{estimated.length}</strong><small>Waiting exact date</small></div>
        <div className="warning"><span>Pending Settle</span><strong>{pendingFollowups.length}</strong><small>Need follow-up</small></div>
      </section>

      <div className="status-tabs operations-tabs">
        {[
          ['board', 'Board'],
          ['calendar', 'Calendar'],
          ['today', `Today ${todayBookings.length + todayFollowups.length}`],
          ['schedule', `Scheduled ${scheduled.length}`],
          ['pending', `Pending Settle ${pendingFollowups.length}`],
        ].map(([id, label]) => (
          <button key={id} className={operationsView === id ? 'active' : ''} onClick={() => setOperationsView(id)}>{label}</button>
        ))}
      </div>

      {operationsView === 'board' && (
        <section className="ops-board">
          <OpsColumn
            title="Promotion Booked"
            subtitle="Product TBC"
            count={promotion.length}
          >
            {promotion.map(bookingCard)}
          </OpsColumn>

          <OpsColumn
            title="Installation TBC"
            subtitle="Product confirmed / reserved"
            count={tbc.length}
          >
            {tbc.map(bookingCard)}
          </OpsColumn>

          <OpsColumn
            title="Estimated"
            subtitle="Approximate timing"
            count={estimated.length}
          >
            {estimated.map(bookingCard)}
          </OpsColumn>

          <OpsColumn
            title="Scheduled"
            subtitle="Exact date"
            count={scheduled.length}
          >
            {scheduled.map(bookingCard)}
          </OpsColumn>
        </section>
      )}

      {operationsView === 'calendar' && (
        <OperationsCalendarV61
          bookings={activeBookings}
          followups={pendingFollowups}
          jobs={jobs}
          locations={calendarLocations}
          locationById={locationById}
          openEditBooking={openEditBooking}
          openFollowup={openFollowup}
          canManage={canManage}
          currentRole={currentRole}
          profile={profile}
        />
      )}

      {operationsView === 'today' && (
        <section className="ops-list">
          {todayBookings.map(bookingCard)}
          {todayFollowups.map((follow) => {
            const job = jobs.find((item) => item.id === follow.job_id)
            return <FollowupCardV6 key={follow.id} followup={follow} job={job} locationById={locationById} openFollowup={openFollowup} canManage={canManage} currentRole={currentRole} profile={profile} />
          })}
          {todayBookings.length + todayFollowups.length === 0 && <div className="surface-card"><EmptyState title="No jobs today" text="Scheduled installations and follow-up visits will appear here." /></div>}
        </section>
      )}

      {operationsView === 'schedule' && (
        <section className="ops-list">
          {[...scheduled].sort((a,b) => `${a.installation_date}${a.installation_time || ''}`.localeCompare(`${b.installation_date}${b.installation_time || ''}`)).map(bookingCard)}
          {scheduled.length === 0 && <div className="surface-card"><EmptyState title="No exact dates yet" text="Use Estimated or TBC until the customer confirms an installation date." /></div>}
        </section>
      )}

      {operationsView === 'pending' && (
        <section className="ops-list">
          {pendingFollowups.map((follow) => {
            const job = jobs.find((item) => item.id === follow.job_id)
            return <FollowupCardV6 key={follow.id} followup={follow} job={job} locationById={locationById} openFollowup={openFollowup} canManage={canManage} currentRole={currentRole} profile={profile} />
          })}
          {pendingFollowups.length === 0 && <div className="surface-card"><EmptyState title="No pending settle" text="Great — no installation handover is waiting to be settled." /></div>}
        </section>
      )}
    </div>
  )
}


function OperationsCalendarV61({
  bookings,
  followups,
  jobs,
  locations,
  locationById,
  openEditBooking,
  openFollowup,
  canManage,
  currentRole,
  profile,
}) {
  const [calendarMode, setCalendarMode] = useState(() => {
    if (typeof window === 'undefined') return 'month'
    return window.innerWidth <= 720 ? 'week' : 'month'
  })
  const [cursor, setCursor] = useState(() => new Date())
  const [technicianFilter, setTechnicianFilter] = useState(() =>
    currentRole === 'technician' ? profile?.location_id || '' : 'all'
  )

  useEffect(() => {
    if (currentRole === 'technician') {
      setTechnicianFilter(profile?.location_id || '')
    }
  }, [currentRole, profile?.location_id])

  const technicianLocations = (locations || []).filter((location) =>
    ['technician', 'sales_installer', 'partner'].includes(
      location.location_type
    )
  )

  const events = useMemo(() => {
    const bookingEvents = bookings
      .filter(
        (booking) =>
          booking.schedule_type === 'exact' &&
          booking.installation_date
      )
      .map((booking) => ({
        id: `booking-${booking.id}`,
        type: 'installation',
        date: booking.installation_date,
        time: booking.installation_time
          ? String(booking.installation_time).slice(0, 5)
          : '',
        title: booking.customer_name,
        unit: booking.unit_no || '',
        area:
          booking.place_name ||
          booking.installation_area ||
          'Installation',
        address: booking.installation_address || '',
        technicianId: booking.installer_location_id || '',
        record: booking,
      }))

    const followupEvents = followups
      .filter((followup) => followup.scheduled_date)
      .map((followup) => {
        const job = jobs.find((item) => item.id === followup.job_id)
        return {
          id: `followup-${followup.id}`,
          type: 'followup',
          date: followup.scheduled_date,
          time: followup.scheduled_time
            ? String(followup.scheduled_time).slice(0, 5)
            : '',
          title: job?.customer_name || job?.job_no || 'Follow-up',
          unit: job?.unit_no || '',
          area:
            job?.place_name ||
            job?.installation_area ||
            'Pending Settle',
          address: job?.installation_address || '',
          technicianId:
            followup.technician_location_id ||
            job?.technician_location_id ||
            '',
          record: followup,
          job,
        }
      })

    return [...bookingEvents, ...followupEvents]
      .filter((event) => {
        if (!technicianFilter || technicianFilter === 'all') return true
        return event.technicianId === technicianFilter
      })
      .sort((a, b) =>
        `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)
      )
  }, [
    bookings,
    followups,
    jobs,
    technicianFilter,
  ])

  const unscheduled = bookings.filter((booking) => {
    if (booking.schedule_type === 'exact') return false
    if (
      technicianFilter &&
      technicianFilter !== 'all' &&
      booking.installer_location_id !== technicianFilter
    ) {
      return false
    }
    return true
  })

  const title =
    calendarMode === 'month'
      ? cursor.toLocaleDateString('en-MY', {
          month: 'long',
          year: 'numeric',
        })
      : `${startOfWeekMonday(cursor).toLocaleDateString('en-MY', {
          day: 'numeric',
          month: 'short',
        })} – ${addDays(startOfWeekMonday(cursor), 6).toLocaleDateString(
          'en-MY',
          {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }
        )}`

  function moveCalendar(direction) {
    setCursor((current) => {
      const next = new Date(current)
      if (calendarMode === 'month') {
        next.setMonth(next.getMonth() + direction)
      } else {
        next.setDate(next.getDate() + 7 * direction)
      }
      return next
    })
  }

  function eventClick(event) {
    if (!canManage) return

    if (event.type === 'installation') {
      openEditBooking(event.record)
    } else {
      openFollowup(event.record, 'schedule')
    }
  }

  function eventMapUrl(event) {
    return googleMapsUrl(
      event.type === 'installation' ? event.record : event.job
    )
  }

  return (
    <section className="calendar-v61-wrap">
      <div className="surface-card calendar-toolbar">
        <div className="calendar-nav">
          <button
            className="icon-button"
            onClick={() => moveCalendar(-1)}
            title="Previous"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <p className="kicker">OPERATIONS CALENDAR</p>
            <h3>{title}</h3>
          </div>
          <button
            className="icon-button"
            onClick={() => moveCalendar(1)}
            title="Next"
          >
            <ChevronRight size={18} />
          </button>
          <button
            className="secondary-button calendar-today-button"
            onClick={() => setCursor(new Date())}
          >
            Today
          </button>
        </div>

        <div className="calendar-controls">
          <select
            value={technicianFilter}
            onChange={(e) => setTechnicianFilter(e.target.value)}
            disabled={currentRole === 'technician'}
          >
            {currentRole !== 'technician' && (
              <option value="all">All Technicians</option>
            )}
            {technicianLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

          <div className="calendar-mode-toggle">
            <button
              className={calendarMode === 'month' ? 'active' : ''}
              onClick={() => setCalendarMode('month')}
            >
              Month
            </button>
            <button
              className={calendarMode === 'week' ? 'active' : ''}
              onClick={() => setCalendarMode('week')}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {calendarMode === 'month' ? (
        <MonthCalendarV61
          cursor={cursor}
          events={events}
          eventClick={eventClick}
          eventMapUrl={eventMapUrl}
          locationById={locationById}
        />
      ) : (
        <WeekCalendarV61
          cursor={cursor}
          events={events}
          eventClick={eventClick}
          eventMapUrl={eventMapUrl}
          locationById={locationById}
        />
      )}

      <section className="calendar-unscheduled">
        <div className="calendar-unscheduled-head">
          <div>
            <p className="kicker">NOT ON EXACT CALENDAR YET</p>
            <h3>TBC & Estimated</h3>
          </div>
          <strong>{unscheduled.length}</strong>
        </div>

        <div className="calendar-unscheduled-grid">
          {unscheduled.map((booking) => (
            <button
              key={booking.id}
              className="unscheduled-card"
              onClick={() => canManage && openEditBooking(booking)}
            >
              <span
                className={`booking-chip ${
                  booking.booking_type === 'promotion_only'
                    ? 'promo'
                    : booking.schedule_type
                }`}
              >
                {booking.booking_type === 'promotion_only'
                  ? 'PRODUCT TBC'
                  : booking.schedule_type === 'estimated'
                    ? 'ESTIMATED'
                    : 'DATE TBC'}
              </span>
              <strong>{booking.customer_name}</strong>
              <small>
                {booking.unit_no ? `${booking.unit_no} • ` : ''}
                {booking.place_name ||
                  booking.installation_area ||
                  'Site TBC'}
              </small>
              <p>
                {booking.schedule_type === 'estimated'
                  ? booking.estimated_installation
                  : booking.remark || 'Waiting customer confirmation'}
              </p>
            </button>
          ))}

          {unscheduled.length === 0 && (
            <div className="surface-card calendar-empty-card">
              Everything in this filter has an exact date.
            </div>
          )}
        </div>
      </section>
    </section>
  )
}

function MonthCalendarV61({
  cursor,
  events,
  eventClick,
  eventMapUrl,
  locationById,
}) {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const mondayOffset = (first.getDay() + 6) % 7
  const cells = []

  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - mondayOffset + 1
    const date = new Date(year, month, dayNumber)
    const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth
    cells.push({
      key: formatLocalDateKey(date),
      date,
      inMonth,
    })
  }

  const todayKey = formatLocalDateKey(new Date())

  return (
    <div className="surface-card calendar-month-card">
      <div className="calendar-weekday-head">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
          (day) => (
            <span key={day}>{day}</span>
          )
        )}
      </div>

      <div className="calendar-month-grid">
        {cells.map((cell) => {
          const dayEvents = events.filter(
            (event) => event.date === cell.key
          )

          return (
            <div
              key={cell.key}
              className={[
                'calendar-day-cell',
                !cell.inMonth ? 'outside' : '',
                cell.key === todayKey ? 'today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="calendar-day-number">
                <span>{cell.date.getDate()}</span>
                {dayEvents.length > 0 && (
                  <small>{dayEvents.length}</small>
                )}
              </div>

              <div className="calendar-day-events">
                {dayEvents.slice(0, 4).map((event) => (
                  <CalendarEventV61
                    key={event.id}
                    event={event}
                    eventClick={eventClick}
                    mapUrl={eventMapUrl(event)}
                    locationById={locationById}
                  />
                ))}
                {dayEvents.length > 4 && (
                  <small className="calendar-more">
                    +{dayEvents.length - 4} more
                  </small>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekCalendarV61({
  cursor,
  events,
  eventClick,
  eventMapUrl,
  locationById,
}) {
  const start = startOfWeekMonday(cursor)
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(start, index)
  )
  const todayKey = formatLocalDateKey(new Date())

  return (
    <div className="calendar-week-grid">
      {days.map((day) => {
        const key = formatLocalDateKey(day)
        const dayEvents = events.filter((event) => event.date === key)

        return (
          <section
            key={key}
            className={
              key === todayKey
                ? 'surface-card calendar-week-day today'
                : 'surface-card calendar-week-day'
            }
          >
            <div className="calendar-week-day-head">
              <span>
                {day.toLocaleDateString('en-MY', {
                  weekday: 'short',
                })}
              </span>
              <strong>{day.getDate()}</strong>
            </div>

            <div className="calendar-week-day-body">
              {dayEvents.map((event) => (
                <CalendarEventV61
                  key={event.id}
                  event={event}
                  eventClick={eventClick}
                  mapUrl={eventMapUrl(event)}
                  locationById={locationById}
                  expanded
                />
              ))}

              {dayEvents.length === 0 && (
                <small className="calendar-no-event">No jobs</small>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function CalendarEventV61({
  event,
  eventClick,
  mapUrl,
  locationById,
  expanded = false,
}) {
  const tech = locationById(event.technicianId)

  return (
    <div
      className={`calendar-event ${event.type} ${
        expanded ? 'expanded' : ''
      }`}
    >
      <button
        className="calendar-event-main"
        onClick={() => eventClick(event)}
      >
        <span>
          {event.type === 'followup' ? '🔧 ' : ''}
          {event.time || 'TBC'}
        </span>
        <strong>{event.title}</strong>
        {(expanded || event.unit) && (
          <small>
            {event.unit ? `${event.unit} • ` : ''}
            {event.area}
          </small>
        )}
        {expanded && tech && <small>{tech.name}</small>}
      </button>

      {mapUrl && (
        <a
          className="calendar-event-map"
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
          title="Open Google Maps"
        >
          <MapPin size={12} />
        </a>
      )}
    </div>
  )
}

function OpsColumn({ title, subtitle, count, children }) {
  return (
    <div className="ops-column">
      <div className="ops-column-head"><div><h3>{title}</h3><span>{subtitle}</span></div><strong>{count}</strong></div>
      <div className="ops-column-body">{children}{count === 0 && <div className="ops-empty">Nothing here</div>}</div>
    </div>
  )
}

function BookingCardV6({
  booking,
  productById,
  productDisplayName,
  locationById,
  canManage,
  canCompleteJobs,
  openEditBooking,
  openHandover,
  openCompleteInstallation,
  cancelReservation,
}) {
  const installer = locationById(booking.installer_location_id)
  const productTbc = booking.booking_type === 'promotion_only'
  const timing = booking.schedule_type === 'exact'
    ? `${booking.installation_date || ''}${booking.installation_time ? ` • ${String(booking.installation_time).slice(0,5)}` : ''}`
    : booking.schedule_type === 'estimated'
      ? booking.estimated_installation || 'Estimated'
      : 'TBC'

  return (
    <article className="ops-booking-card">
      <div className="ops-booking-head">
        <div>
          <span className={`booking-chip ${productTbc ? 'promo' : booking.schedule_type}`}>
            {productTbc
              ? 'PROMO BOOKED'
              : booking.schedule_type === 'exact'
                ? 'SCHEDULED'
                : booking.schedule_type === 'estimated'
                  ? 'ESTIMATED'
                  : 'DATE TBC'}
          </span>
          <h3>{booking.customer_name}</h3>
          <p>
            {booking.unit_no ? `${booking.unit_no} • ` : ''}
            {booking.installation_area || booking.place_name || 'Area TBC'}
          </p>
        </div>
        {Number(booking.deposit_amount || 0) > 0 && <div className="deposit-chip">Deposit RM{Number(booking.deposit_amount).toFixed(0)}</div>}
      </div>

      <div className="ops-booking-meta">
        <div><CalendarDays size={14} /><span>{timing}</span></div>
        <div><UserRound size={14} /><span>{installer?.name || 'Technician TBC'}</span></div>
      </div>

      {(booking.installation_address || booking.customer_phone) && (
        <div className="site-address-block">
          {booking.installation_address && (
            <div className="site-address-copy">
              <MapPin size={15} />
              <div>
                <strong>
                  {booking.unit_no
                    ? `${booking.unit_no} • ${
                        booking.place_name ||
                        booking.installation_area ||
                        'Site'
                      }`
                    : booking.place_name ||
                      booking.installation_area ||
                      'Installation Site'}
                </strong>
                <span>{booking.installation_address}</span>
              </div>
            </div>
          )}

          <div className="site-quick-links">
            {googleMapsUrl(booking) && (
              <a
                href={googleMapsUrl(booking)}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={14} /> Maps
              </a>
            )}
            {booking.customer_phone && (
              <a href={`tel:${booking.customer_phone}`}>
                <Phone size={14} /> Call
              </a>
            )}
            {whatsappUrl(booking.customer_phone) && (
              <a
                href={whatsappUrl(booking.customer_phone)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      <div className="ops-product-tags">
        {productTbc ? <span className="tbc-product">Product TBC</span> : (booking.reservation_items || []).map((item) => <span key={item.product_id}>{item.quantity}× {productDisplayName(productById(item.product_id))}</span>)}
      </div>

      {booking.selling_price != null && (
        <div className="booking-money-row">
          <span>Price <strong>RM{Number(booking.selling_price).toFixed(0)}</strong></span>
          <span>Balance <strong>RM{Math.max(0, Number(booking.selling_price || 0) - Number(booking.deposit_amount || 0)).toFixed(0)}</strong></span>
        </div>
      )}

      {booking.remark && <p className="ops-remark">{booking.remark}</p>}

      <div className="ops-card-actions">
        {canManage && <button className="secondary-button" onClick={() => openEditBooking(booking, productTbc)}>{productTbc ? 'Confirm Product' : 'Edit'}</button>}
        {canManage && !productTbc && booking.installer_location_id && booking.handover_status !== 'handed_over' && <button className="secondary-button" onClick={() => openHandover(booking)}>Hand Over</button>}
        {canCompleteJobs && !productTbc && <button className="primary-button" onClick={() => openCompleteInstallation(booking)}>Complete Install</button>}
        {canManage && <button className="icon-button danger-small" title="Cancel booking" onClick={() => cancelReservation(booking)}><XCircle size={16} /></button>}
      </div>
    </article>
  )
}

function FollowupCardV6({ followup, job, locationById, openFollowup, canManage, currentRole, profile }) {
  const tech = locationById(followup.technician_location_id || job?.technician_location_id)
  const canResolve = canManage || (currentRole === 'technician' && profile?.location_id === (followup.technician_location_id || job?.technician_location_id))
  return (
    <article className="followup-card">
      <div className="followup-icon"><AlertTriangle size={18} /></div>
      <div className="followup-main">
        <div className="followup-title"><div><span>PENDING SETTLE</span><h3>{job?.customer_name || job?.job_no || 'Installation Job'}</h3></div><strong>{followup.status}</strong></div>
        <p>{followup.issue}</p>
        <div className="followup-meta"><span><UserRound size={13} /> {tech?.name || 'Technician TBC'}</span><span><CalendarDays size={13} /> {followup.scheduled_date || 'Follow-up TBC'} {followup.scheduled_time ? String(followup.scheduled_time).slice(0,5) : ''}</span></div>
        {followup.remark && <small>{followup.remark}</small>}
        <div className="followup-actions">
          {canManage && <button className="secondary-button" onClick={() => openFollowup(followup, 'schedule')}>Schedule / Edit</button>}
          {canResolve && <button className="primary-button" onClick={() => openFollowup(followup, 'resolve')}>Settle Done</button>}
        </div>
      </div>
    </article>
  )
}

function BookingV6Modal({ editor, form, items, products, locations, saving, error, updateForm, updateItem, addItem, removeItem, close, save }) {
  const productConfirmed = form.booking_type === 'product_confirmed'
  return (
    <div className="transaction-backdrop" onClick={close}>
      <section className="transaction-modal booking-v6-modal" onClick={(e) => e.stopPropagation()}>
        <div className="transaction-modal-head"><div><p className="kicker">{editor.type === 'new' ? 'NEW BOOKING' : 'EDIT BOOKING'}</p><h2>{editor.type === 'new' ? 'Create Booking' : 'Update Booking'}</h2><p>It is okay if product or installation date is still TBC.</p></div><button className="icon-button" onClick={close}><X size={18} /></button></div>
        <div className="transaction-scroll">
          <div className="transaction-two-col">
            <div className="transaction-field"><label>Customer Name *</label><input value={form.customer_name} onChange={(e) => updateForm('customer_name', e.target.value)} /></div>
            <div className="transaction-field"><label>Phone</label><input value={form.customer_phone} onChange={(e) => updateForm('customer_phone', e.target.value)} /></div>
          </div>
          <div className="transaction-two-col">
            <div className="transaction-field">
              <label>Unit / House No.</label>
              <input
                value={form.unit_no}
                onChange={(e) => updateForm('unit_no', e.target.value)}
                placeholder="e.g. A-18-07 / No. 22"
              />
            </div>
            <div className="transaction-field">
              <label>Area / Project</label>
              <input
                value={form.installation_area}
                onChange={(e) =>
                  updateForm('installation_area', e.target.value)
                }
                placeholder="Eco Botanic / One49 Residence"
              />
            </div>
          </div>

          <div className="transaction-field address-field">
            <label>Google Place Search</label>
            <GooglePlacesAddress
              currentAddress={form.installation_address}
              onPlaceSelected={(place) => {
                updateForm(
                  'installation_address',
                  place.installation_address
                )
                updateForm('place_name', place.place_name)
                updateForm('google_place_id', place.google_place_id)
                updateForm('latitude', place.latitude)
                updateForm('longitude', place.longitude)

                if (!form.installation_area && place.place_name) {
                  updateForm('installation_area', place.place_name)
                }
              }}
            />
          </div>

          <div className="transaction-field">
            <label>Installation Address</label>
            <textarea
              rows="2"
              value={form.installation_address}
              onChange={(e) => {
                updateForm('installation_address', e.target.value)
                // Manual edits mean the saved address may no longer be
                // identical to the Google place selected.
                updateForm('google_place_id', '')
                updateForm('latitude', null)
                updateForm('longitude', null)
              }}
              placeholder="Select from Google Places or type manually"
            />
          </div>

          <div className="booking-type-switch">
            <button className={form.booking_type === 'promotion_only' ? 'active' : ''} onClick={() => updateForm('booking_type', 'promotion_only')}><Star size={16} /><strong>Promotion Booking</strong><span>Product TBC • no stock reserved</span></button>
            <button className={form.booking_type === 'product_confirmed' ? 'active' : ''} onClick={() => updateForm('booking_type', 'product_confirmed')}><PackageCheck size={16} /><strong>Product Confirmed</strong><span>Reserve selected stock</span></button>
          </div>

          <div className="transaction-two-col">
            <div className="transaction-field"><label>Promotion / Deal</label><input value={form.promotion_name} onChange={(e) => updateForm('promotion_name', e.target.value)} placeholder="Sept Promo / Combo 2" /></div>
            <div className="transaction-field"><label>Payment Status</label><select value={form.payment_status} onChange={(e) => updateForm('payment_status', e.target.value)}><option value="not_paid">Not Paid</option><option value="deposit_paid">Deposit Paid</option><option value="partial_paid">Partial Paid</option><option value="fully_paid">Fully Paid</option></select></div>
          </div>
          <div className="transaction-two-col">
            <div className="transaction-field"><label>Selling Price (RM)</label><input type="number" min="0" value={form.selling_price} onChange={(e) => updateForm('selling_price', e.target.value)} /></div>
            <div className="transaction-field"><label>Deposit (RM)</label><input type="number" min="0" value={form.deposit_amount} onChange={(e) => updateForm('deposit_amount', e.target.value)} /></div>
          </div>

          {productConfirmed && (
            <div className="transaction-products"><div className="transaction-products-head"><div><p className="kicker">RESERVED PRODUCTS</p><h3>Smart Lock / Lock Body</h3></div><button type="button" className="add-line-button" onClick={addItem}><Plus size={15} /> Add item</button></div>
              {items.map((item, index) => <div className="transaction-item" key={index}><div className="transaction-item-main"><select value={item.product_id} onChange={(e) => updateItem(index, 'product_id', e.target.value)}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.app_variant ? ` (${product.app_variant})` : ''}</option>)}</select><div className="transaction-qty"><span>Qty</span><input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} /></div><button type="button" className="remove-line-button" onClick={() => removeItem(index)}><Trash2 size={16} /></button></div></div>)}
            </div>
          )}

          <div className="transaction-field"><label>Installation Timing</label><div className="timing-options">{[['tbc','TBC'],['estimated','Estimated'],['exact','Exact Date']].map(([id,label]) => <button key={id} className={form.schedule_type === id ? 'active' : ''} onClick={() => updateForm('schedule_type', id)}>{label}</button>)}</div></div>
          {form.schedule_type === 'estimated' && <div className="transaction-field"><label>Estimated Installation *</label><input value={form.estimated_installation} onChange={(e) => updateForm('estimated_installation', e.target.value)} placeholder="e.g. Dec '26 • house still renovating" /></div>}
          {form.schedule_type === 'exact' && <div className="transaction-two-col"><div className="transaction-field"><label>Date *</label><input type="date" value={form.installation_date} onChange={(e) => updateForm('installation_date', e.target.value)} /></div><div className="transaction-field"><label>Time</label><input type="time" value={form.installation_time} onChange={(e) => updateForm('installation_time', e.target.value)} /></div></div>}
          <div className="transaction-field"><label>Technician / Stock Holder</label><select value={form.installer_location_id} onChange={(e) => updateForm('installer_location_id', e.target.value)}><option value="">TBC / Not assigned</option>{locations.filter((l) => ['technician','sales_installer','partner'].includes(l.location_type)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
          <div className="transaction-field"><label>Remark</label><textarea rows="3" value={form.remark} onChange={(e) => updateForm('remark', e.target.value)} placeholder="Customer house still renovating, expected Dec '26..." /></div>
          {error && <div className="transaction-error">{error}</div>}
        </div>
        <div className="transaction-footer"><button className="secondary-button" onClick={close} disabled={saving}>Cancel</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Booking'}</button></div>
      </section>
    </div>
  )
}

function HandoverV6Modal({ booking, form, setForm, locations, saving, error, close, save }) {
  return <div className="transaction-backdrop" onClick={close}><section className="mini-modal" onClick={(e) => e.stopPropagation()}><div className="mini-modal-head"><div><p className="kicker">STOCK PREPARATION</p><h2>Hand Over Stock</h2><p>{booking.customer_name} • move reserved items to technician</p></div><button className="icon-button" onClick={close}><X size={18} /></button></div><div className="transaction-field"><label>From</label><select value={form.from_location_id} onChange={(e) => setForm((c) => ({...c, from_location_id:e.target.value}))}><option value="">Select source</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div><div className="transaction-field"><label>To Technician</label><select value={form.to_location_id} onChange={(e) => setForm((c) => ({...c, to_location_id:e.target.value}))}><option value="">Select technician</option>{locations.filter((l) => ['technician','sales_installer','partner'].includes(l.location_type)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>{error && <div className="transaction-error">{error}</div>}<div className="mini-modal-actions"><button className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Moving...' : 'Confirm Handover'}</button></div></section></div>
}

function CompleteInstallationV6Modal({ booking, form, setForm, files, setFiles, locations, saving, error, close, save }) {
  return <div className="transaction-backdrop" onClick={close}><section className="transaction-modal completion-v6-modal" onClick={(e) => e.stopPropagation()}><div className="transaction-modal-head"><div><p className="kicker">TECHNICIAN UPDATE</p><h2>Complete Installation</h2><p>{booking.customer_name} • upload site photos and close / pending settle.</p></div><button className="icon-button" onClick={close}><X size={18} /></button></div><div className="transaction-scroll">
    <div className="transaction-field"><label>Stock Holder / Technician *</label><select value={form.stock_location_id} onChange={(e) => setForm((c) => ({...c, stock_location_id:e.target.value}))}><option value="">Select</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
    <div className="completion-checks"><label><input type="checkbox" checked={form.customer_taught} onChange={(e) => setForm((c) => ({...c, customer_taught:e.target.checked}))} /><span><strong>Customer taught how to use lock</strong><small>Basic usage / app / charging explained</small></span></label><label><input type="checkbox" checked={form.review_asked} onChange={(e) => setForm((c) => ({...c, review_asked:e.target.checked}))} /><span><strong>Asked customer for review</strong><small>Google / Facebook review requested</small></span></label><label><input type="checkbox" checked={form.review_received} onChange={(e) => setForm((c) => ({...c, review_received:e.target.checked, review_asked:e.target.checked || c.review_asked}))} /><span><strong>Review received</strong><small>Customer already submitted review</small></span></label></div>
    <div className="transaction-field"><label>Installation Photos</label><label className="photo-upload-box"><Upload size={22} /><strong>Choose Photos</strong><span>Front / inside / lock body / overall door</span><input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} /></label>{files.length > 0 && <div className="selected-files">{files.map((f) => <span key={`${f.name}-${f.size}`}><ImageIcon size={13} /> {f.name}</span>)}</div>}</div>
    <label className="pending-settle-switch"><input type="checkbox" checked={form.pending_settle} onChange={(e) => setForm((c) => ({...c, pending_settle:e.target.checked}))} /><div><strong>Pending Settle</strong><span>Something is not fully completed and we must return.</span></div></label>
    {form.pending_settle && <div className="transaction-field"><label>What is still not settled? *</label><textarea rows="3" value={form.pending_issue} onChange={(e) => setForm((c) => ({...c, pending_issue:e.target.value}))} placeholder="e.g. Need return to adjust strike plate / replace lock body / Wi-Fi linking..." /></div>}
    <div className="transaction-field"><label>Completion Remark</label><textarea rows="3" value={form.completion_remark} onChange={(e) => setForm((c) => ({...c, completion_remark:e.target.value}))} /></div>
    {error && <div className="transaction-error">{error}</div>}
  </div><div className="transaction-footer"><button className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Saving & Uploading...' : form.pending_settle ? 'Complete • Pending Settle' : 'Complete Installation'}</button></div></section></div>
}

function FollowupV6Modal({ editor, form, setForm, locations, saving, error, close, save }) {
  const resolve = editor.mode === 'resolve'
  return <div className="transaction-backdrop" onClick={close}><section className="mini-modal followup-modal" onClick={(e) => e.stopPropagation()}><div className="mini-modal-head"><div><p className="kicker">PENDING SETTLE</p><h2>{resolve ? 'Settle Completed' : 'Schedule Follow-up'}</h2><p>{editor.job?.customer_name} • {editor.followup.issue}</p></div><button className="icon-button" onClick={close}><X size={18} /></button></div>{resolve ? <><div className="transaction-field"><label>What was settled? *</label><textarea rows="3" value={form.resolution_note} onChange={(e) => setForm((c) => ({...c, resolution_note:e.target.value}))} /></div><div className="completion-checks compact"><label><input type="checkbox" checked={form.review_asked} onChange={(e) => setForm((c) => ({...c, review_asked:e.target.checked}))} /><span><strong>Asked for review</strong></span></label><label><input type="checkbox" checked={form.review_received} onChange={(e) => setForm((c) => ({...c, review_received:e.target.checked, review_asked:e.target.checked || c.review_asked}))} /><span><strong>Review received</strong></span></label></div></> : <><div className="transaction-field"><label>Technician</label><select value={form.technician_location_id} onChange={(e) => setForm((c) => ({...c, technician_location_id:e.target.value}))}><option value="">TBC</option>{locations.filter((l) => ['technician','sales_installer','partner'].includes(l.location_type)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div><div className="transaction-two-col"><div className="transaction-field"><label>Date</label><input type="date" value={form.scheduled_date} onChange={(e) => setForm((c) => ({...c, scheduled_date:e.target.value}))} /></div><div className="transaction-field"><label>Time</label><input type="time" value={form.scheduled_time} onChange={(e) => setForm((c) => ({...c, scheduled_time:e.target.value}))} /></div></div><div className="transaction-field"><label>Remark</label><textarea rows="2" value={form.remark} onChange={(e) => setForm((c) => ({...c, remark:e.target.value}))} /></div></>}{error && <div className="transaction-error">{error}</div>}<div className="mini-modal-actions"><button className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Saving...' : resolve ? 'Mark Settled' : 'Save Follow-up'}</button></div></section></div>
}

function JobModal({
  jobModal,
  form,
  items,
  inventory,
  locations,
  saving,
  error,
  updateForm,
  updateItem,
  addItem,
  removeItem,
  close,
  save,
  productDisplayName,
  locationQuantity,
  lockLocation,
}) {
  const isReservation = jobModal.type === 'reservation'

  return (
    <div className="transaction-backdrop" onClick={close}>
      <section
        className="transaction-modal job-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="transaction-modal-head">
          <div>
            <p className="kicker">
              {isReservation ? 'RESERVED ORDER' : 'INSTALLATION JOB'}
            </p>
            <h2>
              {isReservation ? 'Complete Reservation' : 'Complete Job'}
            </h2>
            <p>
              Record customer, installer and every lock / lock body used.
            </p>
          </div>

          <button className="icon-button" onClick={close}>
            <X size={18} />
          </button>
        </div>

        <div className="transaction-scroll">
          <div className="transaction-two-col">
            <div className="transaction-field">
              <label>Customer Name *</label>
              <input
                value={form.customer_name}
                onChange={(e) =>
                  updateForm('customer_name', e.target.value)
                }
                disabled={isReservation}
                placeholder="e.g. Mr Lim"
              />
            </div>

            <div className="transaction-field">
              <label>Phone</label>
              <input
                value={form.customer_phone}
                onChange={(e) =>
                  updateForm('customer_phone', e.target.value)
                }
                disabled={isReservation}
                placeholder="01X-XXXXXXX"
              />
            </div>
          </div>

          <div className="transaction-two-col">
            <div className="transaction-field">
              <label>Area</label>
              <input
                value={form.installation_area}
                onChange={(e) =>
                  updateForm('installation_area', e.target.value)
                }
                disabled={isReservation}
                placeholder="e.g. Eco Botanic"
              />
            </div>

            <div className="transaction-field">
              <label>Installation Date</label>
              <input
                type="date"
                value={form.installation_date}
                onChange={(e) =>
                  updateForm('installation_date', e.target.value)
                }
                disabled={isReservation}
              />
            </div>
          </div>

          <div className="transaction-field">
            <label>Stock Holder / Installer *</label>
            <select
              value={form.stock_location_id}
              onChange={(e) =>
                updateForm('stock_location_id', e.target.value)
              }
              disabled={lockLocation}
            >
              <option value="">Select installer / stock holder</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <small className="field-help">
              Products used for this Job will be deducted from this
              person's / location's stock.
            </small>
          </div>

          <div className="transaction-products">
            <div className="transaction-products-head">
              <div>
                <p className="kicker">PRODUCTS USED</p>
                <h3>Smart Lock / Lock Body</h3>
              </div>

              {!isReservation && (
                <button
                  type="button"
                  className="add-line-button"
                  onClick={addItem}
                >
                  <Plus size={15} />
                  Add item
                </button>
              )}
            </div>

            {items.map((item, index) => (
              <div className="transaction-item" key={index}>
                <div className="transaction-item-main">
                  <select
                    value={item.product_id}
                    onChange={(e) =>
                      updateItem(index, 'product_id', e.target.value)
                    }
                    disabled={isReservation}
                  >
                    <option value="">Select product</option>
                    <optgroup label="Smart Locks">
                      {inventory
                        .filter(
                          (product) =>
                            product.category === 'smart_lock'
                        )
                        .map((product) => (
                          <option
                            key={product.product_id}
                            value={product.product_id}
                          >
                            {productDisplayName(product)}
                          </option>
                        ))}
                    </optgroup>

                    <optgroup label="Lock Bodies">
                      {inventory
                        .filter(
                          (product) =>
                            product.category === 'lock_body'
                        )
                        .map((product) => (
                          <option
                            key={product.product_id}
                            value={product.product_id}
                          >
                            {productDisplayName(product)}
                          </option>
                        ))}
                    </optgroup>
                  </select>

                  <div className="transaction-qty">
                    <span>Qty</span>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, 'quantity', e.target.value)
                      }
                      disabled={isReservation}
                    />
                  </div>

                  {!isReservation && (
                    <button
                      type="button"
                      className="remove-line-button"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {item.product_id && form.stock_location_id && (
                  <small className="stock-hint">
                    At selected holder:{' '}
                    {locationQuantity(
                      item.product_id,
                      form.stock_location_id
                    )}
                  </small>
                )}
              </div>
            ))}
          </div>

          <div className="transaction-field">
            <label>Remark</label>
            <input
              value={form.remark}
              onChange={(e) =>
                updateForm('remark', e.target.value)
              }
              placeholder="Optional installation note"
            />
          </div>

          {error && (
            <div className="transaction-error">{error}</div>
          )}
        </div>

        <div className="transaction-footer">
          <button
            className="secondary-button"
            onClick={close}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            className="primary-button"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Complete Job'}
          </button>
        </div>
      </section>
    </div>
  )
}

function InvoiceModal({
  job,
  invoiceNo,
  setInvoiceNo,
  saving,
  error,
  close,
  save,
}) {
  return (
    <div className="transaction-backdrop" onClick={close}>
      <section
        className="mini-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mini-modal-head">
          <div>
            <p className="kicker">INVOICE</p>
            <h2>Mark as Invoiced</h2>
            <p>
              {job.job_no} • {job.customer_name}
            </p>
          </div>

          <button className="icon-button" onClick={close}>
            <X size={18} />
          </button>
        </div>

        <div className="transaction-field">
          <label>Invoice No. *</label>
          <input
            autoFocus
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            placeholder="e.g. INV-1028"
          />
        </div>

        {error && (
          <div className="transaction-error">{error}</div>
        )}

        <div className="mini-modal-actions">
          <button
            className="secondary-button"
            onClick={close}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            className="primary-button"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Invoice'}
          </button>
        </div>
      </section>
    </div>
  )
}

function ReservationsPage({
  reservations,
  reservationFilter,
  setReservationFilter,
  productDisplayName,
  productById,
  locationById,
  formatDate,
  cancelReservation,
  openReservationJob,
  setActiveTab,
  canManageReservations,
}) {
  const filtered = reservations.filter(
    (reservation) => reservation.status === reservationFilter
  )

  const counts = {
    reserved: reservations.filter((item) => item.status === 'reserved')
      .length,
    completed: reservations.filter(
      (item) => item.status === 'completed'
    ).length,
    cancelled: reservations.filter(
      (item) => item.status === 'cancelled'
    ).length,
  }

  return (
    <div className="page-stack fade-in">
      <section className="surface-card page-intro reservations-intro">
        <div>
          <p className="kicker">CUSTOMER ORDERS</p>
          <h2>Reservations</h2>
          <p>
            Cancel a booking, complete an installation, and keep the
            full customer history instead of deleting records.
          </p>
        </div>

        <button
          className="text-link"
          onClick={() => setActiveTab('jobs')}
        >
          View Jobs
          <ChevronRight size={15} />
        </button>
      </section>

      <div className="status-tabs">
        {[
          ['reserved', `Active ${counts.reserved}`],
          ['completed', `Completed ${counts.completed}`],
          ['cancelled', `Cancelled ${counts.cancelled}`],
        ].map(([status, label]) => (
          <button
            key={status}
            className={
              reservationFilter === status ? 'active' : ''
            }
            onClick={() => setReservationFilter(status)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="reservation-grid">
        {filtered.map((reservation) => {
          const installer = locationById(
            reservation.installer_location_id
          )

          return (
            <article
              className="reservation-card"
              key={reservation.id}
            >
              <div className="reservation-card-head">
                <div>
                  <span
                    className={`status-badge ${reservation.status}`}
                  >
                    {reservation.status}
                  </span>
                  <h3>{reservation.customer_name}</h3>
                  <p>
                    {reservation.installation_area || 'Area not set'}
                    {reservation.customer_phone
                      ? ` • ${reservation.customer_phone}`
                      : ''}
                  </p>
                </div>

                <PackageCheck size={22} />
              </div>

              <div className="reservation-meta">
                <div>
                  <CalendarDays size={15} />
                  <span>
                    {reservation.installation_date ||
                      'Date not assigned'}
                  </span>
                </div>

                <div>
                  <UserRound size={15} />
                  <span>
                    {installer?.name || 'Installer not assigned'}
                  </span>
                </div>
              </div>

              <div className="reservation-products-readable">
                {(reservation.reservation_items || []).map((item) => (
                  <span key={item.product_id}>
                    {item.quantity}×{' '}
                    {productDisplayName(productById(item.product_id))}
                  </span>
                ))}
              </div>

              <small className="record-date">
                Created {formatDate(reservation.created_at)}
              </small>

              {reservation.status === 'reserved' && (
                <div className="reservation-actions">
                  {canManageReservations && (
                    <button
                      className="secondary-button cancel-reservation"
                      onClick={() => cancelReservation(reservation)}
                    >
                      <XCircle size={16} />
                      Cancel
                    </button>
                  )}

                  <button
                    className="primary-button"
                    onClick={() => openReservationJob(reservation)}
                  >
                    <BadgeCheck size={16} />
                    Complete Job
                  </button>
                </div>
              )}
            </article>
          )
        })}

        {filtered.length === 0 && (
          <div className="surface-card wide-empty">
            <EmptyState
              title={`No ${reservationFilter} reservations`}
              text="Reservations will appear here."
            />
          </div>
        )}
      </section>
    </div>
  )
}

function JobsPage({
  jobs,
  jobFilter,
  setJobFilter,
  productDisplayName,
  productById,
  locationById,
  formatDate,
  openInvoiceModal,
  openDirectJob,
  setActiveTab,
  currentRole,
  canCompleteJobs,
  canInvoiceJobs,
  canVoidJob,
  voidJob,
  deleteJobPermanently,
  isOwner,
  jobPhotos = [],
  followups = [],
  openFollowup,
}) {
  const filtered = jobs.filter((job) => {
    if (jobFilter === 'all') return true
    if (jobFilter === 'voided') return job.status === 'voided'
    if (jobFilter === 'not_invoiced') {
      return (
        job.status === 'completed' &&
        job.invoice_status === 'not_invoiced'
      )
    }
    if (jobFilter === 'invoiced') {
      return (
        job.status === 'completed' &&
        job.invoice_status === 'invoiced'
      )
    }
    return true
  })

  const notInvoiced = jobs.filter(
    (job) =>
      job.status === 'completed' &&
      job.invoice_status === 'not_invoiced'
  ).length

  const invoiced = jobs.filter(
    (job) =>
      job.status === 'completed' && job.invoice_status === 'invoiced'
  ).length

  const voided = jobs.filter((job) => job.status === 'voided').length

  return (
    <div className="page-stack fade-in">
      <section className="surface-card page-intro jobs-intro">
        <div>
          <p className="kicker">INSTALLATION & BILLING</p>
          <h2>Jobs</h2>
          <p>
            Customer, installer, lock, lock body and billing status — all
            tied back to the stock movement.
          </p>
        </div>

        <div className="jobs-intro-actions">
          {['owner', 'admin'].includes(currentRole) && (
            <button
              className="secondary-button"
              onClick={() => setActiveTab('operations')}
            >
              Reservations
            </button>
          )}
        </div>
      </section>

      <div className="status-tabs">
        {[
          ['not_invoiced', `Not Invoiced ${notInvoiced}`],
          ['invoiced', `Invoiced ${invoiced}`],
          ['voided', `Voided ${voided}`],
          ['all', `All ${jobs.length}`],
        ].map(([status, label]) => (
          <button
            key={status}
            className={jobFilter === status ? 'active' : ''}
            onClick={() => setJobFilter(status)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="job-list">
        {filtered.map((job) => {
          const installer = locationById(job.technician_location_id)
          const isVoided = job.status === 'voided'

          return (
            <article
              className={isVoided ? 'job-card job-card-voided' : 'job-card'}
              key={job.id}
            >
              <div className="job-card-main">
                <div className="job-no">
                  <FileText size={18} />
                  <div>
                    <span>{job.job_no}</span>
                    <h3>{job.customer_name}</h3>
                  </div>
                </div>

                <div
                  className={
                    isVoided
                      ? 'invoice-state voided'
                      : job.invoice_status === 'invoiced'
                        ? 'invoice-state invoiced'
                        : 'invoice-state'
                  }
                >
                  {isVoided ? <XCircle size={15} /> : <ReceiptText size={15} />}
                  <span>
                    {isVoided
                      ? 'VOIDED'
                      : job.invoice_status === 'invoiced'
                        ? job.invoice_no || 'Invoiced'
                        : 'Not Invoiced'}
                  </span>
                </div>
              </div>

              <div className="job-details-grid">
                <div>
                  <span>Installer / Stock Holder</span>
                  <strong>{installer?.name || 'Unknown'}</strong>
                </div>
                <div>
                  <span>Area</span>
                  <strong>{job.installation_area || '—'}</strong>
                </div>
                <div>
                  <span>{isVoided ? 'Voided' : 'Completed'}</span>
                  <strong>
                    {formatDate(isVoided ? job.voided_at : job.completed_at)}
                  </strong>
                </div>
              </div>

              {(job.installation_address || job.customer_phone) && (
                <div className="site-address-block job-site-address">
                  {job.installation_address && (
                    <div className="site-address-copy">
                      <MapPin size={15} />
                      <div>
                        <strong>
                          {job.unit_no ? `${job.unit_no} • ` : ''}
                          {job.place_name ||
                            job.installation_area ||
                            'Installation Site'}
                        </strong>
                        <span>{job.installation_address}</span>
                      </div>
                    </div>
                  )}
                  <div className="site-quick-links">
                    {googleMapsUrl(job) && (
                      <a
                        href={googleMapsUrl(job)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin size={14} /> Maps
                      </a>
                    )}
                    {job.customer_phone && (
                      <a href={`tel:${job.customer_phone}`}>
                        <Phone size={14} /> Call
                      </a>
                    )}
                    {whatsappUrl(job.customer_phone) && (
                      <a
                        href={whatsappUrl(job.customer_phone)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="job-products">
                {(job.job_items || []).map((item) => (
                  <span key={item.product_id}>
                    {item.quantity}×{' '}
                    {productDisplayName(productById(item.product_id))}
                  </span>
                ))}
              </div>

              {isVoided && job.void_reason && (
                <div className="void-reason">
                  <strong>Void reason</strong>
                  <span>{job.void_reason}</span>
                </div>
              )}

              <div className="job-ops-status">
                <span className={job.review_received ? 'review-badge received' : job.review_asked ? 'review-badge asked' : 'review-badge'}>
                  <Star size={13} /> {job.review_received ? 'Review Received' : job.review_asked ? 'Review Asked' : 'Review Not Asked'}
                </span>
                {job.settlement_status === 'pending' && <span className="pending-badge"><AlertTriangle size={13} /> Pending Settle</span>}
              </div>

              {job.pending_issue && <div className="job-pending-note"><strong>Pending:</strong> {job.pending_issue}</div>}

              {jobPhotos.filter((photo) => photo.job_id === job.id).length > 0 && (
                <div className="job-photo-strip">
                  {jobPhotos.filter((photo) => photo.job_id === job.id).slice(0, 5).map((photo) => (
                    <a key={photo.id} href={photo.signed_url || '#'} target="_blank" rel="noreferrer">
                      {photo.signed_url ? <img src={photo.signed_url} alt={photo.file_name || 'Installation'} /> : <Camera size={18} />}
                    </a>
                  ))}
                </div>
              )}

              <div className="job-card-actions v5-job-actions">
                <small>
                  {job.reservation_id ? 'From Reservation' : 'Direct Job'}
                </small>

                <div className="job-action-buttons">
                  {!isVoided && canInvoiceJobs && (
                    <button
                      className={
                        job.invoice_status === 'invoiced'
                          ? 'secondary-button'
                          : 'primary-button'
                      }
                      onClick={() => openInvoiceModal(job)}
                    >
                      <ReceiptText size={15} />
                      {job.invoice_status === 'invoiced'
                        ? 'Edit Invoice'
                        : 'Mark Invoiced'}
                    </button>
                  )}

                  {!isVoided && canVoidJob(job) && (
                    <button
                      className="secondary-button danger-soft"
                      onClick={() => voidJob(job)}
                    >
                      <XCircle size={15} />
                      Void
                    </button>
                  )}

                  {isOwner && (
                    <button
                      className="secondary-button danger-outline"
                      onClick={() => deleteJobPermanently(job)}
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </article>
          )
        })}

        {filtered.length === 0 && (
          <div className="surface-card">
            <EmptyState
              title="No jobs here"
              text="Completed installations will appear here."
            />
          </div>
        )}
      </section>
    </div>
  )
}


function Dashboard({
  totals,
  inventory,
  movements,
  reservations,
  jobs,
  followups,
  productDisplayName,
  productById,
  movementTitle,
  movementSubtitle,
  formatDate,
  setActiveTab,
  setMobileActionsOpen,
  openStockCount,
}) {
  const lowStock = inventory.filter(
    (item) =>
      Number(item.minimum_stock || 0) > 0 &&
      Number(item.available_stock || 0) <=
        Number(item.minimum_stock || 0)
  )

  const topProducts = inventory
    .filter((item) => item.category === 'smart_lock')
    .slice(0, 5)

  return (
    <div className="page-stack fade-in">
      <section className="hero-card">
        <div>
          <p className="kicker light">LIVE STOCK OVERVIEW</p>
          <h2>SVR at a glance.</h2>
          <p>
            Stock, bookings and follow-ups — the important things first.
          </p>
        </div>

        <div className="hero-actions">
          <button
            className="secondary-button light-button"
            onClick={openStockCount}
          >
            <ClipboardList size={17} />
            Stock Count
          </button>
          <button
            className="primary-button inverted"
            onClick={() => setMobileActionsOpen(true)}
          >
            Quick Action
            <ChevronRight size={17} />
          </button>
        </div>
      </section>

      <section className="home-stock-snapshot">
        <button
          className="home-stock-card"
          onClick={() => setActiveTab('inventory')}
        >
          <div className="home-stock-card-head">
            <span>Physical</span>
            <Boxes size={17} />
          </div>
          <strong>
            {totals.totalSmartLocks + totals.totalLockBodies}
          </strong>
          <small>
            {totals.totalSmartLocks} locks • {totals.totalLockBodies} bodies
          </small>
        </button>

        <button
          className="home-stock-card"
          onClick={() => setActiveTab('operations')}
        >
          <div className="home-stock-card-head">
            <span>Reserved</span>
            <PackageCheck size={17} />
          </div>
          <strong>{totals.totalReserved}</strong>
          <small>Customer bookings</small>
        </button>

        <button
          className="home-stock-card dark"
          onClick={() => setActiveTab('inventory')}
        >
          <div className="home-stock-card-head">
            <span>Available</span>
            <CheckCircle2 size={17} />
          </div>
          <strong>{totals.totalAvailable}</strong>
          <small>Ready to use / sell</small>
        </button>
      </section>

      <section className="surface-card home-focus-card">
        <div className="home-focus-head">
          <div>
            <p className="kicker">NEEDS ATTENTION</p>
            <h3>Quick follow-up</h3>
          </div>
          <span className="home-focus-total">
            {
              reservations.filter((item) => item.status === 'reserved')
                .length +
              followups.filter((item) =>
                ['pending', 'scheduled'].includes(item.status)
              ).length +
              jobs.filter(
                (item) => item.invoice_status === 'not_invoiced'
              ).length
            }
          </span>
        </div>

        <div className="home-focus-list">
          <button onClick={() => setActiveTab('operations')}>
            <div className="home-focus-icon">
              <CalendarDays size={16} />
            </div>
            <div>
              <strong>Active Bookings</strong>
              <span>Reserved / TBC / scheduled</span>
            </div>
            <b>
              {
                reservations.filter(
                  (item) => item.status === 'reserved'
                ).length
              }
            </b>
            <ChevronRight size={16} />
          </button>

          <button onClick={() => setActiveTab('operations')}>
            <div className="home-focus-icon warning">
              <AlertTriangle size={16} />
            </div>
            <div>
              <strong>Pending Settle</strong>
              <span>Need return / follow-up</span>
            </div>
            <b>
              {
                followups.filter((item) =>
                  ['pending', 'scheduled'].includes(item.status)
                ).length
              }
            </b>
            <ChevronRight size={16} />
          </button>

          <button onClick={() => setActiveTab('jobs')}>
            <div className="home-focus-icon">
              <ReceiptText size={16} />
            </div>
            <div>
              <strong>Not Invoiced</strong>
              <span>Completed jobs to bill</span>
            </div>
            <b>
              {
                jobs.filter(
                  (item) => item.invoice_status === 'not_invoiced'
                ).length
              }
            </b>
            <ChevronRight size={16} />
          </button>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="surface-card">
          <div className="section-head">
            <div>
              <p className="kicker">SMART LOCKS</p>
              <h3>Stock Overview</h3>
            </div>
            <button
              className="text-link"
              onClick={() => setActiveTab('inventory')}
            >
              View all
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="compact-list">
            {topProducts.map((item) => (
              <div className="compact-row" key={item.product_id}>
                <div className="product-dot" />
                <div className="compact-copy">
                  <strong>{productDisplayName(item)}</strong>
                  <span>Smart Lock</span>
                </div>
                <div className="compact-number">
                  <span>Available</span>
                  <strong>{item.available_stock}</strong>
                </div>
                <div className="compact-number">
                  <span>Reserved</span>
                  <strong>{item.reserved_stock}</strong>
                </div>
              </div>
            ))}

            {topProducts.length === 0 && (
              <EmptyState
                title="No inventory yet"
                text="Your products will appear here."
              />
            )}
          </div>
        </section>

        <section className="surface-card">
          <div className="section-head">
            <div>
              <p className="kicker">RECENT</p>
              <h3>Activity</h3>
            </div>
            <button
              className="text-link"
              onClick={() => setActiveTab('activity')}
            >
              View all
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="activity-list compact-activity">
            {movements.slice(0, 6).map((movement) => (
              <ActivityRow
                key={movement.id}
                movement={movement}
                title={movementTitle(movement)}
                subtitle={movementSubtitle(movement)}
                date={formatDate(movement.created_at)}
              />
            ))}

            {movements.length === 0 && (
              <EmptyState
                title="No activity yet"
                text="Stock movements will appear here."
              />
            )}
          </div>
        </section>
      </div>

      {lowStock.length > 0 && (
        <section className="surface-card attention-card">
          <div className="section-head">
            <div>
              <p className="kicker">ATTENTION</p>
              <h3>Low Stock</h3>
            </div>
            <SlidersHorizontal size={18} />
          </div>

          <div className="low-stock-grid">
            {lowStock.map((item) => (
              <div className="low-stock-pill" key={item.product_id}>
                <div>
                  <strong>{productDisplayName(item)}</strong>
                  <span>Minimum {item.minimum_stock}</span>
                </div>
                <b>{item.available_stock}</b>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function MetricCard({ label, value, caption, icon: Icon, dark }) {
  return (
    <article className={dark ? 'metric-card dark' : 'metric-card'}>
      <div className="metric-icon">
        <Icon size={20} strokeWidth={1.8} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{caption}</small>
      </div>
    </article>
  )
}

function InventoryPage({
  inventory,
  search,
  setSearch,
  categoryFilter,
  setCategoryFilter,
  productDisplayName,
  canAddProduct,
  openAddProduct,
}) {
  return (
    <div className="page-stack fade-in">
      <section className="surface-card inventory-toolbar-card">
        <div className="toolbar-copy">
          <p className="kicker">PRODUCT MASTER</p>
          <h2>All Inventory</h2>
          <p>
            Search any smart lock or lock body and see available stock
            immediately.
          </p>
        </div>

        {canAddProduct && (
          <button className="primary-button inventory-add-button" onClick={openAddProduct}>
            <Plus size={16} /> Add Item
          </button>
        )}

        <div className="inventory-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search VB-1, VN-4, G Hook..."
          />
        </div>

        <div className="filter-pills">
          {[
            ['all', 'All'],
            ['smart_lock', 'Smart Locks'],
            ['lock_body', 'Lock Bodies'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={categoryFilter === value ? 'active' : ''}
              onClick={() => setCategoryFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="inventory-grid">
        {inventory.map((item) => (
          <article className="inventory-card" key={item.product_id}>
            <div className="inventory-card-top">
              <div>
                <span className="category-label">
                  {item.category === 'smart_lock'
                    ? 'SMART LOCK'
                    : 'LOCK BODY'}
                </span>
                <h3>{productDisplayName(item)}</h3>
              </div>

              <div className="available-chip">
                <span>Available</span>
                <strong>{item.available_stock}</strong>
              </div>
            </div>

            <div className="inventory-stat-row">
              <div>
                <span>Physical</span>
                <strong>{item.physical_stock}</strong>
              </div>
              <div>
                <span>Reserved</span>
                <strong>{item.reserved_stock}</strong>
              </div>
              <div>
                <span>Minimum</span>
                <strong>{item.minimum_stock}</strong>
              </div>
            </div>
          </article>
        ))}

        {inventory.length === 0 && (
          <div className="surface-card">
            <EmptyState
              title="Nothing found"
              text="Try another search or filter."
            />
          </div>
        )}
      </section>
    </div>
  )
}

function HoldersPage({
  holderSummary,
  setSelectedLocationId,
  openStockCount,
}) {
  const holderIcon = (type) => {
    if (type === 'warehouse') return Warehouse
    if (type === 'technician') return Wrench
    if (type === 'agent') return ShieldCheck
    return UserRound
  }

  async function openHolder(locationId) {
    setSelectedLocationId(locationId)
    await openStockCount(locationId)
  }

  return (
    <div className="page-stack fade-in">
      <section className="surface-card page-intro">
        <p className="kicker">STOCK LOCATION</p>
        <h2>Who is holding the stock?</h2>
        <p>
          Warehouse, technician, installer and agent stock in one clean
          view.
        </p>
      </section>

      <section className="holder-grid">
        {holderSummary.map((holder) => {
          const Icon = holderIcon(holder.location_type)

          return (
            <article className="holder-card" key={holder.id}>
              <div className="holder-icon">
                <Icon size={22} />
              </div>
              <div className="holder-copy">
                <span>{holder.location_type.replaceAll('_', ' ')}</span>
                <h3>{holder.name}</h3>
              </div>
              <div className="holder-stats">
                <div>
                  <span>Units</span>
                  <strong>{holder.units}</strong>
                </div>
                <div>
                  <span>Products</span>
                  <strong>{holder.products}</strong>
                </div>
              </div>
              <button
                className="holder-button"
                onClick={() => openHolder(holder.id)}
              >
                View / Count Stock
                <ChevronRight size={17} />
              </button>
            </article>
          )
        })}
      </section>
    </div>
  )
}

function ActivityPage({
  movements,
  movementTitle,
  movementSubtitle,
  formatDate,
  profileByUserId,
  auditEvents,
}) {
  return (
    <div className="page-stack fade-in">
      {auditEvents.length > 0 && (
        <section className="surface-card">
          <div className="section-head">
            <div>
              <p className="kicker">OWNER / ADMIN</p>
              <h3>Audit Trail</h3>
            </div>
            <span>{auditEvents.length} recent</span>
          </div>

          <div className="audit-list">
            {auditEvents.slice(0, 20).map((event) => {
              const actor = profileByUserId(event.created_by)
              const label = event.event_type
                .replaceAll('_', ' ')
                .replace(/\b\w/g, (letter) => letter.toUpperCase())

              return (
                <div className="audit-row" key={event.id}>
                  <div className="activity-icon">
                    <ShieldCheck size={17} />
                  </div>
                  <div className="activity-copy">
                    <strong>{label}</strong>
                    <span>
                      {event.entity_label || event.entity_type}
                      {' • '}
                      By {actor?.display_name || actor?.email || 'SVR User'}
                    </span>
                  </div>
                  <time>{formatDate(event.created_at)}</time>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="surface-card activity-card">
        <div className="section-head">
          <div>
            <p className="kicker">MOVEMENT HISTORY</p>
            <h3>Stock Activity</h3>
          </div>
          <span>{movements.length} recent</span>
        </div>

        <div className="activity-list full-list">
          {movements.map((movement) => {
            const actor = profileByUserId(movement.created_by)

            return (
              <ActivityRow
                key={movement.id}
                title={movementTitle(movement)}
                subtitle={`${movementSubtitle(movement)}${
                  actor ? ` • By ${actor.display_name || actor.email}` : ''
                }`}
                date={formatDate(movement.created_at)}
              />
            )
          })}

          {movements.length === 0 && (
            <EmptyState
              title="No movement yet"
              text="Stock activity will appear here."
            />
          )}
        </div>
      </section>
    </div>
  )
}



function ActivityRow({ movement, title, subtitle, date }) {
  const movementType = movement?.movement_type

  const positive =
    movementType === 'stock_in' ||
    movementType === 'adjustment_in' ||
    movementType === 'return'

  return (
    <div className="activity-row">
      <div
        className={
          positive ? 'movement-icon positive' : 'movement-icon'
        }
      >
        {positive ? (
          <ArrowDownToLine size={17} />
        ) : (
          <ArrowRightLeft size={17} />
        )}
      </div>

      <div className="activity-copy">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>

      <time>{date}</time>
    </div>
  )
}

function MorePage({
  email,
  profile,
  formatRole,
  onLogout,
  openStockCount,
  setActiveTab,
  canManageInventory,
  canViewUserAccess,
  openPasswordChange,
  openInventorySettings,
}) {
  return (
    <div className="page-stack fade-in more-layout">
      <section className="profile-card">
        <div className="profile-avatar">
          {(profile?.display_name || email)?.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="kicker">SIGNED IN AS</p>
          <h2>{profile?.display_name || 'SVR Inventory User'}</h2>
          <p>{formatRole(profile?.role)} • {email}</p>
        </div>
      </section>

      <section className="surface-card settings-list">
        {canManageInventory && (
          <button onClick={openStockCount}>
            <div className="settings-icon">
              <ClipboardList size={19} />
            </div>
            <div>
              <strong>Stock Count</strong>
              <span>Set or adjust physical stock</span>
            </div>
            <ChevronRight size={17} />
          </button>
        )}

        {canManageInventory && (
          <button onClick={() => setActiveTab('holders')}>
            <div className="settings-icon">
              <Users size={19} />
            </div>
            <div>
              <strong>Stock Holders</strong>
              <span>Warehouse, technicians and agents</span>
            </div>
            <ChevronRight size={17} />
          </button>
        )}

        <button onClick={() => setActiveTab('operations')}>
          <div className="settings-icon"><CalendarDays size={19} /></div>
          <div><strong>Operations</strong><span>Bookings, schedule, handover and pending settle</span></div>
          <ChevronRight size={17} />
        </button>

        <button onClick={() => setActiveTab('activity')}>
          <div className="settings-icon">
            <History size={19} />
          </div>
          <div>
            <strong>Activity</strong>
            <span>Stock movements and audit history</span>
          </div>
          <ChevronRight size={17} />
        </button>

        {canViewUserAccess && (
          <button onClick={() => setActiveTab('users')}>
            <div className="settings-icon">
              <UserCog size={19} />
            </div>
            <div>
              <strong>User Access</strong>
              <span>Owner, Admin, Technician, Agent</span>
            </div>
            <ChevronRight size={17} />
          </button>
        )}

        <button type="button" onClick={openPasswordChange}>
          <div className="settings-icon">
            <KeyRound size={19} />
          </div>
          <div>
            <strong>Change Password</strong>
            <span>Update your SVR Inventory login password</span>
          </div>
          <ChevronRight size={17} />
        </button>

        {canManageInventory && (
          <button type="button" onClick={openInventorySettings}>
            <div className="settings-icon">
              <Settings size={19} />
            </div>
            <div>
              <strong>Inventory Settings</strong>
              <span>Minimum stock, products and stock holders</span>
            </div>
            <ChevronRight size={17} />
          </button>
        )}

        <button className="logout-setting" onClick={onLogout}>
          <div className="settings-icon">
            <LogOut size={19} />
          </div>
          <div>
            <strong>Log Out</strong>
            <span>Sign out of SVR Inventory</span>
          </div>
          <ChevronRight size={17} />
        </button>
      </section>
    </div>
  )
}


function InventorySettingsPage({
  products,
  locations,
  settingsView,
  setSettingsView,
  openProductEditor,
  openLocationEditor,
  goBack,
}) {
  const activeProducts = products.filter((item) => item.active !== false)
  const lowStockConfigured = activeProducts.filter(
    (item) => Number(item.minimum_stock || 0) > 0
  ).length
  const activeLocations = locations.filter((item) => item.active !== false)

  return (
    <div className="page-stack fade-in">
      <section className="surface-card page-intro settings-intro-card">
        <div>
          <p className="kicker">INVENTORY CONTROL</p>
          <h2>Inventory Settings</h2>
          <p>
            Manage minimum stock, product models and every Warehouse / Technician / Agent stock holder.
          </p>
        </div>
        <button className="secondary-button" onClick={goBack}>
          <ArrowLeft size={16} /> Back
        </button>
      </section>

      <section className="settings-stat-grid">
        <div className="settings-stat-card">
          <span>Active Products</span>
          <strong>{activeProducts.length}</strong>
          <small>{lowStockConfigured} with minimum stock target</small>
        </div>
        <div className="settings-stat-card">
          <span>Active Stock Holders</span>
          <strong>{activeLocations.length}</strong>
          <small>Warehouse, technicians, agents & partners</small>
        </div>
      </section>

      <div className="status-tabs settings-tabs">
        <button
          className={settingsView === 'products' ? 'active' : ''}
          onClick={() => setSettingsView('products')}
        >
          Products & Minimum Stock
        </button>
        <button
          className={settingsView === 'locations' ? 'active' : ''}
          onClick={() => setSettingsView('locations')}
        >
          Stock Holders
        </button>
      </div>

      {settingsView === 'products' ? (
        <section className="surface-card settings-management-card">
          <div className="settings-management-head">
            <div>
              <p className="kicker">PRODUCT MANAGEMENT</p>
              <h3>Smart Locks & Lock Bodies</h3>
            </div>
            <button className="primary-button" onClick={() => openProductEditor()}>
              <Plus size={16} /> Add Product
            </button>
          </div>

          <div className="settings-record-list">
            {products.map((product) => (
              <button
                className="settings-record"
                key={product.id}
                onClick={() => openProductEditor(product)}
              >
                <div className="settings-record-icon">
                  {product.category === 'smart_lock' ? (
                    <Boxes size={18} />
                  ) : (
                    <Wrench size={18} />
                  )}
                </div>
                <div className="settings-record-copy">
                  <div>
                    <strong>
                      {product.app_variant
                        ? `${product.name} (${product.app_variant})`
                        : product.name}
                    </strong>
                    <span className={product.active === false ? 'inactive-label' : ''}>
                      {product.active === false ? 'Inactive' : product.sku}
                    </span>
                  </div>
                  <small>
                    Minimum stock: <b>{Number(product.minimum_stock || 0)}</b>
                  </small>
                </div>
                <Pencil size={16} />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="surface-card settings-management-card">
          <div className="settings-management-head">
            <div>
              <p className="kicker">LOCATION MANAGEMENT</p>
              <h3>Stock Holders</h3>
            </div>
            <button className="primary-button" onClick={() => openLocationEditor()}>
              <Plus size={16} /> Add Holder
            </button>
          </div>

          <div className="settings-record-list">
            {locations.map((location) => (
              <button
                className="settings-record"
                key={location.id}
                onClick={() => openLocationEditor(location)}
              >
                <div className="settings-record-icon">
                  <Warehouse size={18} />
                </div>
                <div className="settings-record-copy">
                  <div>
                    <strong>{location.name}</strong>
                    <span className={location.active === false ? 'inactive-label' : ''}>
                      {location.active === false ? 'Inactive' : location.code}
                    </span>
                  </div>
                  <small>{String(location.location_type || '').replaceAll('_', ' ')}</small>
                </div>
                <Pencil size={16} />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ProductSettingsModal({
  form,
  isNew,
  saving,
  error,
  updateForm,
  close,
  save,
}) {
  return (
    <div className="transaction-backdrop" onClick={close}>
      <section className="mini-modal settings-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mini-modal-head">
          <div>
            <p className="kicker">{isNew ? 'NEW PRODUCT' : 'EDIT PRODUCT'}</p>
            <h2>{isNew ? 'Add Product' : 'Product Settings'}</h2>
            <p>Product details and minimum stock warning target.</p>
          </div>
          <button className="icon-button" onClick={close}><X size={18} /></button>
        </div>

        <div className="settings-form-grid">
          <div className="transaction-field">
            <label>SKU *</label>
            <input value={form.sku} onChange={(e) => updateForm('sku', e.target.value)} placeholder="e.g. VN-4" />
          </div>
          <div className="transaction-field">
            <label>Product Name *</label>
            <input value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="e.g. VN-4" />
          </div>
          <div className="transaction-field">
            <label>Category</label>
            <select value={form.category} onChange={(e) => updateForm('category', e.target.value)}>
              <option value="smart_lock">Smart Lock</option>
              <option value="lock_body">Lock Body</option>
            </select>
          </div>
          <div className="transaction-field">
            <label>App Variant</label>
            <input value={form.app_variant} onChange={(e) => updateForm('app_variant', e.target.value)} placeholder="Tuya / TTLock / blank" />
          </div>
          <div className="transaction-field full-field">
            <label>Minimum Stock</label>
            <input type="number" min="0" inputMode="numeric" value={form.minimum_stock} onChange={(e) => updateForm('minimum_stock', e.target.value)} />
            <small className="field-help">Available stock at or below this number will show as Low Stock.</small>
          </div>
        </div>

        {!isNew && (
          <label className="settings-toggle-row">
            <div>
              <strong>Active Product</strong>
              <span>Inactive products cannot be selected for new stock transactions.</span>
            </div>
            <input type="checkbox" checked={form.active} onChange={(e) => updateForm('active', e.target.checked)} />
          </label>
        )}

        {error && <div className="transaction-error">{error}</div>}
        <div className="mini-modal-actions">
          <button className="secondary-button" onClick={close} disabled={saving}>Cancel</button>
          <button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Product'}</button>
        </div>
      </section>
    </div>
  )
}

function LocationSettingsModal({
  form,
  isNew,
  saving,
  error,
  updateForm,
  close,
  save,
}) {
  return (
    <div className="transaction-backdrop" onClick={close}>
      <section className="mini-modal settings-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mini-modal-head">
          <div>
            <p className="kicker">{isNew ? 'NEW STOCK HOLDER' : 'EDIT STOCK HOLDER'}</p>
            <h2>{isNew ? 'Add Stock Holder' : 'Stock Holder Settings'}</h2>
            <p>Warehouse, technician, installer, agent or partner location.</p>
          </div>
          <button className="icon-button" onClick={close}><X size={18} /></button>
        </div>

        <div className="settings-form-grid">
          <div className="transaction-field">
            <label>Location Code *</label>
            <input value={form.code} onChange={(e) => updateForm('code', e.target.value)} placeholder="e.g. MELAKA" />
          </div>
          <div className="transaction-field">
            <label>Name *</label>
            <input value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="e.g. Melaka - Ah Wei" />
          </div>
          <div className="transaction-field full-field">
            <label>Type</label>
            <select value={form.location_type} onChange={(e) => updateForm('location_type', e.target.value)}>
              <option value="warehouse">Warehouse</option>
              <option value="technician">Technician</option>
              <option value="sales_installer">Sales Installer</option>
              <option value="agent">Agent</option>
              <option value="partner">Partner</option>
            </select>
          </div>
        </div>

        {!isNew && (
          <label className="settings-toggle-row">
            <div>
              <strong>Active Stock Holder</strong>
              <span>To deactivate, the holder must have zero stock and no active linked user.</span>
            </div>
            <input type="checkbox" checked={form.active} onChange={(e) => updateForm('active', e.target.checked)} />
          </label>
        )}

        {error && <div className="transaction-error">{error}</div>}
        <div className="mini-modal-actions">
          <button className="secondary-button" onClick={close} disabled={saving}>Cancel</button>
          <button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Holder'}</button>
        </div>
      </section>
    </div>
  )
}

function UserAccessPage({
  profiles,
  locations,
  currentUserId,
  formatRole,
  locationById,
  openUserAccess,
  openInviteUser,
}) {
  return (
    <div className="page-stack fade-in">
      <section className="surface-card page-intro users-intro">
        <div>
          <p className="kicker">OWNER CONTROL</p>
          <h2>User Access</h2>
          <p>
            Invite staff directly from SVR Inventory, then control their
            role and linked stock location here.
          </p>
        </div>

        <button className="primary-button invite-user-button" onClick={openInviteUser}>
          <UserPlus size={16} />
          Add User
        </button>
      </section>

      <section className="access-role-guide">
        <div><strong>Owner</strong><span>Everything + permanent delete + user access</span></div>
        <div><strong>Admin</strong><span>Full operations + invoice + void, no permanent delete</span></div>
        <div><strong>Technician</strong><span>Own stock + own Jobs + Void own uninvoiced Job</span></div>
        <div><strong>Agent</strong><span>Own stock / records only</span></div>
      </section>

      <section className="user-access-list">
        {profiles.map((user) => {
          const location = locationById(user.location_id)
          const isCurrent = user.user_id === currentUserId

          return (
            <article className="user-access-card" key={user.user_id}>
              <div className="user-access-main">
                <div className="user-avatar-small">
                  {(user.display_name || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="user-name-line">
                    <h3>{user.display_name || 'SVR User'}</h3>
                    {isCurrent && <span className="you-badge">YOU</span>}
                    {!user.active && <span className="inactive-badge">INACTIVE</span>}
                  </div>
                  <p>{user.email}</p>
                </div>
              </div>

              <div className="user-access-meta">
                <div>
                  <span>Role</span>
                  <strong>{formatRole(user.role)}</strong>
                </div>
                <div>
                  <span>Stock Location</span>
                  <strong>{location?.name || '—'}</strong>
                </div>
              </div>

              <button
                className="secondary-button user-edit-button"
                onClick={() => openUserAccess(user)}
              >
                <UserCog size={15} /> Edit Access
              </button>
            </article>
          )
        })}
      </section>

      <section className="surface-card access-note">
        <ShieldCheck size={20} />
        <div>
          <strong>Secure invitation flow</strong>
          <span>
            Add User sends an invitation email. The invited person opens the
            link, sets their own password, then logs in with the role you assigned.
          </span>
        </div>
      </section>
    </div>
  )
}


function InviteUserModal({
  form,
  locations,
  saving,
  error,
  updateForm,
  close,
  save,
}) {
  const needsLocation = ['technician', 'agent'].includes(form.role)

  return (
    <div className="transaction-backdrop" onClick={close}>
      <section
        className="mini-modal access-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mini-modal-head">
          <div>
            <p className="kicker">OWNER ONLY</p>
            <h2>Add User</h2>
            <p>Send an SVR Inventory invitation by email.</p>
          </div>
          <button className="icon-button" onClick={close}>
            <X size={18} />
          </button>
        </div>

        <div className="transaction-field">
          <label>Name *</label>
          <input
            value={form.display_name}
            onChange={(e) => updateForm('display_name', e.target.value)}
            placeholder="e.g. Jie"
          />
        </div>

        <div className="transaction-field">
          <label>Email *</label>
          <input
            type="email"
            autoCapitalize="none"
            value={form.email}
            onChange={(e) => updateForm('email', e.target.value)}
            placeholder="name@example.com"
          />
        </div>

        <div className="transaction-field">
          <label>Role</label>
          <select
            value={form.role}
            onChange={(e) => updateForm('role', e.target.value)}
          >
            <option value="viewer">Viewer</option>
            <option value="technician">Technician</option>
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
        </div>

        {needsLocation && (
          <div className="transaction-field">
            <label>Linked Stock Holder *</label>
            <select
              value={form.location_id}
              onChange={(e) => updateForm('location_id', e.target.value)}
            >
              <option value="">Select stock holder</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="invite-security-note">
          <ShieldCheck size={17} />
          <span>
            Password is never created by the Owner. The user sets it from
            the secure invitation link.
          </span>
        </div>

        {error && <div className="transaction-error">{error}</div>}

        <div className="mini-modal-actions">
          <button
            className="secondary-button"
            onClick={close}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="primary-button"
            onClick={save}
            disabled={saving}
          >
            <UserPlus size={15} />
            {saving ? 'Sending...' : 'Send Invitation'}
          </button>
        </div>
      </section>
    </div>
  )
}

function PasswordModal({
  form,
  setForm,
  saving,
  error,
  close,
  save,
  inviteLanding,
}) {
  return (
    <div className="transaction-backdrop" onClick={close}>
      <section
        className="mini-modal access-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mini-modal-head">
          <div>
            <p className="kicker">
              {inviteLanding ? 'WELCOME TO SVR' : 'ACCOUNT SECURITY'}
            </p>
            <h2>
              {inviteLanding ? 'Set Your Password' : 'Change Password'}
            </h2>
            <p>
              {inviteLanding
                ? 'Create your password to finish setting up the account.'
                : 'Use at least 8 characters.'}
            </p>
          </div>
          <button className="icon-button" onClick={close}>
            <X size={18} />
          </button>
        </div>

        <div className="transaction-field">
          <label>New Password *</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                password: e.target.value,
              }))
            }
            placeholder="Minimum 8 characters"
          />
        </div>

        <div className="transaction-field">
          <label>Confirm Password *</label>
          <input
            type="password"
            value={form.confirm}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                confirm: e.target.value,
              }))
            }
            placeholder="Type the same password again"
          />
        </div>

        {error && <div className="transaction-error">{error}</div>}

        <div className="mini-modal-actions">
          <button
            className="secondary-button"
            onClick={close}
            disabled={saving}
          >
            Later
          </button>
          <button
            className="primary-button"
            onClick={save}
            disabled={saving}
          >
            <KeyRound size={15} />
            {saving ? 'Saving...' : 'Save Password'}
          </button>
        </div>
      </section>
    </div>
  )
}

function UserAccessModal({
  user,
  form,
  locations,
  saving,
  error,
  updateForm,
  close,
  save,
  resendInvite,
  deleteUser,
  isCurrentUser,
}) {
  const needsLocation = ['technician', 'agent'].includes(form.role)

  return (
    <div className="transaction-backdrop" onClick={close}>
      <section className="mini-modal access-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mini-modal-head">
          <div>
            <p className="kicker">OWNER ONLY</p>
            <h2>Edit User Access</h2>
            <p>{user.email}</p>
          </div>
          <button className="icon-button" onClick={close}>
            <X size={18} />
          </button>
        </div>

        <div className="transaction-field">
          <label>Display Name</label>
          <input
            value={form.display_name}
            onChange={(e) => updateForm('display_name', e.target.value)}
            placeholder="e.g. Jie"
          />
        </div>

        <div className="transaction-field">
          <label>Role</label>
          <select
            value={form.role}
            onChange={(e) => updateForm('role', e.target.value)}
          >
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="technician">Technician</option>
            <option value="agent">Agent</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>

        {needsLocation && (
          <div className="transaction-field">
            <label>Linked Stock Holder *</label>
            <select
              value={form.location_id}
              onChange={(e) => updateForm('location_id', e.target.value)}
            >
              <option value="">Select stock holder</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <label className="access-active-toggle">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => updateForm('active', e.target.checked)}
          />
          <div>
            <strong>Account Active</strong>
            <span>Inactive users will be blocked from the App after final lockdown.</span>
          </div>
        </label>

        {error && <div className="transaction-error">{error}</div>}

        <div className="user-account-actions">
          <button
            className="secondary-button"
            onClick={resendInvite}
            disabled={saving || isCurrentUser}
          >
            <RefreshCw size={15} />
            Resend Invite
          </button>

          <button
            className="danger-button"
            onClick={deleteUser}
            disabled={saving || isCurrentUser}
          >
            <Trash2 size={15} />
            Delete User
          </button>
        </div>

        {isCurrentUser && (
          <div className="access-self-note">
            Your own Owner account cannot be resent or deleted here.
          </div>
        )}

        <div className="mini-modal-actions">
          <button className="secondary-button" onClick={close} disabled={saving}>
            Cancel
          </button>
          <button className="primary-button" onClick={save} disabled={saving}>
            {saving ? 'Working...' : 'Save Access'}
          </button>
        </div>
      </section>
    </div>
  )
}


function StockCountPage({
  locations,
  selectedLocationId,
  selectedLocation,
  handleLocationChange,
  stockCountCategory,
  setStockCountCategory,
  stockCountProducts,
  stockCountLoading,
  holderStock,
  stockCountValues,
  adjustStockCount,
  updateStockCount,
  productDisplayName,
  stockCountChanges,
  stockCountSaving,
  saveStockCount,
  stockCountMessage,
  stockCountError,
  goBack,
}) {
  return (
    <div className="stock-count-shell fade-in">
      <div className="stock-count-heading">
        <button className="icon-button" onClick={goBack}>
          <ArrowLeft size={19} />
        </button>

        <div>
          <p className="kicker">PHYSICAL STOCK</p>
          <h2>Stock Count</h2>
          <p>
            Enter the actual stock physically held at this location.
          </p>
        </div>
      </div>

      <section className="surface-card count-location">
        <label>Stock Holder / Location</label>
        <select
          value={selectedLocationId}
          onChange={handleLocationChange}
        >
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>

        <span>
          Counting:
          <strong> {selectedLocation?.name || 'Select location'}</strong>
        </span>
      </section>

      <div className="filter-pills count-filters">
        {[
          ['smart_lock', 'Smart Locks'],
          ['lock_body', 'Lock Bodies'],
          ['all', 'All Products'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={stockCountCategory === value ? 'active' : ''}
            onClick={() => setStockCountCategory(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {stockCountLoading ? (
        <div className="surface-card count-loading">
          <RefreshCw className="spin" size={20} />
          Loading stock...
        </div>
      ) : (
        <div className="count-list">
          {stockCountProducts.map((item) => {
            const current = Number(holderStock[item.product_id] || 0)
            const value = Number(stockCountValues[item.product_id] || 0)
            const changed = current !== value

            return (
              <article
                key={item.product_id}
                className={
                  changed ? 'count-row changed' : 'count-row'
                }
              >
                <div className="count-row-copy">
                  <span>
                    {item.category === 'smart_lock'
                      ? 'SMART LOCK'
                      : 'LOCK BODY'}
                  </span>
                  <strong>{productDisplayName(item)}</strong>
                  <small>System now: {current}</small>
                </div>

                <div className="qty-control">
                  <button
                    onClick={() =>
                      adjustStockCount(item.product_id, -1)
                    }
                    disabled={value <= 0}
                  >
                    −
                  </button>

                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={value}
                    onChange={(e) =>
                      updateStockCount(
                        item.product_id,
                        e.target.value
                      )
                    }
                  />

                  <button
                    onClick={() =>
                      adjustStockCount(item.product_id, 1)
                    }
                  >
                    +
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="count-sticky">
        <div className="count-save-main">
          <div className="count-change-summary">
            <span>Changed</span>
            <strong>{stockCountChanges}</strong>
          </div>

          <button
            className="primary-button count-save-button"
            onClick={saveStockCount}
            disabled={
              stockCountSaving ||
              stockCountLoading ||
              stockCountChanges === 0
            }
          >
            {stockCountSaving ? (
              'Saving...'
            ) : stockCountChanges === 0 ? (
              'No Changes'
            ) : (
              <>
                <Save size={15} />
                <span>Save Count</span>
              </>
            )}
          </button>
        </div>

        {stockCountMessage && (
          <p className="save-message success">{stockCountMessage}</p>
        )}

        {stockCountError && (
          <p className="save-message error">{stockCountError}</p>
        )}
      </div>
    </div>
  )
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <Boxes size={24} strokeWidth={1.5} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  )
}

export default App
