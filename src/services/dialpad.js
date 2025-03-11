const axios = require('axios');
const config = require('../../config');
const jwt = require('jsonwebtoken');

// Correct API URL
const DIALPAD_API_BASE = config.dialpad.apiBase || 'https://dialpad.com/api/v2';

/**
 * Validate webhook signature
 */
function validateWebhookSignature(payload, signature) {
  try {
    // Decode the JWT and verify signature
    const decoded = jwt.verify(signature, config.dialpad.webhookSecret, { algorithms: ['HS256'] });
    return true;
  } catch (error) {
    console.error('Invalid webhook signature:', error);
    return false;
  }
}

/**
 * Answer an incoming call
 */
async function answerCall(callId) {
  try {
    // Log the call ID for debugging
    console.log(`Attempting to answer call with ID: ${callId}`);
    
    // Convert callId to string to handle both string and number types
    const callIdStr = String(callId);
    
    // First, check if this is a test call
    if (callIdStr.startsWith('test-')) {
      console.log('Test call detected - simulating successful answer');
      return { success: true };
    }
    
    // For real calls, make the API request
    const response = await axios.post(
      `${DIALPAD_API_BASE}/calls/${callId}/answer`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${config.dialpad.apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error answering call:', error);
    
    // Log more debugging information
    if (error.response) {
      console.log('Error status:', error.response.status);
      console.log('Error data:', error.response.data);
    }
    
    // Return a dummy response instead of throwing an error
    return { success: false, error: error.message };
  }
}

/**
 * Play audio on a call
 */
async function playAudio(callId, audioBuffer) {
  try {
    // Convert callId to string
    const callIdStr = String(callId);
    
    // Skip for test calls
    if (callIdStr.startsWith('test-')) {
      console.log('Test call detected - simulating successful audio playback');
      return { success: true };
    }
    
    const response = await axios.post(
      `${DIALPAD_API_BASE}/calls/${callId}/play`,
      audioBuffer,
      {
        headers: {
          'Authorization': `Bearer ${config.dialpad.apiToken}`,
          'Content-Type': 'audio/mp3'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error playing audio:', error);
    
    // Log more debugging information
    if (error.response) {
      console.log('Error status:', error.response.status);
      console.log('Error data:', error.response.data);
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Transfer a call to another number
 */
async function transferCall(callId, targetNumber) {
  try {
    // Convert callId to string
    const callIdStr = String(callId);
    
    // Skip for test calls
    if (callIdStr.startsWith('test-')) {
      console.log('Test call detected - simulating successful transfer');
      return { success: true };
    }
    
    const response = await axios.post(
      `${DIALPAD_API_BASE}/calls/${callId}/transfer`,
      {
        target: targetNumber
      },
      {
        headers: {
          'Authorization': `Bearer ${config.dialpad.apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error transferring call:', error);
    
    // Log more debugging information
    if (error.response) {
      console.log('Error status:', error.response.status);
      console.log('Error data:', error.response.data);
    }
    
    return { success: false, error: error.message };
  }
}

module.exports = {
  validateWebhookSignature,
  answerCall,
  playAudio,
  transferCall
};