'use strict';
let express = require('express');
let mongo = require('mongodb').MongoClient;
let dns = require('dns');
let dotenv = require('dotenv');
let path = require('path');
let bodyparser = require('body-parser');

dotenv.config();
let dburl = process.env.MONGOLAB_URI;

let app = express();

app.use(express.static(path.join(__dirname, 'static')));
app.use(bodyparser.urlencoded({extended: false}));

app.get('/api/shorturl/new/*', function(req, res){
	let url = String(req.params[0]);
	insertToDb(url, req, res);
});

app.get('/:shortur', function(req, res){
	let shortur = Number(req.params.shortur);
	if (isNaN(shortur)) {
		res.end('invalid short_url, go to ' + req.headers.host + '/api/shorturl/new to create a shortur url' );
	}
	mongo.connect(dburl, function(err,db){
		if (err) throw err;
		let urls = db.collection('urls');
		urls.find({short_url: { $eq : shortur}}).toArray(function(err,doc){
			if (err) throw err;
			if (doc.length == 0) {
				db.close();
				res.end('invalid short_url, go to ' + req.headers.host + '/api/shorturl/new to create a shortur url' );
			} else {
				let url = doc[0]["original_url"];
				db.close();
				res.redirect(url);
			}
		});
	});
});

app.get('/api/shorturl/new', function(req, res){
	res.sendFile(path.join(__dirname, 'static','form.html'));
});

app.post('/api/shorturl/new', function(req, res){
	let url = String(req.body.url).trim();
	insertToDb(url, req, res);
});

app.get('*', function(req, res){
	res.redirect('/api/shorturl/new');
});

app.listen(process.env.PORT || 8080, function(){
	console.log('Listening');
});

function checkUrl(url){
	//const URLRegEx = "/(http|https):\/{2}(www.)?[a-z0-9]+\.[a-z]+(.[a-z]+)\//i"; // Tried first with RegExp
	return dns.lookup(url, function(err, address, family){
		if (err) return false;
		return true;
	});
}

function insertToDb(url, req, res) {
	if (!checkUrl(url) || url == "") {
		res.end('please provide a valid url, using http(s)://(www).domain.ext(.ext)/ -case insensitive');
	} else {
		mongo.connect(dburl, function(err, db){
			if (err) throw err;
			let urls = db.collection('urls');
			urls.find({original_url: { $eq : url}}).toArray(function(err,doc){
				if (err) throw err;
				if (doc.length != 0) { // url already in db
					let orurl = doc[0]["original_url"];
					let shortur = doc[0]["short_url"];
					res.end(JSON.stringify({"original_url": orurl, "short_url": req.headers.host + '/' + shortur}));
					db.close();
				} else {
					urls.find().sort({"short_url": -1}).limit(1).toArray(function(err,doc){
						if (err) throw err;
						let id = doc.length == 0 ? 1 : doc[0]["short_url"]+1;
						urls.insert({"original_url": url, "short_url": id}, function(err, data){
							if (err) throw err;
							res.end(JSON.stringify({"original_url": url, "short_url": req.headers.host + '/' + id}));
							db.close();
						}); 
					});	
				}
			});
			
		});
	}
}