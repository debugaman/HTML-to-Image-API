// require modules
require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');

// initialize app
const app = express();

// setup boilerplate
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// initialize puppeteer function
(async () => {
	// launch headless browser
	const browser = await puppeteer.launch({ headless: true, args: [ '--no-sandbox', '--window-size=2200,1200' ] });

	// post request is made to render
	app.post('/render', (req, res) => {
		// make sure authorization is present
		if (req.headers.authorization === process.env.AUTH_KEY) {
			// make sure both html and css are included
			if (req.body.html && req.body.css) {
				// generate image function
				(async () => {
					// open new browser page
					const page = await browser.newPage();

					await page.setViewport({width: 1280, height: 1200});
					// fill content with user submitted html and css
					await page.setContent(
						`<style>
							${req.body.css}
						</style>
						<div id="container">
							${req.body.html}
						</div>`
					);
					// define content area to take screenshot
					const content = await page.$('#container');
					// take screenshot in content area, save buffer
					const buffer = await content.screenshot({ type: 'png' });
					//const buffer_2 = await page.screenshot({path: 'test.png', fullPage: true});
					// close browser page
					await page.close();
					// send back base64 string of image
					res.status(200).send('data:image/png;base64,' + buffer.toString('base64'));
				})();
			} else {
				// if fields missing
				res.status(400).send('Some fields are missing with request.');
			}
		} else {
			// if no authorization present
			res.status(403).send('Auth key missing with request.');
		}
	});
})();

// listen to port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Server started and running on port ' + PORT));
