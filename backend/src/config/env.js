export const env = {
  port: Number(process.env.PORT || 5000),
  pdcApiUrl: process.env.PDC_API_URL || "https://pdcapi.io",
  pdcOrigin: process.env.PDC_ORIGIN || "https://dashboard.bz",
  pdcToken: process.env.PDC_TOKEN || "",
  defaultMonthlyPrice: Number(process.env.DEFAULT_MONTHLY_PRICE || 30)
};
