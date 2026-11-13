 "use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3,
  Bell, Boxes, Check, ChevronDown, CircleDollarSign, ClipboardList,
  Coffee, LayoutDashboard, Loader2, LogOut, Package, Plus, RefreshCw,
  Search, Settings, ShoppingBag, TrendingUp, Users, Utensils, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Tab = "overview" | "orders" | "menu" | "inventory" | "recipes";
type Category = { id: string; name: string };
type Product = {
  id: string; name: string; description: string | null; price: number;
  category_id: string | null; image_url: string | null; is_vegetarian: boolean;
  is_available: boolean; preparation_time_minutes: number;
  categories?: { name: string } | null;
};
type OrderItem = { id: string; product_name: string; quantity: number; line_total: number };
type Order = {
  id: string; order_number: number; status: string; total_amount: number;
  payment_method: string; payment_status: string; placed_at: string;
  pickup_code: string; notes: string | null; order_items: OrderItem[];
};
type InventoryItem = {
  id: string; name: string; unit: string; quantity: number;
  low_stock_threshold: number; updated_at: string;
};
type RecipeRow = {
  id: string; product_id: string; inventory_id: string; quantity_required: number;
  products?: { name: string } | null;
  inventory?: { name: string; unit: string } | null;
};

const money = (n: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(Number(n || 0));

const statusColors: Record<string, string> = {
  placed: "#fff1df", accepted: "#e9f2f8", preparing: "#f1eaff",
  ready: "#e7f5eb", completed: "#e7f5eb", cancelled: "#fff0ef",
};

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adminName, setAdminName] = useState("Admin");
  const [todayDate, setTodayDate] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [recipeProductId, setRecipeProductId] = useState("");
  const [recipeInventoryId, setRecipeInventoryId] = useState("");
  const [recipeQuantity, setRecipeQuantity] = useState("1");
  const [search, setSearch] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: "", description: "", price: "", category_id: "",
    image_url: "", preparation_time_minutes: "10", is_vegetarian: true,
    is_available: true,
  });

  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("role, full_name").eq("id", authData.user.id).single();
      if (profileError) throw profileError;
      if (profile?.role !== "admin" && profile?.role !== "super_admin") {
        router.replace("/dashboard");
        return;
      }
      setAdminName(profile.full_name || authData.user.email || "Admin");

      const [orderRes, productRes, categoryRes, inventoryRes, recipeRes] = await Promise.all([
        supabase.from("orders")
          .select("id, order_number, status, total_amount, payment_method, payment_status, placed_at, pickup_code, notes, order_items(id, product_name, quantity, line_total)")
          .order("placed_at", { ascending: false }).limit(100),
        supabase.from("products")
          .select("id, name, description, price, category_id, image_url, is_vegetarian, is_available, preparation_time_minutes, categories(name)")
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
        supabase.from("inventory").select("id, name, unit, quantity, low_stock_threshold, updated_at").order("name"),
        supabase.from("recipe_ingredients").select("id, product_id, inventory_id, quantity_required, products(name), inventory(name, unit)").order("created_at", { ascending: false }),
      ]);
      if (orderRes.error) throw orderRes.error;
      if (productRes.error) throw productRes.error;
      if (categoryRes.error) throw categoryRes.error;
      if (inventoryRes.error) throw inventoryRes.error;
      if (recipeRes.error) throw recipeRes.error;
      setOrders((orderRes.data || []) as unknown as Order[]);
      setProducts((productRes.data || []) as unknown as Product[]);
      setCategories((categoryRes.data || []) as Category[]);
      setInventory((inventoryRes.data || []) as InventoryItem[]);
      setRecipes((recipeRes.data || []) as unknown as RecipeRow[]);
      if (!recipeProductId && productRes.data?.length) setRecipeProductId(productRes.data[0].id);
      if (!recipeInventoryId && inventoryRes.data?.length) setRecipeInventoryId(inventoryRes.data[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load admin data.");
    } finally {
      setLoading(false);
    }
  }, [router, supabase, recipeProductId, recipeInventoryId]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Read the current date after hydration to avoid Next.js prerender warnings.
  useEffect(() => {
    setTodayDate(new Date().toDateString());
  }, []);

  useEffect(() => {
    const channel = supabase.channel("campusbite-admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => void loadData())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, loadData]);

  const stats = useMemo(() => {
    const valid = orders.filter(o => o.status !== "cancelled");
    const todayOrders = todayDate
      ? valid.filter(o => new Date(o.placed_at).toDateString() === todayDate)
      : [];
    return {
      revenue: valid.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
      todayRevenue: todayOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
      total: orders.length,
      active: orders.filter(o => ["placed", "accepted", "preparing", "ready"].includes(o.status)).length,
      lowStock: inventory.filter(i => Number(i.quantity) <= Number(i.low_stock_threshold)).length,
      available: products.filter(p => p.is_available).length,
    };
  }, [orders, inventory, products, todayDate]);

  const filteredOrders = orders.filter(o =>
    `${o.order_number} ${o.pickup_code} ${o.status}`.toLowerCase().includes(search.toLowerCase())
  );
  const filteredProducts = products.filter(p =>
    `${p.name} ${p.categories?.name || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  async function updateOrder(order: Order, patch: Record<string, string>) {
    setBusy(order.id); setError(""); setNotice("");
    const { error: updateError } = await supabase.from("orders").update(patch).eq("id", order.id);
    if (updateError) setError(updateError.message);
    else { setNotice(`Order #${order.order_number} updated.`); await loadData(); }
    setBusy("");
  }

  function startNewProduct() {
    setEditingProduct(null);
    setProductForm({
      name: "", description: "", price: "", category_id: categories[0]?.id || "",
      image_url: "", preparation_time_minutes: "10", is_vegetarian: true, is_available: true,
    });
    setShowProductForm(true);
  }

  function startEditProduct(product: Product) {
    setEditingProduct(product);
    setProductForm({
      name: product.name, description: product.description || "", price: String(product.price),
      category_id: product.category_id || "", image_url: product.image_url || "",
      preparation_time_minutes: String(product.preparation_time_minutes || 10),
      is_vegetarian: product.is_vegetarian, is_available: product.is_available,
    });
    setShowProductForm(true);
  }

  async function saveProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy("product"); setError(""); setNotice("");
    const payload = {
      name: productForm.name.trim(), description: productForm.description.trim() || null,
      price: Number(productForm.price), category_id: productForm.category_id || null,
      image_url: productForm.image_url.trim() || null,
      preparation_time_minutes: Number(productForm.preparation_time_minutes),
      is_vegetarian: productForm.is_vegetarian, is_available: productForm.is_available,
    };
    if (!payload.name || !Number.isFinite(payload.price) || payload.price <= 0) {
      setError("Enter a product name and a price greater than zero."); setBusy(""); return;
    }
    const result = editingProduct
      ? await supabase.from("products").update(payload).eq("id", editingProduct.id)
      : await supabase.from("products").insert(payload);
    if (result.error) setError(result.error.message);
    else { setNotice(editingProduct ? "Product updated." : "Product added."); setShowProductForm(false); await loadData(); }
    setBusy("");
  }

  async function toggleProduct(product: Product) {
    setBusy(product.id);
    const { error: updateError } = await supabase.from("products")
      .update({ is_available: !product.is_available }).eq("id", product.id);
    if (updateError) setError(updateError.message);
    else await loadData();
    setBusy("");
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;
    setBusy(product.id);
    const { error: deleteError } = await supabase.from("products").delete().eq("id", product.id);
    if (deleteError) setError(deleteError.message);
    else { setNotice(`${product.name} deleted.`); await loadData(); }
    setBusy("");
  }

  async function adjustStock(item: InventoryItem, delta: number) {
    const next = Number(item.quantity) + delta;
    if (next < 0) { setError("Stock quantity cannot be negative."); return; }
    setBusy(item.id); setError(""); setNotice("");
    const { error: updateError } = await supabase.from("inventory")
      .update({ quantity: next }).eq("id", item.id);
    if (updateError) setError(updateError.message);
    else { setNotice(`${item.name} stock updated.`); await loadData(); }
    setBusy("");
  }

  async function saveRecipeIngredient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const quantity = Number(recipeQuantity);
    if (!recipeProductId || !recipeInventoryId || !Number.isFinite(quantity) || quantity <= 0) {
      setError("Choose a product and ingredient, and enter a quantity greater than zero.");
      return;
    }
    setBusy("recipe"); setError(""); setNotice("");
    const { error: saveError } = await supabase.from("recipe_ingredients").upsert(
      { product_id: recipeProductId, inventory_id: recipeInventoryId, quantity_required: quantity },
      { onConflict: "product_id,inventory_id" }
    );
    if (saveError) setError(saveError.message);
    else { setNotice("Recipe ingredient saved."); await loadData(); }
    setBusy("");
  }

  async function deleteRecipeIngredient(row: RecipeRow) {
    if (!window.confirm(`Remove ${row.inventory?.name || "this ingredient"} from ${row.products?.name || "this recipe"}?`)) return;
    setBusy(row.id); setError(""); setNotice("");
    const { error: deleteError } = await supabase.from("recipe_ingredients").delete().eq("id", row.id);
    if (deleteError) setError(deleteError.message);
    else { setNotice("Recipe ingredient removed."); await loadData(); }
    setBusy("");
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "orders", label: "Orders", icon: ClipboardList },
    { id: "menu", label: "Menu", icon: Utensils },
    { id: "inventory", label: "Inventory", icon: Boxes },
    { id: "recipes", label: "Recipes", icon: ClipboardList },
  ];

  return (
    <main className="admin-shell">
      <style jsx global>{`
        *{box-sizing:border-box} body{margin:0;background:#f5f6f2;color:#1e3028;font-family:Arial,Helvetica,sans-serif}
        .admin-shell{min-height:100vh;background:#f5f6f2}.admin-top{height:76px;background:#fff;border-bottom:1px solid #e8ebe5;display:flex;align-items:center;justify-content:space-between;padding:0 4.5%;position:sticky;top:0;z-index:10}
        .admin-brand{display:flex;align-items:center;gap:12px;font-size:23px;font-weight:850;letter-spacing:-1px}.brand-mark{width:42px;height:42px;border-radius:13px;background:#1d503b;color:#fff;display:grid;place-items:center}
        .admin-user{display:flex;align-items:center;gap:14px;color:#607168;font-size:13px}.admin-layout{max-width:1480px;margin:0 auto;padding:28px 4.5%;display:grid;grid-template-columns:220px minmax(0,1fr);gap:26px}
        .admin-side{background:#fff;border:1px solid #e8ebe5;border-radius:20px;padding:16px;height:max-content;position:sticky;top:96px}.side-label{font-size:10px;letter-spacing:1.8px;color:#a1aaa3;font-weight:800;padding:12px}.side-link{width:100%;border:0;background:transparent;color:#64746b;display:flex;align-items:center;gap:12px;padding:13px 12px;border-radius:12px;text-align:left;font-weight:700;cursor:pointer;margin:3px 0}.side-link.active{background:#eaf3ed;color:#1c543d}
        .admin-content{min-width:0}.page-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:4px 0 24px}.eyebrow{color:#d47a3e;font-size:10px;font-weight:900;letter-spacing:2px}.page-heading h1{font-size:30px;letter-spacing:-1px;margin:8px 0 6px}.muted{color:#829087;font-size:13px}
        .btn{border:1px solid #e1e8e1;background:#fff;color:#365346;border-radius:11px;padding:10px 14px;font-weight:750;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px}.btn.primary{background:#1d503b;border-color:#1d503b;color:white}.btn.danger{background:#fff1ef;color:#b64b40;border-color:#ffe0dc}.btn:disabled{opacity:.55;cursor:wait}
        .stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:20px}.stat-card,.panel{background:#fff;border:1px solid #e8ebe5;border-radius:18px;padding:20px}.stat-icon{width:40px;height:40px;border-radius:12px;background:#eaf3ed;color:#1c6948;display:grid;place-items:center}.stat-label{font-size:12px;color:#87938b;margin-top:17px}.stat-value{font-size:27px;font-weight:850;letter-spacing:-1px;margin-top:5px}.stat-foot{font-size:11px;color:#9aa39d;margin-top:7px}
        .content-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(260px,.8fr);gap:16px}.panel-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.panel-title h2{font-size:17px;margin:0}.table-wrap{overflow-x:auto}.data-table{width:100%;border-collapse:collapse;min-width:560px}.data-table th{text-align:left;color:#9aa49d;font-size:10px;letter-spacing:1px;padding:12px 10px;border-bottom:1px solid #edf0eb}.data-table td{padding:14px 10px;border-bottom:1px solid #f0f2ee;font-size:12px}.data-table tr:last-child td{border-bottom:0}
        .pill{display:inline-flex;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:800;text-transform:capitalize}.search-box{display:flex;align-items:center;gap:8px;border:1px solid #e4e9e3;background:#fff;border-radius:11px;padding:0 12px;min-width:220px}.search-box input{border:0;outline:0;padding:11px 0;width:100%;font-size:12px;background:transparent}
        .order-card{border:1px solid #edf0eb;border-radius:14px;padding:15px;margin:10px 0}.order-top{display:flex;justify-content:space-between;gap:12px}.order-items{font-size:12px;color:#697970;line-height:1.8;margin:12px 0}.order-actions{display:flex;gap:8px;flex-wrap:wrap}
        .product-row{display:flex;align-items:center;gap:12px}.product-thumb{width:42px;height:42px;border-radius:10px;background:#f0f4ef;object-fit:cover}.stock-low{color:#b65a37;font-weight:800}.stock-ok{color:#24734c;font-weight:800}
        .bar-list{display:grid;gap:15px}.bar-label{display:flex;justify-content:space-between;font-size:12px;margin-bottom:7px}.bar-track{height:8px;background:#eef2ed;border-radius:99px;overflow:hidden}.bar-fill{height:100%;background:#2b7653;border-radius:99px}
        .alert{padding:12px 14px;border-radius:12px;font-size:12px;margin-bottom:14px}.alert.error{background:#fff0ee;color:#a23e34}.alert.success{background:#eaf5ed;color:#236345}
        .modal-backdrop{position:fixed;inset:0;background:#14241dcc;z-index:30;display:grid;place-items:center;padding:18px}.modal{background:#fff;border-radius:20px;width:min(540px,100%);padding:24px;max-height:90vh;overflow:auto}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.field{display:grid;gap:6px}.field.full{grid-column:1/-1}.field label{font-size:11px;font-weight:800;color:#66766c}.field input,.field select,.field textarea{border:1px solid #dfe6de;border-radius:10px;padding:11px;font:inherit;font-size:13px;outline-color:#1d503b;width:100%}.check-line{display:flex;gap:8px;align-items:center;font-size:12px;color:#52645a}
        @media(max-width:1000px){.stat-grid{grid-template-columns:repeat(2,1fr)}.content-grid{grid-template-columns:1fr}.admin-layout{grid-template-columns:1fr}.admin-side{position:static;display:flex;overflow:auto;gap:5px}.side-label{display:none}.side-link{white-space:nowrap;width:auto}.admin-side nav{display:flex}}
        @media(max-width:600px){.admin-top{padding:0 16px}.admin-user span{display:none}.admin-layout{padding:18px 14px}.stat-grid{grid-template-columns:1fr 1fr;gap:9px}.stat-card,.panel{padding:14px}.stat-value{font-size:22px}.page-heading h1{font-size:25px}.page-heading{align-items:center}.search-box{min-width:0;width:100%}.form-grid{grid-template-columns:1fr}.field.full{grid-column:auto}}
      `}</style>

      <header className="admin-top">
        <div className="admin-brand"><span className="brand-mark"><Utensils size={22}/></span><span>campus<span style={{color:"#e17b3d"}}>bite.</span></span><span className="pill" style={{background:"#eaf3ed",color:"#1d503b"}}>ADMIN</span></div>
        <div className="admin-user"><Activity size={15} color="#2c9a62"/><span>Live operations · {adminName}</span><button className="btn" onClick={() => void loadData()} title="Refresh"><RefreshCw size={15}/></button><button className="btn" onClick={() => void logout()}><LogOut size={15}/> Logout</button></div>
      </header>

      <div className="admin-layout">
        <aside className="admin-side">
          <div className="side-label">WORKSPACE</div>
          <nav>{navItems.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={`side-link ${tab === item.id ? "active" : ""}`} onClick={() => { setTab(item.id); setSearch(""); }}>
              <Icon size={17}/>{item.label}
            </button>;
          })}</nav>
          <div className="side-label" style={{marginTop:16}}>CAMPUSBITE</div>
          <button className="side-link" onClick={() => router.push("/")}><Coffee size={17}/> Student website</button>
          <button className="side-link" onClick={() => router.push("/kitchen")}><Package size={17}/> Kitchen view</button>
        </aside>

        <section className="admin-content">
          <div className="page-heading">
            <div><div className="eyebrow">CANTEEN CONTROL CENTRE</div><h1>{tab === "overview" ? "Good day, " + adminName.split(" ")[0] : tab === "orders" ? "Order management" : tab === "menu" ? "Menu management" : tab === "inventory" ? "Inventory control" : "Recipe management"}</h1><div className="muted">Monitor your canteen, manage operations and keep service moving.</div></div>
            {tab === "menu" && <button className="btn primary" onClick={startNewProduct}><Plus size={16}/> Add product</button>}
          </div>

          {error && <div className="alert error">{error}</div>}
          {notice && <div className="alert success">{notice}</div>}

          {loading ? <div className="panel" style={{padding:50,textAlign:"center"}}><Loader2 className="animate-spin" style={{margin:"0 auto"}}/><p className="muted">Loading live canteen data…</p></div> : <>
            {tab === "overview" && <>
              <div className="stat-grid">
                <div className="stat-card"><div className="stat-icon"><CircleDollarSign size={20}/></div><div className="stat-label">Total sales · loaded orders</div><div className="stat-value">{money(stats.revenue)}</div><div className="stat-foot">Excludes cancelled orders</div></div>
                <div className="stat-card"><div className="stat-icon" style={{background:"#fff1e4",color:"#ce7436"}}><TrendingUp size={20}/></div><div className="stat-label">Today's revenue</div><div className="stat-value">{money(stats.todayRevenue)}</div><div className="stat-foot">Based on today's orders</div></div>
                <div className="stat-card"><div className="stat-icon" style={{background:"#eaf2f8",color:"#477e9c"}}><ClipboardList size={20}/></div><div className="stat-label">Active orders</div><div className="stat-value">{stats.active}</div><div className="stat-foot">{stats.total} recent orders loaded</div></div>
                <div className="stat-card"><div className="stat-icon" style={{background:"#fff1e9",color:"#c45d3e"}}><AlertTriangle size={20}/></div><div className="stat-label">Low-stock items</div><div className="stat-value">{stats.lowStock}</div><div className="stat-foot">At or below reorder threshold</div></div>
              </div>
              <div className="content-grid">
                <div className="panel"><div className="panel-title"><h2>Recent orders</h2><button className="btn" onClick={() => setTab("orders")}>View all <ChevronDown size={14}/></button></div>
                  {orders.slice(0,5).map(o => <div className="order-card" key={o.id}><div className="order-top"><div><strong>Order #{o.order_number}</strong><div className="muted" style={{marginTop:5}}>{new Date(o.placed_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</div></div><div style={{textAlign:"right"}}><strong>{money(Number(o.total_amount))}</strong><div style={{marginTop:7}}><span className="pill" style={{background:statusColors[o.status] || "#eef1ee"}}>{o.status}</span></div></div></div></div>)}
                  {!orders.length && <div className="muted">No orders yet.</div>}
                </div>
                <div className="panel"><div className="panel-title"><h2>Operations snapshot</h2><BarChart3 size={18} color="#27704c"/></div>
                  <div className="bar-list">
                    <div><div className="bar-label"><span>Available menu items</span><b>{stats.available}/{products.length}</b></div><div className="bar-track"><div className="bar-fill" style={{width:`${products.length ? stats.available/products.length*100 : 0}%`}}/></div></div>
                    <div><div className="bar-label"><span>Orders in progress</span><b>{stats.active}</b></div><div className="bar-track"><div className="bar-fill" style={{width:`${Math.min(stats.active/Math.max(orders.length,1)*100,100)}%`}}/></div></div>
                    <div><div className="bar-label"><span>Inventory items healthy</span><b>{inventory.length-stats.lowStock}/{inventory.length}</b></div><div className="bar-track"><div className="bar-fill" style={{width:`${inventory.length ? (inventory.length-stats.lowStock)/inventory.length*100 : 0}%`}}/></div></div>
                  </div>
                  <div style={{marginTop:24,padding:14,borderRadius:13,background:"#f3f7f2"}}><div style={{fontWeight:800,fontSize:12,marginBottom:5}}>Quick actions</div><button className="btn" style={{margin:"5px 5px 0 0"}} onClick={() => setTab("menu")}><Utensils size={14}/> Manage menu</button><button className="btn" style={{marginTop:5}} onClick={() => setTab("inventory")}><Boxes size={14}/> Check stock</button></div>
                </div>
              </div>
            </>}

            {tab === "orders" && <>
              <div className="panel"><div className="panel-title"><h2>All recent orders</h2><div className="search-box"><Search size={15}/><input placeholder="Search order or pickup code" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
                {filteredOrders.map(o => <div className="order-card" key={o.id}>
                  <div className="order-top"><div><strong>Order #{o.order_number}</strong><div className="muted" style={{marginTop:5}}>{new Date(o.placed_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})} · Pickup {o.pickup_code}</div></div><div style={{textAlign:"right"}}><strong>{money(Number(o.total_amount))}</strong><div style={{marginTop:7}}><span className="pill" style={{background:statusColors[o.status] || "#eef1ee"}}>{o.status}</span></div></div></div>
                  <div className="order-items">{(o.order_items || []).map(i=><div key={i.id}>{i.quantity} × {i.product_name} — {money(Number(i.line_total))}</div>)}<div>Payment: {o.payment_method?.toUpperCase()} · {o.payment_status}</div>{o.notes && <div>Note: {o.notes}</div>}</div>
                  <div className="order-actions">
                    {o.status==="placed" && <><button className="btn primary" disabled={busy===o.id} onClick={()=>void updateOrder(o,{status:"accepted"})}><Check size={14}/> Accept</button><button className="btn danger" disabled={busy===o.id} onClick={()=>void updateOrder(o,{status:"cancelled"})}>Reject</button></>}
                    {o.status==="accepted" && <button className="btn primary" disabled={busy===o.id} onClick={()=>void updateOrder(o,{status:"preparing"})}>Start preparing</button>}
                    {o.status==="preparing" && <button className="btn primary" disabled={busy===o.id} onClick={()=>void updateOrder(o,{status:"ready"})}>Mark ready</button>}
                    {o.status==="ready" && <button className="btn primary" disabled={busy===o.id} onClick={()=>void updateOrder(o,{status:"completed"})}>Complete order</button>}
                    {o.payment_status!=="paid" && o.status!=="cancelled" && <button className="btn" disabled={busy===o.id} onClick={()=>void updateOrder(o,{payment_status:"paid"})}>Mark payment paid</button>}
                  </div>
                </div>)}
                {!filteredOrders.length && <div className="muted">No matching orders.</div>}
              </div>
            </>}

            {tab === "menu" && <>
              <div className="panel"><div className="panel-title"><h2>Food catalogue · {products.length} products</h2><div className="search-box"><Search size={15}/><input placeholder="Search products or category" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
                <div className="table-wrap"><table className="data-table"><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>PRICE</th><th>TYPE</th><th>AVAILABILITY</th><th>ACTIONS</th></tr></thead><tbody>
                  {filteredProducts.map(p=><tr key={p.id}><td><div className="product-row">{p.image_url ? <img className="product-thumb" src={p.image_url} alt=""/> : <div className="product-thumb" style={{display:"grid",placeItems:"center"}}><Utensils size={17}/></div>}<div><b>{p.name}</b><div className="muted">{p.preparation_time_minutes} min prep</div></div></div></td><td>{p.categories?.name || "Uncategorised"}</td><td><b>{money(Number(p.price))}</b></td><td>{p.is_vegetarian ? "Veg" : "Non-veg"}</td><td><span className="pill" style={{background:p.is_available?"#e7f5eb":"#fff0ef",color:p.is_available?"#24734c":"#b64b40"}}>{p.is_available?"Available":"Hidden"}</span></td><td><div className="order-actions"><button className="btn" onClick={()=>startEditProduct(p)}>Edit</button><button className="btn" onClick={()=>void toggleProduct(p)} disabled={busy===p.id}>{p.is_available?"Hide":"Show"}</button><button className="btn danger" onClick={()=>void deleteProduct(p)} disabled={busy===p.id}>Delete</button></div></td></tr>)}
                </tbody></table></div>
              </div>
            </>}

            {tab === "inventory" && <>
              <div className="panel"><div className="panel-title"><h2>Stock levels</h2><span className="muted">{inventory.length} tracked ingredients</span></div>
                <div className="table-wrap"><table className="data-table"><thead><tr><th>INGREDIENT</th><th>AVAILABLE</th><th>LOW-STOCK ALERT</th><th>STOCK UPDATE</th></tr></thead><tbody>
                  {inventory.map(item=>{const low=Number(item.quantity)<=Number(item.low_stock_threshold);return <tr key={item.id}><td><b>{item.name}</b><div className="muted">Updated {new Date(item.updated_at).toLocaleDateString("en-IN")}</div></td><td><span className={low?"stock-low":"stock-ok"}>{Number(item.quantity)} {item.unit}</span></td><td>{Number(item.low_stock_threshold)} {item.unit}</td><td><div className="order-actions"><button className="btn" disabled={busy===item.id} onClick={()=>void adjustStock(item,-1)}>−</button><button className="btn" disabled={busy===item.id} onClick={()=>void adjustStock(item,1)}>+ 1</button><button className="btn" disabled={busy===item.id} onClick={()=>void adjustStock(item,10)}>+ 10</button></div></td></tr>})}
                </tbody></table></div>
                {!inventory.length && <div className="muted">No inventory items have been added yet. Add ingredients in Supabase to start tracking stock.</div>}
              </div>
            </>}

            {tab === "recipes" && <>
              <div className="panel" style={{marginBottom:16}}>
                <div className="panel-title"><div><h2>Build a product recipe</h2><div className="muted" style={{marginTop:5}}>Set how much of each tracked ingredient is used for one serving.</div></div></div>
                {!products.length || !inventory.length ? <div className="muted">Add menu products and inventory ingredients before creating recipes.</div> :
                  <form onSubmit={saveRecipeIngredient}>
                    <div className="form-grid">
                      <div className="field"><label>MENU PRODUCT</label><select value={recipeProductId} onChange={e=>setRecipeProductId(e.target.value)} required>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                      <div className="field"><label>INVENTORY INGREDIENT</label><select value={recipeInventoryId} onChange={e=>setRecipeInventoryId(e.target.value)} required>{inventory.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select></div>
                      <div className="field"><label>QUANTITY PER SERVING</label><input type="number" min="0.001" step="0.001" value={recipeQuantity} onChange={e=>setRecipeQuantity(e.target.value)} required /></div>
                      <div className="field" style={{alignContent:"end"}}><button type="submit" className="btn primary" disabled={busy==="recipe"}><Plus size={15}/> Save ingredient</button></div>
                    </div>
                  </form>
                }
              </div>
              <div className="panel">
                <div className="panel-title"><h2>Recipe ingredients · {recipes.length} entries</h2><span className="muted">Quantities are per menu item</span></div>
                <div className="table-wrap"><table className="data-table"><thead><tr><th>MENU PRODUCT</th><th>INGREDIENT</th><th>QUANTITY / SERVING</th><th>ACTION</th></tr></thead><tbody>
                  {recipes.map(row=><tr key={row.id}><td><b>{row.products?.name || "Product"}</b></td><td>{row.inventory?.name || "Ingredient"}</td><td>{Number(row.quantity_required)} {row.inventory?.unit || ""}</td><td><button className="btn danger" disabled={busy===row.id} onClick={()=>void deleteRecipeIngredient(row)}>Remove</button></td></tr>)}
                </tbody></table></div>
                {!recipes.length && <div className="muted">No recipes configured yet. Add the first ingredient above.</div>}
              </div>
            </>}
          </>}
        </section>
      </div>

      {showProductForm && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowProductForm(false);}}><div className="modal">
        <div className="panel-title"><div><div className="eyebrow">{editingProduct?"EDIT CATALOGUE ITEM":"NEW CATALOGUE ITEM"}</div><h2 style={{margin:"6px 0 0"}}>{editingProduct?"Update product":"Add a product"}</h2></div><button className="btn" onClick={()=>setShowProductForm(false)}><X size={16}/></button></div>
        <form onSubmit={saveProduct}><div className="form-grid">
          <div className="field full"><label>PRODUCT NAME</label><input required value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})} placeholder="e.g. Paneer Wrap"/></div>
          <div className="field"><label>PRICE (₹)</label><input required type="number" min="1" step="0.01" value={productForm.price} onChange={e=>setProductForm({...productForm,price:e.target.value})}/></div>
          <div className="field"><label>CATEGORY</label><select value={productForm.category_id} onChange={e=>setProductForm({...productForm,category_id:e.target.value})}><option value="">No category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="field full"><label>DESCRIPTION</label><textarea rows={2} value={productForm.description} onChange={e=>setProductForm({...productForm,description:e.target.value})}/></div>
          <div className="field full"><label>IMAGE URL</label><input value={productForm.image_url} onChange={e=>setProductForm({...productForm,image_url:e.target.value})} placeholder="https://…"/></div>
          <div className="field"><label>PREPARATION TIME (MIN)</label><input type="number" min="1" value={productForm.preparation_time_minutes} onChange={e=>setProductForm({...productForm,preparation_time_minutes:e.target.value})}/></div>
          <div className="field" style={{alignContent:"end"}}><label>FOOD TYPE</label><label className="check-line"><input type="checkbox" checked={productForm.is_vegetarian} onChange={e=>setProductForm({...productForm,is_vegetarian:e.target.checked})}/> Vegetarian</label></div>
          <div className="field full"><label className="check-line"><input type="checkbox" checked={productForm.is_available} onChange={e=>setProductForm({...productForm,is_available:e.target.checked})}/> Available for ordering</label></div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:9,marginTop:22}}><button type="button" className="btn" onClick={()=>setShowProductForm(false)}>Cancel</button><button type="submit" className="btn primary" disabled={busy==="product"}>{busy==="product"?<Loader2 size={15} className="animate-spin"/>:<Check size={15}/>} Save product</button></div></form>
      </div></div>}
    </main>
  );
}
