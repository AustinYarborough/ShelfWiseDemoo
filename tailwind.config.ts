import type { Config } from "tailwindcss";
const config: Config = { content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"], theme: { extend: { colors: { ink: "#17191d", muted: "#727780", line: "#e9eaed", accent: "#4169e1" }, boxShadow: { soft: "0 2px 8px rgba(20, 24, 35, .04)" } } }, plugins: [] };
export default config;
