const axios = require('axios');
const config = require('../config');

async function testRootWebhook() {
  try {
    console.log('Testing root webhook...');
    
    // Extract base URL
    const baseUrl = config.dialpad.webhookUrl.split('/').slice(0, 3).join('/');
    console.log(`Sending test to: ${baseUrl}`);
    
    // Create a test payload similar to what Dialpad sends
    const testPayload = {
      date_started: Date.now(),
      call_id: `test-${Date.now()}`,
      external_number: "+13053432775",
      internal_number: "+15617786467",
      contact_id: null,
      contact_type: "contact",
      master_call_id: null
    };
    
    console.log('Test payload:', testPayload);
    
    const response = await axios.post(baseUrl, testPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.log('Error status:', error.response.status);
      console.log('Error data:', error.response.data);
    }
  }
}

testRootWebhook();
