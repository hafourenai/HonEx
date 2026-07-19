module.exports = {
  content: [
    "./src/dashboard/**/*.{html,js}"
  ],
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries")
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "background": "#f8f9ff",
        "surface": "#f8f9ff",
        "surface-dim": "#cbdbf5",
        "surface-bright": "#f8f9ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#eff4ff",
        "surface-container": "#e5eeff",
        "surface-container-high": "#dce9ff",
        "surface-container-highest": "#d3e4fe",
        "surface-variant": "#d3e4fe",
        "primary": "#004ac6",
        "primary-container": "#2563eb",
        "on-primary": "#ffffff",
        "on-primary-container": "#eeefff",
        "on-primary-fixed": "#00174b",
        "on-primary-fixed-variant": "#003ea8",
        "primary-fixed": "#dbe1ff",
        "primary-fixed-dim": "#b4c5ff",
        "inverse-primary": "#b4c5ff",
        "secondary": "#5c5f60",
        "secondary-container": "#e1e3e4",
        "secondary-fixed": "#e1e3e4",
        "secondary-fixed-dim": "#c5c7c8",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#626566",
        "on-secondary-fixed": "#191c1d",
        "on-secondary-fixed-variant": "#454748",
        "tertiary": "#4d556b",
        "tertiary-container": "#656d84",
        "tertiary-fixed": "#dae2fd",
        "tertiary-fixed-dim": "#bec6e0",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#eef0ff",
        "on-tertiary-fixed": "#131b2e",
        "on-tertiary-fixed-variant": "#3f465c",
        "error": "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",
        "inverse-surface": "#213145",
        "inverse-on-surface": "#eaf1ff",
        "outline": "#737686",
        "outline-variant": "#c3c6d7",
        "on-background": "#0b1c30",
        "on-surface": "#0b1c30",
        "on-surface-variant": "#434655",
        "surface-tint": "#0053db"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"]
      }
    }
  }
}
