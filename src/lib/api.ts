import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const fredApi = {
  async search(query: string) {
    const { data, error } = await supabase.functions.invoke("fetch-fred", {
      body: {},
      method: "GET",
    });

    if (error) throw error;
    return data;
  },

  async ingest(seriesId: string) {
    const url = `${SUPABASE_URL}/functions/v1/fetch-fred?action=ingest&seriesId=${seriesId}`;
    const response = await fetch(url);
    
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
    const response = await fetch(url);
    
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
