export default {
	async fetch(request: Request) {
		return new Response(`request method: ${request.method}`);
	},

	async scheduled(event: ScheduledEvent, env: Object, ctx: Object) {
		return new Response(`scheduled event: ${ctx.event}`);
	},
};
