const { Agent, Chat } = require('../db/models');

/**
 * Assign incoming chat to best available agent based on category and workload
 * @param {string} chatId - MongoDB ObjectId of the chat
 * @param {string} category - Chat category (billing, technical, general, etc.)
 * @returns {Promise<Object|null>} Assignment info or null if no agents available
 */
async function assignAgentToChat(chatId, category) {
  try {
    // Find all online agents
    const onlineAgents = await Agent.find({ status: 'online' }).select('_id name specialties');

    // If no online agents, return null (chat stays in AI mode)
    if (onlineAgents.length === 0) {
      return null;
    }

    // Filter agents by category specialty
    const specialists = onlineAgents.filter(agent =>
      agent.specialties && agent.specialties.includes(category)
    );

    // Use specialists if available, otherwise use any online agent
    const candidateAgents = specialists.length > 0 ? specialists : onlineAgents;

    // Calculate workload for each candidate agent
    const agentIds = candidateAgents.map(agent => agent._id);
    const workloads = await Chat.aggregate([
      {
        $match: {
          assignedAgent: { $in: agentIds },
          status: 'active'
        }
      },
      {
        $group: {
          _id: '$assignedAgent',
          count: { $sum: 1 }
        }
      }
    ]);

    // Build workload map
    const workloadMap = {};
    workloads.forEach(item => {
      workloadMap[item._id.toString()] = item.count;
    });

    // Find agents with lowest workload
    let minWorkload = Infinity;
    let bestAgents = [];

    for (const agent of candidateAgents) {
      const agentId = agent._id.toString();
      const workload = workloadMap[agentId] || 0;

      if (workload < minWorkload) {
        minWorkload = workload;
        bestAgents = [agent];
      } else if (workload === minWorkload) {
        bestAgents.push(agent);
      }
    }

    // Random selection among agents with same workload (load balancing)
    const selectedAgent = bestAgents[Math.floor(Math.random() * bestAgents.length)];

    // Assign chat to selected agent (stays in AI mode until agent takes over)
    await Chat.findByIdAndUpdate(chatId, {
      assignedAgent: selectedAgent._id
    });

    return {
      agentId: selectedAgent._id.toString(),
      agentName: selectedAgent.name,
      workload: minWorkload
    };
  } catch (err) {
    console.error('Agent assignment error:', err);
    throw err;
  }
}

/**
 * Reassign chat from one agent to another (manual transfer)
 * @param {string} chatId - MongoDB ObjectId of the chat
 * @param {string} newAgentId - MongoDB ObjectId of the target agent
 * @returns {Promise<Object>} Success status and new agent info
 */
async function reassignChat(chatId, newAgentId) {
  try {
    // Validate new agent exists and is online
    const newAgent = await Agent.findOne({
      _id: newAgentId,
      status: 'online'
    }).select('name');

    if (!newAgent) {
      throw new Error('Agent not found or offline');
    }

    // Update chat assignment
    await Chat.findByIdAndUpdate(chatId, {
      assignedAgent: newAgentId
    });

    return {
      success: true,
      newAgent: {
        id: newAgent._id,
        name: newAgent.name
      }
    };
  } catch (err) {
    console.error('Chat reassignment error:', err);
    throw err;
  }
}

module.exports = { assignAgentToChat, reassignChat };
