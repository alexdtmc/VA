const axios = require('axios');
const config = require('../config');

const DIALPAD_API_BASE = 'https://dialpad.com/api/v2';
const WEBHOOK_ID = '5030715509751808';  // Your current webhook ID

async function checkWebhook() {
  try {
    console.log(`Checking webhook ID: ${WEBHOOK_ID}`);
    
    const response = await axios.get(
      `${DIALPAD_API_BASE}/webhooks/${WEBHOOK_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${config.dialpad.apiToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('Webhook details:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Check if this webhook has the necessary subscriptions
    const subscriptions = response.data.subscriptions || [];
    const requiredEvents = [
      'call.ringing', 
      'call.connected', 
      'call.hangup', 
      'call.speech_recognition'
    ];
    
    console.log('\nSubscription check:');
    requiredEvents.forEach(event => {
      console.log(`- ${event}: ${subscriptions.includes(event) ? '✓' : '✗'}`);
    });
    
  } catch (error) {
    console.error('Error checking webhook:', error.message);
    
    if (error.response) {
      console.log('Error details:', error.response.data);
    }
  }
}

checkWebhook();