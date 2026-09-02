import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  ChevronRight,
  ClipboardList,
  FileText,
  History,
  Home,
  KeyRound,
  LogOut,
  Menu,
  PackageCheck,
  PackageMinus,
  ReceiptText,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  UserRound,
  UserPlus,
  Users,
  Warehouse,
  Wrench,
  X,
  XCircle,
} from 'lucide-react'
import { supabase } from './lib/supabaseClient'
import './App.css'

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'reservations', label: 'Reservations', icon: PackageCheck },
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
    return (
      window.location.hash.includes('type=invite') ||
      window.location.search.includes('type=invite') ||
      window.location.hash.includes('type=recovery') ||
      window.location.search.includes('type=recovery')
    )
  })

  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')

  const [activeTab, setActiveTab] = useState('home')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false)
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session && inviteLanding) {
        setPasswordOpen(true)
      }
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)

      if (
        newSession &&
        (inviteLanding || event === 'PASSWORD_RECOVERY')
      ) {
        setPasswordOpen(true)
      }
    })

    return () => subscription.unsubscribe()
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
    ] = await Promise.all([
      supabase.rpc('get_inventory_summary'),
      supabase
        .from('locations')
        .select('*')
        .eq('active', true)
        .order('created_at'),
      supabase.rpc('get_stock_by_location'),
      supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150),
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
      supabase
        .from('audit_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80),
    ])

    const firstError =
      inventoryResult.error ||
      locationsResult.error ||
      stockResult.error ||
      movementsResult.error ||
      reservationsResult.error ||
      jobsResult.error ||
      profilesResult.error ||
      auditResult.error

    if (firstError) {
      console.error(firstError)
      setDataError('读取资料失败，请 Refresh 再试。')
    } else {
      const nextProfiles = profilesResult.data || []
      setInventory(inventoryResult.data || [])
      setLocations(locationsResult.data || [])
      setLocationStock(stockResult.data || [])
      setMovements(movementsResult.data || [])
      setReservations(reservationsResult.data || [])
      setJobs(jobsResult.data || [])
      setProfiles(nextProfiles)
      setAuditEvents(auditResult.data || [])
      setProfile(
        nextProfiles.find(
          (item) => item.user_id === session?.user?.id
        ) || null
      )
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
    return inventory.find((item) => item.product_id === id)
  }

  function locationById(id) {
    return locations.find((item) => item.id === id)
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

    const { error } = await supabase.rpc('delete_job_permanently', {
      p_job_id: job.id,
    })

    if (error) {
      console.error(error)
      showToast(error.message || 'Delete failed')
      return
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

    const { data, error } = await supabase.rpc(
      'get_stock_by_location',
      { p_location_id: locationId }
    )

    if (error) {
      console.error(error)
      setStockCountError('读取这个 Stock Holder 的库存失败。')
      setStockCountLoading(false)
      return
    }

    const current = {}
    inventory.forEach((item) => {
      current[item.product_id] = 0
    })

    ;(data || []).forEach((row) => {
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

    await loadAppData()
    await loadHolderStock(selectedLocationId)

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
      return ['home', 'inventory', 'jobs', 'activity', 'more'].includes(
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
        : activeTab === 'reservations'
          ? 'Reservations'
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
              goBack={() => setActiveTab('home')}
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
            <span>Inventory</span>
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

          {isManagement ? (
            <button
              className={activeTab === 'reservations' ? 'active' : ''}
              onClick={() => setActiveTab('reservations')}
            >
              <PackageCheck size={19} />
              <span>Reserve</span>
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

          {isManagement ? (
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

                <button
                  className="sheet-action"
                  onClick={() => openAction('reserve')}
                >
                  <div className="action-icon">
                    <PackageCheck size={20} />
                  </div>
                  <div>
                    <strong>Reserve</strong>
                    <span>Reserve stock for customer</span>
                  </div>
                  <ChevronRight size={18} />
                </button>
              </>
            )}

            {canCompleteJobs && (
              <button
                className="sheet-action"
                onClick={openDirectJob}
              >
                <div className="action-icon dark">
                  <FileText size={20} />
                </div>
                <div>
                  <strong>Complete Job</strong>
                  <span>Customer + lock + lock body + installer</span>
                </div>
                <ChevronRight size={18} />
              </button>
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
              onClick={() => setActiveTab('reservations')}
            >
              Reservations
            </button>
          )}

          {canCompleteJobs && (
            <button className="primary-button" onClick={openDirectJob}>
              <Plus size={16} />
              Complete Job
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
    .slice(0, 6)

  return (
    <div className="page-stack fade-in">
      <section className="hero-card">
        <div>
          <p className="kicker light">LIVE STOCK OVERVIEW</p>
          <h2>Everything in one place.</h2>
          <p>
            Current stock, reserved units and stock holders — built for
            quick checking on phone or desktop.
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

      <section className="metric-grid">
        <MetricCard
          label="Smart Locks"
          value={totals.totalSmartLocks}
          caption="Physical units"
          icon={ShieldCheck}
        />
        <MetricCard
          label="Lock Bodies"
          value={totals.totalLockBodies}
          caption="Physical units"
          icon={Wrench}
        />
        <MetricCard
          label="Reserved"
          value={totals.totalReserved}
          caption="Customer orders"
          icon={PackageCheck}
        />
        <MetricCard
          label="Available"
          value={totals.totalAvailable}
          caption="Ready to sell"
          icon={CheckCircle2}
          dark
        />
      </section>

      <section className="operation-summary-grid">
        <button
          className="operation-summary-card"
          onClick={() => setActiveTab('reservations')}
        >
          <div className="operation-summary-icon">
            <PackageCheck size={20} />
          </div>
          <div>
            <span>Active Reservations</span>
            <strong>
              {
                reservations.filter(
                  (item) => item.status === 'reserved'
                ).length
              }
            </strong>
            <small>Waiting for installation</small>
          </div>
          <ChevronRight size={18} />
        </button>

        <button
          className="operation-summary-card invoice-summary"
          onClick={() => setActiveTab('jobs')}
        >
          <div className="operation-summary-icon">
            <ReceiptText size={20} />
          </div>
          <div>
            <span>Jobs Not Invoiced</span>
            <strong>
              {
                jobs.filter(
                  (item) => item.invoice_status === 'not_invoiced'
                ).length
              }
            </strong>
            <small>Need invoice / billing follow-up</small>
          </div>
          <ChevronRight size={18} />
        </button>
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

        <button type="button">
          <div className="settings-icon">
            <Settings size={19} />
          </div>
          <div>
            <strong>Inventory Settings</strong>
            <span>Minimum stock and app preferences</span>
          </div>
          <span className="coming-badge">NEXT</span>
        </button>

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
        <div>
          <span>Unsaved changes</span>
          <strong>{stockCountChanges}</strong>
        </div>

        <button
          className="primary-button"
          onClick={saveStockCount}
          disabled={
            stockCountSaving ||
            stockCountLoading ||
            stockCountChanges === 0
          }
        >
          {stockCountSaving ? 'Saving...' : 'Save Stock Count'}
        </button>

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
