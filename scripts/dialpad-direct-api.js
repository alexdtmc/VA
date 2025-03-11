const axios = require('axios');
const config = require('../config');

// Updated API endpoint based on Dialpad's documentation
const DIALPAD_API_BASE = 'https://api.dialpad.com/v2';

async function directApiAccess() {
  try {
    console.log('Attempting to access Dialpad API directly...');
    
    // 1. Test API access by querying available endpoints
    const apiResponse = await axios({
      method: 'get',
      url: `${DIALPAD_API_BASE}/webhooks`,
      headers: {
        'Authorization': `Bearer ${config.dialpad.apiToken}`,
        'Content-Type': 'application/json'
      },
      validateStatus: function (status) {
        return status < 500; // Accept any non-server error status for debugging
      }
    });
    
    console.log('API Response Status:', apiResponse.status);
    console.log('API Response Data:', apiResponse.data);
    
    // 2. If successful, try to create a webhook
    if (apiResponse.status === 200) {
      console.log('\nAttempting to create a webhook...');
      
      const webhookResponse = await axios({
        method: 'post',
        url: `${DIALPAD_API_BASE}/webhooks`,
        headers: {
          'Authorization': `Bearer ${config.dialpad.apiToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Moving Company Assistant',
          hook_url: config.dialpad.webhookUrl,
          subscriptions: [
            'call.ringing', 
            'call.connected', 
            'call.hangup', 
            'call.speech_recognition'
          ]
        },
        validateStatus: function (status) {
          return status < 500; // Accept any non-server error status for debugging
        }
      });
      
      console.log('Webhook Creation Status:', webhookResponse.status);
      console.log('Webhook Creation Response:', webhookResponse.data);
      
      // 3. If webhook creation is successful, create a call router
      if (webhookResponse.status === 200 || webhookResponse.status === 201) {
        const webhookId = webhookResponse.data.id;
        console.log(`\nAttempting to create call router with webhook ID: ${webhookId}`);
        
        const routerResponse = await axios({
          method: 'post',
          url: `${DIALPAD_API_BASE}/callrouters`,
          headers: {
            'Authorization': `Bearer ${config.dialpad.apiToken}`,
            'Content-Type': 'application/json'
          },
          data: {
            name: 'Moving Company Assistant Router',
            enabled: true,
            routing_url: config.dialpad.webhookUrl,
            webhook_id: webhookId,
            handle_manually: true
          },
          validateStatus: function (status) {
            return status < 500; // Accept any non-server error status for debugging
          }
        });
        
        console.log('Call Router Creation Status:', routerResponse.status);
        console.log('Call Router Creation Response:', routerResponse.data);
      }
    }
  } catch (error) {
    console.error('Error accessing Dialpad API:', error.message);
    if (error.response) {
      console.log('Error status:', error.response.status);
      console.log('Error data:', error.response.data);
    }
  }
}

directApiAccess();