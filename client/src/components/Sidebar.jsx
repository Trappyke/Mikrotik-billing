import React, { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { useBranding } from "../contexts/BrandingContext";
import {
  LayoutDashboard,
  Network,
  Link,
  HardDrive,
  FileCode,
  Server,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Users,
  Package,
  CreditCard,
  Receipt,
  MessageSquare,
  MessageCircle,
  MapPin,
  Wallet,
  Star,
  Activity,
  UserCheck,
  Shield,
  FileText as FileText2,
  Database,
  Settings as SettingsIcon,
  TrendingUp,
  Wifi,
  Ticket,
  LifeBuoy,
  Palette,
  LogOut,
  Webhook,
  User,
  Key,
  Radio,
  Gauge,
  Router,
  Building2,
  Sun,
  Moon,
  Upload,
} from "lucide-react";
import { clearAuth } from "../lib/auth";
import { SearchButton } from "./GlobalSearch";
import { useTheme } from "../contexts/ThemeContext";
import { canAccessFeature } from "../lib/permissions";

const API = import.meta.env.VITE_API_URL || "/api";

const navSections = [
  {
    id: "workspace",
    label: "Workspace",
    icon: LayoutDashboard,
    items: [
      {
        to: "/",
        icon: LayoutDashboard,
        label: "Dashboard",
        feature: "dashboard",
      },
      { to: "/topology", icon: Network, label: "Topology", feature: "topology" },
    ],
  },
  {
    id: "provisioning",
    label: "Provisioning",
    icon: HardDrive,
    items: [
      {
        to: "/devices",
        icon: HardDrive,
        label: "Routers",
        feature: "devices",
        badge: "pendingDevices",
      },
      {
        to: "/provision-logs",
        icon: FileText2,
        label: "Provision Logs",
        feature: "devices",
      },
      {
        to: "/router-linking",
        icon: Link,
        label: "Router Linking",
        feature: "router-linking",
      },
      {
        to: "/templates",
        icon: FileCode,
        label: "Templates",
        feature: "templates",
      },
      {
        to: "/mikrotik-api",
        icon: Server,
        label: "MikroTik API",
        feature: "mikrotik-api",
      },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    icon: DollarSign,
    items: [
      {
        to: "/billing",
        icon: DollarSign,
        label: "Overview",
        feature: "billing",
      },
      {
        to: "/billing-customers",
        icon: Users,
        label: "Customers",
        feature: "customers",
      },
      { to: "/billing-plans", icon: Package, label: "Plans", feature: "plans" },
      {
        to: "/billing-subscriptions",
        icon: Activity,
        label: "Subscriptions",
        feature: "subscriptions",
      },
      {
        to: "/billing-invoices",
        icon: Receipt,
        label: "Invoices",
        feature: "invoices",
      },
      {
        to: "/billing-payments",
        icon: CreditCard,
        label: "Payments",
        feature: "payments",
      },
      {
        to: "/billing-wallet",
        icon: Wallet,
        label: "Wallet",
        feature: "wallet",
      },
      {
        to: "/billing-reconcile",
        icon: Link,
        label: "Reconcile",
        feature: "subscriptions",
      },
    ],
  },
  {
    id: "network",
    label: "Network",
    icon: Router,
    items: [
      { to: "/pppoe", icon: Network, label: "PPPoE", feature: "pppoe" },
      { to: "/hotspot", icon: Wifi, label: "Hotspot", feature: "hotspot" },
      {
        to: "/hotspot-vouchers",
        icon: Ticket,
        label: "Vouchers",
        feature: "vouchers",
      },
      { to: "/radius", icon: Shield, label: "RADIUS", feature: "radius" },
      {
        to: "/radius-import",
        icon: Upload,
        label: "RADIUS Import",
        feature: "radius",
      },
      {
        to: "/network-services",
        icon: Server,
        label: "Services",
        feature: "network-services",
      },
      { to: "/ipam", icon: Network, label: "IPAM", feature: "ipam" },
      { to: "/olt", icon: Radio, label: "OLT/Fiber", feature: "olt" },
      { to: "/fup", icon: Gauge, label: "FUP Profiles", feature: "fup" },
      { to: "/tr069", icon: Router, label: "TR-069 CPE", feature: "tr069" },
      {
        to: "/speedtest",
        icon: Activity,
        label: "Speed Test",
        feature: "speedtest",
      },
      {
        to: "/bandwidth",
        icon: Activity,
        label: "Bandwidth",
        feature: "bandwidth",
      },
      {
        to: "/billing-monitoring",
        icon: Activity,
        label: "Monitoring",
        feature: "monitoring",
      },
      {
        to: "/billing-map",
        icon: MapPin,
        label: "Map",
        feature: "network-map",
      },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    icon: UserCheck,
    items: [
      { to: "/tickets", icon: LifeBuoy, label: "Support", feature: "tickets" },
      {
        to: "/captive-portal",
        icon: Palette,
        label: "Portal Builder",
        feature: "captive-portal",
      },
      {
        to: "/billing-agents",
        icon: UserCheck,
        label: "Agents",
        feature: "agents",
      },
      {
        to: "/resellers",
        icon: UserCheck,
        label: "Resellers",
        feature: "resellers",
      },
      {
        to: "/billing-reviews",
        icon: Star,
        label: "Reviews",
        feature: "reviews",
      },
      { to: "/billing-sms", icon: MessageSquare, label: "SMS", feature: "sms" },
      {
        to: "/billing-whatsapp",
        icon: MessageCircle,
        label: "WhatsApp",
        feature: "whatsapp",
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: TrendingUp,
    items: [
      {
        to: "/analytics",
        icon: TrendingUp,
        label: "Analytics",
        feature: "analytics",
      },
      {
        to: "/billing-reports",
        icon: FileText2,
        label: "Reports",
        feature: "reports",
      },
      {
        to: "/billing-auto-suspend",
        icon: Shield,
        label: "Auto-Suspend",
        feature: "auto-suspend",
      },
      {
        to: "/inventory",
        icon: Package,
        label: "Inventory",
        feature: "inventory",
      },
      {
        to: "/billing-backup",
        icon: Database,
        label: "Backups",
        feature: "backups",
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: SettingsIcon,
    items: [
      {
        to: "/integrations",
        icon: Key,
        label: "Integrations",
        feature: "integrations",
      },
      {
        to: "/settings",
        icon: SettingsIcon,
        label: "Settings",
        feature: "settings",
      },
      {
        to: "/users",
        icon: Users,
        label: "User Management",
        feature: "users",
        adminOnly: true,
      },
      {
        to: "/audit-logs",
        icon: FileText2,
        label: "Audit Logs",
        feature: "audit-logs",
        adminOnly: true,
      },
      {
        to: "/webhooks",
        icon: Webhook,
        label: "Webhooks",
        feature: "webhooks",
        adminOnly: true,
      },
    ],
  },
];

export function Sidebar({ onSearchOpen }) {
  const [user, setUser] = useState(null);
  const branding = useBranding();
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, setMode } = useTheme();
  const [openSections, setOpenSections] = useState({
    workspace: true,
    provisioning: true,
  });

  useEffect(() => {
    try {
      const userData = localStorage.getItem("auth_user");
      if (userData) {
        const parsed = JSON.parse(userData);
        setUser(parsed);
      }
    } catch (err) {
      console.error("Error parsing user data:", err);
    }
  }, []);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { data } = await axios.get(`${API}/devices/discovered/count`);
        setPendingCount(data.count || 0);
      } catch {
        // silently fail
      }
    };
    fetchCount();
    const id = setInterval(fetchCount, 15000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const canViewItem = (item) => {
    if (item.adminOnly && user?.role !== "admin") {
      return false;
    }
    return canAccessFeature(user, item.feature);
  };

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(canViewItem),
    }))
    .filter((section) => section.items.length > 0);

  const isItemActive = (item) => {
    if (item.to === "/") {
      return location.pathname === "/";
    }
    return (
      location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
    );
  };

  const isSectionActive = (section) => section.items.some(isItemActive);

  useEffect(() => {
    const activeSection = visibleSections.find(isSectionActive);
    if (!activeSection || openSections[activeSection.id]) {
      return;
    }
    setOpenSections((current) => ({ ...current, [activeSection.id]: true }));
  }, [location.pathname, visibleSections, openSections]);

  const toggleSection = (sectionId) => {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  };

  const renderNavItem = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        `group flex min-h-[36px] items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
          isActive
            ? "bg-blue-500/10 text-blue-400 font-medium"
            : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/35"
        }`
      }
    >
      <item.icon className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.badge === "pendingDevices" && pendingCount > 0 && (
        <span className="ml-auto rounded-full bg-rose-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-tight text-white min-w-[18px]">
          {pendingCount > 99 ? "99+" : pendingCount}
        </span>
      )}
    </NavLink>
  );

  return (
    <aside className="relative z-10 w-64 flex flex-col bg-[#09090b]/95 backdrop-blur-xl border-r border-zinc-800/50">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800/50">
        <NavLink to="/" className="flex items-center gap-3">
          {branding.company_logo ? (
            <img
              src={branding.company_logo}
              alt="Company Logo"
              className="w-8 h-8 rounded-lg object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Building2 className="w-4 h-4 text-white" />
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-white truncate max-w-[120px]">
              {branding.appName}
            </div>
            <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
              {branding.company_name ? "NETWORK PLATFORM" : "ISP PLATFORM"}
            </div>
          </div>
        </NavLink>
        <SearchButton onClick={onSearchOpen} />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {visibleSections.map((section) => {
          const SectionIcon = section.icon;
          const open = openSections[section.id] || isSectionActive(section);

          return (
            <div key={section.id} className="rounded-lg">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  isSectionActive(section)
                    ? "text-blue-300"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
                }`}
              >
                <SectionIcon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left">{section.label}</span>
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              {open && (
                <div className="mt-1 space-y-0.5 border-l border-zinc-800/60 ml-4 pl-2">
                  {section.items.map(renderNavItem)}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-zinc-800/50 space-y-3">
        {user && (
          <div className="flex items-center gap-3 p-2 bg-zinc-800/30 rounded-lg">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-300 truncate">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {user?.email || ""}
                {user?.role ? ` (${user.role})` : ""}
              </p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-[40px_1fr] gap-2">
          <button
            onClick={() => setMode(mode === "dark" ? "light" : "dark")}
            className="flex h-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-white"
            title={
              mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"
            }
            aria-label={
              mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"
            }
          >
            {mode === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleLogout}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm text-zinc-400 transition-all hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
