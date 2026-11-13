 "use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Bell, ChefHat, Check, CheckCircle2, Clock3, CreditCard, Loader2,
  LogOut, PackageCheck, RefreshCw, Search, ShoppingBag, Utensils, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};
type Order = {
  id: string;
  order_number: number;
  status: "placed" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";
  total_amount: number;
  payment_method: string;
  payment_status: string;
  pickup_code: string | null;
  notes: string | null;
  placed_at: string;
  estimated_ready_at: string | null;
  order_items: OrderItem[];
};
type Filter = "active" | "all" | "placed" | "preparing" | "ready" | "completed";

const statusLabels: Record<Order["status"], string> = {
  placed: "New order", accepted: "Accepted", preparing: "Preparing",
  ready: "Ready for pickup", completed: "Completed", cancelled: "Cancelled",
};
const money = (n: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(Number(n || 0));

export default function KitchenDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [staffName, setStaffName] = useState("Kitchen team");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [search, setSearch] = useState("");

  const loadOrders = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      router.replace("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("full_name, role")
      .eq("id", authData.user.id).maybeSingle();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!profile || !["kitchen", "admin", "super_admin"].includes(profile.role)) {
      setError("Access denied. This page is available only to kitchen staff and administrators.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setStaffName(profile.full_name || "Kitchen team");
    const { data, error: orderError } = await supabase
      .from("orders")
      .select("id, order_number, status, total_amount, payment_method, payment_status, pickup_code, notes, placed_at, estimated_ready_at, order_items(id, product_name, quantity, unit_price, line_total)")
      .order("placed_at", { ascending: true }).limit(100);

    if (orderError) setError(orderError.message);
    else {
      setError("");
      setOrders((data ?? []) as Order[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => { void loadOrders(true); }, [loadOrders]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    async function subscribe() {
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;
      channel = supabase.channel("campusbite-kitchen-live-orders")
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" },
          () => { if (active) void loadOrders(true); })
        .on("postgres_changes", { event: "*", schema: "public", table: "order_items" },
          () => { if (active) void loadOrders(true); })
        .subscribe();
    }
    void subscribe();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadOrders]);

  async function updateStatus(order: Order, status: Order["status"]) {
    setUpdatingId(order.id); setError(""); setNotice("");
    const supabase = createClient();
    const { error: updateError } = await supabase.from("orders")
      .update({ status }).eq("id", order.id);
    if (updateError) setError(updateError.message);
    else {
      setNotice(`Order #${order.order_number}: ${statusLabels[status]}.`);
      await loadOrders(true);
    }
    setUpdatingId(null);
  }

  async function markPaid(order: Order) {
    setUpdatingId(order.id); setError(""); setNotice("");
    const supabase = createClient();
    const { error: updateError } = await supabase.from("orders")
      .update({ payment_status: "paid" }).eq("id", order.id);
    if (updateError) setError(updateError.message);
    else {
      setNotice(`Payment for order #${order.order_number} marked as received.`);
      await loadOrders(true);
    }
    setUpdatingId(null);
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesFilter = filter === "all" ||
        (filter === "active" && !["completed", "cancelled"].includes(o.status)) ||
        o.status === filter;
      const matchesSearch = !term || String(o.order_number).includes(term) ||
        (o.pickup_code ?? "").toLowerCase().includes(term) ||
        o.order_items.some((i) => i.product_name.toLowerCase().includes(term));
      return matchesFilter && matchesSearch;
    });
  }, [orders, filter, search]);

  const counts = useMemo(() => ({
    new: orders.filter((o) => o.status === "placed").length,
    preparing: orders.filter((o) => o.status === "preparing").length,
    ready: orders.filter((o) => o.status === "ready").length,
    active: orders.filter((o) => !["completed", "cancelled"].includes(o.status)).length,
  }), [orders]);

  if (loading) return <main className="k-loading"><Loader2 className="spin" size={30}/><h2>Preparing kitchen dashboard…</h2><p>Checking staff access and loading orders.</p><style jsx>{`.k-loading{min-height:100vh;display:grid;place-content:center;justify-items:center;gap:10px;background:#f6f7f2;color:#204b39}p{color:#778078;margin:0}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style></main>;

  if (error.startsWith("Access denied")) return <main className="denied"><div><ChefHat size={34}/><h1>Kitchen access required</h1><p>{error}</p><button onClick={() => router.replace("/")}>Back to CampusBite</button></div><style jsx>{`.denied{min-height:100vh;display:grid;place-items:center;background:#f6f7f2;padding:20px;color:#20392e}.denied>div{max-width:420px;background:#fff;border:1px solid #e7e9e2;border-radius:22px;padding:36px;text-align:center}.denied svg{color:#1e6848}.denied p{color:#737c74;line-height:1.6}button{background:#1e4d3a;color:#fff;border:0;border-radius:10px;padding:13px 18px;font-weight:700;cursor:pointer}`}</style></main>;

  return (
    <main className="k-page">
      <header className="k-header">
        <a className="k-brand" href="/"><span className="brand-mark"><Utensils size={21}/></span><span>campus<span className="accent">bite.</span></span><span className="k-tag">KITCHEN</span></a>
        <div className="header-right"><span className="staff"><i/> {staffName}</span><button className="icon-btn" onClick={() => void loadOrders()} aria-label="Refresh"><RefreshCw size={17} className={refreshing ? "spin" : ""}/></button><button className="logout" onClick={logout}><LogOut size={16}/> Logout</button></div>
      </header>
      <div className="k-content">
        <section className="heading"><div><span className="eyebrow">CAMPUSBITE OPERATIONS</span><h1>Kitchen dashboard</h1><p>Manage incoming orders and keep campus meals moving.</p></div><div className="live"><i/> LIVE ORDER BOARD</div></section>
        <section className="metrics">
          <div className="metric"><span className="metric-icon orange"><Bell size={20}/></span><span>New orders</span><strong>{counts.new}</strong><small>Waiting for acceptance</small></div>
          <div className="metric"><span className="metric-icon green"><ChefHat size={20}/></span><span>Preparing</span><strong>{counts.preparing}</strong><small>Being prepared now</small></div>
          <div className="metric"><span className="metric-icon blue"><PackageCheck size={20}/></span><span>Ready for pickup</span><strong>{counts.ready}</strong><small>Awaiting collection</small></div>
          <div className="metric"><span className="metric-icon dark"><ShoppingBag size={20}/></span><span>Active orders</span><strong>{counts.active}</strong><small>Not yet completed</small></div>
        </section>
        <section className="orders-panel">
          <div className="section-top"><div><span className="eyebrow">ORDER MANAGEMENT</span><h2>Incoming orders</h2></div><label className="search"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, item or pickup code"/></label></div>
          <div className="filters">{([["active","Active"],["placed","New"],["preparing","Preparing"],["ready","Ready"],["completed","Completed"],["all","All orders"]] as [Filter,string][]).map(([key,label]) => <button key={key} className={filter===key?"selected":""} onClick={() => setFilter(key)}>{label}</button>)}</div>
          {error && <div className="alert error">{error}</div>}
          {notice && <div className="alert success"><CheckCircle2 size={16}/>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}
          {visibleOrders.length===0 ? <div className="empty"><span><ShoppingBag size={27}/></span><h3>No orders found</h3><p>New student orders will appear here automatically.</p></div> :
            <div className="order-grid">{visibleOrders.map((o) => <motion.article key={o.id} className="order-card" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}>
              <div className="card-top"><div><span className="order-no">ORDER #{o.order_number}</span><span className={`status status-${o.status}`}>{statusLabels[o.status]}</span></div><strong className="total">{money(o.total_amount)}</strong></div>
              <div className="meta"><span><Clock3 size={14}/>{new Date(o.placed_at).toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"})}</span><span><CreditCard size={14}/>{o.payment_method.toUpperCase()} · {o.payment_status}</span></div>
              <div className="items">{o.order_items?.map((i) => <div className="item" key={i.id}><b>{i.quantity}×</b><span>{i.product_name}</span><strong>{money(i.line_total)}</strong></div>)}</div>
              {o.notes && <div className="note"><b>Student note:</b> {o.notes}</div>}
              <div className="pickup"><span>Pickup code</span><strong>{o.pickup_code || "Not generated"}</strong></div>
              <div className="actions">
                {o.status==="placed" && <><button className="primary" disabled={updatingId===o.id} onClick={() => void updateStatus(o,"accepted")}><Check size={16}/> Accept order</button><button className="danger" disabled={updatingId===o.id} onClick={() => void updateStatus(o,"cancelled")}><X size={16}/> Reject</button></>}
                {o.status==="accepted" && <button className="primary" disabled={updatingId===o.id} onClick={() => void updateStatus(o,"preparing")}><ChefHat size={16}/> Start preparing</button>}
                {o.status==="preparing" && <button className="primary" disabled={updatingId===o.id} onClick={() => void updateStatus(o,"ready")}><PackageCheck size={16}/> Mark ready</button>}
                {o.status==="ready" && <button className="primary" disabled={updatingId===o.id} onClick={() => void updateStatus(o,"completed")}><CheckCircle2 size={16}/> Complete order</button>}
                {o.status==="completed" && o.payment_status!=="paid" && <button className="secondary" disabled={updatingId===o.id} onClick={() => void markPaid(o)}><CreditCard size={16}/> Mark payment received</button>}
                {updatingId===o.id && <span className="updating"><Loader2 size={15} className="spin"/> Updating…</span>}
              </div>
            </motion.article>)}</div>}
        </section>
        <footer className="k-footer">CampusBite · Kitchen operations <span>Good food. Great breaks.</span></footer>
      </div>
      <style jsx global>{`
        *{box-sizing:border-box}body{margin:0;background:#f6f7f2;color:#20392e;font-family:Arial,Helvetica,sans-serif}.k-page{min-height:100vh}
        .k-header{height:76px;padding:0 5.5%;display:flex;align-items:center;justify-content:space-between;background:#fff;border-bottom:1px solid #e8ebe4;position:sticky;top:0;z-index:10}
        .k-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#202820;font-size:24px;font-weight:850;letter-spacing:-1px}.brand-mark{width:40px;height:40px;border-radius:13px;background:#1e4d3a;color:#fff;display:grid;place-items:center}.accent{color:#dc8748}.k-tag{font-size:9px;letter-spacing:1.5px;background:#edf4ee;color:#286044;padding:7px 9px;border-radius:7px;margin-left:5px}
        .header-right{display:flex;align-items:center;gap:14px}.staff{font-size:13px;color:#69766c;display:flex;align-items:center;gap:8px}.staff i,.live i{width:8px;height:8px;border-radius:50%;background:#36a66a;display:inline-block;box-shadow:0 0 0 3px #e5f4e9}
        .icon-btn,.logout{height:39px;border:1px solid #e5e9e2;background:#fff;color:#526057;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 12px;cursor:pointer}.logout{font-size:12px}
        .k-content{max-width:1400px;margin:auto;padding:38px 30px}.heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:25px}.eyebrow{font-size:10px;font-weight:850;letter-spacing:1.8px;color:#d27c3d}.heading h1{font-size:36px;letter-spacing:-1.4px;margin:8px 0 6px}.heading p{margin:0;color:#849087;font-size:14px}
        .live{background:#eaf5ed;color:#286044;border:1px solid #dcecdf;padding:10px 13px;border-radius:30px;font-size:10px;font-weight:800;letter-spacing:1px;display:flex;align-items:center;gap:9px}
        .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:25px}.metric{background:#fff;border:1px solid #e8ebe4;border-radius:17px;padding:19px;display:grid;grid-template-columns:43px 1fr;column-gap:12px;align-items:center}.metric-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;grid-row:span 3}.orange{background:#fff0e1;color:#c4773c}.green{background:#e7f3e9;color:#27724c}.blue{background:#e8f2f7;color:#477e9c}.dark{background:#edf0eb;color:#43584a}.metric>span:nth-child(2){font-size:12px;color:#859087}.metric strong{font-size:26px;margin:3px 0}.metric small{font-size:10px;color:#a0a79f}
        .orders-panel{background:#fff;border:1px solid #e8ebe4;border-radius:20px;padding:25px}.section-top{display:flex;align-items:center;justify-content:space-between;gap:16px}.section-top h2{margin:7px 0 0;font-size:22px}.search{height:41px;max-width:320px;width:100%;border:1px solid #e7ebe4;border-radius:10px;padding:0 12px;display:flex;align-items:center;gap:8px;color:#8b968d}.search input{border:0;outline:0;width:100%;font-size:12px;color:#263d30;background:transparent}
        .filters{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0}.filters button{border:1px solid #e6eae3;background:#fff;color:#647067;padding:9px 14px;border-radius:9px;font-size:11px;font-weight:700;cursor:pointer}.filters button.selected{background:#1e4d3a;color:#fff;border-color:#1e4d3a}
        .order-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.order-card{border:1px solid #e8ebe4;border-radius:16px;padding:18px;min-width:0}.card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.card-top>div{display:flex;flex-direction:column;align-items:flex-start;gap:8px}.order-no{font-size:12px;font-weight:850;letter-spacing:.8px;color:#334b3c}.total{font-size:20px}
        .status{font-size:10px;font-weight:750;padding:5px 9px;border-radius:30px;background:#f0f3ee;color:#657168}.status-placed{background:#fff0df;color:#a95d24}.status-accepted,.status-preparing{background:#eaf2f7;color:#477b98}.status-ready{background:#e5f3e8;color:#276c46}.status-completed{background:#edf2ed;color:#4b6653}.status-cancelled{background:#fcebea;color:#a74339}
        .meta{display:flex;gap:14px;flex-wrap:wrap;color:#8b958c;font-size:10px;margin:14px 0}.meta span{display:flex;align-items:center;gap:5px}.items{border-top:1px solid #eef0eb;border-bottom:1px solid #eef0eb;padding:9px 0}.item{display:grid;grid-template-columns:30px 1fr auto;gap:8px;align-items:center;padding:6px 0;font-size:12px}.item b{font-weight:800;color:#28704a}.item span{color:#536157}.item strong{font-size:11px}
        .note{font-size:11px;line-height:1.5;color:#8a6a4e;background:#fff8ef;padding:9px 11px;border-radius:8px;margin-top:10px}.pickup{display:flex;justify-content:space-between;align-items:center;padding:12px 0;color:#849087;font-size:11px}.pickup strong{font-size:14px;letter-spacing:2px;color:#1e6848}
        .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:5px}.primary,.danger,.secondary{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:9px;padding:11px 13px;font-size:11px;font-weight:750;cursor:pointer}.primary{background:#1e4d3a;color:#fff}.danger{background:#fff0ed;color:#a74339}.secondary{background:#fff0df;color:#9c5c2e}.primary:disabled,.danger:disabled,.secondary:disabled{opacity:.55;cursor:wait}.updating{display:flex;align-items:center;gap:6px;color:#829087;font-size:11px}
        .alert{padding:11px 13px;border-radius:9px;font-size:12px;margin:12px 0;display:flex;align-items:center;gap:8px}.error{background:#fff0ed;color:#a74339}.success{background:#eaf5ed;color:#276744}.success button{margin-left:auto;border:0;background:transparent;color:inherit;cursor:pointer}
        .empty{text-align:center;padding:55px 15px;color:#7f8a81}.empty>span{width:58px;height:58px;border-radius:18px;background:#edf4ee;color:#286044;display:grid;place-items:center;margin:0 auto 13px}.empty h3{color:#2d4536;margin:0 0 6px}.empty p{font-size:12px;margin:0}
        .k-footer{display:flex;justify-content:space-between;color:#99a198;font-size:11px;padding:24px 3px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:900px){.metrics{grid-template-columns:repeat(2,1fr)}.order-grid{grid-template-columns:1fr}}@media(max-width:600px){.k-header{height:66px;padding:0 14px}.k-brand{font-size:19px}.k-tag,.staff{display:none}.k-content{padding:25px 14px}.heading{align-items:flex-start;flex-direction:column}.heading h1{font-size:29px}.metrics{gap:9px}.metric{padding:13px;grid-template-columns:36px 1fr;column-gap:8px}.metric-icon{width:36px;height:36px}.metric strong{font-size:22px}.metric small{font-size:9px}.orders-panel{padding:16px}.section-top{align-items:stretch;flex-direction:column}.search{max-width:none}.order-card{padding:14px}.k-footer{flex-direction:column;gap:7px}}
      `}</style>
    </main>
  );
}
