// Live services require an explicit opt-in; credentials alone never enable them.
export const isMockMode = process.env.NEXT_PUBLIC_DATA_MODE !== "supabase";
