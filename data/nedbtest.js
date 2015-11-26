nedb   = require('nedb'),
moment = require('moment')

db_errors = new nedb({ filename: "errors.db", autoload: true })

var max_date = moment().subtract(24, "hours").format('YYYY-MM-DD HH:mm:ss')

console.log("maximum age: "+max_date)

/**
 * search
 */
db_errors.find({ timestamp : { $lte : max_date } }, function(err, docs){
  for (var i = 0; i < docs.length; i++) {
    console.log(docs[i]._id + ": " + docs[i].timestamp)
  }
})

/**
 * update
 */
db_errors.update({}, { $set : { timestamp : max_date } }, { multi : true }, function(err, num_replaced){
  console.log("updated "+num_replaced+" document(s)")
})