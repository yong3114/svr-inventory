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


function leaveDateTimeLabel(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-MY', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function approvedLeaveConflict(leaves, technicianLocationId, date, time = '') {
  if (!technicianLocationId || !date) return false
  const startDay = new Date(`${date}T00:00:00+08:00`).getTime()
  const endDay = new Date(`${date}T23:59:59+08:00`).getTime()
  const point = time ? new Date(`${date}T${time}:00+08:00`).getTime() : null

  return (leaves || []).some((leave) => {
    if (leave.status !== 'approved' || leave.technician_location_id !== technicianLocationId) return false
    const leaveStart = new Date(leave.start_at).getTime()
    const leaveEnd = new Date(leave.end_at).getTime()
    if (point != null) return point >= leaveStart && point < leaveEnd
    return leaveStart <= endDay && leaveEnd > startDay
  })
}

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'technician', label: 'My Work', icon: Wrench },
  { id: 'crm', label: 'CRM Leads', icon: MessageCircle },
  { id: 'operations', label: 'Operations', icon: CalendarDays },
  { id: 'customers', label: 'Customers', icon: Users },
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
  const [crmLeads, setCrmLeads] = useState([])
  const [crmLeadNotes, setCrmLeadNotes] = useState([])
  const [leadStatusFilter, setLeadStatusFilter] = useState('new')
  const [leadEditor, setLeadEditor] = useState(null)
  const [leadDetail, setLeadDetail] = useState(null)
  const [leadUpdateForm, setLeadUpdateForm] = useState({
    status: 'follow_up',
    note: '',
  })
  const [leadUpdateSaving, setLeadUpdateSaving] = useState(false)
  const [leadUpdateError, setLeadUpdateError] = useState('')
  const [leadForm, setLeadForm] = useState({
    customer_name: '', phone: '', source: 'WhatsApp', region_code: 'jb', region_other: '', area: '',
    interest_text: '', status: 'new', lead_date: formatLocalDateKey(new Date()),
    remark: '',
  })
  const [leadSaving, setLeadSaving] = useState(false)
  const [leadError, setLeadError] = useState('')
  const [customerDetail, setCustomerDetail] = useState(null)
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

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirm: '',
  })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')

  const [activeTab, setActiveTab] = useState('home')
  const historyReadyRef = useRef(false)
  const restoringHistoryRef = useRef(false)

  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [inventoryDetailItem, setInventoryDetailItem] = useState(null)
  const [inventoryDetailMovements, setInventoryDetailMovements] = useState([])
  const [inventoryDetailLoading, setInventoryDetailLoading] = useState(false)
  const [inventoryDetailError, setInventoryDetailError] = useState('')
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [adjustStockItem, setAdjustStockItem] = useState(null)
  const [adjustStockForm, setAdjustStockForm] = useState({
    location_id: '',
    actual_quantity: 0,
    reason: '',
  })
  const [adjustStockSaving, setAdjustStockSaving] = useState(false)
  const [adjustStockError, setAdjustStockError] = useState('')
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'inventory' && inventoryDetailItem) {
      setInventoryDetailItem(null)
      setInventoryDetailError('')
    }
  }, [activeTab, inventoryDetailItem])

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


  const [operationsView, setOperationsView] = useState('calendar')

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
    technician_note: '',
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
  const [completionLockBodies, setCompletionLockBodies] = useState([{ product_id: '', quantity: 1 }])
  const [completionSaving, setCompletionSaving] = useState(false)
  const [completionError, setCompletionError] = useState('')

  const [technicianLeaves, setTechnicianLeaves] = useState([])
  const [leaveEditor, setLeaveEditor] = useState(false)
  const [leaveForm, setLeaveForm] = useState(() => ({
    full_day: true,
    start_date: formatLocalDateKey(new Date()),
    start_time: '09:00',
    end_date: formatLocalDateKey(new Date()),
    end_time: '18:00',
    reason: '',
  }))
  const [leaveSaving, setLeaveSaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')

  const [completedEditJob, setCompletedEditJob] = useState(null)
  const [completedEditForm, setCompletedEditForm] = useState({
    customer_taught: false,
    review_asked: false,
    review_received: false,
    completion_remark: '',
  })
  const [completedEditLockBodies, setCompletedEditLockBodies] = useState([{ product_id: '', quantity: 1 }])
  const [completedEditFiles, setCompletedEditFiles] = useState([])
  const [completedEditSaving, setCompletedEditSaving] = useState(false)
  const [completedEditError, setCompletedEditError] = useState('')

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
    if (adjustStockItem) {
      setAdjustStockItem(null)
      setAdjustStockError('')
      return true
    }
    if (globalSearchOpen) {
      setGlobalSearchOpen(false)
      setGlobalSearch('')
      return true
    }
    if (inventoryDetailItem) {
      setInventoryDetailItem(null)
      setInventoryDetailError('')
      return true
    }
    if (passwordOpen) {
      setPasswordOpen(false)
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
    if (leadDetail) {
      setLeadDetail(null)
      setLeadUpdateError('')
      return true
    }
    if (customerDetail) {
      setCustomerDetail(null)
      return true
    }
    if (leadEditor) {
      setLeadEditor(null)
      return true
    }
    if (followupEditor) {
      setFollowupEditor(null)
      return true
    }
    if (leaveEditor) {
      setLeaveEditor(false)
      setLeaveError('')
      return true
    }
    if (completedEditJob) {
      setCompletedEditJob(null)
      setCompletedEditError('')
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
        setActiveTab(state.activeTab === 'legacyStockCount' ? 'products' : (state.activeTab || 'home'))
        setOperationsView(state.operationsView || 'calendar')
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
    adjustStockItem,
    globalSearchOpen,
    inventoryDetailItem,
    passwordOpen,
    accessUser,
    productEditor,
    locationEditor,
    leadDetail,
    customerDetail,
    leadEditor,
    followupEditor,
    leaveEditor,
    completedEditJob,
    completionBooking,
    handoverBooking,
    bookingEditor,
    invoiceJob,
    jobModal,
    actionMode,
    mobileActionsOpen,
  ])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)

      if (newSession && event === 'PASSWORD_RECOVERY') {
        setPasswordOpen(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'technician_leave_requests' },
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
    setCrmLeads([])
    setCrmLeadNotes([])
    setTechnicianLeaves([])
    setLeadDetail(null)
    setCustomerDetail(null)
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
      crmLeadsResult,
      crmNotesResult,
      leavesResult,
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
      supabase.from('crm_leads').select('*').order('updated_at', { ascending: false }),
      supabase.from('crm_lead_notes').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('technician_leave_requests').select('*').order('start_at', { ascending: true }),
    ])

    const firstError =
      inventoryResult.error || locationsResult.error || stockResult.error ||
      movementsResult.error || reservationsResult.error || jobsResult.error ||
      profilesResult.error || auditResult.error || catalogResult.error ||
      allLocationsResult.error || followupsResult.error || photosResult.error ||
      crmLeadsResult.error || crmNotesResult.error || leavesResult.error

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
      setCrmLeads(crmLeadsResult.data || [])
      setCrmLeadNotes(crmNotesResult.data || [])
      setTechnicianLeaves(leavesResult.data || [])
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


  async function openInventoryDetail(item) {
    if (!item?.product_id) return

    setInventoryDetailItem(item)
    setInventoryDetailMovements([])
    setInventoryDetailError('')
    setInventoryDetailLoading(true)

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('product_id', item.product_id)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error(error)
      const fallback = visibleMovements.filter(
        (movement) => movement.product_id === item.product_id
      )
      setInventoryDetailMovements(fallback)
      setInventoryDetailError(
        'Unable to load the full history. Showing the recent activity already loaded in the app.'
      )
      setInventoryDetailLoading(false)
      return
    }

    let nextMovements = data || []

    if (!isManagement && profile?.location_id) {
      nextMovements = nextMovements.filter(
        (movement) =>
          movement.from_location_id === profile.location_id ||
          movement.to_location_id === profile.location_id
      )
    }

    setInventoryDetailMovements(nextMovements)
    setInventoryDetailLoading(false)
  }


  function openGlobalSearch() {
    setGlobalSearch('')
    setGlobalSearchOpen(true)
  }

  function openAdjustStock(item, locationId = '') {
    if (!isManagement) {
      showToast('Owner/Admin permission required')
      return
    }

    const defaultLocation =
      (locationId && locationById(locationId)) ||
      locations.find((location) => location.code === 'SVR-JB') ||
      locations.find((location) => location.location_type === 'warehouse') ||
      locations[0]

    const selectedId = defaultLocation?.id || locationId || ''
    const currentQty = Number(
      locationStock.find(
        (row) =>
          row.product_id === item.product_id &&
          row.location_id === selectedId
      )?.quantity || 0
    )

    setAdjustStockItem(item)
    setAdjustStockForm({
      location_id: selectedId,
      actual_quantity: currentQty,
      reason: '',
    })
    setAdjustStockError('')
  }

  function changeAdjustStockLocation(locationId) {
    if (!adjustStockItem) return

    const currentQty = Number(
      locationStock.find(
        (row) =>
          row.product_id === adjustStockItem.product_id &&
          row.location_id === locationId
      )?.quantity || 0
    )

    setAdjustStockForm((current) => ({
      ...current,
      location_id: locationId,
      actual_quantity: currentQty,
    }))
    setAdjustStockError('')
  }

  async function saveAdjustStock() {
    if (!adjustStockItem) return
    if (!adjustStockForm.location_id) {
      setAdjustStockError('Please select a Stock Holder.')
      return
    }
    if (!adjustStockForm.reason.trim()) {
      setAdjustStockError('Please enter the reason for this adjustment.')
      return
    }

    const actual = Math.max(
      0,
      Math.floor(Number(adjustStockForm.actual_quantity) || 0)
    )

    setAdjustStockSaving(true)
    setAdjustStockError('')

    const { data: difference, error } = await supabase.rpc(
      'adjust_stock_item_v63',
      {
        p_product_id: adjustStockItem.product_id,
        p_location_id: adjustStockForm.location_id,
        p_actual_quantity: actual,
        p_reason: adjustStockForm.reason.trim(),
      }
    )

    if (error) {
      console.error(error)
      setAdjustStockError(error.message || 'Unable to adjust stock.')
      setAdjustStockSaving(false)
      return
    }

    const previous = Number(
      locationStock.find(
        (row) =>
          row.product_id === adjustStockItem.product_id &&
          row.location_id === adjustStockForm.location_id
      )?.quantity || 0
    )
    const delta = Number(difference ?? actual - previous)
    const nextDetailItem = {
      ...adjustStockItem,
      physical_stock: Number(adjustStockItem.physical_stock || 0) + delta,
      available_stock: Number(adjustStockItem.available_stock || 0) + delta,
    }

    setAdjustStockItem(null)
    setAdjustStockSaving(false)
    showToast(delta === 0 ? 'Stock already matches actual quantity' : 'Stock adjusted successfully')
    await loadAppData()

    if (inventoryDetailItem?.product_id === nextDetailItem.product_id) {
      await openInventoryDetail(nextDetailItem)
    }
  }

  async function acknowledgeBookingNote(booking) {
    if (!booking?.id || !booking.technician_note) return

    const { error } = await supabase.rpc('acknowledge_booking_note_v63', {
      p_reservation_id: booking.id,
    })

    if (error) {
      console.error(error)
      showToast(error.message || 'Unable to acknowledge note')
      return
    }

    showToast('Important Note acknowledged')
    await loadAppData()
  }

  function openSearchBooking(booking) {
    setGlobalSearchOpen(false)
    setGlobalSearch('')
    setActiveTab('operations')
    if (isManagement) {
      openEditBooking(booking)
    } else {
      setOperationsView('today')
    }
  }

  function openSearchJob(job) {
    setGlobalSearchOpen(false)
    setGlobalSearch('')
    setJobFilter('all')
    setActiveTab('jobs')
  }

  function openSearchProduct(item) {
    setGlobalSearchOpen(false)
    setGlobalSearch('')
    if (!isManagement) return
    setActiveTab('products')
    openProductEditor({ ...item, id: item.id || item.product_id })
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
      `Confirm VOID ${job.job_no}?\n\nThe Job record will remain for history.`
    )

    if (!confirmed) return

    const { error } = await supabase.rpc('void_job_v7', {
      p_job_id: job.id,
      p_reason: reason.trim() || null,
    })

    if (error) {
      console.error(error)
      showToast(error.message || 'Void failed')
      return
    }

    showToast(`${job.job_no} voided`)
    await loadAppData()
  }

  async function deleteJobPermanently(job) {
    if (!isOwner) {
      showToast('Only Owner can permanently delete Jobs')
      return
    }

    const typed = window.prompt(
      `OWNER ONLY\n\nPermanently delete ${job.job_no}?\nThe Job will disappear from Operations history.\n\nType DELETE to continue:`
    )

    if (typed !== 'DELETE') return

    const photoPaths = jobPhotos
      .filter((item) => item.job_id === job.id)
      .map((item) => item.storage_path)
      .filter(Boolean)

    const { error } = await supabase.rpc('delete_job_permanently_v7', {
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

  function openNewLead() {
    if (!isManagement) return showToast('Owner/Admin permission required')
    setLeadEditor({ type: 'new' })
    setLeadForm({
      customer_name: '', phone: '', source: 'WhatsApp', region_code: 'jb', region_other: '', area: '',
      interest_text: '', status: 'new',
      lead_date: formatLocalDateKey(new Date()),
      remark: '',
    })
    setLeadError('')
    setMobileActionsOpen(false)
  }

  function openEditLead(lead) {
    if (!isManagement) return showToast('Owner/Admin permission required')
    setLeadEditor({ type: 'edit', lead })
    setLeadForm({
      customer_name: lead.customer_name || '',
      phone: lead.phone || '',
      source: lead.source || 'WhatsApp',
      region_code: lead.region_code || 'unassigned',
      region_other: lead.region_other || '',
      area: lead.area || '',
      interest_text: lead.interest_text || '',
      status: lead.status || 'new',
      lead_date: lead.lead_date || formatLocalDateKey(lead.created_at || new Date()),
      remark: lead.remark || '',
    })
    setLeadError('')
  }

  function openLeadDetail(lead) {
    setLeadDetail(lead)
    setLeadUpdateForm({
      status: lead.status || 'new',
      note: '',
    })
    setLeadUpdateError('')
  }

  function openEditLeadFromDetail(lead) {
    setLeadDetail(null)
    openEditLead(lead)
  }

  async function saveLeadV7() {
    if (!leadEditor) return
    if (!leadForm.customer_name.trim() && !leadForm.phone.trim()) {
      return setLeadError('Customer name or phone is required.')
    }
    setLeadSaving(true)
    setLeadError('')
    const params = {
      p_customer_name: leadForm.customer_name.trim() || null,
      p_phone: leadForm.phone.trim() || null,
      p_source: leadForm.source || 'Other',
      p_region_code: leadForm.region_code || 'unassigned',
      p_region_other: leadForm.region_code === 'others' ? (leadForm.region_other.trim() || null) : null,
      p_area: leadForm.area.trim() || null,
      p_interest_text: leadForm.interest_text.trim() || null,
      p_status: leadForm.status,
      p_lead_date: leadForm.lead_date || formatLocalDateKey(new Date()),
      p_remark: leadForm.remark.trim() || null,
    }
    const result = leadEditor.type === 'new'
      ? await supabase.rpc('create_crm_lead_v72', params)
      : await supabase.rpc('update_crm_lead_v72', { p_lead_id: leadEditor.lead.id, ...params })
    if (result.error) {
      console.error(result.error)
      setLeadError(result.error.message || 'Unable to save lead.')
      setLeadSaving(false)
      return
    }
    setLeadSaving(false)
    setLeadEditor(null)
    showToast(leadEditor.type === 'new' ? 'Lead created' : 'Lead updated')
    await loadAppData()
  }

  async function quickLeadStatus(lead, status) {
    if (!isManagement) return
    const result = await supabase.rpc('add_crm_lead_update_v72', {
      p_lead_id: lead.id,
      p_status: status,
      p_note: null,
    })
    if (result.error) return showToast(result.error.message || 'Unable to update lead')
    showToast(`Moved to ${CRM_STATUS_LABELS[status] || status}`)
    await loadAppData()
  }

  async function saveLeadUpdate() {
    if (!leadDetail) return
    const nextStatus = leadUpdateForm.status || leadDetail.status || 'new'
    const note = leadUpdateForm.note.trim()

    if (nextStatus === 'done' && !leadDetail.converted_reservation_id) {
      convertLeadToBooking(leadDetail, note)
      return
    }

    if (!note && nextStatus === leadDetail.status) {
      setLeadUpdateError('Write a short update so the follow-up history stays clear.')
      return
    }

    setLeadUpdateSaving(true)
    setLeadUpdateError('')
    const result = await supabase.rpc('add_crm_lead_update_v72', {
      p_lead_id: leadDetail.id,
      p_status: nextStatus,
      p_note: note || null,
    })

    if (result.error) {
      console.error(result.error)
      setLeadUpdateError(result.error.message || 'Unable to save update.')
      setLeadUpdateSaving(false)
      return
    }

    const now = new Date().toISOString()
    const nextLead = {
      ...leadDetail,
      status: nextStatus,
      last_contact_at: now,
      updated_at: now,
    }
    setCrmLeads((current) =>
      current.map((lead) => (lead.id === nextLead.id ? nextLead : lead))
    )
    if (result.data) {
      setCrmLeadNotes((current) => [
        {
          id: result.data,
          lead_id: leadDetail.id,
          note: note || `Status changed to ${CRM_STATUS_LABELS[nextStatus] || nextStatus}`,
          status_after: nextStatus,
          log_type: nextStatus === leadDetail.status ? 'update' : 'status',
          created_by: session?.user?.id || null,
          created_at: now,
        },
        ...current,
      ])
    }
    setLeadDetail(nextLead)
    setLeadUpdateForm({ status: nextStatus, note: '' })
    setLeadUpdateSaving(false)
    showToast('CRM update logged')
  }

  function convertLeadToBooking(lead, conversionNote = '') {
    if (!isManagement) return
    const leadArea = crmLeadLocationText(lead)
    const remarkParts = []
    if (lead.interest_text) remarkParts.push(`CRM: ${lead.interest_text}`)
    if (conversionNote) remarkParts.push(`Latest follow-up: ${conversionNote}`)

    setLeadEditor(null)
    setLeadDetail(null)
    setBookingEditor({ type: 'new', fromLeadId: lead.id, conversionNote })
    setBookingForm({
      customer_name: lead.customer_name || '', customer_phone: lead.phone || '', unit_no: '',
      installation_area: leadArea || lead.area || '', installation_address: '', place_name: '',
      google_place_id: '', latitude: null, longitude: null,
      booking_type: 'product_confirmed', promotion_name: '', selling_price: '',
      deposit_amount: '', payment_status: 'deposit_paid', schedule_type: 'tbc',
      installation_date: '', installation_time: '', estimated_installation: '',
      installer_location_id: '', technician_note: '',
      remark: remarkParts.join('\n'),
    })
    setBookingItems([{ product_id: '', quantity: 1 }])
    setBookingError('')
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
      installer_location_id: '', technician_note: '', remark: '',
    })
    setBookingItems([{ product_id: '', quantity: 1 }])
    setBookingError('')
  }

  function openNewCustomer() {
    if (!isManagement) return showToast('Owner/Admin permission required')
    openNewBooking()
    setBookingEditor({ type: 'new', directCustomer: true })
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
      technician_note: booking.technician_note || '',
      remark: booking.remark || '',
    })
    const items = (booking.reservation_items || [])
      .filter((item) => productById(item.product_id)?.category !== 'lock_body')
      .map((item) => ({
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
      ? bookingItems
          .filter((item) => item.product_id && productById(item.product_id)?.category === 'smart_lock')
          .map((item) => ({
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
      p_technician_note: bookingForm.technician_note.trim() || null,
      p_remark: bookingForm.remark.trim() || null,
      p_items: cleanItems,
    }

    let result
    if (bookingEditor.type === 'new') {
      result = await supabase.rpc('create_booking_v7', params)
    } else {
      result = await supabase.rpc('update_booking_v7', {
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

    const createdReservationId = bookingEditor.type === 'new' ? result.data : null
    if (bookingEditor.fromLeadId && createdReservationId) {
      const converted = await supabase.rpc('mark_crm_lead_converted_v72', {
        p_lead_id: bookingEditor.fromLeadId,
        p_reservation_id: createdReservationId,
        p_note: bookingEditor.conversionNote || null,
      })
      if (converted.error) console.error(converted.error)
    }

    setBookingEditor(null)
    setBookingSaving(false)
    showToast(bookingEditor.type === 'new' ? 'Booking created' : 'Booking updated')
    await loadAppData()
    setActiveTab(bookingEditor.fromLeadId || bookingEditor.directCustomer ? 'customers' : 'operations')
  }

  async function openHandover(booking) {
    if (!isManagement) return showToast('Owner/Admin permission required')
    const ok = window.confirm(`Mark items prepared for ${booking.customer_name}?\n\nThis is an Operations status only. Bukku remains the stock source of truth.`)
    if (!ok) return
    const { error } = await supabase.rpc('mark_booking_items_prepared_v7', {
      p_reservation_id: booking.id,
    })
    if (error) return showToast(error.message || 'Unable to mark items prepared')
    showToast('Items marked prepared')
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
    setCompletionLockBodies([{ product_id: '', quantity: 1 }])
    setCompletionError('')
  }

  function updateCompletionLockBody(index, field, value) {
    setCompletionLockBodies((current) => current.map((item, itemIndex) =>
      itemIndex === index
        ? { ...item, [field]: field === 'quantity' ? Math.max(1, Number(value) || 1) : value }
        : item
    ))
    setCompletionError('')
  }

  function addCompletionLockBody() {
    setCompletionLockBodies((current) => [...current, { product_id: '', quantity: 1 }])
  }

  function removeCompletionLockBody(index) {
    setCompletionLockBodies((current) => current.length === 1
      ? [{ product_id: '', quantity: 1 }]
      : current.filter((_, itemIndex) => itemIndex !== index))
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
    if (completionForm.pending_settle && !completionForm.pending_issue.trim()) {
      return setCompletionError('Pending Settle must state what is not completed.')
    }

    const cleanLockBodies = completionLockBodies
      .filter((item) => item.product_id)
      .map((item) => ({ product_id: item.product_id, quantity: Number(item.quantity) }))

    setCompletionSaving(true)
    setCompletionError('')
    const { data, error } = await supabase.rpc('complete_booking_installation_v73', {
      p_reservation_id: completionBooking.id,
      p_customer_taught: completionForm.customer_taught,
      p_review_asked: completionForm.review_asked,
      p_review_received: completionForm.review_received,
      p_completion_remark: completionForm.completion_remark.trim() || null,
      p_pending_issue: completionForm.pending_settle ? completionForm.pending_issue.trim() : null,
      p_lock_bodies: cleanLockBodies,
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
    setActiveTab('operations')
  }


  function openLeaveRequest() {
    const today = formatLocalDateKey(new Date())
    setLeaveForm({
      full_day: true,
      start_date: today,
      start_time: '09:00',
      end_date: today,
      end_time: '18:00',
      reason: '',
    })
    setLeaveError('')
    setLeaveEditor(true)
    setMobileActionsOpen(false)
  }

  function addDateKeyDays(dateKey, days) {
    const date = new Date(`${dateKey}T12:00:00`)
    date.setDate(date.getDate() + days)
    return formatLocalDateKey(date)
  }

  async function saveLeaveRequest() {
    if (!leaveForm.start_date || !leaveForm.end_date) {
      return setLeaveError('Start date and end date are required.')
    }
    if (!leaveForm.full_day && (!leaveForm.start_time || !leaveForm.end_time)) {
      return setLeaveError('Start time and end time are required.')
    }

    const startAt = leaveForm.full_day
      ? `${leaveForm.start_date}T00:00:00+08:00`
      : `${leaveForm.start_date}T${leaveForm.start_time}:00+08:00`
    const endAt = leaveForm.full_day
      ? `${addDateKeyDays(leaveForm.end_date, 1)}T00:00:00+08:00`
      : `${leaveForm.end_date}T${leaveForm.end_time}:00+08:00`

    if (new Date(endAt) <= new Date(startAt)) {
      return setLeaveError('Leave end must be after the start.')
    }

    setLeaveSaving(true)
    setLeaveError('')
    const { error } = await supabase.rpc('apply_technician_leave_v75', {
      p_start_at: startAt,
      p_end_at: endAt,
      p_full_day: leaveForm.full_day,
      p_reason: leaveForm.reason.trim() || null,
    })
    if (error) {
      console.error(error)
      setLeaveError(error.message || 'Unable to submit leave request.')
      setLeaveSaving(false)
      return
    }
    setLeaveEditor(false)
    setLeaveSaving(false)
    showToast('Leave request submitted')
    await loadAppData()
    setActiveTab('operations')
    setOperationsView('leave')
  }

  async function decideLeave(leave, decision) {
    if (!isManagement || !leave?.id) return
    const note = decision === 'rejected'
      ? window.prompt('Reason for rejecting? (optional)', leave.decision_note || '')
      : null
    if (decision === 'rejected' && note === null) return
    const { error } = await supabase.rpc('decide_technician_leave_v75', {
      p_leave_id: leave.id,
      p_decision: decision,
      p_note: note || null,
    })
    if (error) {
      console.error(error)
      return showToast(error.message || 'Unable to update leave request')
    }
    showToast(decision === 'approved' ? 'Leave approved' : 'Leave rejected')
    await loadAppData()
  }

  async function cancelLeave(leave) {
    if (!leave?.id) return
    const ok = window.confirm('Cancel this leave request?')
    if (!ok) return
    const { error } = await supabase.rpc('cancel_technician_leave_v75', { p_leave_id: leave.id })
    if (error) {
      console.error(error)
      return showToast(error.message || 'Unable to cancel leave request')
    }
    showToast('Leave request cancelled')
    await loadAppData()
  }

  function openEditCompletedJob(job) {
    if (!job || job.status !== 'completed') return
    const lockBodies = (job.job_items || [])
      .filter((item) => productById(item.product_id)?.category === 'lock_body')
      .map((item) => ({ product_id: item.product_id, quantity: Number(item.quantity || 1) }))
    setCompletedEditJob(job)
    setCompletedEditForm({
      customer_taught: Boolean(job.customer_taught),
      review_asked: Boolean(job.review_asked),
      review_received: Boolean(job.review_received),
      completion_remark: job.completion_remark || '',
    })
    setCompletedEditLockBodies(lockBodies.length ? lockBodies : [{ product_id: '', quantity: 1 }])
    setCompletedEditFiles([])
    setCompletedEditError('')
  }

  function updateCompletedEditLockBody(index, field, value) {
    setCompletedEditLockBodies((current) => current.map((item, itemIndex) =>
      itemIndex === index
        ? { ...item, [field]: field === 'quantity' ? Math.max(1, Number(value) || 1) : value }
        : item
    ))
    setCompletedEditError('')
  }

  function addCompletedEditLockBody() {
    setCompletedEditLockBodies((current) => [...current, { product_id: '', quantity: 1 }])
  }

  function removeCompletedEditLockBody(index) {
    setCompletedEditLockBodies((current) => current.length === 1
      ? [{ product_id: '', quantity: 1 }]
      : current.filter((_, itemIndex) => itemIndex !== index))
  }

  async function saveCompletedJobEdit() {
    if (!completedEditJob) return
    const cleanLockBodies = completedEditLockBodies
      .filter((item) => item.product_id)
      .map((item) => ({ product_id: item.product_id, quantity: Number(item.quantity || 1) }))

    setCompletedEditSaving(true)
    setCompletedEditError('')
    const { error } = await supabase.rpc('update_completed_job_v75', {
      p_job_id: completedEditJob.id,
      p_customer_taught: completedEditForm.customer_taught,
      p_review_asked: completedEditForm.review_asked,
      p_review_received: completedEditForm.review_received,
      p_completion_remark: completedEditForm.completion_remark.trim() || null,
      p_lock_bodies: cleanLockBodies,
    })
    if (error) {
      console.error(error)
      setCompletedEditError(error.message || 'Unable to update completed job.')
      setCompletedEditSaving(false)
      return
    }

    let failed = []
    if (completedEditFiles.length) failed = await uploadJobPhotos(completedEditJob.id, completedEditFiles)
    setCompletedEditJob(null)
    setCompletedEditSaving(false)
    showToast(failed.length ? `Job updated • ${failed.length} photo(s) failed` : 'Completed job updated')
    await loadAppData()
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
        <p>Loading SVR...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="auth-shell">
        <div className="auth-visual">
          <div className="auth-visual-content">
            <div className="brand-mark">SVR</div>
            <p className="kicker light">CRM & OPERATIONS</p>
            <h1>Every lead.<br />Every job. One place.</h1>
            <p>
              One clean place for SVR sales follow-up,
              bookings, technicians and after-sales.
            </p>
          </div>
        </div>

        <div className="auth-panel">
          <div className="auth-card">
            <div className="auth-mobile-brand">
              <div className="brand-mark">SVR</div>
              <div>
                <strong>SVR CRM & Operations</strong>
                <span>Sales • Installation • After Sales</span>
              </div>
            </div>

            <p className="kicker">WELCOME BACK</p>
            <h2>Sign in</h2>
            <p className="muted">
              Use your SVR account to continue.
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
            This account exists, but SVR CRM access is disabled or
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
    if (isManagement) return item.id !== 'technician'
    if (isTechnician) return ['home', 'technician', 'operations', 'more'].includes(item.id)
    return ['home', 'more'].includes(item.id)
  })

  const allowedJobLocations = isTechnician
    ? locations.filter((item) => item.id === profile?.location_id)
    : locations

  const customerRecords = (() => {
    const map = new Map()

    const ensureCustomer = (row) => {
      const phone = String(row?.customer_phone || '').replace(/\D/g, '')
      const name = String(row?.customer_name || '').trim()
      const key = phone || name.toLowerCase()
      if (!key) return null

      if (!map.has(key)) {
        map.set(key, {
          key,
          customer_name: name || 'Customer',
          customer_phone: row?.customer_phone || '',
          area: row?.installation_area || '',
          latest_at: row?.updated_at || row?.completed_at || row?.created_at || '',
          bookings: [],
          jobs: [],
          followups: [],
          pending_products: [],
          installed_products: [],
          installed_lock_bodies: [],
        })
      }

      const item = map.get(key)
      if (!item.customer_phone && row?.customer_phone) item.customer_phone = row.customer_phone
      if (!item.area && row?.installation_area) item.area = row.installation_area
      const when = row?.updated_at || row?.completed_at || row?.created_at || ''
      if (when && (!item.latest_at || when > item.latest_at)) item.latest_at = when
      return item
    }

    reservations.forEach((booking) => {
      const item = ensureCustomer(booking)
      if (!item) return
      item.bookings.push(booking)
      if (booking.status === 'reserved') {
        ;(booking.reservation_items || []).forEach((row) => {
          const product = productById(row.product_id)
          if (product?.category === 'lock_body') return
          const name = productDisplayName(product)
          if (name && !item.pending_products.includes(name)) item.pending_products.push(name)
        })
      }
    })

    jobs.filter((job) => job.status !== 'voided').forEach((job) => {
      const item = ensureCustomer(job)
      if (!item) return
      item.jobs.push(job)
      if (job.status === 'completed') {
        ;(job.job_items || []).forEach((row) => {
          const product = productById(row.product_id)
          const name = productDisplayName(product)
          if (!name) return
          if (product?.category === 'lock_body') {
            if (!item.installed_lock_bodies.includes(name)) item.installed_lock_bodies.push(name)
          } else if (!item.installed_products.includes(name)) {
            item.installed_products.push(name)
          }
        })
      }
    })

    followups
      .filter((followup) => ['pending', 'scheduled'].includes(followup.status))
      .forEach((followup) => {
        const job = jobs.find((item) => item.id === followup.job_id)
        if (!job || job.status === 'voided') return
        const customer = ensureCustomer(job)
        if (!customer) return
        customer.followups.push(followup)
      })

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        pending_bookings: item.bookings.filter((booking) => booking.status === 'reserved'),
        completed_jobs: item.jobs.filter((job) => job.status === 'completed'),
        pending: item.followups.length,
      }))
      .sort((a, b) => String(b.latest_at).localeCompare(String(a.latest_at)))
  })()

  const pageTitle =
    activeTab === 'home' ? 'Dashboard'
      : activeTab === 'technician' ? 'My Work'
      : activeTab === 'crm' ? 'CRM Leads'
      : activeTab === 'operations' ? 'Operations'
      : activeTab === 'customers' ? 'Customers'
      : activeTab === 'products' ? 'Edit Items'
      : activeTab === 'jobs' ? 'Jobs & Invoices'
      : activeTab === 'more' ? 'Account & Settings'
      : activeTab === 'users' ? 'User Access'
      : 'SVR CRM & Operations'

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">SVR</div>
          <div>
            <strong>SVR CRM & Operations</strong>
            <span>Sales • Installation • After Sales</span>
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
          {isManagement && (
            <button className="count-shortcut item-shortcut" onClick={() => setActiveTab('products')}>
              <Boxes size={18} />
              <div>
                <strong>Edit Items</strong>
                <span>Smart locks + lock body reference list</span>
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
            <p className="kicker">SVR CRM & OPERATIONS</p>
            <h1>{pageTitle}</h1>
          </div>

          <div className="header-actions">
            <button
              className="icon-button header-search-button"
              onClick={openGlobalSearch}
              title="Search everything"
              aria-label="Search everything"
            >
              <Search size={18} />
            </button>

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

        <main className="page-content">
          {dataError && (
            <div className="global-error">{dataError}</div>
          )}

          {activeTab === 'home' && (
            <CrmOpsDashboard
              leads={crmLeads}
              reservations={visibleReservations}
              jobs={visibleJobs}
              followups={followups}
              setActiveTab={setActiveTab}
              setOperationsView={setOperationsView}
              openNewLead={openNewLead}
              openNewBooking={openNewBooking}
              currentRole={currentRole}
              setLeadStatusFilter={setLeadStatusFilter}
            />
          )}

          {activeTab === 'technician' && isTechnician && (
            <TechnicianMyWorkV76
              bookings={visibleReservations}
              jobs={visibleJobs}
              followups={followups}
              leaves={technicianLeaves}
              profile={profile}
              productById={productById}
              productDisplayName={productDisplayName}
              jobPhotos={jobPhotos}
              openLeaveRequest={openLeaveRequest}
              openCompleteInstallation={openCompleteInstallation}
              openEditCompletedJob={openEditCompletedJob}
              setActiveTab={setActiveTab}
              setOperationsView={setOperationsView}
            />
          )}

          {activeTab === 'legacyInventory' && (
            inventoryDetailItem ? (
              <InventoryItemDetail
                key={inventoryDetailItem.product_id}
                item={inventoryDetailItem}
                movements={inventoryDetailMovements}
                loading={inventoryDetailLoading}
                error={inventoryDetailError}
                locationStock={locationStock}
                locations={allLocations}
                profile={profile}
                isManagement={isManagement}
                productDisplayName={productDisplayName}
                locationById={locationById}
                profileByUserId={profileByUserId}
                movementSubtitle={movementSubtitle}
                formatDate={formatDate}
                openAdjustStock={openAdjustStock}
                close={() => setInventoryDetailItem(null)}
              />
            ) : (
              <InventoryPage
                inventory={filteredInventory}
                search={search}
                setSearch={setSearch}
                categoryFilter={categoryFilter}
                setCategoryFilter={setCategoryFilter}
                productDisplayName={productDisplayName}
                canAddProduct={isManagement}
                openAddProduct={() => openProductEditor(null)}
                openItem={openInventoryDetail}
              />
            )
          )}

          {activeTab === 'crm' && isManagement && (
            <CRMLeadsPage
              leads={crmLeads}
              notes={crmLeadNotes}
              filter={leadStatusFilter}
              setFilter={setLeadStatusFilter}
              openNewLead={openNewLead}
              openLeadDetail={openLeadDetail}
              convertToBooking={convertLeadToBooking}
            />
          )}

          {activeTab === 'customers' && isManagement && (
            <CustomersPage
              customers={customerRecords}
              openCustomer={setCustomerDetail}
            />
          )}

          {activeTab === 'products' && isManagement && (
            <ProductCatalogPage
              products={productCatalog}
              openProductEditor={openProductEditor}
              productDisplayName={productDisplayName}
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
              acknowledgeBookingNote={acknowledgeBookingNote}
              profileByUserId={profileByUserId}
              technicianLeaves={technicianLeaves}
              openLeaveRequest={openLeaveRequest}
              decideLeave={decideLeave}
              cancelLeave={cancelLeave}
              openEditCompletedJob={openEditCompletedJob}
              jobPhotos={jobPhotos}
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
              openEditCompletedJob={openEditCompletedJob}
            />
          )}

          {activeTab === 'legacyHolders' && (
            <HoldersPage
              holderSummary={holderSummary}
              setSelectedLocationId={setSelectedLocationId}
              openStockCount={openStockCount}
            />
          )}

          {activeTab === 'legacyActivity' && (
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
            <MorePageV7
              email={session.user.email}
              profile={profile}
              formatRole={formatRole}
              onLogout={handleLogout}
              setActiveTab={setActiveTab}
              canViewUserAccess={canViewUserAccess}
              openPasswordChange={openPasswordChange}
              isManagement={isManagement}
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
            />
          )}

          {activeTab === 'legacySettings' && isManagement && (
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

        </main>
      </div>

      <nav className="mobile-nav">
        <button className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>
          <Home size={19} /><span>Home</span>
        </button>
        {isManagement ? (
          <button className={activeTab === 'crm' ? 'active' : ''} onClick={() => setActiveTab('crm')}>
            <MessageCircle size={19} /><span>CRM</span>
          </button>
        ) : isTechnician ? (
          <button className={activeTab === 'technician' ? 'active' : ''} onClick={() => setActiveTab('technician')}>
            <Wrench size={19} /><span>My Work</span>
          </button>
        ) : <div className="mobile-nav-spacer" />}
        {(isManagement || isTechnician) ? (
          <button className="mobile-add" onClick={() => setMobileActionsOpen(true)}><span>+</span></button>
        ) : <div className="mobile-nav-spacer" />}
        {(isManagement || isTechnician) ? (
          <button className={activeTab === 'operations' ? 'active' : ''} onClick={() => { setOperationsView(isTechnician ? 'today' : 'calendar'); setActiveTab('operations') }}>
            <CalendarDays size={19} /><span>Ops</span>
          </button>
        ) : <div className="mobile-nav-spacer" />}
        {isManagement ? (
          <button className={activeTab === 'customers' ? 'active' : ''} onClick={() => setActiveTab('customers')}>
            <Users size={19} /><span>Customers</span>
          </button>
        ) : (
          <button className={activeTab === 'more' ? 'active' : ''} onClick={() => setActiveTab('more')}>
            <Menu size={19} /><span>More</span>
          </button>
        )}
      </nav>

      {mobileActionsOpen && (
        <div className="sheet-backdrop" onClick={() => setMobileActionsOpen(false)}>
          <div className="action-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title"><div><p className="kicker">QUICK ACTION</p><h3>What do you want to do?</h3></div><button className="icon-button" onClick={() => setMobileActionsOpen(false)}><X size={18} /></button></div>
            {isManagement && <button className="sheet-action" onClick={openNewLead}><div className="action-icon"><MessageCircle size={20} /></div><div><strong>New Lead</strong><span>Add a new enquiry / follow-up</span></div><ChevronRight size={18} /></button>}
            {isManagement && <button className="sheet-action" onClick={openNewCustomer}><div className="action-icon"><Users size={20} /></div><div><strong>Add Customer</strong><span>Direct confirmed order • choose smart lock and payment</span></div><ChevronRight size={18} /></button>}
            {isManagement && <button className="sheet-action" onClick={openNewBooking}><div className="action-icon dark"><CalendarDays size={20} /></div><div><strong>New Booking</strong><span>Deposit, TBC, estimated or scheduled installation</span></div><ChevronRight size={18} /></button>}
            {isTechnician && <button className="sheet-action" onClick={openLeaveRequest}><div className="action-icon"><CalendarRange size={20} /></div><div><strong>Apply Leave</strong><span>Request full-day or time-range leave</span></div><ChevronRight size={18} /></button>}
            <button className="sheet-action" onClick={() => { setMobileActionsOpen(false); setActiveTab('operations'); setOperationsView('pending') }}><div className="action-icon"><AlertTriangle size={20} /></div><div><strong>Pending Settle</strong><span>Open after-sales / unfinished installation cases</span></div><ChevronRight size={18} /></button>
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
        />
      )}

      {globalSearchOpen && (
        <GlobalSearchModal
          query={globalSearch}
          setQuery={setGlobalSearch}
          reservations={visibleReservations}
          jobs={visibleJobs}
          inventory={isManagement ? productCatalog.map((item) => ({ ...item, product_id: item.id })) : []}
          productById={productById}
          productDisplayName={productDisplayName}
          close={() => {
            setGlobalSearchOpen(false)
            setGlobalSearch('')
          }}
          openBooking={openSearchBooking}
          openJob={openSearchJob}
          openProduct={openSearchProduct}
        />
      )}

      {adjustStockItem && (
        <AdjustStockModal
          item={adjustStockItem}
          form={adjustStockForm}
          setForm={setAdjustStockForm}
          locations={locations}
          locationStock={locationStock}
          productDisplayName={productDisplayName}
          saving={adjustStockSaving}
          error={adjustStockError}
          changeLocation={changeAdjustStockLocation}
          close={() => !adjustStockSaving && setAdjustStockItem(null)}
          save={saveAdjustStock}
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
        />
      )}

      {leadEditor && (
        <LeadEditorModal
          editor={leadEditor}
          form={leadForm}
          setForm={setLeadForm}
          saving={leadSaving}
          error={leadError}
          close={() => !leadSaving && setLeadEditor(null)}
          save={saveLeadV7}
        />
      )}

      {leadDetail && (
        <LeadDetailModal
          lead={leadDetail}
          notes={crmLeadNotes}
          profiles={profiles}
          form={leadUpdateForm}
          setForm={setLeadUpdateForm}
          saving={leadUpdateSaving}
          error={leadUpdateError}
          close={() => !leadUpdateSaving && setLeadDetail(null)}
          editLead={openEditLeadFromDetail}
          saveUpdate={saveLeadUpdate}
          convertToBooking={convertLeadToBooking}
        />
      )}

      {customerDetail && (
        <CustomerDetailModal
          customer={customerDetail}
          productById={productById}
          productDisplayName={productDisplayName}
          locationById={locationById}
          close={() => setCustomerDetail(null)}
          editBooking={(booking) => {
            setCustomerDetail(null)
            openEditBooking(booking)
          }}
          openPendingCase={(followup) => {
            setCustomerDetail(null)
            openFollowup(followup, 'schedule')
          }}
        />
      )}

      {bookingEditor && (
        <BookingV6Modal
          editor={bookingEditor}
          form={bookingForm}
          items={bookingItems}
          products={productCatalog.filter((item) => item.active !== false && item.category === 'smart_lock')}
          locations={locations}
          saving={bookingSaving}
          error={bookingError}
          updateForm={updateBookingForm}
          updateItem={updateBookingItem}
          addItem={addBookingItem}
          removeItem={removeBookingItem}
          close={() => !bookingSaving && setBookingEditor(null)}
          save={saveBookingV6}
          technicianLeaves={technicianLeaves}
        />
      )}

      {completionBooking && (
        <CompleteInstallationV6Modal
          booking={completionBooking}
          form={completionForm}
          setForm={setCompletionForm}
          files={completionFiles}
          setFiles={setCompletionFiles}
          lockBodyItems={completionLockBodies}
          lockBodyProducts={productCatalog.filter((item) => item.active !== false && item.category === 'lock_body')}
          updateLockBody={updateCompletionLockBody}
          addLockBody={addCompletionLockBody}
          removeLockBody={removeCompletionLockBody}
          productById={productById}
          productDisplayName={productDisplayName}
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
          technicianLeaves={technicianLeaves}
        />
      )}

      {leaveEditor && (
        <LeaveRequestModalV75
          form={leaveForm}
          setForm={setLeaveForm}
          saving={leaveSaving}
          error={leaveError}
          close={() => !leaveSaving && setLeaveEditor(false)}
          save={saveLeaveRequest}
        />
      )}

      {completedEditJob && (
        <EditCompletedJobModalV75
          job={completedEditJob}
          form={completedEditForm}
          setForm={setCompletedEditForm}
          files={completedEditFiles}
          setFiles={setCompletedEditFiles}
          lockBodyItems={completedEditLockBodies}
          lockBodyProducts={productCatalog.filter((item) => item.category === 'lock_body')}
          updateLockBody={updateCompletedEditLockBody}
          addLockBody={addCompletedEditLockBody}
          removeLockBody={removeCompletedEditLockBody}
          productById={productById}
          productDisplayName={productDisplayName}
          existingPhotos={jobPhotos.filter((photo) => photo.job_id === completedEditJob.id)}
          saving={completedEditSaving}
          error={completedEditError}
          close={() => !completedEditSaving && setCompletedEditJob(null)}
          save={saveCompletedJobEdit}
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




function CrmOpsDashboard({ leads, reservations, jobs, followups, setActiveTab, setOperationsView, openNewLead, openNewBooking, currentRole, setLeadStatusFilter }) {
  const today = formatLocalDateKey(new Date())
  const newLeads = leads.filter((lead) => lead.status === 'new')
  const followUpLeads = leads.filter((lead) => lead.status === 'follow_up')
  const highImportantLeads = leads.filter((lead) => lead.status === 'high_important')
  const activeLeads = leads.filter((lead) => !['done', 'loss'].includes(lead.status))
  const installsToday = reservations.filter((item) => item.status === 'reserved' && item.schedule_type === 'exact' && item.installation_date === today)
  const pendingSchedule = reservations.filter((item) => item.status === 'reserved' && ['tbc', 'estimated'].includes(item.schedule_type))
  const pendingSettle = followups.filter((item) => ['pending', 'scheduled'].includes(item.status))
  const notInvoiced = jobs.filter((item) => item.status === 'completed' && item.invoice_status === 'not_invoiced')
  const isManagementUser = ['owner', 'admin'].includes(currentRole)

  return (
    <div className="page-stack fade-in v7-dashboard">
      <section className="v7-welcome">
        <div>
          <p className="kicker">SVR DAILY CONTROL</p>
          <h2>CRM & Operations</h2>
          <p>Follow up leads, arrange technician jobs and clear pending cases.</p>
        </div>
        {isManagementUser && (
          <div className="v7-welcome-actions">
            <button className="secondary-button" onClick={openNewLead}><Plus size={15} /> Lead</button>
            <button className="primary-button" onClick={openNewBooking}><Plus size={15} /> Booking</button>
          </div>
        )}
      </section>

      <section className="v7-kpi-grid">
        {isManagementUser && (
          <button onClick={() => { setLeadStatusFilter('new'); setActiveTab('crm') }}>
            <span>Active Leads</span>
            <strong>{activeLeads.length}</strong>
            <small>{newLeads.length} new • {highImportantLeads.length} important</small>
          </button>
        )}
        <button onClick={() => { setOperationsView('today'); setActiveTab('operations') }}>
          <span>Install Today</span>
          <strong>{installsToday.length}</strong>
          <small>Today schedule</small>
        </button>
        <button onClick={() => { setOperationsView('scheduled'); setActiveTab('operations') }}>
          <span>Pending Schedule</span>
          <strong>{pendingSchedule.length}</strong>
          <small>TBC / estimated</small>
        </button>
        <button onClick={() => { setOperationsView('pending'); setActiveTab('operations') }}>
          <span>Pending Settle</span>
          <strong>{pendingSettle.length}</strong>
          <small>Need action</small>
        </button>
      </section>

      <section className="surface-card v7-attention">
        <div className="section-title-row">
          <div><p className="kicker">NEEDS ATTENTION</p><h3>What needs action</h3></div>
        </div>

        {isManagementUser && highImportantLeads.length > 0 && (
          <button onClick={() => { setLeadStatusFilter('high_important'); setActiveTab('crm') }}>
            <AlertTriangle size={16} />
            <div>
              <strong>{highImportantLeads.length} high important lead(s)</strong>
              <span>Open CRM and handle these first</span>
            </div>
            <ChevronRight size={16} />
          </button>
        )}

        {isManagementUser && followUpLeads.length > 0 && (
          <button onClick={() => { setLeadStatusFilter('follow_up'); setActiveTab('crm') }}>
            <MessageCircle size={16} />
            <div>
              <strong>{followUpLeads.length} lead(s) in Follow Up</strong>
              <span>Review the latest update log and continue the conversation</span>
            </div>
            <ChevronRight size={16} />
          </button>
        )}

        {pendingSettle.length > 0 && (
          <button onClick={() => { setOperationsView('pending'); setActiveTab('operations') }}>
            <Wrench size={16} />
            <div>
              <strong>{pendingSettle.length} pending settle case(s)</strong>
              <span>Schedule or resolve after-sales work</span>
            </div>
            <ChevronRight size={16} />
          </button>
        )}

        {notInvoiced.length > 0 && isManagementUser && (
          <button onClick={() => setActiveTab('jobs')}>
            <ReceiptText size={16} />
            <div>
              <strong>{notInvoiced.length} completed job(s) not invoiced</strong>
              <span>Review Jobs & Invoices</span>
            </div>
            <ChevronRight size={16} />
          </button>
        )}

        {highImportantLeads.length === 0 && followUpLeads.length === 0 && pendingSettle.length === 0 && (!isManagementUser || notInvoiced.length === 0) && (
          <div className="v7-clear"><CheckCircle2 size={18} /> Nothing urgent right now</div>
        )}
      </section>
    </div>
  )
}

const CRM_STATUS_LABELS = {
  new: 'New',
  follow_up: 'Follow Up',
  high_important: 'High Important',
  done: 'Done',
  loss: 'Loss',
}

const CRM_STATUS_ORDER = ['new', 'follow_up', 'high_important', 'done', 'loss']

const CRM_REGION_OPTIONS = [
  { value: 'jb', label: 'JB' },
  { value: 'kl', label: 'KL' },
  { value: 'mlk', label: 'MLK' },
  { value: 'penang', label: 'Penang' },
  { value: 'muar', label: 'Muar' },
  { value: 'kluang', label: 'Kluang' },
  { value: 'batu_pahat', label: 'Batu Pahat' },
  { value: 'others', label: 'Others' },
  { value: 'not_covered', label: 'Not Covered' },
  { value: 'unassigned', label: 'Unassigned' },
]

function crmRegionLabel(lead) {
  if (!lead) return ''
  if (lead.region_code === 'others') return lead.region_other || 'Others'
  return CRM_REGION_OPTIONS.find((item) => item.value === lead.region_code)?.label || ''
}

function crmLeadLocationText(lead) {
  if (!lead) return ''
  const region = crmRegionLabel(lead)
  const area = (lead.area || '').trim()
  if (region && area && region.toLowerCase() !== area.toLowerCase()) return `${region} • ${area}`
  return area || region
}

function crmDisplayDate(value, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-MY', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }
  ).format(date)
}

function CRMLeadsPage({
  leads,
  notes,
  filter,
  setFilter,
  openNewLead,
  openLeadDetail,
  convertToBooking,
}) {
  const [search, setSearch] = useState('')
  const [regionFilter, setRegionFilter] = useState('all')
  const normalized = search.trim().toLowerCase()

  const counts = CRM_STATUS_ORDER.reduce((result, status) => {
    result[status] = leads.filter((lead) => lead.status === status).length
    return result
  }, {})

  const filtered = leads.filter((lead) => {
    if (lead.status !== filter) return false
    if (regionFilter !== 'all' && (lead.region_code || 'unassigned') !== regionFilter) return false
    if (!normalized) return true
    const latest = notes.find((note) => note.lead_id === lead.id)?.note || ''
    return `${lead.customer_name || ''} ${lead.phone || ''} ${crmLeadLocationText(lead)} ${lead.source || ''} ${lead.interest_text || ''} ${latest}`
      .toLowerCase()
      .includes(normalized)
  })

  const latestNote = (leadId) => notes.find((note) => note.lead_id === leadId)

  return (
    <div className="page-stack fade-in crm-page">
      <section className="crm-head crm-head-v72">
        <div>
          <p className="kicker">SALES FOLLOW-UP</p>
          <h2>CRM Leads</h2>
          <p>See the status first, then continue from the latest update log.</p>
        </div>
        <button className="primary-button" onClick={openNewLead}>
          <Plus size={15} /> New Lead
        </button>
      </section>

      <div className="crm-status-board v72">
        {CRM_STATUS_ORDER.map((status) => (
          <button
            type="button"
            key={status}
            className={`crm-status-tab ${status} ${filter === status ? 'active' : ''}`}
            onClick={() => setFilter(status)}
          >
            <span>{CRM_STATUS_LABELS[status]}</span>
            <strong>{counts[status] || 0}</strong>
          </button>
        ))}
      </div>

      <div className="crm-filter-toolbar">
        <div className="crm-region-filter">
          <MapPin size={15} />
          <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
            <option value="all">All Regions</option>
            {CRM_REGION_OPTIONS.map((region) => (
              <option key={region.value} value={region.value}>{region.label}</option>
            ))}
          </select>
        </div>
        <div className="crm-search-v71">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, phone, area, model or update..."
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <section className="crm-list">
        {filtered.map((lead) => {
          const note = latestNote(lead.id)
          const leadDate = lead.lead_date || lead.created_at
          return (
            <article
              className={`crm-lead-card v72 ${lead.status}`}
              key={lead.id}
              role="button"
              tabIndex={0}
              onClick={() => openLeadDetail(lead)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') openLeadDetail(lead)
              }}
            >
              <div className="crm-lead-top">
                <div className="crm-lead-title-block">
                  <div className="crm-card-meta-row">
                    <span className={`crm-status ${lead.status}`}>
                      {CRM_STATUS_LABELS[lead.status] || lead.status}
                    </span>
                    <span className="crm-lead-date">Lead • {crmDisplayDate(leadDate)}</span>
                  </div>
                  <h3>{lead.customer_name || lead.phone || 'New Lead'}</h3>
                  <p>
                    {lead.phone || 'No phone'}
                    {crmLeadLocationText(lead) ? ` • ${crmLeadLocationText(lead)}` : ''}
                    {lead.source ? ` • ${lead.source}` : ''}
                  </p>
                </div>
                <ChevronRight className="crm-card-chevron" size={18} />
              </div>

              {lead.interest_text && <p className="crm-interest">{lead.interest_text}</p>}

              {note?.note ? (
                <div className="crm-latest-note v72">
                  <div>
                    <span>LATEST UPDATE</span>
                    <time>{crmDisplayDate(note.created_at, true)}</time>
                  </div>
                  <p>{note.note}</p>
                </div>
              ) : (
                <div className="crm-no-update">No follow-up update yet.</div>
              )}

              <div className="crm-card-quick-actions">
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} onClick={(event) => event.stopPropagation()}>
                    <Phone size={14} /> Call
                  </a>
                )}
                {whatsappUrl(lead.phone) && (
                  <a href={whatsappUrl(lead.phone)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                )}
                <span>Tap card to update</span>
              </div>
            </article>
          )
        })}

        {filtered.length === 0 && (
          <div className="empty-state">
            <MessageCircle size={24} />
            <strong>No {CRM_STATUS_LABELS[filter]} leads</strong>
            <span>Try another status or region. Use the + button below to add a lead.</span>
          </div>
        )}
      </section>
    </div>
  )
}

function LeadEditorModal({ editor, form, setForm, saving, error, close, save }) {
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const editableStatuses = CRM_STATUS_ORDER.filter((status) => status !== 'done')
  const convertedDone = form.status === 'done'

  return (
    <div className="transaction-backdrop" onClick={close}>
      <section className="transaction-modal lead-editor-modal" onClick={(event) => event.stopPropagation()}>
        <div className="transaction-modal-head">
          <div>
            <p className="kicker">CRM LEAD</p>
            <h2>{editor.type === 'new' ? 'New Lead' : 'Edit Lead'}</h2>
            <p>Lead date defaults to today. Region and area are kept separate for easier follow-up filtering.</p>
          </div>
          <button className="icon-button" onClick={close}><X size={18} /></button>
        </div>

        <div className="transaction-scroll">
          <div className="transaction-two-col">
            <div className="transaction-field">
              <label>Customer Name</label>
              <input value={form.customer_name} onChange={(event) => update('customer_name', event.target.value)} />
            </div>
            <div className="transaction-field">
              <label>Phone / WhatsApp</label>
              <input value={form.phone} onChange={(event) => update('phone', event.target.value)} />
            </div>
          </div>

          <div className="transaction-two-col">
            <div className="transaction-field">
              <label>Lead Date *</label>
              <input type="date" value={form.lead_date} onChange={(event) => update('lead_date', event.target.value)} />
              <small className="field-help">WhatsApp auto-leads can use the incoming message date later.</small>
            </div>
            <div className="transaction-field">
              <label>Status</label>
              {convertedDone ? (
                <>
                  <input value="Done • Converted Customer" disabled />
                  <small className="field-help">Done is locked because this lead has already become a customer.</small>
                </>
              ) : (
                <select value={form.status} onChange={(event) => update('status', event.target.value)}>
                  {editableStatuses.map((status) => (
                    <option key={status} value={status}>{CRM_STATUS_LABELS[status]}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="transaction-two-col lead-region-row">
            <div className="transaction-field">
              <label>Region</label>
              <select value={form.region_code || 'unassigned'} onChange={(event) => update('region_code', event.target.value)}>
                {CRM_REGION_OPTIONS.map((region) => (
                  <option key={region.value} value={region.value}>{region.label}</option>
                ))}
              </select>
            </div>
            <div className="transaction-field">
              <label>Area / Township</label>
              <input value={form.area} onChange={(event) => update('area', event.target.value)} placeholder="Mount Austin / Cheras / Bayan Lepas..." />
            </div>
          </div>

          {form.region_code === 'others' && (
            <div className="transaction-field">
              <label>Other Region</label>
              <input value={form.region_other} onChange={(event) => update('region_other', event.target.value)} placeholder="e.g. Seremban / Ipoh" />
            </div>
          )}

          {form.region_code === 'not_covered' && (
            <div className="crm-coverage-note">Not Covered is for enquiries outside the current Johor / Melaka / KL / Penang coverage.</div>
          )}

          <div className="transaction-two-col">
            <div className="transaction-field">
              <label>Source</label>
              <select value={form.source} onChange={(event) => update('source', event.target.value)}>
                {['WhatsApp', 'Facebook', 'Instagram', 'Xiaohongshu', 'Referral', 'Walk-in', 'Agent', 'Other'].map((source) => (
                  <option key={source}>{source}</option>
                ))}
              </select>
            </div>
            <div className="transaction-field lead-status-guide">
              <label>Done means Customer</label>
              <div>To mark a lead Done, open the lead and choose <strong>Done</strong>. The app will take you straight to Customer / Booking details.</div>
            </div>
          </div>

          <div className="transaction-field">
            <label>Interested In / Requirement</label>
            <textarea rows="3" value={form.interest_text} onChange={(event) => update('interest_text', event.target.value)} placeholder="e.g. Wooden door + grill door, wants face recognition" />
          </div>

          <div className="transaction-field">
            <label>General Remark</label>
            <textarea rows="3" value={form.remark} onChange={(event) => update('remark', event.target.value)} placeholder="Permanent note about this lead..." />
          </div>

          {error && <div className="transaction-error">{error}</div>}
        </div>

        <div className="transaction-footer">
          <button className="secondary-button" onClick={close}>Cancel</button>
          <button className="primary-button" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save Lead'}
          </button>
        </div>
      </section>
    </div>
  )
}

function LeadDetailModal({
  lead,
  notes,
  profiles,
  form,
  setForm,
  saving,
  error,
  close,
  editLead,
  saveUpdate,
  convertToBooking,
}) {
  const orderedNotes = [...notes]
    .filter((note) => note.lead_id === lead.id)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))

  const authorName = (userId) =>
    profiles.find((profile) => profile.user_id === userId)?.display_name || 'SVR'

  return (
    <div className="transaction-backdrop" onClick={close}>
      <section className="transaction-modal lead-detail-modal" onClick={(event) => event.stopPropagation()}>
        <div className="lead-detail-head">
          <div>
            <div className="crm-card-meta-row">
              <span className={`crm-status ${lead.status}`}>{CRM_STATUS_LABELS[lead.status] || lead.status}</span>
              <span className="crm-lead-date">Lead • {crmDisplayDate(lead.lead_date || lead.created_at)}</span>
            </div>
            <h2>{lead.customer_name || lead.phone || 'Lead'}</h2>
            <p>
              {lead.phone || 'No phone'}
              {crmLeadLocationText(lead) ? ` • ${crmLeadLocationText(lead)}` : ''}
              {lead.source ? ` • ${lead.source}` : ''}
            </p>
          </div>
          <button className="icon-button" onClick={close}><X size={18} /></button>
        </div>

        <div className="lead-detail-contact-actions">
          {lead.phone && <a href={`tel:${lead.phone}`}><Phone size={15} /> Call</a>}
          {whatsappUrl(lead.phone) && (
            <a href={whatsappUrl(lead.phone)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>
          )}
          <button type="button" onClick={() => editLead(lead)}><Pencil size={15} /> Edit Lead</button>
        </div>

        <div className="transaction-scroll lead-detail-scroll">
          {(lead.interest_text || lead.remark) && (
            <section className="lead-summary-card">
              {lead.interest_text && <div><span>REQUIREMENT</span><p>{lead.interest_text}</p></div>}
              {lead.remark && <div><span>GENERAL REMARK</span><p>{lead.remark}</p></div>}
            </section>
          )}

          <section className="lead-update-panel">
            <div className="lead-section-title">
              <div><p className="kicker">FOLLOW-UP</p><h3>Add Update</h3></div>
              <span>No follow-up time required</span>
            </div>

            <div className="crm-status-picker v72">
              {CRM_STATUS_ORDER.map((status) => {
                const doneNeedsConversion = status === 'done' && !lead.converted_reservation_id
                return (
                  <button
                    type="button"
                    key={status}
                    className={`crm-status-choice ${status} ${form.status === status ? 'active' : ''}`}
                    disabled={lead.status === 'done' && status !== 'done'}
                    onClick={() => {
                      if (lead.status === 'done') return
                      if (doneNeedsConversion) {
                        convertToBooking(lead, form.note.trim())
                        return
                      }
                      setForm((current) => ({ ...current, status }))
                    }}
                  >
                    {status === 'done' && !lead.converted_reservation_id ? 'Done → Customer' : CRM_STATUS_LABELS[status]}
                  </button>
                )
              })}
            </div>

            {form.status === 'loss' && (
              <div className="crm-loss-note">Use Loss for no interest, rejected quote, chose another brand, or a lead that will not proceed.</div>
            )}

            <div className="transaction-field lead-update-note">
              <label>Update Log</label>
              <textarea rows="3" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="e.g. Customer likes VN-4, waiting renovation complete. Follow up when keys are collected." />
              <small className="field-help">Every save becomes a dated history entry. Choosing Done opens the Customer / Booking form instead.</small>
            </div>

            {error && <div className="transaction-error">{error}</div>}
            {lead.status !== 'done' && (
              <button className="primary-button lead-save-update" onClick={saveUpdate} disabled={saving}>
                <Save size={15} /> {saving ? 'Saving...' : 'Save Update'}
              </button>
            )}
          </section>

          <section className="lead-history-section">
            <div className="lead-section-title">
              <div><p className="kicker">ACTIVITY</p><h3>Update History</h3></div>
              <strong>{orderedNotes.length}</strong>
            </div>

            <div className="lead-timeline">
              {orderedNotes.map((note) => (
                <article className="lead-log-item" key={note.id}>
                  <div className="lead-log-dot" />
                  <div className="lead-log-body">
                    <div className="lead-log-meta">
                      <div>
                        {note.status_after && <span className={`crm-status mini ${note.status_after}`}>{CRM_STATUS_LABELS[note.status_after] || note.status_after}</span>}
                        <strong>{authorName(note.created_by)}</strong>
                      </div>
                      <time>{crmDisplayDate(note.created_at, true)}</time>
                    </div>
                    <p>{note.note}</p>
                  </div>
                </article>
              ))}
              {orderedNotes.length === 0 && <div className="empty-state compact"><History size={20} /><strong>No update log yet</strong></div>}
            </div>
          </section>
        </div>

        {!lead.converted_reservation_id && lead.status !== 'done' && (
          <div className="transaction-footer lead-detail-footer">
            <button className="secondary-button" onClick={close}>Close</button>
            <button className="primary-button" onClick={() => convertToBooking(lead, form.note.trim())}>Done → Customer</button>
          </div>
        )}
      </section>
    </div>
  )
}

function customerStatusFlags(customer) {
  const pendingInstall = (customer.pending_bookings?.length || 0) > 0
  const pendingSettle = Number(customer.pending || 0) > 0
  const hasCompleted = (customer.completed_jobs?.length || 0) > 0
  const cleanCustomer = !pendingInstall && !pendingSettle
  const completed = cleanCustomer && hasCompleted

  return {
    pending_install: pendingInstall,
    pending_settle: pendingSettle,
    completed,
    customer: cleanCustomer,
  }
}

function customerCardStatuses(customer) {
  const flags = customerStatusFlags(customer)
  const statuses = []

  if (flags.pending_install) statuses.push({ key: 'pending_install', label: 'Pending Installation' })
  if (flags.pending_settle) statuses.push({ key: 'pending_settle', label: 'Pending Settle' })

  if (statuses.length === 0) {
    if (flags.completed) statuses.push({ key: 'completed', label: 'Completed' })
    else statuses.push({ key: 'customer', label: 'Customer' })
  }

  return statuses
}

function customerCardStatus(customer) {
  return customerCardStatuses(customer)[0]
}

function CustomersPage({ customers, openCustomer }) {
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const normalized = q.trim().toLowerCase()

  const statusCounts = customers.reduce((counts, customer) => {
    const flags = customerStatusFlags(customer)
    counts.all += 1
    if (flags.customer) counts.customer += 1
    if (flags.pending_install) counts.pending_install += 1
    if (flags.pending_settle) counts.pending_settle += 1
    if (flags.completed) counts.completed += 1
    return counts
  }, { all: 0, customer: 0, pending_install: 0, pending_settle: 0, completed: 0 })

  const customerStatusOptions = [
    ['all', 'All'],
    ['customer', 'Customer'],
    ['pending_install', 'Pending Installation'],
    ['pending_settle', 'Pending Settle'],
    ['completed', 'Completed'],
  ]

  const filtered = customers.filter((customer) => {
    const searchable = `${customer.customer_name} ${customer.customer_phone} ${customer.area} ${customer.pending_products.join(' ')} ${customer.installed_products.join(' ')}`
      .toLowerCase()
    if (!searchable.includes(normalized)) return false
    if (statusFilter === 'all') return true
    return Boolean(customerStatusFlags(customer)[statusFilter])
  })

  return (
    <div className="page-stack fade-in customers-page">
      <section className="crm-head customer-head-v72">
        <div>
          <p className="kicker">CUSTOMER RECORD</p>
          <h2>Customers</h2>
          <p>Filter by installation and after-sales status, then tap a customer for the full record.</p>
        </div>
        <span className="customer-total">{customers.length} customers</span>
      </section>

      <section className="customer-status-board" aria-label="Customer status filters">
        {customerStatusOptions.map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={`customer-status-filter ${key} ${statusFilter === key ? 'active' : ''}`}
            onClick={() => setStatusFilter(key)}
          >
            <span>{label}</span>
            <strong>{statusCounts[key]}</strong>
          </button>
        ))}
      </section>

      <div className="customer-search">
        <Search size={16} />
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name, phone, area or smart lock..." />
      </div>

      <div className="customer-filter-result">
        <span>{customerStatusOptions.find(([key]) => key === statusFilter)?.[1] || 'All'}</span>
        <strong>{filtered.length}</strong>
      </div>

      <section className="customer-list customer-list-v72">
        {filtered.map((customer) => {
          const statuses = customerCardStatuses(customer)
          const currentProducts = customer.pending_products.length > 0 ? customer.pending_products : customer.installed_products
          const itemLabel = customer.pending_products.length > 0
            ? 'TO INSTALL'
            : customer.installed_products.length > 0
              ? 'INSTALLED'
              : 'CUSTOMER'
          return (
            <article
              className="customer-card v72"
              key={customer.key}
              role="button"
              tabIndex={0}
              onClick={() => openCustomer(customer)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') openCustomer(customer)
              }}
            >
              <div className="customer-card-top v72">
                <div className="customer-name-block">
                  <div className="customer-state-row">
                    {statuses.map((status) => (
                      <span className={`customer-state ${status.key}`} key={status.key}>{status.label}</span>
                    ))}
                  </div>
                  <h3>{customer.customer_name}</h3>
                  <p>{customer.customer_phone || 'No phone'}{customer.area ? ` • ${customer.area}` : ''}</p>
                </div>
                <ChevronRight className="customer-card-chevron" size={18} />
              </div>

              <div className="customer-primary-items">
                <span>{itemLabel}</span>
                <strong>{currentProducts.length ? currentProducts.slice(0, 5).join(' + ') : 'No smart lock record yet'}</strong>
              </div>

              {customer.pending_products.length > 0 && customer.installed_products.length > 0 && (
                <div className="customer-secondary-items">
                  <span>Installed</span>
                  <strong>{customer.installed_products.slice(0, 5).join(' + ')}</strong>
                </div>
              )}

              <div className="customer-progress-row">
                <span><b>{customer.pending_bookings.length}</b> Pending Install</span>
                <span><b>{customer.pending}</b> Pending Settle</span>
                <span><b>{customer.completed_jobs.length}</b> Completed</span>
              </div>

              <div className="crm-card-quick-actions customer-quick-actions">
                {customer.customer_phone && (
                  <a href={`tel:${customer.customer_phone}`} onClick={(event) => event.stopPropagation()}><Phone size={14} /> Call</a>
                )}
                {whatsappUrl(customer.customer_phone) && (
                  <a href={whatsappUrl(customer.customer_phone)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><MessageCircle size={14} /> WhatsApp</a>
                )}
                <span>Tap card for full record</span>
              </div>
            </article>
          )
        })}

        {filtered.length === 0 && (
          <div className="empty-state">
            <Users size={24} />
            <strong>No customer in this status</strong>
            <span>Try another status or clear the search.</span>
          </div>
        )}
      </section>
    </div>
  )
}

function CustomerDetailModal({
  customer,
  productById,
  productDisplayName,
  locationById,
  close,
  editBooking,
  openPendingCase,
}) {
  const productNames = (rows = [], category = null, fallback = 'Product TBC') => {
    const filtered = category
      ? rows.filter((row) => productById(row.product_id)?.category === category)
      : rows
    return filtered.length
      ? filtered.map((row) => `${productDisplayName(productById(row.product_id))}${Number(row.quantity || 1) > 1 ? ` ×${row.quantity}` : ''}`).join(' + ')
      : fallback
  }

  const latestAddress = customer.bookings.find((booking) => booking.installation_address)?.installation_address || ''
  const status = customerCardStatus(customer)

  return (
    <div className="transaction-backdrop" onClick={close}>
      <section className="transaction-modal customer-detail-modal" onClick={(event) => event.stopPropagation()}>
        <div className="customer-detail-head">
          <div>
            <span className={`customer-state ${status.key}`}>{status.label}</span>
            <h2>{customer.customer_name}</h2>
            <p>
              {customer.customer_phone || 'No phone'}
              {customer.area ? ` • ${customer.area}` : ''}
            </p>
          </div>
          <button className="icon-button" onClick={close}><X size={18} /></button>
        </div>

        <div className="lead-detail-contact-actions">
          {customer.customer_phone && <a href={`tel:${customer.customer_phone}`}><Phone size={15} /> Call</a>}
          {whatsappUrl(customer.customer_phone) && (
            <a href={whatsappUrl(customer.customer_phone)} target="_blank" rel="noreferrer">
              <MessageCircle size={15} /> WhatsApp
            </a>
          )}
        </div>

        <div className="transaction-scroll customer-detail-scroll">
          {latestAddress && (
            <section className="customer-address-card">
              <MapPin size={16} />
              <div>
                <span>LATEST ADDRESS</span>
                <p>{latestAddress}</p>
              </div>
            </section>
          )}

          <section className="customer-detail-section">
            <div className="lead-section-title">
              <div><p className="kicker">UPCOMING</p><h3>Pending Installation</h3></div>
              <strong>{customer.pending_bookings.length}</strong>
            </div>

            <div className="customer-record-list">
              {customer.pending_bookings.map((booking) => (
                <article className="customer-record-card pending" key={booking.id}>
                  <div className="customer-record-head">
                    <div>
                      <strong>{productNames(booking.reservation_items)}</strong>
                      <span>
                        {booking.schedule_type === 'exact'
                          ? `${booking.installation_date || 'Date TBC'}${booking.installation_time ? ` • ${String(booking.installation_time).slice(0, 5)}` : ''}`
                          : booking.schedule_type === 'estimated'
                            ? `Estimated • ${booking.estimated_installation || 'TBC'}`
                            : 'Installation TBC'}
                      </span>
                    </div>
                    <span className="customer-record-badge">Pending</span>
                  </div>
                  {booking.installer_location_id && (
                    <p>Technician: {locationById(booking.installer_location_id)?.name || 'Assigned'}</p>
                  )}
                  {booking.technician_note && <p className="customer-record-note">Important: {booking.technician_note}</p>}
                  <button type="button" className="secondary-button small-action" onClick={() => editBooking(booking)}>
                    <Pencil size={14} /> Edit Booking / Items
                  </button>
                </article>
              ))}
              {customer.pending_bookings.length === 0 && <div className="customer-none">No pending installation.</div>}
            </div>
          </section>

          <section className="customer-detail-section">
            <div className="lead-section-title">
              <div><p className="kicker">AFTER SALES</p><h3>Pending Settle</h3></div>
              <strong>{customer.followups.length}</strong>
            </div>

            <div className="customer-record-list">
              {customer.followups.map((followup) => (
                <article className="customer-record-card settle" key={followup.id}>
                  <div className="customer-record-head">
                    <div>
                      <strong>{followup.issue || 'Pending settle case'}</strong>
                      <span>
                        {followup.status === 'scheduled'
                          ? `Scheduled${followup.scheduled_date ? ` • ${followup.scheduled_date}` : ''}${followup.scheduled_time ? ` ${String(followup.scheduled_time).slice(0,5)}` : ''}`
                          : 'Pending schedule'}
                      </span>
                    </div>
                    <span className="customer-record-badge">Open</span>
                  </div>
                  {followup.remark && <p>{followup.remark}</p>}
                  <button type="button" className="secondary-button small-action" onClick={() => openPendingCase(followup)}>
                    <Wrench size={14} /> Update Case
                  </button>
                </article>
              ))}
              {customer.followups.length === 0 && <div className="customer-none">No pending settle case.</div>}
            </div>
          </section>

          <section className="customer-detail-section">
            <div className="lead-section-title">
              <div><p className="kicker">HISTORY</p><h3>Completed Installation</h3></div>
              <strong>{customer.completed_jobs.length}</strong>
            </div>

            <div className="customer-record-list">
              {customer.completed_jobs.map((job) => (
                <article className="customer-record-card done" key={job.id}>
                  <div className="customer-record-head">
                    <div>
                      <strong>{productNames(job.job_items, 'smart_lock')}</strong>
                      <span>{job.job_no || 'Completed Job'} • {crmDisplayDate(job.completed_at || job.installation_date)}</span>
                    </div>
                    <span className="customer-record-badge done">Done</span>
                  </div>
                  {productNames(job.job_items, 'lock_body', '') && (
                    <p className="customer-lock-body-line"><Wrench size={13} /> Lock Body: {productNames(job.job_items, 'lock_body', '')}</p>
                  )}
                  <p>
                    Invoice: {job.invoice_no || (job.invoice_status === 'invoiced' ? 'Invoiced' : 'Not invoiced')}
                    {job.settlement_status === 'pending' ? ' • Pending settle' : ''}
                  </p>
                </article>
              ))}
              {customer.completed_jobs.length === 0 && <div className="customer-none">No completed installation yet.</div>}
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}

function ProductCatalogPage({ products, openProductEditor, productDisplayName }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const normalized = search.trim().toLowerCase()

  const visible = products.filter((product) => {
    const matchesCategory = category === 'all' || product.category === category
    const matchesSearch = !normalized || `${product.sku || ''} ${product.name || ''} ${product.app_variant || ''}`
      .toLowerCase()
      .includes(normalized)
    return matchesCategory && matchesSearch
  })

  return (
    <div className="page-stack fade-in product-catalog-page">
      <section className="crm-head">
        <div>
          <p className="kicker">BOOKING ITEMS</p>
          <h2>Edit Items</h2>
          <p>Manage smart locks for bookings and lock bodies for technician completion updates. No stock quantity is tracked here.</p>
        </div>
        <button className="primary-button" onClick={() => openProductEditor()}>
          <Plus size={15} /> Add Item
        </button>
      </section>

      <div className="product-catalog-toolbar">
        <div className="customer-search">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search VN-4, VG-3, 6068..." />
        </div>
        <div className="product-catalog-filters">
          {[
            ['all', 'All'],
            ['smart_lock', 'Smart Locks'],
            ['lock_body', 'Lock Bodies'],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={category === value ? 'active' : ''}
              onClick={() => setCategory(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="product-catalog-list">
        {visible.map((product) => (
          <button
            type="button"
            className={`product-catalog-card ${product.active === false ? 'inactive' : ''}`}
            key={product.id}
            onClick={() => openProductEditor(product)}
          >
            <div className="product-catalog-icon">
              {product.category === 'smart_lock' ? <Boxes size={18} /> : <Wrench size={18} />}
            </div>
            <div className="product-catalog-copy">
              <div>
                <strong>{productDisplayName(product)}</strong>
                <span>{product.sku || 'No SKU'}</span>
              </div>
              <small>
                {product.category === 'smart_lock' ? 'Smart Lock' : 'Lock Body'}
                {product.active === false ? ' • Inactive' : ' • Active'}
              </small>
            </div>
            <Pencil size={16} />
          </button>
        ))}
        {visible.length === 0 && (
          <div className="empty-state"><Boxes size={24} /><strong>No item found</strong></div>
        )}
      </section>
    </div>
  )
}

function MorePageV7({ email, profile, formatRole, onLogout, setActiveTab, canViewUserAccess, openPasswordChange, isManagement }) {
  return (
    <div className="page-stack fade-in more-layout">
      <section className="profile-card">
        <div className="profile-avatar">{(profile?.display_name || email)?.charAt(0).toUpperCase()}</div>
        <div>
          <p className="kicker">SIGNED IN AS</p>
          <h2>{profile?.display_name || 'SVR User'}</h2>
          <p>{formatRole(profile?.role)} • {email}</p>
        </div>
      </section>

      <section className="surface-card settings-list">
        {isManagement && (
          <button onClick={() => setActiveTab('crm')}>
            <div className="settings-icon"><MessageCircle size={19} /></div>
            <div><strong>CRM Leads</strong><span>New, follow-up, important, done and loss</span></div>
            <ChevronRight size={17} />
          </button>
        )}
        <button onClick={() => setActiveTab('operations')}>
          <div className="settings-icon"><CalendarDays size={19} /></div>
          <div><strong>Operations</strong><span>Bookings, technician schedule and pending settle</span></div>
          <ChevronRight size={17} />
        </button>
        {isManagement && (
          <button onClick={() => setActiveTab('customers')}>
            <div className="settings-icon"><Users size={19} /></div>
            <div><strong>Customers</strong><span>Installation, items and after-sales history</span></div>
            <ChevronRight size={17} />
          </button>
        )}
        {isManagement && (
          <button onClick={() => setActiveTab('products')}>
            <div className="settings-icon"><Boxes size={19} /></div>
            <div><strong>Edit Items</strong><span>Smart locks for jobs • lock bodies after installation</span></div>
            <ChevronRight size={17} />
          </button>
        )}
        {isManagement && (
          <button onClick={() => setActiveTab('jobs')}>
            <div className="settings-icon"><ReceiptText size={19} /></div>
            <div><strong>Jobs & Invoices</strong><span>Completed installations and invoice tracking</span></div>
            <ChevronRight size={17} />
          </button>
        )}
        {canViewUserAccess && (
          <button onClick={() => setActiveTab('users')}>
            <div className="settings-icon"><UserCog size={19} /></div>
            <div><strong>User Access</strong><span>Owner, Admin and Technician access</span></div>
            <ChevronRight size={17} />
          </button>
        )}
        <button type="button" onClick={openPasswordChange}>
          <div className="settings-icon"><KeyRound size={19} /></div>
          <div><strong>Change Password</strong><span>Update your login password</span></div>
          <ChevronRight size={17} />
        </button>
        <button className="logout-setting" onClick={onLogout}>
          <div className="settings-icon"><LogOut size={19} /></div>
          <div><strong>Log Out</strong><span>Sign out of SVR CRM & Operations</span></div>
          <ChevronRight size={17} />
        </button>
      </section>
    </div>
  )
}



function TechnicianMyWorkV76({
  bookings = [],
  jobs = [],
  followups = [],
  leaves = [],
  profile,
  productById,
  productDisplayName,
  jobPhotos = [],
  openLeaveRequest,
  openCompleteInstallation,
  openEditCompletedJob,
  setActiveTab,
  setOperationsView,
}) {
  const technicianLocationId = profile?.location_id || ''
  const today = formatLocalDateKey(new Date())

  const activeBookings = bookings
    .filter((booking) =>
      booking.status === 'reserved' &&
      booking.installer_location_id === technicianLocationId
    )

  const exactBookings = activeBookings
    .filter((booking) => booking.schedule_type === 'exact' && booking.installation_date)
    .sort((a, b) =>
      `${a.installation_date}${a.installation_time || ''}`.localeCompare(
        `${b.installation_date}${b.installation_time || ''}`
      )
    )

  const todayBookings = exactBookings.filter(
    (booking) => booking.installation_date === today
  )

  const upcomingBookings = exactBookings.filter(
    (booking) => booking.installation_date >= today
  )

  const nextBooking = upcomingBookings[0] || null

  const myJobs = jobs.filter((job) =>
    !technicianLocationId ||
    job.technician_location_id === technicianLocationId ||
    job.installer_location_id === technicianLocationId
  )

  const myOpenFollowups = followups.filter((followup) => {
    if (!['pending', 'scheduled'].includes(followup.status)) return false
    if (followup.technician_location_id) {
      return followup.technician_location_id === technicianLocationId
    }
    const job = myJobs.find((item) => item.id === followup.job_id)
    return Boolean(job)
  })

  const completedJobs = myJobs
    .filter((job) => job.status === 'completed')
    .sort((a, b) =>
      String(b.completed_at || b.installation_date || '').localeCompare(
        String(a.completed_at || a.installation_date || '')
      )
    )

  const recordsToCheck = completedJobs.filter((job) => {
    const photos = jobPhotos.filter((photo) => photo.job_id === job.id)
    const hasLockBody = (job.job_items || []).some(
      (item) => productById(item.product_id)?.category === 'lock_body'
    )
    return !job.customer_taught || photos.length === 0 || !hasLockBody
  })

  const myLeaves = leaves
    .filter((leave) => leave.technician_location_id === technicianLocationId)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))

  const pendingLeaves = myLeaves.filter((leave) => leave.status === 'pending')
  const approvedLeaves = myLeaves
    .filter((leave) => leave.status === 'approved' && new Date(leave.end_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

  const nextLeave = approvedLeaves[0] || null

  const smartLockText = (booking) => {
    const names = (booking?.reservation_items || [])
      .map((item) => {
        const product = productById(item.product_id)
        if (!product || product.category === 'lock_body') return null
        const name = productDisplayName(product)
        return Number(item.quantity || 1) > 1
          ? `${name} ×${item.quantity}`
          : name
      })
      .filter(Boolean)
    return names.length ? names.join(' + ') : 'Product TBC'
  }

  const goOps = (view) => {
    setOperationsView(view)
    setActiveTab('operations')
  }

  return (
    <div className="page-stack fade-in technician-work-v76">
      <section className="tech-work-hero-v76">
        <div>
          <p className="kicker">TECHNICIAN WORKSPACE</p>
          <h2>My Work</h2>
          <p>Today jobs, leave, pending cases and completed installation records in one place.</p>
        </div>
        <button className="primary-button tech-leave-main-v76" onClick={openLeaveRequest}>
          <CalendarRange size={16} />
          Apply Leave
        </button>
      </section>

      <section className="tech-work-kpis-v76">
        <button onClick={() => goOps('today')}>
          <span>Today Jobs</span>
          <strong>{todayBookings.length}</strong>
          <small>Installation today</small>
        </button>

        <button onClick={() => goOps('calendar')}>
          <span>Upcoming</span>
          <strong>{upcomingBookings.length}</strong>
          <small>Scheduled jobs</small>
        </button>

        <button className={myOpenFollowups.length ? 'warning' : ''} onClick={() => goOps('pending')}>
          <span>Pending Settle</span>
          <strong>{myOpenFollowups.length}</strong>
          <small>Need follow-up</small>
        </button>

        <button className={recordsToCheck.length ? 'attention' : ''} onClick={() => goOps('completed')}>
          <span>Records to Check</span>
          <strong>{recordsToCheck.length}</strong>
          <small>Missing installation info</small>
        </button>
      </section>

      {nextBooking ? (
        <section className="surface-card tech-next-job-v76">
          <div className="tech-section-head-v76">
            <div>
              <p className="kicker">NEXT JOB</p>
              <h3>{nextBooking.customer_name || 'Customer'}</h3>
            </div>
            <span className="tech-next-time-v76">
              {crmDisplayDate(nextBooking.installation_date)}
              {nextBooking.installation_time ? ` • ${nextBooking.installation_time}` : ''}
            </span>
          </div>

          <div className="tech-next-products-v76">
            <span>SMART LOCK</span>
            <strong>{smartLockText(nextBooking)}</strong>
          </div>

          <div className="tech-next-meta-v76">
            {nextBooking.installation_area && (
              <span><MapPin size={13} /> {nextBooking.installation_area}</span>
            )}
            {nextBooking.installation_unit && (
              <span>{nextBooking.installation_unit}</span>
            )}
          </div>

          {nextBooking.technician_note && (
            <div className="tech-important-note-v76">
              <AlertTriangle size={15} />
              <div>
                <strong>Important Note</strong>
                <span>{nextBooking.technician_note}</span>
              </div>
            </div>
          )}

          <div className="tech-next-actions-v76">
            {nextBooking.customer_phone && (
              <a href={`tel:${nextBooking.customer_phone}`}>
                <Phone size={15} /> Call
              </a>
            )}
            {whatsappUrl(nextBooking.customer_phone) && (
              <a href={whatsappUrl(nextBooking.customer_phone)} target="_blank" rel="noreferrer">
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
            {googleMapsUrl(nextBooking) && (
              <a href={googleMapsUrl(nextBooking)} target="_blank" rel="noreferrer">
                <MapPin size={15} /> Maps
              </a>
            )}
          </div>

          {nextBooking.installation_date === today && (
            <button
              className="primary-button tech-complete-next-v76"
              onClick={() => openCompleteInstallation(nextBooking)}
            >
              <CheckCircle2 size={16} />
              Complete Installation
            </button>
          )}
        </section>
      ) : (
        <section className="surface-card tech-next-job-v76">
          <EmptyState
            title="No upcoming job"
            text="Your next scheduled installation will appear here."
          />
        </section>
      )}

      <section className="tech-quick-grid-v76">
        <button onClick={() => goOps('today')}>
          <CalendarDays size={19} />
          <div>
            <strong>Today Schedule</strong>
            <span>Open today's jobs</span>
          </div>
          <ChevronRight size={17} />
        </button>

        <button onClick={openLeaveRequest}>
          <CalendarRange size={19} />
          <div>
            <strong>Apply Leave</strong>
            <span>Full day or selected hours</span>
          </div>
          <ChevronRight size={17} />
        </button>

        <button onClick={() => goOps('completed')}>
          <History size={19} />
          <div>
            <strong>Completed History</strong>
            <span>Review or correct past installation</span>
          </div>
          <ChevronRight size={17} />
        </button>

        <button onClick={() => goOps('pending')}>
          <AlertTriangle size={19} />
          <div>
            <strong>Pending Settle</strong>
            <span>Unfinished / after-sales cases</span>
          </div>
          <ChevronRight size={17} />
        </button>
      </section>

      <section className="surface-card tech-leave-summary-v76">
        <div className="tech-section-head-v76">
          <div>
            <p className="kicker">MY AVAILABILITY</p>
            <h3>Leave</h3>
          </div>
          <button className="text-button" onClick={() => goOps('leave')}>View All</button>
        </div>

        <div className="tech-leave-summary-grid-v76">
          <div>
            <span>Pending Request</span>
            <strong>{pendingLeaves.length}</strong>
          </div>
          <div>
            <span>Approved Upcoming</span>
            <strong>{approvedLeaves.length}</strong>
          </div>
        </div>

        {nextLeave && (
          <div className="tech-next-leave-v76">
            <BadgeCheck size={16} />
            <div>
              <strong>Next approved leave</strong>
              <span>
                {new Date(nextLeave.start_at).toLocaleString('en-MY', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' → '}
                {new Date(nextLeave.end_at).toLocaleString('en-MY', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        )}
      </section>

      {recordsToCheck.length > 0 && (
        <section className="surface-card tech-record-check-v76">
          <div className="tech-section-head-v76">
            <div>
              <p className="kicker">INSTALLATION RECORD</p>
              <h3>Need to check</h3>
            </div>
            <strong>{recordsToCheck.length}</strong>
          </div>

          <p className="tech-record-help-v76">
            These completed jobs may be missing Lock Body, photo or Customer Taught confirmation.
          </p>

          <div className="tech-record-list-v76">
            {recordsToCheck.slice(0, 3).map((job) => (
              <button key={job.id} onClick={() => openEditCompletedJob(job)}>
                <div>
                  <strong>{job.customer_name || 'Customer'}</strong>
                  <span>{crmDisplayDate(job.completed_at || job.installation_date)}</span>
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


function TechnicianLeavePanelV75({ leaves, currentRole, profile, locationById, openLeaveRequest, decideLeave, cancelLeave }) {
  const now = Date.now()
  const sorted = [...(leaves || [])].sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
  const pending = sorted.filter((item) => item.status === 'pending')
  const upcomingApproved = sorted.filter((item) => item.status === 'approved' && new Date(item.end_at).getTime() >= now)
  const history = sorted.filter((item) => item.status !== 'pending' && !(item.status === 'approved' && new Date(item.end_at).getTime() >= now)).reverse().slice(0, 12)
  const isManagement = ['owner','admin'].includes(currentRole)

  const card = (leave, managementActions = false) => {
    const tech = locationById(leave.technician_location_id)
    return (
      <article className={`leave-card ${leave.status}`} key={leave.id}>
        <div className="leave-card-head">
          <div>
            <span className={`leave-status ${leave.status}`}>{leave.status}</span>
            <h3>{tech?.name || 'Technician'}</h3>
          </div>
          <CalendarRange size={18} />
        </div>
        <strong className="leave-range">{leave.full_day ? 'Full day' : 'Time leave'} • {leaveDateTimeLabel(leave.start_at)} → {leaveDateTimeLabel(leave.end_at)}</strong>
        <p>{leave.reason || 'No reason provided'}</p>
        {leave.decision_note && <small>Decision note: {leave.decision_note}</small>}
        {managementActions && leave.status === 'pending' && (
          <div className="leave-actions">
            <button className="secondary-button danger-soft" onClick={() => decideLeave(leave, 'rejected')}>Reject</button>
            <button className="primary-button" onClick={() => decideLeave(leave, 'approved')}><CheckCircle2 size={15} /> Approve</button>
          </div>
        )}
        {!isManagement && ['pending'].includes(leave.status) && (
          <div className="leave-actions"><button className="secondary-button danger-soft" onClick={() => cancelLeave(leave)}>Cancel Request</button></div>
        )}
      </article>
    )
  }

  return (
    <section className="leave-page-v75">
      <div className="surface-card leave-page-head">
        <div><p className="kicker">TECHNICIAN AVAILABILITY</p><h3>{isManagement ? 'Leave Requests' : 'My Leave'}</h3><span>{isManagement ? 'Approve leave before it blocks job assignment and appears on Calendar.' : 'Apply for a full day or a specific time range.'}</span></div>
        {!isManagement && <button className="primary-button" onClick={openLeaveRequest}><Plus size={15} /> Apply Leave</button>}
      </div>

      {isManagement && (
        <div className="leave-section-v75">
          <div className="section-title-row"><div><p className="kicker">ACTION REQUIRED</p><h3>Pending Approval</h3></div><strong>{pending.length}</strong></div>
          <div className="leave-grid">{pending.map((item) => card(item, true))}{pending.length === 0 && <div className="surface-card calendar-empty-card">No pending leave request.</div>}</div>
        </div>
      )}

      <div className="leave-section-v75">
        <div className="section-title-row"><div><p className="kicker">UPCOMING</p><h3>Approved Leave</h3></div><strong>{upcomingApproved.length}</strong></div>
        <div className="leave-grid">{upcomingApproved.map((item) => card(item, false))}{upcomingApproved.length === 0 && <div className="surface-card calendar-empty-card">No upcoming approved leave.</div>}</div>
      </div>

      {!isManagement && (
        <div className="leave-section-v75">
          <div className="section-title-row"><div><p className="kicker">REQUESTS</p><h3>Pending / Previous</h3></div></div>
          <div className="leave-grid">{[...pending, ...history].map((item) => card(item, false))}</div>
        </div>
      )}
    </section>
  )
}

function TechnicianCompletedJobsV75({ jobs, productById, productDisplayName, locationById, jobPhotos, openEditCompletedJob }) {
  return (
    <section className="technician-completed-v75">
      <div className="surface-card completed-history-head">
        <div><p className="kicker">COMPLETED HISTORY</p><h3>My Completed Jobs</h3><span>Completed jobs stay here so you can check or correct installation details later.</span></div>
        <strong>{jobs.length}</strong>
      </div>
      <div className="completed-job-list-v75">
        {jobs.map((job) => {
          const smartLocks = (job.job_items || []).filter((item) => productById(item.product_id)?.category !== 'lock_body')
          const lockBodies = (job.job_items || []).filter((item) => productById(item.product_id)?.category === 'lock_body')
          const photos = (jobPhotos || []).filter((photo) => photo.job_id === job.id)
          return (
            <article className="completed-job-card-v75" key={job.id}>
              <div className="completed-job-top-v75"><div><span>{new Date(job.completed_at).toLocaleDateString('en-MY', { day:'2-digit', month:'short', year:'numeric' })}</span><h3>{job.customer_name}</h3><p>{job.installation_area || 'Area not recorded'}</p></div><BadgeCheck size={20} /></div>
              <div className="completed-job-products-v75"><span>Smart Lock</span><strong>{smartLocks.length ? smartLocks.map((item) => `${item.quantity > 1 ? `${item.quantity}× ` : ''}${productDisplayName(productById(item.product_id))}`).join(' + ') : '—'}</strong></div>
              <div className="completed-job-products-v75 lock-body"><span>Lock Body Used</span><strong>{lockBodies.length ? lockBodies.map((item) => `${item.quantity > 1 ? `${item.quantity}× ` : ''}${productDisplayName(productById(item.product_id))}`).join(' + ') : 'Not updated'}</strong></div>
              <div className="completed-job-meta-v75"><span>{job.customer_taught ? '✓ Customer taught' : 'Customer teaching not marked'}</span><span>{job.review_received ? '✓ Review received' : job.review_asked ? 'Review asked' : 'Review not updated'}</span><span>{photos.length} photo{photos.length === 1 ? '' : 's'}</span></div>
              {job.completion_remark && <p className="completed-job-remark-v75">{job.completion_remark}</p>}
              <button className="secondary-button completed-edit-button-v75" onClick={() => openEditCompletedJob(job)}><Pencil size={15} /> Review / Edit Installation</button>
            </article>
          )
        })}
        {jobs.length === 0 && <div className="surface-card"><EmptyState title="No completed jobs yet" text="Completed installations will remain here for future checking." /></div>}
      </div>
    </section>
  )
}

function LeaveRequestModalV75({ form, setForm, saving, error, close, save }) {
  return (
    <div className="transaction-backdrop" onClick={close}>
      <section className="mini-modal leave-modal-v75" onClick={(event) => event.stopPropagation()}>
        <div className="mini-modal-head"><div><p className="kicker">APPLY LEAVE</p><h2>Request Time Off</h2><p>Approved leave will block new job assignment for this period.</p></div><button className="icon-button" onClick={close}><X size={18} /></button></div>
        <label className="leave-full-day-toggle"><input type="checkbox" checked={form.full_day} onChange={(event) => setForm((current) => ({ ...current, full_day: event.target.checked }))} /><div><strong>Full Day Leave</strong><span>Turn off to request a specific time range.</span></div></label>
        <div className="transaction-two-col"><div className="transaction-field"><label>Start Date *</label><input type="date" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value, end_date: current.end_date < event.target.value ? event.target.value : current.end_date }))} /></div><div className="transaction-field"><label>End Date *</label><input type="date" value={form.end_date} min={form.start_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} /></div></div>
        {!form.full_day && <div className="transaction-two-col"><div className="transaction-field"><label>Start Time *</label><input type="time" value={form.start_time} onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))} /></div><div className="transaction-field"><label>End Time *</label><input type="time" value={form.end_time} onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))} /></div></div>}
        <div className="transaction-field"><label>Reason</label><textarea rows="3" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Personal leave / appointment / family matter..." /></div>
        {error && <div className="transaction-error">{error}</div>}
        <div className="mini-modal-actions"><button className="secondary-button" onClick={close} disabled={saving}>Cancel</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Submitting...' : 'Submit Leave'}</button></div>
      </section>
    </div>
  )
}

function EditCompletedJobModalV75({ job, form, setForm, files, setFiles, lockBodyItems, lockBodyProducts, updateLockBody, addLockBody, removeLockBody, productById, productDisplayName, existingPhotos, saving, error, close, save }) {
  const smartLocks = (job.job_items || []).filter((item) => productById(item.product_id)?.category !== 'lock_body')
  return (
    <div className="transaction-backdrop" onClick={close}>
      <section className="transaction-modal completed-edit-modal-v75" onClick={(event) => event.stopPropagation()}>
        <div className="transaction-modal-head"><div><p className="kicker">COMPLETED JOB</p><h2>Review / Edit Installation</h2><p>{job.customer_name} • {job.job_no}</p></div><button className="icon-button" onClick={close}><X size={18} /></button></div>
        <div className="transaction-scroll">
          <div className="completion-smart-lock-readonly"><span>SMART LOCK INSTALLED</span><strong>{smartLocks.length ? smartLocks.map((item) => `${item.quantity > 1 ? `${item.quantity}× ` : ''}${productDisplayName(productById(item.product_id))}`).join(' + ') : '—'}</strong><small>Sales / booking item is kept read-only here.</small></div>
          <div className="completion-lock-body-section"><div className="completion-lock-body-head"><div><p className="kicker">ACTUAL INSTALLATION</p><h3>Lock Body Used</h3></div><button type="button" className="add-line-button" onClick={addLockBody}><Plus size={15} /> Add</button></div>
            {lockBodyItems.map((item, index) => <div className="completion-lock-body-row" key={index}><select value={item.product_id} onChange={(event) => updateLockBody(index, 'product_id', event.target.value)}><option value="">Select lock body</option>{lockBodyProducts.map((product) => <option key={product.id} value={product.id}>{product.name}{product.app_variant ? ` (${product.app_variant})` : ''}</option>)}</select><div className="completion-lock-body-qty"><span>Qty</span><input type="number" min="1" value={item.quantity} onChange={(event) => updateLockBody(index, 'quantity', event.target.value)} /></div><button type="button" className="remove-line-button" onClick={() => removeLockBody(index)}><Trash2 size={15} /></button></div>)}
          </div>
          <div className="completion-checks"><label><input type="checkbox" checked={form.customer_taught} onChange={(event) => setForm((current) => ({ ...current, customer_taught: event.target.checked }))} /><span><strong>Customer Taught</strong><small>Usage explained to customer</small></span></label><label><input type="checkbox" checked={form.review_asked} onChange={(event) => setForm((current) => ({ ...current, review_asked: event.target.checked }))} /><span><strong>Review Asked</strong><small>Requested customer review</small></span></label><label><input type="checkbox" checked={form.review_received} onChange={(event) => setForm((current) => ({ ...current, review_received: event.target.checked, review_asked: event.target.checked || current.review_asked }))} /><span><strong>Review Received</strong><small>Customer review confirmed</small></span></label></div>
          <div className="transaction-field"><label>Completion Remark</label><textarea rows="3" value={form.completion_remark} onChange={(event) => setForm((current) => ({ ...current, completion_remark: event.target.value }))} placeholder="Anything installed / adjusted / taught..." /></div>
          {existingPhotos.length > 0 && <div className="completed-existing-photos-v75"><label>Existing Photos</label><div className="job-photo-strip">{existingPhotos.map((photo) => <a key={photo.id} href={photo.signed_url || '#'} target="_blank" rel="noreferrer">{photo.signed_url ? <img src={photo.signed_url} alt={photo.file_name || 'Installation'} /> : <Camera size={18} />}</a>)}</div></div>}
          <div className="transaction-field"><label>Add More Installation Photos</label><input type="file" accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /><small>{files.length ? `${files.length} new photo(s) selected` : 'Optional'}</small></div>
          {job.settlement_status === 'pending' && <div className="completion-important-note"><AlertTriangle size={16} /><div><strong>Pending Settle remains open</strong><p>{job.pending_issue || 'Check Pending Settle tab for follow-up.'}</p></div></div>}
          {error && <div className="transaction-error">{error}</div>}
        </div>
        <div className="transaction-footer"><button className="secondary-button" onClick={close} disabled={saving}>Cancel</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button></div>
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
  acknowledgeBookingNote,
  profileByUserId,
  technicianLeaves = [],
  openLeaveRequest,
  decideLeave,
  cancelLeave,
  openEditCompletedJob,
  jobPhotos = [],
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
  const completedJobs = jobs
    .filter((item) => item.status === 'completed')
    .sort((a, b) => String(b.completed_at || '').localeCompare(String(a.completed_at || '')))
  const pendingLeaveCount = technicianLeaves.filter((item) => item.status === 'pending').length

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
      currentRole={currentRole}
      profile={profile}
      acknowledgeBookingNote={acknowledgeBookingNote}
      profileByUserId={profileByUserId}
    />
  )

  return (
    <div className="page-stack fade-in">
      <section className="surface-card page-intro operations-intro">
        <div>
          <p className="kicker">SVR DAILY OPERATIONS</p>
          <h2>Installation Calendar & Jobs</h2>
          <p>Booking → schedule → technician → installation → pending settle.</p>
        </div>
        {canManage && (
          <button className="primary-button" onClick={openNewBooking}>
            <Plus size={16} /> New Booking
          </button>
        )}
      </section>

      <section className="ops-kpi-grid">
        <div><span>Product TBC</span><strong>{promotion.length}</strong><small>Item not confirmed</small></div>
        <div><span>Installation TBC</span><strong>{tbc.length}</strong><small>Product confirmed</small></div>
        <div><span>Estimated</span><strong>{estimated.length}</strong><small>Waiting exact date</small></div>
        <div className="warning"><span>Pending Settle</span><strong>{pendingFollowups.length}</strong><small>Need follow-up</small></div>
      </section>

      <div className="status-tabs operations-tabs">
        {(currentRole === 'technician'
          ? [
              ['today', `Today ${todayBookings.length + todayFollowups.length}`],
              ['calendar', 'Calendar'],
              ['pending', `Pending ${pendingFollowups.length}`],
              ['completed', `Completed ${completedJobs.length}`],
              ['leave', `Leave ${pendingLeaveCount}`],
            ]
          : [
              ['calendar', 'Calendar'],
              ['board', 'Board'],
              ['today', `Today ${todayBookings.length + todayFollowups.length}`],
              ['schedule', `Scheduled ${scheduled.length}`],
              ['pending', `Pending Settle ${pendingFollowups.length}`],
              ['leave', `Leave ${pendingLeaveCount}`],
            ]).map(([id, label]) => (
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
            subtitle="Product confirmed"
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
          productById={productById}
          productDisplayName={productDisplayName}
          openEditBooking={openEditBooking}
          openFollowup={openFollowup}
          canManage={canManage}
          currentRole={currentRole}
          profile={profile}
          technicianLeaves={technicianLeaves}
        />
      )}

      {operationsView === 'today' && (
        <section className="ops-list today-mode-list">
          {currentRole === 'technician' && (
            <div className="surface-card today-mode-head">
              <div>
                <p className="kicker">TECHNICIAN TODAY MODE</p>
                <h3>My schedule • {localDate}</h3>
                <span>Call, WhatsApp, Maps, Important Note and Complete Installation — all here.</span>
              </div>
              <strong>{todayBookings.length + todayFollowups.length}</strong>
            </div>
          )}
          {[...todayBookings]
            .sort((a, b) => String(a.installation_time || '').localeCompare(String(b.installation_time || '')))
            .map(bookingCard)}
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

      {operationsView === 'completed' && currentRole === 'technician' && (
        <TechnicianCompletedJobsV75
          jobs={completedJobs}
          productById={productById}
          productDisplayName={productDisplayName}
          locationById={locationById}
          jobPhotos={jobPhotos}
          openEditCompletedJob={openEditCompletedJob}
        />
      )}

      {operationsView === 'leave' && (
        <TechnicianLeavePanelV75
          leaves={technicianLeaves}
          currentRole={currentRole}
          profile={profile}
          locationById={locationById}
          openLeaveRequest={openLeaveRequest}
          decideLeave={decideLeave}
          cancelLeave={cancelLeave}
        />
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
  productById,
  productDisplayName,
  openEditBooking,
  openFollowup,
  canManage,
  currentRole,
  profile,
  technicianLeaves = [],
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
        products: (booking.reservation_items || [])
          .filter((item) => productById(item.product_id)?.category !== 'lock_body')
          .map((item) => `${Number(item.quantity || 1) > 1 ? `${item.quantity}× ` : ''}${productDisplayName(productById(item.product_id))}`)
          .join(' + '),
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

    const leaveEvents = (technicianLeaves || [])
      .filter((leave) => leave.status === 'approved')
      .flatMap((leave) => {
        const start = new Date(leave.start_at)
        const endExclusive = new Date(leave.end_at)
        const endInclusive = new Date(endExclusive.getTime() - 1000)
        const firstKey = formatLocalDateKey(start)
        const lastKey = formatLocalDateKey(endInclusive)
        const days = []
        let cursorDay = new Date(`${firstKey}T12:00:00`)
        const lastDay = new Date(`${lastKey}T12:00:00`)
        while (cursorDay <= lastDay) {
          const key = formatLocalDateKey(cursorDay)
          let timeLabel = 'All day'
          if (!leave.full_day) {
            if (firstKey === lastKey) {
              timeLabel = `${start.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}–${endExclusive.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}`
            } else if (key === firstKey) {
              timeLabel = `From ${start.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}`
            } else if (key === lastKey) {
              timeLabel = `Until ${endExclusive.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}`
            }
          }
          days.push({
            id: `leave-${leave.id}-${key}`,
            type: 'leave',
            date: key,
            time: timeLabel,
            title: `${locationById(leave.technician_location_id)?.name || 'Technician'} Leave`,
            area: leave.reason || 'Approved leave',
            address: '',
            technicianId: leave.technician_location_id || '',
            record: leave,
          })
          cursorDay = addDays(cursorDay, 1)
        }
        return days
      })

    return [...bookingEvents, ...followupEvents, ...leaveEvents]
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
    technicianLeaves,
    technicianFilter,
    locationById,
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
    } else if (event.type === 'followup') {
      openFollowup(event.record, 'schedule')
    }
  }

  function eventMapUrl(event) {
    if (event.type === 'leave') return ''
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
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const todayKey = formatLocalDateKey(new Date())
  const weekKeys = days.map((day) => formatLocalDateKey(day))
  const defaultSelected = weekKeys.includes(todayKey) ? todayKey : weekKeys[0]
  const [selectedKey, setSelectedKey] = useState(defaultSelected)

  useEffect(() => {
    const nextKeys = days.map((day) => formatLocalDateKey(day))
    setSelectedKey((current) => nextKeys.includes(current) ? current : (nextKeys.includes(todayKey) ? todayKey : nextKeys[0]))
  }, [cursor])

  const selectedDay = days.find((day) => formatLocalDateKey(day) === selectedKey) || days[0]
  const selectedEvents = events.filter((event) => event.date === selectedKey)

  return (
    <>
      <div className="calendar-mobile-agenda">
        <div className="calendar-week-strip">
          {days.map((day) => {
            const key = formatLocalDateKey(day)
            const count = events.filter((event) => event.date === key).length
            return (
              <button
                type="button"
                key={key}
                className={`${key === selectedKey ? 'active' : ''} ${key === todayKey ? 'today' : ''}`}
                onClick={() => setSelectedKey(key)}
              >
                <span>{day.toLocaleDateString('en-MY', { weekday: 'short' })}</span>
                <strong>{day.getDate()}</strong>
                <small>{count > 0 ? count : ''}</small>
              </button>
            )
          })}
        </div>

        <section className="surface-card calendar-agenda-card">
          <div className="calendar-agenda-head">
            <div>
              <p className="kicker">JOBS</p>
              <h3>{selectedDay.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
            </div>
            <strong>{selectedEvents.length}</strong>
          </div>
          <div className="calendar-agenda-list">
            {selectedEvents.map((event) => (
              <CalendarEventV61
                key={event.id}
                event={event}
                eventClick={eventClick}
                mapUrl={eventMapUrl(event)}
                locationById={locationById}
                expanded
              />
            ))}
            {selectedEvents.length === 0 && (
              <div className="calendar-agenda-empty">No installation or follow-up job on this day.</div>
            )}
          </div>
        </section>
      </div>

      <div className="calendar-week-grid calendar-desktop-week">
        {days.map((day) => {
          const key = formatLocalDateKey(day)
          const dayEvents = events.filter((event) => event.date === key)

          return (
            <section key={key} className={key === todayKey ? 'surface-card calendar-week-day today' : 'surface-card calendar-week-day'}>
              <div className="calendar-week-day-head">
                <span>{day.toLocaleDateString('en-MY', { weekday: 'short' })}</span>
                <strong>{day.getDate()}</strong>
              </div>
              <div className="calendar-week-day-body">
                {dayEvents.map((event) => (
                  <CalendarEventV61 key={event.id} event={event} eventClick={eventClick} mapUrl={eventMapUrl(event)} locationById={locationById} expanded />
                ))}
                {dayEvents.length === 0 && <small className="calendar-no-event">No jobs</small>}
              </div>
            </section>
          )
        })}
      </div>
    </>
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
          {event.type === 'followup' ? '🔧 ' : event.type === 'leave' ? '🌴 ' : ''}
          {event.time || 'TBC'}
        </span>
        <strong>{event.title}</strong>
        {(expanded || event.unit) && (
          <small>
            {event.unit ? `${event.unit} • ` : ''}
            {event.area}
          </small>
        )}
        {expanded && event.type === 'installation' && event.products && <small className="calendar-smart-lock">🔐 {event.products}</small>}
        {expanded && event.type === 'leave' && event.area && <small className="calendar-leave-reason">{event.area}</small>}
        {expanded && tech && <small>{tech.name}</small>}
        {expanded && event.type === 'installation' && event.record?.technician_note && (
          <small className="calendar-important-note">⚠ {event.record.technician_note}</small>
        )}
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
  currentRole,
  profile,
  acknowledgeBookingNote,
  profileByUserId,
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
        {productTbc ? (
          <span className="tbc-product">Product TBC</span>
        ) : (booking.reservation_items || [])
          .filter((item) => productById(item.product_id)?.category !== 'lock_body')
          .map((item) => <span key={item.product_id}>{item.quantity}× {productDisplayName(productById(item.product_id))}</span>)}
      </div>

      {booking.selling_price != null && (
        <div className="booking-money-row">
          <span>Price <strong>RM{Number(booking.selling_price).toFixed(0)}</strong></span>
          <span>Balance <strong>RM{Math.max(0, Number(booking.selling_price || 0) - Number(booking.deposit_amount || 0)).toFixed(0)}</strong></span>
        </div>
      )}

      {booking.technician_note && (
        <div className={booking.technician_note_acknowledged_at ? 'technician-important-note acknowledged' : 'technician-important-note'}>
          <div className="technician-important-note-head">
            <span><AlertTriangle size={14} /> IMPORTANT NOTE FOR TECHNICIAN</span>
            {booking.technician_note_acknowledged_at && (
              <small><CheckCircle2 size={13} /> Acknowledged</small>
            )}
          </div>
          <p>{booking.technician_note}</p>
          <div className="technician-important-note-footer">
            {booking.technician_note_acknowledged_at ? (
              <span>
                Seen {new Date(booking.technician_note_acknowledged_at).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {profileByUserId?.(booking.technician_note_acknowledged_by)?.display_name
                  ? ` • ${profileByUserId(booking.technician_note_acknowledged_by).display_name}`
                  : ''}
              </span>
            ) : currentRole === 'technician' && profile?.location_id === booking.installer_location_id ? (
              <button type="button" onClick={() => acknowledgeBookingNote(booking)}>
                <CheckCircle2 size={14} /> Acknowledge
              </button>
            ) : (
              <span>Waiting technician acknowledgement</span>
            )}
          </div>
        </div>
      )}

      {booking.remark && <p className="ops-remark">{booking.remark}</p>}

      <div className="ops-card-actions">
        {canManage && (
          <button
            className="secondary-button"
            onClick={() => openEditBooking(booking)}
          >
            Edit
          </button>
        )}

        {canManage && productTbc && (
          <button
            className="primary-button"
            onClick={() => openEditBooking(booking, true)}
          >
            Confirm Product
          </button>
        )}

        {canManage && !productTbc && booking.installer_location_id && booking.handover_status !== 'handed_over' && <button className="secondary-button" onClick={() => openHandover(booking)}>Items Prepared</button>}
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
        {job?.technician_note && (
          <div className="followup-important-note">⚠ {job.technician_note}</div>
        )}
        {followup.remark && <small>{followup.remark}</small>}
        <div className="followup-actions">
          {canManage && <button className="secondary-button" onClick={() => openFollowup(followup, 'schedule')}>Schedule / Edit</button>}
          {canResolve && <button className="primary-button" onClick={() => openFollowup(followup, 'resolve')}>Settle Done</button>}
        </div>
      </div>
    </article>
  )
}


function GlobalSearchModal({
  query,
  setQuery,
  reservations,
  jobs,
  inventory,
  productById,
  productDisplayName,
  close,
  openBooking,
  openJob,
  openProduct,
}) {
  const normalized = query.trim().toLowerCase()

  const productNames = (items = []) =>
    items
      .map((item) => productDisplayName(productById(item.product_id)))
      .join(' ')

  const bookingResults = normalized
    ? reservations
        .filter((booking) =>
          [
            booking.customer_name,
            booking.customer_phone,
            booking.unit_no,
            booking.installation_area,
            booking.installation_address,
            booking.place_name,
            booking.promotion_name,
            booking.remark,
            booking.technician_note,
            productNames(booking.reservation_items),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(normalized)
        )
        .slice(0, 8)
    : []

  const jobResults = normalized
    ? jobs
        .filter((job) =>
          [
            job.job_no,
            job.invoice_no,
            job.customer_name,
            job.customer_phone,
            job.unit_no,
            job.installation_area,
            job.installation_address,
            job.place_name,
            job.remark,
            job.completion_remark,
            job.technician_note,
            productNames(job.job_items),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(normalized)
        )
        .slice(0, 8)
    : []

  const productResults = normalized
    ? inventory
        .filter((item) =>
          productDisplayName(item).toLowerCase().includes(normalized)
        )
        .slice(0, 8)
    : []

  const total = bookingResults.length + jobResults.length + productResults.length

  return (
    <div className="transaction-backdrop global-search-backdrop" onClick={close}>
      <section className="global-search-modal" onClick={(event) => event.stopPropagation()}>
        <div className="global-search-head">
          <div className="global-search-input-wrap">
            <Search size={18} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Customer, phone, Job No., address, model..."
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={16} />
              </button>
            )}
          </div>
          <button type="button" className="icon-button" onClick={close} aria-label="Close search">
            <X size={18} />
          </button>
        </div>

        <div className="global-search-body">
          {!normalized ? (
            <div className="global-search-empty">
              <Search size={26} />
              <h3>Search SVR Operations</h3>
              <p>Try customer name, phone number, address, Job No., invoice number or smart lock model.</p>
            </div>
          ) : total === 0 ? (
            <div className="global-search-empty">
              <Search size={26} />
              <h3>No result found</h3>
              <p>Try a shorter customer name, phone digits or product model.</p>
            </div>
          ) : (
            <div className="global-search-groups">
              {bookingResults.length > 0 && (
                <section>
                  <div className="global-search-section-title"><CalendarDays size={14} /><strong>Bookings</strong><span>{bookingResults.length}</span></div>
                  <div className="global-search-results">
                    {bookingResults.map((booking) => (
                      <button type="button" key={booking.id} onClick={() => openBooking(booking)}>
                        <div className="global-search-result-icon"><CalendarDays size={16} /></div>
                        <div>
                          <strong>{booking.customer_name}</strong>
                          <span>{booking.customer_phone || 'No phone'} • {booking.unit_no ? `${booking.unit_no} • ` : ''}{booking.installation_area || booking.place_name || 'Area TBC'}</span>
                          <small>{productNames(booking.reservation_items) || booking.promotion_name || 'Product TBC'}</small>
                        </div>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {jobResults.length > 0 && (
                <section>
                  <div className="global-search-section-title"><FileText size={14} /><strong>Jobs</strong><span>{jobResults.length}</span></div>
                  <div className="global-search-results">
                    {jobResults.map((job) => (
                      <button type="button" key={job.id} onClick={() => openJob(job)}>
                        <div className="global-search-result-icon"><FileText size={16} /></div>
                        <div>
                          <strong>{job.customer_name || job.job_no}</strong>
                          <span>{job.job_no || 'Job'}{job.invoice_no ? ` • Invoice ${job.invoice_no}` : ''}</span>
                          <small>{productNames(job.job_items) || job.installation_area || 'Completed Job'}</small>
                        </div>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {productResults.length > 0 && (
                <section>
                  <div className="global-search-section-title"><Boxes size={14} /><strong>Products</strong><span>{productResults.length}</span></div>
                  <div className="global-search-results">
                    {productResults.map((item) => (
                      <button type="button" key={item.product_id} onClick={() => openProduct(item)}>
                        <div className="global-search-result-icon"><Boxes size={16} /></div>
                        <div>
                          <strong>{productDisplayName(item)}</strong>
                          <span>{item.category === 'smart_lock' ? 'Smart Lock' : 'Lock Body'}</span>
                          <small>{item.app_variant || item.sku || 'Booking item'}</small>
                        </div>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function AdjustStockModal({
  item,
  form,
  setForm,
  locations,
  locationStock,
  productDisplayName,
  saving,
  error,
  changeLocation,
  close,
  save,
}) {
  const currentQty = Number(
    locationStock.find(
      (row) =>
        row.product_id === item.product_id &&
        row.location_id === form.location_id
    )?.quantity || 0
  )
  const actualQty = Math.max(0, Math.floor(Number(form.actual_quantity) || 0))
  const difference = actualQty - currentQty

  return (
    <div className="transaction-backdrop" onClick={close}>
      <section className="mini-modal adjust-stock-modal" onClick={(event) => event.stopPropagation()}>
        <div className="mini-modal-head">
          <div>
            <p className="kicker">SAFE STOCK ADJUSTMENT</p>
            <h2>Adjust Stock</h2>
            <p>{productDisplayName(item)}</p>
          </div>
          <button className="icon-button" onClick={close}><X size={18} /></button>
        </div>

        <div className="transaction-field">
          <label>Stock Holder *</label>
          <select value={form.location_id} onChange={(event) => changeLocation(event.target.value)}>
            <option value="">Select Stock Holder</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
        </div>

        <div className="adjust-stock-summary">
          <div><span>Current</span><strong>{currentQty}</strong></div>
          <ArrowRightLeft size={18} />
          <div className="actual"><span>Actual</span><strong>{actualQty}</strong></div>
          <div className={difference === 0 ? 'difference neutral' : difference > 0 ? 'difference positive' : 'difference negative'}>
            <span>Change</span>
            <strong>{difference > 0 ? '+' : ''}{difference}</strong>
          </div>
        </div>

        <div className="transaction-field">
          <label>Actual Physical Quantity *</label>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={form.actual_quantity}
            onChange={(event) => setForm((current) => ({
              ...current,
              actual_quantity: Math.max(0, Math.floor(Number(event.target.value) || 0)),
            }))}
          />
        </div>

        <div className="transaction-field">
          <label>Reason *</label>
          <textarea
            rows="3"
            value={form.reason}
            onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
            placeholder="e.g. Testing correction / physical count difference / damaged unit..."
          />
          <div className="adjust-reason-chips">
            {['Testing correction', 'Physical count correction', 'Damaged / missing unit'].map((reason) => (
              <button type="button" key={reason} onClick={() => setForm((current) => ({ ...current, reason }))}>{reason}</button>
            ))}
          </div>
        </div>

        <div className="adjust-stock-warning">
          <ShieldCheck size={16} />
          <span>This does not edit old history. SVR will create a new Adjustment In / Out record.</span>
        </div>

        {error && <div className="transaction-error">{error}</div>}

        <div className="mini-modal-actions">
          <button className="secondary-button" onClick={close} disabled={saving}>Cancel</button>
          <button className="primary-button" onClick={save} disabled={saving || !form.location_id || !form.reason.trim()}>
            {saving ? 'Saving...' : difference === 0 ? 'Save Check' : `Adjust ${difference > 0 ? '+' : ''}${difference}`}
          </button>
        </div>
      </section>
    </div>
  )
}

function BookingV6Modal({ editor, form, items, products, locations, saving, error, updateForm, updateItem, addItem, removeItem, close, save, technicianLeaves = [] }) {
  const productConfirmed = form.booking_type === 'product_confirmed'
  const directCustomer = Boolean(editor.directCustomer)
  return (
    <div className="transaction-backdrop" onClick={close}>
      <section className="transaction-modal booking-v6-modal" onClick={(e) => e.stopPropagation()}>
        <div className="transaction-modal-head"><div><p className="kicker">{directCustomer ? 'ADD CUSTOMER' : editor.type === 'new' ? 'NEW BOOKING' : 'EDIT BOOKING'}</p><h2>{directCustomer ? 'Confirmed Customer Order' : editor.type === 'new' ? 'Create Booking' : 'Update Booking'}</h2><p>{directCustomer ? 'For customers who already confirmed. Add customer details, smart lock, payment and installation timing.' : editor.type === 'edit' && form.booking_type === 'promotion_only' ? 'You can update customer, address, timing, payment or notes without confirming a product.' : 'It is okay if product or installation date is still TBC.'}</p></div><button className="icon-button" onClick={close}><X size={18} /></button></div>
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

          {directCustomer ? (
            <div className="direct-customer-banner"><BadgeCheck size={17} /><div><strong>Confirmed Customer</strong><span>Choose the smart lock below. Lock body is recorded by the technician after installation.</span></div></div>
          ) : (
            <div className="booking-type-switch">
              <button className={form.booking_type === 'promotion_only' ? 'active' : ''} onClick={() => updateForm('booking_type', 'promotion_only')}><Star size={16} /><strong>Promotion Booking</strong><span>Product TBC • item not confirmed</span></button>
              <button className={form.booking_type === 'product_confirmed' ? 'active' : ''} onClick={() => updateForm('booking_type', 'product_confirmed')}><PackageCheck size={16} /><strong>Product Confirmed</strong><span>Smart lock confirmed for installation</span></button>
            </div>
          )}

          <div className="transaction-two-col">
            <div className="transaction-field"><label>Promotion / Deal</label><input value={form.promotion_name} onChange={(e) => updateForm('promotion_name', e.target.value)} placeholder="Sept Promo / Combo 2" /></div>
            <div className="transaction-field"><label>Payment Status</label><select value={form.payment_status} onChange={(e) => updateForm('payment_status', e.target.value)}><option value="not_paid">Not Paid</option><option value="deposit_paid">Deposit Paid</option><option value="partial_paid">Partial Paid</option><option value="fully_paid">Fully Paid</option></select></div>
          </div>
          <div className="transaction-two-col">
            <div className="transaction-field"><label>Selling Price (RM)</label><input type="number" min="0" value={form.selling_price} onChange={(e) => updateForm('selling_price', e.target.value)} /></div>
            <div className="transaction-field"><label>Deposit (RM)</label><input type="number" min="0" value={form.deposit_amount} onChange={(e) => updateForm('deposit_amount', e.target.value)} /></div>
          </div>

          {productConfirmed && (
            <div className="transaction-products"><div className="transaction-products-head"><div><p className="kicker">INSTALLATION ITEM</p><h3>Smart Lock to Install</h3></div><button type="button" className="add-line-button" onClick={addItem}><Plus size={15} /> Add item</button></div>
              {items.map((item, index) => <div className="transaction-item" key={index}><div className="transaction-item-main"><select value={item.product_id} onChange={(e) => updateItem(index, 'product_id', e.target.value)}><option value="">Select smart lock</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.app_variant ? ` (${product.app_variant})` : ''}</option>)}</select><div className="transaction-qty"><span>Qty</span><input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} /></div><button type="button" className="remove-line-button" onClick={() => removeItem(index)}><Trash2 size={16} /></button></div></div>)}
            </div>
          )}

          <div className="transaction-field"><label>Installation Timing</label><div className="timing-options">{[['tbc','TBC'],['estimated','Estimated'],['exact','Exact Date']].map(([id,label]) => <button key={id} className={form.schedule_type === id ? 'active' : ''} onClick={() => updateForm('schedule_type', id)}>{label}</button>)}</div></div>
          {form.schedule_type === 'estimated' && <div className="transaction-field"><label>Estimated Installation *</label><input value={form.estimated_installation} onChange={(e) => updateForm('estimated_installation', e.target.value)} placeholder="e.g. Dec '26 • house still renovating" /></div>}
          {form.schedule_type === 'exact' && <div className="transaction-two-col"><div className="transaction-field"><label>Date *</label><input type="date" value={form.installation_date} onChange={(e) => updateForm('installation_date', e.target.value)} /></div><div className="transaction-field"><label>Time</label><input type="time" value={form.installation_time} onChange={(e) => updateForm('installation_time', e.target.value)} /></div></div>}
          <div className="transaction-field"><label>Technician / Installer</label><select value={form.installer_location_id} onChange={(e) => updateForm('installer_location_id', e.target.value)}><option value="">TBC / Not assigned</option>{locations.filter((l) => ['technician','sales_installer','partner'].includes(l.location_type)).map((l) => { const onLeave = form.schedule_type === 'exact' && approvedLeaveConflict(technicianLeaves, l.id, form.installation_date, form.installation_time); return <option key={l.id} value={l.id} disabled={onLeave}>{l.name}{onLeave ? ' • On Leave' : ''}</option> })}</select>{form.installer_location_id && form.schedule_type === 'exact' && approvedLeaveConflict(technicianLeaves, form.installer_location_id, form.installation_date, form.installation_time) && <small className="field-warning">This technician is on approved leave at the selected time. Choose another technician or time.</small>}</div>
          <div className="transaction-field technician-note-editor">
            <label><AlertTriangle size={14} /> Important Note for Technician</label>
            <textarea rows="3" value={form.technician_note} onChange={(e) => updateForm('technician_note', e.target.value)} placeholder="e.g. Keep old lock for customer / bring long cylinder / register at guard house / collect balance RM500..." />
            <small>Shown prominently in Today, Board, Complete Installation and Pending Settle.</small>
          </div>
          <div className="transaction-field"><label>Internal Remark</label><textarea rows="3" value={form.remark} onChange={(e) => updateForm('remark', e.target.value)} placeholder="Customer house still renovating, expected Dec '26..." /></div>
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

function CompleteInstallationV6Modal({
  booking,
  form,
  setForm,
  files,
  setFiles,
  lockBodyItems,
  lockBodyProducts,
  updateLockBody,
  addLockBody,
  removeLockBody,
  productById,
  productDisplayName,
  locations,
  saving,
  error,
  close,
  save,
}) {
  const assignedSmartLocks = (booking.reservation_items || [])
    .filter((item) => productById(item.product_id)?.category !== 'lock_body')

  return (
    <div className="transaction-backdrop" onClick={close}>
      <section className="transaction-modal completion-v6-modal" onClick={(event) => event.stopPropagation()}>
        <div className="transaction-modal-head">
          <div>
            <p className="kicker">TECHNICIAN UPDATE</p>
            <h2>Complete Installation</h2>
            <p>{booking.customer_name} • confirm what was installed, then close / pending settle.</p>
          </div>
          <button className="icon-button" onClick={close}><X size={18} /></button>
        </div>

        <div className="transaction-scroll">
          <section className="completion-installed-summary">
            <div className="completion-installed-head">
              <div><p className="kicker">ASSIGNED JOB</p><h3>Smart Lock to Install</h3></div>
              <PackageCheck size={18} />
            </div>
            <div className="completion-smart-lock-tags">
              {assignedSmartLocks.map((item) => (
                <span key={item.product_id}>{item.quantity}× {productDisplayName(productById(item.product_id))}</span>
              ))}
              {assignedSmartLocks.length === 0 && <span>Smart lock not recorded</span>}
            </div>
          </section>

          {booking.technician_note && (
            <div className="completion-important-note"><AlertTriangle size={16} /><div><strong>Important Note</strong><p>{booking.technician_note}</p></div></div>
          )}

          <section className="completion-lock-body-panel">
            <div className="completion-lock-body-head">
              <div>
                <p className="kicker">AFTER INSTALLATION</p>
                <h3>Lock Body Used</h3>
                <span>Technician updates the actual lock body after installation. This does not affect Bukku stock.</span>
              </div>
              <button type="button" className="add-line-button" onClick={addLockBody}><Plus size={14} /> Add</button>
            </div>
            <div className="completion-lock-body-list">
              {lockBodyItems.map((item, index) => (
                <div className="completion-lock-body-row" key={index}>
                  <select value={item.product_id} onChange={(event) => updateLockBody(index, 'product_id', event.target.value)}>
                    <option value="">Select lock body</option>
                    {lockBodyProducts.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}{product.app_variant ? ` (${product.app_variant})` : ''}</option>
                    ))}
                  </select>
                  <div className="completion-lock-body-qty">
                    <span>Qty</span>
                    <input type="number" min="1" value={item.quantity} onChange={(event) => updateLockBody(index, 'quantity', event.target.value)} />
                  </div>
                  <button type="button" className="remove-line-button" onClick={() => removeLockBody(index)} aria-label="Remove lock body"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </section>

          <div className="completion-checks">
            <label><input type="checkbox" checked={form.customer_taught} onChange={(e) => setForm((c) => ({...c, customer_taught:e.target.checked}))} /><span><strong>Customer taught how to use lock</strong><small>Basic usage / app / charging explained</small></span></label>
            <label><input type="checkbox" checked={form.review_asked} onChange={(e) => setForm((c) => ({...c, review_asked:e.target.checked}))} /><span><strong>Asked customer for review</strong><small>Google / Facebook review requested</small></span></label>
            <label><input type="checkbox" checked={form.review_received} onChange={(e) => setForm((c) => ({...c, review_received:e.target.checked, review_asked:e.target.checked || c.review_asked}))} /><span><strong>Review received</strong><small>Customer already submitted review</small></span></label>
          </div>

          <div className="transaction-field">
            <label>Installation Photos</label>
            <label className="photo-upload-box"><Upload size={22} /><strong>Choose Photos</strong><span>Front / inside / lock body / overall door</span><input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} /></label>
            {files.length > 0 && <div className="selected-files">{files.map((file) => <span key={`${file.name}-${file.size}`}><ImageIcon size={13} /> {file.name}</span>)}</div>}
          </div>

          <label className="pending-settle-switch"><input type="checkbox" checked={form.pending_settle} onChange={(e) => setForm((c) => ({...c, pending_settle:e.target.checked}))} /><div><strong>Pending Settle</strong><span>Something is not fully completed and we must return.</span></div></label>
          {form.pending_settle && <div className="transaction-field"><label>What is still not settled? *</label><textarea rows="3" value={form.pending_issue} onChange={(e) => setForm((c) => ({...c, pending_issue:e.target.value}))} placeholder="e.g. Need return to adjust strike plate / replace lock body / Wi-Fi linking..." /></div>}
          <div className="transaction-field"><label>Completion Remark</label><textarea rows="3" value={form.completion_remark} onChange={(e) => setForm((c) => ({...c, completion_remark:e.target.value}))} /></div>
          {error && <div className="transaction-error">{error}</div>}
        </div>

        <div className="transaction-footer"><button className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Saving & Uploading...' : form.pending_settle ? 'Complete • Pending Settle' : 'Complete Installation'}</button></div>
      </section>
    </div>
  )
}

function FollowupV6Modal({ editor, form, setForm, locations, saving, error, close, save, technicianLeaves = [] }) {
  const resolve = editor.mode === 'resolve'
  return <div className="transaction-backdrop" onClick={close}><section className="mini-modal followup-modal" onClick={(e) => e.stopPropagation()}><div className="mini-modal-head"><div><p className="kicker">PENDING SETTLE</p><h2>{resolve ? 'Settle Completed' : 'Schedule Follow-up'}</h2><p>{editor.job?.customer_name} • {editor.followup.issue}</p></div><button className="icon-button" onClick={close}><X size={18} /></button></div>{resolve ? <><div className="transaction-field"><label>What was settled? *</label><textarea rows="3" value={form.resolution_note} onChange={(e) => setForm((c) => ({...c, resolution_note:e.target.value}))} /></div><div className="completion-checks compact"><label><input type="checkbox" checked={form.review_asked} onChange={(e) => setForm((c) => ({...c, review_asked:e.target.checked}))} /><span><strong>Asked for review</strong></span></label><label><input type="checkbox" checked={form.review_received} onChange={(e) => setForm((c) => ({...c, review_received:e.target.checked, review_asked:e.target.checked || c.review_asked}))} /><span><strong>Review received</strong></span></label></div></> : <><div className="transaction-field"><label>Technician</label><select value={form.technician_location_id} onChange={(e) => setForm((c) => ({...c, technician_location_id:e.target.value}))}><option value="">TBC</option>{locations.filter((l) => ['technician','sales_installer','partner'].includes(l.location_type)).map((l) => { const onLeave = approvedLeaveConflict(technicianLeaves, l.id, form.scheduled_date, form.scheduled_time); return <option key={l.id} value={l.id} disabled={onLeave}>{l.name}{onLeave ? ' • On Leave' : ''}</option> })}</select>{form.technician_location_id && approvedLeaveConflict(technicianLeaves, form.technician_location_id, form.scheduled_date, form.scheduled_time) && <small className="field-warning">This technician is on approved leave at this time.</small>}</div><div className="transaction-two-col"><div className="transaction-field"><label>Date</label><input type="date" value={form.scheduled_date} onChange={(e) => setForm((c) => ({...c, scheduled_date:e.target.value}))} /></div><div className="transaction-field"><label>Time</label><input type="time" value={form.scheduled_time} onChange={(e) => setForm((c) => ({...c, scheduled_time:e.target.value}))} /></div></div><div className="transaction-field"><label>Remark</label><textarea rows="2" value={form.remark} onChange={(e) => setForm((c) => ({...c, remark:e.target.value}))} /></div></>}{error && <div className="transaction-error">{error}</div>}<div className="mini-modal-actions"><button className="secondary-button" onClick={close}>Cancel</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Saving...' : resolve ? 'Mark Settled' : 'Save Follow-up'}</button></div></section></div>
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
  openEditCompletedJob,
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
                  <span>Technician / Installer</span>
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

              {job.technician_note && <div className="job-technician-note"><strong>Technician Note:</strong> {job.technician_note}</div>}
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
                  {!isVoided && openEditCompletedJob && (
                    <button className="secondary-button" onClick={() => openEditCompletedJob(job)}>
                      <Pencil size={15} /> Edit Completion
                    </button>
                  )}
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
  currentRole,
  profile,
  locationById,
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

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = formatLocalDateKey(tomorrow)
  const threeDaysAgo = new Date(today)
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const pendingSettle = followups.filter((item) =>
    ['pending', 'scheduled'].includes(item.status)
  )
  const staleInvoices = jobs.filter((item) =>
    item.status !== 'voided' &&
    item.invoice_status === 'not_invoiced' &&
    item.completed_at &&
    new Date(item.completed_at) < threeDaysAgo
  )
  const tomorrowNotHanded = reservations.filter((item) =>
    item.status === 'reserved' &&
    item.booking_type === 'product_confirmed' &&
    item.schedule_type === 'exact' &&
    item.installation_date === tomorrowKey &&
    item.handover_status !== 'handed_over'
  )
  const longTbc = reservations.filter((item) =>
    item.status === 'reserved' &&
    item.schedule_type === 'tbc' &&
    item.created_at &&
    new Date(item.created_at) < thirtyDaysAgo
  )
  const attentionTotal =
    pendingSettle.length +
    staleInvoices.length +
    lowStock.length +
    tomorrowNotHanded.length +
    longTbc.length

  const technicianToday = currentRole === 'technician'
    ? reservations
        .filter((item) =>
          item.status === 'reserved' &&
          item.schedule_type === 'exact' &&
          item.installation_date === formatLocalDateKey(today)
        )
        .sort((a, b) => String(a.installation_time || '').localeCompare(String(b.installation_time || '')))
    : []

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

      {currentRole === 'technician' && (
        <section className="surface-card technician-today-card">
          <div className="section-head">
            <div>
              <p className="kicker">MY TODAY</p>
              <h3>{technicianToday.length} installation{technicianToday.length === 1 ? '' : 's'}</h3>
            </div>
            <button className="text-link" onClick={() => setActiveTab('operations')}>
              Open Today <ChevronRight size={15} />
            </button>
          </div>
          <div className="technician-today-list">
            {technicianToday.slice(0, 4).map((booking) => (
              <div key={booking.id} className="technician-today-row">
                <strong>{booking.installation_time ? String(booking.installation_time).slice(0, 5) : 'TBC'}</strong>
                <div>
                  <b>{booking.customer_name}</b>
                  <span>{booking.unit_no ? `${booking.unit_no} • ` : ''}{booking.installation_area || booking.place_name || 'Site'}</span>
                  {booking.technician_note && <small>⚠ {booking.technician_note}</small>}
                </div>
              </div>
            ))}
            {technicianToday.length === 0 && (
              <EmptyState title="No installation today" text="Your assigned jobs for today will appear here." />
            )}
          </div>
        </section>
      )}

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
          <span className="home-focus-total">{attentionTotal}</span>
        </div>

        <div className="home-focus-list">
          <button onClick={() => setActiveTab('operations')}>
            <div className="home-focus-icon warning"><AlertTriangle size={16} /></div>
            <div><strong>Pending Settle</strong><span>Need return / follow-up</span></div>
            <b>{pendingSettle.length}</b><ChevronRight size={16} />
          </button>

          <button onClick={() => setActiveTab('jobs')}>
            <div className="home-focus-icon"><ReceiptText size={16} /></div>
            <div><strong>Not Invoiced &gt; 3 Days</strong><span>Completed jobs waiting billing</span></div>
            <b>{staleInvoices.length}</b><ChevronRight size={16} />
          </button>

          <button onClick={() => setActiveTab('inventory')}>
            <div className="home-focus-icon warning"><PackageMinus size={16} /></div>
            <div><strong>Low Stock</strong><span>Available at / below minimum</span></div>
            <b>{lowStock.length}</b><ChevronRight size={16} />
          </button>

          <button onClick={() => setActiveTab('operations')}>
            <div className="home-focus-icon"><PackageCheck size={16} /></div>
            <div><strong>Tomorrow • Not Handed Over</strong><span>Prepare stock before installation</span></div>
            <b>{tomorrowNotHanded.length}</b><ChevronRight size={16} />
          </button>

          <button onClick={() => setActiveTab('operations')}>
            <div className="home-focus-icon"><CalendarDays size={16} /></div>
            <div><strong>TBC Over 30 Days</strong><span>Old bookings needing follow-up</span></div>
            <b>{longTbc.length}</b><ChevronRight size={16} />
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
  openItem,
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
          <button
            type="button"
            className="inventory-card inventory-card-button"
            key={item.product_id}
            onClick={() => openItem(item)}
            aria-label={`Open ${productDisplayName(item)} stock history`}
          >
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

            <div className="inventory-card-view">
              <span><History size={13} /> View item trace</span>
              <ChevronRight size={15} />
            </div>
          </button>
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


function InventoryItemDetail({
  item,
  movements,
  loading,
  error,
  locationStock,
  locations,
  profile,
  isManagement,
  productDisplayName,
  locationById,
  profileByUserId,
  movementSubtitle,
  formatDate,
  openAdjustStock,
  close,
}) {
  const [filter, setFilter] = useState('all')

  const allowedLocationId = !isManagement ? profile?.location_id : null

  const stockRows = locationStock
    .filter((row) => row.product_id === item.product_id)
    .filter((row) => !allowedLocationId || row.location_id === allowedLocationId)
    .filter((row) => Number(row.quantity || 0) !== 0)
    .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))

  const filterMatch = (movement) => {
    if (filter === 'all') return true
    if (filter === 'in') {
      return ['stock_in', 'return'].includes(movement.movement_type)
    }
    if (filter === 'transfer') return movement.movement_type === 'transfer'
    if (filter === 'out') return movement.movement_type === 'stock_out'
    if (filter === 'adjustment') {
      return ['adjustment_in', 'adjustment_out'].includes(movement.movement_type)
    }
    return true
  }

  const filteredMovements = movements.filter(filterMatch)

  const movementLabel = (type) => {
    if (type === 'stock_in') return 'Stock In'
    if (type === 'transfer') return 'Transfer'
    if (type === 'stock_out') return 'Stock Out'
    if (type === 'return') return 'Return'
    if (type === 'adjustment_in') return 'Adjustment In'
    if (type === 'adjustment_out') return 'Adjustment Out'
    return String(type || 'Movement').replaceAll('_', ' ')
  }

  const movementTone = (type) => {
    if (['stock_in', 'return', 'adjustment_in'].includes(type)) return 'positive'
    if (type === 'transfer') return 'transfer'
    return 'negative'
  }

  const quantityPrefix = (type) => {
    if (['stock_in', 'return', 'adjustment_in'].includes(type)) return '+'
    if (['stock_out', 'adjustment_out'].includes(type)) return '-'
    return ''
  }

  return (
    <div className="page-stack fade-in inventory-detail-page">
      <section className="inventory-detail-nav">
        <button type="button" className="detail-back-button" onClick={close}>
          <ChevronLeft size={18} /> Inventory
        </button>
        <span className="detail-history-count">
          <History size={13} /> {movements.length} movements
        </span>
      </section>

      <section className="surface-card inventory-detail-hero">
        <div className="inventory-detail-title-row">
          <div>
            <span className="category-label">
              {item.category === 'smart_lock' ? 'SMART LOCK' : 'LOCK BODY'}
            </span>
            <h2>{productDisplayName(item)}</h2>
            <p>Live stock position and item movement history.</p>
          </div>
          <div className="available-chip detail-available-chip">
            <span>Available</span>
            <strong>{item.available_stock}</strong>
          </div>
        </div>

        {isManagement && (
          <div className="inventory-detail-actions">
            <button className="secondary-button" onClick={() => openAdjustStock(item)}>
              <SlidersHorizontal size={15} /> Adjust Stock
            </button>
          </div>
        )}

        <div className="inventory-detail-stats">
          <div><span>Physical</span><strong>{item.physical_stock}</strong></div>
          <div><span>Reserved</span><strong>{item.reserved_stock}</strong></div>
          <div><span>Minimum</span><strong>{item.minimum_stock}</strong></div>
        </div>
      </section>

      <section className="surface-card item-location-card">
        <div className="section-head compact-head">
          <div>
            <p className="kicker">CURRENT LOCATION</p>
            <h3>Where the stock is now</h3>
          </div>
          <Warehouse size={18} />
        </div>

        <div className="item-location-list">
          {stockRows.map((row) => {
            const location =
              locations.find((entry) => entry.id === row.location_id) ||
              locationById(row.location_id)
            return (
              <div className="item-location-row" key={row.location_id}>
                <div>
                  <strong>{location?.name || 'Unknown Location'}</strong>
                  <span>{location?.location_type?.replaceAll('_', ' ') || 'Stock Holder'}</span>
                </div>
                <div className="item-location-qty-action">
                  <b>{Number(row.quantity || 0)}</b>
                  {isManagement && (
                    <button type="button" onClick={() => openAdjustStock(item, row.location_id)}>
                      Adjust
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {stockRows.length === 0 && (
            <EmptyState
              title="No physical stock"
              text="There is currently no physical unit at the locations you can view."
            />
          )}
        </div>
      </section>

      <section className="surface-card item-trace-card">
        <div className="section-head compact-head item-trace-head">
          <div>
            <p className="kicker">ITEM TRACE</p>
            <h3>Movement History</h3>
          </div>
          <span>{filteredMovements.length} shown</span>
        </div>

        <div className="item-trace-filters" role="tablist" aria-label="Movement filter">
          {[
            ['all', 'All'],
            ['in', 'In / Return'],
            ['transfer', 'Transfer'],
            ['out', 'Out'],
            ['adjustment', 'Adjustment'],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={filter === value ? 'active' : ''}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <div className="item-trace-warning">{error}</div>}

        {loading ? (
          <div className="item-trace-loading">
            <RefreshCw size={17} className="spin" /> Loading item history…
          </div>
        ) : (
          <div className="item-trace-list">
            {filteredMovements.map((movement) => {
              const actor = profileByUserId(movement.created_by)
              const tone = movementTone(movement.movement_type)
              const prefix = quantityPrefix(movement.movement_type)

              return (
                <article className="item-trace-row" key={movement.id}>
                  <div className={`item-trace-icon ${tone}`}>
                    {movement.movement_type === 'transfer' ? (
                      <ArrowRightLeft size={16} />
                    ) : movement.movement_type === 'stock_out' ||
                      movement.movement_type === 'adjustment_out' ? (
                      <PackageMinus size={16} />
                    ) : (
                      <ArrowDownToLine size={16} />
                    )}
                  </div>

                  <div className="item-trace-copy">
                    <div className="item-trace-topline">
                      <strong>{movementLabel(movement.movement_type)}</strong>
                      <b className={tone}>{prefix}{movement.quantity}</b>
                    </div>
                    <p>{movementSubtitle(movement)}</p>

                    {(movement.customer_name || movement.reference_no || movement.remark) && (
                      <div className="item-trace-meta">
                        {movement.customer_name && <span>Customer: {movement.customer_name}</span>}
                        {movement.reference_no && <span>Ref: {movement.reference_no}</span>}
                        {movement.remark && <span>{movement.remark}</span>}
                      </div>
                    )}

                    <div className="item-trace-footer">
                      <time>{formatDate(movement.created_at)}</time>
                      {actor && (
                        <span>By {actor.display_name || actor.email}</span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}

            {filteredMovements.length === 0 && (
              <EmptyState
                title="No matching movement"
                text={movements.length === 0
                  ? 'This item does not have a stock movement yet.'
                  : 'Try another movement filter.'}
              />
            )}
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
            <p className="kicker">{isNew ? 'NEW ITEM' : 'EDIT ITEM'}</p>
            <h2>{isNew ? 'Add Item' : 'Edit Item'}</h2>
            <p>Item details used in Booking, Operations and technician job cards.</p>
          </div>
          <button className="icon-button" onClick={close}><X size={18} /></button>
        </div>

        <div className="settings-form-grid">
          <div className="transaction-field">
            <label>SKU *</label>
            <input value={form.sku} onChange={(e) => updateForm('sku', e.target.value)} placeholder="e.g. VN-4" />
          </div>
          <div className="transaction-field">
            <label>Item Name *</label>
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
        </div>

        {!isNew && (
          <label className="settings-toggle-row">
            <div>
              <strong>Active Product</strong>
              <span>Inactive items cannot be selected in new bookings.</span>
            </div>
            <input type="checkbox" checked={form.active} onChange={(e) => updateForm('active', e.target.checked)} />
          </label>
        )}

        {error && <div className="transaction-error">{error}</div>}
        <div className="mini-modal-actions">
          <button className="secondary-button" onClick={close} disabled={saving}>Cancel</button>
          <button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Item'}</button>
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
}) {
  return (
    <div className="page-stack fade-in">
      <section className="surface-card page-intro users-intro">
        <div>
          <p className="kicker">OWNER CONTROL</p>
          <h2>User Access</h2>
          <p>
            Create login accounts in Supabase Authentication first, then
            manage each user's role, linked stock holder and active status here.
          </p>
        </div>
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
          <strong>Internal account management</strong>
          <span>
            New login: Supabase → Authentication → Users → Add User.
            Then refresh SVR Inventory and use Edit Access here to assign the correct role and stock holder.
          </span>
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
}) {
  return (
    <div className="transaction-backdrop" onClick={close}>
      <section
        className="mini-modal access-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mini-modal-head">
          <div>
            <p className="kicker">ACCOUNT SECURITY</p>
            <h2>Change Password</h2>
            <p>Use at least 8 characters.</p>
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

        <div className="mini-modal-actions">
          <button className="secondary-button" onClick={close} disabled={saving}>
            Cancel
          </button>
          <button className="primary-button" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save Access'}
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
