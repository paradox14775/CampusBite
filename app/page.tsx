
"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Search,
  ShoppingBag,
  Clock3,
  Star,
  Plus,
  Minus,
  X,
  Menu,
  Leaf,
  Flame,
  Utensils,
  MapPin,
  Sparkles,
  Heart,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  time: string;
  image: string;
  tag: string;
  veg: boolean;
};

type CartItem = {
  id: string;
  quantity: number;
};

type CategoryRow = {
  id: string;
  name: string;
};

// ---------------------------------------------
// PRODUCT IMAGE FALLBACKS
// ---------------------------------------------

const productDetails: Record<
  string,
  { image: string; rating: number; tag: string }
> = {
  "Classic Veg Burger": {
    image: "photo-1568901346375-23c9450c58cd",
    rating: 4.8,
    tag: "Bestseller",
  },
  "Margherita Pizza": {
    image: "photo-1574071318508-1cdbab80d002",
    rating: 4.9,
    tag: "Popular",
  },
  "Crispy French Fries": {
    image: "photo-1573080496219-bb080dd4f877",
    rating: 4.7,
    tag: "Quick bite",
  },
  "Cold Coffee": {
    image: "photo-1461023058943-07fcbe16d735",
    rating: 4.8,
    tag: "Refreshing",
  },
  "Chocolate Brownie": {
    image: "photo-1606313564200-e75d5e30476c",
    rating: 4.9,
    tag: "Sweet treat",
  },
  "Paneer Sandwich": {
    image: "photo-1528735602780-2552fd46c7af",
    rating: 4.6,
    tag: "Fresh",
  },
  "Cheese Burger": {
    image: "photo-1553979459-d2229ba7433a",
    rating: 4.9,
    tag: "Student favourite",
  },
  "Fresh Lemon Soda": {
    image: "photo-1513558161293-cdaf765edfd4",
    rating: 4.5,
    tag: "Refreshing",
  },
};

const categories = [
  "All",
  "Burgers",
  "Pizza",
  "Snacks",
  "Drinks",
  "Desserts",
];

const imageUrl = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=85`;

const productImageUrl = (image: string) =>
  image.startsWith("http") ? image : imageUrl(image);

// ---------------------------------------------
// HOMEPAGE
// ---------------------------------------------

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi">("cash");
  const [orderNotes, setOrderNotes] = useState("");
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [placedOrder, setPlacedOrder] = useState<{
    order_id: string;
    order_number: number;
    pickup_code: string;
    total_amount: number;
  } | null>(null);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [favourites, setFavourites] = useState<string[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // ---------------------------------------------
  // FETCH PRODUCTS FROM SUPABASE
  // ---------------------------------------------

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        const supabase = createClient();

        const [productResult, categoryResult] = await Promise.all([
          supabase
            .from("products")
            .select("*")
            .eq("is_available", true)
            .order("name"),

          supabase
            .from("categories")
            .select("id, name"),
        ]);

        if (!active) return;

        if (productResult.error) {
          throw new Error(productResult.error.message);
        }

        if (categoryResult.error) {
          throw new Error(categoryResult.error.message);
        }

        const categoryMap = new Map(
          (categoryResult.data as CategoryRow[]).map((item) => [
            item.id,
            item.name === "Beverages" ? "Drinks" : item.name,
          ])
        );

        const liveProducts: Product[] = productResult.data.map((item) => {
          const details = productDetails[item.name];

          return {
            id: item.id,
            name: item.name,
            category: categoryMap.get(item.category_id) || "Other",
            price: Number(item.price),
            rating: details?.rating ?? 4.5,
            time: `${item.preparation_time_minutes} min`,
            image:
              item.image_url ||
              details?.image ||
              "photo-1546069901-ba9599a7e63c",
            tag: details?.tag || "Fresh",
            veg: item.is_vegetarian,
          };
        });

        setProducts(liveProducts);
        setDbError(null);
      } catch (error) {
        if (!active) return;

        setDbError(
          error instanceof Error
            ? error.message
            : "Unable to load the menu."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

  // ---------------------------------------------
  // AUTHENTICATION SESSION
  // ---------------------------------------------

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();

      if (!mounted) return;

      if (error) {
        console.error("Unable to load signed-in user:", error.message);
      }

      setUser(data.user);
      setAuthLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert("Unable to sign out: " + error.message);
      return;
    }

    setUser(null);
    window.location.href = "/login";
  }

  async function handlePlaceOrder() {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (cart.length === 0) {
      setCheckoutError("Your cart is empty.");
      return;
    }

    setCheckoutSubmitting(true);
    setCheckoutError("");

    try {
      const supabase = createClient();

      const { data, error } = await supabase.rpc(
        "place_campusbite_order",
        {
          p_items: cart.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
          })),
          p_payment_method: paymentMethod,
          p_notes: orderNotes.trim() || null,
        }
      );

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;

      if (
        !result?.order_id ||
        !result?.order_number ||
        !result?.pickup_code
      ) {
        throw new Error("The order was created but its confirmation could not be read. Please check your dashboard before retrying.");
      }

      setPlacedOrder({
        order_id: result.order_id,
        order_number: Number(result.order_number),
        pickup_code: result.pickup_code,
        total_amount: Number(result.total_amount),
      });
      setCart([]);
      setOrderNotes("");
    
} catch (error) {
  console.error("CampusBite checkout error:", error);

  const message =
    error instanceof Error
      ? error.message
      : JSON.stringify(error);

  setCheckoutError(message || "Unknown checkout error");
} finally {
  setCheckoutSubmitting(false);
}

  }

  // ---------------------------------------------
  // SEARCH AND CATEGORY FILTER
  // ---------------------------------------------

  const filteredProducts = useMemo(() => {
    return products.filter(
      (product) =>
        (category === "All" || product.category === category) &&
        product.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [products, category, search]);

  // ---------------------------------------------
  // CART CALCULATIONS
  // ---------------------------------------------

  const cartCount = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const total = cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.id);

    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);

  const updateCart = (id: string, change: number) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === id);

      if (!existing && change > 0) {
        return [...current, { id, quantity: 1 }];
      }

      return current
        .map((item) =>
          item.id === id
            ? { ...item, quantity: item.quantity + change }
            : item
        )
        .filter((item) => item.quantity > 0);
    });
  };

  const getQuantity = (id: string) =>
    cart.find((item) => item.id === id)?.quantity ?? 0;

  // ---------------------------------------------
  // PAGE
  // ---------------------------------------------

  return (
    <main>
      {/* ANNOUNCEMENT */}

      <div className="announcement">
        <Sparkles size={14} />
        <span>Good food. Great breaks. Made for campus life.</span>
        <Sparkles size={14} />
      </div>

      {/* NAVBAR */}

      <header className="navbar">
        <a href="#" className="brand">
          <span className="brand-icon">
            <Utensils size={21} />
          </span>

          <span>
            campus<span className="brand-accent">bite.</span>
          </span>
        </a>

        <nav className={mobileMenu ? "nav-links mobile-open" : "nav-links"}>
          <a href="#home" onClick={() => setMobileMenu(false)}>
            Home
          </a>

          <a href="#menu" onClick={() => setMobileMenu(false)}>
            Explore menu
          </a>

          <a href="#about" onClick={() => setMobileMenu(false)}>
            About us
          </a>
        </nav>

        <div className="nav-actions">
          <button
            className="icon-button"
            onClick={() => setCartOpen(true)}
            aria-label="Open cart"
          >
            <ShoppingBag size={20} />

            {cartCount > 0 && (
              <span className="cart-badge">{cartCount}</span>
            )}
          </button>

          <button
            className="nav-cta"
            onClick={() =>
              document
                .getElementById("menu")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Order now <ArrowRight size={16} />
          </button>

          {!authLoading && (
            user ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "7px 10px",
                  border: "1px solid #e4e8e2",
                  borderRadius: "999px",
                  background: "#ffffff",
                }}
              >
                <a
                  href="/dashboard"
                  aria-label="Open student dashboard and profile"
                  title="Open your profile"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "inherit",
                    textDecoration: "none",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: "#1e4d3a",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "13px",
                      flexShrink: 0,
                    }}
                  >
                    {(user.email?.[0] ?? "S").toUpperCase()}
                  </span>
                  <span
                    style={{
                      maxWidth: "125px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "13px",
                      color: "#20392e",
                    }}
                  >
                    {user.email?.split("@")[0] ?? "Student"}
                  </span>
                </a>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "#1e4d3a",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: "12px",
                    padding: "5px",
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <a
                href="/login"
                className="nav-cta"
                style={{ textDecoration: "none" }}
              >
                Sign in <ArrowRight size={16} />
              </a>
            )
          )}

          <button
            className="mobile-toggle"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label="Toggle navigation"
          >
            {mobileMenu ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {/* HERO */}

      <section className="hero" id="home">
        <div className="hero-content">
          <motion.div
            className="eyebrow"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="eyebrow-dot" />
            YOUR CAMPUS, YOUR CANTEEN
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            Big hunger.
            <br />
            <span>Small breaks.</span>
            <br />
            Great food.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Your campus cravings, sorted. Discover delicious food,
            order in a few clicks and spend less time waiting.
          </motion.p>

          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <button
              className="primary-button"
              onClick={() =>
                document
                  .getElementById("menu")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Explore menu <ArrowRight size={17} />
            </button>

            <div className="hero-delivery">
              <Clock3 size={17} /> Quick campus pickup
            </div>
          </motion.div>

          <div className="hero-social">
            <div className="avatar-stack">
              <span>H</span>
              <span>A</span>
              <span>R</span>
              <span>S</span>
            </div>

            <div>
              <strong>Made for students</strong>
              <small>Good food, better breaks.</small>
            </div>
          </div>
        </div>

        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, scale: 0.9, rotate: 3 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.9 }}
        >
          <div className="hero-image">
            <img
              src={imageUrl("photo-1568901346375-23c9450c58cd")}
              alt="Delicious burger"
            />
          </div>

          <motion.div
            className="floating-card float-one"
            animate={{ y: [0, -9, 0] }}
            transition={{ repeat: Infinity, duration: 3 }}
          >
            <span className="float-icon">
              <Star size={17} fill="currentColor" />
            </span>

            <span>
              <strong>4.9/5</strong>
              <small>Student favourite</small>
            </span>
          </motion.div>

          <motion.div
            className="floating-card float-two"
            animate={{ y: [0, 9, 0] }}
            transition={{ repeat: Infinity, duration: 3.5 }}
          >
            <span className="float-icon green">
              <Clock3 size={18} />
            </span>

            <span>
              <strong>10–15 min</strong>
              <small>Quick pickup</small>
            </span>
          </motion.div>

          <div className="hero-sticker">
            FRESH
            <br />
            & TASTY!
          </div>
        </motion.div>
      </section>

      {/* BENEFITS */}

      <section className="benefits">
        <div>
          <Clock3 />
          <span>
            <strong>Less waiting</strong>
            <small>Order ahead</small>
          </span>
        </div>

        <div>
          <Leaf />
          <span>
            <strong>Fresh food</strong>
            <small>Made to order</small>
          </span>
        </div>

        <div>
          <Flame />
          <span>
            <strong>Student favourites</strong>
            <small>Something for everyone</small>
          </span>
        </div>

        <div>
          <MapPin />
          <span>
            <strong>On campus</strong>
            <small>Easy pickup</small>
          </span>
        </div>
      </section>

      {/* MENU */}

      <section className="menu-section" id="menu">
        <div className="section-heading">
          <div>
            <div className="section-eyebrow">THE GOOD STUFF</div>
            <h2>
              What&apos;s cooking<span>?</span>
            </h2>
            <p>Find your favourite bite for the perfect break.</p>
          </div>

          <div className="menu-search">
            <Search size={18} />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search delicious food..."
              aria-label="Search menu"
            />

            {search && (
              <button onClick={() => setSearch("")}>
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* CATEGORIES */}

        <div className="category-list">
          {categories.map((item, index) => (
            <motion.button
              whileTap={{ scale: 0.94 }}
              key={item}
              className={
                category === item ? "category active" : "category"
              }
              onClick={() => setCategory(item)}
            >
              {index === 0 ? (
                <Utensils size={16} />
              ) : index === 1 ? (
                <Flame size={16} />
              ) : index === 2 ? (
                <span>🍕</span>
              ) : index === 3 ? (
                <span>🍟</span>
              ) : index === 4 ? (
                <span>🥤</span>
              ) : (
                <span>🍰</span>
              )}

              {item}
            </motion.button>
          ))}
        </div>

        {/* LOADING */}

        {loading && (
          <div className="empty-search">
            <Clock3 size={35} />
            <h3>Preparing your menu...</h3>
            <p>Fetching fresh menu items from CampusBite.</p>
          </div>
        )}

        {/* DATABASE ERROR */}

        {!loading && dbError && (
          <div className="empty-search">
            <ShoppingBag size={35} />
            <h3>Unable to load menu</h3>
            <p>{dbError}</p>

            <button
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        )}

        {/* LIVE PRODUCTS */}

        {!loading && !dbError && (
          <>
            <div className="product-grid">
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product, index) => (
                  <motion.article
                    layout
                    key={product.id}
                    className="product-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{
                      duration: 0.3,
                      delay: index * 0.035,
                    }}
                  >
                    <div className="product-image">
                      <img
                        src={productImageUrl(product.image)}
                        alt={product.name}
                        loading="lazy"
                      />

                      <span className="product-tag">
                        {product.tag}
                      </span>

                      <button
                        className={
                          favourites.includes(product.id)
                            ? "favourite active"
                            : "favourite"
                        }
                        onClick={() =>
                          setFavourites((old) =>
                            old.includes(product.id)
                              ? old.filter((id) => id !== product.id)
                              : [...old, product.id]
                          )
                        }
                        aria-label="Toggle favourite"
                      >
                        <Heart
                          size={17}
                          fill={
                            favourites.includes(product.id)
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>

                      {product.veg && (
                        <span className="veg-mark">
                          <span />
                        </span>
                      )}
                    </div>

                    <div className="product-info">
                      <div className="product-title-row">
                        <h3>{product.name}</h3>

                        <span className="rating">
                          <Star size={13} fill="currentColor" />
                          {product.rating}
                        </span>
                      </div>

                      <div className="product-meta">
                        <span>
                          <Clock3 size={13} />
                          {product.time}
                        </span>

                        <span>{product.category}</span>
                      </div>

                      <div className="product-bottom">
                        <strong className="price">
                          ₹{product.price}
                        </strong>

                        {getQuantity(product.id) === 0 ? (
                          <button
                            className="add-button"
                            onClick={() => updateCart(product.id, 1)}
                          >
                            ADD <Plus size={15} />
                          </button>
                        ) : (
                          <div className="quantity-control">
                            <button
                              onClick={() =>
                                updateCart(product.id, -1)
                              }
                              aria-label="Decrease quantity"
                            >
                              <Minus size={14} />
                            </button>

                            <strong>
                              {getQuantity(product.id)}
                            </strong>

                            <button
                              onClick={() =>
                                updateCart(product.id, 1)
                              }
                              aria-label="Increase quantity"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
            </div>

            {/* EMPTY SEARCH */}

            {filteredProducts.length === 0 && (
              <div className="empty-search">
                <Search size={35} />
                <h3>No food found</h3>
                <p>Try another search or category.</p>

                <button
                  className="primary-button"
                  onClick={() => {
                    setSearch("");
                    setCategory("All");
                  }}
                >
                  Show all food
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* PROMO SECTION */}

      <section className="promo-section" id="about">
        <div className="promo-copy">
          <span className="promo-label">
            YOUR BREAK, UPGRADED
          </span>

          <h2>
            More eating.
            <br />
            <span>Less waiting.</span>
          </h2>

          <p>
            Skip the queue and make the most of your campus break.
            Your next favourite meal is just a few clicks away.
          </p>

          <button
            className="primary-button"
            onClick={() =>
              document
                .getElementById("menu")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Find your favourite <ArrowRight size={17} />
          </button>
        </div>

        <div className="promo-image">
          <img
            src={imageUrl("photo-1547592180-85f173990554")}
            alt="Freshly prepared meal"
            loading="lazy"
          />
        </div>
      </section>

      {/* FOOTER */}

      <footer className="footer">
        <a href="#" className="brand footer-brand">
          <span className="brand-icon">
            <Utensils size={20} />
          </span>

          <span>
            campus<span className="brand-accent">bite.</span>
          </span>
        </a>

        <p>Good food. Great breaks. Made for campus life.</p>

        <span className="footer-copy">
          © 2026 CampusBite. All rights reserved.
        </span>
      </footer>

      {/* CART DRAWER */}

      <AnimatePresence>
        {cartOpen && (
          <motion.div
            className="cart-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartOpen(false)}
          >
            <motion.div
              className="cart-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="cart-header">
                <div>
                  <h2>Your cart</h2>
                  <p>{cartCount} items selected</p>
                </div>

                <button
                  className="icon-button"
                  onClick={() => setCartOpen(false)}
                  aria-label="Close cart"
                >
                  <X />
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="cart-empty">
                  <ShoppingBag size={48} />
                  <h3>Your cart is empty</h3>
                  <p>
                    Some delicious food is waiting for you.
                  </p>

                  <button
                    className="primary-button"
                    onClick={() => setCartOpen(false)}
                  >
                    Explore menu
                  </button>
                </div>
              ) : (
                <>
                  <div className="cart-items">
                    {cart.map((item) => {
                      const product = products.find(
                        (p) => p.id === item.id
                      );

                      if (!product) return null;

                      return (
                        <div className="cart-item" key={item.id}>
                          <img
                            src={productImageUrl(product.image)}
                            alt={product.name}
                          />

                          <div className="cart-item-info">
                            <strong>{product.name}</strong>

                            <span>₹{product.price} each</span>

                            <div className="quantity-control">
                              <button
                                onClick={() =>
                                  updateCart(product.id, -1)
                                }
                              >
                                <Minus size={13} />
                              </button>

                              <strong>{item.quantity}</strong>

                              <button
                                onClick={() =>
                                  updateCart(product.id, 1)
                                }
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          </div>

                          <strong>
                            ₹{product.price * item.quantity}
                          </strong>
                        </div>
                      );
                    })}
                  </div>

                  <div className="cart-summary">
                    <div>
                      <span>Subtotal</span>
                      <strong>₹{total}</strong>
                    </div>

                    <div>
                      <span>Pickup fee</span>
                      <strong>₹0</strong>
                    </div>

                    <div className="cart-total">
                      <span>Total</span>
                      <strong>₹{total}</strong>
                    </div>

                    <button
                      className="primary-button checkout-button"
                      onClick={() => {
                        if (!user) {
                          window.location.href = "/login";
                          return;
                        }
                        setCheckoutError("");
                        setPlacedOrder(null);
                        setCartOpen(false);
                        setCheckoutOpen(true);
                      }}
                    >
                      Continue to checkout{" "}
                      <ArrowRight size={17} />
                    </button>

                    <small>
                      Secure order creation · Pay at the canteen pickup counter
                    </small>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CHECKOUT AND ORDER CONFIRMATION */}
      <AnimatePresence>
        {checkoutOpen && (
          <motion.div
            className="checkout-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!checkoutSubmitting) setCheckoutOpen(false);
            }}
          >
            <motion.section
              className="checkout-modal"
              initial={{ opacity: 0, y: 22, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              onClick={(event) => event.stopPropagation()}
            >
              {placedOrder ? (
                <div className="order-success">
                  <div className="success-mark">✓</div>
                  <span className="checkout-eyebrow">ORDER CONFIRMED</span>
                  <h2>Your campus break is sorted!</h2>
                  <p className="success-copy">
                    Your order has been sent to the canteen. Keep your pickup code ready.
                  </p>

                  <div className="pickup-code-card">
                    <span>ORDER NUMBER</span>
                    <strong>#{placedOrder.order_number}</strong>
                    <span className="pickup-label">PICKUP CODE</span>
                    <strong className="pickup-code">{placedOrder.pickup_code}</strong>
                    <div className="confirmed-total">
                      <span>Order total</span>
                      <strong>₹{placedOrder.total_amount.toFixed(2)}</strong>
                    </div>
                  </div>

                  <p className="payment-reminder">
                    {paymentMethod === "upi"
                      ? "Payment method: UPI at pickup. Payment is pending until the canteen confirms it."
                      : "Payment method: Cash at pickup. Please pay when collecting your order."}
                  </p>

                  <a className="checkout-primary" href="/dashboard">
                    View my orders <ArrowRight size={17} />
                  </a>
                  <button
                    className="checkout-secondary"
                    onClick={() => {
                      setCheckoutOpen(false);
                      setPlacedOrder(null);
                    }}
                  >
                    Continue browsing
                  </button>
                </div>
              ) : (
                <>
                  <div className="checkout-heading">
                    <div>
                      <span className="checkout-eyebrow">CAMPUSBITE CHECKOUT</span>
                      <h2>Complete your order</h2>
                      <p>Review your items and choose how you’ll pay at pickup.</p>
                    </div>
                    <button
                      className="checkout-close"
                      onClick={() => setCheckoutOpen(false)}
                      disabled={checkoutSubmitting}
                      aria-label="Close checkout"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="checkout-items">
                    {cart.map((item) => {
                      const product = products.find((p) => p.id === item.id);
                      if (!product) return null;
                      return (
                        <div className="checkout-item" key={item.id}>
                          <div>
                            <strong>{product.name}</strong>
                            <span>{item.quantity} × ₹{product.price}</span>
                          </div>
                          <strong>₹{product.price * item.quantity}</strong>
                        </div>
                      );
                    })}
                  </div>

                  <div className="checkout-total-row">
                    <span>Total payable at pickup</span>
                    <strong>₹{total.toFixed(2)}</strong>
                  </div>

                  <div className="payment-heading">Choose payment method</div>
                  <div className="payment-options">
                    <button
                      type="button"
                      className={paymentMethod === "cash" ? "payment-option selected" : "payment-option"}
                      onClick={() => setPaymentMethod("cash")}
                      disabled={checkoutSubmitting}
                    >
                      <span className="payment-symbol">₹</span>
                      <span><strong>Cash</strong><small>Pay at pickup</small></span>
                      <span className="payment-radio">{paymentMethod === "cash" ? "✓" : ""}</span>
                    </button>
                    <button
                      type="button"
                      className={paymentMethod === "upi" ? "payment-option selected" : "payment-option"}
                      onClick={() => setPaymentMethod("upi")}
                      disabled={checkoutSubmitting}
                    >
                      <span className="payment-symbol upi-symbol">UPI</span>
                      <span><strong>UPI</strong><small>Scan and pay at pickup</small></span>
                      <span className="payment-radio">{paymentMethod === "upi" ? "✓" : ""}</span>
                    </button>
                  </div>

                  <label className="notes-label" htmlFor="campusbite-order-notes">
                    Order note <span>(optional)</span>
                  </label>
                  <textarea
                    id="campusbite-order-notes"
                    value={orderNotes}
                    onChange={(event) => setOrderNotes(event.target.value.slice(0, 500))}
                    placeholder="Any instructions for the canteen?"
                    rows={3}
                    disabled={checkoutSubmitting}
                  />

                  {checkoutError && (
                    <div className="checkout-error" role="alert">{checkoutError}</div>
                  )}

                  <button
                    className="checkout-primary place-order-button"
                    onClick={handlePlaceOrder}
                    disabled={checkoutSubmitting || cart.length === 0}
                  >
                    {checkoutSubmitting ? "Placing your order..." : `Place order · ₹${total.toFixed(2)}`}
                    {!checkoutSubmitting && <ArrowRight size={17} />}
                  </button>
                  <p className="checkout-footnote">
                    No online payment is taken here. Cash or UPI is settled at the canteen counter.
                  </p>
                </>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .checkout-overlay {
          position: fixed;
          inset: 0;
          z-index: 1200;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(16, 29, 22, .58);
          backdrop-filter: blur(5px);
        }
        .checkout-modal {
          width: min(100%, 540px);
          max-height: min(90vh, 850px);
          overflow-y: auto;
          padding: 28px;
          border-radius: 23px;
          background: #fbfaf6;
          color: #20392e;
          box-shadow: 0 25px 90px rgba(0,0,0,.25);
        }
        .checkout-heading {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 22px;
        }
        .checkout-eyebrow {
          display: block;
          color: #d17d42;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 1.6px;
          margin-bottom: 9px;
        }
        .checkout-heading h2, .order-success h2 {
          margin: 0;
          font-size: 26px;
          letter-spacing: -.8px;
        }
        .checkout-heading p, .success-copy {
          margin: 8px 0 0;
          color: #7b857d;
          font-size: 13px;
          line-height: 1.6;
        }
        .checkout-close {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          border: 1px solid #e4e8e1;
          border-radius: 50%;
          background: white;
          color: #20392e;
          cursor: pointer;
        }
        .checkout-items {
          display: grid;
          gap: 12px;
          padding: 16px 0;
          border-top: 1px solid #e8e9e2;
          border-bottom: 1px solid #e8e9e2;
        }
        .checkout-item, .checkout-total-row, .confirmed-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .checkout-item div {
          display: grid;
          gap: 4px;
        }
        .checkout-item strong, .checkout-total-row strong { font-size: 14px; }
        .checkout-item span, .checkout-total-row span {
          color: #879087;
          font-size: 12px;
        }
        .checkout-total-row { padding: 17px 0; }
        .checkout-total-row strong { font-size: 21px; color: #1e6848; }
        .payment-heading {
          margin: 5px 0 11px;
          font-size: 13px;
          font-weight: 800;
        }
        .payment-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .payment-option {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 12px;
          border: 1px solid #e2e6df;
          border-radius: 13px;
          background: white;
          color: #20392e;
          text-align: left;
          cursor: pointer;
        }
        .payment-option.selected {
          border: 1.5px solid #1e6848;
          background: #edf5ee;
        }
        .payment-option:disabled { opacity: .65; cursor: not-allowed; }
        .payment-symbol {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          flex: 0 0 34px;
          border-radius: 10px;
          background: #e7f1e9;
          color: #1e6848;
          font-weight: 850;
        }
        .upi-symbol { font-size: 10px; }
        .payment-option > span:nth-child(2) { display: grid; gap: 4px; }
        .payment-option strong { font-size: 12px; }
        .payment-option small { color: #879087; font-size: 10px; }
        .payment-radio {
          width: 19px;
          height: 19px;
          display: grid;
          place-items: center;
          margin-left: auto;
          border: 1px solid #cbd5ca;
          border-radius: 50%;
          color: white;
          font-size: 11px;
        }
        .selected .payment-radio { background: #1e6848; border-color: #1e6848; }
        .notes-label {
          display: block;
          margin: 18px 0 8px;
          font-size: 12px;
          font-weight: 800;
        }
        .notes-label span { color: #929a92; font-weight: 400; }
        #campusbite-order-notes {
          width: 100%;
          resize: vertical;
          padding: 12px;
          border: 1px solid #e1e6df;
          border-radius: 11px;
          background: white;
          color: #20392e;
          font: inherit;
          font-size: 13px;
        }
        .checkout-error {
          margin-top: 12px;
          padding: 11px 12px;
          border-radius: 10px;
          background: #fff0ed;
          color: #a74339;
          font-size: 12px;
          line-height: 1.5;
        }
        .checkout-primary {
          width: 100%;
          min-height: 49px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 17px;
          padding: 13px 16px;
          border: 0;
          border-radius: 12px;
          background: #1e4d3a;
          color: white;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
        }
        .checkout-primary:disabled { opacity: .6; cursor: not-allowed; }
        .checkout-footnote, .payment-reminder {
          margin: 10px 0 0;
          color: #899188;
          font-size: 10px;
          line-height: 1.6;
          text-align: center;
        }
        .order-success { text-align: center; padding: 10px 2px 2px; }
        .success-mark {
          width: 62px;
          height: 62px;
          display: grid;
          place-items: center;
          margin: 0 auto 17px;
          border-radius: 50%;
          background: #e5f2e7;
          color: #1e6848;
          font-size: 32px;
          font-weight: 800;
        }
        .pickup-code-card {
          display: grid;
          gap: 8px;
          margin-top: 22px;
          padding: 20px;
          border: 1px dashed #a8c3ad;
          border-radius: 15px;
          background: #f0f6ef;
        }
        .pickup-code-card > span {
          color: #7c897e;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.3px;
        }
        .pickup-code-card > strong { font-size: 24px; color: #20392e; }
        .pickup-code-card .pickup-label { margin-top: 10px; }
        .pickup-code-card .pickup-code {
          color: #1e6848;
          font-size: 34px;
          letter-spacing: 5px;
        }
        .confirmed-total {
          margin-top: 12px;
          padding-top: 13px;
          border-top: 1px solid #dce8dc;
          font-size: 12px;
        }
        .confirmed-total strong { font-size: 17px; }
        .payment-reminder { font-size: 11px; }
        .checkout-secondary {
          margin-top: 12px;
          border: 0;
          background: transparent;
          color: #607067;
          font-size: 12px;
          cursor: pointer;
        }
        @media (max-width: 480px) {
          .checkout-modal { padding: 21px 17px; border-radius: 18px; }
          .checkout-heading h2, .order-success h2 { font-size: 22px; }
          .payment-options { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* FLOATING CART */}

      <button
        className="floating-cart"
        onClick={() => setCartOpen(true)}
        aria-label="View shopping cart"
      >
        <ShoppingBag size={20} />

        <span>₹{total}</span>

        {cartCount > 0 && <b>{cartCount}</b>}
      </button>
    </main>
  );
}
