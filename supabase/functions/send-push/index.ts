// Supabase Edge Function: send-push
// Dispatches FCM Web Push notifications from Supabase Database Triggers or Webhooks
// Follows Deno / Supabase Edge Functions runtime

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { technician_id, title, body, jobId, url, type = "JOB_EVENT" } = await req.json();

    if (!technician_id || !title || !body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Vercel Serverless FCM API or Firebase REST API
    const vercelApiUrl = Deno.env.get("VERCEL_APP_URL") || Deno.env.get("APP_URL");
    if (vercelApiUrl) {
      const response = await fetch(`${vercelApiUrl}/api/push/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technician_id, title, body, jobId, url, type }),
      });
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Push trigger handled by Supabase Edge Function" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
