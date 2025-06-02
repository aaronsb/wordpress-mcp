import fetch from 'node-fetch';

export class WordPressClient {
  constructor(config) {
    this.baseUrl = config.url?.replace(/\/$/, ''); // Remove trailing slash
    this.auth = this.setupAuth(config);
    
    if (!this.baseUrl) {
      throw new Error('WordPress URL is required');
    }
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
        'Authorization': this.auth,
        'Content-Type': 'application/json',
        ...options.headers
      }
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

  // Post operations
  async createPost(data) {
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getPost(id) {
    return this.request(`/posts/${id}`);
  }

  async updatePost(id, data) {
    return this.request(`/posts/${id}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async deletePost(id, force = false) {
    return this.request(`/posts/${id}?force=${force}`, {
      method: 'DELETE'
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
        'Authorization': this.auth
      },
      body: formData
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
      body: JSON.stringify(data)
    });
  }

  // Tag operations
  async getTags() {
    return this.request('/tags');
  }

  async createTag(data) {
    return this.request('/tags', {
      method: 'POST',
      body: JSON.stringify(data)
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
      body: JSON.stringify({ status })
    });
  }

  // Settings (requires additional permissions)
  async getSettings() {
    return this.request('/settings');
  }

  async updateSettings(settings) {
    return this.request('/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  }
}