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
   * when the system is idle and nothing is running this will still
   * broadcast_lastest_status to all socket subscribers 
   */
  idle_update_frequency : 60000,

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
   * hidden idle queue time (seconds)
   * if last activity from now for this queue is greater than this 
   * setting, it will not be displayed in the dashboard
   */
  idle_queue_display: 300,

  /**
   * expiration time of errors in errors.db. (hours)
   * after this is reached, errors get pruned from errors.db
   * @type {Number}
   */
  max_age_of_errors : 24
};

var jobs = [];

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

app.get('/status', function(req,res){
  res.json(util.get_status());
})

var idle_broadcaster = null;
var broadcast_lastest_status = function(){
  clearTimeout(idle_broadcaster);

  var status = util.get_status();

  io.emit('status', status);

  idle_broadcaster = setTimeout(function(){
    broadcast_lastest_status();
  }, settings.idle_update_frequency);
}

io.on('connection', function(socket){
  broadcast_lastest_status();

  socket.on('queue:pause', function(queue_name){
    var queue = util.get_queue(queue_name, false);
    queue.pause();
    broadcast_lastest_status();
  });

  socket.on('queue:resume', function(queue_name){
    var queue = util.get_queue(queue_name, false);
    queue.resume();
    broadcast_lastest_status();
  });
});

app.get('/jobs', function(req, res){
  res.json(jobs);
});

util = {
  get_status : function(){
    var status = {
      queues : [],
      tasks : []
    };
    for(var q_key in queues){
      var queue = {
        name        : q_key,
        paused      : queues[q_key].paused,
        waiting     : queues[q_key].length(),
        running     : queues[q_key].running(),
        last_ping   : moment(queues[q_key].last_ping, "YYYY-MM-DD HH:mm:ss").fromNow(),
        last_ping_n : queues[q_key].last_ping,
        total_jobs  : queues[q_key].total_jobs,
        failed_jobs : queues[q_key].failed_jobs
      };

      var workers = queues[q_key].workersList();
      for(var q_t_key in workers){
        status.tasks.push(workers[q_t_key].data.obj);
      }

      if(moment().diff(
        moment(queue.last_ping_n, "YYYY-MM-DD HH:mm:ss"),
        'seconds') < settings.idle_queue_display){
        status.queues.push(queue);
      }
    }

    // sort queues by waiting then by name
    status.queues.sort(function(a, b){
      // if(a.waiting > b.waiting) return -1;                        // descending
      // if(a.waiting < b.waiting) return 1;                         // descending
      // if(a.running > b.running) return -1;                        // descending
      // if(a.running < b.running) return 1;                         // descending
      // if(a.last_ping_n > b.last_ping_n) return -1;                // descending
      // if(a.last_ping_n < b.last_ping_n) return 1;                 // descending
      if(a.name.toLowerCase() > b.name.toLowerCase()) return 1;   // ascending
      if(a.name.toLowerCase() < b.name.toLowerCase()) return -1;  // ascending
      return 0;
    });

    // sort and format the tasks
    status.tasks.sort(function(a, b){
      if(a.date_added > b.date_added) return 1; // ascending by date added
    });

    for(var t_key in status.tasks){
      status.tasks[t_key].added = moment().diff(
        moment(status.tasks[t_key].date_added, "YYYY-MM-DD HH:mm:ss"),
        'seconds') + "s ago";
      status.tasks[t_key].started = moment().diff(
        moment(status.tasks[t_key].date_started, "YYYY-MM-DD HH:mm:ss"),
        'seconds') + "s ago";
    }

    return status;
  },

  get_queue : function(name, touch){
    if(typeof queues[name] === 'undefined'){
      // create a new queue
      queues[name] = async.queue(function(task, finished){
        task.obj.finished = finished;
        task.execute(task.obj);
      }, settings.concurrency);

      queues[name].total_jobs = 0;
      queues[name].failed_jobs = 0;
    }

    if(typeof touch === 'undefined' || touch == true){
      queues[name].total_jobs ++;
      queues[name].last_ping = moment().format("YYYY-MM-DD HH:mm:ss");
    }

    return queues[name];
  },

  enqueue : function(data, in_db){
    var queue_name = typeof data.queue === 'undefined' ? "main" : data.queue;
    var in_db = typeof in_db === 'undefined' ? false : in_db;

    queue = util.get_queue(queue_name);

    job = {
      _id        : typeof data._id === 'undefined' ? uniqid() : data._id,
      queue      : queue_name,
      status     : typeof data.status === 'undefined' ? "waiting" : data.status,
      url        : data.url,
      data       : data.data,
      callback   : data.callback,
      date_added : moment().format("YYYY-MM-DD HH:mm:ss")
    };

    if(!in_db)
      db_jobs.insert(job, function(err, doc){ /** inserted */ });

    task = {
      obj : job,
      execute : function(obj){
        obj.status = "working";
        db_jobs.update({ _id: obj._id }, { $set: { "status" : obj.status } }, {}, function(err, num_replaced, upsert){});
        broadcast_lastest_status();

        obj = util.curl(obj);
      }
    }

    jobs.push(job);
    queue.push(task);
    broadcast_lastest_status();
  },

  curl : function(obj){
    obj.date_started = moment().format("YYYY-MM-DD HH:mm:ss");

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
            broadcast_lastest_status();
          });
        }

        // remove from queue after settings.done_jobs_lifetime
        setTimeout(function(){
          var index = jobs.indexOf(obj);

          db_jobs.remove({ _id: jobs[index]._id }, {}, function(err, num_removed){});

          jobs.splice(index, 1);

          broadcast_lastest_status();
        } , settings.done_jobs_lifetime);

        obj.finished();
        broadcast_lastest_status();
      }
    ).on('error', function(err){
      obj.error = err;
      obj.type = "url";

      job_queue = util.get_queue(obj.queue, false);
      job_queue.failed_jobs ++;

      obj.timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
      db_errors.insert(obj, function(err, doc){ /** inserted */ });
      broadcast_lastest_status();
    });

    return obj;
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