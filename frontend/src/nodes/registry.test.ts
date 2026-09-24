import { describe, expect, it } from 'vitest';
import {
  ALL_NODE_DEFINITIONS,
  buildDefaultConfig,
  getCategoryLabel,
  getNodeDefinition,
  getNodeDefinitionsByCategory,
  NODE_CATEGORIES,
} from './registry';

describe('node registry', () => {
  it('registers 24 node types with unique ids', () => {
    expect(ALL_NODE_DEFINITIONS).toHaveLength(24);
    const types = ALL_NODE_DEFINITIONS.map((d) => d.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('covers all five categories', () => {
    expect(NODE_CATEGORIES.map((c) => c.id).sort()).toEqual([
      'orchestration',
      'processing',
      'quality',
      'sources',
      'storage',
    ]);
    for (const category of NODE_CATEGORIES) {
      expect(getNodeDefinitionsByCategory(category.id).length).toBeGreaterThan(0);
    }
  });

  it('looks up definitions by type', () => {
    const restApi = getNodeDefinition('rest-api');
    expect(restApi?.label).toBe('REST API');
    expect(restApi?.category).toBe('sources');
    expect(getNodeDefinition('does-not-exist')).toBeUndefined();
  });

  it('labels categories', () => {
    expect(getCategoryLabel('quality')).toBe('Data Quality');
    expect(getCategoryLabel('sources')).toBe('Sources');
  });

  it('builds default config from schema', () => {
    const restApi = getNodeDefinition('rest-api');
    expect(restApi).toBeDefined();
    if (!restApi) return;
    const config = buildDefaultConfig(restApi);
    expect(config.method).toBe('GET');
    expect(config.url).toBe('');
  });

  it('defaults file fields to null', () => {
    const file = getNodeDefinition('file');
    expect(file).toBeDefined();
    if (!file) return;
    expect(buildDefaultConfig(file).file).toBeNull();
  });

  it('defaults pyspark master and timeout', () => {
    const pyspark = getNodeDefinition('pyspark');
    expect(pyspark).toBeDefined();
    if (!pyspark) return;
    const config = buildDefaultConfig(pyspark);
    expect(config.master).toBe('local[*]');
    expect(config.timeout_seconds).toBe(300);
  });
});
