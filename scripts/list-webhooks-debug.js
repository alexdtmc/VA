const axios = require('axios');
const config = require('../config');

const DIALPAD_API_BASE = 'https://dialpad.com/api/v2';

async function listWebhooks() {
  try {
    console.log('Fetching webhooks from Dialpad...');
    console.log('Using API URL:', `${DIALPAD_API_BASE}/webhooks`);
    console.log('Using Authorization Token:', `Bearer ${config.dialpad.apiToken.substring(0, 10)}...`);
    
    const response = await axios.get(
      `${DIALPAD_API_BASE}/webhooks`,
      {
        headers: {
          'Authorization': `Bearer ${config.dialpad.apiToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('Response status:', response.status);
    console.log('Full response data:', JSON.stringify(response.data, null, 2));
    
    // Try different property names that might contain webhooks
    const webhooks = response.data.webhooks || response.data.items || [];
    console.log(`Found ${webhooks.length} webhooks using standard properties`);
    
    // If no webhooks found in standard properties, look at all properties
    if (webhooks.length === 0) {
      console.log('Examining all response data properties:');
      for (const key in response.data) {
        console.log(`- ${key}: ${typeof response.data[key]}`);
        if (Array.isArray(response.data[key])) {
          console.log(`  Array length: ${response.data[key].length}`);
          
          if (response.data[key].length > 0) {
            console.log(`  First item properties: ${Object.keys(response.data[key][0]).join(', ')}`);
            webhooks = response.data[key];
            console.log(`Using ${key} as webhooks array with ${webhooks.length} items`);
          }
        }
      }
    }
    
    if (webhooks.length === 0) {
      console.log('No webhooks found in any property.');
    } else {
      console.log('\nWebhook details:');
      webhooks.forEach((webhook, index) => {
        console.log(`\nWebhook ${index + 1}:`);
        console.log(JSON.stringify(webhook, null, 2));
      });
    }
    
    // Also try to list call routers with more debugging
    try {
      console.log('\nFetching call routers...');
      console.log('Using API URL:', `${DIALPAD_API_BASE}/callrouters`);
      
      const routersResponse = await axios.get(
        `${DIALPAD_API_BASE}/callrouters`,
        {
          headers: {
            'Authorization': `Bearer ${config.dialpad.apiToken}`,
            'Accept': 'application/json'
          }
        }
      );
      
      console.log('Router response status:', routersResponse.status);
      console.log('Full router response data:', JSON.stringify(routersResponse.data, null, 2));
      
      // Try different property names
      const routers = routersResponse.data.routers || routersResponse.data.items || [];
      
      if (routers.length === 0) {
        console.log('Examining all router response data properties:');
        for (const key in routersResponse.data) {
          console.log(`- ${key}: ${typeof routersResponse.data[key]}`);
          if (Array.isArray(routersResponse.data[key])) {
            console.log(`  Array length: ${routersResponse.data[key].length}`);
            
            if (routersResponse.data[key].length > 0) {
              console.log(`  First item properties: ${Object.keys(routersResponse.data[key][0]).join(', ')}`);
            }
          }
        }
      }
      
      console.log(`\nFound ${routers.length} call routers`);
      
      if (routers.length > 0) {
        routers.forEach((router, index) => {
          console.log(`\nRouter ${index + 1}:`);
          console.log(JSON.stringify(router, null, 2));
        });
      }
    } catch (routerError) {
      console.error('Error fetching call routers:', routerError.message);
      if (routerError.response) {
        console.log('Router error details:', routerError.response.data);
      }
    }
  } catch (error) {
    console.error('Error fetching webhooks:', error.message);
    if (error.response) {
      console.log('Error status:', error.response.status);
      console.log('Error details:', error.response.data);
    }
  }
}

listWebhooks();