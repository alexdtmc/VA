const axios = require('axios');
const config = require('../config');

// Correct API endpoint based on Dialpad's documentation
const DIALPAD_API_BASE = 'https://dialpad.com/api/v2';

// Add retry functionality with delay
async function retryRequest(fn, maxRetries = 3, delay = 2000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}...`);
      return await fn();
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        console.log(`Waiting ${delay/1000} seconds before retrying...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Increase delay for next attempt (exponential backoff)
        delay *= 1.5;
      }
    }
  }
  
  throw lastError;
}

async function setupDialpad() {
  try {
    console.log('Starting Dialpad configuration setup...');
    console.log(`Using API URL: ${DIALPAD_API_BASE}`);
    console.log(`Using webhook URL: ${config.dialpad.webhookUrl}`);
    
    // 1. Check if webhook already exists
    console.log('Checking for existing webhooks...');
    try {
      const existingWebhooks = await axios.get(
        `${DIALPAD_API_BASE}/webhooks`,
        {
          headers: {
            'Authorization': `Bearer ${config.dialpad.apiToken}`,
            'Accept': 'application/json'
          }
        }
      );
      
      console.log(`Found ${existingWebhooks.data.webhooks?.length || 0} existing webhooks`);
      
      // Check if our webhook already exists
      const existingWebhook = existingWebhooks.data.webhooks?.find(
        hook => hook.hook_url === config.dialpad.webhookUrl
      );
      
      if (existingWebhook) {
        console.log(`Found existing webhook with ID: ${existingWebhook.id}`);
        return setupCallRouter(existingWebhook.id);
      }
    } catch (error) {
      console.log('Error checking existing webhooks, will try to create a new one:', error.message);
    }
    
    // 2. Configure webhook with retry logic
    console.log('Creating webhook subscription...');
    const createWebhook = async () => {
      return await axios.post(
        `${DIALPAD_API_BASE}/webhooks`,
        {
          name: 'Moving Company Assistant',
          hook_url: config.dialpad.webhookUrl,
          subscriptions: [
            'call.ringing', 
            'call.connected', 
            'call.hangup', 
            'call.speech_recognition'
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${config.dialpad.apiToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000 // Set timeout to 10 seconds
        }
      );
    };
    
    try {
      const webhookResponse = await retryRequest(createWebhook);
      const webhookId = webhookResponse.data.id;
      console.log(`Webhook created with ID: ${webhookId}`);
      
      // Continue with setting up call router
      await setupCallRouter(webhookId);
    } catch (webhookError) {
      // If we get a 409 conflict error, try to get the existing webhook ID
      if (webhookError.response && webhookError.response.status === 409) {
        console.log('Webhook already exists, trying to find it...');
        
        try {
          // Try to list webhooks again
          const existingWebhooks = await axios.get(
            `${DIALPAD_API_BASE}/webhooks`,
            {
              headers: {
                'Authorization': `Bearer ${config.dialpad.apiToken}`,
                'Accept': 'application/json'
              }
            }
          );
          
          // Find the webhook by URL
          const existingWebhook = existingWebhooks.data.webhooks?.find(
            hook => hook.hook_url === config.dialpad.webhookUrl
          );
          
          if (existingWebhook) {
            console.log(`Found existing webhook with ID: ${existingWebhook.id}`);
            await setupCallRouter(existingWebhook.id);
          } else {
            console.error('Could not find the webhook even though it exists. Please check the Dialpad admin console.');
            throw new Error('Could not determine webhook ID');
          }
        } catch (secondError) {
          console.error('Error finding existing webhook:', secondError.message);
          throw webhookError;
        }
      } else {
        // For other errors, just rethrow
        throw webhookError;
      }
    }
  } catch (error) {
    console.error('Error setting up Dialpad configuration:', error.message);
    
    if (error.response) {
      console.log('Error details:', error.response.data);
    }
    
    console.log('\nSuggested manual steps:');
    console.log('1. Log in to your Dialpad admin console');
    console.log('2. Go to "Settings" > "Integrations" > "Webhooks"');
    console.log('3. Create a new webhook:');
    console.log(`   - Name: Moving Company Assistant`);
    console.log(`   - URL: ${config.dialpad.webhookUrl}`);
    console.log('   - Events: call.ringing, call.connected, call.hangup, call.speech_recognition');
    console.log('4. Go to "Settings" > "Call Routing"');
    console.log('5. Create a new call router:');
    console.log('   - Name: Moving Company Assistant Router');
    console.log('   - Enable: Yes');
    console.log('   - Connect to: Webhook');
    console.log('   - Select the webhook you created');
    console.log('   - Enable "Handle Call Manually"');
    console.log('6. Assign the router to your phone number');
  }
}

async function setupCallRouter(webhookId) {
  try {
    // Set up call router
    console.log('Creating call router...');
    const createRouter = async () => {
      return await axios.post(
        `${DIALPAD_API_BASE}/callrouters`,
        {
          name: 'Moving Company Assistant Router',
          enabled: true,
          routing_url: config.dialpad.webhookUrl,
          webhook_id: webhookId,
          handle_manually: true
        },
        {
          headers: {
            'Authorization': `Bearer ${config.dialpad.apiToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000 // Set timeout to 10 seconds
        }
      );
    };
    
    const routerResponse = await retryRequest(createRouter);
    const routerId = routerResponse.data.id;
    console.log(`Call router created with ID: ${routerId}`);
    
    console.log('');
    console.log('=== IMPORTANT NEXT STEPS ===');
    console.log('1. Go to your Dialpad admin console');
    console.log('2. Navigate to Settings > Phone Numbers');
    console.log('3. Select your phone number');
    console.log('4. In the Call Routing section, select the "Moving Company Assistant Router"');
    console.log('5. Save your changes');
    console.log('');
    console.log('Setup complete!');
  } catch (error) {
    console.error('Error setting up call router:', error.message);
    
    if (error.response) {
      console.log('Error details:', error.response.data);
    }
    
    // Re-throw to be caught in the main function
    throw error;
  }
}

setupDialpad();