var express    = require('express'),
    app        = express(),
    bodyParser = require('body-parser');

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({
  extended: true
}));

var jobs = [
  {
    url : "http://www.example.com",
    data : { one : "this is the number one" },
    callback : "http://www.example.com/callback"
  }
];

app.post('/enqueue', function(req, res){
  console.log("attempting to enqueue:");
  console.log(req.body);

  job = {
    url : req.body.url,
    data : req.body.data,
    callback : req.body.callback
  };

  jobs.push(job);

  res.json(
    { 
      message : "job's done",
      job : job,
      req : req.body
    }
  );
});

app.get('/jobs', function(req, res){
  res.json(jobs);
});

app.listen(1028);
console.log("Server is listening to port 1028");