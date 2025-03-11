const axios = require('axios');
const config = require('../config');

async function createRouter() {
  try {
    console.log('Creating call router...');
    
    // Use the documented API URL
    const DIALPAD_API_BASE = 'https://dialpad.com/api/v2';
    console.log(`Using API base URL: ${DIALPAD_API_BASE}`);
    
    // First, let's get the office ID since we need it
    console.log('Fetching office ID...');
    const officesResponse = await axios({
      method: 'get',
      url: `${DIALPAD_API_BASE}/offices`,
      headers: {
        'Authorization': `Bearer ${config.dialpad.apiToken}`,
        'Accept': 'application/json'
      },
      validateStatus: function (status) {
        return status < 500; // Accept all non-server errors
      }
    });
    
    console.log('Offices response status:', officesResponse.status);
    
    // Find the first office ID - check for both 'items' and 'offices' properties
    let officeId = null;
    const officeData = officesResponse.data;
    
    if (officeData.items && officeData.items.length > 0) {
      officeId = officeData.items[0].id;
      console.log(`Found office ID from 'items': ${officeId}`);
    } else if (officeData.offices && officeData.offices.length > 0) {
      officeId = officeData.offices[0].id;
      console.log(`Found office ID from 'offices': ${officeId}`);
    } else {
      console.error('No offices found. Office ID is required for creating a call router.');
      console.log('Response data:', JSON.stringify(officeData, null, 2));
      return;
    }
    
    // Now try to get departments for default_target_id as they're usually better targets
    console.log('Fetching departments...');
    const deptsResponse = await axios({
      method: 'get',
      url: `${DIALPAD_API_BASE}/departments`,
      headers: {
        'Authorization': `Bearer ${config.dialpad.apiToken}`,
        'Accept': 'application/json'
      },
      validateStatus: function (status) {
        return status < 500; // Accept all non-server errors
      }
    });
    
    console.log('Departments response status:', deptsResponse.status);
    
    // Find a department ID to use as default target
    let defaultTargetId = null;
    let defaultTargetType = null;
    
    const deptData = deptsResponse.data;
    if (deptData.items && deptData.items.length > 0) {
      defaultTargetId = deptData.items[0].id;
      defaultTargetType = 'department';
      console.log(`Found default target ID (department): ${defaultTargetId}`);
    } else if (deptData.departments && deptData.departments.length > 0) {
      defaultTargetId = deptData.departments[0].id;
      defaultTargetType = 'department';
      console.log(`Found default target ID (department): ${defaultTargetId}`);
    } else {
      // If no departments, try to get users
      console.log('No departments found. Looking for users instead...');
      
      const usersResponse = await axios({
        method: 'get',
        url: `${DIALPAD_API_BASE}/users`,
        headers: {
          'Authorization': `Bearer ${config.dialpad.apiToken}`,
          'Accept': 'application/json'
        },
        validateStatus: function (status) {
          return status < 500; // Accept all non-server errors
        }
      });
      
      console.log('Users response status:', usersResponse.status);
      
      const userData = usersResponse.data;
      if (userData.items && userData.items.length > 0) {
        defaultTargetId = userData.items[0].id;
        defaultTargetType = 'user';
        console.log(`Found default target ID (user): ${defaultTargetId}`);
      } else if (userData.users && userData.users.length > 0) {
        defaultTargetId = userData.users[0].id;
        defaultTargetType = 'user';
        console.log(`Found default target ID (user): ${defaultTargetId}`);
      } else {
        // If no users found either, use the office as default target
        defaultTargetId = officeId;
        defaultTargetType = 'office';
        console.log(`Using office as default target: ${defaultTargetId}`);
      }
    }
    
    if (!defaultTargetId) {
      console.error('Could not find a valid default target. Cannot create call router.');
      return;
    }
    
    // Create the call router with all required fields
    const webhookId = config.dialpad.webhookId;
    const routingUrl = config.dialpad.webhookUrl;
    
    console.log('Creating call router with all required fields...');
    console.log({
      name: 'Moving Company Router',
      enabled: true,
      webhook_id: webhookId,
      routing_url: routingUrl,
      office_id: officeId,
      default_target_id: defaultTargetId,
      default_target_type: defaultTargetType
    });
    
    const routerResponse = await axios({
      method: 'post',
      url: `${DIALPAD_API_BASE}/callrouters`,
      headers: {
        'Authorization': `Bearer ${config.dialpad.apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: {
        name: 'Moving Company Router',
        enabled: true,
        webhook_id: webhookId,
        routing_url: routingUrl,
        office_id: officeId,
        default_target_id: defaultTargetId,
        default_target_type: defaultTargetType
      },
      timeout: 30000, // Increase timeout to 30 seconds
      validateStatus: function (status) {
        return status < 500; // Accept all non-server errors
      }
    });
    
    console.log('Router creation response status:', routerResponse.status);
    console.log('Router creation response data:', JSON.stringify(routerResponse.data, null, 2));
    
    if (routerResponse.status === 200 || routerResponse.status === 201) {
      console.log('Call router created successfully!');
      
      // If call router was created successfully, try to assign a phone number
      if (routerResponse.data && routerResponse.data.id) {
        const routerId = routerResponse.data.id;
        console.log(`Router ID: ${routerId}`);
        
        console.log('\nNow go to your Dialpad admin console and assign this router to your phone number:');
        console.log('1. Navigate to Settings > Phone Numbers');
        console.log('2. Select your phone number');
        console.log('3. In the Call Routing section, select the "Moving Company Router"');
        console.log('4. Save your changes');
      }
    } else {
      console.log('Call router creation failed with status:', routerResponse.status);
      console.log('Response data:', routerResponse.data);
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.log('Error status:', error.response.status);
      console.log('Error data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

createRouter();