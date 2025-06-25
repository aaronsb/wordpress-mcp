/**
 * List Editing Sessions Feature
 * 
 * List active editing sessions for management and cleanup
 */

export default {
  name: 'list-editing-sessions',
  description: 'List active editing sessions for management and cleanup',

  inputSchema: {
    type: 'object',
    properties: {},
  },

  async execute(params, context) {
    const { server } = context;

    // Get session manager
    const sessionManager = server.documentSessionManager;
    if (!sessionManager) {
      return {
        success: true,
        sessions: [],
        message: 'No document session manager active',
      };
    }

    // Get active sessions
    const sessions = sessionManager.getActiveSessions();

    return {
      success: true,
      sessionCount: sessions.length,
      sessions: sessions.map(session => ({
        ...session,
        age: Math.floor((Date.now() - new Date(session.created).getTime()) / 1000 / 60) + ' minutes',
      })),
      message: sessions.length === 0 
        ? 'No active editing sessions' 
        : `Found ${sessions.length} active editing session(s)`,
      suggestion: sessions.length > 0
        ? 'Use close-editing-session to clean up finished sessions'
        : 'Use pull-for-editing to start a new editing session',
    };
  },
};