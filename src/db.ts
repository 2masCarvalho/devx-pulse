import type { FeedbackRow, FeedbackInput, AnalysisResult, FeedbackFilters, PaginatedResult, DashboardStats } from './types';
import { VALID_SOURCES, VALID_TIERS, VALID_PRODUCT_AREAS, VALID_SENTIMENTS, VALID_SORT_COLUMNS, DEFAULT_PER_PAGE } from './types';

export async function insertFeedback(db: D1Database, item: FeedbackInput, analysis: AnalysisResult): Promise<void> {
	await db
		.prepare(
			`INSERT INTO feedback (source, user_tier, product_area, sentiment, confidence, content, ai_analysis)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(item.source || 'unknown', item.user_tier || 'unknown', item.product_area || 'unknown', analysis.sentiment, analysis.confidence, item.content, analysis.summary)
		.run();
}

function buildWhereClause(filters: FeedbackFilters): { whereClause: string; params: (string | number)[] } {
	const conditions: string[] = [];
	const params: (string | number)[] = [];

	if (filters.source && (VALID_SOURCES as readonly string[]).includes(filters.source)) {
		conditions.push('source = ?');
		params.push(filters.source);
	}
	if (filters.user_tier && (VALID_TIERS as readonly string[]).includes(filters.user_tier)) {
		conditions.push('user_tier = ?');
		params.push(filters.user_tier);
	}
	if (filters.product_area && (VALID_PRODUCT_AREAS as readonly string[]).includes(filters.product_area)) {
		conditions.push('product_area = ?');
		params.push(filters.product_area);
	}
	if (filters.sentiment && (VALID_SENTIMENTS as readonly string[]).includes(filters.sentiment)) {
		conditions.push('sentiment = ?');
		params.push(filters.sentiment);
	}
	if (filters.critical) {
		conditions.push("user_tier = 'Enterprise' AND sentiment = 'Negative'");
	}
	if (filters.search && filters.search.trim().length > 0) {
		conditions.push('(content LIKE ? OR ai_analysis LIKE ?)');
		const searchParam = `%${filters.search.trim()}%`;
		params.push(searchParam, searchParam);
	}

	const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
	return { whereClause, params };
}

export async function queryFeedback(db: D1Database, filters: FeedbackFilters): Promise<PaginatedResult<FeedbackRow>> {
	const { whereClause, params } = buildWhereClause(filters);

	const sortCol =
		filters.sort_by && (VALID_SORT_COLUMNS as readonly string[]).includes(filters.sort_by) ? filters.sort_by : 'id';
	const sortDir = filters.sort_order === 'ASC' ? 'ASC' : 'DESC';
	const orderClause = `ORDER BY (CASE WHEN user_tier = 'Enterprise' THEN 0 ELSE 1 END) ASC, ${sortCol} ${sortDir}`;

	const page = Math.max(1, filters.page || 1);
	const perPage = Math.min(100, Math.max(1, filters.per_page || DEFAULT_PER_PAGE));
	const offset = (page - 1) * perPage;

	const countResult = await db.prepare(`SELECT COUNT(*) as total FROM feedback ${whereClause}`).bind(...params).first<{ total: number }>();
	const total = countResult?.total || 0;

	const dataResult = await db
		.prepare(`SELECT * FROM feedback ${whereClause} ${orderClause} LIMIT ? OFFSET ?`)
		.bind(...params, perPage, offset)
		.all<FeedbackRow>();

	return {
		data: dataResult.results || [],
		total,
		page,
		per_page: perPage,
		total_pages: Math.ceil(total / perPage) || 1,
	};
}

export async function getStats(db: D1Database, filters: FeedbackFilters = {}): Promise<DashboardStats> {
	const { whereClause, params } = buildWhereClause(filters);
	const andClause = whereClause ? `${whereClause} AND` : 'WHERE';

	const [totals, byArea, bySentiment, enterpriseNeg, lowConf, byProductSentiment] = await Promise.all([
		db.prepare(
			`SELECT
				COUNT(*) as total,
				SUM(CASE WHEN sentiment = 'Negative' THEN 1 ELSE 0 END) as negative,
				SUM(CASE WHEN sentiment = 'Positive' THEN 1 ELSE 0 END) as positive,
				SUM(CASE WHEN sentiment = 'Neutral' THEN 1 ELSE 0 END) as neutral,
				SUM(CASE WHEN sentiment = 'Unknown' THEN 1 ELSE 0 END) as unknown
			FROM feedback ${whereClause}`
		).bind(...params).first(),
		db.prepare(`SELECT product_area, COUNT(*) as count FROM feedback ${whereClause} GROUP BY product_area`).bind(...params).all(),
		db.prepare(`SELECT sentiment, COUNT(*) as count FROM feedback ${whereClause} GROUP BY sentiment`).bind(...params).all(),
		db.prepare(`SELECT COUNT(*) as count FROM feedback ${andClause} user_tier = 'Enterprise' AND sentiment = 'Negative'`).bind(...params).first(),
		db.prepare(`SELECT COUNT(*) as count FROM feedback ${andClause} confidence IS NOT NULL AND confidence < 0.6`).bind(...params).first(),
		db.prepare(`SELECT product_area, sentiment, COUNT(*) as count FROM feedback ${whereClause} GROUP BY product_area, sentiment`).bind(...params).all(),
	]);

	const byProductAreaMap: Record<string, number> = {};
	for (const row of (byArea.results || []) as { product_area: string; count: number }[]) {
		byProductAreaMap[row.product_area] = row.count;
	}

	const bySentimentMap: Record<string, number> = {};
	for (const row of (bySentiment.results || []) as { sentiment: string; count: number }[]) {
		bySentimentMap[row.sentiment] = row.count;
	}

	const byProductSentimentMap: Record<string, Record<string, number>> = {};
	for (const row of (byProductSentiment.results || []) as { product_area: string; sentiment: string; count: number }[]) {
		if (!byProductSentimentMap[row.product_area]) {
			byProductSentimentMap[row.product_area] = {};
		}
		byProductSentimentMap[row.product_area][row.sentiment] = row.count;
	}

	const t = totals as Record<string, number> | null;
	return {
		total: t?.total || 0,
		negative: t?.negative || 0,
		positive: t?.positive || 0,
		neutral: t?.neutral || 0,
		unknown: t?.unknown || 0,
		enterprise_negative: (enterpriseNeg as Record<string, number> | null)?.count || 0,
		low_confidence: (lowConf as Record<string, number> | null)?.count || 0,
		by_product_area: byProductAreaMap,
		by_sentiment: bySentimentMap,
		by_product_sentiment: byProductSentimentMap,
	};
}

export async function queryReviewQueue(db: D1Database, page: number = 1, perPage: number = DEFAULT_PER_PAGE): Promise<PaginatedResult<FeedbackRow>> {
	const offset = (Math.max(1, page) - 1) * perPage;

	const countResult = await db
		.prepare(`SELECT COUNT(*) as total FROM feedback WHERE confidence IS NOT NULL AND confidence < 0.6 AND human_sentiment IS NULL`)
		.first<{ total: number }>();
	const total = countResult?.total || 0;

	const dataResult = await db
		.prepare(
			`SELECT * FROM feedback
			 WHERE confidence IS NOT NULL AND confidence < 0.6 AND human_sentiment IS NULL
			 ORDER BY confidence ASC, (CASE WHEN user_tier = 'Enterprise' THEN 0 ELSE 1 END) ASC
			 LIMIT ? OFFSET ?`
		)
		.bind(perPage, offset)
		.all<FeedbackRow>();

	return {
		data: dataResult.results || [],
		total,
		page,
		per_page: perPage,
		total_pages: Math.ceil(total / perPage) || 1,
	};
}

export async function updateHumanSentiment(db: D1Database, id: number, humanSentiment: string): Promise<boolean> {
	if (!(VALID_SENTIMENTS as readonly string[]).includes(humanSentiment)) {
		return false;
	}
	const result = await db.prepare(`UPDATE feedback SET human_sentiment = ? WHERE id = ?`).bind(humanSentiment, id).run();
	return result.meta.changes > 0;
}
