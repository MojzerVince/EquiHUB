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

interface SMSRequest {
  userId: string;
  message: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  emergencyType: 'fall_detection' | 'manual_emergency' | 'test';
  timestamp: number;
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
    const requestBody: SMSRequest = await req.json()
    const { userId, message, location, emergencyType, timestamp } = requestBody

    console.log(`🚨 Processing emergency SMS for user ${userId}, type: ${emergencyType}`)

    // Get user's emergency contacts
    const { data: contacts, error: contactsError } = await supabaseClient
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_enabled', true)

    if (contactsError) {
      console.error('Error fetching emergency contacts:', contactsError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          sentCount: 0, 
          error: 'Failed to fetch emergency contacts' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    if (!contacts || contacts.length === 0) {
      console.log('No emergency contacts found for user')
      return new Response(
        JSON.stringify({ 
          success: false, 
          sentCount: 0, 
          error: 'No emergency contacts configured' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Prepare final message with location
    let finalMessage = message
    if (location) {
      const locationUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`
      finalMessage += `\n\nLocation: ${locationUrl}`
    }

    // Create SMS log entry
    const { data: smsLog, error: logError } = await supabaseClient
      .from('emergency_sms_log')
      .insert({
        user_id: userId,
        message_text: finalMessage,
        emergency_type: emergencyType,
        location_latitude: location?.latitude,
        location_longitude: location?.longitude,
        contacts_count: contacts.length,
        sent_count: 0,
        success: false
      })
      .select()
      .single()

    if (logError) {
      console.error('Error creating SMS log:', logError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          sentCount: 0, 
          error: 'Failed to log SMS request' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    // Send SMS to each contact using Twilio (you can replace with your preferred SMS provider)
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioFromNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

    if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
      console.error('Twilio credentials not configured')
      return new Response(
        JSON.stringify({ 
          success: false, 
          sentCount: 0, 
          error: 'SMS service not configured' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    let successCount = 0
    const deliveryStatuses = []

    // Send SMS to each contact
    for (const contact of contacts) {
      try {
        console.log(`📱 Sending SMS to ${contact.name} (${contact.phone_number})`)

        // Twilio API call
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`
        
        const formData = new URLSearchParams()
        formData.append('To', contact.phone_number)
        formData.append('From', twilioFromNumber)
        formData.append('Body', finalMessage)

        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(twilioAccountSid + ':' + twilioAuthToken)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        })

        const result = await response.json()

        if (response.ok && result.sid) {
          console.log(`✅ SMS sent successfully to ${contact.name}, SID: ${result.sid}`)
          successCount++

          // Create delivery status record
          deliveryStatuses.push({
            emergency_sms_log_id: smsLog.id,
            phone_number: contact.phone_number,
            contact_name: contact.name,
            status: 'sent',
            provider_message_id: result.sid,
            sent_at: new Date().toISOString()
          })
        } else {
          console.error(`❌ Failed to send SMS to ${contact.name}:`, result)
          
          // Create failed delivery status record
          deliveryStatuses.push({
            emergency_sms_log_id: smsLog.id,
            phone_number: contact.phone_number,
            contact_name: contact.name,
            status: 'failed',
            error_message: result.message || 'Unknown error'
          })
        }
      } catch (error) {
        console.error(`❌ Error sending SMS to ${contact.name}:`, error)
        
        // Create failed delivery status record
        deliveryStatuses.push({
          emergency_sms_log_id: smsLog.id,
          phone_number: contact.phone_number,
          contact_name: contact.name,
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Network error'
        })
      }
    }

    // Insert delivery status records
    if (deliveryStatuses.length > 0) {
      const { error: statusError } = await supabaseClient
        .from('sms_delivery_status')
        .insert(deliveryStatuses)

      if (statusError) {
        console.error('Error inserting delivery status:', statusError)
      }
    }

    // Update SMS log with results
    const { error: updateError } = await supabaseClient
      .from('emergency_sms_log')
      .update({
        sent_count: successCount,
        success: successCount > 0,
        error_message: successCount === 0 ? 'Failed to send to all contacts' : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', smsLog.id)

    if (updateError) {
      console.error('Error updating SMS log:', updateError)
    }

    const response = {
      success: successCount > 0,
      sentCount: successCount,
      messageId: smsLog.id,
      error: successCount === 0 ? 'Failed to send SMS to any contacts' : undefined
    }

    console.log(`📊 SMS sending complete: ${successCount}/${contacts.length} successful`)

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Error in send-emergency-sms function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        sentCount: 0, 
        error: 'Internal server error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
