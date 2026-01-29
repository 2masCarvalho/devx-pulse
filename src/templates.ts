import type { FeedbackRow, FeedbackFilters, PaginatedResult, DashboardStats } from './types';
import { VALID_SOURCES, VALID_TIERS, VALID_PRODUCT_AREAS, VALID_SENTIMENTS } from './types';

function escapeHtml(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function layoutWrapper(title: string, activeNav: string, bodyContent: string, scripts: string = ''): string {
	return `<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(title)} - DevX Pulse</title>
	<script src="https://cdn.tailwindcss.com"></script>
	<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
	<script>
		tailwind.config = { darkMode: 'media' };
	</script>
	<style>
		@media (prefers-color-scheme: dark) {
			:root { color-scheme: dark; }
		}
	</style>
</head>
<body class="h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
	<nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<h1 class="text-xl font-bold text-orange-600 dark:text-orange-400">DevX Pulse</h1>
				<span class="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 font-mono">Internal Feedback Dashboard</span>
			</div>
			<div class="flex gap-4">
				<a href="/" class="text-sm font-medium ${activeNav === 'dashboard' ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400'}">Dashboard</a>
				<a href="/review" class="text-sm font-medium ${activeNav === 'review' ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400'}">Review Queue</a>
			</div>
		</div>
	</nav>
	<main class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
		${bodyContent}
	</main>
	${scripts}
</body>
</html>`;
}

function sentimentColor(sentiment: string): string {
	switch (sentiment) {
		case 'Negative':
			return 'text-red-600 dark:text-red-400';
		case 'Positive':
			return 'text-green-600 dark:text-green-400';
		case 'Unknown':
			return 'text-amber-600 dark:text-amber-400';
		default:
			return 'text-gray-500 dark:text-gray-400';
	}
}

function sentimentBg(sentiment: string): string {
	switch (sentiment) {
		case 'Negative':
			return 'bg-red-50 dark:bg-red-950';
		case 'Positive':
			return 'bg-green-50 dark:bg-green-950';
		case 'Unknown':
			return 'bg-amber-50 dark:bg-amber-950';
		default:
			return '';
	}
}

function buildQueryString(filters: FeedbackFilters, overrides: Partial<FeedbackFilters> = {}): string {
	const merged = { ...filters, ...overrides };
	const params = new URLSearchParams();
	if (merged.source) params.set('source', merged.source);
	if (merged.user_tier) params.set('tier', merged.user_tier);
	if (merged.product_area) params.set('product', merged.product_area);
	if (merged.sentiment) params.set('sentiment', merged.sentiment);
	if (merged.search) params.set('search', merged.search);
	if (merged.sort_by) params.set('sort', merged.sort_by);
	if (merged.sort_order) params.set('order', merged.sort_order);
	if (merged.page && merged.page > 1) params.set('page', String(merged.page));
	const qs = params.toString();
	return qs ? `?${qs}` : '';
}

function sortLink(filters: FeedbackFilters, column: string, label: string): string {
	const isActive = filters.sort_by === column;
	const nextOrder = isActive && filters.sort_order === 'DESC' ? 'ASC' : 'DESC';
	const arrow = isActive ? (filters.sort_order === 'ASC' ? ' &uarr;' : ' &darr;') : '';
	const qs = buildQueryString(filters, { sort_by: column, sort_order: nextOrder, page: 1 });
	return `<a href="${qs}" class="hover:text-orange-600 dark:hover:text-orange-400">${label}${arrow}</a>`;
}

function renderStatCards(stats: DashboardStats): string {
	return `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-indigo-500">
		<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</p>
		<p class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">${stats.total}</p>
	</div>
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-red-500">
		<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Negative</p>
		<p class="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">${stats.negative}</p>
	</div>
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-green-500">
		<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Positive</p>
		<p class="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">${stats.positive}</p>
	</div>
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-gray-400">
		<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Neutral</p>
		<p class="text-2xl font-bold text-gray-500 dark:text-gray-400 mt-1">${stats.neutral}</p>
	</div>
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-red-700">
		<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Enterprise Critical</p>
		<p class="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">${stats.enterprise_negative}</p>
	</div>
	<a href="/review" class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-amber-500 hover:shadow-md transition-shadow">
		<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Needs Review</p>
		<p class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">${stats.low_confidence}</p>
	</a>
</div>`;
}

function renderCharts(stats: DashboardStats): string {
	const chartData = JSON.stringify({
		by_sentiment: stats.by_sentiment,
		by_product_sentiment: stats.by_product_sentiment,
	});

	return `<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
		<h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Sentiment Distribution</h3>
		<div style="position:relative;height:250px;"><canvas id="sentimentChart"></canvas></div>
	</div>
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
		<h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">By Product Area</h3>
		<div style="position:relative;height:250px;"><canvas id="productChart"></canvas></div>
	</div>
</div>
<script>
(function() {
	var stats = ${chartData};
	var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	if (isDark) {
		Chart.defaults.color = '#d1d5db';
		Chart.defaults.borderColor = '#374151';
	}

	var sentimentColors = { Negative: '#ef4444', Neutral: '#6b7280', Positive: '#22c55e', Unknown: '#f59e0b' };
	var sentLabels = Object.keys(stats.by_sentiment);
	var sentData = Object.values(stats.by_sentiment);
	var sentBg = sentLabels.map(function(l) { return sentimentColors[l] || '#6b7280'; });

	new Chart(document.getElementById('sentimentChart'), {
		type: 'doughnut',
		data: {
			labels: sentLabels,
			datasets: [{ data: sentData, backgroundColor: sentBg, borderWidth: 0 }]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: { duration: 0 },
			plugins: { legend: { position: 'bottom', labels: { padding: 12, boxWidth: 12 } } }
		}
	});

	var areas = Object.keys(stats.by_product_sentiment);
	var sentiments = ['Negative', 'Neutral', 'Positive', 'Unknown'];
	var datasets = sentiments.map(function(s) {
		return {
			label: s,
			data: areas.map(function(a) { return (stats.by_product_sentiment[a] && stats.by_product_sentiment[a][s]) || 0; }),
			backgroundColor: sentimentColors[s]
		};
	});

	new Chart(document.getElementById('productChart'), {
		type: 'bar',
		data: { labels: areas, datasets: datasets },
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: { duration: 0 },
			scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
			plugins: { legend: { position: 'bottom', labels: { padding: 12, boxWidth: 12 } } }
		}
	});
})();
</script>`;
}

function renderFilters(filters: FeedbackFilters): string {
	const sourceOptions = VALID_SOURCES.map(
		(s) => `<option value="${s}" ${filters.source === s ? 'selected' : ''}>${s}</option>`
	).join('');
	const tierOptions = VALID_TIERS.map(
		(t) => `<option value="${t}" ${filters.user_tier === t ? 'selected' : ''}>${t}</option>`
	).join('');
	const productOptions = VALID_PRODUCT_AREAS.map(
		(p) => `<option value="${p}" ${filters.product_area === p ? 'selected' : ''}>${escapeHtml(p)}</option>`
	).join('');
	const sentimentOptions = VALID_SENTIMENTS.map(
		(s) => `<option value="${s}" ${filters.sentiment === s ? 'selected' : ''}>${s}</option>`
	).join('');

	return `<form method="GET" action="/" class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
	<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
		<div>
			<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Source</label>
			<select name="source" class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm py-1.5 px-2">
				<option value="">All Sources</option>
				${sourceOptions}
			</select>
		</div>
		<div>
			<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tier</label>
			<select name="tier" class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm py-1.5 px-2">
				<option value="">All Tiers</option>
				${tierOptions}
			</select>
		</div>
		<div>
			<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Product</label>
			<select name="product" class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm py-1.5 px-2">
				<option value="">All Products</option>
				${productOptions}
			</select>
		</div>
		<div>
			<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sentiment</label>
			<select name="sentiment" class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm py-1.5 px-2">
				<option value="">All Sentiments</option>
				${sentimentOptions}
			</select>
		</div>
		<div>
			<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
			<input type="text" name="search" value="${escapeHtml(filters.search || '')}" placeholder="Search content..."
				class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm py-1.5 px-2">
		</div>
		<div class="flex gap-2">
			<button type="submit" class="flex-1 px-3 py-1.5 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 transition-colors">Filter</button>
			<a href="/" class="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Clear</a>
		</div>
	</div>
</form>`;
}

function renderRow(row: FeedbackRow, filters: FeedbackFilters): string {
	const isEnterprise = row.user_tier === 'Enterprise';
	const isNegative = row.sentiment === 'Negative';
	const isCritical = isEnterprise && isNegative;
	const isLowConfidence = row.confidence !== null && row.confidence < 0.6;
	const hasCorrected = row.human_sentiment !== null;
	const rowBg = isCritical ? 'bg-red-50/50 dark:bg-red-950/30' : sentimentBg(row.sentiment);
	const truncatedContent = row.content.length > 120 ? row.content.slice(0, 120) + '...' : row.content;

	return `<tr class="${rowBg} hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
	<td class="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">${row.id}</td>
	<td class="px-3 py-2.5 text-xs whitespace-nowrap">${escapeHtml(row.source)}</td>
	<td class="px-3 py-2.5 text-xs whitespace-nowrap">
		${isEnterprise ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Enterprise</span>` : escapeHtml(row.user_tier)}
	</td>
	<td class="px-3 py-2.5 text-xs whitespace-nowrap">${escapeHtml(row.product_area)}</td>
	<td class="px-3 py-2.5 text-xs whitespace-nowrap">
		${isCritical ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">CRITICAL</span>` : ''}
		${hasCorrected ? `<span class="line-through ${sentimentColor(row.sentiment)}">${escapeHtml(row.sentiment)}</span> <span class="font-medium text-blue-600 dark:text-blue-400">${escapeHtml(row.human_sentiment!)}</span>` : `<span class="font-medium ${sentimentColor(row.sentiment)}">${escapeHtml(row.sentiment)}</span>`}
	</td>
	<td class="px-3 py-2.5 text-xs whitespace-nowrap">
		${row.confidence !== null ? `<span class="${isLowConfidence ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-500 dark:text-gray-400'}">${(row.confidence * 100).toFixed(0)}%</span>` : '<span class="text-gray-300 dark:text-gray-600">-</span>'}
		${isLowConfidence && !hasCorrected ? `<a href="/review" class="ml-1 text-amber-500 hover:text-amber-600" title="Needs review">&#9888;</a>` : ''}
	</td>
	<td class="px-3 py-2.5 text-xs max-w-xs">
		<span title="${escapeHtml(row.content)}">${escapeHtml(truncatedContent)}</span>
	</td>
	<td class="px-3 py-2.5 text-xs max-w-xs text-gray-600 dark:text-gray-400">${escapeHtml(row.ai_analysis || '-')}</td>
	<td class="px-3 py-2.5 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">${row.created_at ? new Date(row.created_at).toLocaleDateString() : '-'}</td>
</tr>`;
}

function renderPagination(result: PaginatedResult<FeedbackRow>, filters: FeedbackFilters, basePath: string): string {
	const start = result.total === 0 ? 0 : (result.page - 1) * result.per_page + 1;
	const end = Math.min(result.page * result.per_page, result.total);

	const prevQs = buildQueryString(filters, { page: result.page - 1 });
	const nextQs = buildQueryString(filters, { page: result.page + 1 });

	return `<div class="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 px-1">
	<span class="text-sm text-gray-500 dark:text-gray-400">
		Showing ${start}-${end} of ${result.total} items
	</span>
	<div class="flex gap-2">
		${result.page > 1 ? `<a href="${basePath}${prevQs}" class="px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Previous</a>` : ''}
		<span class="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">Page ${result.page} of ${result.total_pages}</span>
		${result.page < result.total_pages ? `<a href="${basePath}${nextQs}" class="px-3 py-1.5 rounded-md bg-orange-600 text-white text-sm hover:bg-orange-700 transition-colors">Next</a>` : ''}
	</div>
</div>`;
}

export function renderDashboard(feedbackResult: PaginatedResult<FeedbackRow>, stats: DashboardStats, filters: FeedbackFilters): string {
	const tableRows = feedbackResult.data.map((row) => renderRow(row, filters)).join('');

	const bodyContent = `
${renderStatCards(stats)}
${renderCharts(stats)}
${renderFilters(filters)}
<div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead class="bg-gray-50 dark:bg-gray-700/50">
				<tr>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${sortLink(filters, 'id', 'ID')}</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${sortLink(filters, 'source', 'Source')}</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${sortLink(filters, 'user_tier', 'Tier')}</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${sortLink(filters, 'sentiment', 'Sentiment')}</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${sortLink(filters, 'confidence', 'Conf.')}</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Content</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI Summary</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${sortLink(filters, 'created_at', 'Date')}</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
				${tableRows || `<tr><td colspan="9" class="px-3 py-8 text-center text-gray-400 dark:text-gray-500">No feedback items found matching your filters.</td></tr>`}
			</tbody>
		</table>
	</div>
</div>
${renderPagination(feedbackResult, filters, '/')}`;

	return layoutWrapper('Dashboard', 'dashboard', bodyContent);
}

export function renderReviewPage(result: PaginatedResult<FeedbackRow>): string {
	const cards = result.data
		.map((row) => {
			const isEnterprise = row.user_tier === 'Enterprise';
			const borderColor = isEnterprise ? 'border-purple-500' : 'border-amber-500';

			return `<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-5 border-l-4 ${borderColor}" data-feedback-id="${row.id}">
	<div class="flex flex-col sm:flex-row justify-between items-start gap-2 mb-3">
		<div class="flex flex-wrap gap-2 items-center">
			<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sentimentColor(row.sentiment)} bg-gray-100 dark:bg-gray-700">${escapeHtml(row.sentiment)}</span>
			<span class="text-xs text-gray-500 dark:text-gray-400">Confidence: <strong class="text-amber-600 dark:text-amber-400">${row.confidence !== null ? (row.confidence * 100).toFixed(0) + '%' : 'N/A'}</strong></span>
			${isEnterprise ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Enterprise</span>' : ''}
		</div>
		<div class="text-xs text-gray-400 dark:text-gray-500">
			${escapeHtml(row.source)} &middot; ${escapeHtml(row.product_area)} &middot; #${row.id}
		</div>
	</div>
	<p class="text-sm text-gray-800 dark:text-gray-200 mb-3 leading-relaxed">${escapeHtml(row.content)}</p>
	<p class="text-xs text-gray-500 dark:text-gray-400 mb-4 italic">${escapeHtml(row.ai_analysis || 'No AI summary available')}</p>
	<div class="flex items-center gap-2">
		<span class="text-xs text-gray-400 dark:text-gray-500 mr-2">Correct to:</span>
		<button onclick="correctSentiment(${row.id}, 'Negative')" class="px-3 py-1 text-xs rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900 transition-colors font-medium">Negative</button>
		<button onclick="correctSentiment(${row.id}, 'Neutral')" class="px-3 py-1 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors font-medium">Neutral</button>
		<button onclick="correctSentiment(${row.id}, 'Positive')" class="px-3 py-1 text-xs rounded-md bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900 transition-colors font-medium">Positive</button>
	</div>
</div>`;
		})
		.join('\n');

	const emptyState = `<div class="text-center py-12">
	<p class="text-gray-400 dark:text-gray-500 text-lg mb-2">No items need review</p>
	<p class="text-gray-400 dark:text-gray-500 text-sm">All feedback has been reviewed or has high confidence scores.</p>
	<a href="/" class="inline-block mt-4 px-4 py-2 bg-orange-600 text-white rounded-md text-sm hover:bg-orange-700 transition-colors">Back to Dashboard</a>
</div>`;

	const reviewFilters: FeedbackFilters = { page: result.page, per_page: result.per_page };

	const bodyContent = `
<div class="flex items-center justify-between mb-6">
	<div>
		<h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Review Queue</h2>
		<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${result.total} items with low AI confidence need human review</p>
	</div>
	<a href="/" class="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">&larr; Dashboard</a>
</div>
<div class="space-y-4">
	${result.data.length > 0 ? cards : emptyState}
</div>
${result.data.length > 0 ? renderPagination(result, reviewFilters, '/review') : ''}`;

	const scripts = `<script>
async function correctSentiment(id, sentiment) {
	var card = document.querySelector('[data-feedback-id="' + id + '"]');
	var buttons = card.querySelectorAll('button');
	buttons.forEach(function(b) { b.disabled = true; b.style.opacity = '0.5'; });
	try {
		var res = await fetch('/api/feedback/' + id, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ human_sentiment: sentiment })
		});
		if (res.ok) {
			card.style.transition = 'opacity 0.3s, transform 0.3s';
			card.style.opacity = '0.4';
			card.style.transform = 'scale(0.98)';
			var badge = card.querySelector('.flex.flex-wrap');
			if (badge) {
				badge.innerHTML += ' <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Corrected: ' + sentiment + '</span>';
			}
		} else {
			buttons.forEach(function(b) { b.disabled = false; b.style.opacity = '1'; });
			alert('Failed to update. Please try again.');
		}
	} catch (err) {
		buttons.forEach(function(b) { b.disabled = false; b.style.opacity = '1'; });
		alert('Error: ' + err.message);
	}
}
</script>`;

	return layoutWrapper('Review Queue', 'review', bodyContent, scripts);
}
