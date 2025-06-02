/**
 * Feature Mapper
 * 
 * Maps WordPress Feature API features to semantic operations.
 * This is where we fix Automattic's mistake of exposing every CRUD operation
 * as a separate tool.
 */

import { DocumentSessionManager } from './document-session-manager.js';

export class FeatureMapper {
  constructor(wpClient) {
    this.wpClient = wpClient;
    this.featureMap = new Map();
    this.sessionManager = new DocumentSessionManager();
  }

  async initialize() {
    // Discover available WordPress features
    const wpFeatures = await this.wpClient.discoverFeatures();
    
    // Group them into semantic operations
    this.mapSemanticOperations(wpFeatures);
    
    console.error(`Mapped ${wpFeatures.length} WordPress features into ${this.featureMap.size} semantic operations`);
  }

  mapSemanticOperations(wpFeatures) {
    // Create a map of feature types for easy lookup
    const featuresByType = this.groupFeaturesByType(wpFeatures);
    
    // Map semantic operations based on available features
    if (featuresByType.posts) {
      this.createPostOperations(featuresByType.posts);
    }
    
    if (featuresByType.media) {
      this.createMediaOperations(featuresByType.media);
    }
    
    if (featuresByType.users) {
      this.createUserOperations(featuresByType.users);
    }
  }

  groupFeaturesByType(features) {
    const grouped = {};
    
    features.forEach(feature => {
      // Extract type from feature ID (e.g., "tool-posts" -> "posts")
      const match = feature.id.match(/^(tool|resource)-(.+?)(?:\/|$)/);
      if (match) {
        const type = match[2];
        if (!grouped[type]) {
          grouped[type] = {};
        }
        
        // Store by operation type
        const opType = feature.type === 'tool' ? 'create' : 'read';
        grouped[type][opType] = feature;
      }
    });
    
    return grouped;
  }

  createPostOperations(postFeatures) {
    // Draft Article - combines post creation with proper status
    if (postFeatures.create) {
      this.featureMap.set('draft-article', {
        name: 'Draft Article',
        description: 'Create a draft article with categories and tags',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Article title' },
            content: { type: 'string', description: 'Article content' },
            excerpt: { type: 'string', description: 'Brief summary' },
            categories: { type: 'array', items: { type: 'string' }, description: 'Category names' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tag names' },
          },
          required: ['title', 'content'],
        },
        execute: async (params) => {
          return this.createDraftArticle(params);
        }
      });
    }

    // Publish Article - creates and publishes in one go
    if (postFeatures.create) {
      this.featureMap.set('publish-article', {
        name: 'Publish Article',
        description: 'Create and publish an article immediately with all metadata',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Article title' },
            content: { type: 'string', description: 'Article content' },
            excerpt: { type: 'string', description: 'Brief summary' },
            featuredImageUrl: { type: 'string', description: 'URL of featured image to upload' },
            categories: { type: 'array', items: { type: 'string' }, description: 'Category names' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tag names' },
          },
          required: ['title', 'content'],
        },
        execute: async (params) => {
          return this.publishArticle(params);
        }
      });
    }

    // Edit Draft - semantic editing of existing drafts
    this.featureMap.set('edit-draft', {
      name: 'Edit Draft',
      description: 'Edit an existing draft post with content and metadata',
      inputSchema: {
        type: 'object',
        properties: {
          postId: { type: 'number', description: 'ID of the draft to edit' },
          title: { type: 'string', description: 'New title (optional)' },
          content: { type: 'string', description: 'New content (optional)' },
          excerpt: { type: 'string', description: 'New excerpt (optional)' },
          categories: { type: 'array', items: { type: 'string' }, description: 'Category names' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tag names' },
        },
        required: ['postId'],
      },
      execute: async (params) => {
        return this.editDraft(params);
      }
    });

    // Pull for Editing - fetch post into editing session (filesystem abstracted)
    this.featureMap.set('pull-for-editing', {
      name: 'Pull for Editing',
      description: 'Fetch a WordPress post into an editing session',
      inputSchema: {
        type: 'object',
        properties: {
          postId: { type: 'number', description: 'ID of the post to pull for editing' },
        },
        required: ['postId'],
      },
      execute: async (params) => {
        return this.pullForEditing(params);
      }
    });

    // Sync to WordPress - push editing session changes back to WordPress
    this.featureMap.set('sync-to-wordpress', {
      name: 'Sync to WordPress',
      description: 'Push editing session changes back to WordPress',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          closeSession: { type: 'boolean', description: 'Close editing session after sync', default: true },
        },
        required: ['documentHandle'],
      },
      execute: async (params) => {
        return this.syncToWordPress(params);
      }
    });

    // Edit Document - edit document by handle using string replacement
    this.featureMap.set('edit-document', {
      name: 'Edit Document',
      description: 'Edit a document by replacing exact string matches',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          oldString: { type: 'string', description: 'Exact string to find and replace' },
          newString: { type: 'string', description: 'String to replace with' },
          expectedReplacements: { type: 'number', description: 'Expected number of replacements', default: 1 },
        },
        required: ['documentHandle', 'oldString', 'newString'],
      },
      execute: async (params) => {
        return this.sessionManager.editDocument(
          params.documentHandle, 
          params.oldString, 
          params.newString, 
          params.expectedReplacements
        );
      }
    });

    // Read Document - read document contents with line numbers
    this.featureMap.set('read-document', {
      name: 'Read Document',
      description: 'Read a document with line numbers for editing',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          offset: { type: 'number', description: 'Starting line number', default: 1 },
          limit: { type: 'number', description: 'Number of lines to read', default: 50 },
        },
        required: ['documentHandle'],
      },
      execute: async (params) => {
        return this.sessionManager.readDocument(
          params.documentHandle, 
          params.offset, 
          params.limit
        );
      }
    });

    // Edit Document Line - line-based editing for better reliability
    this.featureMap.set('edit-document-line', {
      name: 'Edit Document Line',
      description: 'Replace an entire line in the document by line number',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          lineNumber: { type: 'number', description: 'Line number to replace (1-based)' },
          newLine: { type: 'string', description: 'New content for the line' },
        },
        required: ['documentHandle', 'lineNumber', 'newLine'],
      },
      execute: async (params) => {
        return this.sessionManager.editDocumentLine(
          params.documentHandle,
          params.lineNumber,
          params.newLine
        );
      }
    });

    // Insert at Line - add content at specific position
    this.featureMap.set('insert-at-line', {
      name: 'Insert at Line',
      description: 'Insert content before a specific line number',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          lineNumber: { type: 'number', description: 'Line number to insert before (1-based)' },
          content: { type: 'string', description: 'Content to insert' },
        },
        required: ['documentHandle', 'lineNumber', 'content'],
      },
      execute: async (params) => {
        return this.sessionManager.insertAtLine(
          params.documentHandle,
          params.lineNumber,
          params.content
        );
      }
    });

    // Replace Lines - replace a range of lines
    this.featureMap.set('replace-lines', {
      name: 'Replace Lines',
      description: 'Replace a range of lines with new content',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          startLine: { type: 'number', description: 'First line to replace (1-based)' },
          endLine: { type: 'number', description: 'Last line to replace (inclusive)' },
          newContent: { type: 'string', description: 'New content to replace the lines with' },
        },
        required: ['documentHandle', 'startLine', 'endLine', 'newContent'],
      },
      execute: async (params) => {
        return this.sessionManager.replaceLines(
          params.documentHandle,
          params.startLine,
          params.endLine,
          params.newContent
        );
      }
    });

    // Search Replace - flexible search and replace with context
    this.featureMap.set('search-replace', {
      name: 'Search Replace',
      description: 'Search and replace text with optional line context',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle from pull-for-editing' },
          searchTerm: { type: 'string', description: 'Text to search for' },
          replacement: { type: 'string', description: 'Text to replace with' },
          nearLine: { type: 'number', description: 'Optional: only search within 5 lines of this line number' },
          maxReplacements: { type: 'number', description: 'Maximum replacements to make', default: 1 },
        },
        required: ['documentHandle', 'searchTerm', 'replacement'],
      },
      execute: async (params) => {
        return this.sessionManager.searchReplace(
          params.documentHandle,
          params.searchTerm,
          params.replacement,
          {
            nearLine: params.nearLine,
            maxReplacements: params.maxReplacements
          }
        );
      }
    });

    // List Active Sessions - show active editing sessions (for management)
    this.featureMap.set('list-editing-sessions', {
      name: 'List Editing Sessions',
      description: 'List active editing sessions for management and cleanup',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async (params) => {
        const sessions = this.sessionManager.getActiveSessions();
        return {
          success: true,
          sessions: sessions,
          message: `Found ${sessions.length} active editing session(s)`,
        };
      }
    });

    // Close Editing Session - manually close an editing session
    this.featureMap.set('close-editing-session', {
      name: 'Close Editing Session',
      description: 'Close an editing session and clean up resources',
      inputSchema: {
        type: 'object',
        properties: {
          documentHandle: { type: 'string', description: 'Document handle to close' },
        },
        required: ['documentHandle'],
      },
      execute: async (params) => {
        return this.sessionManager.closeSession(params.documentHandle);
      }
    });
  }
  
  createMediaOperations(mediaFeatures) {
    // Upload Media with Article Context - for authors
    this.featureMap.set('upload-featured-image', {
      name: 'Upload Featured Image',
      description: 'Upload an image from URL to use as featured image',
      inputSchema: {
        type: 'object',
        properties: {
          imageUrl: { type: 'string', description: 'URL of image to upload' },
          title: { type: 'string', description: 'Title for the image' },
          altText: { type: 'string', description: 'Alt text for accessibility' },
        },
        required: ['imageUrl'],
      },
      execute: async (params) => {
        return this.uploadImageFromUrl(params);
      }
    });

    // Manage Media Library - for authors
    this.featureMap.set('manage-media', {
      name: 'Manage Media',
      description: 'List and search media items in library',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Search term for media' },
          mediaType: { type: 'string', enum: ['image', 'video', 'audio', 'document'], description: 'Filter by media type' },
          perPage: { type: 'number', description: 'Number of items to return', default: 10 },
        },
        required: [],
      },
      execute: async (params) => {
        return this.listMedia(params);
      }
    });
  }
  
  createUserOperations(userFeatures) {
    // Editorial Review Workflow - for editors
    this.featureMap.set('review-content', {
      name: 'Review Content',
      description: 'Review and manage pending posts and comments',
      inputSchema: {
        type: 'object',
        properties: {
          contentType: { type: 'string', enum: ['posts', 'comments'], description: 'Type of content to review' },
          status: { type: 'string', enum: ['pending', 'draft'], description: 'Status filter' },
          perPage: { type: 'number', description: 'Number of items to return', default: 10 },
        },
        required: ['contentType'],
      },
      execute: async (params) => {
        return this.reviewContent(params);
      }
    });

    // Moderate Comments - for editors
    this.featureMap.set('moderate-comments', {
      name: 'Moderate Comments',
      description: 'Approve, reject, or manage comments in bulk',
      inputSchema: {
        type: 'object',
        properties: {
          commentIds: { type: 'array', items: { type: 'number' }, description: 'IDs of comments to moderate' },
          action: { type: 'string', enum: ['approve', 'hold', 'spam', 'trash'], description: 'Moderation action' },
          reason: { type: 'string', description: 'Optional reason for action' },
        },
        required: ['commentIds', 'action'],
      },
      execute: async (params) => {
        return this.moderateComments(params);
      }
    });

    // Manage Categories - for editors
    this.featureMap.set('manage-categories', {
      name: 'Manage Categories',
      description: 'Create, update, and organize content categories',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'create', 'update', 'delete'], description: 'Category action' },
          categoryId: { type: 'number', description: 'Category ID (for update/delete)' },
          name: { type: 'string', description: 'Category name' },
          description: { type: 'string', description: 'Category description' },
          parentId: { type: 'number', description: 'Parent category ID' },
        },
        required: ['action'],
      },
      execute: async (params) => {
        return this.manageCategories(params);
      }
    });
  }
  
  getSemanticOperations() {
    return Array.from(this.featureMap.values());
  }
  
  getOperation(name) {
    return this.featureMap.get(name);
  }

  // Implementation methods for semantic operations
  
  async createDraftArticle(params) {
    try {
      // Prepare the base post data
      const postData = {
        title: { raw: params.title },
        content: { raw: params.content },
        status: 'draft',
        excerpt: params.excerpt ? { raw: params.excerpt } : undefined,
      };

      // Handle categories if provided
      if (params.categories && params.categories.length > 0) {
        postData.categories = await this.resolveCategories(params.categories);
      }

      // Handle tags if provided
      if (params.tags && params.tags.length > 0) {
        postData.tags = await this.resolveTags(params.tags);
      }

      // Create post using Feature API if available, otherwise use REST API
      let post;
      try {
        post = await this.wpClient.executeFeature('tool-posts', postData);
      } catch (error) {
        // Fallback to direct REST API
        post = await this.wpClient.createPost(postData);
      }

      return {
        success: true,
        postId: post.id,
        title: post.title.rendered,
        status: post.status,
        editLink: post.link.replace(this.wpClient.baseUrl, '') + '?preview=true',
        message: `Draft created successfully: "${params.title}"`,
      };
    } catch (error) {
      throw new Error(`Failed to create draft: ${error.message}`);
    }
  }

  async publishArticle(params) {
    try {
      let featuredMediaId = 0;
      
      // Upload featured image if provided
      if (params.featuredImageUrl) {
        try {
          const imageResponse = await fetch(params.featuredImageUrl);
          if (imageResponse.ok) {
            const imageBlob = await imageResponse.blob();
            const filename = params.featuredImageUrl.split('/').pop() || 'featured-image.jpg';
            const media = await this.wpClient.uploadMedia(imageBlob, filename);
            featuredMediaId = media.id;
          }
        } catch (error) {
          console.warn('Failed to upload featured image:', error.message);
        }
      }

      const postData = {
        title: { raw: params.title },
        content: { raw: params.content },
        status: 'publish',
        excerpt: params.excerpt ? { raw: params.excerpt } : undefined,
        featured_media: featuredMediaId,
      };

      // Handle categories and tags
      if (params.categories && params.categories.length > 0) {
        postData.categories = await this.resolveCategories(params.categories);
      }
      if (params.tags && params.tags.length > 0) {
        postData.tags = await this.resolveTags(params.tags);
      }

      // Create and publish post
      let post;
      try {
        post = await this.wpClient.executeFeature('tool-posts', postData);
      } catch (error) {
        post = await this.wpClient.createPost(postData);
      }

      return {
        success: true,
        postId: post.id,
        title: post.title.rendered,
        status: post.status,
        link: post.link,
        message: `Article published successfully: "${params.title}"`,
      };
    } catch (error) {
      throw new Error(`Failed to publish article: ${error.message}`);
    }
  }

  async editDraft(params) {
    try {
      const updateData = {};
      
      if (params.title) updateData.title = { raw: params.title };
      if (params.content) updateData.content = { raw: params.content };
      if (params.excerpt) updateData.excerpt = { raw: params.excerpt };

      // Handle categories and tags
      if (params.categories && params.categories.length > 0) {
        updateData.categories = await this.resolveCategories(params.categories);
      }
      if (params.tags && params.tags.length > 0) {
        updateData.tags = await this.resolveTags(params.tags);
      }

      const post = await this.wpClient.updatePost(params.postId, updateData);

      return {
        success: true,
        postId: post.id,
        title: post.title.rendered,
        status: post.status,
        editLink: post.link.replace(this.wpClient.baseUrl, '') + '?preview=true',
        message: `Draft updated successfully`,
      };
    } catch (error) {
      throw new Error(`Failed to edit draft: ${error.message}`);
    }
  }

  async resolveCategories(categoryNames) {
    const categoryIds = [];
    const existingCategories = await this.wpClient.getCategories();

    for (const name of categoryNames) {
      if (typeof name === 'number') {
        categoryIds.push(name);
        continue;
      }

      const existing = existingCategories.find(
        cat => cat.name.toLowerCase() === name.toLowerCase()
      );

      if (existing) {
        categoryIds.push(existing.id);
      } else {
        // Try to create new category (requires permission)
        try {
          const newCat = await this.wpClient.createCategory({ name });
          categoryIds.push(newCat.id);
        } catch (error) {
          console.warn(`Cannot create category "${name}": ${error.message}`);
        }
      }
    }

    return categoryIds;
  }

  async resolveTags(tagNames) {
    const tagIds = [];

    for (const name of tagNames) {
      try {
        // Try to create tag (will return existing if it exists)
        const tag = await this.wpClient.createTag({ name });
        tagIds.push(tag.id);
      } catch (error) {
        // If creation fails, try to find existing
        const existingTags = await this.wpClient.getTags();
        const existing = existingTags.find(
          tag => tag.name.toLowerCase() === name.toLowerCase()
        );
        if (existing) {
          tagIds.push(existing.id);
        }
      }
    }

    return tagIds;
  }

  async uploadImageFromUrl(params) {
    try {
      const response = await fetch(params.imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const imageBlob = await response.blob();
      const filename = params.imageUrl.split('/').pop() || 'uploaded-image.jpg';
      
      const media = await this.wpClient.uploadMedia(imageBlob, filename);
      
      // Update alt text and title if provided
      if (params.title || params.altText) {
        const updateData = {};
        if (params.title) updateData.title = { raw: params.title };
        if (params.altText) updateData.alt_text = params.altText;
        
        await this.wpClient.request(`/media/${media.id}`, {
          method: 'POST',
          body: JSON.stringify(updateData),
        });
      }

      return {
        success: true,
        mediaId: media.id,
        url: media.source_url,
        title: media.title.rendered,
        message: `Image uploaded successfully`,
      };
    } catch (error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  async listMedia(params) {
    try {
      const queryParams = {
        per_page: params.perPage || 10,
      };
      
      if (params.search) {
        queryParams.search = params.search;
      }
      
      if (params.mediaType) {
        queryParams.media_type = params.mediaType;
      }

      const media = await this.wpClient.request('/media?' + new URLSearchParams(queryParams));

      return {
        success: true,
        count: media.length,
        media: media.map(item => ({
          id: item.id,
          title: item.title.rendered,
          url: item.source_url,
          type: item.media_type,
          mimeType: item.mime_type,
          uploadDate: item.date,
        })),
      };
    } catch (error) {
      throw new Error(`Failed to list media: ${error.message}`);
    }
  }

  async reviewContent(params) {
    try {
      if (params.contentType === 'posts') {
        const queryParams = {
          status: params.status || 'pending',
          per_page: params.perPage || 10,
        };

        const posts = await this.wpClient.request('/posts?' + new URLSearchParams(queryParams));

        return {
          success: true,
          contentType: 'posts',
          count: posts.length,
          items: posts.map(post => ({
            id: post.id,
            title: post.title.rendered,
            author: post.author,
            status: post.status,
            date: post.date,
            excerpt: post.excerpt.rendered,
            link: post.link,
          })),
        };
      } else if (params.contentType === 'comments') {
        const queryParams = {
          status: params.status || 'hold',
          per_page: params.perPage || 10,
        };

        const comments = await this.wpClient.getComments(queryParams);

        return {
          success: true,
          contentType: 'comments',
          count: comments.length,
          items: comments.map(comment => ({
            id: comment.id,
            post: comment.post,
            author: comment.author_name,
            content: comment.content.rendered,
            status: comment.status,
            date: comment.date,
          })),
        };
      }
    } catch (error) {
      throw new Error(`Failed to review content: ${error.message}`);
    }
  }

  async moderateComments(params) {
    try {
      const results = [];
      
      for (const commentId of params.commentIds) {
        try {
          await this.wpClient.moderateComment(commentId, params.action);
          results.push({ id: commentId, success: true, action: params.action });
        } catch (error) {
          results.push({ id: commentId, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;

      return {
        success: true,
        action: params.action,
        processed: results.length,
        successful: successCount,
        failed: results.length - successCount,
        results: results,
        message: `${successCount} comments ${params.action}ed successfully`,
      };
    } catch (error) {
      throw new Error(`Failed to moderate comments: ${error.message}`);
    }
  }

  async manageCategories(params) {
    try {
      switch (params.action) {
        case 'list':
          const categories = await this.wpClient.getCategories();
          return {
            success: true,
            action: 'list',
            count: categories.length,
            categories: categories.map(cat => ({
              id: cat.id,
              name: cat.name,
              description: cat.description,
              count: cat.count,
              parent: cat.parent,
            })),
          };

        case 'create':
          const newCategory = await this.wpClient.createCategory({
            name: params.name,
            description: params.description || '',
            parent: params.parentId || 0,
          });
          return {
            success: true,
            action: 'create',
            categoryId: newCategory.id,
            name: newCategory.name,
            message: `Category "${params.name}" created successfully`,
          };

        case 'update':
          const updateData = {};
          if (params.name) updateData.name = params.name;
          if (params.description) updateData.description = params.description;
          if (params.parentId) updateData.parent = params.parentId;

          const updatedCategory = await this.wpClient.request(`/categories/${params.categoryId}`, {
            method: 'POST',
            body: JSON.stringify(updateData),
          });

          return {
            success: true,
            action: 'update',
            categoryId: updatedCategory.id,
            name: updatedCategory.name,
            message: `Category updated successfully`,
          };

        case 'delete':
          await this.wpClient.request(`/categories/${params.categoryId}`, {
            method: 'DELETE',
          });
          
          return {
            success: true,
            action: 'delete',
            categoryId: params.categoryId,
            message: `Category deleted successfully`,
          };

        default:
          throw new Error(`Unknown action: ${params.action}`);
      }
    } catch (error) {
      throw new Error(`Failed to manage categories: ${error.message}`);
    }
  }

  // Temp file workflow methods

  async pullForEditing(params) {
    try {
      // Fetch the post from WordPress
      const post = await this.wpClient.getPost(params.postId);
      
      // Format content with metadata header
      const content = this.formatPostForEditing(post);
      
      // Create editing session (filesystem abstracted)
      const session = await this.sessionManager.createSession(
        params.postId, 
        content, 
        {
          title: post.title.rendered,
          status: post.status
        }
      );

      return session;
    } catch (error) {
      throw new Error(`Failed to pull post for editing: ${error.message}`);
    }
  }

  async syncToWordPress(params) {
    try {
      // Get document content using session manager (filesystem abstracted)
      const content = await this.sessionManager.getDocumentContent(params.documentHandle);
      
      // Parse the content to extract metadata and post content
      const { postId, metadata, postContent } = this.parseEditedFile(content);

      // Prepare update data
      const updateData = {
        content: { raw: postContent },
      };

      // Add metadata if present
      if (metadata.title) updateData.title = { raw: metadata.title };
      if (metadata.excerpt) updateData.excerpt = { raw: metadata.excerpt };
      if (metadata.categories) updateData.categories = await this.resolveCategories(metadata.categories);
      if (metadata.tags) updateData.tags = await this.resolveTags(metadata.tags);

      // Update the post
      const updatedPost = await this.wpClient.updatePost(postId, updateData);

      // Close session if requested (default: true)
      if (params.closeSession !== false) {
        await this.sessionManager.closeSession(params.documentHandle);
      }

      return {
        success: true,
        postId: postId,
        title: updatedPost.title.rendered,
        status: updatedPost.status,
        documentHandle: params.documentHandle,
        sessionClosed: params.closeSession !== false,
        message: `Post synced to WordPress successfully`,
      };
    } catch (error) {
      throw new Error(`Failed to sync to WordPress: ${error.message}`);
    }
  }

  formatPostForEditing(post) {
    // Extract categories and tags
    const categories = post._embedded?.['wp:term']?.[0]?.map(cat => cat.name) || [];
    const tags = post._embedded?.['wp:term']?.[1]?.map(tag => tag.name) || [];

    // Convert WordPress HTML to clean markdown for AI editing
    // "It's the thought that counts" - focus on content, not encoding
    const cleanTitle = this.sessionManager.htmlToMarkdown(post.title.rendered);
    const cleanContent = this.sessionManager.htmlToMarkdown(post.content.rendered);
    const cleanExcerpt = this.sessionManager.htmlToMarkdown(post.excerpt.rendered);

    return `# ${cleanTitle}

${cleanContent}

---
**Post Metadata:**
- Post ID: ${post.id}
- Status: ${post.status}
- Categories: ${categories.join(', ')}
- Tags: ${tags.join(', ')}
- Excerpt: ${cleanExcerpt}`;
  }

  parseEditedFile(content) {
    // Split content at the metadata divider
    const parts = content.split('---\n**Post Metadata:**');
    
    if (parts.length !== 2) {
      throw new Error('Invalid temp file format - missing metadata section');
    }

    const postContent = parts[0].trim();
    const metadataSection = parts[1];

    // Extract post ID from metadata
    const postIdMatch = metadataSection.match(/- Post ID: (\d+)/);
    if (!postIdMatch) {
      throw new Error('Could not find Post ID in temp file');
    }
    const postId = parseInt(postIdMatch[1]);

    // Extract title (first line should be # Title)
    const titleMatch = postContent.match(/^# (.+)$/m);
    const title = titleMatch ? titleMatch[1] : null;

    // Remove title from content if present
    const actualContent = titleMatch ? 
      postContent.replace(/^# .+$\n\n?/m, '') : 
      postContent;

    // Convert markdown back to HTML for WordPress
    // "It's the thought that counts" - preserve meaning, handle encoding
    const htmlContent = this.sessionManager.markdownToHtml(actualContent);

    // Parse optional metadata
    const metadata = {};
    if (title) {
      // Convert title markdown to HTML if needed
      metadata.title = this.sessionManager.markdownToHtml(title);
    }

    const categoriesMatch = metadataSection.match(/- Categories: (.+)/);
    if (categoriesMatch && categoriesMatch[1].trim() !== '') {
      metadata.categories = categoriesMatch[1].split(', ').map(cat => cat.trim());
    }

    const tagsMatch = metadataSection.match(/- Tags: (.+)/);
    if (tagsMatch && tagsMatch[1].trim() !== '') {
      metadata.tags = tagsMatch[1].split(', ').map(tag => tag.trim());
    }

    const excerptMatch = metadataSection.match(/- Excerpt: (.+)/);
    if (excerptMatch && excerptMatch[1].trim() !== '') {
      // Convert excerpt markdown to HTML if needed
      metadata.excerpt = this.sessionManager.markdownToHtml(excerptMatch[1]);
    }

    return {
      postId,
      metadata,
      postContent: htmlContent, // Now returns HTML, not raw markdown
    };
  }

}