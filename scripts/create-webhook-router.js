const axios = require('axios');
const config = require('../config');

const DIALPAD_API_BASE = 'https://dialpad.com/api/v2';

// Add a path to the webhook URL to make it unique
const uniqueWebhookUrl = `${config.dialpad.webhookUrl}/unique-${Date.now()}`;
console.log(`Using unique webhook URL: ${uniqueWebhookUrl}`);

async function createWebhookAndRouter() {
  try {
    // Step 1: Create webhook
    console.log('Creating webhook...');
    const webhookResponse = await axios.post(
      `${DIALPAD_API_BASE}/webhooks`,
      {
        name: `Moving Company Assistant ${Date.now()}`,
        hook_url: uniqueWebhookUrl,
        subscriptions: [
          'call.ringing', 
          'call.connected', 
          'call.hangup', 
          'call.speech_recognition'
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${config.dialpad.apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Webhook Response:', webhookResponse.data);
    const webhookId = webhookResponse.data.id;
    console.log(`Webhook created with ID: ${webhookId}`);
    
    // Step 2: Create call router
    console.log('Creating call router...');
    const routerResponse = await axios.post(
      `${DIALPAD_API_BASE}/callrouters`,
      {
        name: `Moving Company Router ${Date.now()}`,
        enabled: true,
        routing_url: uniqueWebhookUrl,
        webhook_id: webhookId,
        handle_manually: true
      },
      {
        headers: {
          'Authorization': `Bearer ${config.dialpad.apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Router Response:', routerResponse.data);
    console.log('Setup complete!');
    
    // Return for reference
    return {
      webhookId: webhookId,
      webhookUrl: uniqueWebhookUrl,
      routerId: routerResponse.data.id
    };
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.log('Error details:', error.response.data);
    }
    
    // Print full error for debugging
    console.log('Full error object:', error);
  }
}

createWebhookAndRouter()
  .then(result => {
    if (result) {
      console.log('\nSummary:');
      console.log(`Webhook ID: ${result.webhookId}`);
      console.log(`Webhook URL: ${result.webhookUrl}`);
      console.log(`Router ID: ${result.routerId}`);
      
      console.log('\nUpdate your .env file with:');
      console.log(`WEBHOOK_URL=${result.webhookUrl}`);
    }
  });