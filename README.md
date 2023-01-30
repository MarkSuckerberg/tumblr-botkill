# Tumblr Botkiller

This simple bot runs as a cloudflare worker and, using OAuth2, gets all accounts following you that have both no posts
and aren't followed by you.

Made in two days without a proper TS library or any real knowledge of OAuth at the time. Use at your own risk.

Subject to being updated when I get around to making a proper typed tumblr OAuth2 library since I'm pretty sure that
the official JS lib only supports OAuth1.0A which is a PAIN to work with.

## [Click here to remove at least a few of the bots haunting you](https://tumblrbot.suckerberg.gay/auth)

## How to self-host

### Cloudflare worker

**Untested instructions, but I wanted to at least give the gist for anyone who would rather self-host this**

1. Register a tumblr app [here](https://www.tumblr.com/oauth/apps), set the OAuth2 redirect URLs to `http://localhost:8787/auth`
2. Get a [Cloudflare](https://cloudflare.com/) account if you don't already have one
3. [Install Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (used to deploy the code)
4. Clone the repository using git
5. Make a new file named `.dev.vars` and DON'T SHARE IT
6. In `.dev.vars`, enter the consumer ID and secret you got from registering an app in step 1 with the form 
```
TUMBLR_CONSUMER_KEY=[consumeridhere]
TUMBLR_CONSUMER_SECRET=[secrethere]
```
7. Run `wrangler login` to login with your cloudflare account, it'll open a browser window
8. Run `wrangler dev` to host the app locally
9. Go to http://localhost:8787/auth
10. Use like you would normally
