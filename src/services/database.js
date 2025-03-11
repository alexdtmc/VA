/**
 * Simple in-memory database for now
 * You would replace this with a real database in production
 */
const conversations = [];

/**
 * Save conversation data
 */
function saveConversation(callId, transcript, customerInfo) {
  const conversation = {
    callId,
    transcript,
    customerInfo,
    savedAt: new Date()
  };
  
  conversations.push(conversation);
  console.log(`Conversation ${callId} saved to database`);
  return true;
}

/**
 * Get saved conversation
 */
function getConversation(callId) {
  return conversations.find(c => c.callId === callId);
}

/**
 * Get all saved conversations
 */
function getAllConversations() {
  return [...conversations];
}

module.exports = {
  saveConversation,
  getConversation,
  getAllConversations
};