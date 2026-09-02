import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRightLeft,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  History,
  Home,
  LogOut,
  Menu,
  PackageCheck,
  PackageMinus,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  Warehouse,
  Wrench,
  X,
} from 'lucide-react'
import { supabase } from './lib/supabaseClient'
import './App.css'

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
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
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) loadAppData()
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
    setActiveTab('home')
  }

  async function loadAppData() {
    setDataLoading(true)
    setDataError('')

    const [inventoryResult, locationsResult, stockResult, movementsResult] =
      await Promise.all([
        supabase
          .from('inventory_summary')
          .select('*')
          .order('category')
          .order('name'),
        supabase
          .from('locations')
          .select('*')
          .eq('active', true)
          .order('created_at'),
        supabase
          .from('stock_by_location')
          .select('product_id, location_id, quantity'),
        supabase
          .from('stock_movements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
      ])

    const firstError =
      inventoryResult.error ||
      locationsResult.error ||
      stockResult.error ||
      movementsResult.error

    if (firstError) {
      console.error(firstError)
      setDataError('读取资料失败，请 Refresh 再试。')
    } else {
      setInventory(inventoryResult.data || [])
      setLocations(locationsResult.data || [])
      setLocationStock(stockResult.data || [])
      setMovements(movementsResult.data || [])
    }

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
      return `${from || 'Location'} → ${to || 'Returned'}`
    }

    return movement.movement_type
  }


  function showToast(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  function openAction(mode) {
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
        const { data: reservation, error: reservationError } =
          await supabase
            .from('reservations')
            .insert({
              customer_name: actionForm.customer_name.trim(),
              customer_phone:
                actionForm.customer_phone.trim() || null,
              installation_date:
                actionForm.installation_date || null,
              installation_area:
                actionForm.installation_area.trim() || null,
              installer_location_id:
                actionForm.to_location_id || null,
              status: 'reserved',
              remark:
                [
                  actionForm.reference_no.trim()
                    ? `Ref: ${actionForm.reference_no.trim()}`
                    : '',
                  actionForm.remark.trim(),
                ]
                  .filter(Boolean)
                  .join(' | ') || null,
              created_by: session.user.id,
            })
            .select('id')
            .single()

        if (reservationError) throw reservationError

        const { error: itemError } = await supabase
          .from('reservation_items')
          .insert(
            items.map((item) => ({
              reservation_id: reservation.id,
              product_id: item.product_id,
              quantity: Number(item.quantity),
            }))
          )

        if (itemError) {
          await supabase
            .from('reservations')
            .delete()
            .eq('id', reservation.id)

          throw itemError
        }
      } else {
        const movementRows = items.map((item) => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          movement_type: actionMode,
          from_location_id:
            actionMode === 'transfer' ||
            actionMode === 'stock_out'
              ? actionForm.from_location_id
              : null,
          to_location_id:
            actionMode === 'stock_in' ||
            actionMode === 'transfer'
              ? actionForm.to_location_id
              : null,
          customer_name:
            actionForm.customer_name.trim() || null,
          reference_no: referenceNo,
          remark: actionForm.remark.trim() || null,
          created_by: session.user.id,
        }))

        const { error } = await supabase
          .from('stock_movements')
          .insert(movementRows)

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

  async function openStockCount() {
    setMobileActionsOpen(false)
    setStockCountMessage('')
    setStockCountError('')

    let locationId = selectedLocationId

    if (!locationId) {
      const warehouse =
        locations.find((location) => location.code === 'SVR-JB') ||
        locations[0]

      locationId = warehouse?.id || ''
      setSelectedLocationId(locationId)
    }

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

    const { data, error } = await supabase
      .from('stock_by_location')
      .select('product_id, quantity')
      .eq('location_id', locationId)

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

    const ref = `COUNT-${Date.now()}`

    const rows = changedItems.map(({ item, difference }) => {
      if (difference > 0) {
        return {
          product_id: item.product_id,
          quantity: difference,
          movement_type: 'adjustment_in',
          from_location_id: null,
          to_location_id: selectedLocationId,
          reference_no: ref,
          remark: 'Physical stock count',
          created_by: session.user.id,
        }
      }

      return {
        product_id: item.product_id,
        quantity: Math.abs(difference),
        movement_type: 'adjustment_out',
        from_location_id: selectedLocationId,
        to_location_id: null,
        reference_no: ref,
        remark: 'Physical stock count',
        created_by: session.user.id,
      }
    })

    const { error } = await supabase.from('stock_movements').insert(rows)

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

  const totals = useMemo(() => {
    const totalSmartLocks = smartLocks.reduce(
      (sum, item) => sum + Number(item.physical_stock || 0),
      0
    )

    const totalLockBodies = lockBodies.reduce(
      (sum, item) => sum + Number(item.physical_stock || 0),
      0
    )

    const totalReserved = inventory.reduce(
      (sum, item) => sum + Number(item.reserved_stock || 0),
      0
    )

    const totalAvailable = inventory.reduce(
      (sum, item) => sum + Number(item.available_stock || 0),
      0
    )

    return {
      totalSmartLocks,
      totalLockBodies,
      totalReserved,
      totalAvailable,
    }
  }, [inventory, smartLocks, lockBodies])

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const categoryMatch =
        categoryFilter === 'all' || item.category === categoryFilter

      const query = search.trim().toLowerCase()
      const searchMatch = `${item.name} ${item.app_variant || ''}`
        .toLowerCase()
        .includes(query)

      return categoryMatch && searchMatch
    })
  }, [inventory, categoryFilter, search])

  const holderSummary = useMemo(() => {
    return locations.map((location) => {
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
  }, [locations, locationStock])

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

  const pageTitle =
    activeTab === 'home'
      ? 'Dashboard'
      : activeTab === 'inventory'
        ? 'Inventory'
        : activeTab === 'holders'
          ? 'Stock Holders'
          : activeTab === 'activity'
            ? 'Activity'
            : activeTab === 'more'
              ? 'Account & Settings'
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
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
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
          <button className="count-shortcut" onClick={openStockCount}>
            <ClipboardList size={18} />
            <div>
              <strong>Stock Count</strong>
              <span>Physical adjustment</span>
            </div>
          </button>

          <div className="sidebar-user">
            <div className="avatar">
              {session.user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-copy">
              <strong>SVR User</strong>
              <span>{session.user.email}</span>
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

            <div className="header-user">
              <div className="avatar small">
                {session.user.email?.charAt(0).toUpperCase()}
              </div>
              <span>{session.user.email}</span>
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
              inventory={inventory}
              movements={movements}
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

          {activeTab === 'holders' && (
            <HoldersPage
              holderSummary={holderSummary}
              setSelectedLocationId={setSelectedLocationId}
              openStockCount={openStockCount}
            />
          )}

          {activeTab === 'activity' && (
            <ActivityPage
              movements={movements}
              movementTitle={movementTitle}
              movementSubtitle={movementSubtitle}
              formatDate={formatDate}
            />
          )}

          {activeTab === 'more' && (
            <MorePage
              email={session.user.email}
              onLogout={handleLogout}
              openStockCount={openStockCount}
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
          {NAV_ITEMS.slice(0, 2).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={activeTab === id ? 'active' : ''}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}

          <button
            className="mobile-add"
            onClick={() => setMobileActionsOpen(true)}
          >
            <span>+</span>
          </button>

          {NAV_ITEMS.slice(2, 4).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={activeTab === id ? 'active' : ''}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
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

            <button
              className="sheet-action"
              onClick={() => openAction('stock_out')}
            >
              <div className="action-icon">
                <PackageMinus size={20} />
              </div>
              <div>
                <strong>Stock Out</strong>
                <span>Sold or installed stock</span>
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


function Dashboard({
  totals,
  inventory,
  movements,
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
    await openStockCount()
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
}) {
  return (
    <div className="page-stack fade-in">
      <section className="surface-card page-intro">
        <p className="kicker">AUDIT TRAIL</p>
        <h2>Stock Activity</h2>
        <p>
          Every stock change stays here, so you always know what
          happened.
        </p>
      </section>

      <section className="surface-card activity-page-card">
        <div className="activity-list">
          {movements.map((movement) => (
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
              text="Your first stock movement will appear here."
            />
          )}
        </div>
      </section>
    </div>
  )
}

function ActivityRow({ movement, title, subtitle, date }) {
  const positive =
    movement.movement_type === 'stock_in' ||
    movement.movement_type === 'adjustment_in' ||
    movement.movement_type === 'return'

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

function MorePage({ email, onLogout, openStockCount }) {
  return (
    <div className="page-stack fade-in more-layout">
      <section className="profile-card">
        <div className="profile-avatar">
          {email?.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="kicker">SIGNED IN AS</p>
          <h2>SVR Inventory User</h2>
          <p>{email}</p>
        </div>
      </section>

      <section className="surface-card settings-list">
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

        <button type="button">
          <div className="settings-icon">
            <Users size={19} />
          </div>
          <div>
            <strong>User Access</strong>
            <span>Partner and staff accounts</span>
          </div>
          <span className="coming-badge">NEXT</span>
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
