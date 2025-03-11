const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  dialpad: {
    apiToken: process.env.DIALPAD_API_TOKEN,
    webhookId: process.env.DIALPAD_WEBHOOK_ID,
    webhookSecret: process.env.DIALPAD_WEBHOOK_SECRET,
    salesDepartmentNumber: process.env.SALES_DEPARTMENT_NUMBER || '+1234567890', // Fallback for testing
    webhookUrl: process.env.WEBHOOK_URL || 'https://your-ngrok-domain.ngrok.io/webhook/call-routing',
    apiBase: 'https://api.dialpad.com/v2' // Updated correct API base URL
  },
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  }
};