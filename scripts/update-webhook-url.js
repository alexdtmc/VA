const axios = require('axios');
const config = require('../config');

async function updateRouterUrl() {
  try {
    console.log('Updating call router webhook URL...');
    
    const DIALPAD_API_BASE = 'https://dialpad.com/api/v2';
    const routerId = '5983474916573184';
    const webhookUrl = config.dialpad.webhookUrl;
    
    console.log(`Router ID: ${routerId}`);
    console.log(`New webhook URL: ${webhookUrl}`);
    
    const response = await axios({
      method: 'patch',
      url: `${DIALPAD_API_BASE}/callrouters/${routerId}`,
      headers: {
        'Authorization': `Bearer ${config.dialpad.apiToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        routing_url: webhookUrl
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Updated router details:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.log('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

updateRouterUrl();