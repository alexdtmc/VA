const axios = require('axios');
const config = require('../config');

async function listAvailableNumbers() {
  try {
    console.log('Listing available phone numbers in Dialpad account...');
    
    // Use the documented API URL
    const DIALPAD_API_BASE = 'https://dialpad.com/api/v2';
    
    // Fetch phone numbers
    console.log('Fetching phone numbers...');
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
    
    // Log the full response to see the structure
    console.log('Full numbers response data:', JSON.stringify(numbersResponse.data, null, 2));
    
    // Try different properties that might contain the numbers
    const numbersData = numbersResponse.data;
    
    if (numbersData.items && numbersData.items.length > 0) {
      console.log(`\nFound ${numbersData.items.length} phone numbers in 'items' property:`);
      numbersData.items.forEach((num, index) => {
        console.log(`${index + 1}. Number: ${num.number || 'N/A'}, ID: ${num.id || 'N/A'}`);
      });
    } else if (numbersData.numbers && numbersData.numbers.length > 0) {
      console.log(`\nFound ${numbersData.numbers.length} phone numbers in 'numbers' property:`);
      numbersData.numbers.forEach((num, index) => {
        console.log(`${index + 1}. Number: ${num.number || 'N/A'}, ID: ${num.id || 'N/A'}`);
      });
    } else {
      console.log('No phone numbers found in the standard properties.');
      
      // List all top-level properties to help identify where numbers might be stored
      console.log('\nTop-level properties in the response:');
      Object.keys(numbersData).forEach(key => {
        const value = numbersData[key];
        if (Array.isArray(value)) {
          console.log(`- ${key}: Array with ${value.length} items`);
        } else if (typeof value === 'object' && value !== null) {
          console.log(`- ${key}: Object with keys ${Object.keys(value).join(', ')}`);
        } else {
          console.log(`- ${key}: ${value}`);
        }
      });
    }
    
    // Try to fetch from another endpoint that might have phone numbers
    console.log('\nTrying alternative endpoint for phone numbers...');
    try {
      const altResponse = await axios({
        method: 'get',
        url: `${DIALPAD_API_BASE}/phone-numbers`,
        headers: {
          'Authorization': `Bearer ${config.dialpad.apiToken}`,
          'Accept': 'application/json'
        },
        validateStatus: function (status) {
          return status < 500;
        }
      });
      
      console.log('Alternative endpoint response status:', altResponse.status);
      console.log('Alternative endpoint data:', JSON.stringify(altResponse.data, null, 2));
    } catch (altError) {
      console.log('Alternative endpoint error:', altError.message);
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.log('Error status:', error.response.status);
      console.log('Error data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

listAvailableNumbers();