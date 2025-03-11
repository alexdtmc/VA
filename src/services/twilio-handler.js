const VoiceResponse = require('twilio').twiml.VoiceResponse;
const openaiService = require('./openai');
const conversationManager = require('./conversation-manager');
const database = require('./database');

/**
 * Handles incoming Twilio voice calls
 */
async function handleIncomingCall(req, res) {
  const callSid = req.body.CallSid;
  console.log(`Incoming call received with SID: ${callSid}`);
  
  // Create a new TwiML response
  const twiml = new VoiceResponse();
  
  // Check if we already have a conversation for this call
  let conversation = conversationManager.getConversation(callSid);
  if (!conversation) {
    // Create a new conversation
    conversation = conversationManager.createConversation(callSid);
    console.log(`Created new conversation for call SID: ${callSid}`);
    
    // Add initial greeting to the transcript
    const greeting = "Thank you for calling The Moving Company, where we make moving easy. This is our virtual assistant. I'd be happy to help gather some information about your move. May I have your name please?";
    conversationManager.addMessage(callSid, 'assistant', greeting);
    
    // Use Twilio's <Say> verb to speak the greeting
    twiml.say({
      voice: 'Polly.Amy', // Amazon Polly voice (more natural)
      language: 'en-US'
    }, greeting);
    
    // Use <Gather> to collect speech input
    twiml.gather({
      input: 'speech',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: true,
      action: '/twilio/speech',
      method: 'POST'
    });
  }
  
  // Set proper content type and send response
  res.setHeader('Content-Type', 'text/xml');
  res.send(twiml.toString());
}

/**
 * Handles speech input from the caller
 */
async function handleSpeechInput(req, res) {
  const callSid = req.body.CallSid;
  const speechResult = req.body.SpeechResult;
  
  console.log(`Speech received for call ${callSid}: "${speechResult}"`);
  
  // Create a new TwiML response
  const twiml = new VoiceResponse();
  
  // Get conversation
  const conversation = conversationManager.getConversation(callSid);
  if (!conversation) {
    console.error(`No conversation found for call ${callSid}`);
    twiml.say("I'm sorry, but I've lost track of our conversation. Please call back.");
    twiml.hangup();
    
    res.setHeader('Content-Type', 'text/xml');
    return res.send(twiml.toString());
  }
  
  // Add customer input to transcript
  conversationManager.addMessage(callSid, 'customer', speechResult);
  
  try {
    // Process with OpenAI
    const result = await openaiService.processConversation(
      conversation.transcript,
      conversation.currentState,
      conversation.customerInfo
    );
    
    // Update customer info
    const infoUpdates = {};
    Object.keys(conversation.customerInfo).forEach(key => {
      if (key in result && result[key]) {
        infoUpdates[key] = result[key];
      }
    });
    conversationManager.updateCustomerInfo(callSid, infoUpdates);
    
    // Update conversation state
    conversationManager.updateState(callSid, result.newState);
    
    // Add assistant response to transcript
    conversationManager.addMessage(callSid, 'assistant', result.nextQuestion);
    
    // Check if we need to transfer to a human
    if (result.transferToHuman) {
      // Save conversation for rep access
      database.saveConversation(
        callSid,
        conversation.transcript,
        conversation.customerInfo
      );
      
      // Let the customer know they're being transferred
      twiml.say({
        voice: 'Polly.Amy',
        language: 'en-US'
      }, "Thank you for providing that information. I'll connect you with one of our moving specialists who can help you further.");
      
      // Transfer to a human (you'll need to replace with your actual phone number)
      twiml.dial({
        callerId: req.body.To // Use the Twilio number as caller ID
      }, '+13057013963'); // Replace with your agent's number
      
      // Remove conversation after transfer
      conversationManager.removeConversation(callSid);
    } else {
      // Continue the conversation
      twiml.say({
        voice: 'Polly.Amy',
        language: 'en-US'
      }, result.nextQuestion);
      
      // Gather the next input
      twiml.gather({
        input: 'speech',
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        enhanced: true,
        action: '/twilio/speech',
        method: 'POST'
      });
    }
  } catch (error) {
    console.error('Error processing speech with OpenAI:', error);
    
    // Handle error gracefully
    twiml.say({
      voice: 'Polly.Amy',
      language: 'en-US'
    }, "I'm having trouble understanding. Let me connect you with a human representative.");
    
    // Transfer to a human (you'll need to replace with your actual phone number)
    twiml.dial({
      callerId: req.body.To // Use the Twilio number as caller ID
    }, '+13057013963'); // Replace with your agent's number
  }
  
  // Set proper content type and send response
  res.setHeader('Content-Type', 'text/xml');
  res.send(twiml.toString());
}

/**
 * Handle call status changes
 */
function handleStatusCallback(req, res) {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  
  console.log(`Call ${callSid} status changed to: ${callStatus}`);
  
  // If the call ended, clean up
  if (callStatus === 'completed' || callStatus === 'busy' || callStatus === 'failed' || callStatus === 'no-answer' || callStatus === 'canceled') {
    conversationManager.removeConversation(callSid);
    console.log(`Removed conversation for ended call ${callSid}`);
  }
  
  res.sendStatus(200);
}

module.exports = {
  handleIncomingCall,
  handleSpeechInput,
  handleStatusCallback
};