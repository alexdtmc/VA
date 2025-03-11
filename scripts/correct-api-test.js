const axios = require('axios');
const config = require('../config');

// Correct API base URL from the documentation
const DIALPAD_API_BASE = 'https://dialpad.com/api/v2';

async function correctApiTest() {
  try {
    console.log('Testing Dialpad API with correct URL...');
    console.log(`Using API URL: ${DIALPAD_API_BASE}`);
    
    // Test listing webhooks
    console.log('\nAttempting to list webhooks...');
    const listResponse = await axios({
      method: 'get',
      url: `${DIALPAD_API_BASE}/webhooks`,
      headers: {
        'Authorization': `Bearer ${config.dialpad.apiToken}`,
        'Accept': 'application/json'
      },
      validateStatus: function (status) {
        return true; // Accept any status for debugging
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log(`List webhooks status: ${listResponse.status}`);
    console.log(`Response: ${JSON.stringify(listResponse.data, null, 2)}`);
    
    // If we can list webhooks successfully, try to create one
    if (listResponse.status === 200) {
      console.log('\nAttempting to create a webhook...');
      
      const createResponse = await axios({
        method: 'post',
        url: `${DIALPAD_API_BASE}/webhooks`,
        headers: {
          'Authorization': `Bearer ${config.dialpad.apiToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
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
          return true; // Accept any status for debugging
        },
        timeout: 10000
      });
      
      console.log(`Create webhook status: ${createResponse.status}`);
      console.log(`Response: ${JSON.stringify(createResponse.data, null, 2)}`);
      
      // If the webhook was created or already exists, try to create a call router
      if (createResponse.status === 200 || createResponse.status === 201 || createResponse.status === 409) {
        // Get webhook ID from the response or use the existing one
        let webhookId;
        
        if (createResponse.status === 409) {
          // If webhook already exists, try to get its ID
          console.log('Webhook already exists, trying to find it...');
          
          // Look through the list response to find the webhook with our URL
          const existingWebhook = listResponse.data.webhooks?.find(
            hook => hook.hook_url === config.dialpad.webhookUrl
          );
          
          if (existingWebhook) {
            webhookId = existingWebhook.id;
            console.log(`Found existing webhook with ID: ${webhookId}`);
          } else {
            console.log('Could not find existing webhook ID. Please check manually.');
          }
        } else if (createResponse.data && createResponse.data.id) {
          webhookId = createResponse.data.id;
          console.log(`New webhook created with ID: ${webhookId}`);
        }
        
        // If we have a webhook ID, create a call router
        if (webhookId) {
          console.log('\nAttempting to create call router...');
          
          const routerResponse = await axios({
            method: 'post',
            url: `${DIALPAD_API_BASE}/callrouters`,
            headers: {
              'Authorization': `Bearer ${config.dialpad.apiToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            data: {
              name: 'Moving Company Assistant Router',
              enabled: true,
              routing_url: config.dialpad.webhookUrl,
              webhook_id: webhookId,
              handle_manually: true
            },
            validateStatus: function (status) {
              return true; // Accept any status for debugging
            },
            timeout: 10000
          });
          
          console.log(`Create call router status: ${routerResponse.status}`);
          console.log(`Response: ${JSON.stringify(routerResponse.data, null, 2)}`);
        }
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

correctApiTest();