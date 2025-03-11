const axios = require('axios');

// Simulate an incoming call
async function simulateIncomingCall() {
  try {
    const testCallId = `test-${Date.now()}`;
    console.log(`Simulating incoming call with ID: ${testCallId}`);
    
    const response = await axios.post('http://localhost:3000/webhook/incoming-call', {
      call_id: testCallId,
      // Add other fields that would typically be in a Dialpad webhook payload
      call: {
        id: testCallId,
        state: 'ringing'
      },
      event_type: 'call.ringing'
    });
    
    console.log('Incoming call response:', response.data);
    return { success: true, call_id: testCallId };
  } catch (error) {
    console.error('Error simulating incoming call:', error.response?.data || error.message);
    return { success: false };
  }
}

// Simulate speech from customer
async function simulateSpeech(callId, speech) {
  try {
    console.log(`Simulating speech for call ${callId}: "${speech}"`);
    
    const response = await axios.post('http://localhost:3000/webhook/speech', {
      call_id: callId,
      speech_text: speech,
      // Add other fields that would typically be in a Dialpad webhook payload
      call: {
        id: callId,
        state: 'connected'
      },
      event_type: 'call.speech_recognition'
    });
    
    console.log('Speech response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error simulating speech:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

// Run test
async function runTest() {
  console.log('Starting test call simulation...');
  
  // Simulate incoming call
  const callResult = await simulateIncomingCall();
  if (!callResult.success) {
    console.error('Failed to simulate incoming call, stopping test');
    return;
  }
  
  const callId = callResult.call_id;
  console.log(`Test call initialized with ID: ${callId}`);
  
  // Wait for greeting to complete
  console.log('Waiting for greeting...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Simulate customer responses
  const responses = [
    "My name is John Smith",
    "My email is john.smith@example.com",
    "I'm planning to move on March 15th",
    "I'm moving from 123 Main Street, New York to 456 Elm Street, Boston",
    "It's a two-bedroom apartment at both locations",
    "There are stairs at the current place and an elevator at the new place",
    "I have a piano that needs to be moved",
    "No additional stops needed"
  ];
  
  // Send responses with delay
  console.log('Starting conversation simulation...');
  for (const response of responses) {
    await simulateSpeech(callId, response);
    // Wait for AI response
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('Test call simulation completed successfully');
}

console.log('Preparing to run test...');
runTest().catch(error => {
  console.error('Test failed with error:', error);
});