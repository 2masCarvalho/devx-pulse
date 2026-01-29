import type { AnalysisResult } from './types';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

export async function analyzeFeedback(ai: Ai, content: string): Promise<AnalysisResult> {
	const prompt = `Analyze the following user feedback and provide:
1. Sentiment: Classify as exactly one of: Negative, Neutral, or Positive
2. Confidence: A number between 0.0 and 1.0 indicating how confident you are in the sentiment classification
3. Summary: Summarize the problem or feedback in 1 sentence

Feedback: "${content}"

Respond in this exact JSON format only, no other text:
{"sentiment": "Negative|Neutral|Positive", "confidence": 0.85, "summary": "one sentence summary"}`;

	let lastError: unknown;

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			const response = await ai.run('@cf/meta/llama-3-8b-instruct', {
				messages: [{ role: 'user', content: prompt }],
			});

			const responseText = (response as { response: string }).response;
			return parseAiResponse(responseText);
		} catch (err) {
			lastError = err;
			if (attempt < MAX_RETRIES - 1) {
				const delay = BASE_DELAY_MS * Math.pow(2, attempt);
				await sleep(delay);
			}
		}
	}

	console.error('AI analysis failed after retries:', lastError);
	return {
		sentiment: 'Unknown',
		confidence: 0,
		summary: 'AI analysis failed after multiple attempts',
	};
}

function parseAiResponse(responseText: string): AnalysisResult {
	try {
		const jsonMatch = responseText.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			const sentiment = ['Negative', 'Neutral', 'Positive'].includes(parsed.sentiment) ? parsed.sentiment : 'Unknown';
			let confidence = 0.5;
			if (typeof parsed.confidence === 'number') {
				confidence = Math.max(0, Math.min(1, parsed.confidence));
			} else if (typeof parsed.confidence === 'string') {
				const num = parseFloat(parsed.confidence);
				if (!isNaN(num)) {
					confidence = Math.max(0, Math.min(1, num > 1 ? num / 100 : num));
				}
			}
			return {
				sentiment,
				confidence,
				summary: parsed.summary || 'Unable to summarize',
			};
		}
	} catch {
		// JSON parsing failed
	}

	return {
		sentiment: 'Unknown',
		confidence: 0,
		summary: responseText.trim().slice(0, 200),
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
