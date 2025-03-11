const axios = require('axios');
const config = require('../config');

async function assignNumberToRouter() {
  try {
    console.log('Assigning phone number to call router...');
    
    // Use the documented API URL
    const DIALPAD_API_BASE = 'https://dialpad.com/api/v2';
    
    // Router ID from previous script output
    const routerId = '5983474916573184';
    
    console.log(`Using router ID: ${routerId}`);
    
    // First, let's get available phone numbers
    console.log('Fetching available phone numbers...');
    const numbersResponse = await axios({
      method: 'get',
      url: `${DIALPAD_API_BASE}/numbers`,
      headers: {
        'Authorization': `Bearer ${config.dialpad.apiToken}`,
        'Accept': 'application/json'
      },
      validateStatus: function (status) {
        return status < 500; // Accept all non-server errors
      }
    });
    
    console.log('Numbers response status:', numbersResponse.status);
    
    // Find phone numbers
    const numbersData = numbersResponse.data;
    if ((!numbersData.items || numbersData.items.length === 0) && 
        (!numbersData.numbers || numbersData.numbers.length === 0)) {
      console.error('No available phone numbers found.');
      return;
    }
    
    // Get the first available number
    let phoneNumberId = null;
    let phoneNumber = null;
    
    if (numbersData.items && numbersData.items.length > 0) {
      phoneNumberId = numbersData.items[0].id;
      phoneNumber = numbersData.items[0].number;
    } else if (numbersData.numbers && numbersData.numbers.length > 0) {
      phoneNumberId = numbersData.numbers[0].id;
      phoneNumber = numbersData.numbers[0].number;
    }
    
    if (!phoneNumberId) {
      console.error('Could not find a phone number ID.');
      return;
    }
    
    console.log(`Found phone number: ${phoneNumber} (ID: ${phoneNumberId})`);
    
    // Assign number to router
    console.log('Assigning number to call router...');
    const assignResponse = await axios({
      method: 'post',
      url: `${DIALPAD_API_BASE}/callrouters/${routerId}/assign_number`,
      headers: {
        'Authorization': `Bearer ${config.dialpad.apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: {
        number_id: phoneNumberId
      },
      timeout: 30000,
      validateStatus: function (status) {
        return status < 500;
      }
    });
    
    console.log('Assignment response status:', assignResponse.status);
    console.log('Assignment response data:', JSON.stringify(assignResponse.data, null, 2));
    
    if (assignResponse.status === 200 || assignResponse.status === 201) {
      console.log(`Successfully assigned number ${phoneNumber} to call router!`);
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