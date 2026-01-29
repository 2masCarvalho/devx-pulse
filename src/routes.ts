import type { Env, FeedbackInput, FeedbackFilters } from './types';
import { VALID_SENTIMENTS } from './types';
import { queryFeedback, getStats, queryReviewQueue, updateHumanSentiment } from './db';
import { renderDashboard, renderReviewPage } from './templates';

export async function handleRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const method = request.method;

	if (method === 'POST' && url.pathname === '/api/feedback') {
		return handlePostFeedback(request, env);
	}

	if (method === 'GET' && url.pathname === '/') {
		return handleDashboard(url, env);
	}

	if (method === 'GET' && url.pathname === '/review') {
		return handleReviewPage(url, env);
	}

	if (method === 'GET' && url.pathname === '/api/stats') {
		return handleApiStats(env);
	}

	if (method === 'GET' && url.pathname === '/api/feedback') {
		return handleApiFeedback(url, env);
	}

	if (method === 'PATCH' && url.pathname.startsWith('/api/feedback/')) {
		return handlePatchFeedback(request, url, env);
	}

	return new Response(JSON.stringify({ error: 'Not found' }), {
		status: 404,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function handlePostFeedback(request: Request, env: Env): Promise<Response> {
	let feedbackItems: FeedbackInput[];
	try {
		feedbackItems = await request.json();
		if (!Array.isArray(feedbackItems)) {
			throw new Error('Expected an array');
		}
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON. Expected an array of feedback items.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const validItems = feedbackItems.filter((item) => item.content && typeof item.content === 'string');

	if (validItems.length === 0) {
		return new Response(JSON.stringify({ error: 'No valid feedback items with content found.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	await env.FEEDBACK_QUEUE.sendBatch(validItems.map((item) => ({ body: item })));

	return new Response(
		JSON.stringify({
			message: `Accepted ${validItems.length} items for processing`,
			queued: validItems.length,
		}),
		{ status: 202, headers: { 'Content-Type': 'application/json' } }
	);
}

async function handleDashboard(url: URL, env: Env): Promise<Response> {
	const filters = parseFiltersFromUrl(url);
	const [feedbackResult, stats] = await Promise.all([queryFeedback(env.DB, filters), getStats(env.DB)]);

	const html = renderDashboard(feedbackResult, stats, filters);
	return new Response(html, {
		status: 200,
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
	});
}

async function handleReviewPage(url: URL, env: Env): Promise<Response> {
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const result = await queryReviewQueue(env.DB, page);
	const html = renderReviewPage(result);
	return new Response(html, {
		status: 200,
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
	});
}

async function handleApiStats(env: Env): Promise<Response> {
	const stats = await getStats(env.DB);
	return new Response(JSON.stringify(stats), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function handleApiFeedback(url: URL, env: Env): Promise<Response> {
	const filters = parseFiltersFromUrl(url);
	const result = await queryFeedback(env.DB, filters);
	return new Response(JSON.stringify(result), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function handlePatchFeedback(request: Request, url: URL, env: Env): Promise<Response> {
	const idStr = url.pathname.split('/').pop();
	const id = parseInt(idStr || '', 10);
	if (isNaN(id)) {
		return new Response(JSON.stringify({ error: 'Invalid ID' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	let body: { human_sentiment?: string };
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	if (!body.human_sentiment || !(VALID_SENTIMENTS as readonly string[]).includes(body.human_sentiment)) {
		return new Response(JSON.stringify({ error: 'Invalid human_sentiment. Must be one of: Negative, Neutral, Positive, Unknown' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const updated = await updateHumanSentiment(env.DB, id, body.human_sentiment);
	if (!updated) {
		return new Response(JSON.stringify({ error: 'Feedback item not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	return new Response(JSON.stringify({ success: true, id, human_sentiment: body.human_sentiment }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
}

function parseFiltersFromUrl(url: URL): FeedbackFilters {
	return {
		source: url.searchParams.get('source') || undefined,
		user_tier: url.searchParams.get('tier') || undefined,
		product_area: url.searchParams.get('product') || undefined,
		sentiment: url.searchParams.get('sentiment') || undefined,
		search: url.searchParams.get('search') || undefined,
		sort_by: url.searchParams.get('sort') || undefined,
		sort_order: url.searchParams.get('order') === 'ASC' ? 'ASC' : 'DESC',
		page: parseInt(url.searchParams.get('page') || '1', 10) || 1,
		per_page: parseInt(url.searchParams.get('per_page') || '15', 10) || 15,
	};
}
