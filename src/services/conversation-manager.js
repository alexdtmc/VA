// In-memory storage for active conversations
const activeConversations = new Map();

/**
 * Create a new conversation with call graph awareness
 */
function createConversation(callId, masterCallId = null, entryPointCallId = null, operatorCallId = null) {
  const conversation = {
    transcript: [],
    customerInfo: {
      name: null,
      email: null,
      moveDate: null,
      originAddress: null,
      destinationAddress: null,
      propertyType: null,
      accessDetails: null,
      specialItems: null,
      additionalStops: null
    },
    currentState: 'greeting',
    createdAt: new Date(),
    
    // Call graph information
    callId: callId,
    masterCallId: masterCallId,
    entryPointCallId: entryPointCallId,
    operatorCallId: operatorCallId,
    
    // For tracking related calls in transfers
    relatedCalls: []
  };
  
  activeConversations.set(callId, conversation);
  
  // If this is an operator call or part of a call graph, link it to the master conversation
  if (masterCallId && masterCallId !== callId) {
    linkConversation(callId, masterCallId);
  } else if (entryPointCallId && entryPointCallId !== callId) {
    linkConversation(callId, entryPointCallId);
  } else if (operatorCallId && operatorCallId !== callId) {
    linkConversation(callId, operatorCallId);
  }
  
  return conversation;
}

/**
 * Link related conversations in a call graph
 */
function linkConversation(callId, relatedCallId) {
  const conversation = activeConversations.get(callId);
  const relatedConversation = activeConversations.get(relatedCallId);
  
  if (conversation && relatedConversation) {
    // Add to related calls list
    if (!conversation.relatedCalls.includes(relatedCallId)) {
      conversation.relatedCalls.push(relatedCallId);
    }
    
    if (!relatedConversation.relatedCalls.includes(callId)) {
      relatedConversation.relatedCalls.push(callId);
    }
    
    // Sync customer info
    for (const key in conversation.customerInfo) {
      if (!conversation.customerInfo[key] && relatedConversation.customerInfo[key]) {
        conversation.customerInfo[key] = relatedConversation.customerInfo[key];
      }
    }
    
    console.log(`Linked conversations for calls ${callId} and ${relatedCallId}`);
  }
}

/**
 * Get an existing conversation
 */
function getConversation(callId) {
  return activeConversations.get(callId);
}

/**
 * Get a conversation by any related call ID (helpful for transfers)
 */
function getConversationByAnyCallId(callId) {
  // First try direct lookup
  if (activeConversations.has(callId)) {
    return activeConversations.get(callId);
  }
  
  // Then check for master call ID
  for (const [id, conversation] of activeConversations.entries()) {
    if (conversation.masterCallId === callId ||
        conversation.entryPointCallId === callId ||
        conversation.operatorCallId === callId ||
        conversation.relatedCalls.includes(callId)) {
      return conversation;
    }
  }
  
  return null;
}

/**
 * Add message to conversation transcript
 */
function addMessage(callId, role, content) {
  const conversation = getConversationByAnyCallId(callId);
  if (!conversation) return false;
  
  conversation.transcript.push({ role, content, timestamp: new Date() });
  return true;
}

/**
 * Update customer information
 */
function updateCustomerInfo(callId, updates) {
  const conversation = getConversationByAnyCallId(callId);
  if (!conversation) return false;
  
  Object.keys(updates).forEach(key => {
    if (key in conversation.customerInfo && updates[key]) {
      conversation.customerInfo[key] = updates[key];
    }
  });
  
  return true;
}

/**
 * Update conversation state
 */
function updateState(callId, newState) {
  const conversation = getConversationByAnyCallId(callId);
  if (!conversation) return false;
  
  conversation.currentState = newState;
  return true;
}

/**
 * Remove a single conversation
 */
function removeConversation(callId) {
  return activeConversations.delete(callId);
}

/**
 * Remove a conversation and all related conversations
 */
function removeConversationGraph(callId) {
  const conversation = getConversationByAnyCallId(callId);
  if (!conversation) return false;
  
  // Get all related calls
  const allRelatedCalls = [
    conversation.callId,
    conversation.masterCallId,
    conversation.entryPointCallId,
    conversation.operatorCallId,
    ...conversation.relatedCalls
  ].filter(id => id !== null);
  
  // Remove all related conversations
  let removedCount = 0;
  for (const id of allRelatedCalls) {
    if (activeConversations.delete(id)) {
      removedCount++;
    }
  }
  
  console.log(`Removed ${removedCount} related conversations for call ID ${callId}`);
  return removedCount > 0;
}

module.exports = {
  createConversation,
  getConversation,
  getConversationByAnyCallId,
  addMessage,
  updateCustomerInfo,
  updateState,
  removeConversation,
  removeConversationGraph,
  linkConversation
};