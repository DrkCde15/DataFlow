import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  isServerUnreachable,
  listWorkflows,
  runWorkflow,
} from './client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isServerUnreachable', () => {
  it('treats network failures as unreachable', () => {
    expect(isServerUnreachable(new TypeError('fetch failed'))).toBe(true);
  });

  it('treats 5xx as unreachable', () => {
    expect(isServerUnreachable(new ApiError(500, 'x'))).toBe(true);
    expect(isServerUnreachable(new ApiError(503, 'x'))).toBe(true);
  });

  it('treats 4xx as reachable', () => {
    expect(isServerUnreachable(new ApiError(404, 'x'))).toBe(false);
    expect(isServerUnreachable(new ApiError(422, 'x'))).toBe(false);
  });
});

describe('listWorkflows', () => {
  it('maps snake_case to camelCase', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse([
          {
            id: '1',
            name: 'w',
            node_count: 2,
            edge_count: 1,
            created_at: '2026-01-01',
            updated_at: '2026-01-02',
          },
        ]),
      ),
    );

    const result = await listWorkflows();
    expect(result).toEqual([
      {
        id: '1',
        name: 'w',
        nodeCount: 2,
        edgeCount: 1,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
      },
    ]);
  });

  it('surfaces backend detail messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ detail: 'Nope' }, 404)),
    );

    await expect(listWorkflows()).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Nope',
    });
  });

  it('falls back to status text without json body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('oops', { status: 500 })),
    );

    await expect(listWorkflows()).rejects.toMatchObject({ status: 500 });
  });
});

describe('runWorkflow', () => {
  it('maps a run result to camelCase', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          id: 'r1',
          workflow_id: 'w1',
          status: 'success',
          started_at: '2026-01-01T00:00:00',
          finished_at: '2026-01-01T00:00:01',
          nodes: {
            f: {
              status: 'success',
              rows: 2,
              columns: ['id'],
              log: ['read 2 rows'],
              error: null,
            },
          },
        }),
      ),
    );

    const run = await runWorkflow('w1');
    expect(run.workflowId).toBe('w1');
    expect(run.startedAt).toBe('2026-01-01T00:00:00');
    expect(run.nodes.f.rows).toBe(2);
  });

  it('posts without a body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'r1',
        workflow_id: 'w1',
        status: 'success',
        started_at: 'a',
        finished_at: 'b',
        nodes: {},
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await runWorkflow('w1');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/workflows/w1/run'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
