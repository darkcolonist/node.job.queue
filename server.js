var express    = require('express'),
    async      = require('async'),
    uniqid     = require('uniqid'),
    bodyParser = require('body-parser'),
    http       = require('http'),
    request    = require('request'),
    nedb       = require('nedb'),
    moment     = require('moment'),

    app        = express();
    server     = http.createServer(app),
    io         = require('socket.io').listen(server);

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({
  extended: true
}));

var settings = {
  /**
   * number of jobs (per queue) to run at the same time
   * @type {Number}
   */
  concurrency : 5,

  /**
   * compact database frequency (milliseconds)
   * @type {Number}
   */
  db_compact_frequency : 30000,

  /**
   * duration to keep done jobs in array (milliseconds)
   * @type {Number}
   */
  done_jobs_lifetime : 6000,

  /**
   * the port in which this application will run
   * @type {Number}
   */
  port : 1028,

  /**
   * expiration time of errors in errors.db. (hours)
   * after this is reached, errors get pruned from errors.db
   * @type {Number}
   */
  max_age_of_errors : 24
};

var jobs = [
  // {
  //   url : "http://www.example.com",
  //   data : { one : "this is the number one" },
  //   callback : "http://www.example.com/callback"
  // }
];

// job_queue = async.queue(function (task, finished) {
//   task.obj.finished = finished;
//   task.execute(task.obj);
// }, settings.concurrency);

var queues = {}

db_jobs = new nedb({ filename: "data/jobs.db", autoload: true });
db_errors = new nedb({ filename: "data/errors.db", autoload: true });

app.post('/enqueue', function(req, res){
  if(typeof req.body.url === 'undefined'){
    res.json(
      { 
        message : "ERROR: url parameter is not a valid url"
      }
    )
    return
  }
  
  util.enqueue(req.body);

  res.json(
    { 
      message : "SUCCESS: job added",
      job : job
    }
  );
});

app.get('/jobs', function(req, res){
  res.json(jobs);
});

util = {
  get_queue : function(name){
    if(typeof queues[name] === 'undefined'){
      // create a new queue
      queues[name] = async.queue(function(task, finished){
        task.obj.finished = finished;
        task.execute(task.obj);
      }, settings.concurrency);
    }

    return queues[name];
  },

  enqueue : function(data, in_db){
    var queue_name = typeof data.queue === 'undefined' ? "main" : data.queue;
    var in_db = typeof in_db === 'undefined' ? false : in_db;

    queue = util.get_queue(queue_name);

    job = {
      _id      : typeof data._id === 'undefined' ? uniqid() : data._id,
      queue    : queue_name,
      status   : typeof data.status === 'undefined' ? "waiting" : data.status,
      url      : data.url,
      data     : data.data,
      callback : data.callback
    };

    if(!in_db)
      db_jobs.insert(job, function(err, doc){ /** inserted */ });

    task = {
      obj : job,
      execute : function(obj){
        obj.status = "working";

        request.post(
          obj.url,
          { form: obj.data },
          function (error, response, body) {
            if (!error && response.statusCode == 200) {
              obj.status = "done";
            }else{
              obj.status = "failed";
              obj.error = "failed";
              obj.type = "called";
              obj.timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
              db_errors.insert(obj, function(err, doc){ /** inserted */ });
            }

            db_jobs.update({ _id: obj._id }, { $set: { "status" : obj.status } }, {}, function(err, num_replaced, upsert){});

            if(typeof obj.callback !== 'undefined'){
              
              try{
                  obj.url_response = JSON.parse(body);
              }catch(e){
                  obj.url_response = body;
              }
              
              request.post(
                obj.callback,
                { form : obj },
                function(error_cb, response_cb, body_cb){
                  // nothing needs to be done here
                }
              ).on('error', function(err){
                obj.error = err;
                obj.type = "callback_url";
                obj.timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
                db_errors.insert(obj, function(err, doc){ /** inserted */ });
              });
            }

            // remove from queue after settings.done_jobs_lifetime
            setTimeout(function(){
              var index = jobs.indexOf(obj);

              db_jobs.remove({ _id: jobs[index]._id }, {}, function(err, num_removed){});

              jobs.splice(index, 1);
            } , settings.done_jobs_lifetime);

            obj.finished();
          }
        ).on('error', function(err){
          obj.error = err;
          obj.type = "url";
          obj.timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
          db_errors.insert(obj, function(err, doc){ /** inserted */ });
        });
      }
    }

    jobs.push(job);
    queue.push(task);
  },

  // curl : function(url, callback){

  // },

  is_url : function(str){
    var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|'+ // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
      '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
    return pattern.test(str);
  },

  try_enqueue_from_db : function(){
    db_jobs.count({}, function(err, count){

      if(count > 0){
        console.log(count + " unfinished jobs found, enqueuing...");
        db_jobs.find({}, function(err, docs){
          for (var i = 0; i < docs.length; i++) {
            util.enqueue(docs[i]);
          }
          console.log("unfinished jobs queued, continuing normally...");
        });
      }else{
        console.log("no unfinished jobs found, continuing normally...");
      }

    });
  },

  delete_aged_errors : function(){
    var max_date = moment()
      .subtract(settings.max_age_of_errors, "hours")
      .format('YYYY-MM-DD HH:mm:ss');

    db_errors.remove({ timestamp : { $lte : max_date } }, { multi: true }, function (err, numRemoved) {
      // numRemoved = 1
      setTimeout(util.delete_aged_errors, settings.db_compact_frequency);
    });
  }
}


/**
 * on startup, check jobs that need to be ran and were unable to run
 * last time
 */
util.try_enqueue_from_db();

/**
 * initialize databases
 */
db_jobs.persistence.setAutocompactionInterval(settings.db_compact_frequency);
db_errors.persistence.setAutocompactionInterval(settings.db_compact_frequency);

/**
 * initialize errors.db pruning
 */
util.delete_aged_errors();

server.listen(settings.port);
console.log("Server is listening to port "+settings.port);