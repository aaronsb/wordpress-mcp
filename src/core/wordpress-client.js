import fetch from 'node-fetch';

export class WordPressClient {
  constructor(config) {
    this.baseUrl = config.url?.replace(/\/$/, ''); // Remove trailing slash
    this.auth = this.setupAuth(config);

    if (!this.baseUrl) {
      throw new Error('WordPress URL is required');
    }
    
    // Cache for discovered features
    this.featuresCache = null;
    this.featuresCacheTime = 0;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  setupAuth(config) {
    // Support both Application Passwords (preferred) and basic auth
    if (config.applicationPassword) {
      // Application passwords are base64 encoded username:password
      // Remove spaces from the application password
      const appPassword = config.applicationPassword.replace(/\s/g, '');
      const credentials = `${config.username}:${appPassword}`;
      return `Basic ${Buffer.from(credentials).toString('base64')}`;
    } else if (config.username && config.password) {
      const credentials = `${config.username}:${config.password}`;
      return `Basic ${Buffer.from(credentials).toString('base64')}`;
    }

    throw new Error('WordPress authentication credentials required');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/wp-json/wp/v2${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.auth,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Let WordPress errors bubble up with context
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const wpError = new Error(error.message || `WordPress API error: ${response.status}`);
      wpError.status = response.status;
      wpError.code = error.code;
      wpError.data = error.data;
      throw wpError;
    }

    return response.json();
  }

  // Feature API methods
  async discoverFeatures(useCache = true) {
    // Check cache first
    if (useCache && this.featuresCache && Date.now() - this.featuresCacheTime < this.CACHE_DURATION) {
      return this.featuresCache;
    }

    try {
      const features = await this.request('/features');
      this.featuresCache = features;
      this.featuresCacheTime = Date.now();
      return features;
    } catch (error) {
      console.error('Failed to discover features:', error.message);
      return [];
    }
  }

  async getFeature(featureId) {
    const features = await this.discoverFeatures();
    return features.find(f => f.id === featureId);
  }

  async executeFeature(featureId, params = {}) {
    const feature = await this.getFeature(featureId);
    if (!feature) {
      throw new Error(`Feature ${featureId} not found`);
    }

    // Find the run link
    const runLink = feature._links?.run?.[0];
    if (!runLink) {
      throw new Error(`Feature ${featureId} has no run link`);
    }

    // Execute based on method
    const method = runLink.method || 'GET';
    const url = runLink.href;
    
    if (method === 'GET') {
      // For GET requests, add params as query string
      const query = new URLSearchParams(params).toString();
      const fullUrl = query ? `${url}?${query}` : url;
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          Authorization: this.auth,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Feature execution failed: ${response.status}`);
      }

      return response.json();
    } else {
      // For POST requests, send params as body
      const response = await fetch(url, {
        method: method,
        headers: {
          Authorization: this.auth,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Feature execution failed: ${response.status}`);
      }

      return response.json();
    }
  }

  // Post operations
  async createPost(data) {
    // WordPress REST API expects title and content as objects with 'raw' property
    const postData = {
      ...data,
      title: typeof data.title === 'string' ? { raw: data.title } : data.title,
      content: typeof data.content === 'string' ? { raw: data.content } : data.content,
    };
    
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify(postData),
    });
  }

  async getPost(id) {
    return this.request(`/posts/${id}`);
  }

  async updatePost(id, data) {
    // WordPress REST API expects title and content as objects with 'raw' property
    const postData = { ...data };
    if (data.title && typeof data.title === 'string') {
      postData.title = { raw: data.title };
    }
    if (data.content && typeof data.content === 'string') {
      postData.content = { raw: data.content };
    }
    
    return this.request(`/posts/${id}`, {
      method: 'POST',
      body: JSON.stringify(postData),
    });
  }

  async deletePost(id, force = false) {
    return this.request(`/posts/${id}?force=${force}`, {
      method: 'DELETE',
    });
  }

  async listPosts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/posts${query ? `?${query}` : ''}`);
  }

  // Media operations
  async uploadMedia(file, filename) {
    // Media upload requires multipart form data
    const formData = new FormData();
    formData.append('file', file, filename);

    const response = await fetch(`${this.baseUrl}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: this.auth,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Media upload failed');
    }

    return response.json();
  }

  // User operations
  async getCurrentUser() {
    return this.request('/users/me');
  }

  async getUser(id) {
    return this.request(`/users/${id}`);
  }

  // Category operations
  async getCategories() {
    return this.request('/categories');
  }

  async createCategory(data) {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Tag operations
  async getTags() {
    return this.request('/tags');
  }

  async createTag(data) {
    return this.request('/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Comment operations
  async getComments(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/comments${query ? `?${query}` : ''}`);
  }

  async moderateComment(id, status) {
    return this.request(`/comments/${id}`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  // Settings (requires additional permissions)
  async getSettings() {
    return this.request('/settings');
  }

  async updateSettings(settings) {
    return this.request('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }
}
