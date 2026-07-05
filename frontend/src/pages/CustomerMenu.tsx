import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  Check,
  ChevronRight,
  Bell,
  Clock,
  Coffee,
  AlertCircle,
  X,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react';
import { useCart } from '../shared/hooks/useCart';
import { socketService } from '../shared/services/socket';
import ThemeToggle from '../shared/components/ThemeToggle';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  prepTime: number;
  isAvailable: boolean;
  isVeg: boolean;
  isBestseller: boolean;
  isChefSpecial: boolean;
  categoryId: string;
}

interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  items: MenuItem[];
}

interface RestaurantInfo {
  id: string;
  name: string;
  logo: string | null;
  taxRate: number;
}

export default function CustomerMenu() {
  const { tableNumber } = useParams<{ tableNumber: string }>();

  // Global Cart
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal } = useCart();

  // Component States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [tableId, setTableId] = useState<string>('');

  const [activeCategory, setActiveCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegFilter, setVegFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');

  // Customization Modal
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [selectedCustoms, setSelectedCustoms] = useState<Record<string, boolean>>({});
  const [itemNotes, setItemNotes] = useState('');

  // Cart Drawer
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);

  // Active tracking order
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [assistantStatus, setAssistantStatus] = useState<string | null>(null);
  const [isRequestingWaiter, setIsRequestingWaiter] = useState(false);

  // Variant modifiers for Popcorn/Strips
  const [selectedSize, setSelectedSize] = useState('Regular');
  const [selectedFlavor, setSelectedFlavor] = useState('Original');

  // Customization presets based on standard rules
  const customPresets = ['Extra Cheese', 'Extra Cream', 'No Onion', 'Less Spicy', 'Extra Sauce'];

  useEffect(() => {
    const initPage = async () => {
      try {
        setLoading(true);
        setError(null);

        // Read token from URL query string
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (!token) {
          setError('Access denied: Physical QR code scan required. Manually modifying URLs is prohibited.');
          setLoading(false);
          return;
        }

        // 1. Verify Table with Secure signed QR Token
        const tableRes = await fetch('http://localhost:5000/api/public/tables/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: tableNumber, token }),
        });

        if (!tableRes.ok) {
          const errData = await tableRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Invalid or expired table scan');
        }

        const tableData = await tableRes.json();
        sessionStorage.setItem('customerToken', tableData.token);
        setTableId(tableData.table.id);
        setRestaurant(tableData.restaurant);

        // 2. Fetch Menu
        const menuRes = await fetch('http://localhost:5000/api/public/menu');
        if (!menuRes.ok) {
          throw new Error('Failed to fetch restaurant menu');
        }
        const menuData = await menuRes.json();
        setCategories(menuData.categories || []);

        if (menuData.categories && menuData.categories.length > 0) {
          setActiveCategory(menuData.categories[0].id);
        }

        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
        setLoading(false);
      }
    };

    if (tableNumber) {
      initPage();
    }
  }, [tableNumber]);

  // Connect socket if we have an active order to track
  useEffect(() => {
    if (activeOrder) {
      const socket = socketService.connect();
      socketService.joinOrderRoom(activeOrder.id);

      socket.on('order:status_change', (data: { status: string }) => {
        setActiveOrder((prev: any) => (prev ? { ...prev, status: data.status } : null));
      });

      return () => {
        socket.off('order:status_change');
      };
    }
  }, [activeOrder]);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col justify-center items-center gap-4 text-brand-textSecondary">
        <Coffee className="w-12 h-12 text-brand-accent animate-bounce" />
        <p className="text-sm font-medium tracking-wide">Crunching menu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col justify-center items-center gap-4 p-6 text-center">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <h1 className="text-2xl font-bold text-brand-textPrimary">Invalid Table Scan</h1>
        <p className="text-sm text-brand-textSecondary max-w-md">{error}</p>
        <p className="text-xs text-brand-accent">Please scan the physical table QR code again.</p>
      </div>
    );
  }

  // Handle customizations
  const handleOpenCustomize = (item: MenuItem) => {
    setCustomizingItem(item);
    setItemQuantity(1);
    setSelectedCustoms({});
    setItemNotes('');

    const catName = categories.find((c) => c.id === item.categoryId)?.name || '';
    if (catName === 'Crunchos Chicken Popcorn') {
      setSelectedSize('Regular');
      setSelectedFlavor('Original');
    } else if (catName === 'Crunchos Chicken Strips') {
      setSelectedSize('4 Pieces');
      setSelectedFlavor('Original');
    }
  };

  const handleToggleCustom = (opt: string) => {
    setSelectedCustoms((prev) => ({ ...prev, [opt]: !prev[opt] }));
  };

  const handleAddToCart = () => {
    if (!customizingItem) return;

    let finalPrice = customizingItem.price;
    const customs: Record<string, boolean> = { ...selectedCustoms };

    const itemCategoryName = categories.find((c) => c.id === customizingItem.categoryId)?.name || '';

    if (itemCategoryName === 'Crunchos Chicken Popcorn') {
      customs[`Size: ${selectedSize}`] = true;
      customs[`Flavor: ${selectedFlavor}`] = true;
      if (selectedSize === 'Large') {
        finalPrice = 249;
      } else {
        finalPrice = 119;
      }
    } else if (itemCategoryName === 'Crunchos Chicken Strips') {
      customs[`Size: ${selectedSize}`] = true;
      customs[`Flavor: ${selectedFlavor}`] = true;
      if (selectedSize === '6 Pieces') {
        finalPrice = 199;
      } else if (selectedSize === '8 Pieces') {
        finalPrice = 239;
      } else {
        finalPrice = 149;
      }
    } else if (itemCategoryName === 'Dessert') {
      if (selectedCustoms['Extra Ice Cream']) {
        finalPrice += 30;
      }
    }

    addToCart({
      menuItemId: customizingItem.id,
      name: customizingItem.name,
      price: finalPrice,
      image: customizingItem.image,
      isVeg: customizingItem.isVeg,
      quantity: itemQuantity,
      customs,
      notes: itemNotes,
    });

    setCustomizingItem(null);
  };

  // Submit helper call
  const triggerHelper = async (type: string) => {
    setIsRequestingWaiter(false);
    try {
      const customerToken = sessionStorage.getItem('customerToken');
      const res = await fetch('http://localhost:5000/api/public/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({ tableId, type }),
      });
      if (res.ok) {
        setAssistantStatus(`Service alert: "${type}" submitted!`);
        setTimeout(() => setAssistantStatus(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Checkout order
  const handlePlaceOrder = async () => {
    if (cart.length === 0 || !restaurant) return;
    setPlacingOrder(true);

    const orderPayload = {
      tableId,
      restaurantId: restaurant.id,
      notes: orderNotes,
      items: cart.map((c) => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
        price: c.price,
        customs: c.customs ? JSON.stringify(c.customs) : null,
        notes: c.notes,
      })),
    };

    try {
      const customerToken = sessionStorage.getItem('customerToken');
      const res = await fetch('http://localhost:5000/api/public/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify(orderPayload),
      });

      if (!res.ok) {
        throw new Error('Checkout failed');
      }

      const data = await res.json();
      setActiveOrder(data.order);
      clearCart();
      setIsCartOpen(false);
    } catch (err) {
      alert('Failed to place order. Try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  // Render tracking status progress
  if (activeOrder) {
    const statuses = ['PENDING', 'ACCEPTED', 'PREPARING', 'COOKING', 'PACKING', 'READY', 'DELIVERED'];
    const statusLabels = {
      PENDING: 'Order Sent',
      ACCEPTED: 'Accepted',
      PREPARING: 'Preparing',
      COOKING: 'Cooking',
      PACKING: 'Packing',
      READY: 'Ready in Kitchen',
      DELIVERED: 'Served on Table',
      CANCELLED: 'Cancelled',
    };

    const currentIdx = statuses.indexOf(activeOrder.status);

    return (
      <div className="min-h-screen bg-brand-dark text-brand-textPrimary p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-md glass-panel p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-accent to-orange-400" />
          
          <h2 className="text-2xl font-bold tracking-tight mb-2 text-center text-brand-textPrimary">
            CrunchOS Order Live Status
          </h2>
          <p className="text-xs text-brand-textSecondary text-center mb-6">
            Order Ref: <span className="font-mono text-brand-accent">{activeOrder.shortId}</span> • Table {tableNumber}
          </p>

          {activeOrder.status === 'CANCELLED' ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-red-400">Your order has been cancelled.</p>
              <p className="text-xs text-brand-textSecondary mt-2">Please ask a staff member for assistance.</p>
              <button
                onClick={() => setActiveOrder(null)}
                className="mt-6 px-4 py-2 bg-zinc-800 text-brand-textPrimary text-xs font-semibold rounded-lg"
              >
                Back to Menu
              </button>
            </div>
          ) : (
            <div>
              <div className="flex flex-col gap-6">
                {statuses.map((st, idx) => {
                  const isCompleted = idx < currentIdx;
                  const isActive = idx === currentIdx;
                  const isUpcoming = idx > currentIdx;

                  return (
                    <div key={st} className="flex items-center gap-4">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                          isCompleted
                            ? 'bg-brand-accent text-white'
                            : isActive
                            ? 'bg-orange-500 text-white animate-pulse ring-4 ring-orange-950'
                            : 'bg-zinc-800 text-zinc-600 border border-zinc-700'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                      </div>
                      <div className="flex-1">
                        <p
                          className={`text-sm font-semibold ${
                            isActive ? 'text-brand-accent' : isUpcoming ? 'text-zinc-500' : 'text-zinc-300'
                          }`}
                        >
                          {statusLabels[st as keyof typeof statusLabels]}
                        </p>
                        {isActive && (
                          <p className="text-xs text-brand-textSecondary animate-pulse">
                            {st === 'PENDING' && 'Waiting for kitchen approval'}
                            {st === 'ACCEPTED' && 'Confirmed by chef'}
                            {st === 'PREPARING' && 'Sourcing raw ingredients'}
                            {st === 'COOKING' && 'Sizzling on the fire!'}
                            {st === 'PACKING' && 'Plating and cleaning presentation'}
                            {st === 'READY' && 'Kitchen staff heading upstairs!'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeOrder.status === 'DELIVERED' && (
                <div className="mt-8 text-center">
                  <p className="text-xs text-brand-textSecondary">Enjoy your meal!</p>
                  <button
                    onClick={() => setActiveOrder(null)}
                    className="mt-4 w-full py-3 bg-brand-accent hover:bg-brand-accentHover text-brand-dark font-bold rounded-xl transition-all"
                  >
                    Order More Food
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Filter products
  const getFilteredItems = () => {
    let list: MenuItem[] = [];
    const cat = categories.find((c) => c.id === activeCategory);
    if (cat) {
      list = cat.items;
    }

    if (searchQuery) {
      list = list.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (vegFilter === 'VEG') {
      list = list.filter((item) => item.isVeg);
    } else if (vegFilter === 'NON_VEG') {
      list = list.filter((item) => !item.isVeg);
    }

    return list;
  };

  return (
    <div className="min-h-screen bg-brand-dark text-brand-textPrimary pb-24">
      {/* 1. Header Block */}
      <header className="sticky top-0 z-30 glass-panel px-4 py-3 flex items-center justify-between border-b border-zinc-800">
        <div className="flex items-center gap-3">
          {restaurant?.logo && (
            <img
              src={restaurant.logo}
              alt="Logo"
              className="w-10 h-10 object-cover rounded-lg border border-zinc-700"
            />
          )}
          <div>
            <h1 className="text-base font-bold text-brand-textPrimary">{restaurant?.name}</h1>
            <p className="text-xs text-brand-textSecondary">
              Table <span className="font-semibold text-brand-accent">{tableNumber}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Switcher */}
          <ThemeToggle />

          {/* Call waiter trigger */}
          <button
            onClick={() => setIsRequestingWaiter(true)}
            className="w-9 h-9 rounded-lg glass-panel flex items-center justify-center hover:bg-zinc-800 text-zinc-300 relative"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* Cart toggle */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-9 h-9 rounded-lg bg-brand-accent hover:bg-brand-accentHover text-brand-dark flex items-center justify-center relative font-bold"
          >
            <ShoppingCart className="w-4 h-4" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-brand-dark text-brand-accent text-[10px] w-5 h-5 rounded-full border border-brand-accent flex items-center justify-center">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Helper trigger status banners */}
      {assistantStatus && (
        <div className="bg-brand-accent text-brand-dark text-xs font-semibold px-4 py-2 text-center flex items-center justify-center gap-2 animate-pulse">
          <Sparkles className="w-4 h-4 animate-spin" />
          {assistantStatus}
        </div>
      )}

      {/* 2. Banner/Search Row */}
      <div className="p-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search items in this category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-brand-card border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm text-brand-textPrimary placeholder-zinc-500 focus:outline-none focus:border-brand-accent transition-all"
          />
        </div>

        {/* Veg filter sliders */}
        <div className="flex gap-2">
          {['ALL', 'VEG', 'NON_VEG'].map((type) => (
            <button
              key={type}
              onClick={() => setVegFilter(type as any)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                vegFilter === type
                  ? 'bg-brand-accent text-brand-dark border-brand-accent'
                  : 'bg-brand-card border-zinc-800 text-brand-textSecondary hover:bg-zinc-800'
              }`}
            >
              {type === 'ALL' && 'All Menu'}
              {type === 'VEG' && 'Veg Only'}
              {type === 'NON_VEG' && 'Non-Veg Only'}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Category Tabs horizontal scroll */}
      <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar pb-3">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setActiveCategory(cat.id);
              setSearchQuery('');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              activeCategory === cat.id
                ? 'bg-brand-textPrimary text-brand-dark border-brand-textPrimary shadow-sm'
                : 'bg-brand-card text-brand-textSecondary border-zinc-800 hover:bg-zinc-800'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* 4. Products List Grid */}
      <div className="px-4 mt-2 flex flex-col gap-4">
        {getFilteredItems().map((item) => (
          <div
            key={item.id}
            className={`glass-panel p-3 rounded-2xl flex gap-3 relative overflow-hidden transition-all ${
              !item.isAvailable ? 'opacity-60' : 'hover:border-zinc-700'
            }`}
          >
            {item.image && (
              <img
                src={item.image}
                alt={item.name}
                className="w-20 h-20 object-cover rounded-xl border border-zinc-800"
              />
            )}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`w-3.5 h-3.5 border flex items-center justify-center text-[8px] rounded-sm font-bold ${
                      item.isVeg ? 'border-green-600 text-green-600' : 'border-red-600 text-red-600'
                    }`}
                  >
                    ●
                  </span>
                  <h3 className="text-sm font-bold text-brand-textPrimary">{item.name}</h3>
                  {item.isBestseller && (
                    <span className="text-[9px] bg-brand-accent/15 text-brand-accent border border-brand-accent/20 font-bold px-1.5 py-0.5 rounded-md">
                      Bestseller
                    </span>
                  )}
                  {item.isChefSpecial && (
                    <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/25 font-bold px-1.5 py-0.5 rounded-md">
                      Chef Special
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-brand-textSecondary line-clamp-2 mt-0.5">
                  {item.description}
                </p>
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-extrabold text-brand-accent">₹{item.price}</span>
                <span className="text-[10px] text-brand-textSecondary flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  {item.prepTime} min
                </span>
              </div>
            </div>

            {/* Quick add / customize action */}
            <div className="self-end">
              {item.isAvailable ? (
                <button
                  onClick={() => handleOpenCustomize(item)}
                  className="px-3 py-1.5 bg-brand-accent hover:bg-brand-accentHover text-brand-dark font-extrabold text-xs rounded-xl flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              ) : (
                <span className="text-[10px] bg-zinc-800 text-zinc-500 font-semibold px-2 py-1.5 rounded-lg border border-zinc-700">
                  Sold Out
                </span>
              )}
            </div>
          </div>
        ))}

        {getFilteredItems().length === 0 && (
          <div className="text-center py-12 text-zinc-600 flex flex-col items-center gap-2">
            <Coffee className="w-8 h-8 opacity-40" />
            <p className="text-xs">No items found matching your filters</p>
          </div>
        )}
      </div>

      {/* ====================================
          5. CUSTOMIZATION MODAL (MODAL DRAWER)
          ==================================== */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-brand-card rounded-t-2xl sm:rounded-2xl border-t sm:border border-zinc-800 p-6 relative animate-in slide-in-from-bottom duration-300">
            <button
              onClick={() => setCustomizingItem(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-brand-textPrimary pr-8">{customizingItem.name}</h3>
            <p className="text-xs text-brand-textSecondary mt-1">{customizingItem.description}</p>

            {/* Customization toggles */}
            <div className="mt-6 border-t border-zinc-800 pt-4">
              <h4 className="text-xs font-bold tracking-wider text-brand-accent uppercase mb-3">
                Customize Dish
              </h4>
              {(() => {
                const itemCategoryName = categories.find((c) => c.id === customizingItem.categoryId)?.name || '';

                if (itemCategoryName === 'Crunchos Chicken Popcorn' || itemCategoryName === 'Crunchos Chicken Strips') {
                  const sizes = itemCategoryName === 'Crunchos Chicken Popcorn' ? ['Regular', 'Large'] : ['4 Pieces', '6 Pieces', '8 Pieces'];
                  const sizePrices = itemCategoryName === 'Crunchos Chicken Popcorn' ? { Regular: 119, Large: 249 } : { '4 Pieces': 149, '6 Pieces': 199, '8 Pieces': 239 };
                  const flavors = ['Original', 'Peri Peri', 'Jumbo', 'Tandoori', 'Spicy', 'All Spice'];

                  return (
                    <div className="flex flex-col gap-4">
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Select Portion Size</span>
                        <div className="flex gap-2">
                          {sizes.map((sz) => (
                            <button
                              type="button"
                              key={sz}
                              onClick={() => setSelectedSize(sz)}
                              className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold text-center transition-all ${
                                selectedSize === sz
                                  ? 'bg-brand-accent text-brand-dark border-brand-accent'
                                  : 'bg-zinc-900 border-zinc-850 text-brand-textSecondary'
                              }`}
                            >
                              {sz} (₹{sizePrices[sz as keyof typeof sizePrices]})
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Choose Coating Flavor</span>
                        <div className="grid grid-cols-3 gap-2">
                          {flavors.map((fl) => (
                            <button
                              type="button"
                              key={fl}
                              onClick={() => setSelectedFlavor(fl)}
                              className={`py-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                                selectedFlavor === fl
                                  ? 'bg-brand-accent text-brand-dark border-brand-accent'
                                  : 'bg-zinc-900 border-zinc-850 text-brand-textSecondary'
                              }`}
                            >
                              {fl}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (itemCategoryName === 'Dessert') {
                  const hasIceCream = !!selectedCustoms['Extra Ice Cream'];
                  return (
                    <div>
                      <span className="text-[10px] text-zinc-505 uppercase font-bold block mb-2">Add Ons</span>
                      <button
                        type="button"
                        onClick={() => handleToggleCustom('Extra Ice Cream')}
                        className={`w-full py-3 px-4 rounded-xl border text-xs font-bold flex justify-between items-center transition-all ${
                          hasIceCream
                            ? 'bg-brand-accent/15 border-brand-accent text-brand-accent'
                            : 'bg-zinc-900 border-zinc-850 text-brand-textSecondary'
                        }`}
                      >
                        <span>Add Extra Ice Cream</span>
                        <span>+₹30</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 gap-2">
                    {customPresets.map((opt) => {
                      const isSelected = !!selectedCustoms[opt];
                      return (
                        <button
                          type="button"
                          key={opt}
                          onClick={() => handleToggleCustom(opt)}
                          className={`py-2 px-3 rounded-xl border text-xs font-semibold text-left flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-brand-accent/10 border-brand-accent text-brand-accent'
                              : 'bg-zinc-900 border-zinc-850 text-brand-textSecondary hover:bg-zinc-800'
                          }`}
                        >
                          {opt}
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Special notes */}
            <div className="mt-6">
              <label className="text-xs font-bold text-brand-accent uppercase tracking-wider block mb-2">
                Special Requests
              </label>
              <input
                type="text"
                placeholder="E.g., No sauce, less spicy, extra hot..."
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-brand-textPrimary focus:outline-none focus:border-brand-accent placeholder-zinc-650"
              />
            </div>

            {/* Quantity Selector and trigger buttons */}
            <div className="mt-8 border-t border-zinc-800 pt-4 flex items-center justify-between">
              <div className="flex items-center gap-3 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setItemQuantity((q) => Math.max(1, q - 1))}
                  className="text-zinc-400 hover:text-white p-1"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-extrabold text-brand-textPrimary w-4 text-center">
                  {itemQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => setItemQuantity((q) => q + 1)}
                  className="text-zinc-400 hover:text-white p-1"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                className="px-6 py-3 bg-brand-accent hover:bg-brand-accentHover text-brand-dark font-bold text-xs rounded-xl transition-all shadow-md"
              >
                Add To Cart • ₹{(() => {
                  let basePrice = customizingItem.price;
                  const itemCategoryName = categories.find((c) => c.id === customizingItem.categoryId)?.name || '';

                  if (itemCategoryName === 'Crunchos Chicken Popcorn') {
                    basePrice = selectedSize === 'Large' ? 249 : 119;
                  } else if (itemCategoryName === 'Crunchos Chicken Strips') {
                    basePrice = selectedSize === '6 Pieces' ? 199 : selectedSize === '8 Pieces' ? 239 : 149;
                  } else if (itemCategoryName === 'Dessert') {
                    if (selectedCustoms['Extra Ice Cream']) {
                      basePrice += 30;
                    }
                  }
                  return basePrice * itemQuantity;
                })()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================
          6. ASSISTANT / WAITER DRAWER
          ==================================== */}
      {isRequestingWaiter && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="w-full max-w-md bg-brand-card rounded-t-2xl border-t border-zinc-800 p-6 relative">
            <button
              onClick={() => setIsRequestingWaiter(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-brand-textPrimary mb-4">Request Service assistance</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Need Water', val: 'WATER' },
                { label: 'Need Spoon', val: 'SPOON' },
                { label: 'Need Tissue', val: 'TISSUE' },
                { label: 'Clean Table', val: 'CLEANING' },
                { label: 'Need Bill', val: 'BILL' },
                { label: 'Call Staff', val: 'CALL_WAITER' },
              ].map((req) => (
                <button
                  key={req.val}
                  onClick={() => triggerHelper(req.label)}
                  className="py-3 px-4 bg-zinc-900 border border-zinc-800 hover:border-brand-accent hover:bg-zinc-800 text-brand-textSecondary hover:text-brand-textPrimary rounded-xl text-xs font-semibold transition-all text-left"
                >
                  {req.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ====================================
          7. CART DRAWER (SLIDE OVER)
          ==================================== */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-brand-card h-full flex flex-col border-l border-zinc-850 p-6 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-850">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-brand-accent" />
                <h3 className="text-base font-bold text-brand-textPrimary">Your Order Cart</h3>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Cart Items list */}
            <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-3">
              {cart.map((item) => (
                <div key={item.cartId} className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-850 flex justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-brand-textPrimary">{item.name}</h4>
                    {Object.keys(item.customs).length > 0 && (
                      <p className="text-[10px] text-brand-accent mt-0.5">
                        + {Object.keys(item.customs).join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-[10px] text-zinc-500 italic mt-0.5">"{item.notes}"</p>
                    )}
                    <span className="text-[11px] font-extrabold text-zinc-400 mt-2 block">
                      ₹{item.price} each
                    </span>
                  </div>

                  <div className="flex flex-col items-end justify-between">
                    <button
                      onClick={() => removeFromCart(item.cartId)}
                      className="text-[10px] text-zinc-500 hover:text-red-400 font-semibold"
                    >
                      Remove
                    </button>

                    <div className="flex items-center gap-2 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-850 mt-2">
                      <button
                        onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                        className="text-zinc-500 hover:text-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-3 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                        className="text-zinc-500 hover:text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="text-center py-20 text-zinc-600 flex flex-col items-center gap-2">
                  <ShoppingCart className="w-10 h-10 opacity-30" />
                  <p className="text-xs">Your cart is empty.</p>
                </div>
              )}
            </div>

            {/* Calculations block */}
            {cart.length > 0 && (
              <div className="border-t border-zinc-850 pt-4">
                <div className="mb-4">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide block mb-1">
                    Special Chef Instructions
                  </label>
                  <textarea
                    placeholder="Less salt, extra cutleries, serve hot..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={2}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-brand-textPrimary focus:outline-none focus:border-brand-accent placeholder-zinc-650 resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5 text-xs text-brand-textSecondary mb-4">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{getCartTotal()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (5%)</span>
                    <span>₹{Math.round(getCartTotal() * 0.05 * 100) / 100}</span>
                  </div>
                  <div className="flex justify-between text-brand-textPrimary font-extrabold text-sm border-t border-zinc-850 pt-2">
                    <span>Grand Total</span>
                    <span>₹{Math.round((getCartTotal() + getCartTotal() * 0.05) * 100) / 100}</span>
                  </div>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={placingOrder}
                  className="w-full py-3.5 bg-brand-accent hover:bg-brand-accentHover text-brand-dark font-extrabold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {placingOrder ? 'Submitting to Kitchen...' : 'Place Order (Pay Physically)'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
