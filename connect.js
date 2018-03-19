

const glob = require('glob');
const mongoose = require('mongoose');
const config = require('./config');
mongoose.Promise = global.Promise;
const db = mongoose.connection;

// If the connection throws an error
db.on('error', function () {
    OUT.error(`unable to connect to database at ${config.db}`);
    throw new Error('unable to connect to database at ' + config.db);
});
// When the connection is disconnected
db.on('disconnected', function () {
    OUT.info('Mongoose default connection to DB :' + config.db + ' disconnected');
});


const gracefulExit = function() {
    db.close(function () {
        console.log('Mongoose default connection with DB :' + config.mongodb + ' is disconnected through app termination');
        process.exit(0);
    });
};

// If the Node process ends, close the Mongoose connection
process.on('SIGINT', gracefulExit).on('SIGTERM', gracefulExit);

try {
    OUT.info(`connet to mongodb : ${config.db}`);
    mongoose.connect(config.db, {
        auto_reconnect: true,
        poolSize: 10,
        native_parser: true,
        replset: {socketOptions: {keepAlive: 1}},
        server: {socketOptions: {keepAlive: 1}}
    });
} catch (err) {
    OUT.info("Sever initialization failed " , err.message);
}

const models = glob.sync(config.root + '/models/*.js');
models.forEach(function (model) {
    require(model);
});






module.exports = db;