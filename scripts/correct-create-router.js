const axios = require('axios');

async function createRouter() {
  try {
    console.log('Creating call router...');
    
    // First, let's get the office ID since we need it
    console.log('Fetching office ID...');
    const officesResponse = await axios({
      method: 'get',
      url: 'https://dialpad.com/api/v2/offices',
      headers: {
        'Authorization': 'Bearer 7Ft5sydTkevP6uvDfYUYKVz2parEhV45msdc4mXchSLwweSMHJfvQeesbquRCL8yJWfnhDVcZcFdy99mZKacJ3LPRRyJDqAMAQYP',
        'Accept': 'application/json'
      },
      validateStatus: function (status) {
        return status < 500; // Accept all non-server errors
      }
    });
    
    console.log('Offices response:', officesResponse.data);
    
    // Find the first office ID
    let officeId = null;
    if (officesResponse.data && officesResponse.data.offices && officesResponse.data.offices.length > 0) {
      officeId = officesResponse.data.offices[0].id;
      console.log(`Found office ID: ${officeId}`);
    } else {
      console.error('No offices found. Office ID is required for creating a call router.');
      return;
    }
    
    // Now let's get departments for default_target_id
    console.log('Fetching departments...');
    const deptsResponse = await axios({
      method: 'get',
      url: 'https://dialpad.com/api/v2/departments',
      headers: {
        'Authorization': 'Bearer 7Ft5sydTkevP6uvDfYUYKVz2parEhV45msdc4mXchSLwweSMHJfvQeesbquRCL8yJWfnhDVcZcFdy99mZKacJ3LPRRyJDqAMAQYP',
        'Accept': 'application/json'
      },
      validateStatus: function (status) {
        return status < 500; // Accept all non-server errors
      }
    });
    
    console.log('Departments response:', deptsResponse.data);
    
    // Find a department ID to use as default target
    let defaultTargetId = null;
    if (deptsResponse.data && deptsResponse.data.departments && deptsResponse.data.departments.length > 0) {
      defaultTargetId = deptsResponse.data.departments[0].id;
      console.log(`Found default target ID (department): ${defaultTargetId}`);
    } else {
      console.log('No departments found. Looking for users instead...');
      
      // Try to get users as an alternative for default_target_id
      const usersResponse = await axios({
        method: 'get',
        url: 'https://dialpad.com/api/v2/users',
        headers: {
          'Authorization': 'Bearer 7Ft5sydTkevP6uvDfYUYKVz2parEhV45msdc4mXchSLwweSMHJfvQeesbquRCL8yJWfnhDVcZcFdy99mZKacJ3LPRRyJDqAMAQYP',
          'Accept': 'application/json'
        },
        validateStatus: function (status) {
          return status < 500; // Accept all non-server errors
        }
      });
      
      console.log('Users response:', usersResponse.data);
      
      if (usersResponse.data && usersResponse.data.users && usersResponse.data.users.length > 0) {
        defaultTargetId = usersResponse.data.users[0].id;
        console.log(`Found default target ID (user): ${defaultTargetId}`);
      } else {
        console.error('No departments or users found. default_target_id is required for creating a call router.');
        return;
      }
    }
    
    // Create the call router with all required fields
    const webhookId = '5313917163978752'; // Your existing webhook ID
    const routingUrl = 'https://1fee-2601-589-498d-ed30-7832-27e6-7c5a-9ba3.ngrok-free.app/webhook/call-routing';
    
    console.log('Creating call router with all required fields...');
    const routerResponse = await axios({
      method: 'post',
      url: 'https://dialpad.com/api/v2/callrouters',
      headers: {
        'Authorization': 'Bearer 7Ft5sydTkevP6uvDfYUYKVz2parEhV45msdc4mXchSLwweSMHJfvQeesbquRCL8yJWfnhDVcZcFdy99mZKacJ3LPRRyJDqAMAQYP',
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
        default_target_type: 'user', // or 'department' based on what we found
        handle_manually: true
      },
      timeout: 30000, // Increase timeout to 30 seconds
      validateStatus: function (status) {
        return status < 500; // Accept all non-server errors
      }
    });
    
    console.log('Router creation response status:', routerResponse.status);
    console.log('Router creation response data:', routerResponse.data);
    
    if (routerResponse.status === 200) {
      console.log('Call router created successfully!');
      console.log('\nNow go to your Dialpad admin console and assign this router to your phone number:');
      console.log('1. Navigate to Settings > Phone Numbers');
      console.log('2. Select your phone number');
      console.log('3. In the Call Routing section, select the "Moving Company Router"');
      console.log('4. Save your changes');
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.log('Error status:', error.response.status);
      console.log('Error data:', error.response.data);
    }
  }
}

createRouter();