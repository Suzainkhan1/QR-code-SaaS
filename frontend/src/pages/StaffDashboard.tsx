import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Utensils,
  Receipt,
  Grid,
  BellRing,
  BarChart3,
  Package,
  Wallet,
  Settings,
  History,
  LogOut,
  Coffee,
  CheckCircle,
  AlertTriangle,
  Clock,
  Printer,
  ChevronRight,
  TrendingUp,
  X,
  Plus,
  Trash2,
  DollarSign,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../shared/hooks/useAuth';
import { socketService } from '../shared/services/socket';
import ThemeToggle from '../shared/components/ThemeToggle';
import AnalyticsView from './dashboard/AnalyticsView';
import LogsView from './dashboard/LogsView';

type TabType = 'orders' | 'billing' | 'tables' | 'menu' | 'requests' | 'analytics' | 'inventory' | 'expenses' | 'settings' | 'logs';

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { user, restaurant, token, logout } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!token) {
      navigate('/staff/login');
    }
  }, [token, navigate]);

  const restaurantId = restaurant?.id || '';

  // Active section tab state
  const [activeTab, setActiveTab] = useState<TabType>('orders');

  // Core Data Lists
  const [orders, setOrders] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  // Settings state
  const [settings, setSettings] = useState<any>({
    taxRate: 5.0,
    serviceCharge: 0.0,
    phone: '',
    email: '',
    address: '',
  });

  // Analytics report state
  const [analytics, setAnalytics] = useState<any>({
    summary: {
      todayOrders: 0,
      todayRevenue: 0,
      pendingOrders: 0,
      averageOrderValue: 0,
      grossProfit: 0,
      netProfit: 0,
      profitMargin: 0,
      totalRevenue: 0,
      totalExpenses: 0,
    },
    topSellingItems: [],
    leastSellingItems: [],
    categorySales: [],
    peakHours: [],
    dailyRevenueGraph: [],
    monthlyRevenueGraph: [],
  });

  // UI Modal / Input States
  const [selectedTableForBilling, setSelectedTableForBilling] = useState<any>(null);
  const [tableBillSummary, setTableBillSummary] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [selectedBillForReceipt, setSelectedBillForReceipt] = useState<any>(null);

  // Forms States
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');
  const [newCatName, setNewCatName] = useState('');
  const [newItemData, setNewItemData] = useState({
    name: '',
    description: '',
    price: '',
    prepTime: '15',
    isVeg: true,
    isBestseller: false,
    isChefSpecial: false,
    categoryId: '',
    image: '',
  });
  const [newInventoryData, setNewInventoryData] = useState({
    name: '',
    quantity: '',
    unit: 'kg',
    minStock: '5',
  });
  const [newExpenseData, setNewExpenseData] = useState({
    category: 'Raw Materials',
    amount: '',
    description: '',
  });
  const [newStaffData, setNewStaffData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'WAITER',
  });

  // Web Audio Synth chime helper
  const playAlertChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.type = 'triangle';
      const now = audioCtx.currentTime;
      // Synthesize a pleasant high double notification beep
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.24); // G5

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      console.warn('Synth play failed:', e);
    }
  };

  // Fetch functions with Auth Headers
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  const fetchData = async () => {
    if (!token) return;
    try {
      // Parallel fetches for speed
      const [ordRes, tabRes, catRes, reqRes, invRes, expRes, logRes, setRes, stfRes] = await Promise.all([
        fetch('http://localhost:5000/api/orders', { headers: getHeaders() }),
        fetch('http://localhost:5000/api/tables', { headers: getHeaders() }),
        fetch('http://localhost:5000/api/menu/categories', { headers: getHeaders() }),
        fetch('http://localhost:5000/api/requests', { headers: getHeaders() }),
        fetch('http://localhost:5000/api/inventory', { headers: getHeaders() }),
        fetch('http://localhost:5000/api/expenses', { headers: getHeaders() }),
        fetch('http://localhost:5000/api/logs', { headers: getHeaders() }),
        fetch('http://localhost:5000/api/settings', { headers: getHeaders() }),
        fetch('http://localhost:5000/api/auth/staff', { headers: getHeaders() }),
      ]);

      if (ordRes.ok) {
        const d = await ordRes.json();
        setOrders(d.orders || []);
      }
      if (tabRes.ok) {
        const d = await tabRes.json();
        setTables(d.tables || []);
      }
      if (catRes.ok) {
        const d = await catRes.json();
        setCategories(d.categories || []);
        // Flat map items
        const flatItems = d.categories.flatMap((c: any) => c.items || []);
        setMenuItems(flatItems);
        if (d.categories.length > 0 && !newItemData.categoryId) {
          setNewItemData((prev) => ({ ...prev, categoryId: d.categories[0].id }));
        }
      }
      if (reqRes.ok) {
        const d = await reqRes.json();
        setRequests(d.requests || []);
      }
      if (invRes.ok) {
        const d = await invRes.json();
        setInventory(d.inventory || []);
      }
      if (expRes.ok) {
        const d = await expRes.json();
        setExpenses(d.expenses || []);
      }
      if (logRes.ok) {
        const d = await logRes.json();
        setActivityLogs(d.logs || []);
      }
      if (setRes.ok) {
        const d = await setRes.json();
        setSettings(d.settings || {});
      }
      if (stfRes.ok) {
        const d = await stfRes.json();
        setStaff(d.staff || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAnalytics = async () => {
    if (!token || (user?.role !== 'OWNER' && user?.role !== 'MANAGER')) return;
    try {
      const res = await fetch('http://localhost:5000/api/analytics', { headers: getHeaders() });
      if (res.ok) {
        const d = await res.json();
        setAnalytics(d);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Run initial data fetch
  useEffect(() => {
    if (token) {
      fetchData();
      fetchAnalytics();
    }
  }, [token]);

  // Connect WebSockets and join rooms
  useEffect(() => {
    if (token && restaurantId) {
      const socket = socketService.connect();
      socketService.joinRestaurantStaff(restaurantId);

      // 1. Listen for new orders
      socket.on('order:new', (order: any) => {
        setOrders((prev) => [order, ...prev]);
        playAlertChime();
        // Trigger data re-sync for analytics
        fetchAnalytics();
      });

      // 2. Listen for order updates
      socket.on('order:update', (updatedOrder: any) => {
        setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
        fetchAnalytics();
      });

      // 3. Listen for table updates
      socket.on('table:update', (data: { action: string; table?: any; tableId?: string }) => {
        if (data.action === 'update' && data.table) {
          setTables((prev) => prev.map((t) => (t.id === data.table.id ? { ...t, ...data.table } : t)));
        } else if (data.action === 'create' && data.table) {
          setTables((prev) => [...prev, data.table]);
        } else if (data.action === 'delete' && data.tableId) {
          setTables((prev) => prev.filter((t) => t.id !== data.tableId));
        }
      });

      // 4. Listen for customer requests
      socket.on('request:new', (req: any) => {
        setRequests((prev) => [req, ...prev]);
        playAlertChime();
      });

      socket.on('request:resolve', (data: { id: string }) => {
        setRequests((prev) => prev.filter((r) => r.id !== data.id));
      });

      // 5. Listen for billing actions
      socket.on('billing:update', () => {
        fetchAnalytics();
        fetchData();
      });

      return () => {
        socket.off('order:new');
        socket.off('order:update');
        socket.off('table:update');
        socket.off('request:new');
        socket.off('request:resolve');
        socket.off('billing:update');
      };
    }
  }, [token, restaurantId]);

  // Operational Timers in Live Orders (KDS)
  const OrderTimer = ({ time }: { time: string }) => {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
      const start = new Date(time).getTime();
      const interval = setInterval(() => {
        setSeconds(Math.floor((Date.now() - start) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }, [time]);

    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;
    return (
      <span className="flex items-center gap-1 font-mono text-brand-accent text-xs">
        <Clock className="w-3.5 h-3.5" />
        {mm}:{ss.toString().padStart(2, '0')}
      </span>
    );
  };

  // Section 1: Order State Transitions
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Section 2: Billing & Checkout
  const handleFetchTableBill = async (table: any) => {
    setSelectedTableForBilling(table);
    setDiscountAmount(0);
    try {
      const res = await fetch(`http://localhost:5000/api/billing/summary/${table.id}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const d = await res.json();
        setTableBillSummary(d);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheckoutTable = async () => {
    if (!selectedTableForBilling) return;
    try {
      const res = await fetch(`http://localhost:5000/api/billing/checkout`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          tableId: selectedTableForBilling.id,
          discount: discountAmount,
        }),
      });

      if (res.ok) {
        const d = await res.json();
        // Show Invoice Receipt modal
        setSelectedBillForReceipt(d.bill);
        setSelectedTableForBilling(null);
        setTableBillSummary(null);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSettleBill = async (billId: string, method: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/billing/${billId}/pay`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ paymentMethod: method }),
      });

      if (res.ok) {
        setSelectedBillForReceipt(null);
        fetchData();
        fetchAnalytics();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Section 3: Tables CRUD
  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName) return;
    try {
      const res = await fetch('http://localhost:5000/api/tables', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ number: newTableName, capacity: newTableCapacity }),
      });
      if (res.ok) {
        setNewTableName('');
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!window.confirm('Delete this table QR?')) return;
    try {
      await fetch(`http://localhost:5000/api/tables/${tableId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Section 4: Menu CRUD
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;
    try {
      const res = await fetch('http://localhost:5000/api/menu/categories', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name: newCatName }),
      });
      if (res.ok) {
        setNewCatName('');
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Menu Bulk Import / Export handlers
  const handleExportMenu = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(categories, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href",     dataStr);
    downloadAnchor.setAttribute("download", `crunchos-menu-export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportMenu = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (!Array.isArray(importedData)) {
          alert('Invalid format. File must contain an array of categories.');
          return;
        }
        for (const cat of importedData) {
          const catRes = await fetch('http://localhost:5000/api/menu/categories', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name: cat.name, description: cat.description }),
          });
          if (catRes.ok) {
            const catData = await catRes.json();
            const categoryId = catData.category.id;
            if (cat.items && Array.isArray(cat.items)) {
              for (const item of cat.items) {
                await fetch('http://localhost:5000/api/menu/items', {
                  method: 'POST',
                  headers: getHeaders(),
                  body: JSON.stringify({
                    name: item.name,
                    description: item.description,
                    price: item.price,
                    prepTime: item.prepTime,
                    isVeg: item.isVeg,
                    isBestseller: item.isBestseller || false,
                    isChefSpecial: item.isChefSpecial || false,
                    image: item.image,
                    categoryId,
                  }),
                });
              }
            }
          }
        }
        alert('Menu successfully imported in bulk!');
        fetchData();
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, price, categoryId } = newItemData;
    if (!name || !price || !categoryId) return;

    try {
      const res = await fetch('http://localhost:5000/api/menu/items', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newItemData),
      });
      if (res.ok) {
        setNewItemData({
          name: '',
          description: '',
          price: '',
          prepTime: '15',
          isVeg: true,
          isBestseller: false,
          isChefSpecial: false,
          categoryId: categories[0]?.id || '',
          image: '',
        });
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleItemAvailability = async (item: any) => {
    try {
      await fetch(`http://localhost:5000/api/menu/items/${item.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('Remove this menu item?')) return;
    try {
      await fetch(`http://localhost:5000/api/menu/items/${productId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Section 5: Resolve request
  const handleResolveRequest = async (id: string) => {
    try {
      await fetch(`http://localhost:5000/api/requests/${id}/resolve`, {
        method: 'PUT',
        headers: getHeaders(),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Section 7: Inventory CRUD
  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, quantity, unit, minStock } = newInventoryData;
    if (!name || !quantity) return;

    try {
      const res = await fetch('http://localhost:5000/api/inventory', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newInventoryData),
      });
      if (res.ok) {
        setNewInventoryData({ name: '', quantity: '', unit: 'kg', minStock: '5' });
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteInventory = async (id: string) => {
    if (!window.confirm('Delete inventory record?')) return;
    try {
      await fetch(`http://localhost:5000/api/inventory/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Section 8: Expenses CRUD
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const { category, amount, description } = newExpenseData;
    if (!amount) return;

    try {
      const res = await fetch('http://localhost:5000/api/expenses', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newExpenseData),
      });
      if (res.ok) {
        setNewExpenseData({ category: 'Raw Materials', amount: '', description: '' });
        fetchData();
        fetchAnalytics();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Section 9: Add Staff & Settings
  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:5000/api/settings', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(settings),
      });
      alert('Settings updated successfully.');
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, password, role } = newStaffData;
    if (!name || !email || !password) return;

    try {
      const res = await fetch('http://localhost:5000/api/auth/staff', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newStaffData),
      });
      if (res.ok) {
        setNewStaffData({ name: '', email: '', password: '', role: 'WAITER' });
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add staff member');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!window.confirm('Delete this staff member?')) return;
    try {
      await fetch(`http://localhost:5000/api/auth/staff/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex text-brand-textPrimary select-none overflow-hidden">
      {/* 1. SIDEBAR NAVIGATION */}
      <aside className="w-64 border-r border-zinc-850 bg-zinc-950 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Brand */}
          <div className="p-6 flex items-center gap-3 border-b border-zinc-850">
            <div className="w-8 h-8 rounded-lg bg-brand-accent flex items-center justify-center text-brand-dark font-extrabold">
              C
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-white block">CrunchOS</span>
              <span className="text-[10px] text-brand-accent tracking-widest font-bold block uppercase">
                {restaurant?.name || 'SaaS Admin'}
              </span>
            </div>
          </div>

          {/* Module Navigation links */}
          <nav className="p-4 flex flex-col gap-1">
            {[
              { id: 'orders', label: 'Live Orders', icon: Utensils, badge: orders.filter((o) => ['PENDING', 'ACCEPTED', 'PREPARING', 'COOKING', 'PACKING', 'READY'].includes(o.status)).length },
              { id: 'billing', label: 'Billing POS', icon: Receipt },
              { id: 'tables', label: 'Tables / QR', icon: Grid },
              { id: 'menu', label: 'Menu Editor', icon: Coffee },
              { id: 'requests', label: 'Table Requests', icon: BellRing, badge: requests.length },
              { id: 'analytics', label: 'Analytics', icon: BarChart3, roleRestricted: true },
              { id: 'inventory', label: 'Inventory', icon: Package },
              { id: 'expenses', label: 'Expenses', icon: Wallet },
              { id: 'settings', label: 'Settings', icon: Settings },
              { id: 'logs', label: 'Activity Logs', icon: History },
            ].map((tab) => {
              // Hide tabs for unauthorized personnel
              if (tab.roleRestricted && user?.role !== 'OWNER' && user?.role !== 'MANAGER') {
                return null;
              }

              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                    isActive
                      ? 'bg-brand-accent text-brand-dark'
                      : 'text-brand-textSecondary hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    {tab.label}
                  </div>
                  {tab.badge && tab.badge > 0 ? (
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-brand-dark text-brand-accent' : 'bg-brand-accent/20 text-brand-accent'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card & Log out */}
        <div className="p-4 border-t border-zinc-850 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs">
              {user?.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <span className="text-xs font-bold text-brand-textPrimary block truncate">{user?.name}</span>
              <span className="text-[10px] text-brand-textSecondary block capitalize">{user?.role}</span>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2 bg-zinc-900/60 hover:bg-red-950/20 text-xs font-bold text-zinc-400 hover:text-red-400 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Log out Terminal
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 bg-brand-dark overflow-y-auto">
        {/* Global Toolbar Header */}
        <header className="px-8 py-4 bg-zinc-950/40 border-b border-zinc-850 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tracking-tight text-white capitalize">
              {activeTab.replace('-', ' ')} Control Module
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Switcher */}
            <ThemeToggle />

            {/* Quick requests count banner */}
            {requests.length > 0 && (
              <div className="flex items-center gap-2 bg-brand-accent/10 border border-brand-accent/30 rounded-xl px-3 py-1 text-xs text-brand-accent animate-pulse">
                <BellRing className="w-3.5 h-3.5" />
                {requests.length} Table Calls Alert
              </div>
            )}
            <button
              onClick={() => {
                fetchData();
                fetchAnalytics();
              }}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-brand-textSecondary font-mono">{new Date().toLocaleDateString()}</span>
          </div>
        </header>

        {/* TAB CONTENTS SWITCH */}
        <div className="p-8 flex-1">
          {/* ================================================================
              TAB: LIVE ORDERS (KDS SYSTEM)
              ================================================================ */}
          {activeTab === 'orders' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-brand-textPrimary">Kitchen queue</h2>
                  <p className="text-xs text-brand-textSecondary">Real-time incoming tables order tracker</p>
                </div>
              </div>

              {/* Order Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders
                  .filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED')
                  .map((order) => {
                    const isNew = order.status === 'PENDING';
                    return (
                      <div
                        key={order.id}
                        className={`bg-brand-card border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all relative overflow-hidden ${
                          isNew ? 'border-brand-accent animate-blink-orange bg-brand-accent/5' : 'border-zinc-800'
                        }`}
                      >
                        <div>
                          {/* Order Header */}
                          <div className="flex justify-between items-center mb-3">
                            <div>
                              <span className="text-xs font-bold text-brand-textSecondary block">Table {order.table.number}</span>
                              <span className="font-mono font-extrabold text-sm text-brand-textPrimary">{order.shortId}</span>
                            </div>
                            <OrderTimer time={order.createdAt} />
                          </div>

                          {/* Items List */}
                          <div className="border-t border-zinc-850 pt-3 flex flex-col gap-2">
                            {order.items.map((item: any) => {
                              const customsObj = item.customs ? JSON.parse(item.customs) : {};
                              const hasCustoms = Object.keys(customsObj).length > 0;
                              return (
                                <div key={item.id} className="text-xs">
                                  <div className="flex justify-between text-brand-textPrimary font-semibold">
                                    <span>
                                      {item.quantity}x {item.menuItem.name}
                                    </span>
                                    <span className="text-zinc-500">₹{item.price * item.quantity}</span>
                                  </div>
                                  {hasCustoms && (
                                    <p className="text-[10px] text-brand-accent pl-4 mt-0.5">
                                      + {Object.keys(customsObj).join(', ')}
                                    </p>
                                  )}
                                  {item.notes && (
                                    <p className="text-[10px] text-zinc-500 italic pl-4 mt-0.5">
                                      "{item.notes}"
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {order.notes && (
                            <div className="mt-4 bg-zinc-900/50 p-2 rounded-lg border border-zinc-850">
                              <span className="text-[9px] font-bold text-brand-accent uppercase tracking-wider block">Customer Note</span>
                              <p className="text-[11px] text-zinc-400 italic">"{order.notes}"</p>
                            </div>
                          )}
                        </div>

                        {/* Order Controls */}
                        <div className="border-t border-zinc-850 pt-3 flex gap-2">
                          {order.status === 'PENDING' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'ACCEPTED')}
                              className="flex-1 py-2 bg-brand-accent hover:bg-brand-accentHover text-brand-dark text-xs font-bold rounded-xl"
                            >
                              Accept Order
                            </button>
                          )}
                          {order.status === 'ACCEPTED' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'PREPARING')}
                              className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-brand-textPrimary text-xs font-bold rounded-xl"
                            >
                              Start Preparing
                            </button>
                          )}
                          {['PREPARING', 'COOKING', 'PACKING'].includes(order.status) && (
                            <div className="flex-1 flex flex-col gap-1.5">
                              <span className="text-[10px] text-center font-semibold text-zinc-500 block uppercase">
                                Preparing ({order.status})
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdateOrderStatus(order.id, 'READY')}
                                  className="flex-1 py-2 bg-green-700 hover:bg-green-600 text-white text-xs font-bold rounded-xl"
                                >
                                  Mark Ready
                                </button>
                                {order.status === 'PREPARING' && (
                                  <button
                                    onClick={() => handleUpdateOrderStatus(order.id, 'COOKING')}
                                    className="px-3 bg-zinc-850 text-zinc-300 text-xs font-bold rounded-xl"
                                  >
                                    Cook
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          {order.status === 'READY' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'DELIVERED')}
                              className="flex-1 py-2 bg-brand-textPrimary hover:bg-zinc-200 text-brand-dark text-xs font-bold rounded-xl"
                            >
                              Serve on Table
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'CANCELLED')}
                            className="px-3 bg-zinc-900/60 hover:bg-red-950/20 text-zinc-650 hover:text-red-400 text-xs font-bold rounded-xl border border-zinc-850"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length === 0 && (
                  <div className="col-span-full text-center py-24 text-zinc-600 flex flex-col items-center gap-2">
                    <CheckCircle className="w-12 h-12 text-zinc-700" />
                    <h3 className="font-bold text-sm text-brand-textSecondary mt-2">All Clear!</h3>
                    <p className="text-xs">No active food orders in the kitchen queue currently.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================
              TAB: BILLING & CHECKOUT
              ================================================================ */}
          {activeTab === 'billing' && (
            <div>
              <h2 className="text-xl font-bold text-brand-textPrimary mb-2">Billing terminal (POS)</h2>
              <p className="text-xs text-brand-textSecondary mb-6">Select an occupied table to calculate bills and checkout</p>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Tables Selector List */}
                <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {tables.map((t) => {
                    const isOccupied = t.status === 'OCCUPIED' || t.status === 'BILLING' || t.status === 'PREPARING';
                    return (
                      <button
                        key={t.id}
                        onClick={() => isOccupied && handleFetchTableBill(t)}
                        disabled={!isOccupied}
                        className={`p-4 rounded-xl border flex flex-col justify-between gap-6 transition-all text-left ${
                          isOccupied
                            ? 'bg-zinc-900 border-zinc-750 hover:border-brand-accent cursor-pointer'
                            : 'bg-zinc-950/30 border-zinc-900/60 opacity-40 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex justify-between items-start w-full">
                          <span className="text-xs font-bold text-brand-textSecondary">Table</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${t.status === 'OCCUPIED' ? 'bg-orange-500' : t.status === 'BILLING' ? 'bg-yellow-500 animate-pulse' : 'bg-zinc-700'}`} />
                        </div>
                        <h4 className="text-xl font-extrabold text-brand-textPrimary">{t.number}</h4>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-accent">
                          {t.status}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Checkout Summary card */}
                <div className="glass-panel p-6 rounded-2xl h-fit">
                  <h3 className="text-sm font-bold text-brand-accent uppercase tracking-wider mb-4 border-b border-zinc-850 pb-2">
                    Billing Details
                  </h3>

                  {selectedTableForBilling && tableBillSummary ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between">
                        <span className="text-xs font-bold text-brand-textSecondary">Active Table:</span>
                        <span className="text-xs font-bold text-brand-textPrimary">Table {selectedTableForBilling.number}</span>
                      </div>

                      {/* Items list */}
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border-t border-b border-zinc-850 py-3">
                        {tableBillSummary.items?.map((item: any) => (
                          <div key={item.id} className="flex justify-between text-xs text-brand-textSecondary">
                            <span>
                              {item.quantity}x {item.name}
                            </span>
                            <span>₹{item.price * item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      {/* Calculations inputs */}
                      <div className="flex flex-col gap-2 text-xs">
                        <div className="flex justify-between text-brand-textSecondary">
                          <span>Subtotal:</span>
                          <span>₹{tableBillSummary.subTotal}</span>
                        </div>
                        <div className="flex justify-between text-brand-textSecondary">
                          <span>GST ({tableBillSummary.taxRate}%):</span>
                          <span>₹{tableBillSummary.tax}</span>
                        </div>
                        <div className="flex items-center justify-between text-brand-textSecondary">
                          <span>Discount (₹):</span>
                          <input
                            type="number"
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-16 bg-zinc-900 border border-zinc-800 text-right p-1 text-xs text-brand-textPrimary rounded focus:outline-none"
                          />
                        </div>
                        <div className="flex justify-between font-extrabold text-sm border-t border-zinc-850 pt-2 text-white">
                          <span>Grand Total:</span>
                          <span>₹{Math.max(0, tableBillSummary.subTotal + tableBillSummary.tax - discountAmount)}</span>
                        </div>
                      </div>

                      <button
                        onClick={handleCheckoutTable}
                        className="w-full py-3 bg-brand-accent hover:bg-brand-accentHover text-brand-dark text-xs font-bold rounded-xl mt-4"
                      >
                        Generate Invoice Bill
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 text-center py-12">
                      Click on an occupied table to fetch its active order bill details.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB: TABLES & QR GENERATOR
              ================================================================ */}
          {activeTab === 'tables' && (
            <div>
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
                <div>
                  <h2 className="text-xl font-bold text-brand-textPrimary">Table management</h2>
                  <p className="text-xs text-brand-textSecondary">Print and generate table QR codes linked to client ordering web app</p>
                </div>

                <form onSubmit={handleAddTable} className="flex gap-2 items-center bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-850">
                  <input
                    type="text"
                    placeholder="Table No (e.g. 11)"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-brand-textPrimary rounded-lg focus:outline-none focus:border-brand-accent w-24"
                  />
                  <input
                    type="number"
                    placeholder="Capacity"
                    value={newTableCapacity}
                    onChange={(e) => setNewTableCapacity(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-brand-textPrimary rounded-lg focus:outline-none focus:border-brand-accent w-16"
                  />
                  <button
                    type="submit"
                    className="bg-brand-accent text-brand-dark text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-brand-accentHover"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </form>
              </div>

              {/* Table Grid cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {tables.map((t) => (
                  <div key={t.id} className="bg-brand-card border border-zinc-850 rounded-2xl p-4 flex flex-col justify-between gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-extrabold text-brand-textPrimary">Table {t.number}</h3>
                        <span className="text-[10px] text-brand-textSecondary">Seating capacity: {t.capacity}</span>
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                          t.status === 'AVAILABLE'
                            ? 'bg-green-950/20 border-green-900/50 text-green-400'
                            : 'bg-orange-950/20 border-orange-900/50 text-brand-accent'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>

                    {/* QR Code link display */}
                    <div className="bg-white p-2 rounded-xl w-36 h-36 mx-auto border border-zinc-700 flex items-center justify-center relative group">
                      <img src={t.qrURL} alt={`Table ${t.number} QR`} className="w-full h-full object-contain" />
                    </div>

                    <div className="flex gap-2">
                      <a
                        href={t.qrURL}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-center rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
                      >
                        <Printer className="w-3 h-3" /> Print QR
                      </a>
                      <button
                        onClick={() => handleDeleteTable(t.id)}
                        className="p-1.5 bg-zinc-900/60 hover:bg-red-950/20 text-zinc-500 hover:text-red-400 border border-zinc-850 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================
              TAB: MENU EDITOR (CRUD PRODUCTS & CATEGORIES)
              ================================================================ */}
          {activeTab === 'menu' && (
            <div>
              <h2 className="text-xl font-bold text-brand-textPrimary mb-6">Menu editor and availability panel</h2>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Column 1: Categories Setup */}
                <div className="glass-panel p-6 rounded-2xl h-fit">
                  <h3 className="text-sm font-bold text-brand-accent uppercase tracking-wider mb-4 border-b border-zinc-850 pb-2">
                    Menu Categories
                  </h3>
                  <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                    <input
                      type="text"
                      placeholder="Category name..."
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-brand-textPrimary rounded-lg flex-1 focus:outline-none"
                    />
                    <button type="submit" className="bg-brand-accent text-brand-dark px-3 py-1 rounded-lg text-xs font-bold">
                      Add
                    </button>
                  </form>

                  <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                    {categories.map((c) => (
                      <div key={c.id} className="flex justify-between items-center bg-zinc-900/40 p-2.5 rounded-xl border border-zinc-850 text-xs">
                        <span className="font-bold text-brand-textPrimary">{c.name}</span>
                        <button
                          onClick={async () => {
                            if (window.confirm('Delete category?')) {
                              await fetch(`http://localhost:5000/api/menu/categories/${c.id}`, { method: 'DELETE', headers: getHeaders() });
                              fetchData();
                            }
                          }}
                          className="text-zinc-600 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 2 & 3: Products Editor */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  {/* Add Product form */}
                  <form onSubmit={handleAddProduct} className="bg-brand-card border border-zinc-850 p-6 rounded-2xl flex flex-col gap-4">
                    <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
                      <h3 className="text-sm font-bold text-brand-accent uppercase tracking-wider">
                        Create New Menu Item
                      </h3>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleExportMenu}
                          className="px-2.5 py-1 bg-zinc-900 border border-zinc-850 text-[10px] text-zinc-350 rounded-lg hover:text-white"
                        >
                          Export Menu JSON
                        </button>
                        <label className="px-2.5 py-1 bg-zinc-900 border border-zinc-850 text-[10px] text-zinc-350 rounded-lg hover:text-white cursor-pointer">
                          Import Menu JSON
                          <input type="file" accept=".json" onChange={handleImportMenu} className="hidden" />
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Item Name</label>
                        <input
                          type="text"
                          placeholder="Veggie Supreme Pizza"
                          value={newItemData.name}
                          onChange={(e) => setNewItemData({ ...newItemData, name: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Price (₹)</label>
                        <input
                          type="number"
                          placeholder="250"
                          value={newItemData.price}
                          onChange={(e) => setNewItemData({ ...newItemData, price: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Category</label>
                        <select
                          value={newItemData.categoryId}
                          onChange={(e) => setNewItemData({ ...newItemData, categoryId: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Image URL</label>
                        <input
                          type="text"
                          placeholder="https://images.unsplash.com/..."
                          value={newItemData.image}
                          onChange={(e) => setNewItemData({ ...newItemData, image: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Prep Time (min)</label>
                        <input
                          type="number"
                          value={newItemData.prepTime}
                          onChange={(e) => setNewItemData({ ...newItemData, prepTime: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase block mb-1">Description</label>
                      <input
                        type="text"
                        placeholder="Delicious thin crust base loaded with veggies and mozzarella..."
                        value={newItemData.description}
                        onChange={(e) => setNewItemData({ ...newItemData, description: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-4 items-center">
                      <label className="flex items-center gap-2 text-xs text-brand-textSecondary">
                        <input
                          type="checkbox"
                          checked={newItemData.isVeg}
                          onChange={(e) => setNewItemData({ ...newItemData, isVeg: e.target.checked })}
                          className="accent-brand-accent rounded"
                        />
                        Vegetarian Item
                      </label>

                      <label className="flex items-center gap-2 text-xs text-brand-textSecondary">
                        <input
                          type="checkbox"
                          checked={newItemData.isBestseller}
                          onChange={(e) => setNewItemData({ ...newItemData, isBestseller: e.target.checked })}
                          className="accent-brand-accent rounded"
                        />
                        Mark Bestseller
                      </label>

                      <label className="flex items-center gap-2 text-xs text-brand-textSecondary">
                        <input
                          type="checkbox"
                          checked={newItemData.isChefSpecial}
                          onChange={(e) => setNewItemData({ ...newItemData, isChefSpecial: e.target.checked })}
                          className="accent-brand-accent rounded"
                        />
                        Mark Chef Special
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="py-2.5 bg-brand-accent hover:bg-brand-accentHover text-brand-dark font-bold text-xs rounded-xl self-end px-6 shadow-md"
                    >
                      Save Menu Item
                    </button>
                  </form>

                  {/* Products Grid list */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {menuItems.map((item) => (
                      <div key={item.id} className="bg-brand-card border border-zinc-850 p-4 rounded-xl flex gap-3">
                        {item.image && (
                          <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg border border-zinc-800 shrink-0" />
                        )}
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start">
                              <h4 className="text-xs font-bold text-brand-textPrimary">{item.name}</h4>
                              <span className="text-xs font-extrabold text-brand-accent">₹{item.price}</span>
                            </div>
                            <p className="text-[10px] text-brand-textSecondary line-clamp-1 mt-0.5">{item.description}</p>
                          </div>

                          <div className="flex justify-between items-center mt-3">
                            {/* Stock availability switch */}
                            <button
                              onClick={() => handleToggleItemAvailability(item)}
                              className={`py-1 px-2.5 rounded-lg text-[10px] font-bold border transition-all ${
                                item.isAvailable
                                  ? 'bg-green-950/20 border-green-900/50 text-green-400'
                                  : 'bg-red-950/20 border-red-900/50 text-red-400'
                              }`}
                            >
                              {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                            </button>

                            <button
                              onClick={() => handleDeleteProduct(item.id)}
                              className="text-zinc-650 hover:text-red-400 transition-all p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB: CUSTOMER SERVICE REQUESTS
              ================================================================ */}
          {activeTab === 'requests' && (
            <div>
              <h2 className="text-xl font-bold text-brand-textPrimary mb-2">Customer service requests</h2>
              <p className="text-xs text-brand-textSecondary mb-6">Real-time table bells, waiter help, and cleaning alerts</p>

              <div className="bg-brand-card border border-zinc-850 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-950 border-b border-zinc-850 text-zinc-400 uppercase text-[10px] tracking-wider">
                      <th className="p-4">Table Number</th>
                      <th className="p-4">Requested Item / Service</th>
                      <th className="p-4">Sent Time</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => (
                      <tr key={req.id} className="border-b border-zinc-850/60 hover:bg-zinc-900/40 text-brand-textPrimary">
                        <td className="p-4 font-bold text-brand-accent">Table {req.table.number}</td>
                        <td className="p-4 font-semibold">{req.type}</td>
                        <td className="p-4 font-mono text-brand-textSecondary">
                          {new Date(req.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleResolveRequest(req.id)}
                            className="bg-brand-accent hover:bg-brand-accentHover text-brand-dark px-3 py-1.5 rounded-lg text-[10px] font-bold"
                          >
                            Mark Handled
                          </button>
                        </td>
                      </tr>
                    ))}

                    {requests.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-zinc-650">
                          No active service requests currently.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB: FINANCIAL ANALYTICS
              ================================================================ */}
          {activeTab === 'analytics' && (
            <AnalyticsView analytics={analytics} />
          )}

          {/* ================================================================
              TAB: INVENTORY MANAGEMENT
              ================================================================ */}
          {activeTab === 'inventory' && (
            <div>
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
                <div>
                  <h2 className="text-xl font-bold text-brand-textPrimary">Raw material inventory</h2>
                  <p className="text-xs text-brand-textSecondary">Monitor stock levels and safety triggers</p>
                </div>

                <form onSubmit={handleAddInventory} className="flex gap-2 items-center bg-zinc-950/40 p-2 rounded-xl border border-zinc-850">
                  <input
                    type="text"
                    placeholder="Item name..."
                    value={newInventoryData.name}
                    onChange={(e) => setNewInventoryData({ ...newInventoryData, name: e.target.value })}
                    className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-brand-textPrimary rounded-lg focus:outline-none w-36"
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={newInventoryData.quantity}
                    onChange={(e) => setNewInventoryData({ ...newInventoryData, quantity: e.target.value })}
                    className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-brand-textPrimary rounded-lg focus:outline-none w-16"
                  />
                  <input
                    type="text"
                    placeholder="Unit (e.g. kg)"
                    value={newInventoryData.unit}
                    onChange={(e) => setNewInventoryData({ ...newInventoryData, unit: e.target.value })}
                    className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-brand-textPrimary rounded-lg focus:outline-none w-16"
                  />
                  <input
                    type="number"
                    placeholder="Min"
                    value={newInventoryData.minStock}
                    onChange={(e) => setNewInventoryData({ ...newInventoryData, minStock: e.target.value })}
                    className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-brand-textPrimary rounded-lg focus:outline-none w-16"
                  />
                  <button
                    type="submit"
                    className="bg-brand-accent text-brand-dark text-xs font-bold px-3 py-1.5 rounded-lg flex items-center hover:bg-brand-accentHover"
                  >
                    Add Stock
                  </button>
                </form>
              </div>

              {/* Table Ledger */}
              <div className="bg-brand-card border border-zinc-850 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-950 border-b border-zinc-850 text-zinc-400 uppercase text-[10px]">
                      <th className="p-4">Material Name</th>
                      <th className="p-4">Current Stock</th>
                      <th className="p-4">Status Indicator</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item) => {
                      const isLow = item.quantity <= item.minStock;
                      return (
                        <tr key={item.id} className="border-b border-zinc-850/60 text-brand-textPrimary">
                          <td className="p-4 font-bold">{item.name}</td>
                          <td className="p-4 font-mono">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="p-4">
                            {isLow ? (
                              <span className="flex items-center gap-1 text-red-500 font-semibold">
                                <AlertTriangle className="w-3.5 h-3.5" /> Low Stock Warning (Min: {item.minStock})
                              </span>
                            ) : (
                              <span className="text-green-500 font-semibold">Healthy</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleDeleteInventory(item.id)}
                              className="text-zinc-650 hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB: OPERATIONS EXPENSES
              ================================================================ */}
          {activeTab === 'expenses' && (
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Column 1: Log form */}
                <div className="glass-panel p-6 rounded-2xl h-fit">
                  <h3 className="text-sm font-bold text-brand-accent uppercase tracking-wider mb-4 border-b border-zinc-850 pb-2">
                    Log Daily Expense
                  </h3>
                  <form onSubmit={handleAddExpense} className="flex flex-col gap-4">
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase block mb-1">Expense Category</label>
                      <select
                        value={newExpenseData.category}
                        onChange={(e) => setNewExpenseData({ ...newExpenseData, category: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                      >
                        {['Rent', 'Electricity', 'Gas', 'Salaries', 'Raw Materials', 'Maintenance', 'Others'].map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase block mb-1">Amount (₹)</label>
                      <input
                        type="number"
                        placeholder="5000"
                        value={newExpenseData.amount}
                        onChange={(e) => setNewExpenseData({ ...newExpenseData, amount: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase block mb-1">Notes / Description</label>
                      <input
                        type="text"
                        placeholder="E.g., Serviced water cooler filters"
                        value={newExpenseData.description}
                        onChange={(e) => setNewExpenseData({ ...newExpenseData, description: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-brand-accent hover:bg-brand-accentHover text-brand-dark font-bold text-xs rounded-xl"
                    >
                      Log Expense Record
                    </button>
                  </form>
                </div>

                {/* Column 2 & 3: Ledger view */}
                <div className="lg:col-span-2 bg-brand-card border border-zinc-850 rounded-2xl overflow-hidden h-fit">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-950 border-b border-zinc-850 text-zinc-400 uppercase text-[10px]">
                        <th className="p-4">Category</th>
                        <th className="p-4">Description</th>
                        <th className="p-4 text-right">Settlement Date</th>
                        <th className="p-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((exp) => (
                        <tr key={exp.id} className="border-b border-zinc-850/60 text-brand-textPrimary">
                          <td className="p-4 font-bold">{exp.category}</td>
                          <td className="p-4 text-brand-textSecondary">{exp.description || 'N/A'}</td>
                          <td className="p-4 text-right font-mono text-zinc-500">
                            {new Date(exp.date).toLocaleDateString()}
                          </td>
                          <td className="p-4 text-right font-extrabold text-red-400">₹{exp.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB: RESTAURANT SETTINGS & STAFF accounts
              ================================================================ */}
          {activeTab === 'settings' && (
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Column 1: Config settings */}
                <div className="glass-panel p-6 rounded-2xl h-fit">
                  <h3 className="text-sm font-bold text-brand-accent uppercase tracking-wider mb-4 border-b border-zinc-850 pb-2">
                    Restaurant Settings Configuration
                  </h3>
                  <form onSubmit={handleUpdateSettings} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">GST Tax Rate (%)</label>
                        <input
                          type="number"
                          value={settings.taxRate}
                          onChange={(e) => setSettings({ ...settings, taxRate: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Service Charge (%)</label>
                        <input
                          type="number"
                          value={settings.serviceCharge}
                          onChange={(e) => setSettings({ ...settings, serviceCharge: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase block mb-1">Contact Phone</label>
                      <input
                        type="text"
                        value={settings.phone || ''}
                        onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase block mb-1">Contact Email</label>
                      <input
                        type="email"
                        value={settings.email || ''}
                        onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase block mb-1">Physical Address</label>
                      <input
                        type="text"
                        value={settings.address || ''}
                        onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-brand-accent hover:bg-brand-accentHover text-brand-dark font-bold text-xs rounded-xl"
                    >
                      Save Configuration Details
                    </button>
                  </form>
                </div>

                {/* Column 2: Staff registration */}
                <div className="flex flex-col gap-6">
                  {/* Create staff form */}
                  {user?.role === 'OWNER' || user?.role === 'MANAGER' ? (
                    <form onSubmit={handleAddStaff} className="bg-brand-card border border-zinc-850 p-6 rounded-2xl flex flex-col gap-4">
                      <h3 className="text-sm font-bold text-brand-accent uppercase tracking-wider border-b border-zinc-850 pb-2">
                        Register Employee Credentials
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase block mb-1">Name</label>
                          <input
                            type="text"
                            placeholder="John Doe"
                            value={newStaffData.name}
                            onChange={(e) => setNewStaffData({ ...newStaffData, name: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase block mb-1">Email</label>
                          <input
                            type="email"
                            placeholder="john@restaurant.com"
                            value={newStaffData.email}
                            onChange={(e) => setNewStaffData({ ...newStaffData, email: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase block mb-1">Password</label>
                          <input
                            type="password"
                            placeholder="••••••"
                            value={newStaffData.password}
                            onChange={(e) => setNewStaffData({ ...newStaffData, password: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase block mb-1">Role</label>
                          <select
                            value={newStaffData.role}
                            onChange={(e) => setNewStaffData({ ...newStaffData, role: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 p-2 text-xs text-brand-textPrimary rounded-xl focus:outline-none animate-none"
                          >
                            {['MANAGER', 'CASHIER', 'KITCHEN', 'WAITER'].map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="py-2.5 bg-brand-accent hover:bg-brand-accentHover text-brand-dark font-bold text-xs rounded-xl self-end px-6 shadow-md"
                      >
                        Add Staff Account
                      </button>
                    </form>
                  ) : null}

                  {/* Staff List */}
                  <div className="bg-brand-card border border-zinc-850 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-950 border-b border-zinc-850 text-zinc-400 uppercase text-[10px]">
                          <th className="p-4">Name</th>
                          <th className="p-4">Role</th>
                          <th className="p-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staff.map((st) => (
                          <tr key={st.id} className="border-b border-zinc-850/60 text-brand-textPrimary">
                            <td className="p-4">
                              <span className="font-bold block">{st.name}</span>
                              <span className="text-[10px] text-zinc-500">{st.email}</span>
                            </td>
                            <td className="p-4 capitalize text-brand-accent font-semibold">{st.role}</td>
                            <td className="p-4 text-right">
                              {st.role !== 'OWNER' && user?.role === 'OWNER' ? (
                                <button onClick={() => handleDeleteStaff(st.id)} className="text-zinc-650 hover:text-red-400">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="text-[10px] text-zinc-600">Locked</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB: SYSTEM ACTIVITY LOGS
              ================================================================ */}
          {activeTab === 'logs' && (
            <LogsView activityLogs={activityLogs} />
          )}
        </div>
      </main>

      {/* ================================================================
          MODAL: INVOICE RECEIPT SETTLEMENT
          ================================================================ */}
      {selectedBillForReceipt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="w-full max-w-sm bg-white text-zinc-900 p-6 rounded-2xl shadow-xl flex flex-col justify-between gap-4 font-mono text-xs border border-zinc-200">
            <div>
              {/* Receipt Header */}
              <div className="text-center pb-4 border-b border-dashed border-zinc-300">
                <h3 className="text-sm font-black tracking-tight uppercase">{restaurant?.name || 'CrunchOS RESTAURANT'}</h3>
                <p className="text-[10px] text-zinc-500 mt-1">{settings.address || 'Kolkata, Sector V'}</p>
                <p className="text-[10px] text-zinc-500">Phone: {settings.phone || '+91 98765 43210'}</p>
              </div>

              {/* Receipt Metadata */}
              <div className="flex flex-col gap-1.5 py-3 border-b border-dashed border-zinc-300">
                <div className="flex justify-between">
                  <span>INVOICE NO:</span>
                  <span className="font-extrabold">{selectedBillForReceipt.invoiceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE:</span>
                  <span>{new Date(selectedBillForReceipt.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>TIME:</span>
                  <span>{new Date(selectedBillForReceipt.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Math Summary */}
              <div className="flex flex-col gap-1.5 py-3 border-b border-dashed border-zinc-300 font-semibold">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>₹{selectedBillForReceipt.subTotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST ({settings.taxRate}%):</span>
                  <span>₹{selectedBillForReceipt.tax}</span>
                </div>
                {selectedBillForReceipt.discount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>DISCOUNT:</span>
                    <span>-₹{selectedBillForReceipt.discount}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black border-t border-zinc-300 pt-2">
                  <span>GRAND TOTAL:</span>
                  <span>₹{selectedBillForReceipt.grandTotal}</span>
                </div>
              </div>

              {/* Settle Action / payment methods */}
              <div className="mt-4 text-center">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-3">
                  Settle Physical Payment
                </span>
                <div className="flex gap-2">
                  {['CASH', 'UPI', 'CARD'].map((method) => (
                    <button
                      key={method}
                      onClick={() => handleSettleBill(selectedBillForReceipt.id, method)}
                      className="flex-1 py-2 border border-zinc-400 hover:border-zinc-900 hover:bg-zinc-100 text-zinc-800 rounded-lg text-[10px] font-bold"
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedBillForReceipt(null)}
              className="mt-4 py-2 border border-dashed border-red-300 text-red-500 hover:bg-red-50 hover:border-red-500 rounded-lg font-black"
            >
              CLOSE RECEIPT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
