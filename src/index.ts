export default {
	async fetch(request: Request) {
		return new Response(`request method: ${request.method}`);
	},

	async scheduled(event: ScheduledEvent, env: Object, ctx: Object) {
		console.log(`scheduled event: ${event.cron}`);
	},
};
