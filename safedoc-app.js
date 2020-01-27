'use strict';
var express = require('express');
var fs = require('fs');
const mysql = require('mysql');
var multer = require('multer');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var util = require('util');
var app = express();
var expressJWT = require('express-jwt');
var jwt = require('jsonwebtoken');
var bearerToken = require('express-bearer-token');
var cors = require('cors');

const IPFS = require('ipfs-mini');
const ipfs = new IPFS({ host: 'localhost', port: 5001, protocol: 'http' });

var email = require('./app/mail.js');
require('./config.js');
var hfc = require('fabric-client');

var utils = require('./app/utils.js');
var createChannel = require('./app/create-channel.js');
var join = require('./app/join-channel.js');
var install = require('./app/install-chaincode.js');
var instantiate = require('./app/instantiate-chaincode.js');
var upgrade = require('./app/upgrade-chaincode.js');
var invoke = require('./app/invoke-transaction.js');
var query = require('./app/query.js');
var host = process.env.HOST || hfc.getConfigSetting('host');
var port = process.env.PORT || hfc.getConfigSetting('port');

// Mysql Database connectivity
var connection = mysql.createConnection({
	host: 'localhost',
	user: 'cievus1',
	password: 'cievus123'
});
connection.query('USE digidoc');
/*
    db: {
      host: "ec2-54-204-141-197.compute-1.amazonaws.com", // ip address of server running mysql
      user: "cievus1",
      username: "cievus1",    // user name to your mysql database
      password: "cievus123",    // corresponding password
      database: "digidoc", // use the specified database
      dialect: 'mysql'
    },
*/
var log4js = require('log4js');
var logger = log4js.getLogger('Cievus-SafeDoc-App:[app.js]');
log4js.configure({
	appenders: {
		allLogs: {
			type: 'file',
			filename: 'logs/all_log.log'
		},
		specialLogs: {
			type: 'file',
			filename: 'logs/special_log.log'
		},
		console: {
			type: 'console'
		}
	},
	categories: {
		write: {
			appenders: ['specialLogs'],
			level: 'info'
		},
		default: {
			appenders: ['console', 'allLogs'],
			level: 'trace'
		}
	}
});

const baseurl = "/api/v1";

//********************** SET CONFIGURATIONS *******************************

app.options('*', cors());
app.use(cors());
//support parsing of application/json type post data
app.use(bodyParser.json());

//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({
	extended: false
}));
// set secret variable
app.set('secret', 'C!3VU$tokenSecret');
app.use(expressJWT({
	secret: 'C!3VU$tokenSecret'
}).unless({
	path: [baseurl + '/auth_user', baseurl + '/newAffiliation']
}));
app.use(bearerToken());
app.use(function (err, req, res, next) {
	console.log("err>>>.." + err);
	if (err.name === 'UnauthorizedError') {
		res.status(401).send({
			"success": "false",
			"message": "Invalid Token"
		});
	}
});
app.use(function (req, res, next) {
	logger.debug(' New request for %s', req.originalUrl);
	if (req.originalUrl.indexOf(baseurl + '/auth_user') >= 0) {
		return next();
	}
	if (req.originalUrl.indexOf(baseurl + '/newAffiliation') >= 0) {
		return next();
	}
	var token = req.token;
	jwt.verify(token, app.get('secret'), function (err, decoded) {
		if (err) {
			res.send({
				success: false,
				message: 'Failed to authenticate token. Make sure to include the ' +
					'token returned from /api/v1/auth_user call in the authorization header ' +
					' as a Bearer token'
			});
			return;
		} else {
			// add the decoded user name and org name to the request object
			// for the downstream code to use
			req.username = decoded.username;
			req.orgname = decoded.orgName;
			logger.debug(util.format('Decoded from JWT token: username - %s, orgname - %s', decoded.username, decoded.orgName));
			return next();
		}
	});
});

//**************************************************************** 
//************************ START SERVER *******************************

var server = http.createServer(app).listen(port, function () { });
logger.info('****************** SERVER STARTED ************************');
logger.info('***************  http://%s:%s  ******************', host, port);
server.timeout = 240000;

function getErrorMessage(field) {
	var response = {
		success: false,
		message: field + ' field is missing or Invalid in the request'
	};
	return response;
}

//******************* REST ENDPOINTS START HERE *****************************
//******************* BlockChain Setup Endpoints ****************************
// **************************************************************************

// Register and enroll user
app.post(baseurl + '/auth_user', async function (req, res) {
	try {
		var username = req.body.username;
		var orgName = req.body.orgName;
		if (!username) {
			res.json(getErrorMessage('\'username\''));
			return;
		}
		if (!orgName) {
			res.json(getErrorMessage('\'orgName\''));
			return;
		}
		var token = jwt.sign({
			exp: Math.floor(Date.now() / 1000) + parseInt(hfc.getConfigSetting('jwt_expiretime')),
			username: username,
			orgName: orgName
		}, app.get('secret'));
		let response = await utils.enrollInitUser(username, orgName, true);
		if (response && typeof response !== 'string') {
			logger.debug('Successfully registered the username %s for organization %s', username, orgName);
			response.token = token;
			res.json(response);
		} else {
			logger.debug('Failed to register the username %s for organization %s with::%s', username, orgName, response);
			res.json({
				success: false,
				message: response
			});
		}
	} catch (e) {
		res.json({
			success: false,
			message: e.toString()
		});
	}

});

// Create Channel
app.post(baseurl + '/create_channels', async function (req, res) {
	logger.info('<<<<<<<<<<<<<<<<< C R E A T E  C H A N N E L >>>>>>>>>>>>>>>>>');
	logger.debug('End point : /api/v1/create_channels');
	var channelName = req.body.channelName;
	var channelConfigPath = req.body.channelConfigPath;
	logger.debug('Channel name : ' + channelName);
	logger.debug('channelConfigPath : ' + channelConfigPath); //../artifacts/channel/mychannel.tx
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!channelConfigPath) {
		res.json(getErrorMessage('\'channelConfigPath\''));
		return;
	}

	let message = await createChannel.createChannel(channelName, channelConfigPath, req.username, req.orgname);
	res.send(message);
});
// Join Channel
app.post(baseurl + '/join_channels/:channelName/peers', async function (req, res) {
	logger.info('<<<<<<<<<<<<<<<<< J O I N  C H A N N E L >>>>>>>>>>>>>>>>>');
	var channelName = req.params.channelName;
	var peers = req.body.peers;
	logger.debug('channelName : ' + channelName);
	logger.debug('peers : ' + peers);
	logger.debug('username :' + req.username);
	logger.debug('orgname:' + req.orgname);

	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peers || peers.length == 0) {
		res.json(getErrorMessage('\'peers\''));
		return;
	}

	let message = await join.joinChannel(channelName, peers, req.username, req.orgname);
	res.send(message);
});
// Install chaincode on target peers
app.post(baseurl + '/install_chaincodes', async function (req, res) {
	logger.debug('==================== INSTALL CHAINCODE ==================');
	var peers = req.body.peers;
	var chaincodeName = req.body.chaincodeName;
	var chaincodePath = req.body.chaincodePath;
	var chaincodeVersion = req.body.chaincodeVersion;
	var chaincodeType = req.body.chaincodeType;
	logger.debug('peers : ' + peers); // target peers list
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('chaincodePath  : ' + chaincodePath);
	logger.debug('chaincodeVersion  : ' + chaincodeVersion);
	logger.debug('chaincodeType  : ' + chaincodeType);
	if (!peers || peers.length == 0) {
		res.json(getErrorMessage('\'peers\''));
		return;
	}
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!chaincodePath) {
		res.json(getErrorMessage('\'chaincodePath\''));
		return;
	}
	if (!chaincodeVersion) {
		res.json(getErrorMessage('\'chaincodeVersion\''));
		return;
	}
	if (!chaincodeType) {
		res.json(getErrorMessage('\'chaincodeType\''));
		return;
	}
	let message = await install.installChaincode(peers, chaincodeName, chaincodePath, chaincodeVersion, chaincodeType, req.username, req.orgname)
	res.send(message);
});
// Instantiate chaincode on target peers
app.post(baseurl + '/instantiate_chaincode/:channelName/chaincodes', async function (req, res) {
	logger.debug('==================== INSTANTIATE CHAINCODE ==================');
	var peers = req.body.peers;
	var chaincodeName = req.body.chaincodeName;
	var chaincodeVersion = req.body.chaincodeVersion;
	var channelName = req.params.channelName;
	var chaincodeType = req.body.chaincodeType;
	var fcn = req.body.fcn;
	var args = req.body.args;
	logger.debug('peers  : ' + peers);
	logger.debug('channelName  : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('chaincodeVersion  : ' + chaincodeVersion);
	logger.debug('chaincodeType  : ' + chaincodeType);
	logger.debug('fcn  : ' + fcn);
	logger.debug('args  : ' + args);
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!chaincodeVersion) {
		res.json(getErrorMessage('\'chaincodeVersion\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!chaincodeType) {
		res.json(getErrorMessage('\'chaincodeType\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}

	let message = await instantiate.instantiateChaincode(peers, channelName, chaincodeName, chaincodeVersion, chaincodeType, fcn, args, req.username, req.orgname);
	res.send(message);
});

// Upgrade chaincode on target peers
app.post(baseurl + '/upgrade_chaincode/:channelName/chaincodes', async function (req, res) {
	logger.debug('==================== UPGRADE CHAINCODE ==================');
	var peers = req.body.peers;
	var chaincodeName = req.body.chaincodeName;
	var chaincodeVersion = req.body.chaincodeVersion;
	var channelName = req.params.channelName;
	var chaincodeType = req.body.chaincodeType;
	var fcn = req.body.fcn;
	var args = req.body.args;
	logger.debug('peers  : ' + peers);
	logger.debug('channelName  : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('chaincodeVersion  : ' + chaincodeVersion);
	logger.debug('chaincodeType  : ' + chaincodeType);
	logger.debug('fcn  : ' + fcn);
	logger.debug('args  : ' + args);
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!chaincodeVersion) {
		res.json(getErrorMessage('\'chaincodeVersion\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!chaincodeType) {
		res.json(getErrorMessage('\'chaincodeType\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}

	let message = await upgrade.upgradeChaincode(peers, channelName, chaincodeName, chaincodeVersion, chaincodeType, fcn, args, req.username, req.orgname);
	res.send(message);
});

// ************************************************************************************
// **************************BlockChain System Query Endpoints*************************
// ************************************************************************************

//Query for Channel Information
app.get(baseurl + '/cievus-safedoc-channel/info', async function (req, res) {
	console.log('================ QUERY CHANNEL INFORMATION ======================');
	var peer = "peer0.client1.cievus.com";
	var channelName = "cievus-safedoc-channel";
	let message = await query.getChainInfo(peer, channelName, req.username, req.orgname);
	res.send(message);
});

//  Query Block by BlockNumber
app.get(baseurl + '/cievus-safedoc-channel/block_info/:blockId', async function (req, res) {
	console.log('==================== GET BLOCK BY NUMBER ==================');
	let blockId = req.params.blockId;
	let peer = "peer0.client1.cievus.com";
	var channelName = "cievus-safedoc-channel";
	if (!blockId) {
		res.json(getErrorMessage('\'blockId\''));
		return;
	}
	let message = await query.getBlockByNumber(peer, channelName, blockId, req.username, req.orgname);
	res.send(message);
});

// Query Transaction by Transaction ID
app.get(baseurl + '/cievus-safedoc-channel/transaction_info/:trxnId', async function (req, res) {
	console.log('================ GET TRANSACTION BY TRANSACTION_ID ======================');
	let peer = "peer0.client1.cievus.com";
	var channelName = "cievus-safedoc-channel";
	let trxnId = req.params.trxnId;
	if (!trxnId) {
		res.json(getErrorMessage('\'trxnId\''));
		return;
	}
	let message = await query.getTransactionByID(peer, channelName, trxnId, req.username, req.orgname);
	console.log(message);
	res.send(message);
});

// Query Block by Hash
app.get(baseurl + '/block/by_hash', async function (req, res) {
	console.log('================ GET BLOCK BY HASH ======================');
	let hash = req.query.hash;
	let peer = "peer0.client1.cievus.com";
	var channelName = "cievus-safedoc-channel";
	if (!hash) {
		res.json(getErrorMessage('\'hash\''));
		return;
	}
	let message = await query.getBlockByHash(peer, channelName, hash, req.username, req.orgname);
	res.send(message);
});

//Query for Channel instantiated chaincodes
app.get(baseurl + '/cievus-safedoc-channel/instantiated_chaincodes', async function (req, res) {
	console.log('============= GET INSTANTIATED CHAINCODES ===================');
	let peer = "peer0.client1.cievus.com";
	var channelName = "cievus-safedoc-channel";
	let message = await query.getInstalledChaincodes(peer, channelName, 'instantiated', req.username, req.orgname);
	res.send(message);
});

// Query to fetch all Installed chaincodes
app.get(baseurl + '/cievus-safedoc-channel/installed_chaincodes', async function (req, res) {
	let peer = "peer0.client1.cievus.com";
	var channelName = "cievus-safedoc-channel";
	console.log('================ GET INSTALLED CHAINCODES ======================');
	let message = await query.getInstalledChaincodes(peer, channelName, 'installed', req.username, req.orgname)
	res.send(message);
});

// Query to fetch channels
app.get(baseurl + '/get_channels', async function (req, res) {
	console.log('================ GET CHANNELS ======================');
	let peer = "peer0.client1.cievus.com";
	if (!peer) {
		res.json(getErrorMessage('\'peer\''));
		return;
	}
	let message = await query.getChannels(peer, req.username, req.orgname);
	res.send(message);
});

app.post(baseurl + '/newAffiliation', async function (req, res) {
	logger.debug('***/newAffiliation***');
	var orgName = req.body.orgName;
	var affiliation = req.body.affiliation;
	try {
		let message = await utils.createNewAffiliation(orgName, affiliation);
		logger.debug(message);
		res.send(message);
	} catch (e) {
		var response = e.toString();
		logger.info(response);
		res.send(response);
	}
});



// ************************************************************************************
// *****************************SmartContract Endpoints********************************
// ************************************************************************************


// function to encode file data to base64 encoded string
function base64_encode(file) {
	// read binary data
	var bitmap = fs.readFileSync(file);
	// convert binary data to base64 encoded string
	return new Buffer(bitmap).toString('base64');
}

// function to create file from base64 encoded string
function base64_decode(base64str, file) {
	// create buffer object from base64 encoded string, it is important to tell the constructor that the string is base64 encoded
	var bitmap = new Buffer(base64str, 'base64');
	// write buffer to file
	fs.writeFileSync(file, bitmap);
	console.log('******** File created from base64 encoded string ********');
}
var fileName;

var storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, './fileStore')
	},
	filename: function (req, file, cb) {
		cb(null, file.originalname);
		fileName = file.originalname;
	}
})
var upload = multer({ storage: storage });

var uploadSingle = multer({ //multer settings
	storage: storage
}).single('file');

//add a new file
app.post(baseurl + '/upload_file_bkp/:fileid', upload.single('file'), function (req, res) {
	var fileId = req.params.fileid;
	let testFile = fs.readFileSync(req.file.path);
	let testBuffer = new Buffer(testFile);
	console.log("File Info***" + req.file.path);
	ipfs.addJSON({ path: req.file.path, content: testBuffer }, async function (err, result) {
		if (err) {
			res.json({ status: 400, error: err.toString() })
		} else {
			fs.unlinkSync(req.file.path)
			console.log("IPFS Response" + result);
			var hash = result;
			var fileName = req.file.filename;
			var mimetype = req.file.mimetype;
			//res.json({ status: 200, hash: result , filedetails:req.file})
			//---------------------------------------------------------------------------
			var args = [];
			args.push(fileId);
			args.push(fileName);
			args.push(hash);
			args.push(mimetype);
			args.push(req.username);
			var peers = "peer0.client1.cievus.com";
			var chaincodeName = "safedoc";
			var channelName = "cievus-safedoc-channel";
			var fcn = "uploadFile";
			console.log("Input args:" + args);
			var message = "";
			try {
				message = await invoke.invokeChaincode(peers, channelName, chaincodeName, fcn, args, req.username, req.orgname);
				console.log("message------------" + message);
			} catch (err) {
				res.send({
					success: false,
					message: 'Invoke request failed, Not a valid transaction ',
					trxnid: null
				});
			}
			res.send({
				success: true,
				message: 'File added successfully',
				trxnid: message.tx_id,
				ipfshash: hash,
				filename: fileName
			});
			//---------------------------------------------------------------------------
		}
	})
});

// Query:- download a file
app.get(baseurl + '/download_file/:fileid', async function (req, res) {
	logger.debug('==================download File ================');
	var args = [req.params.fileid];
	var peer = "peer0.client1.cievus.com";
	var chaincodeName = "safedoc";
	var channelName = "cievus-safedoc-channel";
	var fcn = "downloadFile";
	let message = await query.queryChaincode(peer, channelName, chaincodeName, args, fcn, req.username, req.orgname);
	logger.debug(message);
	var resp = JSON.parse(message);
	var hash = resp.Hash;
	console.log("hash---" + hash);
	ipfs.catJSON(hash, function (err, files) {
		if (err) {
			res.json({ status: 400, error: err.toString() })
		} else {
			//fs.writeFileSync(files.path, Buffer(files.content.data))
			//------------------------------------------
			//var data = fs.readFileSync(files.path);
			//fs.unlinkSync(files.path)
			//res.contentType(resp.Mimetype);
			//console.log(files.content.data);
			res.send(files.data);

		}
	});
});

// Query:- Get history of a file by File ID
app.get(baseurl + '/get_File_History_from_history_data/:fileid/:no', async function (req, res) {
	logger.debug('==================Get File History ================');
	var args = [];
	var peer = "peer0.client1.cievus.com";
	var chaincodeName = "safedoc";
	var channelName = "cievus-safedoc-channel";
	var fcn = "getFileHistory";
	args.push(req.params.fileid);
	let message = await query.queryChaincode(peer, channelName, chaincodeName, args, fcn, req.username, req.orgname);
	logger.debug("response" + message);
	var filedata = JSON.parse(message);
	logger.debug("filedata" + filedata);
	var no = req.params.no;
	var hash = filedata[no].value.Hash;
	var mimetype = filedata[no].value.Mimetype;
	console.log("hash**" + hash);
	console.log("mimetype***" + mimetype);
	ipfs.catJSON(hash, function (err, files) {
		if (err) {
			res.json({ status: 400, error: err.toString() })
		} else {
			//fs.writeFileSync(files.path, Buffer(files.content.data))
			//------------------------------------------
			//var data = fs.readFileSync(files.path);
			//fs.unlinkSync(files.path)
			//res.contentType(mimetype);
			res.send(files.data);
		}
	});
});

// Query:- Get history of a file by File ID
app.get(baseurl + '/get_File_History/:fileid', async function (req, res) {
	logger.debug('==================Get File History ================');
	var args = [];
	var peer = "peer0.client1.cievus.com";
	var chaincodeName = "safedoc";
	var channelName = "cievus-safedoc-channel";
	var fcn = "getFileHistory";
	args.push(req.params.fileid);
	let message = await query.queryChaincode(peer, channelName, chaincodeName, args, fcn, req.username, req.orgname);
	logger.debug(message);
	res.send(message);
});

// Transaction:- Approve file
app.post(baseurl + '/approve_file', async function (req, res) {
	logger.debug('=================Approve File================');
	var peers = "peer0.client1.cievus.com";
	var chaincodeName = "safedoc";
	var channelName = "cievus-safedoc-channel";
	var fcn = "approveDocument";
	var args = req.body.args;
	var message = "";
	try {
		message = await invoke.invokeChaincode(peers, channelName, chaincodeName, fcn, args, req.username, req.orgname);
	} catch (err) {
		res.send({
			success: false,
			message: 'Invoke request failed, Not a valid transaction ',
			trxnid: null
		});
	}
	res.send({
		success: true,
		message: 'File approved successfully',
		trxnid: message.tx_id
	});
});

app.get(baseurl + '/get_approval_status/:fileid', async function (req, res) {
	logger.debug('==================download File ================');
	var args = [req.params.fileid];
	var peer = "peer0.client1.cievus.com";
	var chaincodeName = "safedoc";
	var channelName = "cievus-safedoc-channel";
	var fcn = "approvalStatus";
	let message = await query.queryChaincode(peer, channelName, chaincodeName, args, fcn, req.username, req.orgname);
	logger.debug(message);
	res.send(message);
});

// Send email
app.post(baseurl + '/send_email', async function (req, res) {
	logger.debug('=================Send email================');
	var resp = "";
	var emaildata = {
		from: req.body.from,
		to: req.body.to,
		subject: req.body.subject,
		html: req.body.body
	}
	try {
		resp = await email.sentMail(emaildata);
		console.log(resp);
	} catch (err) {
		res.send({
			success: false,
			message: 'email sending failed ',
			trxnid: null,
			error: err.toString()
		});
	}
	res.send({
		success: true,
		message: 'email Send',
		resp: resp
	});
});


// ------------------------------------------------
// **************Duplication check*****************
// ------------------------------------------------

//upload a new file
app.post(baseurl + '/upload_file/:fileid', upload.single('file'), function (req, res) {
	var fileId = req.params.fileid;
	console.log(req.file);
	if (!req.file) {
		res.json({ status: 400, error: "Invalid File " })
	}
	let testFile = fs.readFileSync(req.file.path);
	let testBuffer = new Buffer(testFile);
	console.log("File Info***" + req.file.path);
	ipfs.addJSON(testBuffer, async function (err, result) {
		if (err) {
			res.json({ status: 400, error: err.toString() })
		} else {
			fs.unlinkSync(req.file.path)
			console.log("IPFS Response" + result);
			var hash = result;
			var fileName = req.file.filename;
			var mimetype = req.file.mimetype;
			//--------------------------DUPLICATION CHECK--------------------------------
			connection.query(`SELECT * FROM hashtable WHERE ipfshash='${hash}'`, async function (error, results, fields) {
				if (error) {
					console.log(error.toString());
					res.json({ success: false, status: 400, message: error.toString() })
				}
				console.log(results);
				if (results[0]) {
					connection.query(`SELECT * FROM hashtable WHERE filename='${fileName}' AND ipfshash='${hash}'`, async function (error, results, fields) {
						if (error) {
							console.log(error.toString());
							res.json({ success: false, status: 400, message: error.toString() })
						}
						if (results[0]) {
							res.json({ success: true, status: 200, respcode: 250, message: "hash and file name exist ", fileName: fileName, ipfshash: hash, mimetype: mimetype, user: req.username });
						} else {
							res.json({ success: true, status: 200, respcode: 251, message: "hash already exist", fileName: fileName, ipfshash: hash, mimetype: mimetype, user: req.username });
						}
					});
				} else {
					var args = [];
					args.push(fileId);
					args.push(fileName);
					args.push(hash);
					args.push(mimetype);
					args.push(req.username);
					var peers = "peer0.client1.cievus.com";
					var chaincodeName = "safedoc";
					var channelName = "cievus-safedoc-channel";
					var fcn = "uploadFile";
					console.log("Input args:" + args);
					var message = "";
					try {
						message = await invoke.invokeChaincode(peers, channelName, chaincodeName, fcn, args, req.username, req.orgname);
						console.log("message------------" + message);
					} catch (err) {
						res.send({
							success: false,
							message: 'Invoke request failed, Not a valid transaction ',
							trxnid: null
						});
					}
					var post = { filename: fileName, ipfshash: hash }
					connection.query('INSERT INTO hashtable SET ?', post, function (error, results, fields) {
						if (error) {
							console.log(error.toString());
							res.json({ success: false, status: 400, message: error.toString() })
						}
						if (results) {
							console.log("ipfs hash added to ipfs hashtable");
						}
					});
					res.send({
						success: true,
						message: 'File added successfully',
						trxnid: message.tx_id,
						ipfshash: hash,
						filename: fileName
					});
				}
			});
		}
	})
});

//Add file details to DLT, return hash add to ipfs pool
app.post(baseurl + '/force_upload_file/:fileid', async function (req, res) {
	logger.debug('=================upload_file_to_ledger================');
	var peers = "peer0.client1.cievus.com";
	var chaincodeName = "safedoc";
	var channelName = "cievus-safedoc-channel";
	var fcn = "uploadFile";
	var args = [req.params.fileid];
	args.push(req.body.fileName);
	args.push(req.body.ipfshash);
	args.push(req.body.mimetype);
	args.push(req.username);
	console.log("Input args:" + args);
	var message = "";
	try {
		message = await invoke.invokeChaincode(peers, channelName, chaincodeName, fcn, args, req.username, req.orgname);
	} catch (err) {
		res.send({
			success: false,
			message: 'Invoke request failed, Not a valid transaction',
			error: err.toString(),
			trxnid: null,
			ipfshash: null,
			filename: null,
		});
	}
	var post = { filename: req.body.fileName.toString(), ipfshash: req.body.ipfshash.toString() }
	connection.query('INSERT INTO hashtable SET ?', post, function (error, results, fields) {
		if (error) {
			console.log(error.toString());
			res.json({ success: false, status: 400, message: error.toString() })
		}
		if (results) {
			console.log("ipfs hash added to ipfs hashtable");
		}
	});
	res.send({
		success: true,
		message: 'File added successfully',
		trxnid: message.tx_id,
		ipfshash: args[2],
		filename: args[1],
		error: null
	});
});