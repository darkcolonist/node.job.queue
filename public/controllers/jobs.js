var myApp = angular.module('myApp', []);

myApp
  .factory('socket', function(){
    return io.connect()
  })
  .controller('AppCtrl', ['$scope', 'socket', function($scope, socket){    
    $scope.queues = []

    socket.on('status', function(data){
      $scope.queues = data.queues
      $scope.tasks = data.tasks
      try_digest();
    })

    socket.on('queue:fetch_errors', function(data){
      $scope.error = data
      try_digest();
    })

    $scope.resume_queue = function(name){
      socket.emit('queue:resume', name)
    }

    $scope.pause_queue = function(name){
      socket.emit('queue:pause', name)
    }

    $scope.fetch_errors = function(name){
      socket.emit('queue:fetch_errors', name)
    }

    $scope.re_queue_failed = function(failed_id){
      socket.emit('queue:re_queue_failed', failed_id) 
    }

    var try_digest = function(){
      if(!$scope.$$phase){
        $scope.$digest()
        // console.log("digest success");
      }else{
        // console.log("digest running, will try in half a second..");
        setTimeout(try_digest, 500);
      }
    }

}])