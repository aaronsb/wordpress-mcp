/**
 * Feature Mapper
 * 
 * Maps WordPress Feature API features to semantic operations.
 * This is where we fix Automattic's mistake of exposing every CRUD operation
 * as a separate tool.
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

export class FeatureMapper {
  constructor(wpClient) {
    this.wpClient = wpClient;
    this.featureMap = new Map();
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

    // Pull for Editing - fetch post into temp file for local editing
    this.featureMap.set('pull-for-editing', {
      name: 'Pull for Editing',
      description: 'Fetch a WordPress post into a local temp file for editing',
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

    // Sync to WordPress - push temp file changes back to WordPress
    this.featureMap.set('sync-to-wordpress', {
      name: 'Sync to WordPress',
      description: 'Push local temp file changes back to WordPress',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the temp file to sync' },
          cleanupFile: { type: 'boolean', description: 'Remove temp file after sync', default: false },
        },
        required: ['filePath'],
      },
      execute: async (params) => {
        return this.syncToWordPress(params);
      }
    });

    // Edit Document - edit temp files for the workflow
    this.featureMap.set('edit-document', {
      name: 'Edit Document',
      description: 'Edit a temp file by replacing exact string matches',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the temp file to edit' },
          oldString: { type: 'string', description: 'Exact string to find and replace' },
          newString: { type: 'string', description: 'String to replace with' },
          expectedReplacements: { type: 'number', description: 'Expected number of replacements', default: 1 },
        },
        required: ['filePath', 'oldString', 'newString'],
      },
      execute: async (params) => {
        return this.editDocument(params);
      }
    });

    // Read Document - read temp file contents with line numbers
    this.featureMap.set('read-document', {
      name: 'Read Document',
      description: 'Read a temp file with line numbers for editing',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the temp file to read' },
          offset: { type: 'number', description: 'Starting line number', default: 1 },
          limit: { type: 'number', description: 'Number of lines to read', default: 50 },
        },
        required: ['filePath'],
      },
      execute: async (params) => {
        return this.readDocument(params);
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
      
      // Ensure Documents directory exists
      const documentsDir = join(homedir(), 'Documents');
      if (!existsSync(documentsDir)) {
        await mkdir(documentsDir, { recursive: true });
      }

      // Create temp file name: wp-post-{id}-{timestamp}.md
      const timestamp = Date.now();
      const fileName = `wp-post-${params.postId}-${timestamp}.md`;
      const filePath = join(documentsDir, fileName);

      // Format content with metadata header
      const content = this.formatPostForEditing(post);
      
      // Write to temp file
      await writeFile(filePath, content, 'utf8');

      return {
        success: true,
        postId: params.postId,
        filePath: filePath,
        fileName: fileName,
        title: post.title.rendered,
        status: post.status,
        message: `Post pulled for editing: ${fileName}`,
      };
    } catch (error) {
      throw new Error(`Failed to pull post for editing: ${error.message}`);
    }
  }

  async syncToWordPress(params) {
    try {
      // Read the temp file
      const content = await readFile(params.filePath, 'utf8');
      
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

      // Clean up temp file if requested
      if (params.cleanupFile) {
        await import('fs/promises').then(fs => fs.unlink(params.filePath));
      }

      return {
        success: true,
        postId: postId,
        title: updatedPost.title.rendered,
        status: updatedPost.status,
        filePath: params.filePath,
        cleaned: params.cleanupFile || false,
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

    return `# ${post.title.rendered}

${post.content.rendered.replace(/<[^>]*>/g, '')}

---
**Post Metadata:**
- Post ID: ${post.id}
- Status: ${post.status}
- Categories: ${categories.join(', ')}
- Tags: ${tags.join(', ')}
- Excerpt: ${post.excerpt.rendered.replace(/<[^>]*>/g, '')}`;
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

    // Parse optional metadata
    const metadata = {};
    if (title) metadata.title = title;

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
      metadata.excerpt = excerptMatch[1];
    }

    return {
      postId,
      metadata,
      postContent: actualContent,
    };
  }

  async editDocument(params) {
    try {
      // Read the current file content
      const content = await readFile(params.filePath, 'utf8');
      
      // Count occurrences of the old string
      const occurrences = (content.match(new RegExp(params.oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      
      if (occurrences === 0) {
        throw new Error(`String not found: "${params.oldString}"`);
      }
      
      if (params.expectedReplacements && occurrences !== params.expectedReplacements) {
        throw new Error(`Expected ${params.expectedReplacements} replacements, but found ${occurrences} occurrences`);
      }
      
      // Perform the replacement
      const newContent = content.replace(new RegExp(params.oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), params.newString);
      
      // Write the updated content back
      await writeFile(params.filePath, newContent, 'utf8');
      
      // Get a snippet of the change for confirmation
      const lines = newContent.split('\n');
      const changeIndex = lines.findIndex(line => line.includes(params.newString));
      const startLine = Math.max(0, changeIndex - 2);
      const endLine = Math.min(lines.length, changeIndex + 3);
      const snippet = lines.slice(startLine, endLine)
        .map((line, i) => `${startLine + i + 1}: ${line}`)
        .join('\n');
      
      return {
        success: true,
        filePath: params.filePath,
        replacements: occurrences,
        message: `Successfully replaced ${occurrences} occurrence(s)`,
        snippet: snippet,
      };
    } catch (error) {
      throw new Error(`Failed to edit document: ${error.message}`);
    }
  }

  async readDocument(params) {
    try {
      // Read the file content
      const content = await readFile(params.filePath, 'utf8');
      const lines = content.split('\n');
      
      // Apply offset and limit
      const startIndex = (params.offset || 1) - 1;
      const limitCount = params.limit || 50;
      const endIndex = Math.min(lines.length, startIndex + limitCount);
      
      // Format with line numbers (cat -n style)
      const numberedLines = lines.slice(startIndex, endIndex)
        .map((line, i) => {
          const lineNum = startIndex + i + 1;
          return `${lineNum.toString().padStart(6)}\t${line}`;
        })
        .join('\n');
      
      return {
        success: true,
        filePath: params.filePath,
        totalLines: lines.length,
        startLine: startIndex + 1,
        endLine: endIndex,
        content: numberedLines,
      };
    } catch (error) {
      throw new Error(`Failed to read document: ${error.message}`);
    }
  }
}