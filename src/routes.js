const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Import services
const openaiService = require('./services/openai');
const dialpadService = require('./services/dialpad');
const conversationManager = require('./services/conversation-manager');
const database = require('./services/database');
const config = require('../config');

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

// Call routing handler to intercept calls before voicemail
router.post('/webhook/call-routing', async (req, res) => {
  try {
    console.log('Call routing webhook received');
    
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
    
    // Log the action being taken
    console.log('Requesting to handle the call directly with action: handle_call');
    
    // Return a routing decision to handle the call yourself
    // This tells Dialpad not to send to voicemail
    return res.status(200).json({
      action: "handle_call"
    });
  } catch (error) {
    console.error('Error handling call routing:', error);
    // Return default action to avoid breaking the call flow
    res.status(200).json({ action: "default" });
  }
});

// Handle incoming calls
router.post('/webhook/incoming-call', async (req, res) => {
  try {
    console.log('Incoming call webhook received');
    
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
    
    // Handle different call states
    if (payload.state === 'ringing') {
      console.log('Call is ringing, attempting to answer');
      
      // Create new conversation or link to existing one in the call graph
      let conversation = conversationManager.getConversationByAnyCallId(callId);
      if (!conversation) {
        conversation = conversationManager.createConversation(callId, masterCallId, entryPointCallId, operatorCallId);
      }
      
      // Try to answer the call
      const answerResult = await dialpadService.answerCall(callId);
      console.log('Answer call result:', answerResult);
      
      // Play greeting if answer was successful
      if (answerResult.success !== false) {
        const greeting = "Thank you for calling The Moving Company, where we make moving easy. This is our virtual assistant. I'd be happy to help gather some information about your move. May I have your name please?";
        
        // Add greeting to transcript
        conversationManager.addMessage(callId, 'assistant', greeting);
        
        // Try to play the greeting
        try {
          const speechBuffer = await openaiService.textToSpeech(greeting);
          await dialpadService.playAudio(callId, speechBuffer);
        } catch (audioError) {
          console.error('Error playing greeting audio:', audioError);
        }
      }
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
      
      // Don't try to answer or play audio on ended calls
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
      } else {
        // Create a new conversation if one doesn't exist
        console.log(`Creating new conversation for connected call ID ${callId}`);
        conversation = conversationManager.createConversation(callId, masterCallId, entryPointCallId, operatorCallId);
        
        // Greet the user
        const greeting = "Thank you for calling The Moving Company. I'm your virtual assistant. How can I help you with your move today?";
        
        // Add greeting to transcript
        conversationManager.addMessage(callId, 'assistant', greeting);
        
        // Try to play the greeting
        try {
          const speechBuffer = await openaiService.textToSpeech(greeting);
          await dialpadService.playAudio(callId, speechBuffer);
        } catch (audioError) {
          console.error('Error playing greeting audio:', audioError);
        }
      }
    } else {
      console.log(`Call is in ${payload.state} state, not taking specific action`);
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error handling incoming call:', error);
    // Still return success to Dialpad so it doesn't keep retrying
    res.status(200).json({ success: false, error: error.message });
  }
});

// Handle speech recognition events
router.post('/webhook/speech', async (req, res) => {
  try {
    console.log('Speech webhook received');
    
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
      
      // Play response
      try {
        const speechBuffer = await openaiService.textToSpeech(response);
        await dialpadService.playAudio(callId, speechBuffer);
      } catch (audioError) {
        console.error('Error playing response audio:', audioError);
      }
      
      return res.status(200).json({ success: true });
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
    
    // Convert response to speech and play it
    try {
      const speechBuffer = await openaiService.textToSpeech(result.nextQuestion);
      await dialpadService.playAudio(callId, speechBuffer);
    } catch (audioError) {
      console.error('Error playing response audio:', audioError);
    }
    
    // Check if transfer is needed
    if (result.transferToHuman) {
      // Save conversation for rep access
      database.saveConversation(
        callId,
        conversation.transcript,
        conversation.customerInfo
      );
      
      // Play transfer message
      try {
        const transferMsg = "Thank you for providing that information. I'll connect you with one of our moving specialists who can help you further.";
        const transferSpeechBuffer = await openaiService.textToSpeech(transferMsg);
        await dialpadService.playAudio(callId, transferSpeechBuffer);
      } catch (audioError) {
        console.error('Error playing transfer message:', audioError);
      }
      
      // Transfer call
      try {
        await dialpadService.transferCall(callId, config.dialpad.salesDepartmentNumber);
      } catch (transferError) {
        console.error('Error transferring call:', transferError);
      }
      
      // Remove conversation from memory
      conversationManager.removeConversationGraph(callId);
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error handling speech:', error);
    // Still return success to Dialpad so it doesn't keep retrying
    res.status(200).json({ success: false, error: error.message });
  }
});

// Generic webhook endpoint for catching other webhooks
router.post('/webhook', (req, res) => {
  try {
    console.log('Generic webhook received');
    
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