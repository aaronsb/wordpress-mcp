/**
 * Submit for Review Feature
 *
 * Submit a draft for editorial review - for contributors
 */

export default {
  name: 'submit-for-review',
  description: 'Submit a draft post for editorial review. Use this instead of changing post status manually - it handles the complete review workflow.',

  inputSchema: {
    type: 'object',
    properties: {
      postId: {
        type: 'number',
        description: 'ID of the draft post to submit',
      },
      note: {
        type: 'string',
        description: 'Note to editors (optional)',
      },
    },
    required: ['postId'],
  },

  async execute(params, context) {
    const { wpClient } = context;

    try {
      // First, verify the post exists and is a draft by the current user
      const post = await wpClient.executeFeature('resource-post', { id: params.postId });
      
      // Get current user to verify ownership
      const currentUser = await wpClient.executeFeature('resource-users/me');
      
      // Verify ownership and status
      if (post.author !== currentUser.id) {
        throw new Error('You can only submit your own drafts for review');
      }
      
      if (post.status !== 'draft') {
        throw new Error(`Post is already ${post.status}, only drafts can be submitted for review`);
      }

      // Check if post has minimum content for review
      const wordCount = this.estimateWordCount(post.content.rendered);
      if (wordCount < 10) {
        throw new Error('Post needs more content before submitting for review (minimum 10 words)');
      }

      // Update post status to "pending" using direct REST API
      // (Feature API doesn't expose update operations - Automattic's oversight!)
      const updateData = {
        status: 'pending',
      };

      // Add note as post meta if provided
      if (params.note) {
        updateData.meta = {
          _editorial_note: params.note,
        };
      }

      const updatedPost = await wpClient.updatePost(params.postId, updateData);

      return {
        success: true,
        postId: updatedPost.id,
        title: updatedPost.title.rendered,
        status: updatedPost.status,
        submittedAt: new Date().toISOString(),
        note: params.note || null,
        message: `"${updatedPost.title.rendered}" submitted for editorial review`,
        nextSteps: [
          'Editors will be notified of your submission',
          'You can check the status using view-editorial-feedback',
          'You may receive feedback or requests for changes',
        ],
      };
    } catch (error) {
      throw error;
    }
  },

  // Helper method to estimate word count
  estimateWordCount(htmlContent) {
    const textContent = htmlContent.replace(/<[^>]*>/g, ' ').trim();
    return textContent ? textContent.split(/\s+/).length : 0;
  },
};
