const axios = require('axios');
const config = require('../config'); // Ensure this file exists as shown above

/**
 * Answer an incoming call via the Dialpad API.
 * @param {number|string} callId - The ID of the call to answer.
 * @param {string} [baseUrl=config.dialpad.apiBase] - The base URL for the API.
 * @returns {Promise<object>} - An object indicating success or failure.
 */
async function answerCall(callId, baseUrl = config.dialpad.apiBase) {
  try {
    // Build the endpoint URL using the base URL from config
    const url = `${baseUrl}/calls/${callId}/answer`;
    console.log(`Answering call ${callId} via URL: ${url}`);
    const response = await axios.post(url, {}, {
      headers: {
        'Authorization': `Bearer ${config.dialpad.apiToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Answer call response:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error in answerCall:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Play an audio file on a call.
 * @param {number|string} callId - The ID of the call.
 * @param {Buffer} audioBuffer - The audio data to play.
 * @returns {Promise<object>}
 */
async function playAudio(callId, audioBuffer) {
  try {
    const url = `${config.dialpad.apiBase}/calls/${callId}/play_audio`;
    console.log(`Playing audio for call ${callId} via URL: ${url}`);
    const response = await axios.post(url, audioBuffer, {
      headers: {
        'Authorization': `Bearer ${config.dialpad.apiToken}`,
        'Content-Type': 'application/octet-stream'
      }
    });
    console.log('Play audio response:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error in playAudio:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Transfer a call to a specified number.
 * @param {number|string} callId - The ID of the call.
 * @param {string} targetNumber - The number to which the call should be transferred.
 * @returns {Promise<object>}
 */
async function transferCall(callId, targetNumber) {
  try {
    const url = `${config.dialpad.apiBase}/calls/${callId}/transfer`;
    console.log(`Transferring call ${callId} to ${targetNumber} via URL: ${url}`);
    const response = await axios.post(url, { forward_to: targetNumber }, {
      headers: {
        'Authorization': `Bearer ${config.dialpad.apiToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Transfer call response:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('Error in transferCall:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  answerCall,
  playAudio,
  transferCall
};
