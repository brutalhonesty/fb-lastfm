PLEASE NOTE THE FACEBOOK GUIDELINES TO USING THIS SOFTWARE
===========================================================
[Page Guidelines](https://www.facebook.com/page_guidelines.php)

[Statement of Rights and Responsibilties](https://www.facebook.com/legal/terms)

As of January 16th 2014, under Facebook Pages Terms, Section II, Subsection C, there are explicit comments on collecting information automatically.

I am not a lawyer, this is not legal advice.

License
-------
This software is released under the [MIT](www.tldrlegal.com/license/mit-license) license.

A copy of the license file is attached to the source code.

-----------------------------------------------------------------------------------------

FB-LastFM
=========

Version
-------
0.0.1

Dependencies
------------
[NodeJS](http://nodejs.org)

AccessTokens
-----------
* Create Facebook App (Make note of Client ID and Client secret)
* Create Facebook Page
* Head over to the [Facebook Explorer](https://developers.facebook.com/tools/explorer/)
* Choose your app from the dropdown
* Click "Get Access Token"
* Choose ```manage_pages, user_events, read_page_mailboxes```
* Take the access token and request a longer-life one with ```https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id={client id}&client_secret={client secret}&fb_exchange_token={old token}```
* Take the new token and store that as the user token. (This token may or may not last forever (could be 2 months))

For reference:

* To get the page token, request it at ```https://graph.facebook.com/me/accounts?access_token={user token}```
* This page token should last forever (expires never).
* Now make calls for the page with this token (read page messages).

Installation
------------

```bash
git clone <repo>
cd /path/to/repo
npm install
# Edit settings.js
vim settings.js
# Run server
node index.js
```