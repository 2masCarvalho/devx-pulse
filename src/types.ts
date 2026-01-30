export interface Env {
	DB: D1Database;
	AI: Ai;
}

export interface FeedbackInput {
	source: string;
	user_tier: string;
	product_area: string;
	content: string;
}

export interface AnalysisResult {
	sentiment: string;
	confidence: number;
	summary: string;
}

export interface FeedbackRow {
	id: number;
	source: string;
	user_tier: string;
	product_area: string;
	sentiment: string;
	confidence: number | null;
	human_sentiment: string | null;
	content: string;
	ai_analysis: string | null;
	created_at: string;
}

export interface FeedbackFilters {
	source?: string;
	user_tier?: string;
	product_area?: string;
	sentiment?: string;
	critical?: boolean;
	search?: string;
	sort_by?: string;
	sort_order?: 'ASC' | 'DESC';
	page?: number;
	per_page?: number;
}

export interface PaginatedResult<T> {
	data: T[];
	total: number;
	page: number;
	per_page: number;
	total_pages: number;
}

export interface DashboardStats {
	total: number;
	negative: number;
	positive: number;
	neutral: number;
	unknown: number;
	enterprise_negative: number;
	low_confidence: number;
	by_product_area: Record<string, number>;
	by_sentiment: Record<string, number>;
	by_product_sentiment: Record<string, Record<string, number>>;
}

export const VALID_SOURCES = ['Support Ticket', 'Discord', 'GitHub Issue', 'Twitter', 'Community Forum'] as const;
export const VALID_TIERS = ['Enterprise', 'Pro', 'Free'] as const;
export const VALID_PRODUCT_AREAS = ['Workers', 'D1', 'Workers AI', 'General/Billing'] as const;
export const VALID_SENTIMENTS = ['Negative', 'Neutral', 'Positive', 'Unknown'] as const;
export const VALID_SORT_COLUMNS = ['id', 'source', 'user_tier', 'product_area', 'sentiment', 'confidence', 'created_at'] as const;
export const DEFAULT_PER_PAGE = 15;
