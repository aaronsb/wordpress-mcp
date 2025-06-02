import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { PersonalityManager } from '../src/core/personality-manager.js';

describe('PersonalityManager', () => {
  let manager;

  before(async () => {
    manager = new PersonalityManager();
    await manager.loadPersonalities();
  });

  describe('loadPersonalities', () => {
    it('should load all three default personalities', () => {
      const personalities = manager.getAvailablePersonalities();
      assert.deepEqual(personalities.sort(), ['administrator', 'author', 'contributor']);
    });

    it('should load personality configurations', () => {
      const contributor = manager.getPersonality('contributor');
      assert.ok(contributor);
      assert.equal(contributor.name, 'Contributor');
      assert.ok(Array.isArray(contributor.features));
    });
  });

  describe('getPersonality', () => {
    it('should return personality configuration for valid name', () => {
      const author = manager.getPersonality('author');
      assert.ok(author);
      assert.equal(author.name, 'Author');
      assert.ok(author.features.includes('create-article'));
      assert.ok(author.features.includes('publish-workflow'));
    });

    it('should return null for invalid personality name', () => {
      const invalid = manager.getPersonality('invalid-personality');
      assert.equal(invalid, null);
    });
  });

  describe('personality feature sets', () => {
    it('contributor should have limited features', () => {
      const contributor = manager.getPersonality('contributor');
      assert.equal(contributor.features.length, 4);
      assert.ok(contributor.features.includes('draft-article'));
      assert.ok(!contributor.features.includes('publish-workflow'));
    });

    it('author should have more features than contributor', () => {
      const author = manager.getPersonality('author');
      const contributor = manager.getPersonality('contributor');
      assert.ok(author.features.length > contributor.features.length);
      assert.ok(author.features.includes('publish-workflow'));
    });

    it('administrator should have all features', () => {
      const admin = manager.getPersonality('administrator');
      assert.ok(admin.features.includes('bulk-content-operations'));
      assert.ok(admin.features.includes('manage-all-content'));
    });
  });
});
