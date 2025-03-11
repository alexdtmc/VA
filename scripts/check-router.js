const axios = require('axios');
const config = require('../config');

async function checkRouterDetails() {
  try {
    console.log('Checking call router configuration...');
    
    const DIALPAD_API_BASE = 'https://dialpad.com/api/v2';
    const routerId = '5983474916573184';
    
    const response = await axios({
      method: 'get',
      url: `${DIALPAD_API_BASE}/callrouters/${routerId}`,
      headers: {
        'Authorization': `Bearer ${config.dialpad.apiToken}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('Call router details:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Check critical settings
    const router = response.data;
    console.log('\nVerification:');
    console.log(`- Enabled: ${router.enabled ? '✓' : '✗'}`);
    console.log(`- Webhook URL correct: ${router.routing_url === config.dialpad.webhookUrl ? '✓' : '✗'}`);
    console.log(`- Has phone number: ${(router.phone_numbers && router.phone_numbers.length > 0) ? '✓' : '✗'}`);
    if (router.phone_numbers && router.phone_numbers.length > 0) {
      console.log(`- Phone number: ${router.phone_numbers[0]}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.log('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkRouterDetails();