require('dotenv').config();
const uuid = require('uuid');
const axios = require("axios");
const express = require('express');

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const puppeteer = require('puppeteer');
const fullPageScreenshot = require('puppeteer-full-page-screenshot').default;

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());


(async () => {	
	app.get('/render', (req, res) => {
		
		var debug = false;

		if (req.headers.authorization === process.env.AUTH_KEY) {
			try {
				if (debug || (req.body.html && req.body.css)) {
					(async () => {
						const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=1200,1200'] });
						const page = await browser.newPage();

						if(debug){							
							var request = {
								"html": "<div id='main'><div class='photo flow'></div><div class='brand flow'><div class='text'>成功建立房地產團隊的關鍵步驟</div></div></div>",
								"css": "#main { width: 1200px; height: 1200px; } .flow { position: absolute; display: block; top: 0; bottom: 0; left: 0; right: 0; background-repeat: none; background-size: cover; background-position: center center; } .photo { top: 450px; background-image: url(https://images.pexels.com/photos/27299109/pexels-photo-27299109.jpeg); } .brand { background-image: url(https://louisjr-temp.s3.ap-east-1.amazonaws.com/aaverve/fb-1.png); } .text { text-align: center; margin-top: 180px; color: #FFF; font-family: Noto Sans HK, sans-serif; font-optical-sizing: auto; font-style: normal; font-size: 72px;}"
							}
	
							req.body.html = request.html;
							req.body.css = request.css;							
						}

						await page.setViewport({ width: 1200, height: 1200 });
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
						
						var img_uuid = uuid.v4();
						if(req.body.img_id && req.body.img_id.length > 0){
							img_uuid = req.body.img_id;
						}

						await fullPageScreenshot(page, { path: 'img/' + img_uuid + '.png' });
						await page.close();

						await browser.close();

						var aws_s3_url = await upload_s3(__dirname + '/img/' + img_uuid + '.png', img_uuid + '.png');
						res.status(200).send({
							"img_id": img_uuid,
							"aws_s3_url": aws_s3_url						
						});

					})();
				} else {					
					res.status(400).send('Some fields are missing with request.');
				}
			}
			catch (e) {
				res.status(400).send('Some fields are missing with request.');
			}

		} else {			
			res.status(403).send('Auth key missing with request.');
		}
	});

	async function upload_s3(file_path, file_name) {		
		const s3Client = new S3Client({
			region: process.env.aws_region,
			credentials: {
				accessKeyId: process.env.aws_accessKeyId,
				secretAccessKey: process.env.aws_secretAccessKey,
			},
		});

		try {
			const params = {
				Bucket: process.env.aws_bucket, // Your S3 bucket name
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

			return `https://${process.env.aws_bucket}.s3.${process.env.aws_region}.amazonaws.com/` + file_name;
		} catch (error) {
			console.error('Error generating pre-signed URL:', error);
		}
	}
})();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Server started and running on port ' + PORT));
