const axios = require('axios');
const config = require('../config');

const DIALPAD_API_BASE = 'https://dialpad.com/api/v2';
const WEBHOOK_ID = '5030715509751808';  // Your current webhook ID

async function createCallEventSubscriptions() {
  try {
    console.log(`Creating call event subscriptions for webhook ID: ${WEBHOOK_ID}`);
    
    // Required events
    const callEvents = [
      'call.ringing', 
      'call.connected', 
      'call.hangup', 
      'call.speech_recognition'
    ];
    
    // Create each subscription
    for (const event of callEvents) {
      console.log(`Creating subscription for event: ${event}`);
      
      try {
        const response = await axios.post(
          `${DIALPAD_API_BASE}/subscriptions/call`,
          {
            call_states: [event],
            enabled: true,
            endpoint_id: WEBHOOK_ID
          },
          {
            headers: {
              'Authorization': `Bearer ${config.dialpad.apiToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          }
        );
        
        console.log(`Successfully subscribed to ${event}:`);
        console.log(`  ID: ${response.data.id}`);
        console.log(`  Status: ${response.status}`);
      } catch (eventError) {
        console.error(`Error subscribing to ${event}:`, eventError.message);
        if (eventError.response) {
          console.log('  Error status:', eventError.response.status);
          console.log('  Error details:', JSON.stringify(eventError.response.data, null, 2));
        }
      }
    }
    
    console.log('\nAll subscriptions created successfully!');
    console.log('The webhook should now receive call event notifications.');
    
  } catch (error) {
    console.error('Error creating call event subscriptions:', error.message);
    
    if (error.response) {
      console.log('Error status:', error.response.status);
      console.log('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

createCallEventSubscriptions();