import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "/api";

const defaults = {
  company_name: "",
  company_logo: "",
  primary_color: "#3b82f6",
  secondary_color: "#1e293b",
  branding_title: "",
};

const BrandingContext = createContext(defaults);

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(defaults);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    // Read branding from tenant settings (single source of truth)
    axios
      .get(`${API}/tenants/current`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        setBranding({
          company_name: data.company_name || "",
          company_logo: data.logo_url || "",
          primary_color: data.primary_color || "#3b82f6",
          secondary_color: data.secondary_color || "#1e293b",
          branding_title: data.company_name || "",
        });
      })
      .catch((e) => {
        console.error(
          "BrandingContext: Failed to load tenant branding",
          e.message,
        );
      });
  }, []);

  const appName =
    branding.branding_title || branding.company_name || "MikroTik Billing";

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--brand-primary",
      branding.primary_color,
    );
    document.documentElement.style.setProperty(
      "--brand-secondary",
      branding.secondary_color,
    );
  }, [branding.primary_color, branding.secondary_color]);

  return (
    <BrandingContext.Provider value={{ ...branding, appName }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
