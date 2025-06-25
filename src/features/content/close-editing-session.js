/**
 * Close Editing Session Feature
 * 
 * Close an editing session and clean up resources
 */

export default {
  name: 'close-editing-session',
  description: 'Close an editing session and clean up resources',

  inputSchema: {
    type: 'object',
    properties: {
      documentHandle: {
        type: 'string',
        description: 'Document handle to close',
      },
    },
    required: ['documentHandle'],
  },

  async execute(params, context) {
    const { server } = context;

    // Get session manager
    const sessionManager = server.documentSessionManager;
    if (!sessionManager) {
      throw new Error('No active document sessions.');
    }

    // Get session info before closing
    let sessionInfo;
    try {
      sessionInfo = await sessionManager.getSessionInfo(params.documentHandle);
    } catch (error) {
      throw new Error(`Session ${params.documentHandle} not found`);
    }

    // Check for unsaved changes
    const changes = await sessionManager.getChanges(params.documentHandle);
    if (changes.total > 0) {
      return {
        success: false,
        documentHandle: params.documentHandle,
        hasChanges: true,
        changes: {
          modified: changes.modified.length,
          added: changes.added.length,
          deleted: changes.deleted.length,
        },
        message: 'Session has unsaved changes',
        suggestion: 'Use sync-to-wordpress to save changes before closing, or close anyway by calling this again',
      };
    }

    // Close the session
    const result = await sessionManager.closeSession(params.documentHandle);

    return {
      success: true,
      documentHandle: params.documentHandle,
      contentId: sessionInfo.contentId,
      contentType: sessionInfo.contentType,
      message: result.message,
    };
  },
};