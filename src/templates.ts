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
			return 'text-red-400';
		case 'Positive':
			return 'text-green-400';
		case 'Unknown':
			return 'text-amber-400';
		default:
			return 'text-slate-400';
	}
}

function sentimentBg(sentiment: string): string {
	switch (sentiment) {
		case 'Negative':
			return 'bg-red-500/10 border border-red-500/20';
		case 'Positive':
			return 'bg-green-500/10 border border-green-500/20';
		case 'Unknown':
			return 'bg-amber-500/10 border border-amber-500/20';
		default:
			return 'bg-slate-500/10 border border-slate-500/20';
	}
}

function buildQueryString(filters: FeedbackFilters, overrides: Partial<FeedbackFilters> = {}): string {
	const merged = { ...filters, ...overrides };
	const params = new URLSearchParams();
	if (merged.source) params.set('source', merged.source);
	if (merged.user_tier) params.set('tier', merged.user_tier);
	if (merged.product_area) params.set('product', merged.product_area);
	if (merged.sentiment) params.set('sentiment', merged.sentiment);
	if (merged.critical) params.set('critical', 'true');
	if (merged.search) params.set('search', merged.search);
	if (merged.sort_by) params.set('sort', merged.sort_by);
	if (merged.sort_order) params.set('order', merged.sort_order);
	if (merged.page && merged.page > 1) params.set('page', String(merged.page));
	const qs = params.toString();
	return qs ? `?${qs}` : '';
}

function headerTooltip(label: string, tooltip: string, align: 'center' | 'left' = 'center'): string {
	const posClass = align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2';
	const arrowPos = align === 'left' ? 'left-3' : 'left-1/2 -translate-x-1/2';
	return `<span class="group relative cursor-default">${label}<span class="absolute top-full ${posClass} mt-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">${tooltip}<span class="absolute bottom-full ${arrowPos} border-4 border-transparent border-b-gray-900"></span></span></span>`;
}

function sortLink(filters: FeedbackFilters, column: string, label: string, tooltip?: string): string {
	const isActive = filters.sort_by === column;
	const nextOrder = isActive && filters.sort_order === 'DESC' ? 'ASC' : 'DESC';
	const arrow = isActive ? (filters.sort_order === 'ASC' ? ' &uarr;' : ' &darr;') : '';
	const qs = buildQueryString(filters, { sort_by: column, sort_order: nextOrder, page: 1 });
	const linkContent = `<a href="${qs}" class="hover:text-orange-600 dark:hover:text-orange-400">${label}${arrow}</a>`;
	if (tooltip) {
		return `<span class="group relative">${linkContent}<span class="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">${tooltip}<span class="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900"></span></span></span>`;
	}
	return linkContent;
}

function renderStatCards(stats: DashboardStats): string {
	return `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
	<a href="/" class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-indigo-500 cursor-pointer hover:scale-105 hover:shadow-lg transition-all">
		<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</p>
		<p class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">${stats.total}</p>
	</a>
	<a href="/?sentiment=Negative" class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-red-500 cursor-pointer hover:scale-105 hover:shadow-lg transition-all">
		<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Negative</p>
		<p class="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">${stats.negative}</p>
	</a>
	<a href="/?sentiment=Positive" class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-green-500 cursor-pointer hover:scale-105 hover:shadow-lg transition-all">
		<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Positive</p>
		<p class="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">${stats.positive}</p>
	</a>
	<a href="/?sentiment=Neutral" class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-gray-400 cursor-pointer hover:scale-105 hover:shadow-lg transition-all">
		<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Neutral</p>
		<p class="text-2xl font-bold text-gray-500 dark:text-gray-400 mt-1">${stats.neutral}</p>
	</a>
	<a href="/?critical=true" class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-red-700 cursor-pointer hover:scale-105 hover:shadow-lg transition-all">
		<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Enterprise Critical</p>
		<p class="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">${stats.enterprise_negative}</p>
	</a>
	<a href="/review" class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-amber-500 cursor-pointer hover:scale-105 hover:shadow-lg transition-all">
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

	return `<form method="GET" action="/" id="filterForm" class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
	<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 items-end">
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
		<div class="flex items-center pt-4">
			<label class="relative inline-flex items-center cursor-pointer">
				<input type="checkbox" name="critical" value="true" ${filters.critical ? 'checked' : ''} onchange="document.getElementById('filterForm').submit()" class="sr-only peer">
				<div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:border-gray-500 peer-checked:bg-red-500"></div>
				<span class="ml-2 text-xs font-medium text-gray-500 dark:text-gray-400">Critical Only</span>
			</label>
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
	<td class="w-10 px-2 py-2.5 text-center">${isCritical ? '<svg class="inline-block w-4 h-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>' : ''}</td>
	<td class="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">${row.id}</td>
	<td class="px-3 py-2.5 text-xs whitespace-nowrap">${escapeHtml(row.source)}</td>
	<td class="px-3 py-2.5 text-xs whitespace-nowrap">
		${isEnterprise ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Enterprise</span>` : escapeHtml(row.user_tier)}
	</td>
	<td class="px-3 py-2.5 text-xs whitespace-nowrap">${escapeHtml(row.product_area)}</td>
	<td class="px-3 py-2.5 text-xs whitespace-nowrap">
		<span class="inline-flex items-center gap-1.5"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide ${sentimentColor(hasCorrected ? row.human_sentiment! : row.sentiment)} ${sentimentBg(hasCorrected ? row.human_sentiment! : row.sentiment)}">${escapeHtml(hasCorrected ? row.human_sentiment! : row.sentiment)}</span>${hasCorrected ? `<span class="group relative cursor-default"><svg class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z"/></svg><span class="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">Original: ${escapeHtml(row.sentiment)}<span class="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900"></span></span></span>` : ''}</span>
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
					<th class="w-10 px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${headerTooltip('STS', 'Critical Status: High priority items to review first.', 'left')}</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${sortLink(filters, 'id', 'ID')}</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${sortLink(filters, 'source', 'Source')}</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${sortLink(filters, 'user_tier', 'Tier', 'Customer Subscription Plan')}</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${sortLink(filters, 'sentiment', 'Sentiment', 'AI Detected Sentiment')}</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${sortLink(filters, 'confidence', 'Conf.', 'AI Confidence Score (0-100%)')}</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Content</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI Summary</th>
					<th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">${sortLink(filters, 'created_at', 'Date')}</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
				${tableRows || `<tr><td colspan="10" class="px-3 py-8 text-center text-gray-400 dark:text-gray-500">No feedback items found matching your filters.</td></tr>`}
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
			<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide ${sentimentColor(row.sentiment)} ${sentimentBg(row.sentiment)}">${escapeHtml(row.sentiment)}</span>
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
