const axios = require('axios');
const config = require('../config');

async function assignNumberToRouter() {
  try {
    console.log('Assigning phone number to call router...');
    
    // Use the documented API URL
    const DIALPAD_API_BASE = 'https://dialpad.com/api/v2';
    
    // Router ID from previous script output
    const routerId = '5983474916573184';
    
    // Use the available number from our previous check
    const phoneNumber = "+15617786467";
    
    console.log(`Using router ID: ${routerId}`);
    console.log(`Attempting to assign phone number: ${phoneNumber}`);
    
    // Build the URL exactly as shown in the documentation
    const url = `${DIALPAD_API_BASE}/callrouters/${routerId}/assign_number`;
    
    console.log(`Request URL: ${url}`);
    
    // Create headers similar to the example
    const headers = {
      'Authorization': `Bearer ${config.dialpad.apiToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    
    console.log('Headers:', headers);
    
    // Make the request with minimal configuration
    const assignResponse = await axios.post(url, null, { headers });
    
    console.log('Assignment response status:', assignResponse.status);
    console.log('Assignment response data:', JSON.stringify(assignResponse.data, null, 2));
    
    if (assignResponse.status === 200 || assignResponse.status === 201) {
      console.log(`Successfully assigned number to call router!`);
    } else {
      console.log('Number assignment failed with status:', assignResponse.status);
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.log('Error status:', error.response.status);
      console.log('Error data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

assignNumberToRouter();