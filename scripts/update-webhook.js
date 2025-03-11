const axios = require('axios');
const config = require('../config');

const DIALPAD_API_BASE = 'https://dialpad.com/api/v2';
const WEBHOOK_ID = '5030715509751808';  // Your current webhook ID

async function updateWebhook() {
  try {
    console.log(`Updating webhook ID: ${WEBHOOK_ID}`);
    
    // Required events
    const requiredEvents = [
      'call.ringing', 
      'call.connected', 
      'call.hangup', 
      'call.speech_recognition'
    ];
    
    console.log('Adding subscriptions:', requiredEvents);
    
    const response = await axios.patch(
      `${DIALPAD_API_BASE}/webhooks/${WEBHOOK_ID}`,
      {
        subscriptions: requiredEvents,
        name: 'Moving Company Assistant'  // Add a name for better identification
      },
      {
        headers: {
          'Authorization': `Bearer ${config.dialpad.apiToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('Update response status:', response.status);
    console.log('Updated webhook details:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Verify the update
    console.log('\nVerifying subscriptions:');
    const subscriptions = response.data.subscriptions || [];
    requiredEvents.forEach(event => {
      console.log(`- ${event}: ${subscriptions.includes(event) ? '✓' : '✗'}`);
    });
    
    console.log('\nWebhook has been updated with call event subscriptions!');
    
  } catch (error) {
    console.error('Error updating webhook:', error.message);
    
    if (error.response) {
      console.log('Error status:', error.response.status);
      console.log('Error details:', error.response.data);
    }
  }
}

updateWebhook();