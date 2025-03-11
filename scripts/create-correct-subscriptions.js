const axios = require('axios');
const config = require('../config');

const DIALPAD_API_BASE = 'https://dialpad.com/api/v2';
const WEBHOOK_ID = '5030715509751808';  // Your current webhook ID

async function createCallEventSubscriptions() {
  try {
    console.log(`Creating call event subscriptions for webhook ID: ${WEBHOOK_ID}`);
    
    // Correct call states according to the documentation
    const callStates = [
      'ringing', 
      'connected', 
      'hangup',
      'recap_summary'  // Adding this to capture speech recognition results
    ];
    
    // Create subscriptions for all call states at once
    console.log('Creating subscription for all call states...');
    
    try {
      const response = await axios.post(
        `${DIALPAD_API_BASE}/subscriptions/call`,
        {
          call_states: callStates,
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
      
      console.log('Subscription created successfully:');
      console.log(`  ID: ${response.data.id}`);
      console.log(`  Status: ${response.status}`);
      console.log(`  Subscribed to states: ${callStates.join(', ')}`);
    } catch (error) {
      console.error('Error creating subscription:', error.message);
      if (error.response) {
        console.log('  Error status:', error.response.status);
        console.log('  Error details:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
    console.log('\nSubscriptions setup completed!');
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