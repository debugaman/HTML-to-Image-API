// require modules
require('dotenv').config();
const uuid = require('uuid');
const path = require('path');
const axios = require("axios");

const mimeTypes = {
	'.html': 'text/html',
	'.js': 'application/javascript',
	'.json': 'application/json',
	'.css': 'text/css',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.txt': 'text/plain',
	// Add more mappings as needed
};

const express = require('express');

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

var https = require('follow-redirects').https;

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

						var aws_s3_url = await upload_s3(__dirname + '/img/' + img_uuid + '.png', img_uuid + '.png');
						//uploadFile(__dirname + '/img/' + img_uuid + '.png', img_uuid + '.png', "aacms");

						// send back base64 string of image
						var base64str = 'data:image/png;base64,' + base64_encode('img/' + img_uuid + '.png');
						//console.log(base64str);
						//res.status(200).send();
						//res.sendFile(__dirname + '/img/' + img_uuid + '.png');
						res.status(200).send({
							"source_html": req.body.html,
							"aws_s3_url": "https://aacms.s3.ap-southeast-1.amazonaws.com/" + img_uuid + '.png',
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
	}

	async function upload_s3(file_path, file_name) {
		// Configure AWS SDK V3
		const s3Client = new S3Client({
			region: 'ap-southeast-1', // Change to your desired region
			credentials: {
				accessKeyId: "{{accessKeyId}}",
				secretAccessKey: "{{secretAccessKey}}",
			},
		});

		try {
			const params = {
				Bucket: 'aacms', // Your S3 bucket name
				Key: file_name, // Replace with your desired object key
				ACL: 'public-read', // Set object to public-read
			};

			// Generate pre-signed URL for PUT operation
			const command = new PutObjectCommand(params);
			const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

			var fs = require('fs');

			let data = fs.readFileSync(file_path);

			let config = {
				method: 'put',
				maxBodyLength: Infinity,
				url: signedUrl,
				headers: {
					'Content-Type': 'text/plain'
				},
				data: data
			};

			axios.request(config)
				.then((response) => {
					console.log(JSON.stringify(response.data));
					fs.unlink(file_path, (err) => {
						if (err) {
						  console.error("Failed to delete file", err);
						} else {
						  console.log("File deleted successfully");
						}
					  });
				})
				.catch((error) => {
					console.log(error);
				});



			return "https://aacms.s3.ap-southeast-1.amazonaws.com/" + file_name;
		} catch (error) {
			console.error('Error generating pre-signed URL:', error);
		}
	}
})();

// listen to port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Server started and running on port ' + PORT));
