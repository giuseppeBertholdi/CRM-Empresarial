export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-secret-change-in-production",
  REDIS_URL: process.env.REDIS_URL,
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME ?? "crm_session",
  WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION ?? "v21.0",
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  WHATSAPP_WEBHOOK_VERIFY_TOKEN:
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "",
  SUPABASE_URL:
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY:
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
};
