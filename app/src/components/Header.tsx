"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDolarBlue } from "@/hooks/useDolarBlue";
import { formatARS } from "@/lib/utils";
import { dict } from "@/lib/dict";
import {
  TrendingUp,
  Menu,
  ShoppingBag,
  ShoppingCart,
  Check,
  SlidersHorizontal,
  Sun,
  Moon,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useCart } from "@/context/CartContext";
import { useSearch } from "@/context/SearchContext";
import CartDrawer from "./CartDrawer";
import GlobalSearch from "./GlobalSearch";
import { useTheme } from "@/context/ThemeContext";
import { SearchableSelect } from "./SearchableSelect";
import { phone } from "@/const/phone";
import { messagewsp } from "@/const/messagewsp";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/database.types";

export default function Header() {
  const pathname = usePathname();
  const { dolar, loading } = useDolarBlue();
  const { totalItems, isDrawerOpen, setDrawerOpen } = useCart();
  const {
    sortBy,
    setSortBy,
    resetSearch,
    category,
    setCategory,
    searchQuery,
  } = useSearch();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const router = useRouter();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    async function fetchCategories() {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      if (data) setCategories(data);
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      // Resetear búsqueda solo si salimos de la sección de productos
      if (!pathname.startsWith("/productos")) {
        resetSearch();
      }
    }

    // Sincronizar el combo de categorías con la URL (para rutas dinámicas /productos/[slug])
    const parts = pathname.split("/");
    if (parts[1] === "productos" && parts[2]) {
      setCategory(parts[2]);
    } else if (pathname === "/productos") {
      const catParam = new URLSearchParams(window.location.search).get(
        "categoria",
      );
      if (!catParam) setCategory("");
    }

    prevPathname.current = pathname;
  }, [pathname, resetSearch, setCategory]);

  const isProductsPage = pathname === "/productos";
  const isHome = pathname === "/";

  const navItems = [
    { href: "/", label: dict.nav.inicio },
    { href: "/categorias", label: dict.nav.categorias },
    { href: "/servicios", label: dict.nav.servicios },
    { href: "/productos", label: dict.nav.productos },
    { href: "/nosotros", label: dict.nav.nosotros },
    { href: "/como-comprar", label: dict.nav.comoComprar },
  ];

  const categoryOptions = [
    { value: "", label: "Todas las categorías" },
    ...categories.map((c) => ({ value: c.slug, label: c.name })),
  ];

  return (
    <header className="header">
      <div className="header-inner">
        {/* Left: Logo */}
        <Link href="/" className="logo-container">
          <img
            src={
              theme === "dark"
                ? "/logo_transparent_dark.png"
                : "/logo_transparent_light.png"
            }
            alt={dict.marca.nombre}
            className="brand-logo"
          />
          <span className="brand-name">
            Desde 2008 impulsando tu mundo tecnológico
          </span>
        </Link>

        {/* Right Column: Menu (Top) and Search (Bottom) */}
        <div className="header-right-col">
          {/* Top Row: Menu & Actions */}
          <div className="header-top-row">
            {/* Nav desktop */}
            <nav className="md-show">
              <ul className="nav-links">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={pathname === item.href ? "active" : ""}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Actions */}
            <div className="header-actions">
              {loading ? (
                <div
                  className="skeleton"
                  style={{ width: 100, height: 32, borderRadius: 100 }}
                />
              ) : dolar ? (
                <div
                  className="dolar-badge md-show"
                  title={`Dólar Blue — Compra: $${formatARS(dolar.compra)} | Venta: $${formatARS(dolar.venta)}`}
                >
                  <span className="dolar-dot" />
                  <span style={{ opacity: 0.9 }}>
                    Cotización del Dólar Hoy:
                  </span>
                  <span
                    style={{ fontWeight: 800, color: "var(--text-primary)" }}
                  >
                    $ {dolar.venta.toLocaleString("es-AR")}
                  </span>
                </div>
              ) : null}

              {/* Cart */}
              <button
                className="btn btn-ghost"
                style={{
                  position: "relative",
                  padding: "8px",
                  background:
                    totalItems > 0
                      ? "rgba(52, 199, 89, 0.1)"
                      : "var(--bg-card)",
                  borderRadius: "12px",
                  border:
                    totalItems > 0
                      ? "1px solid rgba(52, 199, 89, 0.3)"
                      : "1px solid var(--border-light)",
                }}
                onClick={() => setDrawerOpen(true)}
              >
                <ShoppingCart
                  size={22}
                  color={
                    totalItems > 0
                      ? "var(--accent-light)"
                      : "var(--text-secondary)"
                  }
                />
                {totalItems > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      background: "var(--green)",
                      color: "#fff",
                      borderRadius: "50%",
                      minWidth: 20,
                      height: 20,
                      fontSize: "0.75rem",
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid var(--bg-primary)",
                      boxShadow: "0 0 10px rgba(52, 199, 89, 0.5)",
                      padding: "0 4px",
                    }}
                  >
                    {totalItems}
                  </span>
                )}
              </button>

              {/* Theme Toggle */}
              <button
                className="btn btn-ghost theme-toggle-btn"
                onClick={toggleTheme}
                aria-label={
                  theme === "dark"
                    ? "Cambiar a modo claro"
                    : "Cambiar a modo oscuro"
                }
                title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
                style={{
                  padding: "8px",
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                {theme === "dark" ? (
                  <Sun size={20} color="var(--text-secondary)" />
                ) : (
                  <Moon size={20} color="var(--text-secondary)" />
                )}
              </button>

              {/* Mobile hamburger */}
              <button
                id="menu-toggle"
                className="btn btn-ghost btn-sm mobile-only"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Menú"
              >
                <Menu size={18} />
              </button>
            </div>
          </div>

          {/* Bottom Row: Search, Filters, Sort */}
          <div className="header-search-row">
            <div className="global-search-wrapper">
              <GlobalSearch />

              <div className="header-category-wrap">
                <SearchableSelect
                  id="header-category"
                  value={category}
                  onChange={(v) => {
                    setCategory(v);
                    if (v) {
                      router.push(`/productos/${v}`);
                    } else {
                      router.push("/productos");
                    }
                  }}
                  options={categoryOptions}
                  placeholder="Todas las categorías"
                />
              </div>


              {/* <div className="md-show" style={{ width: 200 }}>
                                <SearchableSelect
                                    id="header-sort"
                                    value={sortBy}
                                    onChange={(v) => {
                                        setSortBy(v)
                                        if (!isProductsPage) {
                                            const params = new URLSearchParams()
                                            if (category) params.set('categoria', category)
                                            if (searchQuery) params.set('q', searchQuery)
                                            const queryStr = params.toString()
                                            router.push(`/productos${queryStr ? `?${queryStr}` : ''}`)
                                        }
                                    }}
                                    options={[
                                        { value: 'reciente', label: 'Más recientes' },
                                        { value: 'precio-asc', label: 'Precio: menor a mayor' },
                                        { value: 'precio-desc', label: 'Precio: mayor a menor' },
                                        { value: 'nombre-asc', label: 'Nombre A-Z' },
                                        { value: 'nombre-desc', label: 'Nombre Z-A' },
                                    ]}
                                />
                            </div> */}
            </div>

            {/* WhatsApp - aligned right, vertically centered */}
            <a
              href={`https://wa.me/${phone}?text=${messagewsp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-btn md-show"
              title="Contactanos por WhatsApp"
            >
              <img
                src="/whatsapp-logo.png"
                alt="WhatsApp"
                className="whatsapp-icon-img"
              />
            </a>
          </div>
        </div>
      </div>

      {/* Cart Drawer */}
      <CartDrawer isOpen={isDrawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Mobile menu */}
      {menuOpen && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "12px 0",
            background: "var(--bg-glass)",
          }}
        >
          <div className="container">
            <nav
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    color:
                      pathname === item.href
                        ? "var(--accent-light)"
                        : "var(--text-secondary)",
                    background:
                      pathname === item.href
                        ? "rgba(52, 199, 89, 0.1)"
                        : "transparent",
                  }}
                >
                  {item.label}
                </Link>
              ))}
              <a
                href={`https://wa.me/${phone}?text=${messagewsp}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "12px 14px",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#25D366",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "12px",
                  background: "transparent",
                  border: "none",
                }}
              >
                <img
                  src="/whatsapp-logo.png"
                  alt=""
                  style={{ width: 24, height: 24 }}
                />
                WhatsApp
              </a>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
