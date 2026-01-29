import type { Env, FeedbackInput } from './types';
import { handleRequest } from './routes';
import { analyzeFeedback } from './ai';
import { insertFeedback } from './db';

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		try {
			return await handleRequest(request, env);
		} catch (err) {
			console.error('Unhandled error:', err);
			return new Response(JSON.stringify({ error: 'Internal server error' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},

	async queue(batch: MessageBatch<FeedbackInput>, env: Env): Promise<void> {
		for (const message of batch.messages) {
			try {
				const item = message.body;
				const analysis = await analyzeFeedback(env.AI, item.content);
				await insertFeedback(env.DB, item, analysis);
				message.ack();
			} catch (err) {
				console.error('Queue processing error:', err);
				message.retry();
			}
		}
	},
};
