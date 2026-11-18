
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ShoppingBag,
  Clock3,
  UserRound,
  Heart,
  LogOut,
  Utensils,
  RefreshCw,
  PackageCheck,
  CircleCheck,
  ChefHat,
  MapPin,
  CreditCard,
  CalendarDays,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
};

type Order = {
  id: string;
  order_number: number;
  status: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  pickup_code: string | null;
  placed_at: string;
  estimated_ready_at: string | null;
};

const statusLabels: Record<string, string> = {
  placed: "Order placed",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready for pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusIcons: Record<string, typeof Clock3> = {
  placed: Clock3,
  accepted: CircleCheck,
  preparing: ChefHat,
  ready: PackageCheck,
  completed: CircleCheck,
  cancelled: Clock3,
};

export default function StudentDashboard() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    const supabase = createClient();

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      router.replace("/login");
      return;
    }

    const currentUser = authData.user;
    setUserEmail(currentUser.email ?? "");

    const [profileResult, orderResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, phone, role")
        .eq("id", currentUser.id)
        .maybeSingle(),

      supabase
        .from("orders")
        .select(
          "id, order_number, status, total_amount, payment_method, payment_status, pickup_code, placed_at, estimated_ready_at"
        )
        .eq("user_id", currentUser.id)
        .order("placed_at", { ascending: false })
        .limit(20),
    ]);

    if (profileResult.error) {
      setError(profileResult.error.message);
    } else {
      setProfile(profileResult.data as Profile | null);
    }

    if (orderResult.error) {
      setError(orderResult.error.message);
    } else {
      setOrders((orderResult.data ?? []) as Order[]);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Realtime updates for this student's orders
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    async function subscribeToOrders() {
      const { data } = await supabase.auth.getUser();

      if (!active || !data.user) return;

      channel = supabase
        .channel(`student-orders-${data.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `user_id=eq.${data.user.id}`,
          },
          () => {
            loadDashboard();
          }
        )
        .subscribe();
    }

    subscribeToOrders();

    return () => {
      active = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadDashboard]);

  async function handleLogout() {
    setLoggingOut(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
      setLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  const firstName =
    profile?.full_name?.trim().split(" ")[0] ||
    userEmail.split("@")[0] ||
    "Student";

  const totalSpent = orders
    .filter((order) => order.status !== "cancelled")
    .reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0
    );

  const activeOrders = orders.filter(
    (order) =>
      !["completed", "cancelled"].includes(order.status)
  );

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="loading-logo">
          <Utensils size={25} />
        </div>
        <h2>Preparing your dashboard...</h2>
        <p>Getting your CampusBite account ready.</p>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #f8f7f2;
            color: #20392e;
          }
          .loading-logo {
            width: 58px;
            height: 58px;
            border-radius: 18px;
            background: #1e4d3a;
            color: white;
            display: grid;
            place-items: center;
            margin-bottom: 18px;
          }
          p { color: #85877f; }
        `}</style>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <a href="/" className="brand">
          <span className="brand-icon">
            <Utensils size={21} />
          </span>
          <span>
            campus<span className="accent">bite.</span>
          </span>
        </a>

        <div className="top-actions">
          <a href="/" className="back-link">
            <ArrowLeft size={16} /> Back to menu
          </a>
          <button
            className="logout-button"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut size={16} />
            {loggingOut ? "Signing out..." : "Logout"}
          </button>
        </div>
      </header>

      <div className="dashboard-container">
        <motion.section
          className="welcome-banner"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <span className="eyebrow">STUDENT DASHBOARD</span>
            <h1>
              Hey, {firstName}! <span>👋</span>
            </h1>
            <p>
              Welcome back. Your next favourite campus meal is
              just a few clicks away.
            </p>
            <a href="/#menu" className="menu-button">
              Explore menu <ArrowRight size={17} />
            </a>
          </div>

          <div className="welcome-art">
            <div className="art-circle">
              <Utensils size={76} />
            </div>
            <span>Good food, great breaks!</span>
          </div>
        </motion.section>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon green">
              <ShoppingBag size={21} />
            </div>
            <span>Total orders</span>
            <strong>{orders.length}</strong>
            <small>All your orders</small>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">
              <CreditCard size={21} />
            </div>
            <span>Total spending</span>
            <strong>₹{totalSpent.toFixed(0)}</strong>
            <small>Excluding cancelled orders</small>
          </div>

          <div className="stat-card">
            <div className="stat-icon blue">
              <Clock3 size={21} />
            </div>
            <span>Active orders</span>
            <strong>{activeOrders.length}</strong>
            <small>Currently in progress</small>
          </div>
        </section>

        <div className="content-grid">
          <section className="orders-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">YOUR ACTIVITY</span>
                <h2>Recent orders</h2>
              </div>

              <button
                className="refresh-button"
                onClick={loadDashboard}
              >
                <RefreshCw size={15} /> Refresh
              </button>
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {orders.length === 0 ? (
              <div className="empty-orders">
                <div className="empty-icon">
                  <ShoppingBag size={32} />
                </div>
                <h3>No orders yet</h3>
                <p>
                  Your order history will appear here after your
                  first CampusBite purchase.
                </p>
                <a href="/#menu" className="menu-button">
                  Order your first meal <ArrowRight size={16} />
                </a>
              </div>
            ) : (
              <div className="order-list">
                {orders.map((order, index) => {
                  const Icon =
                    statusIcons[order.status] ?? Clock3;

                  return (
                    <motion.article
                      key={order.id}
                      className="order-card"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                    >
                      <div className="order-icon">
                        <Icon size={21} />
                      </div>

                      <div className="order-details">
                        <strong>
                          Order #{order.order_number}
                        </strong>
                        <span>
                          <CalendarDays size={13} />
                          {new Date(
                            order.placed_at
                          ).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                        <span className="payment-info">
                          {order.payment_method} ·{" "}
                          {order.payment_status}
                        </span>
                      </div>

                      <div className="order-right">
                        <strong>
                          ₹{Number(order.total_amount).toFixed(0)}
                        </strong>
                        <span
                          className={`status status-${order.status}`}
                        >
                          {statusLabels[order.status] ??
                            order.status}
                        </span>
                        {order.pickup_code &&
                          order.status === "ready" && (
                            <small>
                              Pickup: {order.pickup_code}
                            </small>
                          )}
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="side-column">
            <section className="profile-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">YOUR ACCOUNT</span>
                  <h2>Profile</h2>
                </div>
                <UserRound size={21} />
              </div>

              <div className="profile-avatar">
                {firstName.charAt(0).toUpperCase()}
              </div>

              <h3>{profile?.full_name || firstName}</h3>
              <p className="profile-email">{userEmail}</p>

              <div className="profile-detail">
                <span>Account role</span>
                <strong>{profile?.role || "student"}</strong>
              </div>

              <div className="profile-detail">
                <span>Phone</span>
                <strong>{profile?.phone || "Not added"}</strong>
              </div>

              <div className="profile-note">
                <CircleCheck size={16} />
                Signed in securely
              </div>
            </section>

            <section className="quick-panel">
              <span className="eyebrow">QUICK ACCESS</span>
              <h2>Made for your breaks</h2>

              <a href="/#menu">
                <span className="quick-icon">
                  <Utensils size={18} />
                </span>
                Explore food menu
                <ArrowRight size={16} />
              </a>

              <a href="/">
                <span className="quick-icon">
                  <Heart size={18} />
                </span>
                Browse favourites
                <ArrowRight size={16} />
              </a>

              <a href="/#about">
                <span className="quick-icon">
                  <MapPin size={18} />
                </span>
                About CampusBite
                <ArrowRight size={16} />
              </a>
            </section>
          </aside>
        </div>

        <footer className="dashboard-footer">
          <a href="/" className="footer-brand">
            campus<span className="accent">bite.</span>
          </a>
          <span>Good food. Great breaks. Made for campus life.</span>
        </footer>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; }

        body {
          margin: 0;
          background: #f8f7f2;
          color: #20392e;
          font-family: Arial, Helvetica, sans-serif;
        }

        .dashboard { min-height: 100vh; }

        .topbar {
          height: 78px;
          padding: 0 6%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fff;
          border-bottom: 1px solid #e9e9e2;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
          color: #202820;
          font-size: 25px;
          font-weight: 850;
          text-decoration: none;
          letter-spacing: -1px;
        }

        .brand-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          color: white;
          background: #1e4d3a;
          border-radius: 14px;
        }

        .accent { color: #dc8748; }

        .top-actions {
          display: flex;
          align-items: center;
          gap: 22px;
        }

        .back-link, .logout-button {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #526057;
          text-decoration: none;
          font-size: 14px;
        }

        .logout-button {
          padding: 11px 15px;
          border: 1px solid #e4e8e2;
          border-radius: 12px;
          background: white;
          cursor: pointer;
        }

        .dashboard-container {
          max-width: 1250px;
          padding: 42px 28px;
          margin: auto;
        }

        .welcome-banner {
          background: #1e4d3a;
          color: white;
          border-radius: 25px;
          padding: 42px 48px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          overflow: hidden;
          min-height: 260px;
        }

        .eyebrow {
          display: block;
          color: #d18a51;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.7px;
          margin-bottom: 12px;
        }

        .welcome-banner h1 {
          font-size: clamp(32px, 4vw, 48px);
          letter-spacing: -1.8px;
          margin: 0 0 10px;
        }

        .welcome-banner p {
          color: #d7e2da;
          line-height: 1.7;
          max-width: 510px;
        }

        .menu-button {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          margin-top: 14px;
          padding: 14px 19px;
          background: #fff;
          color: #1e4d3a;
          border-radius: 11px;
          text-decoration: none;
          font-weight: 750;
          font-size: 14px;
        }

        .welcome-art {
          text-align: center;
          color: #d9e7dd;
          font-size: 12px;
          font-weight: 700;
        }

        .art-circle {
          width: 155px;
          height: 155px;
          display: grid;
          place-items: center;
          margin: 0 auto 12px;
          border-radius: 50%;
          color: #1e4d3a;
          background: #f0e7d8;
          transform: rotate(-10deg);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          margin: 25px 0;
        }

        .stat-card, .profile-panel, .quick-panel,
        .orders-panel {
          background: white;
          border: 1px solid #eaeae3;
          border-radius: 19px;
        }

        .stat-card { padding: 23px; }

        .stat-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          margin-bottom: 17px;
        }

        .green { color: #1e6848; background: #e6f1e9; }
        .orange { color: #bf7137; background: #fff0df; }
        .blue { color: #477c9a; background: #e8f2f7; }

        .stat-card > span {
          display: block;
          color: #7d857e;
          font-size: 13px;
        }

        .stat-card > strong {
          display: block;
          font-size: 29px;
          margin: 7px 0;
          color: #20392e;
        }

        .stat-card small { color: #9a9e98; }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.7fr) minmax(270px, 0.9fr);
          gap: 20px;
          align-items: start;
        }

        .orders-panel, .profile-panel, .quick-panel {
          padding: 25px;
        }

        .panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 20px;
        }

        .panel-heading h2, .quick-panel h2 {
          margin: 0;
          font-size: 21px;
          letter-spacing: -0.5px;
        }

        .panel-heading .eyebrow { margin-bottom: 7px; }

        .refresh-button {
          display: flex;
          align-items: center;
          gap: 7px;
          border: 1px solid #e7e9e3;
          background: #fff;
          border-radius: 9px;
          padding: 9px 11px;
          color: #506056;
          cursor: pointer;
        }

        .empty-orders {
          text-align: center;
          padding: 40px 15px;
        }

        .empty-icon {
          width: 66px;
          height: 66px;
          display: grid;
          place-items: center;
          margin: 0 auto 15px;
          border-radius: 20px;
          background: #edf3ed;
          color: #1e6848;
        }

        .empty-orders h3 { margin: 0 0 8px; }

        .empty-orders p {
          color: #858b84;
          line-height: 1.6;
          font-size: 14px;
          max-width: 330px;
          margin: 0 auto;
        }

        .empty-orders .menu-button {
          background: #1e4d3a;
          color: white;
        }

        .order-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .order-card {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 15px;
          border: 1px solid #eeeee9;
          border-radius: 14px;
        }

        .order-icon {
          width: 43px;
          height: 43px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: #eaf2eb;
          color: #1e6848;
        }

        .order-details {
          min-width: 0;
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 6px;
        }

        .order-details strong { font-size: 14px; }

        .order-details span {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #858b84;
          font-size: 11px;
        }

        .order-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 7px;
          text-align: right;
        }

        .order-right > strong { font-size: 15px; }

        .order-right small {
          color: #1e6848;
          font-size: 11px;
        }

        .status {
          border-radius: 30px;
          padding: 5px 9px;
          background: #edf3ed;
          color: #276744;
          font-size: 10px;
          font-weight: 750;
          white-space: nowrap;
        }

        .status-cancelled {
          background: #fcebea;
          color: #a74339;
        }

        .status-completed {
          background: #e8f4e9;
          color: #276744;
        }

        .side-column {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .profile-panel { text-align: center; }

        .profile-panel .panel-heading { text-align: left; }

        .profile-avatar {
          width: 70px;
          height: 70px;
          display: grid;
          place-items: center;
          margin: 10px auto 12px;
          background: #1e4d3a;
          color: white;
          font-size: 27px;
          font-weight: 800;
          border-radius: 50%;
        }

        .profile-panel h3 { margin: 0 0 5px; }

        .profile-email {
          color: #8b918b;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .profile-detail {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 13px 0;
          border-top: 1px solid #eeeeea;
          font-size: 12px;
          text-align: left;
        }

        .profile-detail span { color: #8b918b; }
        .profile-detail strong { text-transform: capitalize; }

        .profile-note {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 11px;
          background: #edf5ee;
          color: #276744;
          border-radius: 10px;
          font-size: 12px;
          margin-top: 10px;
        }

        .quick-panel h2 { margin-bottom: 16px; }

        .quick-panel a {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 0;
          border-top: 1px solid #eeeeea;
          color: #435349;
          text-decoration: none;
          font-size: 12px;
          font-weight: 650;
        }

        .quick-panel a > svg:last-child { margin-left: auto; }

        .quick-icon {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          background: #edf3ed;
          color: #1e6848;
          border-radius: 10px;
        }

        .error-message {
          padding: 12px;
          margin-bottom: 14px;
          border-radius: 10px;
          background: #fff0ed;
          color: #a74339;
          font-size: 13px;
        }

        .dashboard-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 30px 4px 5px;
          color: #92978f;
          font-size: 12px;
        }

        .footer-brand {
          font-weight: 850;
          font-size: 19px;
          color: #20392e;
          text-decoration: none;
        }

        @media (max-width: 800px) {
          .content-grid { grid-template-columns: 1fr; }
          .welcome-art { display: none; }
          .stats-grid { gap: 10px; }
          .stat-card { padding: 15px; }
          .stat-card > strong { font-size: 23px; }
        }

        @media (max-width: 520px) {
          .topbar { padding: 0 17px; height: 68px; }
          .brand { font-size: 21px; }
          .back-link { display: none; }
          .dashboard-container { padding: 22px 14px; }
          .welcome-banner { padding: 29px 22px; }
          .welcome-banner h1 { font-size: 32px; }
          .welcome-banner p { font-size: 13px; }
          .stats-grid { grid-template-columns: 1fr; }
          .stat-card {
            display: grid;
            grid-template-columns: 45px 1fr;
            column-gap: 12px;
            align-items: center;
          }
          .stat-icon {
            grid-row: span 3;
            margin: 0;
          }
          .stat-card > strong { margin: 3px 0; }
          .orders-panel, .profile-panel, .quick-panel {
            padding: 17px;
          }
          .order-card { gap: 9px; padding: 11px; }
          .order-right > strong { font-size: 13px; }
          .status { font-size: 9px; }
          .dashboard-footer {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
