import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const fredApi = {
  async search(query: string) {
    const url = `${SUPABASE_URL}/functions/v1/fetch-fred?action=search&query=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to search series");
    }
    
    return await response.json();
  },

  async ingest(seriesId: string) {
    const url = `${SUPABASE_URL}/functions/v1/fetch-fred?action=ingest&seriesId=${seriesId}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to ingest series");
    }
    
    return await response.json();
  },
};

export const statfinApi = {
  async listDatabases() {
    const url = `${SUPABASE_URL}/functions/v1/fetch-statfin?action=databases`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to list databases");
    }
    
    return await response.json();
  },

  async ingest(tablePath: string, query: any) {
    const url = `${SUPABASE_URL}/functions/v1/fetch-statfin?action=ingest&tablePath=${encodeURIComponent(
      tablePath
    )}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ query }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to ingest table");
    }
    
    return await response.json();
  },
};
