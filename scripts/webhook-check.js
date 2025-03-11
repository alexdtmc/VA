const axios = require('axios');
const config = require('../config');

async function checkWebhookEndpoint() {
  try {
    console.log('Testing web requests to the Dialpad API...');
    
    // Test a simple GET endpoint first
    console.log('Fetching API information...');
    const infoResponse = await axios.get(
      'https://dialpad.com/api/v2',
      {
        headers: {
          'Authorization': `Bearer ${config.dialpad.apiToken}`
        }
      }
    );
    
    console.log('API info response status:', infoResponse.status);
    console.log('API info response data:', infoResponse.data);
    
    // Try to get user profile as another test
    console.log('\nFetching user profile...');
    try {
      const userResponse = await axios.get(
        'https://dialpad.com/api/v2/user',
        {
          headers: {
            'Authorization': `Bearer ${config.dialpad.apiToken}`
          }
        }
      );
      
      console.log('User response status:', userResponse.status);
      console.log('User details:', userResponse.data);
    } catch (userError) {
      console.error('Error fetching user profile:', userError.message);
      if (userError.response) {
        console.log('User error details:', userError.response.data);
      }
    }
    
    // Now try to directly check for webhooks with a specific query
    console.log('\nChecking webhooks with a different approach...');
    const webhooksResponse = await axios({
      method: 'get',
      url: 'https://dialpad.com/api/v2/webhooks',
      headers: {
        'Authorization': `Bearer ${config.dialpad.apiToken}`,
        'Accept': 'application/json'
      },
      validateStatus: (status) => status < 500 // Accept any non-server error status
    });
    
    console.log('Webhooks response status:', webhooksResponse.status);
    console.log('Webhooks response data:', webhooksResponse.data);
    
    // Additional tests if needed
    console.log('\nAPI token info:');
    console.log('- First 10 chars:', config.dialpad.apiToken.substring(0, 10) + '...');
    console.log('- Length:', config.dialpad.apiToken.length);
    
  } catch (error) {
    console.error('Error during API check:', error.message);
    if (error.response) {
      console.log('Error details:', error.response.data);
    }
    console.log('Full error object:', error);
  }
}

checkWebhookEndpoint();