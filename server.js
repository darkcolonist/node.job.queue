var express    = require('express'),
    async      = require('async'),
    uniqid     = require('uniqid'),
    bodyParser = require('body-parser'),
    http       = require('http'),
    request    = require('request'),

    app        = express(),
    server     = http.createServer(app),
    io         = require('socket.io').listen(server);

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({
  extended: true
}));

var settings = {
  concurrency : 5
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

  enqueue : function(data){
    var queue_name = typeof data.queue === 'undefined' ? "main" : data.queue

    queue = util.get_queue(queue_name);

    job = {
      uid : uniqid(),
      queue : queue_name,
      status : "waiting",
      url : data.url,
      data : data.data,
      callback : data.callback
    };

    task = {
      obj : job,
      execute : function(obj){
        obj.status = "working";

        console.log("working: "+obj.url);
        console.log("sending data: ");
        console.log(obj.data);

        request.post(
            obj.url,
            { form: obj.data },
            function (error, response, body) {
              console.log("response: "+body);

              if(typeof obj.callback !== 'undefined'){
                obj.url_response = body;

                console.log("working: "+obj.callback);
                request.post(
                  obj.callback,
                  { form : obj },
                  function(error_cb, response_cb, body_cb){
                    // nothing needs to be done here
                  }
                );
              }

              if (!error && response.statusCode == 200) {
                obj.status = "done";
              }else{
                obj.status = "failed";
              }

              obj.finished();
            }
        );
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
  }
}

server.listen(1028);
console.log("Server is listening to port 1028");