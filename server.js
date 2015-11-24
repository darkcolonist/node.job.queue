var express    = require('express'),
    app        = express(),
    bodyParser = require('body-parser');

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());

app.post('/enqueue', function(req, res){

});

app.listen(1028);
console.log("Server is listening to port 1028");