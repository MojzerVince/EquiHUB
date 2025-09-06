// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Global types for Deno environment
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Parse request body
    const { messageId } = await req.json()

    if (!messageId) {
      return new Response(
        JSON.stringify({ 
          status: 'failed', 
          error: 'Message ID is required' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    console.log(`📋 Checking SMS status for message ID: ${messageId}`)

    // Get SMS log and delivery status
    const { data: smsLog, error: logError } = await supabaseClient
      .from('emergency_sms_log')
      .select(`
        *,
        sms_delivery_status (*)
      `)
      .eq('id', messageId)
      .single()

    if (logError) {
      console.error('Error fetching SMS log:', logError)
      return new Response(
        JSON.stringify({ 
          status: 'failed', 
          error: 'SMS log not found' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      )
    }

    // Determine overall status
    let overallStatus = 'pending'
    let deliveredCount = 0
    let failedCount = 0
    let sentCount = 0

    if (smsLog.sms_delivery_status) {
      for (const status of smsLog.sms_delivery_status) {
        switch (status.status) {
          case 'delivered':
            deliveredCount++
            break
          case 'failed':
            failedCount++
            break
          case 'sent':
            sentCount++
            break
        }
      }

      // Determine overall status
      if (deliveredCount > 0) {
        overallStatus = 'delivered'
      } else if (sentCount > 0) {
        overallStatus = 'sent'
      } else if (failedCount === smsLog.sms_delivery_status.length) {
        overallStatus = 'failed'
      }
    }

    const response = {
      status: overallStatus,
      timestamp: new Date(smsLog.created_at).getTime(),
      sentCount: smsLog.sent_count,
      totalContacts: smsLog.contacts_count,
      deliveredCount,
      failedCount,
      details: smsLog.sms_delivery_status?.map((status: any) => ({
        phoneNumber: status.phone_number,
        contactName: status.contact_name,
        status: status.status,
        sentAt: status.sent_at,
        deliveredAt: status.delivered_at,
        error: status.error_message
      }))
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Error in get-sms-status function:', error)
    return new Response(
      JSON.stringify({ 
        status: 'failed', 
        error: 'Internal server error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
