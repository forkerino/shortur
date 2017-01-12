'use strict';
let express = require('express');
let mongo = require('mongodb').MongoClient;
let dns = require('dns');
let dotenv = require('dotenv');
dotenv.config();
let dburl = process.env.MONGOLAB_URI;

let app = express();

app.get('/api/shorturl/new/*', function(req, res){
	let url = String(req.params[0]);
	if (!checkUrl(url)) {
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
					res.end(JSON.stringify({"original_url": orurl, "short_url": shortur}));
					db.close();
				} else {
					urls.find().sort({"short_url": -1}).limit(1).toArray(function(err,doc){
						if (err) throw err;
						let id = doc.length == 0 ? 1 : doc[0]["short_url"]+1;
						urls.insert({"original_url": url, "short_url": id}, function(err, data){
							if (err) throw err;
							res.end(JSON.stringify({"original_url": url, "short_url": id}));
							db.close();
						}); 
					});	
				}
			});
			
		});
	}
});

app.get('/:shortur', function(req, res){
	let shortur = Number(req.params.shortur);
	if (isNaN(shortur)) res.end('invalid short_url');
	mongo.connect(dburl, function(err,db){
		if (err) throw err;
		let urls = db.collection('urls');
		urls.find({short_url: { $eq : shortur}}).toArray(function(err,doc){
			if (err) throw err;
			if (doc.length == 0) {
				db.close();
				res.end('invalid short_url');
			} else {
				let url = doc[0]["original_url"];
				db.close();
				res.redirect(url);
			}
		});
	});
});

app.get('*', function(req, res){
	res.end('put your url behind the /api/shorturl/new/ to receive a shortur url');
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
