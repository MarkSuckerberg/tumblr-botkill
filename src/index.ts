interface TumblrBotEnv {
	TUMBLR_CONSUMER_KEY: string;
	TUMBLR_CONSUMER_SECRET: string;
}

interface TumblrToken {
	error?: string;
	error_description?: string;
	access_token?: string;
	token_type?: string;
	expires_in?: number;
	refresh_token?: string;
	scope?: string;
}

export default {
	async fetch(request: Request, env: TumblrBotEnv, ctx: Object) {
		const url = new URL(request.url);
		switch (url.pathname) {
			case '/': {
				return Response.redirect('https://github.com/MarkSuckerberg/tumblr-botkill');
			}
			case '/auth': {
				return await this.auth(request, env);
			}
			default: {
				return new Response('Not found', {
					status: 404,
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET, OPTIONS',
						'Access-Control-Allow-Headers': 'Content-Type',
					},
				});
			}
		}
	},

	async auth(request: Request, env: TumblrBotEnv): Promise<Response> {
		const consumerID = env.TUMBLR_CONSUMER_KEY;
		const consumerSecret = env.TUMBLR_CONSUMER_SECRET;
		const url = new URL(request.url);
		const code = url.searchParams.get('code');
		const write = url.searchParams.get('write');

		// If the request doesn't have a code, someone is trying to start the auth process
		if (code == undefined) {
			return await this.authRedirect(url.origin + url.pathname, consumerID, write === 'true');
		} else {
			return await this.handleCallback(url.origin + url.pathname, consumerID, consumerSecret, code);
		}
	},

	async authRedirect(
		redirectURI: string,
		consumerID: string,
		writeAccess: boolean
	): Promise<Response> {
		const params = new URLSearchParams({
			response_type: 'code',
			client_id: consumerID,
			redirect_uri: redirectURI,
			scope: writeAccess ? 'basic write' : 'basic',
			approval_prompt: 'auto',
			state: 'tumblrbotkill',
		});

		return Response.redirect(`https://www.tumblr.com/oauth2/authorize?${params.toString()}}`, 302);
	},

	async handleCallback(
		redirectUri: string,
		consumerID: string,
		consumerSecret: string,
		authCode: string
	): Promise<Response> {
		const request = await fetch('https://api.tumblr.com/v2/oauth2/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
				'User-Agent': 'TumblrBotKill/0.0.1',
			},
			body: JSON.stringify({
				grant_type: 'authorization_code',
				client_id: consumerID,
				client_secret: consumerSecret,
				redirect_uri: redirectUri,
				code: authCode,
			}),
		});

		const token: TumblrToken = await request.json();

		if (token.error) {
			return new Response(token.error_description, {
				status: 400,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
				},
			});
		}

		return await this.getTumblrFollowers(
			token.access_token!,
			consumerID,
			!!token.scope!.includes('write')
		);
	},

	async getTumblrFollowers(
		token: string,
		consumerID: string,
		writeAccess: boolean
	): Promise<Response> {
		const user: any = await this.accessTumblrAPI(token, 'user/info');

		const followers: any = await this.accessTumblrAPI(token, `blog/${user.user.name}/followers`);
		const followersResponse: any[] = followers.users;

		if (writeAccess) {
			await this.accessTumblrAPI(token, `blog/${user.user.name}/blocks/bulk`, {
				blocked_tumblelogs: followersResponse
					.filter(blog => !blog.following && blog.updated === 0)
					.map(blog => blog.name)
					.join(','),
			});
		}

		return new Response(
			'<h1>Bad blogs:</h1><hr/>' +
				followersResponse
					.filter(blog => !blog.following && blog.updated === 0)
					.map(blog => `<li><a href="https://${blog.name}.tumblr.com">${blog.name}</a></li>`)
					.join('')
					.concat(
						writeAccess
							? '<h2>Accounts blocked.</h2>'
							: '<h2><a href="/auth?write=true">Block All (WARNING, UNTESTED)</a></h2>'
					),
			{
				status: 200,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
					'Content-Type': 'text/html',
				},
			}
		);
	},

	async accessTumblrAPI(
		token: string,
		endpoint: string,
		query?: Record<string, string>
	): Promise<JSON> {
		const request = await fetch(`https://api.tumblr.com/v2/${endpoint}`, {
			method: query ? 'POST' : 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
				'User-Agent': 'TumblrBotKill/0.0.1',
				'Authorization': `Bearer ${token}`,
			},
			body: JSON.stringify(query),
		});

		const response: any = await request.json();
		return response.response;
	},
};
