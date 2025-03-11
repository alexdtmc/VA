const axios = require('axios');
const config = require('../config');

const DIALPAD_API_BASE = 'https://dialpad.com/api/v2';

async function listWebhooks() {
  try {
    console.log('Fetching webhooks from Dialpad...');
    
    const response = await axios.get(
      `${DIALPAD_API_BASE}/webhooks`,
      {
        headers: {
          'Authorization': `Bearer ${config.dialpad.apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const webhooks = response.data.webhooks || [];
    console.log(`Found ${webhooks.length} webhooks:\n`);
    
    if (webhooks.length === 0) {
      console.log('No webhooks found.');
    } else {
      webhooks.forEach(webhook => {
        console.log(`ID: ${webhook.id}`);
        console.log(`Name: ${webhook.name}`);
        console.log(`URL: ${webhook.hook_url}`);
        console.log(`Events: ${webhook.subscriptions?.join(', ')}`);
        console.log('-------------------');
      });
    }
    
    // Also try to list call routers
    try {
      console.log('\nFetching call routers...');
      
      const routersResponse = await axios.get(
        `${DIALPAD_API_BASE}/callrouters`,
        {
          headers: {
            'Authorization': `Bearer ${config.dialpad.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const routers = routersResponse.data.routers || [];
      console.log(`Found ${routers.length} call routers:\n`);
      
      if (routers.length === 0) {
        console.log('No call routers found.');
      } else {
        routers.forEach(router => {
          console.log(`ID: ${router.id}`);
          console.log(`Name: ${router.name}`);
          console.log(`Enabled: ${router.enabled}`);
          console.log(`Webhook ID: ${router.webhook_id}`);
          console.log('-------------------');
        });
      }
    } catch (routerError) {
      console.error('Error fetching call routers:', routerError.message);
    }
    
  } catch (error) {
    console.error('Error fetching webhooks:', error.message);
    
    if (error.response) {
      console.log('Error details:', error.response.data);
    }
  }
}

listWebhooks();