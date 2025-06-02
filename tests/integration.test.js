import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { config } from 'dotenv';
import { WordPressClient } from '../src/core/wordpress-client.js';
import { FeatureRegistry } from '../src/core/feature-registry.js';

config();

describe('Integration Tests', { skip: !process.env.WORDPRESS_URL }, () => {
  let wpClient;
  let featureRegistry;
  const testPostIds = [];

  before(async () => {
    wpClient = new WordPressClient({
      url: process.env.WORDPRESS_URL,
      username: process.env.WORDPRESS_USERNAME,
      applicationPassword: process.env.WORDPRESS_APP_PASSWORD,
    });

    featureRegistry = new FeatureRegistry(wpClient);
    await featureRegistry.loadFeatures();
  });

  after(async () => {
    // Cleanup test posts
    for (const postId of testPostIds) {
      try {
        await wpClient.deletePost(postId, true);
      } catch (error) {
        console.error(`Failed to delete test post ${postId}`);
      }
    }
  });

  describe('WordPress Connection', () => {
    it('should authenticate with WordPress', async () => {
      const user = await wpClient.getCurrentUser();
      assert.ok(user);
      assert.ok(user.id);
      assert.ok(user.name);
    });

    it('should fetch posts from WordPress', async () => {
      const posts = await wpClient.listPosts({ per_page: 5 });
      assert.ok(Array.isArray(posts));
    });
  });

  describe('Draft Article Feature', () => {
    it('should create a draft post', async () => {
      const feature = featureRegistry.getFeature('draft-article');
      const result = await feature.execute(
        {
          title: 'Integration Test Draft',
          content: 'This is a test draft from integration tests',
          excerpt: 'Test excerpt',
        },
        { wpClient }
      );

      assert.ok(result.success);
      assert.ok(result.postId);
      testPostIds.push(result.postId);

      // Verify the post was created
      const post = await wpClient.getPost(result.postId);
      assert.equal(post.status, 'draft');
      assert.equal(post.title.rendered, 'Integration Test Draft');
    });
  });

  describe('Edit Draft Feature', () => {
    it('should edit an existing draft', async () => {
      // First create a draft
      const createFeature = featureRegistry.getFeature('draft-article');
      const createResult = await createFeature.execute(
        {
          title: 'Draft to Edit',
          content: 'Original content',
        },
        { wpClient }
      );

      testPostIds.push(createResult.postId);

      // Then edit it
      const editFeature = featureRegistry.getFeature('edit-draft');
      const editResult = await editFeature.execute(
        {
          postId: createResult.postId,
          title: 'Edited Draft',
          content: 'Updated content',
        },
        { wpClient }
      );

      assert.ok(editResult.success);

      // Verify the changes
      const post = await wpClient.getPost(createResult.postId);
      assert.equal(post.title.rendered, 'Edited Draft');
    });
  });
});
