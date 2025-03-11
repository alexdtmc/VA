const { OpenAI } = require('openai');
const config = require('../../config'); // Updated path

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

/**
 * Process conversation with OpenAI
 */
async function processConversation(transcript, currentState, customerInfo) {
  try {
    // Format conversation for OpenAI
    const messages = [
      { 
        role: 'system', 
        content: `You are an AI assistant for The Moving Company. 
          Your job is to collect information about potential customers' moving needs.
          You need to collect: customer name, email, move date, origin address, destination address, 
          property type at both locations, access details (stairs/elevators), special items, and additional stops.
          Be polite, professional, and efficient. If the conversation gets too complex or if the customer 
          specifically asks to speak to a human, indicate that the call should be transferred.
          Current conversation state: ${currentState}` 
      }
    ];
    
    // Add transcript to messages
    transcript.forEach(entry => {
      messages.push({ 
        role: entry.role === 'assistant' ? 'assistant' : 'user', 
        content: entry.content 
      });
    });
    
    // Get response from OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      functions: [
        {
          name: 'update_customer_info',
          description: 'Update the customer information based on the conversation',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              moveDate: { type: 'string' },
              originAddress: { type: 'string' },
              destinationAddress: { type: 'string' },
              propertyType: { type: 'string' },
              accessDetails: { type: 'string' },
              specialItems: { type: 'string' },
              additionalStops: { type: 'string' },
              nextQuestion: { type: 'string' },
              transferToHuman: { type: 'boolean' },
              newState: { type: 'string' }
            },
            required: ['nextQuestion', 'transferToHuman', 'newState']
          }
        }
      ],
      function_call: { name: 'update_customer_info' }
    });
    
    // Extract function call results
    const functionCall = completion.choices[0].message.function_call;
    const functionArgs = JSON.parse(functionCall.arguments);
    
    return functionArgs;
  } catch (error) {
    console.error('Error processing conversation with OpenAI:', error);
    return {
      nextQuestion: "I'm having trouble processing that. Let me connect you with one of our moving specialists.",
      transferToHuman: true,
      newState: 'error'
    };
  }
}

/**
 * Generate speech from text
 */
async function textToSpeech(text) {
  try {
    const speech = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: text
    });
    
    return Buffer.from(await speech.arrayBuffer());
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
  }
}

module.exports = {
  processConversation,
  textToSpeech
};