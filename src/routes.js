const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Import services
const openaiService = require('./services/openai');
const dialpadService = require('./services/dialpad');
const conversationManager = require('./services/conversation-manager');
const database = require('./services/database');
const config = require('../config');

// Import Twilio handler
const twilioHandler = require('./services/twilio-handler');

// Middleware to log all requests
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  
  // Only log body for non-JWT requests to avoid printing the raw JWT token
  if (req.headers['content-type'] !== 'application/jwt') {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  } else {
    console.log('Body: [JWT token]');
  }
  
  next();
});

// Twilio Voice webhook - this is where Twilio will send incoming calls
router.post('/twilio/voice', twilioHandler.handleIncomingCall);

// Webhook for speech processing
router.post('/twilio/speech', twilioHandler.handleSpeechInput);

// Webhook for call status updates
router.post('/twilio/status', twilioHandler.handleStatusCallback);

// Function to process JWT tokens
function processJWT(req) {
  if (req.headers['content-type'] === 'application/jwt') {
    try {
      // Get the raw body
      let token = '';
      
      // If we have a raw body stored from the middleware
      if (req.rawBody) {
        token = req.rawBody;
      } 
      // If we're dealing with a string in req.body
      else if (typeof req.body === 'string') {
        token = req.body;
      } 
      // If req.body is already an object
      else if (req.body && Object.keys(req.body).length === 0) {
        // This is likely the raw request buffer converted to an empty object
        // Try to get the raw body from the request
        token = '';
        req.on('data', chunk => {
          token += chunk.toString();
        });
      }
      
      console.log('JWT token length:', token.length);
      
      // Handle empty token
      if (!token || token.length === 0) {
        console.error('Empty JWT token received');
        return { error: 'Empty JWT token' };
      }
      
      // Log the secret for debugging (DO NOT DO THIS IN PRODUCTION)
      console.log('Webhook secret from config:', config.dialpad.webhookSecret);
      
      // Ensure the webhookSecret exists
      if (!config.dialpad.webhookSecret) {
        console.error('Webhook secret is not defined in config');
        return { error: 'Webhook secret not configured' };
      }
      
      // Verify and decode the token
      const decoded = jwt.verify(token, config.dialpad.webhookSecret, { algorithms: ['HS256'] });
      console.log('Decoded JWT payload:', JSON.stringify(decoded, null, 2));
      return decoded;
    } catch (error) {
      console.error('Error processing JWT:', error);
      return { error: 'Failed to process JWT: ' + error.message };
    }
  }
  
  // If not JWT, just return the body
  return req.body;
}

// Helper function to handle speech recognition
async function handleSpeechRecognition(payload, callId, res) {
  const speech = payload.speech_text || 
               payload.transcript || 
               (payload.data && payload.data.speech_text) ||
               (payload.data && payload.data.transcript);
  
  if (!speech) {
    return res.status(200).json({ success: true, message: 'No speech detected' });
  }
  
  console.log(`Processing speech for call ID: ${callId}`);
  console.log(`Speech content: ${speech}`);
  
  // Get conversation
  const conversation = conversationManager.getConversationByAnyCallId(callId);
  if (!conversation) {
    console.error(`Conversation not found for call ID: ${callId}`);
    return res.status(200).json({ success: false, error: 'Conversation not found' });
  }
  
  // Add customer speech to transcript
  conversationManager.addMessage(callId, 'customer', speech);
  
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
  conversationManager.updateCustomerInfo(callId, infoUpdates);
  
  // Update conversation state
  conversationManager.updateState(callId, result.newState);
  
  // Add assistant response to transcript
  conversationManager.addMessage(callId, 'assistant', result.nextQuestion);
  
  // Router ID for looping the call back
  const routerId = "5983474916573184"; // Your call router ID
  
  // Check if transfer is needed
  if (result.transferToHuman) {
    // Save conversation for rep access
    database.saveConversation(
      callId,
      conversation.transcript,
      conversation.customerInfo
    );
    
    // Use bridge action to transfer the call
    return res.status(200).json({
      action: "bridge",
      action_target_type: "department",
      action_target_id: config.dialpad.salesDepartmentId || config.dialpad.salesDepartmentNumber
    });
  }
  
  // Return menu response with the next question and loop back to our own router
  return res.status(200).json({
    action: "menu",
    menu_message: result.nextQuestion,
    menu_options: [],  // No DTMF options, just play the response
    menu_max_tries: 1,  // Only try once, then continue
    menu_no_input_action: "bridge",  // After menu plays, bridge back to our router
    menu_no_input_action_target_type: "callrouter",
    menu_no_input_action_target_id: routerId
  });
}

// Root path handler for Dialpad webhook
router.post('/', async (req, res) => {
  try {
    console.log('Root webhook received');
    
    // Process JWT if necessary
    const payload = processJWT(req);
    
    // Check for processing error
    if (payload.error) {
      console.error('Error processing payload:', payload.error);
      return res.status(200).json({ action: "default" });
    }
    
    console.log('Processed payload:', JSON.stringify(payload, null, 2));
    
    // Extract call ID and state
    const callId = payload.call_id || 
                 (payload.call && payload.call.id) || 
                 (payload.data && payload.data.call_id) ||
                 (payload.data && payload.data.call && payload.data.call.id);
    
    const callState = payload.state || null;
    
    console.log(`Call ID: ${callId}, State: ${callState}`);
    
    if (!callId) {
      console.error('No call ID found in webhook payload');
      return res.status(200).json({ action: "default" });
    }
    
    // Router ID for looping the call back
    const routerId = "5983474916573184"; // Your call router ID
    
    // Handle based on call state
    if (!callState) {
      // This is likely a routing request
      console.log('This appears to be a routing request');
      
      // Create conversation if needed
      if (!conversationManager.getConversation(callId)) {
        conversationManager.createConversation(callId);
        console.log(`Created new conversation for call ID: ${callId}`);
      }
      
      // Use menu action to play a greeting AND loop back to our router
      console.log('Responding with menu action and greeting');
      return res.status(200).json({ 
        action: "menu",
        menu_message: "Thank you for calling The Moving Company, where we make moving easy. This is our virtual assistant. I'd be happy to help gather some information about your move. May I have your name please?",
        menu_options: [],  // No DTMF options, just play the greeting
        menu_max_tries: 1,  // Only try once, then continue
        menu_no_input_action: "bridge",  // After menu plays, bridge back to our router
        menu_no_input_action_target_type: "callrouter",
        menu_no_input_action_target_id: routerId
      });
    }
    else if (callState === 'ringing') {
      // This is a notification that the call is ringing
      console.log('Call is ringing');
      
      // Just acknowledge the ringing state
      return res.status(200).json({ success: true });
    }
    else if (callState === 'connected') {
      // Call is already connected
      console.log('Call is connected');
      
      // Make sure we have a conversation
      let conversation = conversationManager.getConversation(callId);
      if (!conversation) {
        conversation = conversationManager.createConversation(callId);
        
        // Return a menu response with a greeting and loop back
        return res.status(200).json({
          action: "menu",
          menu_message: "Thank you for calling The Moving Company. I'm your virtual assistant. How can I help you with your move today?",
          menu_options: [],
          menu_max_tries: 1,
          menu_no_input_action: "bridge",
          menu_no_input_action_target_type: "callrouter",
          menu_no_input_action_target_id: routerId
        });
      }
      
      return res.status(200).json({ success: true });
    }
    else if (callState === 'hangup') {
      // Call has ended
      console.log(`Call ${callId} has ended`);
      
      // Clean up conversation
      conversationManager.removeConversation(callId);
      
      return res.status(200).json({ success: true });
    }
    else if (payload.speech_text || payload.transcript) {
      // This is a speech recognition event
      console.log('Speech recognition event received');
      return handleSpeechRecognition(payload, callId, res);
    }
    else if (callState === 'recap_summary') {
      // This is a recap summary event (speech recognition)
      console.log('Recap summary event received');
      
      // Extract the transcript or speech content
      const transcript = payload.recap_summary || payload.transcription_text;
      if (transcript) {
        // Add it to our payload and process as speech
        payload.speech_text = transcript;
        return handleSpeechRecognition(payload, callId, res);
      }
      
      return res.status(200).json({ success: true });
    }
    else {
      // Other types of events
      console.log(`Unhandled call state: ${callState}`);
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error('Error handling root webhook:', error);
    
    // Return success if headers not already sent
    if (!res.headersSent) {
      res.status(200).json({ success: false, error: error.message });
    }
  }
});

// Call routing handler to intercept calls before voicemail (legacy path)
router.post('/webhook/call-routing', async (req, res) => {
  try {
    console.log('Call routing webhook received at /webhook/call-routing');
    
    // Process JWT if necessary
    const payload = processJWT(req);
    
    // Check for processing error
    if (payload.error) {
      console.error('Error processing call routing payload:', payload.error);
      return res.status(200).json({ action: "default" });
    }
    
    console.log('Call routing payload:', JSON.stringify(payload, null, 2));
    
    // Extract call ID or other identifiers
    const callId = payload.call_id || 
                 (payload.call && payload.call.id) || 
                 (payload.data && payload.data.call_id) ||
                 (payload.data && payload.data.call && payload.data.call.id);
                 
    // Also track other important call IDs from the call graph
    const masterCallId = payload.master_call_id;
    const entryPointCallId = payload.entry_point_call_id;
    const operatorCallId = payload.operator_call_id;
    
    console.log(`Call graph info - Call ID: ${callId}, Master: ${masterCallId}, Entry Point: ${entryPointCallId}, Operator: ${operatorCallId}`);
    
    if (!callId) {
      console.error('No call ID found in webhook payload');
      return res.status(200).json({ action: "default" });
    }
    
    console.log(`Processing routing decision for call ID: ${callId}`);
    
    // Create a conversation for this call
    if (!conversationManager.getConversation(callId)) {
      conversationManager.createConversation(callId, masterCallId, entryPointCallId, operatorCallId);
      console.log(`Created new conversation for call ID: ${callId}`);
    }
    
    // Router ID for looping the call back
    const routerId = "5983474916573184"; // Your call router ID
    
    // Return a menu action to play a greeting with loop back
    console.log('Responding with menu action');
    return res.status(200).json({
      action: "menu",
      menu_message: "Thank you for calling The Moving Company, where we make moving easy. This is our virtual assistant. I'd be happy to help gather some information about your move. May I have your name please?",
      menu_options: [],
      menu_max_tries: 1,
      menu_no_input_action: "bridge",
      menu_no_input_action_target_type: "callrouter",
      menu_no_input_action_target_id: routerId
    });
  } catch (error) {
    console.error('Error handling call routing:', error);
    // Return default action to avoid breaking the call flow
    res.status(200).json({ action: "default" });
  }
});

// Handle incoming calls (legacy path)
router.post('/webhook/incoming-call', async (req, res) => {
  try {
    console.log('Incoming call webhook received at /webhook/incoming-call');
    
    // Process JWT if necessary
    const payload = processJWT(req);
    
    // Check for processing error
    if (payload.error) {
      return res.status(400).json({ error: payload.error });
    }
    
    console.log('Processed payload:', JSON.stringify(payload, null, 2));
    
    // Extract call ID from payload
    const callId = payload.call_id || 
                 (payload.call && payload.call.id) || 
                 (payload.data && payload.data.call_id) ||
                 (payload.data && payload.data.call && payload.data.call.id);
    
    // Also track other important call IDs from the call graph
    const masterCallId = payload.master_call_id;
    const entryPointCallId = payload.entry_point_call_id;
    const operatorCallId = payload.operator_call_id;
    
    if (!callId) {
      console.error('No call ID found in webhook payload');
      return res.status(400).json({ error: 'Missing call ID' });
    }
    
    console.log(`Processing call with ID: ${callId} in state: ${payload.state}`);
    
    // Router ID for looping the call back
    const routerId = "5983474916573184"; // Your call router ID
    
    // Handle different call states
    if (payload.state === 'ringing') {
      console.log('Call is ringing');
      
      // Create new conversation or link to existing one in the call graph
      let conversation = conversationManager.getConversationByAnyCallId(callId);
      if (!conversation) {
        conversation = conversationManager.createConversation(callId, masterCallId, entryPointCallId, operatorCallId);
      }
      
      // Return a menu response instead of trying to answer, with loop back
      return res.status(200).json({
        action: "menu",
        menu_message: "Thank you for calling The Moving Company, where we make moving easy. This is our virtual assistant. I'd be happy to help gather some information about your move. May I have your name please?",
        menu_options: [],
        menu_max_tries: 1,
        menu_no_input_action: "bridge",
        menu_no_input_action_target_type: "callrouter",
        menu_no_input_action_target_id: routerId
      });
    } else if (payload.state === 'hangup') {
      // Call has already ended, just log information
      console.log(`Call ${callId} has already ended, details:`, {
        talkTime: payload.talk_time,
        duration: payload.duration,
        totalDuration: payload.total_duration,
        voicemailLink: payload.voicemail_link
      });
      
      // Clean up any active conversation and related calls
      if (conversationManager.getConversationByAnyCallId(callId)) {
        console.log(`Removing conversation for call ID ${callId} and any related calls`);
        conversationManager.removeConversationGraph(callId);
      }
      
      return res.status(200).json({ 
        success: true, 
        message: 'Call already ended',
        voicemail: payload.voicemail_link ? true : false
      });
    } else if (payload.state === 'connected') {
      console.log(`Call ${callId} is already connected`);
      
      // If we have an existing conversation, continue it
      let conversation = conversationManager.getConversationByAnyCallId(callId);
      if (conversation) {
        console.log(`Continuing existing conversation for call ID ${callId}`);
        return res.status(200).json({ success: true });
      } else {
        // Create a new conversation if one doesn't exist
        console.log(`Creating new conversation for connected call ID ${callId}`);
        conversation = conversationManager.createConversation(callId, masterCallId, entryPointCallId, operatorCallId);
        
        // Return a menu response with loop back
        return res.status(200).json({
          action: "menu",
          menu_message: "Thank you for calling The Moving Company. I'm your virtual assistant. How can I help you with your move today?",
          menu_options: [],
          menu_max_tries: 1,
          menu_no_input_action: "bridge",
          menu_no_input_action_target_type: "callrouter",
          menu_no_input_action_target_id: routerId
        });
      }
    } else {
      console.log(`Call is in ${payload.state} state, not taking specific action`);
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error('Error handling incoming call:', error);
    // Still return success to Dialpad so it doesn't keep retrying
    res.status(200).json({ success: false, error: error.message });
  }
});

// Handle speech recognition events (legacy path)
router.post('/webhook/speech', async (req, res) => {
  try {
    console.log('Speech webhook received at /webhook/speech');
    
    // Process JWT if necessary
    const payload = processJWT(req);
    
    // Check for processing error
    if (payload.error) {
      return res.status(400).json({ error: payload.error });
    }
    
    console.log('Processed speech payload:', JSON.stringify(payload, null, 2));
    
    // Extract call ID and speech text from webhook payload
    const callId = payload.call_id || 
                 (payload.call && payload.call.id) || 
                 (payload.data && payload.data.call_id) ||
                 (payload.data && payload.data.call && payload.data.call.id);
                 
    const speech = payload.speech_text || 
                 payload.transcript || 
                 (payload.data && payload.data.speech_text) ||
                 (payload.data && payload.data.transcript);
    
    // Also track other important call IDs from the call graph
    const masterCallId = payload.master_call_id;
    const entryPointCallId = payload.entry_point_call_id;
    const operatorCallId = payload.operator_call_id;
    
    if (!callId || !speech) {
      console.error('Missing call ID or speech text in webhook payload');
      return res.status(400).json({ error: 'Missing required data' });
    }
    
    console.log(`Processing speech for call ID: ${callId}`);
    console.log(`Speech content: ${speech}`);
    
    // Check call state if available
    if (payload.state === 'hangup') {
      console.log(`Call ${callId} has already ended, ignoring speech`);
      return res.status(200).json({ 
        success: true, 
        message: 'Call already ended, speech ignored' 
      });
    }
    
    // Router ID for looping the call back
    const routerId = "5983474916573184"; // Your call router ID
    
    // Get conversation - check for any related calls in the call graph
    const conversation = conversationManager.getConversationByAnyCallId(callId);
    if (!conversation) {
      console.error(`Conversation not found for call ID: ${callId}`);
      
      // Create a new conversation if the call is still active
      console.log(`Creating new conversation for call ID: ${callId}`);
      const newConversation = conversationManager.createConversation(
        callId, masterCallId, entryPointCallId, operatorCallId
      );
      
      // Add initial customer speech
      conversationManager.addMessage(callId, 'customer', speech);
      
      // Process with OpenAI as a new conversation
      const result = await openaiService.processConversation(
        newConversation.transcript,
        newConversation.currentState,
        newConversation.customerInfo
      );
      
      // Continue with response processing...
      const response = result.nextQuestion || "Thank you for calling The Moving Company. How can I help with your move?";
      
      // Add assistant response to transcript
      conversationManager.addMessage(callId, 'assistant', response);
      
      // Return menu response with loop back
      return res.status(200).json({
        action: "menu",
        menu_message: response,
        menu_options: [],
        menu_max_tries: 1,
        menu_no_input_action: "bridge",
        menu_no_input_action_target_type: "callrouter",
        menu_no_input_action_target_id: routerId
      });
    }
    
    // Hand off to the shared speech handling function
    return handleSpeechRecognition(payload, callId, res);
  } catch (error) {
    console.error('Error handling speech:', error);
    // Still return success to Dialpad so it doesn't keep retrying
    res.status(200).json({ success: false, error: error.message });
  }
});

// Generic webhook endpoint for catching other webhooks
router.post('/webhook', (req, res) => {
  try {
    console.log('Generic webhook received at /webhook');
    
    // Process JWT if necessary
    const payload = processJWT(req);
    
    // Check for processing error
    if (payload.error) {
      return res.status(400).json({ error: payload.error });
    }
    
    console.log('Processed generic webhook payload:', JSON.stringify(payload, null, 2));
    
    // Handle based on event type if available
    if (payload.state === 'ringing') {
      console.log('Forwarding ringing event to specific handler');
      
      // Forward to the specific handler
      req.body = payload;
      return router.handle(req, res, () => {
        res.status(200).json({ success: true, forwarded: true });
      });
    }
    
    // Always return success
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error handling generic webhook:', error);
    res.status(200).json({ success: false, error: error.message });
  }
});

// Test webhook receiver
router.post('/webhook/test', (req, res) => {
  console.log('Test webhook received:');
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  res.status(200).json({ received: true });
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Catch-all route for debugging
router.all('*', (req, res) => {
  console.log('Catch-all route hit:', req.method, req.url);
  console.log('Headers:', req.headers);
  if (req.headers['content-type'] !== 'application/jwt') {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  } else {
    console.log('Body: [JWT token]');
  }
  res.status(200).json({ success: true });
});

module.exports = router;