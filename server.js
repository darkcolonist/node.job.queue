var express    = require('express'),
    async      = require('async'),
    uniqid     = require('uniqid'),
    app        = express(),
    bodyParser = require('body-parser'),
    http       = require('http')
    server     = http.createServer(app)
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

job_queue = async.queue(function (task, finished) {
  task.obj.finished = finished;
  task.execute(task.obj);
}, settings.concurrency);

app.post('/enqueue', function(req, res){
  if(!util.is_url(req.body.url))
    res.json(
      { 
        message : "ERROR: url parameter is not a valid url"
      }
    );
  
  job = {
    uid : uniqid(),
    queue : "main",
    status : "waiting",
    url : req.body.url,
    data : req.body.data,
    callback : req.body.callback
  };

  jobs.push(job);

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