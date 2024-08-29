// require modules
require('dotenv').config();
const uuid = require('uuid');

const express = require('express');
const puppeteer = require('puppeteer');
const fullPageScreenshot = require('puppeteer-full-page-screenshot').default;

// initialize app
const app = express();

// setup boilerplate
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// initialize puppeteer function
(async () => {
	// post request is made to render
	app.get('/render', (req, res) => {
		// make sure authorization is present
		if (req.headers.authorization === process.env.AUTH_KEY) {
			// make sure both html and css are included
			try {
				if ((req.body.html && req.body.css)) {
					// generate image function
					(async () => {
						const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1200,1200'] });

						// open new browser page
						const page = await browser.newPage();
						
						/*
						var request = {
							"html": "<div id='main'><div class='photo flow'></div><div class='brand flow'><div class='text'>成功建立房地產團隊的關鍵步驟</div></div></div>",
							"css": "#main { width: 1200px; height: 1200px; } .flow { position: absolute; display: block; top: 0; bottom: 0; left: 0; right: 0; background-repeat: none; background-size: cover; background-position: center center; } .photo { top: 450px; background-image: url(https://images.pexels.com/photos/27299109/pexels-photo-27299109.jpeg); } .brand { background-image: url(https://louisjr-temp.s3.ap-east-1.amazonaws.com/aaverve/fb-1.png); } .text { text-align: center; margin-top: 180px; color: #FFF; font-family: Noto Sans HK, sans-serif; font-optical-sizing: auto; font-style: normal; font-size: 72px;}"
						}

						req.body.html = request.html;
						req.body.css = request.css;
						*/

						await page.setViewport({ width: 1200, height: 1200 });
						// fill content with user submitted html and css
						await page.setContent(
							`<style>
								body {
									margin: 0
								} 
								${req.body.css}
							</style>
							<div id="container">
								${req.body.html}
							</div>`
						);
						// define content area to take screenshot
						const content = await page.$('#container');
						// take screenshot in content area, save buffer
						//const buffer = await page.screenshot({ type: 'png', fullPage: true });

						var img_uuid = uuid.v4();
						const buffer = await fullPageScreenshot(page, { path: 'img/' + img_uuid + '.png' });
						//const buffer_2 = await page.screenshot({path: 'test.png', fullPage: true});
						// close browser page
						await page.close();

						await browser.close();

						// send back base64 string of image
						var base64str = 'data:image/png;base64,' + base64_encode('img/' + img_uuid + '.png');
						//console.log(base64str);
						//res.status(200).send();
						//res.sendFile(__dirname + '/img/' + img_uuid + '.png');
						res.status(200).send({
							"source_html":  req.body.html,
							"img_url": req.protocol + '://' + req.get('host') + '/img/' + img_uuid + '.png'
						});

					})();
				} else {
					// if fields missing
					res.status(400).send('Some fields are missing with request.');
				}
			}
			catch (e) {
				res.status(400).send('Some fields are missing with request.');
			}

		} else {
			// if no authorization present
			res.status(403).send('Auth key missing with request.');
		}
	});

	app.get('/img/:imageName', (req, res) => {
		const imageName = req.params.imageName;
		const imagePath = __dirname + `/img/${imageName}`; // Replace with the actual path
	
		res.sendFile(imagePath);
	});

	// function to encode file data to base64 encoded string
	function base64_encode(file) {
		var fs = require('fs');
		return fs.readFileSync(file, 'base64');
		//return Buffer.from(file, 'binary').toString('base64');;
		// read binary data
		//var bitmap = fs.readFileSync(file);
		// convert binary data to base64 encoded string
		//return new Buffer(bitmap).toString('base64');
	}
})();

// listen to port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Server started and running on port ' + PORT));
