import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('DevX Pulse Worker', () => {
	beforeAll(async () => {
		await env.DB.prepare('DROP TABLE IF EXISTS feedback').run();
		await env.DB.prepare(`CREATE TABLE feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, user_tier TEXT NOT NULL, product_area TEXT NOT NULL, sentiment TEXT NOT NULL DEFAULT 'Unknown', confidence REAL, human_sentiment TEXT, content TEXT NOT NULL, ai_analysis TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`).run();
		await env.DB.prepare(
			`INSERT INTO feedback (source, user_tier, product_area, sentiment, confidence, content, ai_analysis) VALUES (?, ?, ?, ?, ?, ?, ?)`
		).bind('Discord', 'Enterprise', 'Workers', 'Negative', 0.9, 'Cold start latency is terrible', 'User reports cold start issues').run();
		await env.DB.prepare(
			`INSERT INTO feedback (source, user_tier, product_area, sentiment, confidence, content, ai_analysis) VALUES (?, ?, ?, ?, ?, ?, ?)`
		).bind('Twitter', 'Free', 'D1', 'Positive', 0.3, 'Great product overall', 'Positive feedback about D1').run();
		await env.DB.prepare(
			`INSERT INTO feedback (source, user_tier, product_area, sentiment, confidence, content, ai_analysis) VALUES (?, ?, ?, ?, ?, ?, ?)`
		).bind('Support Ticket', 'Pro', 'Workers AI', 'Neutral', 0.8, 'Need docs on rate limits', 'User requesting documentation').run();
	});

	describe('GET / (Dashboard)', () => {
		it('returns HTML dashboard', async () => {
			const request = new IncomingRequest('http://example.com/');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toContain('text/html');
			const html = await response.text();
			expect(html).toContain('DevX Pulse');
			expect(html).toContain('Dashboard');
		});

		it('filters by sentiment', async () => {
			const request = new IncomingRequest('http://example.com/?sentiment=Negative');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(200);
			const html = await response.text();
			expect(html).toContain('Cold start latency');
		});

		it('filters by tier', async () => {
			const request = new IncomingRequest('http://example.com/?tier=Enterprise');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(200);
			const html = await response.text();
			expect(html).toContain('Enterprise');
		});

		it('handles text search', async () => {
			const request = new IncomingRequest('http://example.com/?search=cold+start');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(200);
			const html = await response.text();
			expect(html).toContain('Cold start');
		});
	});

	describe('GET /review (Review Queue)', () => {
		it('returns review page HTML', async () => {
			const request = new IncomingRequest('http://example.com/review');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toContain('text/html');
			const html = await response.text();
			expect(html).toContain('Review Queue');
		});

		it('shows low confidence items', async () => {
			const request = new IncomingRequest('http://example.com/review');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			const html = await response.text();
			// Item with confidence 0.3 should appear
			expect(html).toContain('Great product overall');
		});
	});

	describe('GET /api/stats', () => {
		it('returns JSON stats', async () => {
			const request = new IncomingRequest('http://example.com/api/stats');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toContain('application/json');
			const data = (await response.json()) as { total: number; negative: number; positive: number };
			expect(data.total).toBe(3);
			expect(data.negative).toBe(1);
			expect(data.positive).toBe(1);
		});
	});

	describe('GET /api/feedback', () => {
		it('returns paginated JSON feedback', async () => {
			const request = new IncomingRequest('http://example.com/api/feedback');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(200);
			const data = (await response.json()) as { data: unknown[]; total: number; page: number };
			expect(data.total).toBe(3);
			expect(data.page).toBe(1);
			expect(data.data.length).toBe(3);
		});
	});

	describe('PATCH /api/feedback/:id', () => {
		it('updates human_sentiment', async () => {
			const request = new IncomingRequest('http://example.com/api/feedback/1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ human_sentiment: 'Positive' }),
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(200);
			const data = (await response.json()) as { success: boolean; human_sentiment: string };
			expect(data.success).toBe(true);
			expect(data.human_sentiment).toBe('Positive');
		});

		it('rejects invalid sentiment value', async () => {
			const request = new IncomingRequest('http://example.com/api/feedback/1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ human_sentiment: 'InvalidValue' }),
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(400);
		});

		it('returns 400 for invalid ID', async () => {
			const request = new IncomingRequest('http://example.com/api/feedback/abc', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ human_sentiment: 'Positive' }),
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(400);
		});

		it('returns 404 for non-existent ID', async () => {
			const request = new IncomingRequest('http://example.com/api/feedback/9999', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ human_sentiment: 'Positive' }),
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(404);
		});
	});

	describe('404 handling', () => {
		it('returns 404 for unknown routes', async () => {
			const request = new IncomingRequest('http://example.com/nonexistent');
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(404);
		});
	});
});
