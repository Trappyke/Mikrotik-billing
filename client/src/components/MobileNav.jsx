import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, DollarSign, Wifi, Menu } from "lucide-react";

const tabs = [
  { to: "/", icon: LayoutDashboard, label: "Home" },
  { to: "/billing-customers", icon: Users, label: "Customers" },
  { to: "/billing", icon: DollarSign, label: "Billing" },
  { to: "/pppoe", icon: Wifi, label: "Network" },
];

export function MobileNav({ onMenuOpen }) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#09090b]/95 backdrop-blur-xl border-t border-zinc-800/50 safe-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-medium transition-all ${
                isActive ? "text-blue-400" : "text-zinc-500"
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          onClick={onMenuOpen}
          className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-medium text-zinc-500"
        >
          <Menu className="w-5 h-5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
